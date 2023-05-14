---
title: "SQLAlchemyで'MySQL server has gone away'が発生した時の対処法2つ"
date: "2023-01-12"
tags: ["Python", "SQLAlchemy", "MySQL", "データベース"]
---

FastAPI で SQLAlchemy を使っている時に、コンテナを立てた直後は問題ないけど一定時間経過後に DB 接続が切れてしまう問題に遭遇したのでその時に調べたことのメモ。

## 環境

* mysql 5.7.15
* SQLAlchemy 1.4.45
* mysqlclient 2.1.1

## 問題

```
MySQLdb.OperationalError: (2006, 'MySQL server has gone away')
```

最後に MySQL サーバーに接続してから一定時間（デフォルトで8時間）が経過すると上記のエラーにより DB へのアクセスに失敗します。

## 原因

SQLAlchemy には Connection Pooling という、DB サーバーとのコネクションを内部的に保持する機能が存在します。また、MySQL には一定時間（デフォルトで8時間）が経過するとコネクションを破棄する機能が存在します。

その結果、SQLAlchemy 側で保持しているコネクションを使ってクエリを投げたりしても、MySQL 側でコネクションが破棄されている場合には `MySQL server has gone away` のエラーが出てしまうことになります。

`show global variables like 'wait_timeout';` によって、現在設定されている `wait_timeout` の秒数を知ることができます。

```
mysql> show global variables like 'wait_timeout';
+---------------+-------+
| Variable_name | Value |
+---------------+-------+
| wait_timeout  | 28800 |
+---------------+-------+
1 row in set (0.00 sec)
```

生きているコネクションは `show processlist` で知ることができます。`Time` が経過時間（秒）です。

```
mysql> show processlist;
+---------+-------+-----------------+------+---------+-------+----------+------------------+
| Id      | User  | Host            | db   | Command | Time  | State    | Info             |
+---------+-------+-----------------+------+---------+-------+----------+------------------+
| 1200000 | scott | localhost:47000 | test | Query   |     0 | starting | show processlist |
| 1200001 | scott | localhost:47001 | test | Sleep   |  3600 |          | NULL             |
+---------+-------+-----------------+------+---------+-------+----------+------------------+
2 rows in set (0.00 sec)
```

## 解決方法

[SQLAlchemy の公式ドキュメント](https://docs.sqlalchemy.org/en/20/core/pooling.html#dealing-with-disconnects)に書かれているように、大きく「悲観的」「楽観的」2つのアプローチがあります。

どちらを採用するかは要件や好みによると思います。どちらの方法にしても、コネクションプールからチェックアウトした後に MySQL 側で破棄されてしまうようなケースでは無効なのでご注意ください（一度の処理でそんなに長く扱うことは少ないとは思いますが）。

### 悲観的アプローチ

コネクションプールから取り出すときに、そのコネクションがまだ生きているかどうかをテストする方法です。私は今回こちらを採用しました。

コネクションのチェックアウト時に若干のオーバーヘッドができてしまいますが、最もシンプルで信頼できるアプローチとされています。

```py
from sqlalchemy import create_engine

engine = create_engine("mysql+mysqldb://scott:tiger@localhost/test", pool_pre_ping=True)
```

コネクションのチェックアウトと返却は SQL コマンド発行のたびに行われます。トランザクションが失敗したときはロールバックされるまで返却されません。詳しくは下記の関連記事をご覧ください。

関連記事：[SQLAlchemyのセッション・トランザクションを理解する](/posts/2023/05/sqlalchemy-sessions-and-transactions)

### 楽観的アプローチ

一定時間ごとにコネクションを張り直す方法です。例えば、DB サーバー側で28800秒に設定されているのならば、それよりも短く設定すればよいです。

使っていても使っていなくても一定時間おきに DB へのリクエストが飛んでしまいますが、コネクションのチェックアウト時にオーバーヘッドが発生しないのが利点です。

```py
from sqlalchemy import create_engine

engine = create_engine("mysql+mysqldb://scott:tiger@localhost/test", pool_recycle=3600)
```

## 参考文献

* [Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
* [Python: SQLAlchemy で 'MySQL server has gone away' になる問題を解決する](https://blog.amedama.jp/entry/2015/08/15/133322)
* [full-stack-fastapi-postgresql/session.py at master · tiangolo/full-stack-fastapi-postgresql](https://github.com/tiangolo/full-stack-fastapi-postgresql/blob/master/%7B%7Bcookiecutter.project_slug%7D%7D/backend/app/app/db/session.py)
