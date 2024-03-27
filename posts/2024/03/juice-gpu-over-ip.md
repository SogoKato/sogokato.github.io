---
title: "JuiceでGPUをコンピュータ間で共有（GPU-over-IP）"
date: "2024-03-28"
tags: ["GPU"]
---

Windows PC に GPU を取り付けておきつつ、必要に応じてラズパイやクラウドのサーバーから自宅の GPU リソースを活用出来たら嬉しいなと思い調べてみたら、Juice Labs という組織が GPU-over-IP の Juice というソフトウェアを開発していたので試してみました。

ただし、2024年3月現在、GitHub で公開されているコミュニティバージョンは開発を停止しているようです。

> We've been hard at work building the core Juice technology into an easy-to-use product, accessible through both a desktop app and via CLI. We have stopped updating or supporting this Community Version.

## 検証環境

* Windows 11 PC
  * NVIDIA GeForce RTX 2070
* WSL 2
* Docker Desktop 4.23.0

## やること

### Juice Server をインストール & 起動

GPU を搭載した PC 上で作業します。

事前準備の手順です。

1. NVIDIA driver 528.49 以上をインストール
1. [Microsoft Visual C++ runtime](https://aka.ms/vs/17/release/vc_redist.x64.exe) をインストール
1. TCP ポート 43210 を開ける（今回はローカル上で試すので省略しました）

Juice Server をインストールします。

1. 最新の [Juice Server for Windows](https://github.com/Juice-Labs/Juice-Labs/releases/latest/download/JuiceServer-windows.zip) をダウンロード
1. 任意のディレクトリに解凍

解凍したら、`agent.exe` を起動します。次のように出れば OK です。

```
2024/03/27 14:48:54 Info: Juice Agent, v0.0.0
2024/03/27 14:48:54 Warning: TLS is disabled, data will be unencrypted
2024/03/27 14:48:56 Info: GPUs
2024/03/27 14:48:56 Info:   0 @ 00000000:07:00.0: NVIDIA GeForce RTX 2070 8192MB
```

### Docker 環境で GPU を利用する

同じ PC の WSL 環境でコンテナを立てて GPU を利用してみます。

以下の Dockerfile を用意してクライアント側の環境を作ります。最新版では動かなかったので、PyTorch バージョンを固定しています。

```dockerfile
FROM ubuntu:jammy

RUN \
    apt-get update && \
    apt-get install -y libvulkan1 libgl1 libglib2.0-0 wget

RUN \
    wget https://github.com/Juice-Labs/Juice-Labs/releases/latest/download/JuiceClient-linux.tar.gz && \
    mkdir JuiceClient && \
    tar -xf ../JuiceClient-linux.tar.gz -C JuiceClient

RUN \
    apt-get install -y python3 python3-pip && \
    pip3 install torch==2.0.0 torchvision==0.15.1 torchaudio==2.0.1 --extra-index-url https://download.pytorch.org/whl/cu117

WORKDIR /JuiceClient
```

```
docker build . -t juicelabs/client
docker run --rm -it --add-host host.docker.internal:host-gateway juicelabs/client
```

コンテナの中に入ったら、`juicify` コマンド経由で目的のコマンドを実行します。`/JuiceClient/pytorch` 内にサンプルとして実行可能なスクリプトがあるので動かしてみます。白い犬の画像を識別するプログラムです。

```
./juicify --address host.docker.internal:43210 python3 pytorch/resnet.py
```

```
2024/03/27 14:49:21 Info: juicify, v0.0.0
2024/03/27 14:49:21 Info: Connected to host.docker.internal:43210, v0.0.0
Juice GPU [NVIDIA GeForce RTX 2070]
Downloading: "https://github.com/pytorch/vision/zipball/v0.10.0" to /root/.cache/torch/hub/v0.10.0.zip
Downloading: "https://download.pytorch.org/models/resnet152-f82ba261.pth" to /root/.cache/torch/hub/checkpoints/resnet152-f82ba261.pth
100.0%
2024-03-27 14:49:51.952 CudaModule.cpp:507 1b E] Module function '_Z18postprocess_kernelI13__nv_bfloat16yL20loadstore_modifier_t2EEv19real_complex_args_tIT0_E' 1113ae2cdf8bc5c1 not found
2024-03-27 14:49:51.952 CudaModule.cpp:507 1b E] Module function '_Z18postprocess_kernelI13__nv_bfloat16jL20loadstore_modifier_t2EEv19real_complex_args_tIT0_E' 43a3c35008cf9924 not found
2024-03-27 14:49:51.952 CudaModule.cpp:507 1b E] Module function '_Z17preprocess_kernelI13__nv_bfloat16yL20loadstore_modifier_t2EEv19real_complex_args_tIT0_E' 618c63dffdbc1908 not found
2024-03-27 14:49:51.952 CudaModule.cpp:507 1b E] Module function '_Z17preprocess_kernelI13__nv_bfloat16jL20loadstore_modifier_t2EEv19real_complex_args_tIT0_E' 90db0c94d7c9628 not found
Samoyed 0.4892646074295044
Pomeranian 0.170170396566391
white wolf 0.021176543086767197
keeshond 0.015171395614743233
Eskimo dog 0.006202252581715584
```

## 感想

コミュニティがあまり活発じゃなさそうなのが気がかりですが、ノード間で手軽に GPU リソースを共有できるのは便利で経済的だと思うので、今後に期待したいプロダクトです。

## 参考文献

* [Juice-Labs/Juice-Labs: Juice Community Version Public Release](https://github.com/Juice-Labs/Juice-Labs)
* [Install Juice · Juice-Labs/Juice-Labs Wiki](https://github.com/Juice-Labs/Juice-Labs/wiki/Install-Juice)
* [Juice and Docker · Juice-Labs/Juice-Labs Wiki](https://github.com/Juice-Labs/Juice-Labs/wiki/Juice-and-Docker)
* [Previous PyTorch Versions | PyTorch](https://pytorch.org/get-started/previous-versions/)
