---
title: "プロキシ環境でKubernetes構築（Containerd+Calico）"
date: "2022-12-27"
tags: ["Kubernetes"]
---

同期と一緒にトラシュしたので、プロキシ環境下で kubeadm + Containerd + Calico の Kubernetes クラスターを構築する方法について記録を残します。

## 環境

* Ubuntu 22.04
  * サーバーはニフクラを利用（e-medium4 2vCPU/4GB）
* Kubernetes v1.26.0
* kubeadm v1.26.0
* Containerd v1.6.14
* Calico v3.24.5

コントロールプレーン、ノード1台ずつの構成とします。プロキシを経由しなければインターネットに出られないようになっています。

![network](//www.plantuml.com/plantuml/png/SoWkIImgAStDuSehJybCJ5Uevb9Go4ijASylobP8pybFIim12O51KNvfIMgHDP1NYwIee2YpBB4a5QugCIMbABMuMC5MGSdGt4ZFs53FGCz0tz1CoPeBnHo5Q6mg3PLYhQ7AalFpIehoSmfo4lDIOM9v-Icf40VKSZcavgK07Gu0)

プライベートネットワークの CIDR は `172.31.0.0/16`、プロキシは `http://172.31.0.1:3128` として進めます。

Service CIDR はデフォルトの `10.96.0.0/12` を、Pod Network CIDR は Calico のデフォルトである `192.168.0.0/16` を使います。

💡 筆者の環境ではこの記事で紹介する内容で構築できましたが、環境によって状況が異なる可能性があります。プロキシ配下での構築に挑戦する前に、**まずは似た環境のインターネット接続があるサーバーで試すことをおすすめします**。

## プロキシの設定が必要な箇所

### 環境変数（`~/.bashrc`）

#### コントロールプレーン

```sh
export HTTP_PROXY=http://172.31.0.1:3128
export HTTPS_PROXY=http://172.31.0.1:3128
export NO_PROXY=localhost,127.0.0.1,172.31.0.0/16,10.96.0.0/12,192.168.0.0/16
```

コントロールプレーンでは `NO_PROXY` に Sercice CIDR の IP レンジ（デフォルトは `10.96.0.0/12`）と Pod Network CIDR の IP レンジを設定しておくことで `kubeadm init` 時の preflight check の WARNING を抑えることができます[^1]。

反映するには `source ~/.bashrc` します。

[^1]: 以前は IP レンジを指定できなかったようですが、今は問題なく使えます。https://github.com/kubernetes/kubeadm/issues/324#issuecomment-331483277

#### ノード

```sh
export HTTP_PROXY=http://172.31.0.1:3128
export HTTPS_PROXY=http://172.31.0.1:3128
export NO_PROXY=localhost,127.0.0.1,172.31.0.0/16
```

ノードでは `kubeadm init` を実行しないのでこれだけで OK。

### `/etc/apt/apt.conf`

各種ライブラリのインストールのために必要です。

```
Acquire::http::proxy "http://172.31.0.1:3128";
Acquire::https::proxy "http://172.31.0.1:3128";
```

### `/etc/systemd/system/containerd.service.d/http-proxy.conf`

```
[Service]
Environment="HTTP_PROXY=http://172.31.0.1:3128"
Environment="HTTPS_PROXY=http://172.31.0.1:3128"
Environment="NO_PROXY=localhost,127.0.0.1,172.31.0.0/16,10.96.0.0/12"
```

`NO_PROXY` に Pod Network CIDR の IP レンジも追加しようかと思ったのですが、ノードを跨いだ Pod 間の通信など試した範囲では追加しなくても異常がなかったので追加していません。  
筆者の Kubernetes の知識が浅いだけかもしれないので、検証不足でしたら教えていただけるとありがたいです。🙇

このファイルを変更したら Containerd の再起動が必要です。

```sh
systemctl daemon-reload
systemctl restart containerd
```

## 構築手順

上記のプロキシ設定以外は通常の手順と同じです。

* [kubeadmを使用したクラスターの作成](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
* [kubeadmのインストール](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
* [CRIのインストール](https://kubernetes.io/ja/docs/setup/production-environment/container-runtimes/)

Ubuntu 22.04 で構築する際の注意点については [Ubuntu 22.04でのKubernetesクラスター構築（ContainerdとSystemdCgroup）](/posts/2022/12/kubernetes-ubuntu22.04-cgroup-systemd) をご参照ください。

```sh
kubeadm init --pod-network-cidr 192.168.0.0/16
```

### ネットワークプラグインの適用

構築が完了したらネットワークプラグインを適用します。以下は Calico を使う場合のコマンドです。

```sh
curl https://raw.githubusercontent.com/projectcalico/calico/v3.24.5/manifests/calico.yaml -O
kubectl apply -f calico.yaml
```

`kubectl -n kube-system get po -w` して、1つの `calico-kube-controllers` とノード数分の `calico-node` Pod が Running なら問題ありません。CoreDNS がクラッシュするバグを踏んだら [KubernetesでCoreDNSがループしてしまう問題への対処](/posts/2022/12/kubernetes-coredns-loop) の記事を参考にしてみてください。

## 動作確認

簡単な動作確認をしてみます。

```sh
kubectl create deployment nginx --image=nginx
```

```sh
POD_NAME=$(kubectl get pods -l app=nginx -o jsonpath="{.items[0].metadata.name}")
```

別のシェルを開き、`curl localhost:8080` を試してみます。

```sh
kubectl port-forward $POD_NAME 8080:80
```

ログを見てみます。

```sh
kubectl logs $POD_NAME
```

exec を試します。

```sh
kubectl exec -ti $POD_NAME -- nginx -v
```

NodePort Service を試します。

```sh
kubectl expose deployment nginx --port 80 --type NodePort
```

```sh
NODE_PORT=$(kubectl get svc nginx \
  --output=jsonpath='{range .spec.ports[0]}{.nodePort}')
```

```sh
curl 127.0.0.1:$NODE_PORT
```

```sh
kubectl delete svc nginx
```

次に Cluster IP Service を試します。

```sh
kubectl expose deployment nginx --port 80 --type ClusterIP
```

クライアントを想定した Pod を建てます（nginx ですが）。

```sh
kubectl create deployment client --image=nginx
```

```sh
POD_NAME_CLIENT=$(kubectl get pods -l app=client -o jsonpath="{.items[0].metadata.name}")
```

Pod 内で `curl nginx` を実行します。

```sh
kubectl exec -ti $POD_NAME_CLIENT -- curl nginx
```

`>Welcome to nginx!` の HTML が返ってこれば OK！

## トラブルシューティング集

### `FailedCreatePodSandBox` - ホストのプライベート IP にアクセス不可

`calico-kube-controllers` が ContainerCreating で止まってしまう問題が発生しました。

```
Events:
  Type     Reason                  Age                 From               Message
  ----     ------                  ----                ----               -------
  Warning  FailedScheduling        115s                default-scheduler  0/1 nodes are available: 1 node(s) had untolerated taint {node.kubernetes.io/not-ready: }. preemption: 0/1 nodes are available: 1 Preemption is not helpful for scheduling..
  Normal   Scheduled               104s                default-scheduler  Successfully assigned kube-system/calico-kube-controllers-7bdbfc669-97wdp to controlplane
  Warning  FailedCreatePodSandBox  103s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "6a029253befac6840d358f8f78b865510bb3874b971fc7241d4ded6b1e92ce2d": plugin type="calico" failed (add): stat /var/lib/calico/nodename: no such file or directory: check that the calico/node container is running and has mounted /var/lib/calico/
  Normal   SandboxChanged          16s (x3 over 103s)  kubelet            Pod sandbox changed, it will be killed and re-created.
```

`stat /var/lib/calico/nodename: no such file or directory: check that the calico/node container is running and has mounted /var/lib/calico/` のエラーメッセージが出ていますが、実際にはマウントはできていました。

「マウントはできて nodename（ホスト名）は取得できているが、プロキシに阻まれて通信できていないのでは？」と考え、Containerd の NO_PROXY の設定にホストのプライベートネットワークの CIDR を追記したら `172.31.0.0/16` たらこの問題は解決しました。

```
# vim /etc/systemd/system/containerd.service.d/http-proxy.conf
```

`172.31.0.0/16` を追記。

```
[Service]
Environment="HTTP_PROXY=http://172.31.0.1:3128"
Environment="HTTPS_PROXY=http://172.31.0.1:3128"
Environment="NO_PROXY=localhost,127.0.0.1,172.31.0.0/16"
```

```
# systemctl daemon-reload
# systemctl restart containerd
# kubectl -n kube-system delete po calico-kube-controllers-7bdbfc669-97wdp --force
Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated. The resource may continue to run on the cluster indefinitely.
pod "calico-kube-controllers-7bdbfc669-97wdp" force deleted
```

### `FailedCreatePodSandBox` - Service の IP にアクセス不可

状況は変わったものの、こちらも `calico-kube-controllers` が ContainerCreating で止まってしまう問題です。

```
Events:
  Type     Reason                  Age                From               Message
  ----     ------                  ----               ----               -------
  Normal   Scheduled               3m12s              default-scheduler  Successfully assigned kube-system/calico-kube-controllers-7bdbfc669-9gltp to controlplane
  Warning  FailedCreatePodSandBox  72s                kubelet            Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "68070146a6bd3c3a3044cbe84495c39ef3abafd069f171db2a185c8925aee2d1": plugin type="calico" failed (add): error getting ClusterInformation: Get "https://10.96.0.1:443/apis/crd.projectcalico.org/v1/clusterinformations/default": Service Unavailable
  Normal   SandboxChanged          12s (x2 over 72s)  kubelet            Pod sandbox changed, it will be killed and re-created.
```

こちらはエラーメッセージの通りなので、Service CIDR を Containerd の NO_PROXY に追加します。

```
# vim /etc/systemd/system/containerd.service.d/http-proxy.conf
```

`10.96.0.0/12` を追記。

```
[Service]
Environment="HTTP_PROXY=http://172.31.0.1:3128"
Environment="HTTPS_PROXY=http://172.31.0.1:3128"
Environment="NO_PROXY=localhost,127.0.0.1,172.31.0.0/16,10.96.0.0/12"
```

先ほどと同じように daemon-reload, restart containerd, Pod の強制削除をします。

## まとめ

最後までお読みいただきありがとうございます。

プロキシ環境での Kubernetes クラスター構築は、通常のクラスター構築よりも Kubernetes のネットワーク周りの知識が要求されるので少しハードルが上がります。

冒頭にも書きましたが、まずはインターネットに直接繋がる環境で構築を試してみて、その後にプロキシ環境での構築を実施すると原因の切り分けがスムーズになると思います。

## 参考文献

* [Installing kubernetes behind a corporate proxy](https://medium.com/@vivekanand.poojari/installing-kubernetes-behind-a-corporate-proxy-bc5582e43fb8)
* [kubeadmを使用したクラスターの作成](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
* [kubeadmのインストール](https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
* [CRIのインストール](https://kubernetes.io/ja/docs/setup/production-environment/container-runtimes/)
* [Install Calico networking and network policy for on-premises deployments](https://projectcalico.docs.tigera.io/getting-started/kubernetes/self-managed-onprem/onpremises)
