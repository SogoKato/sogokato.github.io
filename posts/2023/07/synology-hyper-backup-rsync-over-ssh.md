---
title: "SynologyのHyper Backupを使って自分のサーバーへバックアップ（rsync over SSH）"
date: "2023-07-22"
tags: ["Synology", "NAS", "rsync"]
---

先日 Synology の NAS を導入したのですが、耐障害性を考慮すると別の拠点とのバックアップが欲しくなってきます。Synology の NAS は QuickConnect を利用することで Synology 社のサーバーを経由することで、自宅のポートを開放せずに構築することができるのがメリットです。バックアップ用途のためだけでにポートを開放するのはアレなので、自宅からのアウトバウンドの通信で定期的にバックアップを行う方法を検討しました。

## 構成

超シンプル構成です。

![構成図](//www.plantuml.com/plantuml/png/SoWkIImgAStDuKhEoIzDKNZSjFLnyvx7pHE095TnINvHOdggWfzZC1SGA-YM5kZQeIYnKYWghinBvd98pKi16W80)

NAS から定期的にクラウド上のリモートサーバーに rsync でアップロードするだけです。SSH プロトコル上で通信するようにすれば、インターネットを介しても盗聴されるリスクは低いです。

Hyper Backup を使用してバックアップを取ると、独自の形式で保存されるため他のアプリケーションから中身を見ることは難しいです。バックアップ先でも普通のファイルシステムのように参照したい場合は別の方法をおすすめします。

## リモートサーバーの設定

SSH でログインするユーザーのホームディレクトリに `rsyncd.conf` として配置するだけです。下記はその例です。

```conf
use chroot = no
read only = no
hosts deny = *
dont compress = *.pdf *.jpg *.jpeg *.gif *.png *.mp3 *.mp4 *.ogg *.avi *.7z *.z *.gz *.tgz *.zip *.lzh *.bz2 *.rar *.xz

[backup]
path = /backup
hosts allow = <Your IP Address>
```

## Hyper Backup の設定

1. まずはパッケージセンターで Hyper Backup をインストールします。
1. バックアップタイプはフォルダとパッケージにします（LUN でもいいです）。
   ![screenshot](/images/posts/2023/07/syno_rsync_01.png)
1. バックアップ先は rsync を選択します。
   ![screenshot](/images/posts/2023/07/syno_rsync_02.png)
1. サーバータイプは rsync 互換サーバーにします。暗号化転送をオンにして、SSH 認証情報を設定します（公開鍵認証は使えなさそうなので注意）。バックアップモジュールは SSH 接続がうまくいっていれば候補がプルダウンで出てきます。
   ![screenshot](/images/posts/2023/07/syno_rsync_03.png)
1. バックアップ対象の共有フォルダを選択します。
   ![screenshot](/images/posts/2023/07/syno_rsync_04.png)
   ![screenshot](/images/posts/2023/07/syno_rsync_05.png)
1. 他のアプリケーションのデータをバックアップしたい場合は選択します。
   ![screenshot](/images/posts/2023/07/syno_rsync_06.png)
1. バックアップスケジュールの設定やクライアントサイド暗号化の有効化を行います。クライアントサイド暗号化の設定は後から変更できないのでここで設定しましょう。
   ![screenshot](/images/posts/2023/07/syno_rsync_07.png)
   ![screenshot](/images/posts/2023/07/syno_rsync_08.png)
1. お好みのバックアップローテーションを設定します。
   ![screenshot](/images/posts/2023/07/syno_rsync_09.png)
1. 確認します。初回のバックアップを今すぐ行うかどうかを切れます。
   ![screenshot](/images/posts/2023/07/syno_rsync_10.png)
   ![screenshot](/images/posts/2023/07/syno_rsync_11.png)
1. 初回バックアップは時間がかかります。私の環境の場合、250GB 弱で2時間程度でした。
   ![screenshot](/images/posts/2023/07/syno_rsync_12.png)
   ![screenshot](/images/posts/2023/07/syno_rsync_13.png)

## 終わりに

素直に S3 に保存したほうが安いかもしれないね。
