---
title: "VS Code Remote Tunnelsをシステムサービス化すると便利"
date: "2025-05-30"
tags: ["VS Code", "開発環境"]
---

Linux で VS Code の Remote tunnels を最初に使うときにサービスとしてインストールするかを聞かれたので、てっきり常時アクセスできるかと思いましたが、ログアウト時は使えない仕様だったのでシステムサービス化したら便利でした。

## 環境

* Ubuntu 24.04 Desktop
* VS Code 1.100.1

## やったこと

> Remote tunnels を最初に使うときにサービスとしてインストールするかを聞かれた

ときに、裏で実行されたコマンドは `code tunnel service install` だと思われます。

```
$ code tunnel service --help
(Preview) Manages the tunnel when installed as a system service,

Usage: code-tunnel tunnel service [OPTIONS] <COMMAND>

Commands:
  install    Installs or re-installs the tunnel service on the machine
  uninstall  Uninstalls and stops the tunnel service
  log        Shows logs for the running service
  help       Print this message or the help of the given subcommand(s)

Options:
  -h, --help  Print help

GLOBAL OPTIONS:
      --cli-data-dir <CLI_DATA_DIR>  Directory where CLI metadata should be stored [env: VSCODE_CLI_DATA_DIR=]
      --verbose                      Print verbose output (implies --wait)
      --log <level>                  Log level to use [possible values: trace, debug, info, warn, error, critical, off]
```

```
$ code tunnel service install
*
* Visual Studio Code Server
*
* By using the software, you agree to
* the Visual Studio Code Server License Terms (https://aka.ms/vscode-server-license) and
* the Microsoft Privacy Statement (https://privacy.microsoft.com/en-US/privacystatement).
*
[2025-05-30 21:58:48] info Successfully registered service...
[2025-05-30 21:58:49] info Successfully enabled unit files...
[2025-05-30 21:58:49] info Tunnel service successfully started
Service successfully installed! You can use `code tunnel service log` to monitor it, and `code tunnel service uninstall` to remove it.
```

`systemctl --user status code-tunnel` を実行すると上記でインストールされたサービスを確認できます。`Loaded:` の行に service ファイルの位置が記載されているので該当ファイルを開きます。

`/home/${ユーザ名}/.config/systemd/user/code-tunnel.service`

```
[Unit]
Description=Visual Studio Code Tunnel
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStart=/usr/share/code/bin/code-tunnel "--verbose" "--cli-data-dir" "/home/${ユーザ名}/.vscode/cli" "tunnel" "service" "internal-run"

[Install]
WantedBy=default.target
```

`WantedBy=default.target` になっていますね。デスクトップ環境のデフォルトは `graphical.target` なのでこれがログイン時しか接続できない原因ぽいです。

```
$ sudo systemctl get-default
graphical.target
```

VS Code が管理するファイルを直接書き換えるのはお行儀が悪そうなので、上記ファイルの内容をコピっておき、アンインストールします。

```
$ code tunnel service uninstall
[2025-05-30 22:06:00] info Successfully stopped service...
[2025-05-30 22:06:00] info Tunnel service uninstalled
```

システムサービスとしてインストールします。ポイントは `User=${ユーザ名}` と `WantedBy=multi-user.target` で、これらを元のファイルに追記・修正します。

`/etc/systemd/system/code-tunnel.service`

```diff
[Unit]
Description=Visual Studio Code Tunnel
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
+User=${ユーザ名}
Restart=always
RestartSec=10
ExecStart=/usr/share/code/bin/code-tunnel "--verbose" "--cli-data-dir" "/home/${ユーザ名}/.vscode/cli" "tunnel" "service" "internal-run"

[Install]
+WantedBy=multi-user.target
-WantedBy=default.target
```

`sudo systemctl start --now code-tunnel` すれば、ログアウト時にも使えるようになっているはず。
