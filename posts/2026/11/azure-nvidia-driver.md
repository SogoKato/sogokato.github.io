---
title: "AzureのGPU VMでNVIDIAドライバがカーネル更新後に消えない入れ方を実機検証"
date: "2026-11-12"
tags: ["Azure", "GPU", "Ubuntu"]
---

Azure の GPU VM（[NCasT4_v3 シリーズ](https://learn.microsoft.com/ja-jp/azure/virtual-machines/sizes/gpu-accelerated/ncast4v3-series?tabs=sizebasic)、Tesla T4）に、NVIDIA ドライバを runfile（`NVIDIA-Linux-x86_64-*.run`）で入れて使っていました。用途は CUDA だけで、アプリはコンテナで動かしています。

入れた直後は問題なく動いていたのですが、しばらく経つと `nvidia-smi` がドライバと通信できなくなっていて、ドライバを入れ直すことになりました。

調べてみると、カーネルが更新されると runfile で入れたカーネルモジュールが新しいカーネルに存在しなくなること、DKMS を使えば防げるらしいことがわかりました。ただ、本当にそうなのかは自分の目で確かめてみたくなったので、なるべく小さい構成とコストで比べてみました。

## 結論

やや古い Ubuntu のイメージから VM を作り、ドライバを入れてからカーネルを 6.17 から 7.0 に上げて再起動しました。

| 入れ方                                    | ドライバ   | 入れた直後                                           | カーネル更新・再起動後 |
| ----------------------------------------- | ---------- | ---------------------------------------------------- | ---------------------- |
| runfile（DKMS なし）                      | 580.196.07 | 動く                                                 | 動かない               |
| runfile（`--dkms`）                       | 580.196.07 | 動く                                                 | 動く                   |
| apt（Ubuntu の `nvidia-driver-580-open`） | 580.178.04 | 動く                                                 | 動く                   |
| apt（Ubuntu のビルド済みモジュール）      | 580.178.04 | 動かない（7.0 用のモジュールが入るので再起動が必要） | 動く                   |

DKMS なしの runfile では再現し、DKMS を使う2つの方法では、カーネル更新のときに新しいカーネル用のモジュールが自動でビルドされて、再起動後もそのまま動きました。

Ubuntu のビルド済みモジュールは DKMS を使いません。入れた時点で最新のカーネルが一緒に入り、再起動後に動きました。古いカーネルのままでは入れられませんでした。

## なぜ消えるのか

カーネルモジュールは `/lib/modules/<カーネルの版数>/` の下に、カーネルのバージョンごとに置かれます。NVIDIA のカーネルモジュールも、使うカーネルに合わせてビルドする必要があります。

runfile は、インストールしたときに動いているカーネル用のモジュールだけをビルドして置きます。そのあと自動更新などでカーネルが更新されて再起動すると、新しいカーネルの `/lib/modules/` にはモジュールがないので、ドライバが読み込まれません。

DKMS は、モジュールのソースを登録しておき、カーネルが入るたびにビルドし直す仕組みです。ドライバに同梱の README にも、DKMS に登録しておけば、カーネルを入れたときに自動でモジュールがビルドし直されると書いてあります[^1]。同じ README の「I just upgraded my kernel, and now the NVIDIA kernel module will not load.」という項目では、カーネルを上げたらドライバを入れ直すのがいちばん簡単だ、とされています。

## 検証の方針

4つの入れ方を比べます。

* runfile を `--silent` で実行する（dkms パッケージは入れない）。今までのやり方です
* dkms パッケージを入れてから、runfile を `--silent --dkms` で実行する
* Ubuntu の標準リポジトリの `nvidia-driver-580-open` を apt で入れる
* Ubuntu の標準リポジトリのビルド済みモジュール（`linux-modules-nvidia-580-open-azure`）を apt で入れる

同じ古いイメージから VM を作り直して、それぞれで「ドライバを入れる → カーネルを更新して再起動する → 確認する」を行いました。  
古いイメージを使えば、`apt-get dist-upgrade` で新しいカーネルが入ります。勝手に更新されないように、cloud-init で自動更新を止めておきました。

<details>
<summary>cloud-init.yaml</summary>

```yaml:cloud-init.yaml
#cloud-config
package_update: false
package_upgrade: false
write_files:
  - path: /etc/apt/apt.conf.d/99-no-auto-upgrade
    content: |
      APT::Periodic::Update-Package-Lists "0";
      APT::Periodic::Unattended-Upgrade "0";
  # VM から Azure の DNS（168.63.129.16）で名前解決できなかったので入れた回避策です。原因は不明
  - path: /etc/systemd/resolved.conf.d/public-dns.conf
    content: |
      [Resolve]
      DNS=1.1.1.1 8.8.8.8
      Domains=~.
runcmd:
  - systemctl disable --now unattended-upgrades apt-daily.timer apt-daily-upgrade.timer
  - systemctl restart systemd-resolved
```

</details>

## なるべく安く済ませる

検証には、T4 を積んだいちばん小さいサイズの Standard_NC4as_T4_v3（4 vCPU）を、Spot で使いました。eastus2 での単価は、従量課金が 0.526 USD/時、Spot が 0.303 USD/時です。  
VM が動いていた時間は4台の合計で約46分、VM の費用は 0.303 USD/時 × 約46分で、およそ 0.23 USD の見積もりです。

Spot のクォータが初期状態では 3 vCPU しかなく、NC4as_T4_v3 は 4 vCPU なので、1 vCPU 足りませんでした。Spot の枠を 4 にする申請をポータルから出したところ、サポートリクエスト起票後12分ほどで承認されました。

<details>
<summary>VM の作成</summary>

```sh
az vm create -g rg-gpu-driver-test -n "$n" -l eastus2 --zone 1 \
  --image Canonical:ubuntu-24_04-lts:server:24.04.202608270 \
  --size Standard_NC4as_T4_v3 --priority Spot --eviction-policy Delete --max-price -1 \
  --security-type TrustedLaunch --enable-secure-boot false --enable-vtpm true \
  --admin-username azureuser --ssh-key-values keys/id_ed25519.pub \
  --custom-data cloud-init.yaml \
  --public-ip-sku Standard --os-disk-delete-option Delete --nic-delete-option Delete
```

`--security-type Standard` は機能の登録（`Microsoft.Compute/UseStandardSecurityType`）が必要で使えませんでした。Trusted Launch のまま、Secure Boot だけ無効にしました。

</details>

## 環境

* リージョン: eastus2（ゾーン1）
* VM: Standard_NC4as_T4_v3（Spot）、Tesla T4 16GB
* イメージ: `Canonical:ubuntu-24_04-lts:server:24.04.202608270`（Ubuntu 24.04.4 LTS）
* カーネル: `6.17.0-1022-azure` から `7.0.0-1017-azure` に更新
* Trusted Launch、Secure Boot 無効、vTPM 有効

カーネルの更新は、4台とも次のコマンドで行いました。更新されたパッケージは161個です（ビルド済みモジュールの VM では、カーネルが先に入っていたので158個）。

```sh
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a \
  apt-get -y -o Dpkg::Options::=--force-confold dist-upgrade
sudo systemctl reboot
```

## runfile（DKMS なし）

今までと同じやり方です。

```sh
V=580.196.07
wget -q https://download.nvidia.com/XFree86/Linux-x86_64/$V/NVIDIA-Linux-x86_64-$V.run
sudo apt-get install -y build-essential
sudo sh NVIDIA-Linux-x86_64-$V.run --silent
```

入れた直後は `nvidia-smi` が通りました。モジュールは、動いているカーネルの `kernel/drivers/video/` に置かれています。

```
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia-drm.ko
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia-modeset.ko
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia-peermem.ko
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia-uvm.ko
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia.ko
```

T4 でも、既定でオープンカーネルモジュール（`NVIDIA UNIX Open Kernel Module`）が入りました。

カーネルを更新したあとも、NVIDIA のモジュールは 6.17 の側にしかありません。7.0 の側にあるのは、カーネルに同梱されている別のモジュールです。

```
/lib/modules/6.17.0-1022-azure/kernel/drivers/video/nvidia.ko
...
/lib/modules/7.0.0-1017-azure/kernel/drivers/platform/x86/nvidia-wmi-ec-backlight.ko.zst
/lib/modules/7.0.0-1017-azure/kernel/drivers/video/fbdev/nvidia/nvidiafb.ko.zst
```

再起動すると、`nvidia-smi` が失敗しました。

```
$ uname -r
7.0.0-1017-azure
$ nvidia-smi
NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver. Make sure that the latest NVIDIA driver is installed and running.
$ sudo modprobe nvidia
modprobe: FATAL: Module nvidia not found in directory /lib/modules/7.0.0-1017-azure
$ lspci -k -d 10de:
0001:00:00.0 3D controller: NVIDIA Corporation TU104GL [Tesla T4] (rev a1)
	Subsystem: NVIDIA Corporation TU104GL [Tesla T4]
	Kernel modules: nvidiafb
```

`lspci -k` に `Kernel driver in use` の行がなく、GPU にドライバが付いていないことがわかります。

## runfile（`--dkms`）

dkms パッケージを先に入れて、`--dkms` を付けて実行します。

```sh
sudo apt-get update
sudo apt-get install -y build-essential dkms
V=580.196.07
wget -q https://download.nvidia.com/XFree86/Linux-x86_64/$V/NVIDIA-Linux-x86_64-$V.run
sudo sh NVIDIA-Linux-x86_64-$V.run --silent --dkms
```

`/var/log/nvidia-installer.log` を見ると、DKMS に登録されています。

```
-> Would you like to register the kernel module sources with DKMS? This will allow DKMS to automatically build a new module, if your kernel changes later. (Answer: Yes)
-> Registering the kernel modules with DKMS:
```

モジュールの置き場所は `updates/dkms/` に変わりました。

```
$ dkms status
nvidia/580.196.07, 6.17.0-1022-azure, x86_64: installed
$ find /lib/modules -name 'nvidia.ko*'
/lib/modules/6.17.0-1022-azure/updates/dkms/nvidia.ko
```

カーネルを更新すると、カーネルのヘッダーのパッケージが入ったところで DKMS が動き、7.0 用のモジュールをビルドしていました。apt のログの抜粋です。

```
/etc/kernel/header_postinst.d/dkms:
 * dkms: running auto installation service for kernel 7.0.0-1017-azure
...
   - Installing to /lib/modules/7.0.0-1017-azure/updates/dkms/
...
dkms autoinstall on 7.0.0-1017-azure/x86_64 succeeded for nvidia
```

再起動する前の時点で、`dkms status` に 7.0 の行が出ています。再起動の前に、ビルドがうまくいったかを確かめられるのは便利です。

```
$ dkms status
nvidia/580.196.07, 6.17.0-1022-azure, x86_64: installed
nvidia/580.196.07, 7.0.0-1017-azure, x86_64: installed
```

`dist-upgrade` にかかった時間は3分10秒で、DKMS なしのとき（2分8秒）より1分ほど長くなりました。ビルドの分です。

再起動すると、起動から3秒ほどでドライバが読み込まれ、何もしなくても `nvidia-smi` が通りました。

```
$ uname -r
7.0.0-1017-azure
$ nvidia-smi --query-gpu=name,driver_version --format=csv
name, driver_version
Tesla T4, 580.196.07
$ lspci -k -d 10de:
...
	Kernel driver in use: nvidia
	Kernel modules: nvidiafb, nvidia_drm, nvidia
```

## apt（Ubuntu の `nvidia-driver-580-open`）

```sh
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y nvidia-driver-580-open
```

`dkms` と `nvidia-dkms-580-open` が依存関係で入るので、`build-essential` などを先に入れておく必要はありませんでした。入った版は 580.178.04 で、runfile の最新（580.196.07）より1つ前です。

runfile と違って、入れた直後はモジュールがビルドされているだけで、読み込まれていませんでした。`modprobe` で読み込んだ直後の `nvidia-smi` は1回失敗し、3分ほどあとにもう一度実行すると通りました。初期化が終わる前に実行したからだと思っていますが、原因は確かめていません。apt で入れたあとは再起動しておくのが無難そうです。

カーネルの更新では、`--dkms` の runfile と同じように DKMS が7.0 用のモジュールをビルドし、再起動後も `nvidia-smi` が通りました。`dist-upgrade` でドライバのパッケージ自体は更新されず、580.178.04 のままでした。

```
$ dkms status
nvidia/580.178.04, 6.17.0-1022-azure, x86_64: installed
nvidia/580.178.04, 7.0.0-1017-azure, x86_64: installed
$ nvidia-smi --query-gpu=name,driver_version --format=csv
name, driver_version
Tesla T4, 580.178.04
```

## apt（Ubuntu のビルド済みモジュール）

Ubuntu の標準リポジトリには、Canonical がカーネルのバージョンごとにビルドして署名した NVIDIA のモジュールもあります。これを使うと、DKMS もコンパイラも要りません。[Ubuntu Server のドキュメント](https://ubuntu.com/server/docs/how-to/graphics/install-nvidia-drivers/) も、DKMS よりこちらを勧めています。

入れるのは次の3つです。

* `linux-modules-nvidia-580-open-azure`: Azure 用カーネルの最新版に対応するモジュールを指すメタパッケージ
* `nvidia-headless-no-dkms-580-open`: DKMS に依存しないユーザー空間側のパッケージ
* `nvidia-utils-580`: `nvidia-smi` など

```sh
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y \
  linux-modules-nvidia-580-open-azure nvidia-headless-no-dkms-580-open nvidia-utils-580
```

### 古いカーネルのままでは入れられない

ほかの3つと同じように、まず 6.17 のカーネルで動かそうとしましたが、できませんでした。動いているカーネル用のモジュール（`linux-modules-nvidia-580-open-6.17.0-1022-azure`）は 580.173.02 に合わせてビルドされていて、リポジトリにあるユーザー空間側は 580.178.04 だけだからです。

```
$ apt-get install -s linux-modules-nvidia-580-open-6.17.0-1022-azure nvidia-headless-no-dkms-580-open nvidia-utils-580
The following packages have unmet dependencies:
 linux-modules-nvidia-580-open-6.17.0-1022-azure : Depends: nvidia-kernel-common-580 (<= 580.173.02-1) but 580.178.04-0ubuntu0.24.04.1 is to be installed
E: Unable to correct problems, you have held broken packages.
```

今回実験のために意図的に古い Linux カーネルにしているために遭遇しましたが、手順通りにやるなら先に Linux カーネルの更新をして、その時々の最新版に対応するモジュールが入るので通常使用に問題はないはずです。

### 入れるとカーネルも一緒に入る

メタパッケージのほうは、最新のカーネル用のモジュールに依存していて、そのモジュールがカーネル本体に依存しています。そのため、ドライバを入れると 7.0 のカーネルも一緒に入りました。

```
The following NEW packages will be installed:
  libnvidia-cfg1-580 libnvidia-compute-580 libpciaccess0
  linux-image-7.0.0-1017-azure linux-modules-7.0.0-1017-azure
  linux-modules-nvidia-580-open-7.0.0-1017-azure
  linux-modules-nvidia-580-open-azure nvidia-compute-utils-580
  nvidia-firmware-580-580.178.04 nvidia-headless-no-dkms-580-open
  nvidia-kernel-common-580 nvidia-kernel-source-580-open nvidia-utils-580
  ocl-icd-libopencl1
0 upgraded, 14 newly installed, 0 to remove and 161 not upgraded.
```

入ったのは14個で、51秒で終わりました。`dkms` も `gcc` も入っていません。

```
$ which dkms gcc
(exit 1)
```

モジュールは 7.0 の側にだけ置かれます。場所は `kernel/nvidia-580-open/` です。

```
/lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia-drm.ko
/lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia-modeset.ko
/lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia-peermem.ko
/lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia-uvm.ko
/lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia.ko
```

この時点で動いているのは 6.17 なので、再起動するまで `nvidia-smi` は通りません。

```
$ uname -r
6.17.0-1022-azure
$ nvidia-smi
NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver. Make sure that the latest NVIDIA driver is installed and running.
$ sudo modprobe nvidia
modprobe: FATAL: Module nvidia not found in directory /lib/modules/6.17.0-1022-azure
```

### 残りを更新して再起動する

ほかの3つと同じ `dist-upgrade` を実行しました。カーネル本体は先に入っているので、更新されたのは158個、新しく入ったのは9個です。かかった時間は2分8秒で、ログに DKMS の行はありません。

モジュールには Canonical の署名が付いています。

```
$ modinfo -k 7.0.0-1017-azure nvidia
filename:       /lib/modules/7.0.0-1017-azure/kernel/nvidia-580-open/nvidia.ko
version:        580.178.04
license:        Dual MIT/GPL
vermagic:       7.0.0-1017-azure SMP preempt mod_unload modversions
signer:         Canonical Ltd. Kernel Module Signing
sig_key:        E9:DF:13:0F:92:92:A9:B7
sig_hashalgo:   sha512
```

再起動すると、起動から3秒ほどでドライバが読み込まれ、`nvidia-smi` が通りました。

```
$ uname -r
7.0.0-1017-azure
$ nvidia-smi --query-gpu=name,driver_version --format=csv
name, driver_version
Tesla T4, 580.178.04
$ lspci -k -d 10de:
0001:00:00.0 3D controller: NVIDIA Corporation TU104GL [Tesla T4] (rev a1)
	Subsystem: NVIDIA Corporation TU104GL [Tesla T4]
	Kernel driver in use: nvidia
	Kernel modules: nvidiafb, nvidia_drm, nvidia
```

### ほかの3つと違うところ

この方法では「古いカーネルで動かしてから、カーネルを更新する」という順番にできませんでした。確かめられたのは、次の2点です。

* メタパッケージを入れると、最新のカーネルと、それに合うモジュールが一緒に入る
* そのカーネルで起動すると、ビルドなしでドライバが動く

メタパッケージが次のカーネルに追従するところは、検証した時点で 7.0.0-1017 より新しいカーネルがなかったので、見られていません。依存関係のうえでは、メタパッケージが更新されると新しいカーネル用のモジュールとカーネル本体が一緒に入るはずです。

## 比べる

|                               | runfile（DKMS なし）    | runfile（`--dkms`）       | apt（DKMS）            | apt（ビルド済み）                          |
| ----------------------------- | ----------------------- | ------------------------- | ---------------------- | ------------------------------------------ |
| 先に入れるもの                | `build-essential`       | `build-essential`, `dkms` | なし（依存関係で入る） | なし（コンパイラも DKMS も入らない）       |
| 入れた直後のモジュール        | 読み込まれる            | 読み込まれる              | 読み込まれない         | 読み込まれない（最新カーネル用だけが入る） |
| モジュールの場所              | `kernel/drivers/video/` | `updates/dkms/`           | `updates/dkms/`        | `kernel/nvidia-580-open/`                  |
| `dist-upgrade` にかかった時間 | 2分8秒                  | 3分10秒                   | 2分58秒                | 2分8秒（カーネル本体は導入時に入っている） |
| 更新中の DKMS                 | なし                    | 7.0 用をビルド            | 7.0 用をビルド         | なし                                       |
| 再起動後の `nvidia-smi`       | 失敗                    | 成功                      | 成功                   | 成功                                       |

元々私が導入した際の手順からの変更がいちばん小さいのは、dkms を入れて `--dkms` を付けるだけの runfile です。版も自分で選べます。apt はドライバ自体もパッケージ管理に乗りますが、版は Ubuntu のリポジトリ次第です。

DKMS を使う2つは、DKMS のビルドが通ることと、新しいカーネルのヘッダーが入ることが前提です。今回は `linux-azure` の更新で `linux-headers-azure` も一緒に入りました。新しいカーネルでビルドに失敗した場合は、DKMS なしと同じ症状になるはずです（今回は起きていないので試せていません）。

ビルド済みのモジュールは VM の中でビルドしないので、ビルドの失敗は起きません。その代わり、カーネルの版とドライバの版の組み合わせが決まっていて、新しいカーネル用のモジュールのパッケージが Ubuntu から出ていることが前提になります。

なお、カーネルは 6.17 から 7.0 にメジャーバージョンが上がりましたが、580 系のドライバのまま問題なくビルドできました。README には、メジャーなカーネル更新では新しいドライバが必要になることがある、とも書かれています[^1]。

## 公式のドキュメントではどうなっているか

Microsoft の [N シリーズ VM の NVIDIA ドライバの導入](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/n-series-driver-setup) のページは、CUDA ドライバについては NVIDIA のサイトへのリンクがあるだけで、手順は書かれていません。DKMS やカーネル更新への言及もありませんでした。

リンクをたどった先の NVIDIA Driver Installation Guide は、[Choose an Installation Method](https://docs.nvidia.com/datacenter/tesla/driver-installation-guide/latest/choose-an-installation-method.html) のページで、可能ならディストリビューション向けのパッケージを使うよう勧めています。

> It is recommended to use the distribution-specific packages, where possible.

ここで言うパッケージは、NVIDIA が自社の apt リポジトリで配っている `nvidia-open` などのことで、今回試した Ubuntu の標準リポジトリのものとは配布元が違います。Ubuntu では、[Ubuntu の Installation の節](https://docs.nvidia.com/datacenter/tesla/driver-installation-guide/latest/ubuntu.html#ubuntu-installation) にある、`cuda-keyring` でリポジトリを追加して `apt install nvidia-open` で入れる手順になります。ドキュメントをたどると行き着くのはこの方法ですが、今回は試していません。runfile の手順はこのガイドにはなく、ドライバに同梱の README にあります。

## 試せていないこと

* Secure Boot を有効にした VM
  * DKMS でビルドしたモジュールは Canonical の鍵で署名されていないので、自分の鍵を登録しないと読み込まれない可能性があります
  * ビルド済みのモジュールには Canonical の署名が付いていました（`signer: Canonical Ltd. Kernel Module Signing`）。Secure Boot を有効にした VM で読み込めるかは試していません
* ビルド済みモジュールの、次のカーネル更新やドライバ更新への追従
  * 検証した時点で最新のカーネルが入ったので、その次の更新は見られていません。ドライバの新しい版が出たときの更新も同じです
  * カーネルとモジュールのパッケージが同時に公開されないと、モジュールのないカーネルで起動する可能性があります。実際に起きるかは確かめていません
  * 2026年11月11日の時点で、Ubuntu 24.04 のアーカイブにある Azure 用カーネル31版のすべてに、ビルド済みのモジュールのパッケージがありました
* NVIDIA の apt リポジトリの `nvidia-open`

## おわりに

DKMS なしの runfile では、カーネルが更新されるとドライバが使えなくなることを再現できました。dkms を入れて `--dkms` を付ければ、カーネル更新のときにモジュールが自動でビルドし直されて、再起動後もそのまま動きました。

Ubuntu のビルド済みモジュールを使えば、VM の中でビルドすることなく、カーネルとモジュールを一緒に入れられました。

## 参考文献

* [Azure N-series GPU driver setup for Linux - Azure Virtual Machines | Microsoft Learn](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/n-series-driver-setup)
* [NVIDIA Driver Installation Guide](https://docs.nvidia.com/datacenter/tesla/driver-installation-guide/latest/index.html)
* [NVIDIA Accelerated Linux Graphics Driver README and Installation Guide（580.196.07）](https://download.nvidia.com/XFree86/Linux-x86_64/580.196.07/README/)
* [NVIDIA drivers installation - Ubuntu Server documentation](https://ubuntu.com/server/docs/how-to/graphics/install-nvidia-drivers/)
* [Ubuntu 22.04以降でシステムをアップデートしてもトラブらないNVIDIAドライバとCUDA Toolkitのセットアップ【2026年5月版】 - K-Lab](https://www.nemotos.net/?p=5792)

[^1]: [NVIDIA Accelerated Linux Graphics Driver README](https://download.nvidia.com/XFree86/Linux-x86_64/580.196.07/README/) の4章「Registering the NVIDIA Kernel Module with DKMS」と、8章「Common Problems」
