---
title: "FastAPIとSQLAlchemy2.0ならもう型ヒントを諦めなくていい"
date: "2023-02-08"
tags: ["Python", "FastAPI", "SQLAlchemy", "ORM"]
---

サチコ（Google Search Console）を眺めていたら `FastAPI MySQL` がそれなりに需要ありそうと思ったので、FastAPI と SQLAlchemy を組み合わせて ORM を使う方法を紹介したいと思います。最近の SQLAlchemy（1.4以降）ではマッピングされたオブジェクトに型を適用することもできるので、型ヒントを活かして型安全なコードを書くことも難しくなくなっています。

## 環境

* Python 3.10.6
* FastAPI 0.89.1
* SQLAlchemy 2.0.1
* Docker 20.10.13
* Docker Compose v2.3.3

## 前提

FastAPI 公式ドキュメントの [SQL (Relational) Databases](https://fastapi.tiangolo.com/ja/tutorial/sql-databases/) のページを熟読しておいてください。

2023年1月にリリースされた SQLAlchemy 2.0を使用します。1系を使用している既存プロジェクトの場合は [SQLAlchemy 2.0 - Major Migration Guide](https://docs.sqlalchemy.org/en/20/changelog/migration_20.html) を参考に2.0へ移行してください。1.4から2.0の移行はスムーズだと思います。

SQLAlchemy で利用できる ORM のモデルの書き方はいくつかあります。個人的には [dataclass と統合した書き方](https://docs.sqlalchemy.org/en/20/orm/dataclasses.html)も好きですが、今回はシンプルにベーシックな実装を行います。

## 成果物

https://github.com/SogoKato/fastapi-sqlalchemy2

```py
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import ForeignKey, String, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

"""
SQLAlchemyのモデル.

Based on:
* https://docs.sqlalchemy.org/en/20/orm/quickstart.html#declare-models
* https://fastapi.tiangolo.com/ja/tutorial/sql-databases/#create-the-database-models
"""


class Base(DeclarativeBase):
    """各DBモデルの基底クラス."""

    pass


class User(Base):
    """usersテーブルのDBモデル."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool]

    items: Mapped[list["Item"]] = relationship(back_populates="owner")


class Item(Base):
    """itemsテーブルのDBモデル."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(String(30), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    owner: Mapped["User"] = relationship(back_populates="items")


"""
Pydanticのモデル.

Based on:
* https://fastapi.tiangolo.com/ja/tutorial/sql-databases/#create-the-pydantic-models
"""


class ItemBase(BaseModel):
    """Itemの基底クラス."""

    title: str
    description: str | None = None


class ItemCreateRequest(ItemBase):
    """Item作成のリクエストを表現するクラス."""

    pass


class ItemResponse(ItemBase):
    """Itemのレスポンスを表現するクラス."""

    id: int
    owner_id: int

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    """Userの基底クラス."""

    email: str


class UserCreateRequest(UserBase):
    """User作成のリクエストを表現するクラス."""

    password: str


class UserResponse(UserBase):
    """Userのレスポンスを表現するクラス."""

    id: int
    is_active: bool
    items: list[ItemResponse] = []

    class Config:
        orm_mode = True


"""
DBのCRUD操作を行う関数.

Based on:
* https://docs.sqlalchemy.org/en/20/changelog/migration_20.html#migration-orm-usage
* https://fastapi.tiangolo.com/ja/tutorial/sql-databases/#crud-utils
"""


def get_db_user(db: Session, user_id: int):
    """usersテーブルからuser_idに一致するUserを取得します."""
    return db.execute(select(User).where(User.id == user_id)).scalars().first()


def get_db_user_by_email(db: Session, email: str):
    """usersテーブルからemailに一致するUserを取得します."""
    return db.execute(select(User).where(User.email == email)).scalars().first()


def get_db_users(db: Session, skip: int = 0, limit: int = 100):
    """usersテーブルからUserをすべて取得します."""
    return db.execute(select(User).offset(skip).limit(limit)).scalars().all()


def create_db_user(db: Session, user: UserCreateRequest):
    """usersテーブルにUserを追加します."""
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = User(
        email=user.email, hashed_password=fake_hashed_password, is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_db_items(db: Session, skip: int = 0, limit: int = 100):
    """itemsテーブルからItemをすべて取得します."""
    return db.execute(select(Item).offset(skip).limit(limit)).scalars().all()


def create_db_user_item(db: Session, item: ItemCreateRequest, user_id: int):
    """itemsテーブルにItemを追加します."""
    db_item = Item(**item.dict(), owner_id=user_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


"""
FastAPIでSQLAlchemyを使うためのセットアップ.
"""
# DBセッションを作成するクラスを作る.
SQLALCHEMY_DATABASE_URL = "mysql+mysqldb://user:password@db/test"

# デバッグ用にecho=Trueに設定.
engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# DBマイグレーションを行う.
Base.metadata.create_all(bind=engine)

# FastAPIをインスタンス化.
app = FastAPI()


def get_db():
    """リクエストが来たらセッションを作成し、処理が完了したら閉じるためのDependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


"""
FastAPIのルーティング.
"""


@app.post("/users/", response_model=UserResponse)
def create_user(user: UserCreateRequest, db: Session = Depends(get_db)):
    """ユーザーを作成します."""
    db_user = get_db_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return create_db_user(db=db, user=user)


@app.get("/users/", response_model=list[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """ユーザーを一覧します."""
    users = get_db_users(db, skip=skip, limit=limit)
    return users


@app.get("/users/{user_id}", response_model=UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    """ユーザーを取得します."""
    db_user = get_db_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.post("/users/{user_id}/items/", response_model=ItemResponse)
def create_item_for_user(
    user_id: int, item: ItemCreateRequest, db: Session = Depends(get_db)
):
    """ユーザーのアイテムを作成します."""
    return create_db_user_item(db=db, item=item, user_id=user_id)


@app.get("/items/", response_model=list[ItemResponse])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """アイテムを一覧します."""
    items = get_db_items(db, skip=skip, limit=limit)
    return items
```

以上を `main.py` として保存して、下記の `Dockerfile` `docker-compose.yml` で `docker compose up --build` すれば動きます。

```dockerfile
FROM python:3.10

WORKDIR /app

ENV PATH=$PATH:/root/.local/bin
COPY pyproject.toml poetry.lock ./

RUN curl -sSL https://install.python-poetry.org | python3 - \
    && poetry install

CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--reload"]
```

```yaml
version: '3'
services:
  app:
    build:
      context: ./
      dockerfile: Dockerfile
    ports:
      - '8000:8000'
    volumes:
      - type: bind
        source: ./
        target: /app
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: test
      MYSQL_USER: user
      MYSQL_PASSWORD: password
```

## ちょこっと解説

### SQL Alchemy 2.0 に対応させる

コードを見ればそれがすべてなのであまり解説することはないのですが、FastAPI 公式ドキュメントの [SQL (Relational) Databases](https://fastapi.tiangolo.com/ja/tutorial/sql-databases/) のページとの大きな違いは、SQLAlchemy 2.0風な書き方になっているかどうかです。

SQLAlchemy を使ったことのある方なら `session.query(User).filter(User.id == user_id).first()` のような書き方に慣れているかと思いますが、SQLAlchemy 2.0 ではこの書き方は[レガシーとされています](https://docs.sqlalchemy.org/en/20/orm/queryguide/query.html#legacy-query-api)。

SQLAlchemy Core に統一された書き方が推奨されており、上記の例は以下のように書き換えられます。

```py
session.execute(select(User).where(User.id == user_id)).scalars().first()
```

特徴は

* ステートメント（SELECT ... WHERE ...）とその実行が明確に分離された
* `Query` クラスではなく `Result` クラスや `ScalarResult` で `.all()` や `.first()` を使う

ことです。今までの API よりも分かりやすくなっていますし、型推論も効いているので使いやすいと思います。

モデルクラスの書き方も変わっています。

今までは以下のように定義していた部分が

```py
id = Column(Integer, primary_key=True, index=True)
```

このようになります。

```py
id: Mapped[int] = mapped_column(primary_key=True, index=True)
```

それっぽく移植していけば迷うことは少ないと思います。

### DB セッションの取得には dependency を使う

FastAPI の主要な機能の一つともいえる dependency を使って、DB セッションの生成を行うのが定番となっています。ちなみに、`SessionLocal` の命名は、`sqlalchemy.orm.Session` と区別するためだそうです。

```py
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

この `get_db` dependency を使うことで、リクエストの開始時に DB セッションを生成し（`yield` の段階で渡される）、リクエストの処理が完了したら（finally 節で）DB セッションが閉じられるようになります。Dependency での `yield` の使い方については [Dependencies with yield](https://fastapi.tiangolo.com/ja/tutorial/dependencies/dependencies-with-yield/) をご参照ください。

Dependency は、別の dependency の中でも使うことができるので、リクエストの前処理（バリデーションなど）で引数に `db = Depends(get_db)` と指定することで、その中でも DB セッションを使うことができます。便利ですね。

### Pydantic の ORM mode

私のユースケースでは普段使っていないのですが、マッチすれば便利だなと思うのが Pydantic の `orm_mode = True` です。

これが有効になっていると、Pydantic が値を取得するときに `data["id"]` のように辞書のキーだけでなく、`data.id` のように属性でも値を取得しようと試みるようになるそうです。これだけ聞いてもあまりピンときませんが、この違いがあることによって ORM が張っている relationship（通常は lazy loading なので求められるまでは存在していない）の値をとってくることが可能になるようです（`@property` で呼び出して値をとってこられるというようなことかなと予想しています）。

## まとめ

[Prisma Client Python](https://prisma-client-py.readthedocs.io/en/stable/) の型付けの開発者体験も結構好きでしたが、SQLAlchemy もまだまだ勢いがありますね。ぜひ活用してみてください。

関連記事もどうぞ。  
[SQLAlchemyで'MySQL server has gone away'が発生した時の対処法2つ](/posts/2023/01/sqlalchemy-dealing-with-disconnects)

## おまけ：API をたたいてみる

```
$ curl -s localhost:8000/users/ -XPOST \
  -H 'content-type: application/json' \
  -d '{"email": "me@example.com", "password": "mystrongpassword"}' \
  | jq
```

```json
{
  "email": "me@example.com",
  "id": 1,
  "is_active": true,
  "items": []
}
```

```
$ curl -s localhost:8000/users/ | jq
```

```json
[
  {
    "email": "me@example.com",
    "id": 1,
    "is_active": true,
    "items": []
  }
]
```

```
$ curl -s localhost:8000/users/?limit=0 | jq
```

```json
[]
```

```
$ curl -s localhost:8000/users/1 | jq
```

```json
{
  "email": "me@example.com",
  "id": 1,
  "is_active": true,
  "items": []
}
```

```
$ curl -s localhost:8000/users/1/items/ -XPOST \
  -H 'content-type: application/json' \
  -d '{"title": "LEVEL3", "description": "My favourite album"}' \
  | jq
```

```json
{
  "title": "LEVEL3",
  "description": "My favourite album",
  "id": 1,
  "owner_id": 1
}
```

```
$ curl -s localhost:8000/users/1 | jq
```

```json
{
  "email": "me@example.com",
  "id": 1,
  "is_active": true,
  "items": [
    {
      "title": "LEVEL3",
      "description": "My favourite album",
      "id": 1,
      "owner_id": 1
    }
  ]
}
```

```
$ curl -s localhost:8000/items/ | jq
```

```json
[
  {
    "title": "LEVEL3",
    "description": "My favourite album",
    "id": 1,
    "owner_id": 1
  }
]
```

## 参考文献

* [SQL (Relational) Databases](https://fastapi.tiangolo.com/ja/tutorial/sql-databases/)
* [ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
