---
title: "個人的Ubuntu24.04 Desktopセットアップメモ"
date: "2025-06-30"
tags: ["Ubuntu", "キーボード"]
---

メインのデスクトップ PC を Windows から Linux に変えたので、セットアップのメモです。

## 環境

* Ubuntu 24.04 Desktop

## やったこと

### IME

[2023年版 キーボードマッピングの個人的メモ](/posts/2023/01/keyboard-remap)

キーボードはこの時と同じで HHKB US 配列でスペースキーの左右に Mac の `英数` `かな` キーを割り当て。かれこれ2年以上このマッピングなのでかなり指が馴染んでいる。

ところが Ubuntu のデフォルトの IME (ibus-mozc) では `英数` `かな` が効かない。

まずは `xev` で調べてみると、なんか韓国語配列として認識されてそう。それぞれ `Hangul_Hanja` `Hangul` になってる。

`英数` キー

```
KeyPress event, serial 38, synthetic NO, window 0x3600001,
    root 0x1dc, subw 0x0, time 79963200, (-1494,-830), root:(461,344),
    state 0x10, keycode 131 (keysym 0xff34, Hangul_Hanja), same_screen YES,
    XLookupString gives 0 bytes: 
    XmbLookupString gives 0 bytes: 
    XFilterEvent returns: False

KeyRelease event, serial 38, synthetic NO, window 0x3600001,
    root 0x1dc, subw 0x0, time 79963380, (-1494,-830), root:(461,344),
    state 0x10, keycode 131 (keysym 0xff34, Hangul_Hanja), same_screen YES,
    XLookupString gives 0 bytes: 
    XFilterEvent returns: False
```

`かな` キー

```
KeyPress event, serial 38, synthetic NO, window 0x3600001,
    root 0x1dc, subw 0x0, time 79966815, (-1307,-1174), root:(648,0),
    state 0x10, keycode 130 (keysym 0xff31, Hangul), same_screen YES,
    XLookupString gives 0 bytes: 
    XmbLookupString gives 0 bytes: 
    XFilterEvent returns: False

KeyRelease event, serial 38, synthetic NO, window 0x3600001,
    root 0x1dc, subw 0x0, time 79966935, (-1307,-1174), root:(648,0),
    state 0x10, keycode 130 (keysym 0xff31, Hangul), same_screen YES,
    XLookupString gives 0 bytes: 
    XFilterEvent returns: False
```

Ubuntu セットアップ時の Mozc のバージョンでは、`Hangul_Hanja` `Hangul` は認識してくれないので IME オン・オフを切り替えられない。[^1] 設定でキー設定を編集しようとしても、認識してくれないので無理。

「ビルドするかー」と腹を括り、調べていると flatpak とやらでインストールすると最新版が入ることを知る。[^2]

自分みたいな Linux デスクトップ初心者で [flatpak](https://flatpak.org/) 入門したい人向けにはこの記事がおすすめ。

[【Linuxユーザーへ贈る】Flatpakではじめる新しいGUIアプリ体験 #初心者 - Qiita](https://qiita.com/_masa_u/items/07ddbacd3ff90bdc1b52)

flatpak で fcitx5-mozc をインストールして自動起動を設定する方法はこれ。

[大概のLinuxで使えそうな日本語入力(Flatpak版Fcitx5-Mozc)](https://zenn.dev/phoepsilonix/articles/flatpak-mozc)

[^1]: [Pop!_OS 22.04 set up](https://zenn.dev/pandaman64/scraps/9b1047bda87f4d) を参考。Mozc 2.28.4880.102 で修正されたが、2025年6月時点で Ubuntu 用にビルドされた最新の Mozc は 2.28.4880.102 なので、自分でビルドするか、他の方法で最新版を入れる必要がある

[^2]: [UbuntuでMozcの新しいバージョンをビルドするには](https://zenn.dev/phoepsilonix/articles/0c492a22a3c9d0)　の「以下、駄文。」のパートに記述がある

fcitx のグローバル設定にデフォルトで `Hangul_Hanja` `Hangul` で IME オン/オフが割り当てられているけど、その設定を消してみてもちゃんと英数・かな切り替えできたので、mozc として `Hangul_Hanja` `Hangul` キーへの対応が入ってそう。

### Firefox

上記で無事、入力環境はいい感じになったかと思いきや、Firefox で入力ができなくなった。調べたら同じ症状な人がいて、snap 版であることが原因ぽい。[^3]

[flatpak 版 Firefox](https://flathub.org/ja/apps/org.mozilla.firefox) ならいけるかなと思い試したら、直った。

[^3]: [ubuntu desktop 22.04 初期設定 #Ubuntu22.04 - Qiita](https://qiita.com/dimanche/items/ebeefc82c90d03ead81f) を参照

### RDP 接続の設定

設定 > システム > Remote Desktop を開く。

上に2つタブがあるが、「Desktop Sharing」はログイン中の画面にリモートで入れるという機能のため、外出先から PC を使うみたいな用途には使えないので無効にしておけば OK。「リモートログイン」の方を有効にしていい感じに設定する。

macOS 版の [Windows app](https://learn.microsoft.com/ja-jp/windows-app/overview)（元々オレンジ色の Remote Desktop だったアプリ）から接続できるようにするときに二癖あった。

#### 環境

MacBook Air M2

macOS 15.5
Windows app 11.0.9

#### 問題1. 認証まではうまくいくが、黒画面になる

`.rdp` ファイルをエクスポートして、下記のように編集する。

```git
-use redirection server name:i:0
+use redirection server name:i:1
```

設定値の意味は [Ubuntu 24.04 LTSのRDP接続の警告メッセージ - treedown’s Report](https://blog.treedown.net/entry/2024/10/31/010000) が参考になりそう。

#### 問題2. めっちゃ発熱する

上記の問題が直って接続できても、今度はクライアントがめっちゃ発熱し始める。

Windows app の Settings > General > Use hardware acceleration when possible のチェックを外すと収まる。これでほぼほぼ安定しているが、時々暴走していることがあるが原因は不明。使わない時はちゃんと Windows app を終了しておく。

### VS Code Remote Tunnels の設定

前回の記事を参照

[VS Code Remote Tunnelsをシステムサービス化すると便利](/posts/2025/05/code-tunnel-service-ubuntu-desktop)

## 参考文献

* [Pop!_OS 22.04 set up](https://zenn.dev/pandaman64/scraps/9b1047bda87f4d)
* [UbuntuでMozcの新しいバージョンをビルドするには](https://zenn.dev/phoepsilonix/articles/0c492a22a3c9d0)
* [【Linuxユーザーへ贈る】Flatpakではじめる新しいGUIアプリ体験 #初心者 - Qiita](https://qiita.com/_masa_u/items/07ddbacd3ff90bdc1b52)
* [大概のLinuxで使えそうな日本語入力(Flatpak版Fcitx5-Mozc)](https://zenn.dev/phoepsilonix/articles/flatpak-mozc)
* [ubuntu desktop 22.04 初期設定 #Ubuntu22.04 - Qiita](https://qiita.com/dimanche/items/ebeefc82c90d03ead81f)
* [Ubuntu 24.04 LTSのRDP接続の警告メッセージ - treedown’s Report](https://blog.treedown.net/entry/2024/10/31/010000)
