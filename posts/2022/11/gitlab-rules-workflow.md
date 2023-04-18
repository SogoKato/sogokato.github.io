---
title: "GitLab CIのrulesとworkflowを理解する"
date: "2022-11-17"
tags: ["GitLab", "CI/CD"]
---

GitLab CI の rules を使って Dockerfile などの特定のファイルの変更時のみ Docker イメージを作成するパイプラインを回して、それ以外の時には既存の Docker イメージを使用して CI を実行する、という組み方をしたかったのですが、書き方に結構手間取ったのでメモ。

環境: GitLab.com 15.6.0-pre

## rules とは

https://docs.gitlab.com/ee/ci/yaml/#rules

それぞれのジョブについて、パイプラインに追加するかしないかの条件を記述するものです。

rules では下記の条件が指定できます。

* `if`
* `changes`
* `exists`
* `allow_failure`
* `variables`
* `when`

それぞれの条件の詳細については公式ドキュメントを参照してください。

rules は [only/except](https://docs.gitlab.com/ee/ci/yaml/#only--except) を置き換えるものなので、rules と only/except を同じジョブで同時に指定することはできません。

rules の指定の一例を公式ドキュメントから引用します。

```yaml
docker build:
  script: docker build -t my-image:$CI_COMMIT_REF_SLUG .
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - Dockerfile
      when: manual
      allow_failure: true
```

上記の例では

* パイプラインがマージリクエストのパイプラインの時に `Dockerfile` が変更されているか確認する
* `Dockerfile` が変更されている時に、ジョブをパイプラインにマニュアルジョブとして追加する
  * `allow_failure: true` によって、ジョブがトリガーされなかったとしても後続のジョブが実行される
* `Dockerfile` が変更されていない時は、ジョブをパイプラインに追加しない
  * `when: never` と同じ

という挙動になります。

rules はリストなので複数のルールを書くことができますが、 **短絡評価である** 点に注意が必要です。rules はパイプラインが作成されたタイミングで評価され、最初にマッチするまで評価が行われます。そのため、例えば `- when: manual` を最初に記述するとそこで評価が終わり（`manual` は常に真となりパイプラインに追加されます）、その後の条件については評価されません。言われてみたらそれはそうなのですが、筆者はそこでしばらく詰まってました。

## workflow とは

https://docs.gitlab.com/ee/ci/yaml/workflow.html

パイプラインそのものを実行するかどうかを決定するものです。workflow で条件にマッチしなかった場合、そのパイプライン内のジョブが実行されることはありません。

よくある使い方としては `$CI_PIPELINE_SOURCE` の種類（`merge_request_event`, `push`, `schedule`, etc.）に応じてパイプラインを実行するかしないかを決めると言った使い方があります。

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: never
    - if: $CI_PIPELINE_SOURCE == "push"
      when: never
    - when: always
```

上記の例ではスケジュール実行時または push 時（ブランチとタグ）には `when: never` が指定されているためパイプラインは走りません。それ以外の時にはパイプラインが実行されます。

## 重複したパイプラインを避ける

https://docs.gitlab.com/ee/ci/jobs/job_control.html#avoid-duplicate-pipelines

ジョブに rules を使用していると、マージリクエスト作成後にブランチに対して push するといった1つのアクションが、push 時に発生したパイプラインとマージリクエストのパイプラインの2つが走らせることが起こりえます。

重複したパイプライン（duplicate pipelines）を避けるためには

* workflow を使ってどの種類のパイプラインは走って良いのかを指定する
* ジョブが実行される条件をかなり限定的にして、最後のルールとして `when`（`when: never` 以外）を使うのを避ける

ことが対策になります。

筆者の場合は、次項で示す例を書いている際に重複したパイプラインが発生し、片方のジョブは正しく機能しないという状況が起こりましたが、workflow を指定することで重複が解消され、正しく機能するようになりました。

## 特定ファイルの変更時のみジョブを実行し、それ以外はスキップして後続のジョブを実行する

`.gitlab-ci.yml` と同階層に `Dockerfile` がある想定です。

```yaml
stages:
  - build
  - test

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH

build:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.9.0-debug
    entrypoint: [""]
  script:
    - /kaniko/executor
      --context "${CI_PROJECT_DIR}"
      --dockerfile "${CI_PROJECT_DIR}/Dockerfile"
      --destination "${CI_REGISTRY_IMAGE}:latest"
  rules:
    - if: $CI_PIPELINE_SOURCE =~ /merge_request_event|push/
      changes:
        - Dockerfile
    - when: manual
      allow_failure: true

test:
  stage: test
  image: "${CI_REGISTRY_IMAGE}:latest"
  script:
    - echo "DO SOME TESTS"
```

上記の例は以下の挙動をします。

* workflow
  * マージリクエストでのパイプラインの場合は実行される
  * マージリクエストがある時、ブランチへの push イベントでのパイプラインは実行されない
  * それ以外のブランチへの push イベントでは実行される
* rules
  * パイプラインがマージリクエストのパイプラインの時または push された時に `Dockerfile` が変更されているか確認する
    * changes は上記以外では常に真となってしまうため
  * `Dockerfile` が変更されている時に、ジョブをパイプラインにジョブを追加する
  * 上記の条件に当てはまらない時はマニュアルジョブとしてパイプラインに追加する
    * `allow_failure: true` となっているので、後続のジョブはそのまま実行される

このように書くことで、実現したかった「特定ファイルの変更時のみジョブを実行し、それ以外はスキップして後続のジョブを実行する」が実現します。
