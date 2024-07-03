---
title: "aptのsnapshotを試す【24.04/22.04】"
date: "2024-07-03"
tags: ["Ubuntu", "APT"]
---

指定した時点でのリポジトリの情報を返してくれる snapshot.ubuntu.com というものがあることを知ったので試してみました。

## なにが嬉しいの？

apt でパッケージをインストールしたり更新したりする際、例えば検証環境と本番環境とで期間が空いてしまうとその間に新しいバージョンがリリースされて違うバージョンが入ってしまうことがあります。同じように作成したサーバーなのに入っているパッケージのバージョンが作成時点によって違うというのは嬉しくないため、検証時点でリリースされているバージョンに固定できると管理が楽になりそうです。

## どういう仕組み？

`apt update` 時に `snapshot.ubuntu.com` が指定した時点でのリポジトリの情報を返してくれます。

クライアント側にスナップショットが蓄積されてディスクを逼迫するようなことはなさそうです。

## どうやって使う？

Ubuntu 24.04 以降ではリポジトリでスナップショットがサポートされているかどうかを自動で判別するので設定不要で使えます。

Ubuntu 23.10 以前では `/etc/apt/sources.list` を編集して `[snapshot=yes]` を追記する必要があります。

```
deb [snapshot=yes] http://archive.ubuntu.com/ubuntu/ jammy main restricted
deb [snapshot=yes] http://archive.ubuntu.com/ubuntu/ jammy-updates main restricted
deb [snapshot=yes] http://security.ubuntu.com/ubuntu jammy-security main restricted
```

また、Ubuntu 20.04 では apt 2.0.10 以上、22.04 では apt 2.4.11 以上が必要なので、古い場合は `apt update && apt install apt` しておきましょう。また、例によく出てくる `apt install` の `--update` フラグは Ubuntu 22.04 では使えなかった（24.04 では使えた）のでご注意ください。

---

スナップショットを取得するには `apt update` などに `--snapshot [Snapshot ID]` (`-S [Snapshot ID]`) オプションをつけて実行します。

Snapshot ID は UTC で `YYYYMMDDTHHMMSSZ` 形式で指定します。

例えば2024年7月3日12:00の場合は次のようになります。

```
apt update --snapshot 20240703T120000Z
```

以下の出力結果（抜粋）を見ると snapshot.ubuntu.com から取得されていることがわかります。

```
Get:3 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble InRelease [256 kB]
...
Get:8 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-updates InRelease [126 kB]
Get:9 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-backports InRelease [126 kB]
Get:10 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-security InRelease [126 kB]
```

上記ではコマンドラインから Snapshot ID を指定しましたが、設定ファイルに書いておくこともできます。設定ファイルの値はコマンドラインに渡された引数よりも優先して使用されるため、共用サーバーなどで間違って誰かが意図しない状態にしてしまうことを防ぐことができそうです。

Ubuntu 24.04 以降では以下の例のように `/etc/apt/sources.list.d/ubuntu.sources` を編集して 

```
Types: deb
URIs: http://archive.ubuntu.com/ubuntu
Suites: noble noble-updates
Components: main universe
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
Snapshot: 20240703T120000Z

## Ubuntu security updates. Aside from URIs and Suites,
## this should mirror your choices in the previous section.
Types: deb
URIs: http://security.ubuntu.com/ubuntu
Suites: noble-security
Components: main universe
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
Snapshot: 20240703T120000Z
```

この状態で `apt update` (`--snapshot` オプションなし) を実行してもちゃんとスナップショットが取得されます。`apt update --snapshot 20240401T120000Z` のようにオプションを渡したとしても同じ結果です。

```
Hit:5 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble InRelease
Hit:6 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-updates InRelease
Hit:7 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-backports InRelease
Hit:8 https://snapshot.ubuntu.com/ubuntu/20240703T120000Z noble-security InRelease
```

Ubuntu 23.10 以前では先ほど `[snapshot=yes]` を追記した箇所の `yes` の代わりに Snapshot ID を入れます。

```
deb [snapshot=20240703T120000Z] http://archive.ubuntu.com/ubuntu/ jammy main restricted
deb [snapshot=20240703T120000Z] http://archive.ubuntu.com/ubuntu/ jammy-updates main restricted
deb [snapshot=20240703T120000Z] http://security.ubuntu.com/ubuntu jammy-security main restricted
```

いろいろな場面で便利に使えそうなのでぜひ使ってみてください。

## 参考文献

* [Ubuntu Snapshot Service](https://snapshot.ubuntu.com/)
* [第812回　aptの新機能あれこれ ［Ubuntu 24.04 LTS版］](https://gihyo.jp/admin/serial/01/ubuntu-recipe/0812)
