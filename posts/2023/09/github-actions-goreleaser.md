---
title: "GitHub ActionsでGo製ツールをビルド&リリース【GoReleaser】"
date: "2023-09-26"
tags: ["Go", "GitHub", "CI/CD"]
---

前回の記事で紹介した [nifdiff](/posts/2023/09/nifdiff) をリリースする際に、簡単に GitHub actions を使って Go 製ツールをビルドしてリリースする方法を見つけたのでメモです。

## ポイント

* [GoReleaser](https://goreleaser.com/) を使うと Go で作ったソフトウェアを素早く出荷できる
* [kyoh86/git-vertag-action](https://github.com/kyoh86/git-vertag-action) を使うと最新のバージョンから +1 メジャー・マイナー・パッチバージョンアップしたバージョンのタグを作成できる

## 今回やったこと

* Go 製ツールをクロスコンパイルして、バイナリを GitHub でリリース & タグ付け
* GitHub コンテナレジストリ（ghcr.io）に Docker イメージを格納

## 試してみる

2023年9月現在では、下記のファイルがあれば動きます。

```
├── .github
│   └── workflows
│       └── go.yml
├─ .goreleaser.yaml
├─ Dockerfile
└─ main.go
```

`.github/workflows/go.yml`

[【2021年版】GitHub × Go製ツールのリリースフロー](https://zenn.dev/kyoh86/articles/5e7fe8c16a39aa3d3796)の記事内の物をベースに、内容を最新化しています。  
`contents: write` はリリースを作成するために必要な権限、`packages: write` はコンテナレジストリに push するために必要な権限です（GITHUB_TOKEN にこれらの権限が与えられます）。他プロジェクトに対して push したりしたい場合は Personal Access Token が必要ですのでご注意ください。  
https://github.com/SogoKato/nifdiff/blob/94a4e19d5370ec09bafd46ee49dd4e540bd41612/.github/workflows/go.yml

```yml
name: Release CLI to the GitHub Release
on:
  workflow_dispatch:
    inputs:
      method:
        description: |
          Which number to increment in the semantic versioning.
          Set 'major', 'minor' or 'patch'.
        required: true

permissions:
  contents: write
  packages: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Check Actor
        if: github.actor != 'SogoKato'
        run: exit 1
      - name: Check Branch
        if: github.ref != 'refs/heads/main'
        run: exit 1
      - name: Checkout Sources
        uses: actions/checkout@v2
      - name: Bump-up Semantic Version
        id: vertag
        uses: kyoh86/git-vertag-action@v1.1
        with:
          # method: "major", "minor" or "patch" to update tag with semver
          method: "${{ github.event.inputs.method }}"
      - name: Docker Login
        uses: docker/login-action@v1
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Setup Go
        uses: actions/setup-go@v2
        with:
          go-version: '1.20'
      - name: Run GoReleaser
        uses: goreleaser/goreleaser-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: release --clean
```

`.goreleaser.yaml`

https://github.com/caarlos0-graveyard/goreleaser-docker-manifest-actions-example/blob/main/.goreleaser.yml をベースにしています。今回は AMD64 のみのビルドにしていますが、リンク先では ARM64 もビルドしています。  
`CGO_ENABLED=0` は[このあたりの事情から](https://stackoverflow.com/questions/72726192/golang-distroless-docker-exec-failed-no-such-file-or-directory-when-cgo-is-enab)必要でした。  
https://github.com/SogoKato/nifdiff/blob/94a4e19d5370ec09bafd46ee49dd4e540bd41612/.goreleaser.yaml

```yaml
project_name: nifdiff
builds:
- env: [CGO_ENABLED=0]
  goos:
  - linux
  - windows
  - darwin
  goarch:
  - amd64
dockers:
- image_templates: ["ghcr.io/sogokato/{{ .ProjectName }}:{{ .Version }}-amd64"]
  dockerfile: Dockerfile
  use: buildx
  build_flag_templates:
  - --platform=linux/amd64
  - --label=org.opencontainers.image.title={{ .ProjectName }}
  - --label=org.opencontainers.image.description={{ .ProjectName }}
  - --label=org.opencontainers.image.url=https://github.com/SogoKato/{{ .ProjectName }}
  - --label=org.opencontainers.image.source=https://github.com/SogoKato/{{ .ProjectName }}
  - --label=org.opencontainers.image.version={{ .Version }}
  - --label=org.opencontainers.image.created={{ time "2006-01-02T15:04:05Z07:00" }}
  - --label=org.opencontainers.image.revision={{ .FullCommit }}
  - --label=org.opencontainers.image.licenses=MIT
docker_manifests:
- name_template: ghcr.io/sogokato/{{ .ProjectName }}:{{ .Version }}
  image_templates:
  - ghcr.io/sogokato/{{ .ProjectName }}:{{ .Version }}-amd64
- name_template: ghcr.io/sogokato/{{ .ProjectName }}:latest
  image_templates:
  - ghcr.io/sogokato/{{ .ProjectName }}:{{ .Version }}-amd64
```

`Dockerfile`

ビルドしたバイナリを突っ込んでいるだけです。  
https://github.com/SogoKato/nifdiff/blob/94a4e19d5370ec09bafd46ee49dd4e540bd41612/Dockerfile

```dockerfile
FROM gcr.io/distroless/static-debian11
COPY nifdiff /
ENTRYPOINT [ "/nifdiff" ]
```

ワークフローを実行するには Actions > "Release CLI to the GitHub Release" > "Run workflow" をクリックします。`major` `minor` `patch` のいずれかを入力するとセマンティック・バージョニングに従い、最後のタグから +1 したバージョンでリリースできます。初めてのリリースの場合（まだタグがない場合）は `0.0.0` になっていますので、`0.1.0` にしたいなら `minor` と、`1.0.0` にしたいなら `major` と打てば良いです。

![actions](/images/posts/2023/09/github_actions.png)

成功するとこんな感じでリリースされます。🎉

![release](/images/posts/2023/09/github_release.png)

便利なツールを開発してくれているメンテナの皆様に感謝です。

## 参考文献

* [GoReleaser](https://goreleaser.com/)
* [GitHub Actions - GoReleaser](https://goreleaser.com/ci/actions/)
* [【2021年版】GitHub × Go製ツールのリリースフロー](https://zenn.dev/kyoh86/articles/5e7fe8c16a39aa3d3796)
* [caarlos0-graveyard/goreleaser-docker-manifest-actions-example](https://github.com/caarlos0-graveyard/goreleaser-docker-manifest-actions-example)
* [kyoh86/git-vertag-action](https://github.com/kyoh86/git-vertag-action)
* [Golang distroless Docker exec failed: No such file or directory when CGO is enabled](https://stackoverflow.com/questions/72726192/golang-distroless-docker-exec-failed-no-such-file-or-directory-when-cgo-is-enab)
