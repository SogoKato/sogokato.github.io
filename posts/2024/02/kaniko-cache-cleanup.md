---
title: "Kanikoでcache=trueにするなら1コンテナ1ビルドで"
date: "2024-02-15"
tags: ["Kaniko", "CI/CD", "コンテナ", "GitLab"]
---

前に [Kanikoでコンテナイメージつくるならcache=trueは有効にしておこう](/posts/2023/04/kaniko-cache) という記事を書きましたが、とりあえず有効にしといたら罠があったので書いておきます。

## Kaniko のコンテナ1つで複数のコンテナをビルドしないほうがいい

おそらく、Kaniko が CI 前提のツールなので、複数回のビルドのために使われることを想定していないのではないでしょうか。

気を付けるべき条件は以下です。

* `--cache-true` を指定している
* コンテナ1つで複数のコンテナをビルドしている

上記の条件が揃うと、イメージビルドの際のキャッシュが残ってしまい、以降のイメージビルドに思わぬ影響を与えることがあります。Kaniko には `--cleanup` というオプションがありますが、それでもダメそうです。

つまり GitLab CI だったら、👇こうではなく

```yaml
build-images:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:debug
    entrypoint: [""]
  before_script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"${CI_REGISTRY}\":{\"auth\":\"$(printf "%s:%s" "${CI_REGISTRY_USER}" "${CI_REGISTRY_PASSWORD}" | base64 | tr -d '\n')\"}}}" > /kaniko/.docker/config.json
  script:
    - >-
      /kaniko/executor
      --cache=true
      --context "${CI_PROJECT_DIR}"
      --destination "${CI_REGISTRY_IMAGE}/image-a:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}/image-a:latest"
    - >-
      /kaniko/executor
      --cache=true
      --context "${CI_PROJECT_DIR}"
      --destination "${CI_REGISTRY_IMAGE}/image-b:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}/image-b:latest"
```

👇こう書きましょう、という話でした。

```yaml
.build-image:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:debug
    entrypoint: [""]
  before_script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"${CI_REGISTRY}\":{\"auth\":\"$(printf "%s:%s" "${CI_REGISTRY_USER}" "${CI_REGISTRY_PASSWORD}" | base64 | tr -d '\n')\"}}}" > /kaniko/.docker/config.json

build-image-a:
  extends:
    - .build-image
  script:
    - >-
      /kaniko/executor
      --cache=true
      --context "${CI_PROJECT_DIR}"
      --destination "${CI_REGISTRY_IMAGE}/image-a:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}/image-a:latest"

build-image-b:
  extends:
    - .build-image
  script:
    - >-
      /kaniko/executor
      --cache=true
      --context "${CI_PROJECT_DIR}"
      --destination "${CI_REGISTRY_IMAGE}/image-b:${CI_COMMIT_SHORT_SHA}"
      --destination "${CI_REGISTRY_IMAGE}/image-b:latest"
```

## 参考文献

* [Multi stage build cache not cleaned when building multiple images · Issue #1829 · GoogleContainerTools/kaniko](https://github.com/GoogleContainerTools/kaniko/issues/1829)
