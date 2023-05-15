---
title: "CeleryにおけるSQLAlchemyのセッション管理"
date: "2023-05-15"
tags: ["Python", "SQLAlchemy", "データベース", "Celery"]
---

前回の記事では SQLAlchemy の Session について解説しました。今回はその応用として、[Celery](https://docs.celeryq.dev/en/stable/index.html) においてどのように Session を管理するかを考えたいと思います。

関連記事：
* [SQLAlchemyのセッション・トランザクションを理解する](/posts/2023/05/sqlalchemy-sessions-and-transactions)
* [SQLAlchemyで'MySQL server has gone away'が発生した時の対処法2つ](/posts/2023/01/sqlalchemy-dealing-with-disconnects)

## 結論

以下のように DB 操作を行うタスクのためのクラスを作ります。

```python
from typing import Optional
from celery import Task
from sqlalchemy.orm import Session

engine = create_engine(...)
SessionLocal = sessionmaker(..., bind=engine)

class DatabaseTask(Task):
    _db: Optional[Session] = None

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None

    @property
    def db(self):
        if self._db is None:
            self._db = SessionLocal()
        return self._db
```

デコレータに `base=DatabaseTask` `bind=True` と指定します。

```python
from celery import Celery

app = Celery()

@app.task(base=DatabaseTask, bind=True)
def create(self: DatabaseTask, name: str):
    new_user = User(name=name)
    self.db.add(new_user)
    self.db.commit()
```

## 少し解説

### どのようなライフサイクルになるのか

Celery の [Task](https://docs.celeryq.dev/en/stable/reference/celery.app.task.html) クラスのインスタンスは、ワーカーの起動時に1度だけ作られ、リクエストごとにインスタンス化されるわけではありません。つまり、タスクの処理を記述した関数に [Celery.task()](https://docs.celeryq.dev/en/stable/reference/celery.html#celery.Celery.task) デコレータをつけることで、起動時に Task クラスが作られ、インスタンス化され、各リクエスト（ジョブ）は同じインスタンスで実行されます。

状態を保持したいケースでは便利ですが、複数のユーザーのリクエストを同じ Session で扱うのも少し怖いといった都合上、リクエストごとに再作成したほうが好ましいです。after_return() メソッドを実装して、リクエストの終了後に（成功・失敗問わず常に）Session.close() と Session インスタンスの破棄を行います。

@property で db() メソッドを実装することで、継承先の Task クラスから Session を使えるようにします。`bind=True` はその際に `self.db` と書けるように self を束縛するための設定です。

### scoped_session を使うべきか

scoped_session はスレッド・ローカルなスコープでセッションを管理するための Session のレジストリ機能を提供します。

Celery のデフォルト設定では予めフォークされた子プロセスの中でリクエストが同期的に処理されていくので、上のサンプルではローカル・スコープの Session を使っています。

## 参考文献

* [Tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html)
* [how to setup sqlalchemy session in celery tasks with no global variable](https://stackoverflow.com/questions/31999269/how-to-setup-sqlalchemy-session-in-celery-tasks-with-no-global-variable)
* [Session Basics - When do I construct a Session, when do I commit it, and when do I close it?](https://docs.sqlalchemy.org/en/20/orm/session_basics.html#when-do-i-construct-a-session-when-do-i-commit-it-and-when-do-i-close-it)
