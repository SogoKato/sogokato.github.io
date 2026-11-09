---
title: "Claude Codeのセッションをリポジトリごとに常駐させるrepomuxを作った"
date: "2026-11-09"
tags: ["Claude Code", "個人開発", "開発環境"]
---

Claude Code をリポジトリごとに tmux で立ち上げて、Remote Control でスマホや claude.ai/code から続けられるようにしていました。ただ、手で運用していると、どのセッションがどのリポジトリか分からなくなりますし、マシンを再起動するたびに全部立ち上げ直すことになります。

そこで、リポジトリごとに名前付きのセッションを1つずつ常駐させて、再起動しても会話を継続できるようにするツールを作りました。

ソースコード: https://github.com/SogoKato/repomux

## つかいかた

動かすのに必要なものは次のとおりです。

* Linux（systemd のユーザーサービス）か macOS（launchd）
* tmux
* claude.ai のサブスクリプションで `claude auth login` 済みの `claude`

Remote Control は API キーや `claude setup-token` のトークンでは動かないので、repomux でも使えません。

インストールは [Releases](https://github.com/SogoKato/repomux/releases) からバイナリを落とすか、`go install` でビルドします。

```sh
go install github.com/SogoKato/repomux@latest
```

`repomux` と打つと、登録したリポジトリの一覧が出ます。初回は、Claude Code の会話が残っているディレクトリをまとめて登録するか聞かれます。今いるディレクトリが未登録なら、一覧の先頭に `+` 付きで候補として出ます。

![repomux のセッション一覧。リポジトリごとの状態、自動起動の設定、モード、最後の会話、パスが並んでいる](https://raw.githubusercontent.com/SogoKato/repomux/main/docs/screenshot.png)

操作はすべてこの画面のキーで済みます。よく使うのはこのあたりです。

| キー    | 動作                                         |
| ------- | -------------------------------------------- |
| `enter` | セッションに入る。停止中なら起動してから入る |
| `s`     | 起動だけして、入らない                       |
| `r`     | 再起動する。最新の会話が再開される           |
| `x`     | 停止する                                     |
| `p`     | セッションの画面をプレビューする             |
| `a`     | 再起動・ログイン時の自動起動を切り替える     |
| `n`     | ディレクトリを追加して入る                   |

セッション名はリポジトリ名になり、claude.ai/code やスマホアプリにもその名前で出ます。

左端のマークは、`*` が動作中、`?` が古い会話を再開するか claude が確認して止まっている状態、`!` がセッションの中に claude がいないかディレクトリが消えた状態です。ログインの期限が近づくと、一覧の上に警告が出ます。

`a` を初めて on にすると、ユーザーサービスが設定されます。セッションを止めるときは `systemctl stop` ではなく `x` を使ってください。全セッションが落ちることがあります。完全に終わらせたいときは、セッションの中で `/exit` と打ちます。

キーの全部や登録リストの形式は [README](https://github.com/SogoKato/repomux/blob/main/README.ja.md) にあります。

## なんでこのツールを作ったか

このツールを作る前に困っていたのは、次の3つです。

* tmux のセッション名が `0` `1` `2` になって、どれがどのリポジトリか分からなくなる
* マシンを再起動するたびに、ディレクトリを回って立ち上げ直すことになる
* しばらくするとログインが切れて、Remote Control が止まっている

これらを解決できる、ちょっとかっちょいい CLI ツールを作りたいと思い、着手しました。

## 仕組み

このような構成になっています。

```text
登録リスト（TSV）
  └─ tmux セッション（リポジトリ名）
       └─ supervisor（落ちたら立ち上げ直す）
            └─ claude --remote-control <リポジトリ名>

systemd のユーザーサービス / launchd
  └─ 起動時に repomux up で、自動起動が on のセッションを戻す
```

* `~/.config/repomux/repos` の TSV ファイルで登録リストを管理しています
* repomux を通じて起動した `claude` コマンドは、supervisor 機能を持ったラッパープロセスが tmux セッションで動きます
* ユーザーサービスは、Linux では systemd、macOS では launchd です。Linux では再起動後に、macOS ではログイン時にセッションが戻ります

ログインの期限は `.credentials.json` から読んで、切れる3日前から一覧の上に警告を出しています。リフレッシュトークンには使っても延びない寿命があり、数週間ごとに必ず再ログインが来ます。ログインはマシン単位なので、どれか1つのセッションで `/login` すれば全セッション復活するはずです。

## おわりに

Claude Code の達人たちはもっと上手なセッション管理をしているのかもと思いますが、個人的にはこれによりとても便利になりました。go install 一発で入るのでもしよければ使ってみてください。

## 参考文献

* [Continue local sessions from any device with Remote Control - Claude Code Docs](https://code.claude.com/docs/en/remote-control)
