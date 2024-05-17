---
title: ".docker/config.jsonのauthの作り方"
date: "2024-05-17"
tags: ["Docker", "Kubernetes"]
---

基本的なところで無駄にハマってしまったので自分への戒め。

`~/.docker/config.json` に入っている Docker の認証情報は以下のような構造をしています（Docker Desktop だと OS の機密情報ストアを使っていたりするので `{}` だったりします）。

```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "c3R...zE2"
    }
  }
}
```

これを手で作って認証が通らないと思ったら echo の使い方が悪いだけだったので記事にしときます。

`auth` フィールドの値は Basic 認証と同じくユーザー名とパスワードをコロン `:` で区切った文字列を base64 エンコードしたものです。

```sh
echo "c3R...zE2" | base64 --decode
```

なので、上のコマンドでデコードすると `janedoe:xxxxxxxxxxx` というような出力を得られます。

`auth` フィールドの値を作るときは上記の逆をやれば OK です。

```sh
echo -n "janedoe:xxxxxxxxxxx" | base64
```

`-n` をつけないと最後に改行が入ってしまうので、`-n` 必須です。ここを見落として時間を溶かしました、トホホ・・・。

## 参考文献

* [Pull an Image from a Private Registry | Kubernetes](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)
