---
title: "Raspberry Pi 5でStable Diffusionを動かす（4Bと比較）"
date: "2024-02-26"
tags: ["Raspberry Pi", "Stable Diffusion"]
---

Raspberry Pi 4B より2倍速い CPU を積んでいるという Raspberry Pi 5 で、Stable Diffusion で画像生成をさせるとどれくらい差があるのか試してみたら噂通りの実力が発揮されました。画像生成ですが、GPU ではなく CPU でゴリ押しするだけなので純粋な CPU 対決です。

![a black tree with golden leaves painted by Monet, autumn](/images/posts/2024/02/stable_diffusion_output.jpg)

## 使ったもの

* Raspberry Pi 5 8GB
* Raspberry Pi 4B 8GB
* SSD（USB SATA 接続）
* 電源（5W 3A）

## やること

[straczowski/raspberry-pi-stable-diffusion](https://github.com/straczowski/raspberry-pi-stable-diffusion) の手順とスクリプトを借りて実験しました。

[git-fls](https://github.com/git-lfs/git-lfs) をインストールします。

```
curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs
```

```
git lfs install
```

Stable Diffusion のモデルをダウンロードします。環境にもよると思いますが私の場合は50分程度かかりました。

```
git clone https://huggingface.co/runwayml/stable-diffusion-v1-5
```

ここは好みですが、私は Rye でパッケージを追加しました。普通に pip で入れてもいいと思います。2024年2月時点で PyTorch は 3.8〜3.11 に対応しているようだったので、`.python-version` を 3.11.7 にします（rye のデフォルトでは 3.12.1 だった）。

```
git clone https://github.com/straczowski/raspberry-pi-stable-diffusion.git
cd raspberry-pi-stable-diffusion/
rye init
echo 3.11.7 > .python-version
```

`pyproject.toml` に以下を追記します。

```toml
[[sources]]
name = "pytorch"
url = "https://download.pytorch.org/whl/cpu"
```

パッケージをインストールします。

```
rye add diffusers torch transformers accelerate
```

デフォルトだとコア数以上に OpenMP のスレッドが作られてしまい非効率なので（後述）、以下の設定にします。

```
export OPENBLAS_NUM_THREADS=1
export OMP_NUM_THREADS=4
```

PyTorch の設定値を確認するとこうなっています。

```
>>> import torch
>>> print(torch.__config__.parallel_info())
ATen/Parallel:
        at::get_num_threads() : 4
        at::get_num_interop_threads() : 4
OpenMP 201511 (a.k.a. OpenMP 4.5)
        omp_get_max_threads() : 4
MKL not found
Intel(R) MKL-DNN v3.3.2 (Git Hash 2dc95a2ad0841e29db8b22fbccaf3e5da7992b01)
std::thread::hardware_concurrency() : 4
Environment variables:
        OMP_NUM_THREADS : 4
        MKL_NUM_THREADS : [not set]
ATen parallel backend: OpenMP
```

time コマンドで実行します。

```
time rye run python app.py
```

## 結果

Raspberry Pi 5 では **14分11秒** というラズパイにしては意外な好タイムが出ました！

```
$ time rye run python app.py
/home/ubuntu/raspberry-pi-stable-diffusion/.venv/lib/python3.11/site-packages/diffusers/utils/outputs.py:63: UserWarning: torch.utils._pytree._register_pytree_node is deprecated. Please use torch.utils._pytree.register_pytree_node instead.
  torch.utils._pytree._register_pytree_node(
Loading pipeline components...: 100%|███████████████████████████████████████████████████████| 7/7 [00:02<00:00,  3.43it/s]
100%|█████████████████████████████████████████████████████████████████████████████████████| 31/31 [13:11<00:00, 25.54s/it]

real    14m11.829s
user    43m50.472s
sys     4m43.393s
```

一方、Raspberry Pi 4B では **32分36秒** という結果になりました。これでも、straczowski/raspberry-pi-stable-diffusion には45分程度とあったので十分（予想よりは）速いですが、5よりは2倍以上かかってしまっています。

```
$ time rye run python app.py
/home/ubuntu/raspberry-pi-stable-diffusion/.venv/lib/python3.11/site-packages/diffusers/utils/outputs.py:63: UserWarning: torch.utils._pytree._register_pytree_node is deprecated. Please use torch.utils._pytree.register_pytree_node instead.
  torch.utils._pytree._register_pytree_node(
Loading pipeline components...: 100%|█████████████████████████████████████| 7/7 [00:05<00:00,  1.31it/s]100%|███████████████████████████████████████████████████████████████████| 31/31 [30:26<00:00, 58.92s/it]

real    32m36.745s
user    107m40.966s
sys     7m29.575s
```

## 試行錯誤の過程

### StableDiffusionPipeline requires the transformers library but it was not found in your environment. You can install it with pip: `pip install transformers`

言われたとおりに transformers というライブラリを追加しました。

### Cannot initialize model with low cpu memory usage because `accelerate` was not found in the environment. Defaulting to `low_cpu_mem_usage=False`. It is strongly recommended to install `accelerate` for faster and less memory-intense model loading. You can do so with: ```pip install accelerate```

言われたとおりに accelerate というライブラリを追加しました。  
low_cpu_mem_usage=False だと OOM killed になっちゃいました。

### OpenBLAS Warning : Detect OpenMP Loop and this application may hang. Please rebuild the library with USE_OPENMP=1 option.

環境変数未設定の状態で動かしたら上記のエラーが出ました。調べてみると OpenBLAS のスレッディングと OpenMP のスレッディングが重複しているために発生している警告のようです。この警告だけでログが埋め尽くされてしまってウザめなのと、実際に著しく遅くなる（Pi 5で32分くらいかかった）ので対処します。

https://github.com/pytorch/pytorch/issues/52047#issuecomment-1700571734

Pi 5 で `OMP_NUM_THREADS=1` を設定して実行したところ28分3秒、`OPENBLAS_NUM_THREADS=4` も設定して実行したところ26分53秒となりました。32分よりは速いですが劇的に変わった感じはしません。実際 htop を見ても4つのコアのうち1つは常時ほぼ100%ですがほかのコアは使い切れていません。

その一方、`OMP_NUM_THREADS=4` `OPENBLAS_NUM_THREADS=1` にしてみたら各コアの計算能力をフルに活かして14分11秒となりました。🎉

## 感想

まぁ普通に GPU 積んでる PC なら桁違いに速く生成できるんですけどね！  
（ラズパイで動かすというのをやってみたかっただけ）

## 参考文献

* [straczowski/raspberry-pi-stable-diffusion: How to run Stable Diffusion on Raspberry Pi 4](https://github.com/straczowski/raspberry-pi-stable-diffusion)
* [Start Locally | PyTorch](https://pytorch.org/get-started/locally/)
