---
title: "CloudNativePGとpgvectorでベクトルDBを構築"
date: "2025-11-07"
tags: ["Kubernetes", "データベース", "PostgreSQL"]
---

趣味で動かしているアプリ用にちょっとリッチな文字列検索ができるデータベースが欲しかったけどお金はかけられないので、[いつもの K3s 製 Kubernetes クラスタ](/posts/2023/06/k3s-setup) に [PostgresSQL](https://www.postgresql.org/) をデプロイして、前から気になっていた [pgvector](https://github.com/pgvector/pgvector) を使えるようにしてみました。

## Operator 選定

PostgreSQL の operator をググってみたらいくつかの種類があるようでした。

[Lethediana Tech さんの記事](https://lethediana.sakura.ne.jp/tech/archives/overview-ja/1973/) を参考にさせてもらいましたが、2023年初頭時点の情報だったので2025年11月時点の情報を見てみました。

![star history](/images/posts/2025/11/psql_operator_star_history.png)

後発だが勢いがあるとされていた [cloudnative-pg/cloudnative-pg](https://github.com/cloudnative-pg/cloudnative-pg) が本記事執筆時点でも勢いが衰えておらず、最も人気のある operator と言えそうです。今回はホビー用途なのであまり深く考えず、スター数が一番多い CloudNativePG を採用しました。

## 環境

* Raspberry Pi 4B 8GB
* K3s v1.32.6+k3s1
* Helm v3.18.4
* [cnpg/cloudnative-pg Helm Chart](https://github.com/cloudnative-pg/charts/tree/main/charts/cloudnative-pg) v0.26.1
  * CloudNativePG v1.27.1
* [cnpg/cluster Helm Chart](https://github.com/cloudnative-pg/charts/tree/main/charts/cluster) v0.3.1
* PostgreSQL v16.10
* pgAdmin 4 v9.9

## Helm でインストール

公式の [Helm Chart](https://github.com/cloudnative-pg/charts) を使用します。

```
helm repo add cnpg https://cloudnative-pg.github.io/charts
```

まずは operator を導入します（実際は以下と同等の [Helmfile](https://helmfile.readthedocs.io/en/latest/) を適用）。

```bash
helm upgrade --install cnpg \
  --namespace cnpg-system \
  --create-namespace \
  cnpg/cloudnative-pg
```

次に [cluster](https://cloudnative-pg.io/documentation/1.27/before_you_start/#postgresql-terminologys) をデプロイします。実際のデータベースインスタンスです。

自分は以下の設定にしました。

`values.yaml`

```yaml
cluster:
  # デフォルトではClusterIPで、rw/ro/rの3つのServiceが作成される
  # 上記に加え、任意のServiceを作成可能
  # 以下はLoadBalancerでrwのServiceを追加する例
  services:
    additional:
    - selectorType: rw
      serviceTemplate:
        metadata:
          name: "database-cluster-rw-lb"
        spec:
          type: LoadBalancer
  # BootstrapInitDBは、initdbが使われる時のブートストラップ処理のための設定
  # See: https://cloudnative-pg.io/documentation/current/bootstrap/
  # See: https://cloudnative-pg.io/documentation/current/cloudnative-pg.v1/#postgresql-cnpg-io-v1-BootstrapInitDB
  initdb:
    database: app
    owner: app # 空の場合はdatabaseの値になる（慣習に従い）
    secret:
      name: "" # databaseのownerの初期クレデンシャルを格納しているSecretの名前。空の場合は新しいSecretが作られる
    options: []
    encoding: UTF8
    postInitSQL: []
    postInitApplicationSQL:
      - CREATE EXTENSION IF NOT EXISTS vector; # pgvector拡張可能を有効化
    postInitTemplateSQL: []
# バックアップの設定
# See: https://cloudnative-pg.io/documentation/current/backup/
backups:
  enabled: true
  provider: s3
  s3:
    region: ""
    bucket: ""
    path: "/"
    accessKey: ""
    secretKey: ""
```

[CNPG のデフォルトのコンテナイメージ](https://github.com/cloudnative-pg/postgres-containers) には `minimal` や `standard`, `system` のバリエーションがあり、`standard` には以下の機能が含まれています。

> * PGAudit
> * Postgres Failover Slots
> * pgvector
> * All Locales
> * LLVM JIT support
>   * For PostgreSQL 17 and earlier: included in the main PostgreSQL packages, also available in minimal images
>   * From PostgreSQL 18 onwards: provided by the separate postgresql-MM-jit package

`system` は廃止予定らしく、今後は `minimal` または `standard` の使用が推奨されているらしいです。`system` には（`standard` に加え）バックアップのための Barman Cloud のバイナリが含まれていますが、これは [Barman Cloud CNPG-I plugin](https://github.com/cloudnative-pg/plugin-barman-cloud) として分離される計画のため、移行が完了したら `system` は使えなくなります。

2025年11月時点では `ghcr.io/cloudnative-pg/postgresql:16` のタグで pull されるイメージは `system` のものなので、本記事執筆の時点ではまだ `system` がデフォルトの扱いになっていそうです。 

```bash
helm upgrade --install database \
  --namespace database \
  --create-namespace \
  -f values.yaml \
  cnpg/cluster
```

上記の設定でデプロイされると `database-cluster-app` という名前で Secret が作られるので `app` ユーザのパスワードを確認します。

```bash
kubectl -n database get secret database-cluster-app -ojson | jq -r ".data.password" | base64 -d
```

## 動作確認

pgAdmin 4 で接続して、pgvector の README に書かれている手順で動作確認してみました。よさそう。

```sql
app=> CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
CREATE TABLE
app=> INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
INSERT 0 2
app=> SELECT * FROM items ORDER BY embedding <-> '[3,1,2]' LIMIT 5;
 id | embedding 
----+-----------
  1 | [1,2,3]
  2 | [4,5,6]
(2 rows)
```

## 参考文献

* [CloudNativePG](https://cloudnative-pg.io/documentation/current/)
* [cloudnative-pg/cloudnative-pg: CloudNativePG is a comprehensive platform designed to seamlessly manage PostgreSQL databases within Kubernetes environments, covering the entire operational lifecycle from initial deployment to ongoing maintenance](https://github.com/cloudnative-pg/cloudnative-pg)
* [cloudnative-pg/postgres-containers: Operand images for CloudNativePG containing all community supported version PostgreSQL](https://github.com/cloudnative-pg/postgres-containers)
* [pgvector/pgvector: Open-source vector similarity search for Postgres](https://github.com/pgvector/pgvector)
* [CNPG Recipe 18 - Getting Started with pgvector on Kubernetes Using CloudNativePG · Unleashing the Power of Postgres in Kubernetes](https://www.gabrielebartolini.it/articles/2025/06/cnpg-recipe-18-getting-started-with-pgvector-on-kubernetes-using-cloudnativepg/)
* [KubernetesのPostgreSQL向けOperator比較 - Lethediana Tech](https://lethediana.sakura.ne.jp/tech/archives/overview-ja/1973/)
