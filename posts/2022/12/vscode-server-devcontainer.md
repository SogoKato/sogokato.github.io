---
title: "VS Code Serverでリモートホストのコンテナ上開発環境に直接アクセスする"
date: "2022-12-17"
tags: ["VS Code", "開発環境"]
---

今回は「ぼくのかんがえたさいきょうのかいはつかんきょう」を紹介したいと思います。

[VS Code Server](https://code.visualstudio.com/docs/remote/vscode-server) を使い、リモートサーバー上でコンテナとして動かしている開発環境に直接乗り込んでみよう、というアイデアです。

SSH もポート開放も不要なのでとてもお手軽です。

## 環境

サーバー
* Raspberry Pi 400 (Ubuntu 22.04.1, arm64)
  * Docker & Docker Compose がインストールされていること

クライアント
* VS Code 1.74.1
  * [Remote - Tunnels](https://marketplace.visualstudio.com/items?itemName=ms-vscode.remote-server) 拡張機能がインストールされていること

払い出された URL にアクセスすればブラウザからでも使えるので、iPad などのモバイル端末でも使えますね。

## ソースコード

https://github.com/SogoKato/simple-devenv-py

## アーキテクチャ

![architecture](//www.plantuml.com/plantuml/png/dLAnJiCm4Dtz5QSmPu2vieegPb1JmNnoZjJ2EKU-Isc5-k-ene5q849ikPVttZq_UosAISS-64nkxtjKWfiTkJt74BiJLCyDR69B5Q202vvOORNIRqBTqi4xijQOH4wHkq1GRQcFIl3OLF1X06P_Df4LFLFwCfocJBiYbhtGK3eKjkJFGWNu9V1BJ6yoe2DuE2gn-CXPJKUzlOuk9r7gQucl-ew9hFstyTrVZCzcmRo9OtBqKxNaUKcnezHxnW1FAJeI8Sb2BV2IT3ioU-xWVXY2TwZJIN0Op2NdsPXorRKjhPjIVbtRacsEJ4jdM3PR4xUNj_K9)

### なぜコンテナで動かすか？

最近はホスト上に言語やライブラリをインストールするのではなく、コンテナを使って開発環境を整えることの方が多いと思います。

もちろん仮想環境を使うという手段もありますが、可搬性ではコンテナの方が上なので、私は大抵の場合コンテナを使った開発環境を作り、VS Code の dev container を使ってコンテナ内で作業をします。

しかしながら、今回導入する VS Code Server では2022年12月現在まだ dev container をはじめとするリモート開発の拡張機能はサポートされていません。

> Can I use the Remote Development Extensions or a dev container with the VS Code Server?  
> Not at this time.

https://code.visualstudio.com/docs/remote/vscode-server#_can-i-use-the-remote-development-extensions-or-a-dev-container-with-the-vs-code-server

なので、ホスト上に VS Code Server をインストールしたところで実際の開発環境に入り込むことができないので、であれば開発環境のコンテナ上に VS Code Server を入れて直接乗り込もう、というのが今回の趣旨になります。

## セットアップ

```sh
git clone https://github.com/SogoKato/simple-devenv-py.git
```

Dockerfile の抜粋です。イメージのビルド時にスクリプトをダウンロード&実行して VS Code Server をインストールしています。

CMD に `code-server` コマンドを書いて、コンテナ起動時に VS Code Server が実行されるようにします。

`--accept-server-license-terms` と `--random-name` オプションはユーザーインタラクションを不要にするためのもので、順に[ライセンス](https://code.visualstudio.com/license/server)への同意とランダムな命名をしています。  
`--server-data-dir` を使ってデータの永続化のため VS Code Server のデータの保存領域をバインドマウントするディレクトリ配下にしておきます。[^1]

[^1]: ただし、筆者が一度コンテナを再作成してみたところ GitHub の再認証は不要でしたが、インストールした拡張機能などは消えてしまっていました（調査中）。

```dockerfile
RUN wget -O- https://aka.ms/install-vscode-server/setup.sh | sh

CMD ["code-server", "serve", "--accept-server-license-terms", "--random-name", "--server-data-dir", "/workspace/.vscode-server"]
```

イメージをビルドしましょう。

```sh
docker compose build
```

docker-compose.yml です。なんの変哲もありません。

```yml
version: '3'
services:
  app:
    build:
      context: ./
      dockerfile: Dockerfile
    volumes:
      - type: bind
        source: ./
        target: /workspace
```

起動します。

```sh
docker compose up -d
```

ログを見ると GitHub へのログインを求められています。

```sh
docker compose logs -f
```

```
simple-devenv-py-app-1  | To grant access to the server, please log into https://github.com/login/device and use code xxxx-xxxx
```

言われた通り https://github.com/login/device にアクセスして、コードを入力しましょう。

ログインが完了するとトンネルが作成され、ブラウザアクセス用の URL が払い出されることがわかります。

```
simple-devenv-py-app-1  | [2022-12-17 09:06:03] info Creating tunnel with the name: dazzling-antshrike
simple-devenv-py-app-1  | 
simple-devenv-py-app-1  | Open this link in your browser https://insiders.vscode.dev/+ms-vscode.remote-server/dazzling-antshrike/workspace
```

## 接続（ブラウザ）

好きなブラウザで払い出されたリンクを開くだけです。簡単。

## 接続（VS Code）

[Remote - Tunnels](https://marketplace.visualstudio.com/items?itemName=ms-vscode.remote-server) 拡張機能がインストールし、GitHub にログインすると登録されているトンネルの一覧を確認できます。

![Tunnels](/images/posts/2022/12/vsc_remote_tunnels.png)

ボタンをクリックしてリモートに接続します。

## 遊んでみる

あとはいつも通り VS Code の設定を行なっていけば OK です。

![editor](/images/posts/2022/12/vsc_remote_editor.png)

サーバーを起動してみます。

![run](/images/posts/2022/12/vsc_remote_run.png)

ポートが使われていることを検知するとローカル実行時と同じように通知が出てきます。  
「ブラウザーで開く」をクリックするとポートがクラウド経由でポートが転送されて、起動したサーバーにリクエストが届きます。

![port forwarding](/images/posts/2022/12/vsc_port_forwarding.png)

ちなみにこの URL は GitHub 未認証の状態では見ることができない（ログインを求められる）のでセキュリティ的にも安心です。

## 使い心地は？

若干ラグがあるように感じます。

今回検証に使った Raspberry Pi のスペックの問題なのか（MicroSD から SSD にしたら変わるかも？）、ネットワーク環境の問題なのか、原因はまだ切り分けできていません。

また、ちょいちょい接続が切れて `Connecting to hogehoge...` と出てくるのですが、これはおそらくうちのネットワーク環境のせいな気がします。。

## まとめ

今までこれと同様のことを実現する選択肢として [code-server](https://coder.com/docs/code-server/latest) がありましたが、Pylance などオープンソースでは利用できない拡張機能があったりして、ローカルの VSCode と同じ環境を整えることは困難でした。

Microsoft 謹製の VS Code Server がリリースされたことにより、よりローカルの VS Code に近い環境を作ることができるようになりました。  
サーバー側のポートを開ける必要がないのもメリットです。企業のポリシー次第ですが、会社でこれを使えたら嬉しいというユーザーも多いのではないでしょうか。

それでは、ハッピーなエンジニアライフを！

## 参考文献

* [Visual Studio Code Server](https://code.visualstudio.com/docs/remote/vscode-server)
