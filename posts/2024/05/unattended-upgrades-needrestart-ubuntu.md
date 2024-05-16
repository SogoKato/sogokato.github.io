---
title: "Unattended upgrades + needrestartで安全な自動アップグレードを考える"
date: "2024-05-16"
tags: ["Debian", "Ubuntu", "APT"]
---

[前回](/posts/2024/05/unattended-upgrades)は Unattended upgrades のドキュメントを読みました。今回は実際のサーバーで自動アップグレードを適用するように設定していくために気になるところを解消していきたいと思います。

以下の状況を想定します。

* セキュリティパッチの適用が目的
* Docker が動作するサーバーである
  * なので……
    * Docker のバージョンは固定したい
    * Docker コンテナは止めたくない
* 何かあった時のためにログは残したい

## 考えること

* 自動更新の対象を決める
* 再起動（reboot）を制御する
* デーモン再始動（systemctl service の restart）を制御する
* 古い conffile を維持するようにする
* ログのローテーションを制御する

### 環境

* Ubuntu 22.04
* needrestart 3.5

注意：まだ長期的に運用しているわけではないので今後設定内容を修正する可能性があります。

### 最終的にこうなった

`/etc/apt/apt.conf.d/20auto-upgrades`

```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

`/etc/apt/apt.conf.d/50unattended-upgrades`

```
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
};

Unattended-Upgrade::Automatic-Reboot "false";

Dpkg::Options {"--force-confold"};

Unattended-Upgrade::SyslogEnable true;
```

### 自動更新の対象を決める

前回訳したドキュメントによると

> デフォルトのセットアップでは、main アーカイブと security アーカイブ内のパッケージが自動更新されます。つまり、安定版とセキュリティの更新のみが適用されます。
>
> The default setup auto-updates packages in the main and security
archives, which means that only stable and security updates are
applied.

ということで、実際に `/etc/apt/apt.conf.d/50unattended-upgrades` を見るとそうなっていると思います。今回の想定ではセキュリティパッチを適用することが目的なので、`"${distro_id}:${distro_codename}-security";` だけを残します。[ESM](https://ubuntu.com/security/esm) は Ubuntu Pro のサブスクリプションを購入すると利用できるみたいです。

```
// Automatically upgrade packages from these (origin:archive) pairs
//
// Note that in Ubuntu security updates may pull in new dependencies
// from non-security sources (e.g. chromium). By allowing the release
// pocket these get automatically pulled in.
Unattended-Upgrade::Allowed-Origins {
        "${distro_id}:${distro_codename}";
        "${distro_id}:${distro_codename}-security";
        // Extended Security Maintenance; doesn't necessarily exist for
        // every release and this system may not have it installed, but if
        // available, the policy for updates is such that unattended-upgrades
        // should also install from here by default.
        "${distro_id}ESMApps:${distro_codename}-apps-security";
        "${distro_id}ESM:${distro_codename}-infra-security";
//      "${distro_id}:${distro_codename}-updates";
//      "${distro_id}:${distro_codename}-proposed";
//      "${distro_id}:${distro_codename}-backports";
};
```

また、docker に関しては別リポジトリ（download.docker.com）なのでうっかり更新されてしまうことはないです。

```sh
apt-cache policy docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

心配な場合は [apt_preferences](https://manpages.debian.org/testing/apt/apt_preferences.5.ja.html) でバージョンをピン止めしておくことも検討します。

### 再起動（reboot）を制御する

サーバーが再起動してしまうと当然 docker コンテナも止まってしまうので、再起動は自動で実施しないようにします。

`Unattended-Upgrade::Automatic-Reboot` はデフォルトで false になっています。

```
// Automatically reboot *WITHOUT CONFIRMATION* if
//  the file /var/run/reboot-required is found after the upgrade
//Unattended-Upgrade::Automatic-Reboot "false";
```

### デーモン再始動（systemctl service の restart）を制御する

Ubuntu 21.04 からは needrestart がプリインストールされています。パッケージを更新した時に systemctl service を再始動するか（Which services should be restarted?）聞いてくるアレです。

Docker や conrainerd が依存するライブラリが更新された場合、それらを再始動するように促されます。再始動はする必要があるのですがタイミングはコントロールしたいので、自動では再始動しないようにそれらを除外します。

`/etc/needrestart/needrestart.conf` に入っているデフォルト値を見てみます。

```
# Blacklist services (list of regex) - USE WITH CARE.
# You should prefer to put services to $nrconf{override_rc} instead.
# Any service listed in $nrconf{blacklist_rc} will be ignored completely!
#$nrconf{blacklist_rc} = [
#];

# Override service default selection (hash of regex).
$nrconf{override_rc} = {
    # DBus
    qr(^dbus) => 0,

    # display managers
    qr(^gdm) => 0,
    qr(^kdm) => 0,
    qr(^nodm) => 0,
    qr(^sddm) => 0,
    qr(^wdm) => 0,
    qr(^xdm) => 0,
    qr(^lightdm) => 0,
    qr(^slim) => 0,
    qr(^lxdm) => 0,

    # networking stuff
    qr(^bird) => 0,
    qr(^network) => 0,
    qr(^NetworkManager) => 0,
    qr(^ModemManager) => 0,
    qr(^wpa_supplicant) => 0,
    qr(^openvpn) => 0,
    qr(^quagga) => 0,
    qr(^frr) => 0,
    qr(^tinc) => 0,
    qr(^(open|free|libre|strong)swan) => 0,
    qr(^bluetooth) => 0,

    # gettys
    qr(^getty@.+\.service) => 0,

    # systemd --user
    qr(^user@\d+\.service) => 0,

    # misc
    qr(^zfs-fuse) => 0,
    qr(^mythtv-backend) => 0,
    qr(^xendomains) => 0,
    qr(^lxcfs) => 0,
    qr(^libvirt) => 0,
    qr(^virtlogd) => 0,
    qr(^virtlockd) => 0,
    qr(^docker) => 0,

    # systemd stuff
    # (see also Debian Bug#784238 & #784437)
    qr(^emergency\.service$) => 0,
    qr(^rescue\.service$) => 0,
    qr(^elogind) => 0,

    # do not restart oneshot services, see also #862840
    qr(^apt-daily\.service$) => 0,
    qr(^apt-daily-upgrade\.service$) => 0,
    qr(^unattended-upgrades\.service$) => 0,
    # do not restart oneshot services from systemd-cron, see also #917073
    qr(^cron-.*\.service$) => 0,

    # ignore rc-local.service, see #852864
    qr(^rc-local\.service$) => 0,

    # don't restart systemd-logind, see #798097
    qr(^systemd-logind) => 0,
};

# Override container default selection (hash of regex).
$nrconf{override_cont} = {
};
```

docker は既に除外されているので、今回のケースでは containerd を除外するように設定を追加します[^1]。

`/etc/needrestart/conf.d/99user.conf`

```
$nrconf{override_rc}{ qr(^containerd\.service$) } = 0;
```

確認してみます。

```sh
# いったん再始動待ちのデーモンがない状態にする
sudo reboot
# glibc を再インストールすることで /usr/lib/x86_64-linux-gnu/libc.so.6 に依存するデーモンが検知される
sudo apt install libc6 --reinstall
# 手動で確認するなら以下のコマンドを使用
# sudo needrestart -u NeedRestart::UI::Debconf -v
```

`99user.conf` が読み込まれていて、`containerd.service` と `docker.service` のチェックが外れていることを確認できました。

[^1]: containerd デーモンの再始動の影響としては、containerd がダウンしている間コンテナの作成や削除といった操作ができないだけ（既存のコンテナは動作し続ける）なので、その程度の影響は容認できるという場合は containerd.service を除外する必要はなさそうです。  
[What impact has a containerd restart on my running service tasks? · moby/moby · Discussion #46449](https://github.com/moby/moby/discussions/46449)

### 古い conffile を維持するようにする

パッケージの更新時にユーザーに尋ねられるものとしては、設定ファイルを古いものを残すか新しいものに上書きするかという質問（例: What do you want to do about modified configuration file sshd_config?）がありますね。

Unattended upgrades のドキュメントに記載されている通り `Dpkg::Options` を設定すれば古い設定ファイルを維持できそうです。

```
Dpkg::Options {"--force-confold"};
```

### ログのローテーションを制御する

まず syslog への保存を有効化するには次の設定を入れます。

```
Unattended-Upgrade::SyslogEnable true;
```

Unattended upgrades のログローテーションの設定は `/etc/logrotate.d/unattended-upgrades` にあります。変える必要があれば変えます。

```
/var/log/unattended-upgrades/unattended-upgrades.log
/var/log/unattended-upgrades/unattended-upgrades-dpkg.log
/var/log/unattended-upgrades/unattended-upgrades-shutdown.log
{
  rotate 6
  monthly
  compress
  missingok
  notifempty
}
```

## 参考文献

* [UnattendedUpgrades - Debian Wiki](https://wiki.debian.org/UnattendedUpgrades)
* [dpkg(1) — dpkg — Debian wheezy — Debian Manpages](https://manpages.debian.org/wheezy/dpkg/dpkg.1.ja.html)
* [第718回　needrestartで学ぶパッケージのフック処理 | gihyo.jp](https://gihyo.jp/admin/serial/01/ubuntu-recipe/0718)
* [Install Docker Engine on Ubuntu | Docker Docs](https://docs.docker.com/engine/install/ubuntu/)
* [apt_preferences(5) — apt — Debian testing — Debian Manpages](https://manpages.debian.org/testing/apt/apt_preferences.5.ja.html)
