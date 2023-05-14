---
title: "SQLAlchemyのセッション・トランザクションを理解する"
date: "2023-05-14"
tags: ["Python", "SQLAlchemy", "データベース"]
showTerminalAside: true
---

SQLAlchemy の [Session](https://docs.sqlalchemy.org/en/20/orm/session_api.html#sqlalchemy.orm.Session) や [scoped_session](https://docs.sqlalchemy.org/en/14/orm/contextual.html#sqlalchemy.orm.scoped_session)、トランザクションに関して理解していきます。

## 用語おさらい

### セッション（Session）

SQLAlchemy の [Session](https://docs.sqlalchemy.org/en/20/orm/session_api.html#sqlalchemy.orm.Session) オブジェクトは、ORM マッピングされたオブジェクトの永続化に関する操作を管理するオブジェクトです。

`sqlalchemy.orm.Session` を直接インスタンス化しても良いですが、実環境では sessionmaker を使うことが一般的です。sessionmaker は Session オブジェクトを作るためのファクトリで、任意の設定をした Session オブジェクトを生成することができます。

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(...)
SessionLocal = sessionmaker(..., bind=engine)

session = SessionLocal()
```

セッションは論理的なものなので、データベース側で認識されるものではありません。また、1つのセッションの中で、次に説明するトランザクションを複数持つことができます（ただし同時に扱えるトランザクションは1つのみです）。

セッションのライフサイクルとしては、Web API なら1リクエストに1セッション、バックグラウンドでプロセスをフォークしてジョブを実行するシステムならジョブごとに1セッションとすることが推奨されています。  
なので、1セッションをずっと使い続けるのもよろしくないですが、1リクエスト・1ジョブの中でいくつものセッションを使うのも良くないです。多くのケースでは DB 処理するコードを関数やクラスにまとめると思いますが、それらの中でセッションを生成するのではなく、その外側で作り、引数として渡してあげるようにしましょう。[^1]

[^1]: [When do I construct a Session, when do I commit it, and when do I close it?](https://docs.sqlalchemy.org/en/20/orm/session_basics.html#when-do-i-construct-a-session-when-do-i-commit-it-and-when-do-i-close-it)

### トランザクション

データベースの文脈におけるトランザクションの意味と同じです。つまり、開始してから更新処理を行い、コミットまたはロールバックを行うまでの一連の処理単位です。

SQLAlchemy では Session オブジェクトのメソッドを呼んで操作します。

暗黙的な方法と、明示的に Python の context manager（with 文）を使う方法があります。

* 暗黙的な方法の例
  ```python
  session.add(some_object())
  session.add(some_other_object())
  
  session.commit()  # コミットする
  # 本当は try/except/finally でロールバックや close をする必要がある
  ```
* context manager を使う方法の例
  ```python
  with session.begin():
      session.add(some_object())
      session.add(some_other_object())
  # コンテキストから抜けるとき（トランザクションの終了時）にコミットされる
  # エラーが起こったらロールバックされる
  ```

### コネクション

コネクションはセッションやコネクションとは別のレイヤーのものです。文字通りデータベースサーバーとの接続を表します。

SQLAlchemy では無効化しない限り、コネクション・プールにコネクションが貯められていて（connection pooling）、SQL コマンドを発行するたびにプールからコネクションをチェックアウト（取り出し）し、実行後にプールに返却します。

そのため Session を close しても、コネクションが切断されるわけではありません。コネクションに関しては、下記の関連記事をご覧ください。

関連記事：[SQLAlchemyで'MySQL server has gone away'が発生した時の対処法2つ](/posts/2023/01/sqlalchemy-dealing-with-disconnects)

## 気になったところを掘り下げ

セッション・トランザクションに関して気になった以下の観点について、検証しつつ調べてみます。

* close はいつするべきか、しなくてもいいのか
* scoped_session とは何か

### 検証環境

* Docker
* Python 3.11.3
* SQLAlchemy 2.0.13
* MySQL 8.0

以下では、WASM で Python が実行されます。Python のバージョンは実行タイミングによって異なる可能性があります。DB には SQLite を使います。

```pyconfig
terminal = false
packages = ["sqlite3", "sqlalchemy==2.0.13"]
```

```python:pyscript
import platform
import sqlite3
import sqlalchemy

print("Python version is", platform.python_version())
print("sqlalchemy version is", sqlalchemy.__version__)

con = sqlite3.connect("sample.db")
cur = con.cursor()
cur.execute("create table users (id int not null primary key, name varchar(10))")
print("db table created")
```

```python:pyscript
print("--------------------")
import logging
from dataclasses import dataclass
import traceback
from sqlalchemy import Column, Integer, String, Table, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import registry, scoped_session, sessionmaker

logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.DEBUG)
logging.getLogger("sqlalchemy.pool").setLevel(logging.DEBUG)

engine = create_engine("sqlite+pysqlite:///sample.db")

mapper_registry = registry()

@mapper_registry.mapped
@dataclass
class User:
    __table__ = Table(
        "users",
        mapper_registry.metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String(10)),
    )
    id: int
    name: str

print("sqlalchemy configured")
```

### close はいつするべきか、しなくてもいいのか

SQLAlchemy において Session を close するとは、Session インスタンスをリセットして再使用できる状態にすることです。

セッションを閉じるには [Session.close()](https://docs.sqlalchemy.org/en/20/orm/session_api.html#sqlalchemy.orm.Session.close) メソッドを呼ぶ方法と、context manager を使う方法があります。

* Session.close() メソッドを呼ぶ方法の例
  ```python
  session.execute(update(FooBar).values(x=5))
  session.commit()
  session.close()
  ```
* context manager を使う方法の例
  ```python
  with Session(engine) as session:
      session.execute(update(FooBar).values(x=5))
      session.commit()
  ```

トランザクションはコミットまたはロールバックがされるまで持続します。そのため、close() メソッドを呼ぶ方法において commit() が失敗し、close() がされないと、その Session インスタンスではそれ以降 DB 操作ができません。下記では、`jiro` の挿入に失敗してトランザクションが残った状態で `saburo` を挿入しようとしているので `sqlalchemy.exc.PendingRollbackError: This Session's transaction has been rolled back due to a previous exception during flush. To begin a new transaction with this Session, first issue Session.rollback(). Original exception was: (sqlite3.IntegrityError) UNIQUE constraint failed: users.id` と出ています。

```python:pyscript
print("--------------------")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
session = SessionLocal()
taro = User(id=1, name="taro")
print(">>> session.add(taro)")
session.add(taro)
print(">>> session.commit()")
session.commit()
try:
    jiro = User(id=1, name="jiro")  # idが重複しているのでエラーになる
    print(">>> session.add(jiro)")
    session.add(jiro)
    print(">>> session.commit()")
    session.commit()
except IntegrityError as e:
    print("".join(traceback.format_exception_only(e)))
    # rollback()すればsessionを再使用できるようになる
    # session.rollback()
# rollback()の代わりにclose()でもよい
# finally:
#     session.close()
saburo = User(id=3, name="saburo")
print(">>> session.add(saburo)")
session.add(saburo)
print(">>> session.commit()")
session.commit()  # 失敗する
```

```python:pyscript
print("--------------------")
print(">>> print(engine.pool.status())")
print(engine.pool.status())
# Pool size: 5  Connections in pool: 0 Current Overflow: -4 Current Checked out connections: 1
```

トランザクションが未完了の状態になったとき、Session がコネクションをプールに返却していない状態になっています。

try/except/finally を使って rollback() や close() をするか、context manager を使うか、など何らかの方法で必ずセッションを閉じるようにしましょう。

### scoped_session とは何か

SQLAlchemy には、スレッド・ローカルなスコープでセッションを管理するための機能として、scoped_session という関数があります。  
Python の [threading.local()](https://docs.python.org/3/library/threading.html#threading.local) を使用して、スレッドごとに Session インスタンスを管理するためのレジストリとなっています。

スレッド処理に詳しい人向けの機能となっていて、「スレッド・ローカル変数」といった言葉に馴染みのない人は [Flask-SQLAlchemy](https://pypi.org/project/Flask-SQLAlchemy/) などの既製の SQLAlchemy 統合を使うことが推奨されています。

まずは公式ドキュメント [Contextual/Thread-local Sessions](https://docs.sqlalchemy.org/en/20/orm/contextual.html) を読んでいただくことをお勧めします。以下の解説は網羅的な説明にはなっていません。

では、触ってみましょう。  
（なお、執筆時点で Pyodide が threading 未サポートなので雰囲気だけ伝われば・・・）

`scoped_session` に Session ファクトリを渡してラップします。ラップされたオブジェクトのインスタンスは Session の持つ各メソッドが使えます。

[scoped_session.remove()](https://docs.sqlalchemy.org/en/20/orm/contextual.html#sqlalchemy.orm.scoped_session.remove) を呼ぶまでの間、scoped_session レジストリは同じインスタンスを返します。remove() すると、セッションは閉じられ、レジストリから消去されます。

```python:pyscript
print("--------------------")
SessionThreadLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
scoped_session_1 = SessionThreadLocal()
shiro = User(id=4, name="shiro")
print(">>> scoped_session_1.add(shiro)")
scoped_session_1.add(shiro)
print(">>> scoped_session_1.commit()")
scoped_session_1.commit()
scoped_session_2 = SessionThreadLocal()
print(">>> print(scoped_session_1 is scoped_session_2)")
print(scoped_session_1 is scoped_session_2)  # True
SessionThreadLocal.remove()
scoped_session_3 = SessionThreadLocal()
print(">>> print(scoped_session_1 is scoped_session_3)")
print(scoped_session_1 is scoped_session_3)  # False
```

注意点としては remove() をした後も、変数に格納された Session インスタンスは利用できるという点です（レジストリがインスタンスを管理しなくなるだけで、使えなくなるわけではない）。  
ややこしくなるので、誤って remove() 後に同じインスタンスを使ってしまわないように気を付けましょう（経験者）。

```python:pyscript
print("--------------------")
goro = User(id=5, name="goro")
print(">>> scoped_session_1.add(goro)")
scoped_session_1.add(goro)
print(">>> scoped_session_1.commit()")
scoped_session_1.commit()  # エラーにはならない
```

## おわりに

DB のセッションやトランザクションは閉じ忘れが発生しやすい部分ですので、しっかりテストや動作確認をしてバグを埋め込まないようにしましょう。

## 参考文献

* [Session API](https://docs.sqlalchemy.org/en/20/orm/session_api.html)
* [Sessions / Queries - “This Session’s transaction has been rolled back due to a previous exception during flush.” (or similar)](https://docs.sqlalchemy.org/en/20/faq/sessions.html#this-session-s-transaction-has-been-rolled-back-due-to-a-previous-exception-during-flush-or-similar)
* [Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
* [Transactions and Connection Management](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)
* [Contextual/Thread-local Sessions](https://docs.sqlalchemy.org/en/20/orm/contextual.html)
* [Session: close(), remove(), expire_all() and expunge_all()](https://groups.google.com/g/sqlalchemy/c/twoHzgXcR60/m/nZqMKkCz9UwJ)
