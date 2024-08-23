---
title: "Unattended upgradesを実行するタイミングの設定方法"
date: "2024-08-23"
tags: ["Debian", "Ubuntu", "APT"]
---

Unattended upgrades をいつ実行するかを設定する方法のメモです。

関連記事
* [Unattended upgradesのドキュメントを読む](/posts/2024/05/unattended-upgrades)
* [Unattended upgrades + needrestartで安全な自動アップグレードを考える](/posts/2024/05/unattended-upgrades-needrestart-ubuntu)

環境: Ubuntu 22.04

## Unattended upgrades 呼び出しのスケジューリング

Systemd timer がデフォルトで設定されているのでこれを変えれば良いです。

* apt-daily.timer: パッケージリストの更新 (apt update) やダウンロード
* apt-daily-upgrade.timer: 更新のインストール (apt upgrade)

`OnCalendar` と `RandomizedDelaySec` を好みの値に変えましょう。

### デフォルトの systemd timer

`/lib/systemd/system/apt-daily.timer`

```conf
[Unit]
Description=Daily apt download activities

[Timer]
OnCalendar=*-*-* 6,18:00:00
RandomizedDelaySec=12h
Persistent=true

[Install]
WantedBy=timers.target
```

`/lib/systemd/system/apt-daily-upgrade.timer`

```conf
[Unit]
Description=Daily apt upgrade and clean activities
After=apt-daily.timer

[Timer]
OnCalendar=*-*-* 6:00
RandomizedDelaySec=60m
Persistent=true

[Install]
WantedBy=timers.target
```

<details>
<summary>おまけ：デフォルトの systemd service</summary>

`/lib/systemd/system/apt-daily.service`

```conf
[Unit]
Description=Daily apt download activities
Documentation=man:apt(8)
ConditionACPower=true
After=network.target network-online.target systemd-networkd.service NetworkManager.service connman.service

[Service]
Type=oneshot
ExecStartPre=-/usr/lib/apt/apt-helper wait-online
ExecStart=/usr/lib/apt/apt.systemd.daily update
```

`/lib/systemd/system/apt-daily-upgrade.service`

```conf
[Unit]
Description=Daily apt upgrade and clean activities
Documentation=man:apt(8)
ConditionACPower=true
After=apt-daily.service network.target network-online.target systemd-networkd.service NetworkManager.service connman.service

[Service]
Type=oneshot
ExecStartPre=-/usr/lib/apt/apt-helper wait-online
ExecStart=/usr/lib/apt/apt.systemd.daily install
KillMode=process
TimeoutStopSec=900
```

</details>

## Unattended upgrades 呼び出し後の制御

上記が呼び出しのタイミングの制御ですが、スクリプトが呼び出された後に、apt update などの処理を実施する間隔のチェックがあります。また、曜日のチェックをするように設定することもできます。

### 間隔の設定

`/etc/apt/apt.conf.d/20auto-upgrades`

```conf
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

デフォルトでは `1` が設定されており、`0` にするとパッケージリストの更新や無人更新が無効になるので論理値のようですが [Devian の wiki](https://wiki.debian.org/UnattendedUpgrades) を見ると

> ```
> // Do "apt-get update" automatically every n-days (0=disable)
> APT::Periodic::Update-Package-Lists "1";
>
>
> // Do "apt-get upgrade --download-only" every n-days (0=disable)
> APT::Periodic::Download-Upgradeable-Packages "1";
>
>
> // Run the "unattended-upgrade" security upgrade script
> // every n-days (0=disabled)
> // Requires the package "unattended-upgrades" and will write
> // a log in /var/log/unattended-upgrades
> APT::Periodic::Unattended-Upgrade "1";
> ```

と記載されているので、実際にはこの数値は「何日」に1回実施するかを決定する値のようです（デフォルトの `1` は毎日の意味）。また、ここには「何秒」の `s`、「何分」の `m`、「何時間」の `h` の単位（`1h` なら1時間に1回）や `always` も使用可能です。

参考文献の Stack Exchange の回答者も言っていますが、systemd timer でタイミングを制御するのであれば、ここは `always` にしておくのが良いと思います。

### 曜日の設定

`Unattended-Upgrade::Update-Days` を設定すると何曜日に処理を実施するかを決められます。詳しくは [Unattended upgradesのドキュメントを読む](/posts/2024/05/unattended-upgrades) を参照してください。

## 参考文献

* [UnattendedUpgrades - Debian Wiki](https://wiki.debian.org/UnattendedUpgrades)
* [debian - How to run unattended-upgrades not daily but every few hours - Unix & Linux Stack Exchange](https://unix.stackexchange.com/questions/178626/how-to-run-unattended-upgrades-not-daily-but-every-few-hours)
