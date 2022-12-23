---
title: "KubernetesでCoreDNSがループしてしまう問題への対処"
date: "2022-12-24"
tags: ["Kubernetes", "小ネタ"]
---

1年前にも [Kubernetes クラスターを自力で組んでトラブルシューティングしてみる【The Hard Way】](https://qiita.com/SogoK/items/192d475c20e07dd38984)の記事の中で軽く解説したネタです。

## 問題

Kubernetes クラスター内で名前解決に使われる CoreDNS の Pod が `CrashLoopBackOff` になってしまい再起動を繰り返す問題が発生することがあります。

```
# kubectl -n kube-system logs coredns-787d4945fb-6kb5t
.:53
[INFO] plugin/reload: Running configuration SHA512 = 591cf328cccc12bc490481273e738df59329c62c0b729d94e8b61db9961c2fa5f046dd37f1cf888b953814040d180f52594972691cd6ff41be96639138a43908
CoreDNS-1.9.3
linux/amd64, go1.18.2, 45b0a11
[FATAL] plugin/loop: Loop (127.0.0.1:34129 -> :53) detected for zone ".", see https://coredns.io/plugins/loop#troubleshooting. Query: "HINFO 1033981844954998931.6641498229839068582."
```

## 原因

https://coredns.io/plugins/loop/#troubleshooting

Ubuntu 18.04 以降などの最近のディストリビューションで、ローカルの DNS スタブリゾルバ (systemd-resolved) が使われるようになったことが原因です。Kubelet の設定ファイル `/var/lib/kubelet/config.yaml` を見るとデフォルトでは下記のように設定されています。

```conf
resolvConf: /run/systemd/resolve/resolv.conf
```

ここで指定されているファイル `/run/systemd/resolve/resolv.conf` が kubelet によって、CoreDNS コンテナに渡されます。デフォルトでは中身は以下のようになっているはずです。

```conf
# This is /run/systemd/resolve/resolv.conf managed by man:systemd-resolved(8).
# Do not edit.
#
# This file might be symlinked as /etc/resolv.conf. If you're looking at
# /etc/resolv.conf and seeing this text, you have followed the symlink.
#
# This is a dynamic resolv.conf file for connecting local clients directly to
# all known uplink DNS servers. This file lists all configured search domains.
#
# Third party programs should typically not access this file directly, but only
# through the symlink at /etc/resolv.conf. To manage man:resolv.conf(5) in a
# different way, replace this symlink by a static file or a different symlink.
#
# See man:systemd-resolved.service(8) for details about the supported modes of
# operation for /etc/resolv.conf.

nameserver 127.0.0.1
search .
```

OS 上ではスタブリゾルバがいるので `127.0.0.1` を DNS とするように設定されていますが、CoreDNS のコンテナ内ではそのコンテナ自身を指すことになります。結果的にループしてしまい、クラッシュします。

## 解決方法

原因は上記の通りなので、`127.0.0.1` ではない外部の DNS サーバーを設定すれば解決できます。

`/run/systemd/resolve/resolv.conf` は systemd-resolved の管理下にある自動生成ファイルですので、大元の設定ファイル `/etc/systemd/resolved.conf` を修正し、systemd-resolved を再起動することで `/run/systemd/resolve/resolv.conf` を再生成させます。

その後新しい `resolv.conf` の内容を反映させるために kubelet と Container runtime (containerd) を再起動します。

```
NAMESERVER_ADDRESSES=8.8.8.8
sed -i "s/^DNS=127.0.0.1$/DNS=${NAMESERVER_ADDRESSES}/" /etc/systemd/resolved.conf
systemctl restart systemd-resolved
systemctl restart kubelet
systemctl restart containerd
```

CoreDNS が無事 Running になれば OK です。

```
root@controlplane:~# kubectl -n kube-system get po -w
NAME                                      READY   STATUS             RESTARTS     AGE
calico-kube-controllers-7bdbfc669-w4xxt   1/1     Running            0            2m57s
calico-node-2f2qc                         1/1     Running            0            15m
coredns-787d4945fb-6kb5t                  0/1     CrashLoopBackOff   5 (7s ago)   16m
coredns-787d4945fb-q5bhz                  0/1     CrashLoopBackOff   5 (7s ago)   16m
etcd-controlplane                         1/1     Running            0            16m
kube-apiserver-controlplane               1/1     Running            0            16m
kube-controller-manager-controlplane      1/1     Running            0            16m
kube-proxy-692c8                          1/1     Running            0            16m
kube-scheduler-controlplane               1/1     Running            0            16m
coredns-787d4945fb-6kb5t                  0/1     Running            6 (19s ago)   16m
coredns-787d4945fb-6kb5t                  1/1     Running            6 (19s ago)   16m
coredns-787d4945fb-q5bhz                  0/1     Running            6 (25s ago)   16m
coredns-787d4945fb-q5bhz                  1/1     Running            6 (25s ago)   16m
```
