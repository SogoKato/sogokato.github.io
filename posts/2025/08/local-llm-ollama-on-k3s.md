---
title: "自宅PCをローカルLLMサーバにする【Nvidia/K3s/Ollama/Gemma3】"
date: "2025-08-14"
tags: ["LLM", "GPU", "K3s", "Kubernetes", "自宅サーバー"]
---

[個人的Ubuntu24.04 Serverセットアップメモ](/posts/2025/08/setup-ubuntu-server) の続きです。VRAM 8 GB しかない GPU で、マルチモーダル入力可能なローカル LLM サーバーを構築していきます。結論、これからローカル LLM のために GPU を用意するなら RTX 40xx 世代以降がおすすめ。

## 環境

* Ubuntu 24.04 Server
* Ryzen 7 3700X
* メモリ 32GB
* NVIDIA GeForce RTX 2070
  * VRAM 8 GB
* nvidia-driver-575 575.64.03-0ubuntu0.24.04.1
* NVIDIA Container Toolkit 1.17.8-1
* K3s v1.32.6+k3s1
* Helm v3.15.3
* NVIDIA GPU Operator 25.3.2
* ~~vLLM v0.10.0~~
* Ollama v0.11.2

## 前提条件

* Nvidia ドライバを導入済み
* Nvidia Container Toolkit を導入済み
* K3s セットアップ済み

各手順は [前回の記事](/posts/2025/08/setup-ubuntu-server) を参照

## NVIDIA GPU Operator 導入

K3s のドキュメントにはドライバと container toolkit をインストールした状態で K3s をセットアップすれば、そのまま pod で GPU を要求すれば動くふうに書かれていますが、筆者の環境ではダメだったので、ネットの情報を頼りに [^1] NVIDIA GPU Operator をインストールしました。

[^1]: [k3sでNvidia GPUを使用する](https://cloudandbuild.jp/blog/article-20240914) の記事でも k3s 構築直後の状態では GPU が使えないと書かれている。

(以下、実際には [Helmfile](https://helmfile.readthedocs.io/en/latest/) を使っているのでコマンドは間違っている可能性がある)

```sh
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update
```

```sh
helm install --wait --generate-name \
  -n gpu-operator --create-namespace \
  nvidia/gpu-operator \
  --version=v25.3.2 \
  --values=values.yaml
```

`values.yaml`

```yaml
operator:
  runtimeClass: nvidia
  # upgrade CRD on chart upgrade, requires --disable-openapi-validation flag
  # to be passed during helm upgrade.
  upgradeCRD: true
driver:
  enabled: false
toolkit:
  enabled: false
dcgmExporter:
  enabled: false
  config:
    name: ""
```

[NVIDIA GPU Operator のページ](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/getting-started.html) に書かれているように、ノード上にドライバと container toolkit がインストールされている場合は `driver.enabled=false` `toolkit.enabled=false` を設定して OK です。

`dcgmExporter` の項目は helm install 時にコケたので入れているだけで、なしでいけるならなしでいいです。

## Ollama デプロイ

[otwld/ollama-helm](https://github.com/otwld/ollama-helm) を使用します。

```sh
helm repo add otwld https://helm.otwld.com/
helm repo update
helm install --wait ollama \
  -n ollama --create-namespace \
  otwld/ollama \
  --version=v1.26.0 \
  --values values.yaml
```

`values.yaml`

```yaml
ollama:
  gpu:
    enabled: true
    type: 'nvidia'
    number: 1
  models:
    pull:
      - gemma3:4b

runtimeClassName: nvidia

persistentVolume:
  enabled: true
```

動作確認します。

```sh
kubectl run curl-test \
  --rm -it \
  --image=curlimages/curl:8.7.1 \
  --restart=Never \
  -- curl -s http://ollama.ollama:11434/api/generate \
       -H "Content-Type: application/json" \
       -d '{"model": "gemma3:4b", "prompt": "Hello from Kubernetes!", "stream": false}'
```

(レスポンスを見やすくフォーマットしています)

```json
{
  "model": "gemma3:4b",
  "created_at": "2025-08-13T01:12:45.465213503Z",
  "response": "Hello to you too from my digital world! 👋 \n\nIt’s great to hear from someone running in Kubernetes. It's a powerful platform for deploying and managing applications. \n\nWhat's happening in your cluster? Are you running anything interesting?  Do you want to chat about Kubernetes, or perhaps you have a question you'd like to ask?",
  "done": true,
  "done_reason": "stop",
  "context": [
    ...
  ],
  "total_duration": 1185074966,
  "load_duration": 118207640,
  "prompt_eval_count": 13,
  "prompt_eval_duration": 32136908,
  "eval_count": 75,
  "eval_duration": 1034268789
}
```

画像も送ってみます。

```sh
kubectl run curl-test \
  --rm -it \
  --image=curlimages/curl:8.7.1 \
  --restart=Never \
  -- sh -c 'wget https://sogo.dev/images/icon.png \
    && base64 -w 0 icon.png  > image.txt \
    && curl -s http://ollama.ollama:11434/api/generate \
       -H "Content-Type: application/json" \
       -d "{\"model\": \"gemma3:4b\", \"prompt\": \"何が写っていますか\", \"images\":[\"$(cat image.txt)\"], \"stream\": false}"'
```

```json
{
  "model": "gemma3:4b",
  "created_at": "2025-08-13T01:48:30.629190309Z",
  "response": "画像には、橙色のドッグ（長毛のドッグ）の横顔が写っています。",
  "done": true,
  "done_reason": "stop",
  "context": [
    ...
  ],
  "total_duration": 3821486516,
  "load_duration": 2237497834,
  "prompt_eval_count": 275,
  "prompt_eval_duration": 1299865248,
  "eval_count": 22,
  "eval_duration": 283175986
}
```

いいかんじですね！

## おまけ: vLLM 編

最初は、本番用途に強いとされる [vLLM](https://docs.vllm.ai/en/v0.7.3/index.html) で構築を進めていたのですが、私の GPU では [Gemma 3](https://ai.google.dev/gemma/docs/core?hl=ja) 4B を動かせなかったので断念しました。

* メモリ 8 GB では通常の 32 ビットを動かすには足りない
* BF16, SFP8, INT4 については、RTX 20xx が対応していない、または vLLM が要求するバージョン未満の世代の GPU なので不可

Gemma 3 1B なら GPU で動きましたが、1B はテキストのみでマルチモーダル非対応なので、用途に合わず却下。vLLM は [CPU でも動く](https://docs.vllm.ai/en/latest/getting_started/installation/cpu.html) みたいですが、pre-built なコンテナイメージが amd64 用に用意されてなかったので試していません。

## 参考文献

* [高度なオプション / 設定 | K3s](https://docs.k3s.io/ja/advanced#nvidia%E3%82%B3%E3%83%B3%E3%83%86%E3%83%8A%E3%83%A9%E3%83%B3%E3%82%BF%E3%82%A4%E3%83%A0%E3%81%AE%E3%82%B5%E3%83%9D%E3%83%BC%E3%83%88)
* [Installing the NVIDIA Container Toolkit — NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-apt-ubuntu-debian)
* [k3sでNvidia GPUを使用する](https://cloudandbuild.jp/blog/article-20240914)
* [Installing the NVIDIA GPU Operator — NVIDIA GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/getting-started.html)
* [k8s クラスタからGPUを使用する方法について( gpu-operator)](https://zenn.dev/srkr/articles/4afe42d3d2183e)
* [Gemma 3 モデルの概要  |  Google AI for Developers](https://ai.google.dev/gemma/docs/core?hl=ja)
