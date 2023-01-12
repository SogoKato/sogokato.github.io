---
title: "2023年版 キーボードマッピングの個人的メモ"
date: "2023-01-08"
tags: ["キーボード"]
---

不定期的に「あーでもない、こーでもない」と言ってキーボードのマッピングをいじりだしてしまうことってありますよね。私はあります。限りあるキーの中から自分にとっての最適解を見つける作業はなんだかんだ楽しいです。

今回は 2023 年版、私のキーボードのマッピングを書きとめておこうと思います。

過去の記事: [Windows10 と PowerToys で US キーボードでも無変換・変換キーを使って IME を一発で切り替える](https://qiita.com/SogoK/items/7e0ea37c3e958c39608c)

## 環境

* 使うパソコン
  * Windows デスクトップ
  * Windows ラップトップ
  * MacBook Air (2022)
* 使うキーボード
  * HHKB（US 配列）
  * MacBook Air 内蔵キーボード（US 配列）

仕事は Windows ラップトップ + HHKB なので、この組み合わせで作業する時間が一番長いです。MacBook Air で作業する時は基本的には内蔵キーボードを使いますが、HHKB を接続することもしばしばあります。

## 結論

結局仕事でパソコンを触る時間の方が長いので、Windows + HHKB の組み合わせで使う状況を優先しました。

- HHKB なので、`Control` は `Caps Lock` の位置
- スペースキーの左右はそれぞれ Mac の `英数` `かな` キーにする
  - Windows でも Mac の `英数` `かな` キーをちゃんと認識して IME の切り替えをやってくれる
  - なので過去記事で紹介した PowerToys を使用したハックは不要
- 上記によってスペースキー左右の `Windows/Command` キーが消えてしまうので、`左 Alt/Option` を `Windows/Command` にする
- Mac では Karabiner Elements を使用して Windows での操作感に寄せていく
  - Mac の `Command` と Windows の `Control` が同じ位置に来るようにする

## 実現方法

使うツールは以下の 2 つです。

- [Happy Hacking Keyboard キーマップ変更ツール](https://happyhackingkb.com/jp/download/)
- [Karabiner Elements](https://karabiner-elements.pqrs.org/)

### Happy Hacking Keyboard キーマップ変更ツール

![HHKB](/images/posts/2023/01/keyboard_hhkb_remap.png)

変更点としては

- `左♢` を `英数` に
- `右♢` を `かな` に
- `左 Alt/Option` を `Control` に

これによって Windows でも Mac でもスペースキーの左を押せば英字入力、スペースキーの右を押せばかな入力にモードを切り替えられます。今となってはこれ以外の IME 切り替え方法は面倒すぎて耐えられません。

そして、この変更によって `♢` が消滅したので `Windows/Command` キーが使えなくなってしまいます。そのため `左 Alt/Option` を `♢` に変更します。`Alt/Option` は左右にあるのでどちらを変更してもいいのですが、個人的には `Windows + Shift + S`（スクリーンショット）や、（Mac では `Command` と `Control` を入れ替えるため）`Control + C` の組み合わせなどが左手だけで押せた方が便利なので、左側を `♢` にしました。  
本当は左側の `Alt/Option` もあるのが理想なのですが、`Alt/Option` を使うのは VS Code で複数行選択するときがほとんどなので、マウスとの組み合わせですしまだなんとかなると判断しました。

Windows でも Mac でも DIP スイッチは変更せずに、常に同じモードで使います。DIP スイッチについては[公式ページ](https://happyhackingkb.com/jp/products/discontinued/hhkb_backview.html)を参照ください。

| キー | ON/OFF |
| ---- | ------ |
| SW1  | OFF    |
| SW2  | OFF    |
| SW3  | ON     |
| SW4  | OFF    |
| SW5  | OFF    |

参考: HHKB のデフォルトのキー配列

![HHKB のデフォルトのキー配列](https://happyhackingkb.com/jp/products/image/leaflet/pro_keytop_a_l.jpg)

### Karabiner Elements（基本的な設定）

Windows では OS 側での設定は特に行わず、HHKB に書き込んだ設定のみで使用します。  
ここから、Mac で Windows での操作感に寄せていくための調整をやっていきます。

#### 修飾キーを入れ替える

まず、修飾キーを入れ替えていきます。修飾キーの入れ替えは Mac の標準機能で実現できるのですが、ツール統一の観点から Karabiner Elements で実施します。

Mac の内蔵キーボード（US 配列）の `Caps Lock` を HHKB 風に Windows での `Control` 相当である `Command` にします。

![内蔵キーボード](/images/posts/2023/01/keyboard_ke_internal.png)

HHKB の `左 Command` と `左 Control` を入れ替えます。これにより、一般的に `Caps Lock` の位置のキーが `Command` になります。一番手前の列の左端が `Control` です。

![HHKB](/images/posts/2023/01/keyboard_ke_hhkb.png)

#### Mac 内蔵キーボードの左右 `Command` を `英数` `かな` にする

Karabiner Elements の `Complex Modifications` → `Add rule` → `Import more rules from the Internet (Open a web browser)` と進みます。

[https://ke-complex-modifications.pqrs.org/](https://ke-complex-modifications.pqrs.org/) が開くので、`RDP for Japanese, US Keyboard （リモートデスクトップとUSキーボード、日本語環境の設定）` を import します。リモートデスクトップを使わなければ `For Japanese （日本語環境向けの設定） (rev 6)` でも OK です。

`[RDP] RDPアプリ以外では、コマンドキーを単体で押したときに、英数・かなキーを送信する。（左コマンドキーは英数、右コマンドキーはかな） (rev 3)`（`コマンドキーを単体で押したときに、英数・かなキーを送信する。（左コマンドキーは英数、右コマンドキーはかな） (rev 3)`）のルールを追加します。

これにより、HHKB での `英数` `かな` と同じ機能が実現します。本来の位置の左右 `Command` も単押しでなければ引き続き利用可能です。

### Karabiner Elements（細かい設定）

上記の設定で基本的には OK ですが、まだ細かいところで違いがあるので合わせていきます。

#### `Home` `End` キーで行端に移動する

先ほどと同じように、今度は `PC-Style Shortcuts` を探して import します。

`Home key to the beginning of the line (Control + a)` および `End key to the end of the line (Control + e)` のルールを追加します。

#### 日本語入力時の `Control + T/U/I/O/P` を復活させる

HHKB で日本語を入力している方なら使っていることも多いと思われる `Control + T/U/I/O/P` というショートカットがあります。Windows で使えるショートカットですが、Mac でも `Windows 風のキー操作` を有効にすることで使えます。

![Mac IME](/images/posts/2023/01/keyboard_mac_ime.png)

| Windows ショートカット | Mac ショートカット         | 変換先   | F キー |
| ---------------------- | -------------------------- | -------- | ------ |
| Control + T            | Control + T                | 半角英数 | F10    |
| Control + U            | Control + U                | 全角かな | F6     |
| Control + I            | Control + I                | 全角カナ | F7     |
| Control + O            | 不明 (Option + A は使えた) | 半角ｶﾅ   | F10    |
| Control + P            | Control + P                | 全角英数 | F9     |

これらに関しては、半角ｶﾅを除いて、どちらも `Control` なので、`Caps Lock` 位置に Windows では `Control` を、Mac では `Command` を置く運用だと位置がずれてしまいます。

なので、`Command + T/U/I/O/P` で、Windows と同じような動作をするように変更します。なぜか `Control + O` だけ Windows と互換性がない（半角英数になってしまう）ので、`Option + A` にします。

試してみたい方は [japanese_cmd_tuiop.json](https://raw.githubusercontent.com/SogoKato/KE-complex_modifications/feature/cmd-tuiop/public/json/japanese_cmd_tuiop.json) をダウンロードして `~/.config/karabiner/assets/complex_modifications` ディレクトリ内に保存してください。

（使ってみて安定していたらプルリクを出そうと思います）

上記をすべて設定するとこんな感じです。

![complex modifications](/images/posts/2023/01/keyboard_ke_complex.png)

## 最後に

以上が、2023年版 私のキーボードマッピングでした。多分向こう半年くらいはこの設定で行くと思います。ではでは。
