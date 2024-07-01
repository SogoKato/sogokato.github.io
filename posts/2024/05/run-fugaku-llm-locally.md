---
title: "Fugaku-LLMを自宅PCで動かしてみた"
date: "2024-05-18"
tags: ["LLM", "GPU"]
---

スパコン「富岳」で学習したという「Fugaku-LLM」を自宅 PC で動かしてみました。既に多くの方が Colab とか Ollama とかで試しているみたいですので n 番煎じですが、自分でも触ってみたかったので。

https://github.com/SogoKato/run-fugaku-llm

## 環境

* Windows 11
* WSL 2 + Docker Desktop
* GeForce RTX 2070 (8GB RAM)
* AMD Ryzen 7 3700X
* 32GB RAM

ぜんぜん最新じゃない GPU では、どれくらい時間がかかるのでしょうか……？！

## やりかた

やり方は上記リポジトリにまとめていますが一応ここにも載っけておきます。

PyTorch が入った、Fugaku-LLM 開発元もテストに使ったぽいイメージを利用します。

```
docker run --gpus all \
  -v $(pwd):/workspace \
  -v /home/${USER}/.cache/huggingface/hub:/root/.cache/huggingface/hub \
  -it --rm nvcr.io/nvidia/pytorch:20.12-py3
```

以後のコマンドはコンテナの中で実施します。  
まず、必要なものを pip install します。なんかエラー出たのでフラグつけてます。

```
pip install transformers accelerate --use-feature=2020-resolver
```

モデルをダウンロードするために Hugging Face にログインします。

```
huggingface-cli login
```

以下のスクリプト（Hugging Face に掲載のものと同じ）を作成して、実行します。

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_path = "Fugaku-LLM/Fugaku-LLM-13B-instruct"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.bfloat16, device_map="auto")
model.eval()

system_example = "以下は、タスクを説明する指示です。要求を適切に満たす応答を書きなさい。"
instruction_example = "スーパーコンピュータ「富岳」の名前の由来を教えてください。"

prompt = f"{system_example}\n\n### 指示:\n{instruction_example}\n\n### 応答:\n"

input_ids = tokenizer.encode(prompt,
                             add_special_tokens=False,
                             return_tensors="pt")
tokens = model.generate(
    input_ids.to(device=model.device),
    max_new_tokens=128,
    do_sample=True,
    temperature=0.1,
    top_p=1.0,
    repetition_penalty=1.0,
    top_k=0
)
out = tokenizer.decode(tokens[0], skip_special_tokens=True)
print(out)
```

time コマンドを使って時間を測ったところ、この時は**25分35秒**でした。長い時だと32分くらいだったりもしました（いずれもモデルダウンロード済みの2回目以降の結果です）。  
なかなか実用的じゃない結果ですね。。

```
root@4d5f84a5e6d8:/workspace# time python3 main.py
/opt/conda/lib/python3.8/site-packages/huggingface_hub/file_download.py:1132: FutureWarning: `resume_download` is deprecated and will be removed in version 1.0.0. Downloads always resume when possible. If you want to force a new download, use `force_download=True`.
  warnings.warn(
Loading checkpoint shards: 100%|█████████████████████████████████████| 6/6 [00:01<00:00,  4.43it/s]
/opt/conda/lib/python3.8/site-packages/huggingface_hub/file_download.py:1132: FutureWarning: `resume_download` is deprecated and will be removed in version 1.0.0. Downloads always resume when possible. If you want to force a new download, use `force_download=True`.
  warnings.warn(
WARNING:root:Some parameters are on the meta device device because they were offloaded to the cpu and disk.
以下は、タスクを説明する指示です。要求を適切に満たす応答を書きなさい。

### 指示:
スーパーコンピュータ「富岳」の名前の由来を教えてください。

### 応答:
「富岳」は日本の理化学研究所と富士通が共同で開発したスーパーコンピュータで、富士山の異名である「富嶽」に由来している。この名前は、スーパーコンピュータが日本の研究コミュニティや産業界に広く受け入れられ、広く使用されることを願って付けられた。また、富士山が高く評価され、愛されている日本の象徴であることから、この名前が選ばれた。

real    25m35.436s
user    4m53.496s
sys     4m50.370s
```

## おまけ

今回、Ollama というのを知ったので簡単に試してみたのですがなぜか「真岡」連発で、望んだ結果が得られませんでした（なんで？？）。もう少し調べて再挑戦したら記事更新したいと思います。

<details>
<summary>試した手順</summary>

Fugaku-LLM-13B-instruct-0325b-q5_k_m.gguf をダウンロードしておく

`Modelfile` は [ollamaで Fugaku-LLM を動かす](https://zenn.dev/hellorusk/articles/94bf32ea09ba26) から拝借しました（[Fugaku-LLMをollamaで利用する](https://zenn.dev/tos_kamiya/articles/9d8ce89bb933b1) からお借りしても結局「真岡」だったのは同じ）。

```
$ docker run --gpus all \
  -v $(pwd):/workspace \
  -v /home/${USER}/.ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  -it --rm ollama/ollama:0.1.38
```

```
$ docker exec ollama \
  ollama create fugaku-llm-13b-instruct -f /workspace/Modelfile
transferring model data 
using existing layer sha256:b6999c1a64a531726fa1a6f10459f477c1016cc72212401fc9affbb29b1bc7fb 
using existing layer sha256:a4e0782577a830dbeb8403285a149e70b5cdc22cbd149b733084be91a229abe2 
using existing layer sha256:7062f767f7a9e848e484bc1df8c7b13fa08482ba42ffc3eba985d8f7a7e00eed 
using existing layer sha256:015be5bf83215a3cfe0918304447348731d6421e9d1e840c5c25938a88ea9fb3 
using existing layer sha256:e513a77c156e5870c681a34d831367325595410e4223085d847714c17b6afddc 
writing manifest 
success
```

```
$ docker exec -it ollama \
  ollama run fugaku-llm-13b-instruct
>>> スーパーコンピュータ「富岳」の名前の由来を教えてください。
真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡真岡
```

</details>

### 2024-05-18 追記

どうやら GPU の設定がうまく行っていないっぽく、`--gpus all` なしで起動したら、ちゃんとした回答が来た。48秒。30分かけた上の回答よりは洗練されていない感じするけど、圧倒的に速い。llama すごい。

```
>>> スーパーコンピュータ「富岳」の名前の由来を教えてください。
「富岳」は日本のスーパーコンピュータの名前で、「富士山」を意味する。この名前は、富士山が日本で最も高く、最も有名な山であることから選ばれた。スーパーコンピュータの名前として富士山が選ばれたのは、その「富岳」は日本のスーパーコンピュータの名前で、「富士山」を意味する。この名前は、富士山が日本で最も高く、最も有名な山であることから選ばれた。スーパーコンピュータの名前として富士山が選ばれたのは、その美しさと威厳のある姿が、スーパーコンピュータに求められる高い性能と信頼性を象徴しているからである。富岳」という名称は、日本のハイテク産業と日本の科学技術の優秀さを世界に示す役割も果たしている。
```

Docker Desktop なので [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) は必要ないはず。実際、ちゃんと認識されてる。Docker Desctop の再始動や更新も関係なし。GPU のメモリ不足説が濃厚か。

```
$ docker run -it --gpus=all --rm nvidia/cuda:12.4.1-base-ubuntu20.04 nvidia-smi
Fri May 17 17:22:11 2024
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 550.54.10              Driver Version: 551.61         CUDA Version: 12.4     |
|-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |
|                                         |                        |               MIG M. |
|=========================================+========================+======================|
|   0  NVIDIA GeForce RTX 2070        On  |   00000000:07:00.0 Off |                  N/A |
|  0%   42C    P8              9W /  175W |     588MiB /   8192MiB |      3%      Default |
|                                         |                        |                  N/A |
+-----------------------------------------+------------------------+----------------------+

+-----------------------------------------------------------------------------------------+
| Processes:                                                                              |
|  GPU   GI   CI        PID   Type   Process name                              GPU Memory |
|        ID   ID                                                               Usage      |
|=========================================================================================|
|    0   N/A  N/A        38      G   /Xwayland                                   N/A      |
|    0   N/A  N/A        40      G   /Xwayland                                   N/A      |
+-----------------------------------------------------------------------------------------+
```

### 2024-07-01 追記

よく見たら [ollama の README](https://github.com/ollama/ollama) に以下の記載があったので、GPU のメモリ不足ということで結論にします。

> Note: You should have at least 8 GB of RAM available to run the 7B models, 16 GB to run the 13B models, and 32 GB to run the 33B models.

## 参考文献

* [スーパーコンピュータ「富岳」で学習した大規模言語モデル「Fugaku-LLM」を公開 : 富士通](https://pr.fujitsu.com/jp/news/2024/05/10.html)
* [Fugaku-LLM/Fugaku-LLM-13B-instruct · Hugging Face](https://huggingface.co/Fugaku-LLM/Fugaku-LLM-13B-instruct)
* [Fugaku-LLM/Fugaku-LLM-13B-instruct-gguf · Hugging Face](https://huggingface.co/Fugaku-LLM/Fugaku-LLM-13B-instruct-gguf)
* [GitHub - Fugaku-LLM/DeepSpeedFugaku](https://github.com/Fugaku-LLM/DeepSpeedFugaku)
* [PyTorch | NVIDIA NGC](https://catalog.ngc.nvidia.com/orgs/nvidia/containers/pytorch)
* [Fugaku-LLM/Fugaku-LLM-13B-instruct を Colab で試す｜owlet_notes99.9](https://note.com/owlet_notes/n/nd144bd2d1dc1#93b6f5fe-3777-427a-b52a-a5c21ab27024)
* [Fugaku-LLMはアニメを語れるのか！？ ～Fugaku-LLM-13B-instructをGoogle Colabで動かしてみた～ #AI - Qiita](https://qiita.com/kit/items/5d8f2c80ed3e939fc8bb)
* [ollamaで Fugaku-LLM を動かす](https://zenn.dev/hellorusk/articles/94bf32ea09ba26)
* [Fugaku-LLMをollamaで利用する](https://zenn.dev/tos_kamiya/articles/9d8ce89bb933b1)
