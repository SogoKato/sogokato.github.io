---
title: "Ubuntu 22.04でのKubernetesクラスター構築（ContainerdとSystemdCgroup）"
date: "2022-12-26"
tags: ["Kubernetes"]
---

公式ドキュメントのコマンドを手順通り流し込めば割と簡単に構築できる Kubernetes クラスターですが、Ubuntu 22.04 になってから少し手を入れる必要が出てきたので差分を紹介しておきます。

## 環境

* Ubuntu 22.04
* Kubernetes v1.26.0
* kubeadm v1.26.0
* Containerd v1.6.14

## 何が変わった？

Ubuntu 21.10 以降、Cgroup v2 がデフォルトになりました[^1]。  
Cgroup について詳しく知りたい方は [第37回 Linuxカーネルのコンテナ機能 ― cgroupの改良版cgroup v2［1］](https://gihyo.jp/admin/serial/01/linux_containers/0037)の記事がわかりやすいので読んでみてください。

Kubernetes においては「cgroupドライバー」を kubelet の設定で選択します。`cgroupfs` ドライバーが v1 に、`systemd` ドライバーが v2 に対応していると考えれば問題ないと思います。

[^1]: https://wiki.ubuntu.com/UbuntuWeeklyNewsletter/Issue697

## 何もしないとどうなる？

コンテナは起動しますが、使い物にならないくらい不安定になり再作成を繰り返します。システムコンポーネントのコンテナ（kube-apiserver）も例外でないので、kubectl を叩いてもレスポンスが返ってこなかったり。。

## 解決方法

Cgroup v1 に戻す、というやり方もあるとは思うのですが、systemd を Cgroup ドライバーとして設定すれば Cgroup v2 のままで使えるようになるので、新しくクラスターを構築するのであればそうするのがおすすめです。

kubelet に関しては kubeadm v1.22 以降デフォルトで `systemd` を選択するようになったので[^2]、特に気にする必要はないです。

[^2]: 備考: v1.22では、ユーザーがKubeletConfigurationのcgroupDriverフィールドを設定していない場合、kubeadmはデフォルトでsystemdを設定するようになりました。  
https://kubernetes.io/ja/docs/tasks/administer-cluster/kubeadm/configure-cgroup-driver/#kubelet-cgroup%E3%83%89%E3%83%A9%E3%82%A4%E3%83%90%E3%83%BC%E3%81%AE%E8%A8%AD%E5%AE%9A

**Containerd を CRI として使用する場合、Containerd 側でも Cgroup ドライバーを選択する必要があります（今回の記事のミソ）。**

[Containerd のインストール手順](https://kubernetes.io/ja/docs/setup/production-environment/container-runtimes/#containerd%E3%81%AE%E3%82%A4%E3%83%B3%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AB)に下記のコマンドがありますが、その下にさらに大事なことが書かれています[^3]。

```sh
# containerdの設定
mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
# containerdの再起動
systemctl restart containerd
```

> `systemd`のcgroupドライバーを使うには、`/etc/containerd/config.toml`内で`plugins.cri.systemd_cgroup = true`を設定してください。

[^3]: 引用で省略した _kubeadmを使う場合は[kubeletのためのcgroupドライバー](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/install-kubeadm/#%E3%82%B3%E3%83%B3%E3%83%88%E3%83%AD%E3%83%BC%E3%83%AB%E3%83%97%E3%83%AC%E3%83%BC%E3%83%B3%E3%83%8E%E3%83%BC%E3%83%89%E3%81%AEkubelet%E3%81%AB%E3%82%88%E3%81%A3%E3%81%A6%E4%BD%BF%E7%94%A8%E3%81%95%E3%82%8C%E3%82%8Bcgroup%E3%83%89%E3%83%A9%E3%82%A4%E3%83%90%E3%83%BC%E3%81%AE%E8%A8%AD%E5%AE%9A)を手動で設定してください。_ の部分に関してはリンク先で Docker を CRI に使う場合のことにしか実質触れていないので気にしなくていいです。

なので、言われた通り `plugins.cri.systemd_cgroup = true` を設定してから restart をかけるようにしましょう。

```sh
sed -i 's/SystemdCgroup \= false/SystemdCgroup \= true/g' /etc/containerd/config.toml
```

他の手順は参考文献の上3つのリンク先に記載の手順を実施すれば OK です。

ネットワークプラグイン設定後、CoreDNS がクラッシュするバグを踏んだら [KubernetesでCoreDNSがループしてしまう問題への対処](/posts/2022/12/kubernetes-coredns-loop) の記事を参考にしてみてください。

## 参考文献

* [kubeadmを使用したクラスターの作成](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
* [kubeadmのインストール](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
* [CRIのインストール](https://kubernetes.io/ja/docs/setup/production-environment/container-runtimes/)
* [cgroupドライバーの設定](https://kubernetes.io/ja/docs/tasks/administer-cluster/kubeadm/configure-cgroup-driver/)
* [Ubuntu 22.04でkubeadmでKubernetesクラスターが動かない？](https://tech.virtualtech.jp/entry/2022/06/08/115030)
