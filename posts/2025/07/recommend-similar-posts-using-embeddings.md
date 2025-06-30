---
title: "記事をベクトル化して類似度の高い記事をおすすめしてみる"
date: "2025-07-01"
tags: ["LLM", "ブログ"]
---

RAG を調べるとまず最初に出てくる概念がテキストのベクトル化ですね。

テキストのベクトル化をブログの記事に対して実施して互いの類似度を計算すれば、精度高く関連記事を "RECOMMENDED" 欄に出せるはず！　っていうことで、やってみました。元々は同じタグを持っている記事を新しい順に表示しているだけでしたが、ちょっといい感じになりました。

このサイトは SSG で運用しているので、ビルドどこでやるかとか、ベクトルデータベースどこにするのかとかでちょっと悩みました。

## 環境

* Next.js 15.3.4
  * この機会にエイヤで pages router から app router へ移行した
* @langchain/openai 0.5.13
* @langchain/community 0.3.46

## こうした

### フロー

1. 記事を書く
1. コミットする
1. Husky の pre-commit フックが起動し、変更をコミット
   1. ファイルハッシュに変更がある記事を見つける
   1. 該当記事を LLM で要約
   1. 要約をベクトル化
   1. Embedding をベクトルデータベースファイルに書き込み
   1. ベクトルデータベースファイルをコミット
1. GitHub Actions がビルド
   1. Embedding を使って記事間の類似度を計算
   1. 類似度が閾値（88%）以上の記事をおすすめする

閾値はエイヤーーです。だいたいどれも IT 系のエンジニアリングの記事なんで、似てない記事でも80%程度は類似度がありました。90%だとちょっと絞られすぎ感があったのでキリが良さそうな88%にしてます。

### ベクトルデータベース

形式: JSON

[ただのファイル](https://github.com/SogoKato/sogokato.github.io/blob/main/data/index.json) です。スキーマはこんな感じです。

```ts
export type SummaryIndex = {
  // ref は `/posts/2025/07/recommend-similar-posts-using-embeddings` みたいな
  [ref: string]: {
    fileHash: string;
    embedding: number[];
    summary: string;
  };
};
```

### Embedding モデル

[intfloat/multilingual-e5-large](https://huggingface.co/intfloat/multilingual-e5-large)

日本語でも精度良く embedding を作れます。ただし入力は 512 トークンまでで、それを超える部分に関しては無視されます。

## 気にしたところ

### フローの組み方

SEO 的に記事の URL は一度決めたら不変なものです。なのでこれをキーとして、ファイルハッシュが変わっていないかをチェックして、記事が更新されていたり新しい記事ができたときには、要約を生成して、ベクトル化します。成果物をコミットしちゃうのはちょっと抵抗がありましたが、記事本文と同様にビルドするための資材だということにしました（別にちゃんとデータベースを用意するほどでもないし、毎回 embedding を作るのも遅くなるし無駄）。

要約を生成しているのは、multilingual-e5-large の入力上限が冒頭 512 トークンなので、なるべく記事全体の内容が embedding に反映されるようにするという意図です。要約は普通に LLM を呼び出しているだけです。

[sogokato.github.io/vectorize.ts](https://github.com/SogoKato/sogokato.github.io/blob/2f8c6c1776d7dc0aa1233bf5d5843c3647755b68/vectorize.ts)

```ts
import { ChatOpenAI } from "@langchain/openai";

const summarize = async (post: RawPost) => {
  // needs OPENAI_API_KEY to be set
  const llm = new ChatOpenAI({
    model: "gpt-4.1",
    maxTokens: 512,
  });
  const res = await llm.invoke(
    `この記事を日本語で512 tokens以内で要約してください。\n\n---\n\n# ${post.metadata.title}\n\n${post.content}`
  );
  console.log(res.usage_metadata?.output_tokens);
  return res.text;
};
```

ベクトル化する部分

```ts
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const embedPosts = async (posts: RawPost[]): Promise<RawPost[]> => {
  // needs HUGGINGFACEHUB_API_KEY to be set
  const model = new HuggingFaceInferenceEmbeddings({
    model: "intfloat/multilingual-e5-large",
  });

  const docs = posts.map((p) => p.summary).filter((p) => p !== null);
  const embeddings = await model.embedDocuments(docs);

  return posts.map((post, i) => ({
    ...post,
    embedding: embeddings[i],
  }));
};
```

また、このベクトル化する作業は自動化しないと絶対忘れる自信があったので [Husky](https://typicode.github.io/husky/) を導入して pre-commit 時に自動で上記スクリプトが動くようにしました。今は関係ない変更をコミットした時に書きかけの記事がベクトル化されちゃう事故が起こりますが、今後 lint-staged を導入していい感じにしていきたい所存。

### データの持ち方

最初は embedding をそのまま記事オブジェクトに渡し、レンダリング時に類似度を計算しておすすめに出すようにやってみたんですが、SSG の特性上それをやるとビルドの成果物の量が従来の数十倍にもなってしまいました。なので、記事オブジェクトを作る時におすすめ記事のリストまで作るようにし、embedding はビルド時以外は使わないように設計しなおしました。

詳細は割愛しますが、app router の各 page.tsx 等から呼び出される `getAllPosts()` は react の機能で [cache](https://react.dev/reference/react/cache) 化するようにしてます（SSG でビルドしたらたぶん関係ないですが、dev で動かしている時は速くなってました、キャッシュなしで 800〜1500ms 程度なのがキャッシュありで 400ms 程度）。

[`sogokato.github.io/utils/readPosts.ts`](https://github.com/SogoKato/sogokato.github.io/blob/2f8c6c1776d7dc0aa1233bf5d5843c3647755b68/utils/readPosts.ts)

```ts
import { cache } from "react";

/*
 * Reactアプリで使用する記事メタデータリスト
 */
export const getAllPosts = cache(() => {
  // RawPost は md ファイルをパースしたもの + embedding を持っている
  const rawPosts = orderBy(
    getRawPosts(),
    (o) => new Date(o.metadata.date),
    "desc"
  );
  // RawPost から Post に変換する時におすすめ記事リストを作る
  // あとはおすすめ記事のリストをレンダリングするだけ
  return rawPosts.map((p) => convertRawPostToPost(p, rawPosts));
});
```
