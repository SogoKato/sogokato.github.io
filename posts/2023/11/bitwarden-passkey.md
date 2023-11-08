---
title: "Bitwardenブラウザ拡張がPasskeyに対応したので試してみた"
date: "2023-11-08"
tags: ["Passkey", "Bitwarden", "認証/認可"]
---

パスワードマネージャによる Passkey のサポートが進んでいます。

私は Bitwarden を使ってパスワードなどの機密情報を保存しているのですが、ついに Bitwarden による Passkey 対応が始まりました。[公式ブログ](https://bitwarden.com/ja-JP/blog/bitwarden-launches-passkey-management/)でも11月7日に投稿されています。

## 環境

* [Bitwarden Firefox アドオン](https://addons.mozilla.org/ja/firefox/addon/bitwarden-password-manager/) 2023.10.1
* Firefox 118.0.2

## 試してみる

既にいくつものサービスが Passkey 対応していますが、今回は Google アカウントに Passkey を追加してみようと思います。

1. https://myaccount.google.com/security にアクセスします。
1. 「パスキー」をクリックします。再認証が求められます。
1. 「パスキーを作成する」をクリックします。
1. Bitwarden アドオンのポップアップが出るので、どのアカウントに Passkey を追加するかを選びます。
   ![Bitwarden](/images/posts/2023/11/passkey_01.png)
1. 登録完了 🎉
1. 一度ログアウトして、再ログインしようとすると画像のように「パスキーを使って本人確認を行います」と表示されるので「続行」をクリックすると
![Google](/images/posts/2023/11/passkey_02.png)
1. Bitwarden アドオンが開くのでアカウントを選んで認証するとログインが完了します 🚀
![Bitwarden](/images/posts/2023/11/passkey_03.png)

## 感想

まだサポートが始まったばかりで、パスキーを作成した端末のみでしか利用できないので、パスワードマネージャに保存するメリットはあまりないですが、おそらくすぐにそれもサポートされるでしょう。Bitwarden のようなパスワードマネージャに Passkey が保存できることで、Apple や Google、Microsoft 
に依存しなくてもパスワードのない未来が実現するのでとても期待しています。
