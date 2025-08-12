---
title: "個人的Ubuntu24.04 Serverセットアップメモ"
date: "2025-08-13"
tags: ["Ubuntu", "開発環境", "VS Code", "GPU", "K3s", "自宅サーバー"]
---

前回 [個人的Ubuntu24.04 Desktopセットアップメモ](/posts/2025/06/setup-ubuntu-desktop) を書きましたが、結局 Ubuntu Server に切り替えたのでその時のメモ。

## 環境

* Ubuntu 24.04 Server
* Ryzen 7 3700X
* メモリ 32GB
* NVIDIA GeForce RTX 2070

## なんで Server 版にしたのか

ローカル LLM とかを動かすサーバとして運用したくなった。Desktop 版のままでも良いかもとは思ったが、RDP 切断時に常時起動するはずの（ユーザ権限で動いている）systemd service が止まっちゃったり若干不安要素があったのと、GUI 環境は MacBook でいいやってことで、サーバ用途専用にしようと決めた。

## やったこと

### SSH 設定

いつもの。

内容としては [cloud-init で実施する SSH サーバー設定まとめ #Ubuntu - Qiita](https://qiita.com/SogoK/items/75f1ebbb636869d5fc82) に書いた内容と同じ。今回は手でやったけど。

* `ssh-import-id`: Server の初期起動時に聞かれたのでそこでやった
* パスワード認証の禁止
* root ログインを禁止
* SSH のポート変更

### Nvidia ドライバ導入

nouveau と nvidiafb を無効化して nvidia ドライバを導入。

```sh
echo "blacklist nouveau" | sudo tee /etc/modprobe.d/blacklist-nouveau.conf
echo "options nouveau modeset=0" | sudo tee -a /etc/modprobe.d/blacklist-nouveau.conf
echo "blacklist nvidiafb" | sudo tee /etc/modprobe.d/blacklist-nvidiafb.conf
sudo update-initramfs -u

ubuntu-drivers devices
sudo apt update
sudo apt install nvidia-driver-575
```

### 画面オフの時間の設定

`/etc/default/grub` を編集して、画面オフまでの時間を10分に設定。

```
GRUB_CMDLINE_LINUX_DEFAULT="consoleblank=600"
```

```sh
sudo update-grub
sudo reboot

cat /sys/module/kernel/parameters/consoleblank
```

### LVM の拡張

Ubuntu Server のセットアップウィザードに従ってインストールした直後の状態だと LVM の論理ボリュームが 100 GB になっている。100 GB では少なすぎるのでいったん 200 GB にして、様子を見る。

```sh
sudo lvextend -L 200G /dev/ubuntu-vg/ubuntu-lv
```

```
  Size of logical volume ubuntu-vg/ubuntu-lv changed from 100.00 GiB (25600 extents) to 200.00 GiB (51200 extents).
  Logical volume ubuntu-vg/ubuntu-lv successfully resized.
```

```sh
sudo resize2fs /dev/ubuntu-vg/ubuntu-lv
```

```
resize2fs 1.47.0 (5-Feb-2023)
Filesystem at /dev/ubuntu-vg/ubuntu-lv is mounted on /; on-line resizing required
old_desc_blocks = 13, new_desc_blocks = 25
The filesystem on /dev/ubuntu-vg/ubuntu-lv is now 52428800 (4k) blocks long.
```

### Nvidia Container Toolkit 導入

[Installing the NVIDIA Container Toolkit — NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-apt-ubuntu-debian)

```sh
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
```

```sh
sudo apt update
```

```sh
export NVIDIA_CONTAINER_TOOLKIT_VERSION=1.17.8-1
  sudo apt install -y \
      nvidia-container-toolkit=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      nvidia-container-toolkit-base=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      libnvidia-container-tools=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      libnvidia-container1=${NVIDIA_CONTAINER_TOOLKIT_VERSION}
```

### K3s の設定

ラズパイで k3s で Kubernetes クラスタを組んでいるので、agent ノードとして参加させた。手順は [ラズパイでK3sクラスター構築【24.04対応】](/posts/2023/06/k3s-setup) に書いてある内容とほぼ同じ。

[高度なオプション / 設定 | K3s](https://docs.k3s.io/ja/advanced#nvidia%E3%82%B3%E3%83%B3%E3%83%86%E3%83%8A%E3%83%A9%E3%83%B3%E3%82%BF%E3%82%A4%E3%83%A0%E3%81%AE%E3%82%B5%E3%83%9D%E3%83%BC%E3%83%88)

Nvidia Container Runtime が認識されているかを確認しておく。

```sh
# k3sインストール後にNvidia Container Toolkitを入れた場合は再起動する
# sudo systemctl restart k3s-agent
sudo grep nvidia /var/lib/rancher/k3s/agent/etc/containerd/config.toml
```

次のように出力されれば大丈夫なはず（Nvidia Container Toolkitを入れる前は何も出なかった）。

```
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.'nvidia']
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.'nvidia'.options]
  BinaryName = "/usr/bin/nvidia-container-runtime"
```

### Docker

本番環境用のワークロードとしての K3s とは別に、検証用途でコンテナをぽんと立てたい時は多々ある。
いつも通り [Ubuntu | Docker Docs](https://docs.docker.com/engine/install/ubuntu/) に従ってインストール。

```sh
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
```

```sh
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

```sh
sudo usermod -aG docker $USER
```

### ツール系

* [Homebrew](https://brew.sh/ja/)
* [Volta](https://volta.sh/)
* [Node.js](https://nodejs.org/ja) 24
* [pnpm](https://pnpm.io/)
* [ghq](https://github.com/x-motemen/ghq)
* [pipx](https://pipx.pypa.io/latest/)
* [uv](https://docs.astral.sh/uv/)
* [poetry](https://python-poetry.org/)
* [VS Code](https://code.visualstudio.com/)
* [act](https://nektosact.com/)
* [mkcert](https://github.com/FiloSottile/mkcert)
* [Gemini CLI](https://github.com/google-gemini/gemini-cli)
* [Claude Code](https://docs.anthropic.com/ja/docs/claude-code/overview)

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo >> /home/$USER/.bashrc
echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> /home/$USER/.bashrc
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

```sh
brew install volta
volta install node@24

# nodeのパスが通っていなかったのでvolta setupしてターミナルを一回閉じる
# volta setup
# exit
```

```sh
node -v
volta install corepack
corepack enable pnpm
pnpm -v
```

```sh
brew install ghq
echo 'export GHQ_ROOT=~/projects' >> /home/$USER/.bashrc
```

```sh
brew install pipx
brew install uv
pipx install poetry
```

[Visual Studio Code on Linux](https://code.visualstudio.com/docs/setup/linux)

```sh
wget --content-disposition https://go.microsoft.com/fwlink/?LinkID=760868
sudo apt install ./<file>.deb
```

Remote tunnels の設定

```sh
code tunnel service install
sudo loginctl enable-linger $USER
```

GitHub Actions をローカルで実行する

```sh
brew install act
```

開発環境用のオレオレ証明書発行するやつ

```sh
brew install mkcert

# ルート証明書の発行
mkcert -install
```

AI 系

```sh
brew install gemini-cli
brew install --cask claude-code
```

## おわりに

ローカル LLM サーバ構築は別記事にまとめます。
