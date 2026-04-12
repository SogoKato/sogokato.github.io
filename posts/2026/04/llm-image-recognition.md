---
title: "Gemma 3, Gemma 4, Qwen 3.5で画像入力に対する応答の精度を比較してみる"
date: "2026-04-12"
tags: ["LLM", "GPU"]
---

個人的に使っている LINE ボットをグループに参加させているのですが、送られた画像のうち「プライベート」な画像をクラウドの LLM API に送るのはちょっと抵抗がある、っていうことでガードレール的にローカル LLM で判定して、問題なさそうな画像だけをクラウドに送るようにしてます。

去年半ばから使い始めていて Gemma 3 4B でそれなりに動いていたのですが、Qwen 3.5 の評判が良かったり、つい最近 Gemma 4 も出てきたってことで、定量的に評価してみました。

## 環境

* Ubuntu 24.04 Server
* GeForce RTX 2070 (8GB RAM)
* AMD Ryzen 7 3700X
* 32GB RAM

K3s で構築したクラスタに、以下の Helm チャートを使って Ollama を建てています。

* [NVIDIA/gpu-operator: NVIDIA GPU Operator creates, configures, and manages GPUs in Kubernetes](https://github.com/NVIDIA/gpu-operator)
  * Chart v26.3.0
* [otwld/ollama-helm: Helm chart for Ollama on Kubernetes](https://github.com/otwld/ollama-helm)
  * Chart v1.54.0
  * ただし Gemma 4 を使うには (Chart v1.54.0 でデフォルトの) Ollama 0.19 では非対応なので、Ollama 0.20.5 を使用

関連記事: [自宅PCをローカルLLMサーバにする【Nvidia/K3s/Ollama/Gemma3】](/posts/2025/08/local-llm-ollama-on-k3s)

## 結果

今時の GPU じゃないのでライトめなモデルしか試せていないのはご容赦ください。。

### Thinking なし

| model      | accuracy (%) | avg latency (ms) | median (ms) | p95 (ms) | error count | runs |
| ---------- | -----------: | ---------------: | ----------: | -------: | ----------: | ---: |
| gemma3:4b  |        50.00 |              833 |         653 |     1507 |           0 |  100 |
| gemma3:12b |        76.00 |              982 |         699 |     2012 |           0 |  100 |
| gemma4:e2b |        72.00 |              652 |         568 |      837 |           0 |  100 |
| gemma4:e4b |        88.00 |              665 |         597 |      999 |           0 |  100 |
| qwen3.5:2b |        76.00 |              638 |         602 |      722 |           0 |  100 |
| qwen3.5:4b |        78.00 |              824 |         797 |      923 |           0 |  100 |
| qwen3.5:9b |        82.00 |             1149 |        1117 |     1231 |           0 |  100 |

### Thinking あり

| model      | accuracy (%) | avg latency (ms) | median (ms) | p95 (ms) | error count | runs |
| ---------- | -----------: | ---------------: | ----------: | -------: | ----------: | ---: |
| gemma4:e2b |        71.00 |             5681 |        4246 |     6981 |           1 |  100 |
| gemma4:e4b |        85.00 |             8779 |        9069 |    20685 |           0 |  100 |
| qwen3.5:2b |        71.00 |            20720 |        6878 |    95178 |           1 |  100 |
| qwen3.5:4b |        87.50 |            11363 |        8011 |    30565 |           0 |   40 |
| qwen3.5:9b |        85.00 |            29875 |       16811 |    97669 |           0 |   40 |

runs=100は20個のテストケースを5回ずつ、runs=40は20個のテストケースを2回ずつ実行した場合の結果です。

### 考察

今回の実験では、Thinking を有効にしても精度が大きく伸びるわけではなく、むしろレイテンシだけが大幅に悪化する結果になりました。実運用を考えると、Gemma 4 E4B を Thinking なしで使う構成が、精度 88% と応答速度のバランスが最も良さそうです。Qwen 3.5 系は Thinking ありで精度は出るものの、この GPU では待ち時間の増加がかなり重く感じました。

## やりかた

GitHub にテスト用のソースコードを配置しているので詳しくはそちらを参照ください。

[SogoKato/privacy-filter-testset](https://github.com/SogoKato/privacy-filter-testset)

テストに使いたい画像を用意し、ラベル付けします。

```json
{"id":"doc-001","image":"images/id-card.jpg","expected":true,"category":"official-document"}
{"id":"food-001","image":"images/meal.jpg","expected":false,"category":"food"}
```

プロンプトはこれです。

```
Return true only if the image is private.
Return false in all other cases.

Priority rule:
If an image matches any example in the "not private" list,
you must return false even if you believe it could identify someone.
The "not private" list always takes precedence over any other reasoning.

Return true for private images such as:
* Official documents (ID, letters, bills)
* Screenshots
* Human faces
* Health data

Return false for images such as:
* Pets (including dogs, cats, and other animals and these faces)
* Landscapes
* Food
* Food-related labels (nutrition facts, ingredient lists, packaging)

Always answer with true or false only.
Do NOT include line breaks, spaces, or symbols. All lowercase.

Do not rely on small details or background patterns to judge privacy.
Look at the entire image content and classify based on the following example lists only.
```

Ollama を起動してモデルをプル (例: `ollama pull gemma4:e4b`) しておきます。

スクリプトを実行します。

```sh
uv run main.py --manifest examples/manifest.jsonl --model gemma4:e4b --output reports/gemma4-e4b.json --repeats 5
```

結果は次のように表示されます。

```
[PASS] doc-001#1 -> expected=false raw=false
(中略)
total=100
unique_cases=20
passed=88
failed=12
errors=0
accuracy=0.8800
latency_ms=avg:664.77,median:597.00,p95:998.55,min:479,max:1041
by_category=
  (中略)
  official-document: passed=5/5 accuracy=1.0000 errors=0
  (中略)
report=reports/gemma4-e4b.json
```
