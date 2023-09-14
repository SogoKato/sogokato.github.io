---
title: "Raspberry Pi Zero WHにVolumio 3を入れる場合は2系からアップグレードする"
date: "2023-09-09"
tags: ["Volumio", "Raspberry Pi"]
---

掲題の通りです。今更ながら、その辺に転がっているラズパイゼロ（初代、Wi-Fi 付）とその辺に転がっている中華 USB-DAC を使って Spotify Connect 用の環境を整えようと [Volumio](https://volumio.com/en/get-started/) を入れてみました。

## 使ったもの

* Raspberry Pi Zero WH
* Micro SD
* 電源（Apple の 5W 1A のやつで十分）
* Micro USB ケーブル
* USB OTG ケーブル（Micro USB オスから USB A メスに変換するやつ）
* Mini HDMI ケーブル（起動しない場合のデバッグをするのに便利）
* USB-DAC（AIYIMA DAC-A2）

## やること

### Volumio 2 を Misro SD に焼いて起動

2023年9月時点で Volumio の最新は3系ですが、3系を焼いて Raspberry Pi Zero に差してもブート前のパーティション作成かなにかの時にコケてしまいました。`mount: mounting /dev/mmcblk0p3 on /mnt/ext/ failed: Invalid argument` のようなエラーが出てしまいます。同じ SD カードでも DietPi は動作しましたし、他の2枚の SD カードでも同じエラーが出たのでこれは Volumio 3 側のエラーだと思います。え、私のラズパイ古すぎ……？

ということで、[Volumio 3 issues: hints and solutions](https://community.volumio.com/t/volumio-3-issues-hints-and-solutions/51707) というヘルプページに載っていた Volumio 2 のイメージを落としてきて焼いて起動させたところ、無事に起動しました。

> Volumio 3 does not work for me yet, some things I need are still missing or not working
>
> You can revert to the last versions of your RPi, Tinkerboard and X86, using these downloads.  
> But please note that Volumio 2 will go EOL soon, there will be no maintenance.  
> Update to (or flash) Volumio 3 as soon as possible.
> 
> [volumio-2.917-2021-10-06-pi](https://updates.volumio.org/pi/volumio/2.917/volumio-2.917-2021-10-06-pi.img.zip)  
> [volumio-2.916-2021-10-01-tinkerboard](https://updates.volumio.org/tinkerboard/volumio/2.916/volumio-2.916-2021-10-01-tinkerboard.img.zip)  
> [volumio-2.916-2021-10-01-x86](https://updates.volumio.org/x86/volumio/2.916/volumio-2.916-2021-10-01-x86.img.zip)

### Volumio 2 のセットアップ

Volumio が起動するとラズパイ自身が Wi-Fi アクセスポイントになるので、スマホや PC の Wi-Fi 設定から SSID Volumio に繋ぎます（PW は volumio2）。[http://volumio.local](http://volumio.local) を開き、ウィザードに沿ってセットアップします。

Volumio 2 にも Spotify 用のプラグインを入れられるのですが、Spotify Connect の端末として認識はされますが、バージョンが古いからか実際に再生はできませんでした。

### Volumio 3 へアップグレード

設定画面から更新を確認すると Volumio 3 へのアップグレードが可能ですのでアップグレードします。

完了してリロードするとまたウィザードが出てくるので設定を実施します。

Volumio 2 で入れていた Spotify 用のプラグインは消えていますので、MyVolumio アカウントを作成して Spotify プラグインをインストールします。特に設定は必要なく（ユーザー名・パスワードは Zeroconf で認証されるため不要）、これだけで Spotify Connect が利用可能です。

プレイバックオプションから出力デバイスを USB-DAC に設定すればスピーカーから音が出ます。🎉

## 感想

初回起動で少し躓いてしまいましたが、一旦起動してしまえば後の設定は非常に簡単でした。Volumio の開発者の方に感謝です。まだ数時間使っただけですが、途切れることもなく、レスポンスもいいのでとても良い感じです。

### 2023/09/14 追記

気づいたことが2点あったので追記します。

* Spotify の Music + Talk コンテンツは正しく再生できない
  * ラジオ形式でトークとトークの間に曲を流すタイプのコンテンツは対応していないようです（トークだけがひたすら流れる）
* 再生開始後1秒くらいで必ず停止してしまうことがある
  * 原因はよくわからない、再起動や再インストールも効果なし
  * 下記あたりを試していると直ったりする（かも）
    * 再起動
    * プラグイン再インストール
    * 出力デバイスを一度 HDMI に変え、その後 USB-DAC に戻す
