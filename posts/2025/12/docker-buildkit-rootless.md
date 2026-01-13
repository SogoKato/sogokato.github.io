---
title: "Kanikoの代わりにGitLab CIでBuildKitを使う"
date: "2026-01-13"
tags: ["Docker", "CI/CD", "コンテナ", "GitLab", "Kaniko"]
---

以前 [Kaniko](https://github.com/GoogleContainerTools/kaniko) 関連の記事を書いていましたが、気づいたら Kaniko がアーカイブされていたので、同じくルートレスでビルドが可能な [BuildKit](https://github.com/moby/buildkit) に切り替えました。

Kaniko では `RUN --mount` が使えなかったり、レイヤーごとにスナップショットを撮っていてビルドに非常に時間がかかっていたり、ちょいちょい困っていました。特に後者は、最近重めのライブラリを入れたら（CI のタイムアウトとして設定してある）1時間経っても終わらないことが発生し始めたことが今回の調査のきっかけだったので、結果として爆速になり満足です。

以前の記事

* [Kanikoでコンテナイメージつくるならcache=trueは有効にしておこう](/posts/2023/04/kaniko-cache)
* [Kanikoでcache=trueにするなら1コンテナ1ビルドで](/posts/2024/02/kaniko-cache-cleanup)
* [RyeをDockerで使う時のポイント](/posts/2023/11/rye-with-docker)

## 結論

[BuildKitでDockerイメージを作成 | GitLab Docs](https://docs.gitlab.com/ja-jp/ci/docker/using_buildkit/) が非常に参考になります。

```yaml
build-main-app:
  stage: build
  image:
    name: moby/buildkit:rootless
    entrypoint: [""]
  variables:
    BUILDKITD_FLAGS: --oci-worker-no-process-sandbox
    CACHE_IMAGE: ${CI_REGISTRY_IMAGE}:cache
  before_script:
    - mkdir -p ~/.docker
    - echo "{\"auths\":{\"$CI_REGISTRY\":{\"username\":\"$CI_REGISTRY_USER\",\"password\":\"$CI_REGISTRY_PASSWORD\"}}}" > ~/.docker/config.json
  script:
    - >-
      buildctl-daemonless.sh build
        --frontend dockerfile.v0
        --local context=.
        --local dockerfile=./dockerfiles
        --opt filename=foo.dockerfile
        --opt build-arg:BAR=baz
        --export-cache type=registry,ref=$CACHE_IMAGE
        --import-cache type=registry,ref=$CACHE_IMAGE
        --output type=image,\"name=${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA},${CI_REGISTRY_IMAGE}:latest\",push=true
```

設定していることは以下です。

* ルートレスでコンテナをビルドする
* コンテナレジストリにログインする
* ビルドキャッシュを有効にする
* `./dockerfiles/foo.dockerfile` を、カレントディレクトリのコンテキストでビルドする
  * `--local dockerfile` は Dockerfile のファイルパスではなく Dockerfile があるディレクトリのパスなので注意
* ビルド引数 (ARG) として BAR=baz を渡す
* 短縮コミット ID と `latest` をタグ付けしてプッシュする

<details>
<summary>Kaniko での同等の設定例</summary>

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
      --context ${CI_PROJECT_DIR}
      --dockerfile "${CI_PROJECT_DIR}/dockerfiles/foo.dockerfile"
      --build-arg　"BAR=baz"
      --destination "${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}:latest"
```

</details>

## コケたところ

### 権限エラー その1

```
could not connect to unix:///run/user/1000/buildkit/buildkitd.sock after 10 trials
========== log ==========
[rootlesskit:child ] error: failed to share mount point: /: permission denied
[rootlesskit:parent] error: child exited: exit status 1
sh: can't kill pid 38: No such process
```

上記のエラーが出ました。GitLab Docs にトラブルシューティング方法が記載されていました。[^1]

> Kubernetes Runnerで[rootlesskit:child ] error: failed to share mount point: /: permission deniedが表示される場合、AppArmorはBuildKitに必要なマウントsyscallをブロックしています。
> 
> この問題を解決するには、Runner構成に以下を追加します:
>
> ```
> [runners.kubernetes.pod_annotations]
>   "container.apparmor.security.beta.kubernetes.io/build" = "unconfined"
> ```

ご参考までに、Helm で設定するなら `values.yaml` はこんな感じになります。

```yaml
runners:
  config: |
    [[runners]]
      [runners.kubernetes.pod_annotations]
        "container.apparmor.security.beta.kubernetes.io/build" = "unconfined"
```

### 権限エラー その2

```
runc run failed: unable to start container process: error during container init: error mounting "proc" to rootfs at "/proc": mount src=proc, dst=/proc, dstFd=/proc/thread-self/fd/16, flags=MS_NOSUID|MS_NODEV|MS_NOEXEC: operation not permitted
```

上記のエラーも出ました。こちらも GitLab Docs にトラブルシューティングが記載されていました。

> ルートレスモードでの権限関連の問題の場合:
> 
> * `BUILDKITD_FLAGS: --oci-worker-no-process-sandbox` が設定されていることを確認してください。
> * GitLab Runnerに十分なリソースが割り当てられていることを確認します。
> * Dockerfileで特権操作が試行されていないことを確認します。

[^1]: [ルートレスビルドが権限エラーで失敗する](https://docs.gitlab.com/ja-jp/ci/docker/using_buildkit/#rootless-build-fails-with-permission-errors)

## 参考文献

* [GitHub - moby/buildkit: concurrent, cache-efficient, and Dockerfile-agnostic builder toolkit](https://github.com/moby/buildkit)
* [BuildKitでDockerイメージを作成 | GitLab Docs](https://docs.gitlab.com/ja-jp/ci/docker/using_buildkit/#rootless-build-fails-with-permission-errors)
* [Advanced configuration | GitLab Docs](https://docs.gitlab.com/runner/configuration/advanced-configuration/#the-runnerskubernetes-section)
* [Kubernetes executor | GitLab Docs](https://docs.gitlab.com/runner/executors/kubernetes/)
