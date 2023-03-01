---
title: "Ansibleでgpg公開鍵とaptのサードパーティリポジトリを追加する ～Terraformをインストールしたい～"
date: "2023-03-01"
tags: ["Ansible", "Terraform", "APT"]
---

apt を使って docker や terraform をインストールする時など、提供元のサードパーティ apt リポジトリを追加する場合が結構ありますよね。その際に、今までは `apt-key` を使って OpenPGP 公開鍵をインポートしていたのですが、`apt-key` は [Debian 11 と Ubuntu 22.04 を最後に使えなくなる](https://manpages.debian.org/unstable/apt/apt-key.8.ja.html) ので、今後は `gnupg` を使った方法が主流になっていきます。

Ansible にも [ansible.builtin.apt_key module](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_key_module.html) がありますが、これは後方互換性のために残されるものの、今後新たに使うのは避けたほうが良いでしょう。

幸い、これからの公開鍵と apt リポジトリの紐づけの方法はとてもシンプルです。

* 公開鍵はどこにおいても OK
  * `/usr/share/keyrings/` に置くことが多そう
* `deb [signed-by=/path/to/key] ...` と書いたファイルを `/etc/apt/sources.list.d` に追加する
  * `add-apt-repository` でも同様
* 公開鍵の形式は `.asc` でも `.gpg` でも OK
  * [apt-key が非推奨になったので](https://zenn.dev/spiegel/articles/20220508-apt-key-is-deprecated) の記事が参考になります

3点目の公開鍵の形式については、私はそもそも2種類あることを今回初めて知りました。

* バイナリ形式
  * `.gpg` 拡張子
* ASCII 形式（armored）
  * `.asc` 拡張子

まぁバイナリかテキストエンコードされているかという違いだけですね。インターネットからダウンロードしてくるときは asc になっていて、そのあと dearmor して格納するという手順を [Docker](https://docs.docker.com/engine/install/ubuntu/) および [Hashicorp](https://www.hashicorp.com/official-packaging-guide) のドキュメントで見つけることができました（いつも意味を理解せずにコマンドを流し込んでいたことを反省）。

## 成果物

前段が長くなりましたが、今回作っていく Ansible の task は以下の流れになります。

1. `apt update` && 依存ライブラリのインストール
1. 公開鍵（`.asc` 形式）をダウンロード
1. 公開鍵のフィンガープリントを検証
1. サードパーティ apt リポジトリの追加 && `apt update`
1. サードパーティ apt リポジトリからパッケージをインストール

Hashicorp の公開鍵と apt リポジトリを追加して、terraform パッケージをインストールするためのサンプルが下記になります。他のサードパーティ apt リポジトリを追加する場合にも応用が利くかもしれません。

```yaml
- name: apt cache is updated
  apt:
    update_cache: yes
    cache_valid_time: 3600
  when: ansible_distribution == 'Debian' or ansible_distribution == 'Ubuntu'

- name: prerequisites are installed
  package:
    name: "{{ item }}"
    state: present
  with_items:
    - gnupg
    - software-properties-common

- name: hashicorp gpg key is installed
  ansible.builtin.get_url:
    url: https://apt.releases.hashicorp.com/gpg
    dest: /usr/share/keyrings/hashicorp-archive-keyring.asc

- name: hashicorp gpg key is verified
  command: gpg --dry-run -q --import --import-options import-show /usr/share/keyrings/hashicorp-archive-keyring.asc
  register: hashicorp_gpg_show_result
  changed_when: no
  # MEMO: Check the URL below for the latest fingerprint.
  #       https://www.hashicorp.com/official-packaging-guide
  failed_when: "'798AEC654E5C15428C8E42EEAA16FCBCA621E701' not in hashicorp_gpg_show_result.stdout"

- name: hashicorp repository is added
  ansible.builtin.apt_repository:
    repo: deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.asc] https://apt.releases.hashicorp.com {{ ansible_distribution_release }} main
    filename: hashicorp
    state: present

- name: terraform is installed
  package:
    name: terraform
    state: present
```

## すこし解説

`hashicorp gpg key is verified` ではダウンロードした公開鍵が公式のものかどうかをフィンガープリントを比較して検証しています。フィンガープリントは執筆時点（2023/3/1）のものです。

若干気持ち悪い実装な気もするので（とはいえ目視でやっていることと同じだけども）、もっと良い実装を知っている人はぜひ教えてください。。

参考までに `gpg --dry-run -q --import --import-options import-show /usr/share/keyrings/hashicorp-archive-keyring.asc` の出力は下記のようになります。

```
pub   rsa4096 2023-01-10 [SC] [expires: 2028-01-09]
      798AEC654E5C15428C8E42EEAA16FCBCA621E701
uid                      HashiCorp Security (HashiCorp Package Signing) <security+packaging@hashicorp.com>
sub   rsa4096 2023-01-10 [S] [expires: 2028-01-09]
```

`hashicorp repository is added` では `signed-by=` でダウンロードした公開鍵のパスを指定することで公開鍵と apt リポジトリを紐づけています。Ansible の `ansible_distribution_release` 変数を使うことで、コードネーム（jammy とか focal とか bionic とか）を取得することができます（`lsb_release -cs` と同等）。

`ansible.builtin.apt_repository module` がデフォルトで changed の時に自動で `apt update` もしてくれるので明示的に書く必要はありません。

## 実行結果

```
PLAY [localhost] **********************************************************************************************************

TASK [Gathering Facts] ****************************************************************************************************
ok: [localhost]

TASK [apt cache is updated] ***********************************************************************************************
ok: [localhost]

TASK [prerequisites are installed] ****************************************************************************************
ok: [localhost] => (item=gnupg)
ok: [localhost] => (item=software-properties-common)

TASK [hashicorp gpg key is installed] *************************************************************************************
changed: [localhost]

TASK [hashicorp gpg key is verified] **************************************************************************************
ok: [localhost]

TASK [hashicorp repository is added] **************************************************************************************
changed: [localhost]

TASK [terraform is installed] *********************************************************************************************
changed: [localhost]

PLAY RECAP ****************************************************************************************************************
localhost                  : ok=7    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

## 参考文献

* [APT-KEY(8)](https://manpages.debian.org/unstable/apt/apt-key.8.ja.html)
* [ansible.builtin.apt_key module – Add or remove an apt key](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_key_module.html)
* [ansible.builtin.apt_repository module – Add and remove APT repositories](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/apt_repository_module.html)
* [Official Packaging Guide](https://www.hashicorp.com/official-packaging-guide)
* [Install Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
* [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
* [apt-key が非推奨になったので](https://zenn.dev/spiegel/articles/20220508-apt-key-is-deprecated)
* [非推奨となったapt-keyの代わりにsigned-byとgnupgを使う方法](https://www.clear-code.com/blog/2021/5/5.html)
* [GnuPG の使用法](https://www.math.s.chiba-u.ac.jp/~matsu/gpg/gpg-3.html)
* [How do I verify an asc key fingerprint?](https://askubuntu.com/questions/48508/how-do-i-verify-an-asc-key-fingerprint)
