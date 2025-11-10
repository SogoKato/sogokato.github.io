---
title: "SQLModel（SQLAlchemy）とpgvectorでコサイン類似度検索やハイブリッド検索を実装してみる"
date: "2025-11-10"
tags: ["データベース", "PostgreSQL", "RAG", "SQLAlchemy"]
---

[前回の記事](/posts/2025/11/cloudnative-pg-pgvector) で作った PostgreSQL + pgvector を使って、一般的な RAG で用いられるコサイン類似度検索やハイブリッド検索（Reciprocal Rank Fusion = RRF）を実装してみました。

## 環境

* PostgreSQL 16.10
  * pgvector 0.8.1
  * pg_trgm 1.6
* Python 3.12.0
  * langchain 1.0.5
  * langchain-huggingface 1.0.1
  * pgvector 0.4.1
  * psycopg[binary] 3.2.12
  * sentence-transformers 5.1.2
  * sqlmodel 0.0.27
* google/embeddinggemma-300m 57c266a

以下のコマンドで PostgreSQL 拡張機能を有効化済み

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```

## できたもの

[SogoKato/sqlmodel-pgvector: Example for SQLModel and pgvector](https://github.com/SogoKato/sqlmodel-pgvector)

```bash
export HUGGING_FACE_HUB_TOKEN=YOUR_TOKEN

uv sync
uv run main.py
```

## ちょっと解説

### モデル定義

SQLModel の ORM はこのように定義しました。`Article.embeddings` がベクトルを格納するためのカラムで、Python の型的には `list[float]` にしています。`Field()` の `sa_type` 引数に `Vector(768)` を渡すことで、SQLAlchemy によってデータベースでのこのカラムの型が pgvector のベクトル型であることが宣言されます。768は google/embeddinggemma-300m の次元数です。

```python
from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel

class Article(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    content: str
    published_at: datetime = Field(sa_type=DateTime(timezone=True))
    embeddings: list[float] = Field(sa_type=Vector(768))

SQLModel.metadata.create_all(engine)
```

ただ、実際に SELECT した `Article` インスタンスの `embeddings` に実際に入っている値は `numpy.ndarray` です。このあたりいい感じにできないか試行錯誤しましたが、いったん SELECT 後に代入し直すことでお茶を濁しました。SQLModel でも Pydantic のカスタム validator 機能が使えれば、インスタンス化時に `numpy.ndarray` を `tolist()` できればモデル内で完結していい感じと思いますが、現状は `table=True` だと呼ばれません（Workaround はあるみたいなので試してもいいかも）。

[Why does a SQLModel class with `table=True` not validate data ? · Issue #453 · fastapi/sqlmodel](https://github.com/fastapi/sqlmodel/issues/453)

```python
import numpy as np

def ensure_embeddings_type(article: Article) -> Article:
    if isinstance(article.embeddings, np.ndarray):
        article.embeddings = article.embeddings.tolist()
    return article
```

### コサイン類似度検索

こんな感じで `google/embeddinggemma-300m` モデルを使って埋め込み（エンベディング）を作っておきます。

```python
from langchain_huggingface.embeddings import HuggingFaceEmbeddings

query = input("Query: ")
embeddings = HuggingFaceEmbeddings(model_name="google/embeddinggemma-300m")
embedding_vector = embeddings.embed_query(query)
```

検索します。

```python
from typing import Sequence
from sqlmodel import Session, select

def cosine_similarity(
    session: Session, embedding_vector: list[float], limit: int
) -> Sequence[Article]:
    statement = (
        select(Article)
        .order_by(Article.embeddings.cosine_distance(embedding_vector))
        .limit(limit)
    )
    return session.exec(statement).all()

database_url = "postgresql+psycopg://user:password@host:port/app"
engine = create_engine(database_url, echo=True)

with Session(engine) as session:
    results = cosine_similarity(session, embedding_vector, 5)
    articles = [ensure_embeddings_type(r) for r in results]
```

作られるクエリはこんな感じ。`<=>` が pgvector のコサイン距離を表す演算子です。

```sql
SELECT article.id, article.title, article.content, article.published_at, article.embeddings
FROM article ORDER BY article.embeddings <=> %(embeddings_1)s
LIMIT %(param_1)s::INTEGER
```

### ハイブリッド検索（RRF）

[pgvector/pgvector-python の Hybrid search with SentenceTransformers (Reciprocal Rank Fusion) サンプル](https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search/rrf.py) の以下の SQL 文を SQLAlchemy のステートメントで表現します。

```sql
WITH semantic_search AS (
    SELECT id, RANK () OVER (ORDER BY embedding <=> %(embedding)s) AS rank
    FROM documents
    ORDER BY embedding <=> %(embedding)s
    LIMIT 20
),
keyword_search AS (
    SELECT id, RANK () OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), query) DESC)
    FROM documents, plainto_tsquery('english', %(query)s) query
    WHERE to_tsvector('english', content) @@ query
    ORDER BY ts_rank_cd(to_tsvector('english', content), query) DESC
    LIMIT 20
)
SELECT
    COALESCE(semantic_search.id, keyword_search.id) AS id,
    COALESCE(1.0 / (%(k)s + semantic_search.rank), 0.0) +
    COALESCE(1.0 / (%(k)s + keyword_search.rank), 0.0) AS score
FROM semantic_search
FULL OUTER JOIN keyword_search ON semantic_search.id = keyword_search.id
ORDER BY score DESC
LIMIT 5
```

K=60 は RRF の定数です。

また、キーワード検索はスペースでの分かち書き前提の English で全文検索しても精度が出ないので、pg_trgm 拡張を使用します。本当は pg_trgm より pg_bigm の方がいいみたいですが、追加でのインストールが必要なので今回は pg_trgm を使います。

```python
Numeric = float | Decimal

def hybrid_search_rrf(
    session: Session,
    query_text: str,
    embedding_vector: list[float],
    limit: int,
    k: int = 60,
) -> Sequence[tuple[Article, Numeric]]:
    # 最終的なlimitの4倍の数をsemantic,keywordそれぞれで取得する
    candidate_multiplier = 4
    semantic_limit = limit * candidate_multiplier
    keyword_limit = limit * candidate_multiplier
    keyword_similarity_threshold = 0.1

    semantic_search = (
        select(
            Article.id,
            func.rank()
            .over(order_by=Article.embeddings.cosine_distance(embedding_vector))
            .label("rank"),
        )
        .order_by(Article.embeddings.cosine_distance(embedding_vector))
        .limit(semantic_limit)
        .cte("semantic_search")
    )

    keyword_search = (
        select(
            Article.id,
            func.rank()
            .over(order_by=func.similarity(Article.content, query_text).desc())
            .label("rank"),
        )
        .where(
            func.similarity(Article.content, query_text) > keyword_similarity_threshold
        )
        .order_by(func.similarity(Article.content, query_text).desc())
        .limit(keyword_limit)
        .cte("keyword_search")
    )

    score_expr = (
        func.coalesce(1.0 / (k + semantic_search.c.rank), 0.0)
        + func.coalesce(1.0 / (k + keyword_search.c.rank), 0.0)
    ).label("score")

    statement = (
        select(
            Article,
            score_expr,
        )
        .select_from(
            semantic_search.join(
                keyword_search,
                semantic_search.c.id == keyword_search.c.id,
                isouter=True,
                full=True,
            ).join(
                Article,
                Article.id == func.coalesce(semantic_search.c.id, keyword_search.c.id),
            )
        )
        .order_by(score_expr.desc())
        .limit(limit)
    )

    return session.exec(statement).all()

results_with_score = hybrid_search_rrf(
    session, query, embedding_vector, 5
)
```

最終的には `Ariicle.id` ではなく `Article` を取得したいので、元の SQL 文にはない `Article` の join を追加してます。
長いですが作られるクエリはこんな感じ。

```sql
WITH semantic_search AS
(SELECT article.id AS id, rank() OVER (ORDER BY article.embeddings <=> %(embeddings_1)s) AS rank
FROM article ORDER BY article.embeddings <=> %(embeddings_2)s
LIMIT %(param_3)s::INTEGER),
keyword_search AS
(SELECT article.id AS id, rank() OVER (ORDER BY similarity(article.content, %(similarity_1)s::VARCHAR) DESC) AS rank
FROM article
WHERE similarity(article.content, %(similarity_2)s::VARCHAR) > %(similarity_3)s ORDER BY similarity(article.content, %(similarity_4)s::VARCHAR) DESC
LIMIT %(param_4)s::INTEGER)
SELECT article.id, article.title, article.content, article.published_at, article.embeddings, coalesce(%(param_1)s / CAST((%(rank_1)s::INTEGER + semantic_search.rank) AS NUMERIC), %(coalesce_1)s) + coalesce(%(param_2)s / CAST((%(rank_2)s::INTEGER + keyword_search.rank) AS NUMERIC), %(coalesce_2)s) AS score
FROM semantic_search FULL OUTER JOIN keyword_search ON semantic_search.id = keyword_search.id JOIN article ON article.id = coalesce(semantic_search.id, keyword_search.id) ORDER BY score DESC
LIMIT %(param_5)s::INTEGER
```

サンプルで作った文章にキーワード検索の強みを活かせるような固有表現がなくてどっちの検索方法でも同じ結果になっちゃいますが、生きたデータを入れると結果も変わってくるんだろうと思います。それでは今回はこの辺で。

## 参考文献

* [pgvector/pgvector: Open-source vector similarity search for Postgres](https://github.com/pgvector/pgvector)
* [pgvector/pgvector-python: pgvector support for Python](https://github.com/pgvector/pgvector-python?tab=readme-ov-file)
* [pgvector-python/examples/hybrid_search/rrf.py at master · pgvector/pgvector-python](https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search/rrf.py)
* [ハイブリッド検索のスコアリング (RRF) - Azure AI Search | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/search/hybrid-search-ranking)
* [EmbeddingGemma モデルの概要  |  Google AI for Developers](https://ai.google.dev/gemma/docs/embeddinggemma?hl=ja)
* [google/embeddinggemma-300m · Hugging Face](https://huggingface.co/google/embeddinggemma-300m)
* [SQLModel](https://sqlmodel.tiangolo.com/)
* [PostgreSQL — SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html)
* [psycopg 3.3.0.dev2 documentation](https://www.psycopg.org/psycopg3/docs/index.html)
