---
title: "RyeをDockerで使う時のポイント"
date: "2023-11-18"
tags: ["Python", "Rye", "Docker"]
---

Rye は Rust 製の Python パッケージマネージャです。まだ「実験的」なステータスなので全ての方にお勧めできる段階ではないかもしれないですが、十分に実用的で安定していると思います。Pipenv や Poetry との違いは、パッケージ管理だけでなく、Python バージョンの管理までやってくれるところが特徴で、Pipenv/Poetry + pyenv が1つのツールにまとまっているイメージです。

さて、今回は Rye を Docker コンテナで使う時のポイントをまとめてみました。Rye は2023年11月現在でまだ Docker での使い方についてのドキュメントがまとまっていません。[^1]  
記事の内容は [GitHub のディスカッション](https://github.com/mitsuhiko/rye/discussions/239)の内容をもとに作成しています。

[^1]: https://github.com/mitsuhiko/rye/issues/241

**2024-05-24 更新：URL が `rye-up.com` から `rye.astral.sh` に変わったみたいなので更新しました。**

https://github.com/astral-sh/rye/issues/1111

## できたもの

https://github.com/SogoKato/rye-with-docker

```
├── .dockerignore
├── .gitignore
├── .python-version
├── .venv
├── Dockerfile
├── README.md
├── pyproject.toml
├── requirements-dev.lock
├── requirements.lock
└── src
    └── main.py
```

`Dockerfile`

```dockerfile
ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}-slim-bookworm

RUN apt update && \
    apt install -y curl && \
    apt clean && \
    rm -rf /var/lib/apt/lists/*

ARG USERNAME=ryeuser
RUN useradd ${USERNAME} --create-home
USER ${USERNAME}

WORKDIR /home/${USERNAME}/app

ENV RYE_HOME /home/${USERNAME}/.rye
ENV PATH ${RYE_HOME}/shims:/home/${USERNAME}/app/.venv/bin:${PATH}

RUN curl -sSf https://rye.astral.sh/get | RYE_NO_AUTO_INSTALL=1 RYE_INSTALL_OPTION="--yes" bash

# kaniko 用
# kaniko は RUN --mount をサポートしていない
# https://github.com/GoogleContainerTools/kaniko/issues/1568
# COPY ./pyproject.toml ./requirements*.lock ./.python-version ./README.md ./
# RUN rye sync --no-dev --no-lock

RUN --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=requirements.lock,target=requirements.lock \
    --mount=type=bind,source=requirements-dev.lock,target=requirements-dev.lock \
    --mount=type=bind,source=.python-version,target=.python-version \
    --mount=type=bind,source=README.md,target=README.md \
    rye sync --no-dev --no-lock

COPY . .

ENTRYPOINT ["python3", "./src/main.py"]
```

**2024-10-24 更新：インストールしたバイナリが動かなかったので `RUN . .venv/bin/activate` を消し、PATH に `/home/${USERNAME}/app/.venv/bin` を追加する形で修正しました。**

`.dockerignore`

```
.venv
```

`.python-version`

```
3.12.0
```

```sh
docker build . --build-arg PYTHON_VERSION=$(cat .python-version)
```

## ポイント

### `.python-version` に合わせてベースイメージ（タグ）を指定する

rye では pyenv と同じようにプロジェクトルートに `.python-version` ファイルを書くことでバージョンの指定ができます。Docker の [python イメージ](https://hub.docker.com/_/python) のタグを `.python-version` と合わせるようにしています。なので、Docker のタグに合わせて `.python-version` の中身を書き換えてください。

### `.dockerignore` に `.venv` を指定する

コンテナの外で rye を実行した状況では、仮想環境が作られて `.venv` ディレクトリが存在しています。この状況で docker build を実行して作られたコンテナでは仮想環境の設定が不完全になり、docker run を実行すると以下のようにエラーになります。

```
$ docker run <IMAGE>
Traceback (most recent call last):
  File "/home/ryeuser/app/./src/main.py", line 1, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'
```

`rye run -l` を実行してみると Rye の環境で `python` が使えないために、仮想環境外の `python` が呼ばれているというのが分かります。`.venv/bin` にシンボリックリンクがあるものの、COPY してきたものなのでコンテナ外の `python3` にリンクしているのが原因です。

```
$ docker run --entrypoint=/bin/bash -it <IMAGE>
ryeuser@f52b9fd390a1:~/app$ rye run -l
normalizer
ryeuser@f52b9fd390a1:~/app$ ls -al .venv/bin
total 40
drwxr-xr-x 1 root root 4096 Nov 14 09:14 .
drwxr-xr-x 1 root root 4096 Nov 14 09:14 ..
-rw-r--r-- 1 root root 2149 Nov 14 09:14 activate
-rw-r--r-- 1 root root 1441 Nov 14 09:14 activate.csh
-rw-r--r-- 1 root root 3026 Nov 14 09:14 activate.fish
-rw-r--r-- 1 root root 3345 Nov 14 09:14 activate.nu
-rw-r--r-- 1 root root 1760 Nov 14 09:14 activate.ps1
-rw-r--r-- 1 root root 1212 Nov 14 09:14 activate_this.py
-rwxr-xr-x 1 root root  252 Nov 14 09:14 normalizer
lrwxrwxrwx 1 root root   53 Nov 14 09:14 python -> /home/sogo/.rye/py/cpython@3.12.0/install/bin/python3
lrwxrwxrwx 1 root root    6 Nov 14 09:14 python3 -> python
lrwxrwxrwx 1 root root    6 Nov 14 09:14 python3.12 -> python
```

`.dockerignore` に `.venv` を渡すことで、正しい状態になります。

```
ryeuser@0d49f2f40ada:~/app$ ls -al .venv/bin
total 36
drwxr-xr-x 2 ryeuser ryeuser 4096 Nov 14 09:12 .
drwxr-xr-x 4 ryeuser ryeuser 4096 Nov 14 09:12 ..
-rw-r--r-- 1 ryeuser ryeuser 2148 Nov 14 09:12 activate
-rw-r--r-- 1 ryeuser ryeuser 1440 Nov 14 09:12 activate.csh
-rw-r--r-- 1 ryeuser ryeuser 3025 Nov 14 09:12 activate.fish
-rw-r--r-- 1 ryeuser ryeuser 3344 Nov 14 09:12 activate.nu
-rw-r--r-- 1 ryeuser ryeuser 1760 Nov 14 09:12 activate.ps1
-rw-r--r-- 1 ryeuser ryeuser 1212 Nov 14 09:12 activate_this.py
-rwxr-xr-x 1 ryeuser ryeuser  251 Nov 14 09:12 normalizer
lrwxrwxrwx 1 ryeuser ryeuser   56 Nov 14 09:12 python -> /home/ryeuser/.rye/py/cpython@3.12.0/install/bin/python3
lrwxrwxrwx 1 ryeuser ryeuser    6 Nov 14 09:12 python3 -> python
lrwxrwxrwx 1 ryeuser ryeuser    6 Nov 14 09:12 python3.12 -> python
```

### その他

* pyproject.toml / requirements*.lock / .python-version / README.md のコピーに関して
  * kaniko を使う場合は RUN --mount が使えないので COPY してください
  * pyproject.toml から `readme = "README.md"` の指定を消せば、README.md をマウントまたはコピーする必要はありません
* `. .venv/bin/activate` で仮想環境を有効化しているので `rye run` 不要でコマンドを呼び出せます
  * `. .venv/bin/activate` は `source .venv/bin/activate` と同じ意味です
  * コンテナには source コマンドがないのでこのように書きます

## 参考文献

* [Rye](https://rye.astral.sh/)
* [Rye + Docker #239](https://github.com/mitsuhiko/rye/discussions/239)
* [Rye を Docker で使う](https://zenn.dev/codehex/scraps/7cc3970a8c8048)
