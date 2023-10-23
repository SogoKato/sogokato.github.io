---
title: "GitLabのRemote developmentを試してみる"
date: "2023-10-24"
tags: ["GitLab", "開発環境"]
---

[VS Code Serverでリモートホストのコンテナ上開発環境に直接アクセスする](/posts/2022/12/vscode-server-devcontainer)の記事にて GitHub でやっている「ぼくのかんがえたさいきょうのかいはつかんきょう」第2弾です。今回は GitLab を使ってリモート開発環境を構築してみたいと思います。  
なお、GitLab には Premium 以上のライセンスで使える [Workspaces](https://docs.gitlab.com/ee/user/workspace/index.html) という機能が 16.0 で登場しましたが、今回はそれではなく、自分でコンテナを立ててそこにアクセスする形になります。こちらは無料ライセンスで使えます。ただし執筆時点でまだ alpha 版です。

## チュートリアル通り試してみる

[Tutorial: Connect a remote machine to the Web IDE](https://docs.gitlab.com/ee/user/project/remote_development/connect_machine.html) のページを見れば実行すべきコマンドはすべて載っていますので、適当なドメインさえ持っていればすぐにハンズオンできます。

<details>
<summary>実行するコマンド</summary>

```shell
sudo apt-get update
sudo apt-get install certbot

export EMAIL="YOUR_EMAIL@example.com"
export DOMAIN="example.remote.gitlab.dev"

certbot -d "${DOMAIN}" \
  -m "${EMAIL}" \
  --config-dir ~/.certbot/config \
  --logs-dir ~/.certbot/logs \
  --work-dir ~/.certbot/work \
  --manual \
  --preferred-challenges dns certonly

export CERTS_DIR="/home/ubuntu/.certbot/config/live/${DOMAIN}"
export PROJECTS_DIR="/home/ubuntu"

docker run -d \
  --name my-environment \
  -p 3443:3443 \
  -v "${CERTS_DIR}/fullchain.pem:/gitlab-rd-web-ide/certs/fullchain.pem" \
  -v "${CERTS_DIR}/privkey.pem:/gitlab-rd-web-ide/certs/privkey.pem" \
  -v "${PROJECTS_DIR}:/projects" \
  registry.gitlab.com/gitlab-org/remote-development/gitlab-rd-web-ide-docker:0.2-alpha \
  --log-level warn --domain "${DOMAIN}" --ignore-version-mismatch

docker exec my-environment cat TOKEN
```

</details>

本稿執筆時点でドキュメントに記載されていない点で注意すべきことは、サーバーのファイアウォール設定についてで、3443ポートを開けることは明らかなのですがどの IP アドレスについて許可すべきかは書かれていません。

![architecture](https://gitlab.com/norocchi/gitlab-rd-web-ide-docker/-/raw/bb49b1ad03a31f5b52f0571159a75e29d79a8fef/docs/architecture.png)

上図では GitLab.com の Web IDE からアクセスしているように描かれているので、GitLab.com の IP アドレス（多分公開されていない？）または self-managed の場合は GitLab インスタンスの IP アドレスを許可すれば良いかと思いきや、許可すべきはクライアント端末の IP アドレスでした。  
たしかに VS Code のフロントエンドがブラウザで動いて、そいつが直接アクセスしてくると考えれば納得ですが、ちょっと罠だと思いました。

さて、上記のように設定することで割とあっさり Web IDE から接続できてしまうのですが、コンテナ内のユーザーが root なのが気になります。

## 一般ユーザーで動くようにしてみる

Fork して修正してみました。

https://gitlab.com/norocchi/gitlab-rd-web-ide-docker

以下のコマンドで実行できます。

```shell
docker run -d \
  --name my-environment \
  -p 3443:3443 \
  -v "${CERTS_DIR}/fullchain.pem:/gitlab-rd-web-ide/certs/fullchain.pem" \
  -v "${CERTS_DIR}/privkey.pem:/gitlab-rd-web-ide/certs/privkey.pem" \
  -v "${PROJECTS_DIR}:/projects" \
  registry.gitlab.com/norocchi/gitlab-rd-web-ide-docker:0.2-alpha-nonroot \
  --log-level warn --domain "${DOMAIN}" --ignore-version-mismatch
```

sudo を使いたい場合はパスワードを設定してください。

```shell
docker exec -it my-environment passwd tanuki
```

## 感想

GitLab の Web IDE から任意の環境にログインできるようになり、Web IDE の可能性が広がりますね。前回 GitHub で構築した環境と異なり、ブラウザから直にサーバへアクセスしているのでレスポンスもかなり軽快です。ただしその分、ドメインと証明書を用意する必要があったり、ファイアウォールを開けないといけなかったりと、こちらのほうがハードルは高いです。

また、GitLab の認証周りは別途 Personal Access Token 等で設定しないといけないです。git clone すらされていない環境なので、GitLab の Web IDE である旨みは特にないと思いました。今回試した方法が GitLab の外部に構築される環境であるのに対して、Workspaces 機能の方では GitLab 内部に構築される環境なので、そのあたりは解決されてそうな気がします。そちらもまた試してみたいですね。

## 参考文献

* [Remote development](https://docs.gitlab.com/ee/user/project/remote_development/index.html)
* [Tutorial: Connect a remote machine to the Web IDE](https://docs.gitlab.com/ee/user/project/remote_development/connect_machine.html)
