---
title: "Raspberry Pi 5を M.2 SSDブート"
date: "2024-03-03"
tags: ["Raspberry Pi"]
---

Raspberry Pi 5 の目玉機能の一つは M.2 SSD への対応とのことで、せっかくなので試してみました。

![NVMe Base](/images/posts/2024/03/rpi5_nvme_base.jpg)

## 使ったもの

* Raspberry Pi 5 8GB
* NVMe Base for Raspberry Pi 5 – NVMe Base + 250GB SSD
  * 2つで65ポンド + 送料7.5ポンド（13,985円 = 1つあたり約7,000円）
  * https://shop.pimoroni.com/products/nvme-base?variant=41313839448147
* 電源（5W 5A）
  * Geekworm 1,999円
  * https://www.amazon.co.jp/gp/product/B0CQLVS4L2
* M.2 SSD エンクロージャ
  * SUNEAST 2,052円
  * https://www.amazon.co.jp/gp/product/B0BQ7D17MN

※ アフィリエイトではありません。

ラズパイ5に対応した M.2 SSD 用の HAT は複数出ていますが、今回私は Pimoroni のものを選んでみました。Pimoroni の商品は HAT ではなく NVMe Base の名前の通り、ラズパイの下側に配置するボードです。HAT じゃないほうが他の HAT をつけたくなった時の自由度が高いかなと思いこっちにしました。

セットになっている SSD は Pimoroni で互換性が確認できているモデルなので相性問題的な意味では安心です。どのメーカーの SSD が来るかは届くまで分かりません。今回は Patriot P300 というモデルが来ました。[Amazon で見てみたら](https://www.amazon.co.jp/dp/B082BWY2C2) 3,850円。NVMe Base は単品で買うと11.25ポンドのようなので 250GB の SSD 分は大体21.25ポンド（約4,000円）と考えると（送料もかかっているので）若干損？した気もしつつ、まぁ許容範囲内です。普通に商品ページに互換性の確認されているモデルの一覧があるので、探して買ってもいいと思います。

## やること

### PC で SSD に OS イメージを焼く

いつも通り [Raspberry Pi Imager](https://www.raspberrypi.com/software/) で焼けば OK です。M.2 SSD エンクロージャで SSD を PC に繋いでイメージを焼きます。

### NVMe ベースの組み立て

公式の組み立て動画がわかりやすいので見ながら組み立てます。

```youtube
odG7FbptgWQ
```

### 起動する

焼いた後も特に何も設定変更せず、いきなり電源投入で起動しました。🚀

ブートローダーのバージョンによっては更新が必要っぽいんですが、私（2月中旬にスイッチサイエンスで購入）の場合はすでに対応バージョンだったぽく、必要ありませんでした。

## ベンチマーク

[fio](https://fio.readthedocs.io/en/latest/) でランダムリードのベンチマークを取ってみました。110,000 IOPS、スループットは428MiB/s、レイテンシーは500マイクロ秒（94.56%）でした。

```
$ fio --name TEST --eta-newline=5s --filename=temp.file --rw=randread --size=2g --io_size=10g --blocksize=4k --ioengine=libaio --fsync=1 --iodepth=1 --direct=1 --numjobs=32 --runtime=60 --group_reporting
TEST: (g=0): rw=randread, bs=(R) 4096B-4096B, (W) 4096B-4096B, (T) 4096B-4096B, ioengine=libaio, iodepth=1
...
TEST: (groupid=0, jobs=32): err= 0: pid=2845: Sat Mar  2 23:22:31 2024
  read: IOPS=110k, BW=428MiB/s (449MB/s)(25.1GiB/60001msec)
    slat (usec): min=4, max=298, avg= 9.25, stdev= 2.60
    clat (usec): min=2, max=8698, avg=280.70, stdev=41.78
     lat (usec): min=64, max=8706, avg=289.94, stdev=41.80
    clat percentiles (usec):
     |  1.00th=[  239],  5.00th=[  249], 10.00th=[  255], 20.00th=[  262],
     | 30.00th=[  265], 40.00th=[  273], 50.00th=[  273], 60.00th=[  281],
     | 70.00th=[  289], 80.00th=[  297], 90.00th=[  314], 95.00th=[  330],
     | 99.00th=[  367], 99.50th=[  383], 99.90th=[  416], 99.95th=[  437],
     | 99.99th=[  502]
   bw (  KiB/s): min=431008, max=441568, per=100.00%, avg=438918.77, stdev=46.81, samples=3808
   iops        : min=107752, max=110392, avg=109729.61, stdev=11.71, samples=3808
  lat (usec)   : 4=0.01%, 100=0.01%, 250=5.43%, 500=94.56%, 750=0.01%
  lat (usec)   : 1000=0.01%
  lat (msec)   : 2=0.01%, 4=0.01%, 10=0.01%
  cpu          : usr=1.73%, sys=5.88%, ctx=6582913, majf=0, minf=326
  IO depths    : 1=100.0%, 2=0.0%, 4=0.0%, 8=0.0%, 16=0.0%, 32=0.0%, >=64=0.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     issued rwts: total=6575783,0,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=1

Run status group 0 (all jobs):
   READ: bw=428MiB/s (449MB/s), 428MiB/s-428MiB/s (449MB/s-449MB/s), io=25.1GiB (26.9GB), run=60001-60001msec

Disk stats (read/write):
  nvme0n1: ios=6573766/22, merge=0/26, ticks=1781542/9, in_queue=1781552, util=99.89%
```

参考までに今まで使っていた USB SSD のベンチマークも取ってみました。お馴染みの Crucial BX500 の 240GB です。結果は 27,200 IOPS、スループットは 106MiB/s、レイテンシーは1,000マイクロ秒が34.43%、２ミリ秒が24.92%、750マイクロ秒が21.46%でした。

M.2 SSD はこれと比べて、IO やスループットが4倍程度速く、レイテンシーにばらつきがなく短いですね。

## 感想

M.2 NVMe にしたらやっぱり USB SATA 接続よりも目に見えて速くなりました。Ubuntu の LTS が出たらこれを Kubernetes クラスターに参加させて強化したいななどと企んでおります。その前にまずはコンテナのビルド時間などを計測してみたいなと思います。

## 参考文献

* [HOWTO Test Disk I/O Performance - LinuxReviews](https://linuxreviews.org/HOWTO_Test_Disk_I/O_Performance)
