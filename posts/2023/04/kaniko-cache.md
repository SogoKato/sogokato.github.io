---
title: "Kanikoでコンテナイメージつくるならcache=trueは有効にしておこう"
date: "2023-04-18"
tags: ["Kaniko", "CI/CD", "コンテナ", "GitLab"]
---

![ぜんぜんわからない　俺たちは雰囲気でカニコをやっている](/images/posts/2023/04/kaniko.png)

恥ずかしながら、わたしは雰囲気で kaniko にコンテナイメージのビルドをしてもらっていることに気づきました。1年以上 GitLab CI で kaniko を使っておきながら、ただ「特権コンテナを使わずにイメージつくれるやつ」くらいの認識しかしていなかったです。

## kaniko の cache=true オプション

kaniko には `--cache` というフラグがあり、これを true にすることでコンテナのビルド時にキャッシュ保存するようになり、次回以降のビルドではそのキャッシュを使用するようになるため、コンテナイメージのビルド時間を短縮できます。

キャッシュは、コンテナレジストリ上に `destinationのイメージリポジトリ名/cache` というイメージリポジトリ名で格納されます。例えば `gcr.io/kaniko-project/test` というイメージのビルドキャッシュは `gcr.io/kaniko-project/test/cache` に格納されます。そのため、ビルドに使う CI プラットフォームが、Google Cloud Build であっても GitLab CI であっても特殊な設定なしに使えるので便利です。

毎回 docker の実行環境がリセットされる CI 環境では、ローカルと異なり cache が残らないのでコンテナイメージのビルドに多くの時間がかかります。`--cache-from イメージリポジトリ名` を指定することでキャッシュを利用することもできますが、 multi-stage build の場合には最終的なイメージにキャッシュとして使う情報が残っていないので、中間のイメージを push してそれぞれ `--cache-from` に指定しなくてはいけません（やったことないけど大変そう）。

それに対して kaniko では、（イメージ単位ではなく）**レイヤー単位でキャッシュが保存（push）されるので、multi-stage build であってもなくても関係なく cache の恩恵を受けられます**（すてき）。

## ほかのオプション

### cache-dir

kaniko が走る pod に永続ボリュームがマウントされている場合、ベースイメージをキャッシュさせることができます。`gcr.io/kaniko-project/warmer` と組み合わせて使うようです。

https://github.com/GoogleContainerTools/kaniko#caching-base-images

### cache-repo

上でキャッシュが `destinationのイメージリポジトリ名/cache` に保存されると説明しましたが、任意のリポジトリに保存させることもできます。

これを指定しない場合は `--destination` から推測されます（上述の通り `gcr.io/kaniko-project/test` の場合は `gcr.io/kaniko-project/test/cache`）。

### cache-copy-layers と cache-run-layers

`--cache-copy-layers` と `--cache-run-layers` という論理値型のフラグもあります。これらはそれぞれ以下の意味です。

* `--cache-copy-layers`: Dockerfile の COPY レイヤーをキャッシュするか（既定値: false）
* `--cache-run-layers`: Dockerfile の RUN レイヤーをキャッシュするか（既定値: true）

`--cache-copy-layers` がデフォルト無効になったのは以下リンク先の issue の経緯があるようです。  
https://github.com/GoogleContainerTools/kaniko/pull/1408

### cache-ttl

キャッシュが何時間有効であるかを指定できます。単位は時間（hours）です。指定しない場合の既定値は2週間です。

## つかってみよう

kaniko のキャッシュの仕組みが分かってきたところで、さっそく試してみましょう。

今回は GitLab CI と GitLab Container Registry を使います。ビルドするイメージは node.js のアプリで、3段階の multi-stage build が行われています（ご参考: [next.js/Dockerfile at canary · vercel/next.js](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)）。

`.gitlab-ci.yml`

```yaml
build-image:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:debug
    entrypoint: [""]
  script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"${CI_REGISTRY}\":{\"auth\":\"$(printf "%s:%s" "${CI_REGISTRY_USER}" "${CI_REGISTRY_PASSWORD}" | base64 | tr -d '\n')\"}}}" > /kaniko/.docker/config.json
    - >-
      /kaniko/executor
      --cache=true
      --context "${CI_PROJECT_DIR}"
      --destination "${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}:latest"
```

### 1回目

`--cache-true` を指定した直後のビルドです。当然、過去にキャッシュがつくられていないのですべてのレイヤーで処理が実行されます（ログに `No cached layer found for cmd RUN ...` と見える）。

結果は14分14秒でした。

コンテナレジストリを覗くと成果物のコンテナイメージのほかに `destinationのイメージリポジトリ/cache` のイメージリポジトリがあり、それぞれのタグにレイヤーのキャッシュが push されていました。

### 2回目

アプリのコードを一部修正して、2回目の実行です。アプリの build と関係ない部分（依存ライブラリのインストールなど）はキャッシュが使われるはず。

ログを見ると `Using caching version of cmd: RUN ...` というのが確認できました。

結果は9分50秒でした。そのあとも何回か試したけど毎回同じくらいの時間でした。4分半程度、ビルドが速くなりました。

## キャッシュの保持期間

とても簡単に使える kaniko のキャッシュですが、デメリットがあるとすればコンテナレジストリの容量を食ってしまうことでしょうか。

コンテナレジストリのベンダーによるところではあると思いますが、筆者が使っている GitLab Container Registry の場合は [cleanup policy](https://docs.gitlab.com/ee/user/packages/container_registry/reduce_container_registry_storage.html#create-a-cleanup-policy) という機能があるので、タグが「任意の64文字に一致する正規表現」に一致する場合は消すというポリシーを設定すれば対応できます。

|項目|値|備考|
|---|---|---|
|`Remove tags older than`|なし/7日/14日/30日/60日/90日||
|`Remove tags matching`|設定例）`.{64}`|`^` や `$` は書かなくて大丈夫[^1]|

[^1]: GitLab 社のドキュメントに記載があります  
https://docs.gitlab.com/ee/user/packages/container_registry/reduce_container_registry_storage.html#regex-pattern-examples

## おわりに

なんでこんな便利なオプションを今まで知らなかったのと悔やまれます。たくさん活用していきたいと思います。

## 参考文献

* [kaniko](https://github.com/GoogleContainerTools/kaniko)
* [Kaniko キャッシュの使用](https://cloud.google.com/build/docs/optimize-builds/kaniko-cache?hl=ja)
* [kaniko が何をしているか, 何ができるか](https://orisano.hatenablog.com/entry/2019/05/20/120032)
* [CIにおけるMulti-stage Buildsのcache](https://orisano.hatenablog.com/entry/2018/12/25/224011)
