---
title: "ラズパイでK3sクラスター構築"
date: "2023-06-13"
tags: ["Kubernetes", "K3s", "Raspberry Pi"]
---

今まで kubeadm でクラスター運用をしていたのですが、ラズパイくんたちのお引越しの関係で再構築することにしました。Raspberry Pi 4B 2GB や 3A+（RAM 512MB）も join させたかったこともあり、エッジ環境での動作も想定されている [K3s](https://k3s.io/) を選びました。

## 環境

* Raspberry Pi 4B 8GB x 2, Raspberry Pi 4B 4GB x 1, Raspberry Pi 4B 2GB x 1
  * SSD ブート
  * PoE+ 電源
  * 有線 LAN
  * ARM 64
  * Ubuntu 22.04 LTS
* Raspberry Pi 3A+ x 2
  * SD カードブート
  * 5V 3A 電源
  * 無線 LAN
  * ARM 64
  * Ubuntu 22.04 LTS

## Kubernetes 構成

* コントロールプレーン（server）3台、ワーカー（agent）3台
  * K3s に埋め込まれている etcd を使う高可用性（HA）構成
    * etcd のリーダーエレクションのアルゴリズム的に3台以上の奇数台である必要があります
  * 2GB x 1, 4GB x 1, 8GB x 1 の3台がコントロールプレーンのロールを担います
  * 2GB マシンにワークロードをスケジューリング可能にすると重くなるので taint をつけます
* `--flannel-backend=vxlan`
  * デフォルト値です
  * ラズパイではカーネルモジュールのインストールが必要です（後述）

## server/agent 共通手順

### OS を焼く

[Raspberry Pi Imager](https://www.raspberrypi.com/software/) 等でブートディスクを作成します。焼き終わったら、初回起動の前にそのディスクを PC にマウントしていくつかの設定ファイルを入れ込みます（すでに起動している場合は直接 /boot/firmware 配下に入れても良い）。

cmdline.txt に `cgroup_memory=1 cgroup_enable=memory` を追記します。Ubuntu 22.04 の場合は以下のようになります。

```
console=serial0,115200 dwc_otg.lpm_enable=0 console=tty1 root=LABEL=writable rootfstype=ext4 rootwait fixrtc quiet splash cgroup_enable=memory cgroup_memory=1
```

ブートディスクを差して電源を入れます。

ホスト名の重複は NG なので、各マシンの中で被らないように設定します。

```
sudo hostnamectl set-hostname xxx
```

ラズパイで vxlan を使用するにはカーネルモジュールのインストールが必要なので、起動後以下のコマンドを実行します。

```
sudo apt update
sudo apt install -y linux-modules-extra-raspi
sudo reboot
```

これで準備は OK です。ちなみにホスト名の設定と apt install の手順は cloud-init で自動化することも可能です。  
自動化するには user-data ファイルに下記を記載します。linux-modules-extra-raspi のインストール後、カーネルモジュールを使用するには一度再起動が要りますのでそこは適宜実施してください（試してないけど runcmd に書けばいける？）。

```yaml
# Package Update Upgrade Install
# https://cloudinit.readthedocs.io/en/latest/topics/modules.html#package-update-upgrade-install
packages:
- linux-modules-extra-raspi
package_update: true
package_upgrade: false

# Update Hostname
# https://cloudinit.readthedocs.io/en/latest/topics/modules.html#update-hostname
fqdn: xxx
```

## server 構築

### 1台目

HA 構成でメインとなるコントロールプレーンを初期化します。`--cluster-init` フラグを付けると etcd クラスターが有効になります。

`K3S_KUBECONFIG_MODE` 環境変数を設定しておくと `/etc/rancher/k3s/k3s.yaml` に書き出される kubeconfig のパーミッションが変わります。

```
curl -sfL https://get.k3s.io | K3S_KUBECONFIG_MODE="644" sh -s - server --cluster-init
```

### vxlan 有効化

`ExecStartPre=-/sbin/modprobe vxlan` を `/etc/systemd/system/k3s.service` に追記しておきます。これは agent 含め全ノードで実施してください。

```diff
[Unit]
Description=Lightweight Kubernetes
Documentation=https://k3s.io
Wants=network-online.target
After=network-online.target

[Install]
WantedBy=multi-user.target

[Service]
Type=notify
EnvironmentFile=-/etc/default/%N
EnvironmentFile=-/etc/sysconfig/%N
EnvironmentFile=-/etc/systemd/system/k3s.service.env
KillMode=process
Delegate=yes
# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
TimeoutStartSec=0
Restart=always
RestartSec=5s
ExecStartPre=/bin/sh -xc '! /usr/bin/systemctl is-enabled --quiet nm-cloud-setup.service'
ExecStartPre=-/sbin/modprobe br_netfilter
ExecStartPre=-/sbin/modprobe overlay
+ExecStartPre=-/sbin/modprobe vxlan
ExecStart=/usr/local/bin/k3s \
    server \
    --cluster-init
```

```
sudo systemctl daemon-reload
sudo systemctl restart k3s
```

### K3s トークンの確認

K3s トークンを確認します。このトークンは他の server や agent を join させる際に使います。

```
sudo cat /var/lib/rancher/k3s/server/node-token
```

### 2台目以降

```
curl -sfL https://get.k3s.io | K3S_TOKEN=mynodetoken sh -s - server --server https://<ip or hostname of server>:6443
```

完了したら vxlan の有効化もしておきます。

## agent 構築

K3S_URL 環境変数を設定することで、インストールスクリプトが agent を設定するモードで動作します。

```
curl -sfL https://get.k3s.io | K3S_URL=https://<ip or hostname of server>:6443 K3S_TOKEN=mynodetoken sh -
```

`/etc/systemd/system/k3s-agent.service` を修正して `ExecStartPre=-/sbin/modprobe vxlan` を追記しておきます。

```
sudo systemctl daemon-reload
sudo systemctl restart k3s-agent
```

## 参考文献

* [Requirements | K3s](https://docs.k3s.io/installation/requirements)
* [Advanced Options / Configuration | K3s](https://docs.k3s.io/advanced#raspberry-pi)
* [High Availability Embedded etcd | K3s](https://docs.k3s.io/datastore/ha-embedded)
