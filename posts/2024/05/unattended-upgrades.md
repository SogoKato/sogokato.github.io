---
title: "Unattended upgradesのドキュメントを読む"
date: "2024-05-14"
tags: ["Debian", "Ubuntu", "APT"]
---

`gzip -d /usr/share/doc/unattended-upgrades/README.md.gz` して取り出した [Unattended upgrades](https://wiki.debian.org/UnattendedUpgrades) のドキュメントを読んでみます。訳文の作成には翻訳ツール（Google 翻訳）を使用しつつ、一部訂正しています。

環境: Ubuntu 22.04 LTS

---

Unattended upgrades
===================

このスクリプトは、パッケージを無人で自動的にアップグレードします。

コマンドラインから無効にしたい場合は、次を実行します。  
`sudo dpkg-reconfigure -plow unattended-upgrades`

許可されたオリジンからフェッチできない依存関係を必要とするパッケージはインストールされません。インストール前に conffile プロンプトをチェックし、それらを必要とするパッケージを保留します。

<details><summary>原文</summary>

This script upgrades packages automatically and unattended.

If you would prefer to disable it from the command line, run
"sudo dpkg-reconfigure -plow unattended-upgrades".

It will not install packages that require dependencies that can't be
fetched from allowed origins, and it will check for conffile prompts
before the install and holds back any package that requires them.

</details>

Setup
-----

デフォルトでは、無人アップグレードは毎日更新を実行します。

どのパッケージを自動アップグレードするかを指定する主な方法は、パッケージの `origin` と`archive` です。これらは、リポジトリの Release ファイルの Origin フィールドと Suite フィールドからそれぞれ取得することができます。もしくは、次のコマンドの出力の、特定のリポジトリの `o` と `a` フィールドで見つけることができます。

```
$ apt-cache policy
```

デフォルトのセットアップでは、main アーカイブと security アーカイブ内のパッケージが自動更新されます。つまり、安定版とセキュリティの更新のみが適用されます。

これは、`/etc/apt/apt.conf.d/50unattended-upgrades` にリストされている`Unattended-Upgrade::Allowed-Origins` または `Unattended-Upgrade::Origins-Pattern` apt 設定リストを使用して変更できます。このファイルには、設定できるその他のオプションも含まれています。

設定をオーバーライドするには、出荷時のデフォルト値をオーバーライドする別の APT 設定ファイルを作成することをお勧めします。出荷時の設定ファイルを更新してしまうと、Unattended upgrades 自体を更新するときにローカルの変更と競合してしまう可能性があります（更新がブロックされてしまう）。また、新しいファイルは、`52unattended-upgrades-local` のように、デフォルト値のファイルよりも後で解析されるようにソートする必要があります。

Allowed-Origins は `origin:archive` の形式のパターンの単純なリストです。

Origins-Pattern を使用すると、照合する（glob スタイルの）パターンのリストを指定できます。

例:

```
 Unattended-Upgrade::Origins-Pattern {
        "origin=Google\, Inc.,suite=contrib";
        "site=www.example.com,component=main";
 };
```

上記の例の場合、origin が `Google, Inc.` で suite が `contrib` なら、もしくは、`www.example.com` のコンポーネント `main` 内にあるなら、パッケージをアップグレードします。apt-cache ポリシーの短い識別子（例: `origin`」の `o`）もサポートされています。

apt ピン留めを介してインストールするものをすでに構成している場合は、単純に `origin=*` を使用できます。例:

```
 Unattended-Upgrade::Origins-Pattern {
        "origin=*";
 };
```

すべての操作は `/var/log/unattended-upgrades/` に記録されます。 これには dpkg 出力も含まれます。ファイル `/etc/logrotate.d/unattended-upgrades` は、ログファイルの保存期間とローテーションの頻度を制御します。詳細については `logrotate` man ページを参照してください。

メールのサポートが必要な場合は、mail-transport-agent（postfix など）または mailx をインストールする必要があります。

<details><summary>原文</summary>

By default unattended-upgrades runs an update every day.

The main way to specify which packages will be auto-upgraded is by
means of their "origin" and "archive".  These are taken respectively
from the Origin and Suite fields of the repository's Release file,
or can be found in the output of:
```
$ apt-cache policy
```
in the "o" and "a" fields for the given repository.

The default setup auto-updates packages in the main and security
archives, which means that only stable and security updates are
applied.

This can be changed either with the
"Unattended-Upgrade::Allowed-Origins" or the 
"Unattended-Upgrade::Origins-Pattern" apt configuration lists, which
are listed in /etc/apt/apt.conf.d/50unattended-upgrades.
Also in this file are a range of other options that can be configured.

To override the configuration it is recommended to create an other APT
configuration file fragment which overrides the shipped default
value because updates to to shipped configuration file may conflict
with the local changes blocking updating unattended-upgrades itself.
The new file should sort later than 50unattended-upgrades to be
parsed later than the one shipping the default values, it can
be e.g. 52unattended-upgrades-local.

Allowed-Origins is a simple list of patterns of the form
"origin:archive".

Origins-Pattern allows you to give a list of
(glob-style) patterns to match against.  For example:
```
 Unattended-Upgrade::Origins-Pattern {
        "origin=Google\, Inc.,suite=contrib";
        "site=www.example.com,component=main";
 };
```
will upgrade a package if either the origin is "Google, Inc." and
suite is "contrib" or if it comes from www.example.com and is in
component "main".  The apt-cache policy short identifiers
(e.g. "o" for "origin") are also supported.

If you already configure what to install via apt pinning, you can
simply use "origin=*", e.g.:
```
 Unattended-Upgrade::Origins-Pattern {
        "origin=*";
 };
```

All operations are logged in /var/log/unattended-upgrades/. This
includes the dpkg output as well. The file
/etc/logrotate.d/unattended-upgrades controls how long logfiles are
kept, and how often they are rotated. See the `logrotate` manpage for
details.

If you want mail support you need to have a mail-transport-agent (e.g
postfix) or mailx installed.

</details>

Debugging
---------

何か問題が発生した場合、またはスクリプトの動作に関するバグを報告したい場合は、次のコマンドを実行して、`/var/log/unattended-upgrades/unattended-upgrades.log` にある結果のログファイルを確認します。そこには追加のデバッグ情報も含まれています。

```
$ sudo unattended-upgrade --debug --dry-run
```

<details><summary>原文</summary>

If something goes wrong, or if you want to report a bug about the way
the script works, it's a good idea to run:
```
$ sudo unattended-upgrade --debug --dry-run
```
and look at the resulting logfile in:
/var/log/unattended-upgrades/unattended-upgrades.log 
It will also contain additional debug information.

</details>

Manual Setup
------------

このスクリプトを手動でアクティブにするには、apt 設定に次の行が含まれていることを確認する必要があります（これは、グラフィカルな「ソフトウェアソース」プログラムまたは dpkg-reconfigure 経由でも実行できます）。

```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

これは、毎日アップデートをチェックし、（可能であれば）インストールすることを意味します。 update-notifier がインストールされている場合は、`/etc/apt/apt.conf.d/10periodic` がセットアップされます。 ニーズに合わせてこのファイルを編集するだけです。このファイルがない場合は、ファイルを作成するか、`/etc/apt/apt.conf` を作成/編集します。`apt-config dump` を実行して設定を確認できます。

<details><summary>原文</summary>

To activate this script manually you need to ensure that the apt
configuration contains the following lines (this can be done via the
graphical "Software Source" program or via dpkg-reconfigure as well):
```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```
This means that it will check for updates every day, and install them
(if that is possible). If you have update-notifier installed, it will
setup /etc/apt/apt.conf.d/10periodic. Just edit this file then to fit
your needs. If you do not have this file, just create it or
create/edit /etc/apt/apt.conf - you can check your configuration by
running "apt-config dump".

</details>

Supported Options Reference
---------------------------

* `Unattended-Upgrade::Allowed-Origins` - (origin:archive) ペアのリスト

  この origin:archive ペアからのパッケージのみがインストールされます。`apt-cache policy` を実行し、`o=` フィールドと `a=` フィールドをチェックすると、利用可能なすべての origin:archive ペアを確認できます。変数の置換は、`lsb_release -i` の出力を含む `${distro_id}` と、`lsb_release -c` の出力を含む `${distro_codename}` がサポートされています。

  例:
  ```
  Unattended-Upgrade::Allowed-Origins {
	    "${distro_id}:${distro_codename}-security";
  }
  ```

* `Unattended-Upgrade::Package-Blacklist` - 正規表現のリスト

  このリストの正規表現に一致するパッケージはアップグレード対象としてマークされません。 パッケージ A に依存関係としてブラックリストに登録されたパッケージ B がある場合、パッケージ A と B は両方ともアップグレードされません。 これは正規表現のリストであるため、`+` などの特殊文字を `\\+` としてエスケープする必要がある場合があることに注意してください。

  例:
  ```
  Unattended-Upgrade::Package-Blacklist {
      "libstdc\+\+6$";
  };
  ```

* `Unattended-Upgrade::Package-Whitelist` - 正規表現のリスト

  このリストの正規表現に一致するパッケージのみがアップグレード対象としてマークされます。 デフォルトでは、ホワイトリストに登録されたパッケージの依存関係が許可されます。これは、`Unattended-Upgrade::Package-Whitelist-Strict` boolean オプションを使用して、ホワイトリストに登録されたパッケージのみを許可するように変更できます。  
  `Unattended-Upgrade::Package-Blacklist` は引き続き適用されるため、ホワイトリストの対象となるブラックリストに登録されたパッケージは依然としてアップグレードされず、ホワイトリストに登録されたパッケージの依存関係としてインストールまたはアップグレードされません。

  例:
  ```
  Unattended-Upgrade::Package-Whitelist {
      "bash";
  };
  ```

* `Unattended-Upgrade::Package-Whitelist-Strict` - boolean (default:False)

  設定すると `Unattended-Upgrade::Package-Whitelist` 内のパッケージのみのアップグレードが許可されます。これは、ホワイトリストに登録されたパッケージのすべての依存関係もリストする必要があることを意味します。A が B に依存しており、A のみがホワイトリストに登録されている場合、A の更新は抑制されます。

  例:
  ```
  Unattended-Upgrade::Package-Whitelist-Strict "true";
  ```

* `Unattended-Upgrade::AutoFixInterruptedDpkg` - boolean (default:True)

  クリーンでない dpkg 状態が検出された場合に `dpkg --force-confold --configure -a` を実行します。これはデフォルトで true に設定されており、前回の実行中にシステムが中断された場合でも更新が確実にインストールされるようになっています。

* `Unattended-Upgrade::MinimalSteps` - boolean (default:True)

  最小限の自己完結型チャンクでアップグレードを実行することで、（例えば電源障害に対する）安全性を最適化します。これにより、SIGTERM を unattended-upgrades に送信することも可能になり、現在のアップグレード手順が完了するとアップグレードが停止されます。

* `Unattended-Upgrade::InstallOnShutdown` - boolean (default:False)

  マシンの実行中にバックグラウンドで実行するのではなく、マシンのシャットダウン時にアップグレードを実行します。

* `Unattended-Upgrade::Mail` - string (default:"")

  アップグレードされたパッケージに関する情報を記載した電子メールをこのアドレスに送信します。空または未設定の場合、電子メールは送信されません。このオプションを使用するには、ローカルのメール設定が機能している必要があります。

  例:
  ```
  Unattended-Upgrade::Mail "user@example.com";
  ```

* `Unattended-Upgrade::Sender` - string (default:"root")

  送信メールの「差出人」フィールドに指定された値を使用します。

  例:
  ```
  Unattended-Upgrade::Sender "server@example.com";
  ```

* `Unattended-Upgrade::MailReport` - string (default: "on-change")

  設定可能な値は、`always`、`only-on-error` または `on-change` です。この値が設定されていない場合、レガシーオプション `Unattended-Upgrade::MailOnlyOnError`（デフォルト:False）を使用して、`only-on-error` と `on-change` のどちらかから値が設定されます。

  `never` は `Unattended-Upgrade::Mail` を設定しないことによって実現されることに注意してください。

* `Unattended-Upgrade::Remove-Unused-Dependencies` - boolean (default:False)

  アップグレードが完了したら、使用されていない依存関係をすべて削除します。

* `Unattended-Upgrade::Remove-New-Unused-Dependencies` - boolean (default:True)

  アップグレードが完了したら、新しい使用されていない依存関係をすべて削除します。

* `Unattended-Upgrade::Automatic-Reboot` - boolean (default:False)

  アップグレード後にファイル /var/run/reboot-required が見つかった場合は、**確認なしで**自動的に再起動します。

* `Unattended-Upgrade::Automatic-Reboot-WithUsers` - boolean (default:True)

  ユーザーがログインしていても自動的に再起動します。

* `Unattended-Upgrade::Keep-Debs-After-Install` - boolean (default:False)

  インストールが成功した後、ダウンロードした deb パッケージを保存しておきます。デフォルトでは、これらはインストールが成功すると削除されます。

* `Acquire::http::Dl-Limit` - integer (default:0)

  アップグレードを取得するときに、適切な帯域幅制限機能を使用します。数値は、apt が使用を許可される kb/秒の数です。

  70kb/秒にダウンロードを制限する例:
  ```
  Acquire::http::Dl-Limit "70";
  ```

* `Dpkg::Options` - string のリスト

  dpkg コマンドラインオプションを設定します。これは例えば dpkg での conffile 処理を強制するような場合に便利です。

  dpkg が古い設定ファイルを維持するように強制する例:
  ```
  Dpkg::Options {"--force-confold"};
  ```
  unattended-upgrades はこのオプションを検出し、構成プロンプトを含むパッケージが保留されないようにすることに注意してください。

* `Unattended-Upgrade::Update-Days` - string のリスト (default:empty)

  更新を適用する曜日を設定します。曜日は、ローカライズされた省略名または完全名として指定できます。または「0」が日曜日、「1」が月曜日などの整数として指定します。

  月曜日と金曜日のみに更新を適用する例:
  ```
  Unattended-Upgrade::Update-Days {"Mon";"Fri"};
  ```
  デフォルトは空のリストで、更新が毎日適用されることを意味します。

* `Unattended-Upgrade::SyslogEnable` - boolean (default:False)

  イベントを syslog に書き込みます。これは、syslog メッセージが中央ストアに送信される環境で役立ちます。

  syslog への書き込みを有効にする例:
  ```
  Unattended-Upgrade::SyslogEnable true;
  ```
  デフォルトは False です。イベントは syslog に書き込まれません。

* `Unattended-Upgrade::SyslogFacility` - string (default:"daemon")

  指定された syslog ファシリティ、指定されていない場合は daemon ファシリティにイベントを書き込みます。`Unattended-Upgrade::SyslogEnable` オプションを true に設定する必要があります。

  syslog auth ファシリティを使用する例:
  ```
  Unattended-Upgrade::SyslogFacility "auth";
  ```
  デフォルトは daemon ファシリティです。

<details><summary>原文</summary>

* `Unattended-Upgrade::Allowed-Origins` - list of (origin:archive) pairs
 
 Only packages from this origin:archive pair will be installed. You
 can see all available origin:archive pairs by running `apt-cache policy`
 and checking the "o=" and "a=" fields. Variable substitution is supported
 for ${distro_id} that contains the output of `lsb_release -i` and
 ${distro_codename} that contains the output of `lsb_release -c`.
 
 Example:
 ```
 Unattended-Upgrade::Allowed-Origins {
	"${distro_id}:${distro_codename}-security";
 ```

* `Unattended-Upgrade::Package-Blacklist` - list of regular expressions
 
 No packages that match the regular expressions in this list will be
 marked for upgrade. If a package A has a blacklisted package B as a
 dependency then both packages A and B will not be upgraded. Note
 that it's a list of regular expressions, so you may need to escape special
 characters like "+" as "\\+".
 
 Example:
 ```
 Unattended-Upgrade::Package-Blacklist {
     "libstdc\+\+6$";
 };
 ```

* `Unattended-Upgrade::Package-Whitelist` - list of regular expressions
 
 Only packages that match the regular expressions in this list will be
 marked for upgrade. By default dependencies of whitelisted packages
 are allowed. This can be changed to only ever allow whitelisted
 packages with the `Unattended-Upgrade::Package-Whitelist-Strict`
 boolean option.
 `Unattended-Upgrade::Package-Blacklist` still applies, thus blacklisted
 packages covered by the whitelist will still not be upraded nor will be
 installed or upgraded as dependencies of whitelisted packages.

 Example:
 ```
 Unattended-Upgrade::Package-Whitelist {
     "bash";
 };
 ```

* `Unattended-Upgrade::Package-Whitelist-Strict` - boolean (default:False)
 
 When set, allow only packages in `Unattended-Upgrade::Package-Whitelist`
 to be upgraded. This means that you also need to list all the dependencies
 of a whitelisted package, e.g. if A depends on B and only A is
 whitelisted, it will be held back.
 
 Example:
 ```
 Unattended-Upgrade::Package-Whitelist-Strict "true";
 ```

* `Unattended-Upgrade::AutoFixInterruptedDpkg` - boolean (default:True)
 
 Run `dpkg --force-confold --configure -a` if a unclean dpkg state is
 detected. This defaults to true to ensure that updates get installed
 even when the system got interrupted during a previous run.

* `Unattended-Upgrade::MinimalSteps` - boolean (default:True)
 
 Optimize for safety against e.g. power failure by performing the upgrade
 in minimal self-contained chunks. This also allows sending a SIGTERM to
 unattended-upgrades, and it will stop the upgrade when it finishes the
 current upgrade step.

* `Unattended-Upgrade::InstallOnShutdown` - boolean (default:False)
 
 Perform the upgrade when the machine is shutting down instead of
 doing it in the background while the machine is running.

* `Unattended-Upgrade::Mail` - string (default:"")

 Send an email to this address with information about the packages
 upgraded. If empty or unset no email is sent. This option requires
 a working local mail setup.
 
  Example:
 ```
 Unattended-Upgrade::Mail "user@example.com";
 ```

* `Unattended-Upgrade::Sender` - string (default:"root")

 Use the specified value in the "From" field of outgoing mails.
 
  Example:
 ```
 Unattended-Upgrade::Sender "server@example.com";
 ```

* `Unattended-Upgrade::MailReport` - string (default: "on-change")
 
 Possible values are "always", "only-on-error" or "on-change".
 If this value is not set then the value is set by using the legacy
 option `Unattended-Upgrade::MailOnlyOnError` (default:False) to choose
 between "only-on-error" and "on-change".

 NOTE that "never" is achieved by not setting any `Unattended-Upgrade::Mail`

* `Unattended-Upgrade::Remove-Unused-Dependencies` - boolean (default:False)
 
 Remove all unused dependencies after the upgrade has finished.

* `Unattended-Upgrade::Remove-New-Unused-Dependencies` - boolean (default:True)

 Remove any new unused dependencies after the upgrade has finished.

* `Unattended-Upgrade::Automatic-Reboot` - boolean (default:False)
 
 Automatically reboot *WITHOUT CONFIRMATION* if the file
 /var/run/reboot-required is found after the upgrade.

* `Unattended-Upgrade::Automatic-Reboot-WithUsers` - boolean (default:True)

 Automatically reboot even if users are logged in.

* `Unattended-Upgrade::Keep-Debs-After-Install` - boolean (default:False)

 Keep the downloaded deb packages after successful installs. By default
 these are removed after successful installs.

* `Acquire::http::Dl-Limit` - integer (default:0)

 Use apt bandwidth limit feature when fetching the upgrades. The
 number is how many kb/sec apt is allowed to use.

 Example - limit the download to 70kb/sec:
 ```
 Acquire::http::Dl-Limit "70";
 ```

* `Dpkg::Options` - list of strings

 Set a dpkg command-line option. This is useful to e.g. force conffile
 handling in dpkg.

 Example - force dpkg to keep the old configuration files:
 ```
 Dpkg::Options {"--force-confold"};
 ```
 Note that unattended-upgrades detects this option, and ensures that
 packages with configuration prompts will never be held back.

* `Unattended-Upgrade::Update-Days` - list of strings (default:empty)

 Set the days of the week that updates should be applied. The days
 can be specified as localized abbreviated or full names. Or as
 integers where "0" is Sunday, "1" is Monday etc.

 Example - apply updates only on Monday and Friday:
 ```
 Unattended-Upgrade::Update-Days {"Mon";"Fri"};
 ```
 The default is an empty list which means updates are applied every day.


* `Unattended-Upgrade::SyslogEnable` - boolean (default:False)

 Write events to syslog, which is useful in environments where
 syslog messages are sent to a central store.

 Example - Enable writing to syslog:
 ```
 Unattended-Upgrade::SyslogEnable true;
 ```
 The default is False - events will not be written to syslog.

* `Unattended-Upgrade::SyslogFacility` - string (default:"daemon")

 Write events to the specified syslog facility, or the daemon facility if not specified.
 Requires the `Unattended-Upgrade::SyslogEnable` option to be set to true.

 Example - Use the syslog auth facility:
 ```
 Unattended-Upgrade::SyslogFacility "auth";
 ```
 The default is the daemon facility.


![](https://github.com/mvo5/unattended-upgrades/workflows/build/badge.svg)

</details>
