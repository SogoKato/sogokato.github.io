---
title: "KubernetesのPodからラズパイのGPIOを操作する"
date: "2023-06-24"
tags: ["Kubernetes", "Raspberry Pi"]
---

今まで Docker Compose で動かしてたアプリを Kubernetes に移植したときのメモです。

## Docker Compose では

Docker の `--device` オプションと同じ記法で指定できていました。

```yaml
services:
  app:
    image: hoge
    devices:
      - /dev/gpiomem
```

## Kubernetes では

デバイスプラグインを使用して Kubelet にハードウェアリソースを知らせてあげる必要があります。

今回はホストデバイスを使えるようにする必要があるので [dtp263/k8s-hostdev-plugin](https://github.com/dtp263/k8s-hostdev-plugin) というデバイスプラグインを使用します。本家のリポジトリは消えてしまっているのでフォークされたリポジトリとそのコンテナイメージを使わせてもらいます。

```
git clone https://github.com/dtp263/k8s-hostdev-plugin.git
cd k8s-hostdev-plugin
```

README に記載の通りに DaemonSet を作成します（私は特定ノードでのみ使えるようにしたかったので、nodeAffinity を設定した Deployment にしましたが）。

hostdev-plugin-ds.yaml の `containers.[*]` の `args: ["--devs", "/dev/mem:rwm", "/dev/gpiomem:rwm"]` の部分は自分が使いたいデバイスとパーミッションを指定します。私の場合は以下のようになりました。

```yaml
      containers:
      - name: hostdev
        image: dtp263/k8s-hostdev-plugin
        args: ["--devs", "/dev/gpiomem:rwm"]
```

適用します。`kube-system` の名前空間で Pod が立ち上がれば OK です。

```
kubectl apply -f hostdev-plugin-ds.yaml
```

アプリを動かす Pod を設定します。`spec.containers[*].resources.limits` に `hostdev.k8s.io/デバイス名: 1` と設定します。また、SecurityContext に SYS_RAWIO を追加します。

```yaml
      resources:
        limits:
          hostdev.k8s.io/dev_gpiomem: 1
      securityContext:
        capabilities:
          add: ["SYS_RAWIO"]
```

以上の設定により Kubelet がコンテナを作成する際にデバイスがコンテナに割り当てられるようになります。

## 参考文献

* [Device Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/)
* [dtp263/k8s-hostdev-plugin](https://github.com/dtp263/k8s-hostdev-plugin)
* [Compose file version 3 reference - devices](https://docs.docker.com/compose/compose-file/compose-file-v3/#devices)
