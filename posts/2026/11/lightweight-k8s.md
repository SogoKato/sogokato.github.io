---
title: "軽量Kubernetesディストリビューションを比較してみる"
date: "2026-11-07"
tags: ["Kubernetes", "K3s", "自宅サーバー"]
---

自宅のクラスタでは K3s を使っています。2023年に、Raspberry Pi 3A+（RAM 512MB）も join させたかったので K3s を選びました。

[ラズパイでK3sクラスター構築【24.04対応】](/posts/2023/06/k3s-setup)

それから3年が経ち、軽量 Kubernetes を取り巻く状況がどうなっているかに興味が出たので調べてみました。

K3s, RKE2, k0s, MicroK8s の4つを、思想・ターゲット層、開発体制、Ingress, CNI, PV, バージョンアップの方法、メモリ使用量の観点で比較します。公式ドキュメントを調べたうえで、同じアプリを動かす実験は Claude Code に計画してもらい、実行までやってもらいました。

## 環境

* ホスト: Ubuntu 24.04.4 LTS, LXD 5.21.9
* VM: 2 vCPU, メモリ 4GiB, ディスク 20GiB, Ubuntu 24.04.5 LTS を各ディストリビューションに1台ずつ
* K3s v1.37.2+k3s1
* RKE2 v1.37.2+rke2r1
* k0s v1.37.2+k0s.1
* MicroK8s v1.36.2

MicroK8s だけ v1.36 なのは、2026年11月7日の時点で 1.37 の snap チャンネルがなかったためです。

## 位置づけと開発体制を比べる

公式の説明を読むと、4つとも狙っているところが違います。

* [K3s](https://docs.k3s.io/): 「Lightweight Kubernetes」を掲げていて、用途にはエッジ、自宅サーバー、IoT、CI、ARM などが挙がっています
* [RKE2](https://docs.rke2.io/): 米国連邦政府分野のセキュリティとコンプライアンスに重点を置くディストリビューションです。CIS Benchmark や FIPS 140-2 への対応が目標に並んでいます。最低スペックも2コア、4GB と4つの中でいちばん高く、軽量を売りにしているわけではなさそうです
* [k0s](https://docs.k0sproject.io/stable/): 単一バイナリで、ホスト OS への依存はカーネルだけとしています。Ingress やストレージは「VERY opinionated」だとして同梱していません[^1]
* [MicroK8s](https://canonical.com/microk8s/docs): 「low-ops, minimal production Kubernetes」と説明されています。Linux では snap でインストールします

開発体制は次のとおりです。スター数は2026年11月7日時点です。コミット数は2025年11月7日から1年間の既定ブランチの集計で、bot を除いています。k0s は bot のコミットが6割近くを占めるので、含めると人の開発量と比べられなくなります。

|          | 主な開発者 | CNCF                                                                    | スター数 | コミット数      |
| -------- | ---------- | ----------------------------------------------------------------------- | -------- | --------------- |
| K3s      | SUSE       | Sandbox（[Incubating 申請中](https://github.com/cncf/toc/issues/1957)） | 34,351   | 480件（74人）   |
| RKE2     | SUSE       | Sandbox などの記載なし                                                  | 2,395    | 467件（34人）   |
| k0s      | Mirantis   | Sandbox（[Incubating 申請中](https://github.com/cncf/toc/issues/1962)） | 6,572    | 1,124件（53人） |
| MicroK8s | Canonical  | Sandbox などの記載なし                                                  | 9,379    | 34件（9人）     |

k0s は1,124件のうち737件が Mirantis の開発者1人のコミットでした。Bot の活用度合いが大きくありつつも、コントリビュータの数も K3s に次いで多いです。

MicroK8s はスター数が多い一方で、コミット数の少なさが目立ちます。ほかの3つは v1.37.2 が出ていますが、MicroK8s には master の snap ビルドが 1.37 で失敗するという [Issue](https://github.com/canonical/microk8s/issues/5607) が開いたままでした。[Ubuntu の Kubernetes のページ](https://ubuntu.com/kubernetes) では、MicroK8s は「Other distributions」の扱いで、前面に出ているのは Canonical Kubernetes（k8s snap）です。ただ、非推奨とはどこにも書かれていないので、今後どうなるのかは分かりません。

## Claude Code に実験を計画してもらう

ここからの実験は Claude Code に計画してもらいました。提案された内容は、同じマニフェスト（Deployment, PVC, Service, Ingress）を4つに適用し、ホストから `curl` で届くまでに何が必要かを記録するというものです。合わせて次のことも調べることになりました。

* インストール直後に何が入っているか
* NetworkPolicy で通信を拒否できるか
* メモリ使用量

LXD の VM をディストリビューションごとに1台ずつ立てて実験しました。

使ったマニフェストはこれです。

<details>
<summary>app.yaml</summary>

```yaml:app.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: web-data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      initContainers:
      - name: init
        image: busybox:1.37
        command: ["sh", "-c", "echo hello-from-pv > /data/index.html"]
        volumeMounts: [{name: data, mountPath: /data}]
      containers:
      - name: nginx
        image: nginx:1.29-alpine
        ports: [{containerPort: 80}]
        volumeMounts: [{name: data, mountPath: /usr/share/nginx/html}]
      volumes:
      - name: data
        persistentVolumeClaim: {claimName: web-data}
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector: {app: web}
  ports: [{port: 80}]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  rules:
  - host: test.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: {name: web, port: {number: 80}}
```

</details>

## 入れた直後の状態を比べる

インストールは、各 VM の root で次のコマンドを実行します。

```sh
# K3s
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.37.2+k3s1 sh -

# RKE2
curl -sfL https://get.rke2.io | INSTALL_RKE2_VERSION=v1.37.2+rke2r1 sh -
systemctl enable --now rke2-server

# k0s
curl -sSf https://get.k0s.sh | K0S_VERSION=v1.37.2+k0s.1 sh
k0s install controller --single
k0s start

# MicroK8s
snap install microk8s --classic --channel=1.36/stable
```

インストール直後に入っていたものです。データストアは VM の中で動いているプロセスやファイルで確認しました。

|          | StorageClass | IngressClass | CNI              | データストア   |
| -------- | ------------ | ------------ | ---------------- | -------------- |
| K3s      | `local-path` | `traefik`    | Flannel（vxlan） | SQLite         |
| RKE2     | なし         | `traefik`    | Canal            | etcd           |
| k0s      | なし         | なし         | kube-router      | SQLite（kine） |
| MicroK8s | なし         | なし         | Calico           | dqlite         |

## 同じアプリを動かして比べる

先ほどのマニフェストをそのまま適用すると、K3s だけが追加の作業なしで動きました。ホストからの `curl` にも PV に書いた内容が返ります。

```sh
curl -H 'Host: test.local' http://<ノードの IP>/
# -> hello-from-pv
```

ほかの3つは StorageClass がないので、PVC が Pending のまま止まりました。RKE2 は Traefik が入っているので、`curl` には Traefik の503が返ります。k0s と MicroK8s は80番ポートに接続できませんでした。

足りない部品を入れて、再度試しました。RKE2 と k0s のストレージに local-path-provisioner を選んだのは、K3s と条件をそろえるための Claude Code の判断で、公式が勧めているわけではありません。

|          | 足したもの                                      |
| -------- | ----------------------------------------------- |
| K3s      | なし                                            |
| RKE2     | local-path-provisioner                          |
| k0s      | local-path-provisioner, Traefik, MetalLB        |
| MicroK8s | `hostpath-storage` アドオン, `ingress` アドオン |

### Ingress

ingress-nginx が2026年3月に EOL になったので、Ingress は Traefik にそろってきています。[RKE2 は v1.36 から Traefik が標準](https://docs.rke2.io/networking/networking_services) になり、[MicroK8s の ingress アドオンも v1.35 から Traefik](https://canonical.com/microk8s/docs/addon-ingress) です。

Traefik までの経路は、それぞれ違いました。

* K3s: Service は LoadBalancer で、ServiceLB がノードの80番ポートを開けます
* RKE2: Service は ClusterIP で、DaemonSet の Traefik が `hostPort` で80番を開けます
* k0s: [公式の例](https://docs.k0sproject.io/stable/examples/traefik-ingress/) にならって、MetalLB が割り当てた専用の IP で受けます
* MicroK8s: DaemonSet の Traefik が `hostPort` で80番を開けます

MicroK8s の Ingress はアドオンを有効にするだけです。

```sh
microk8s enable ingress
```

MicroK8s は、Service の `EXTERNAL-IP` が `<pending>` のままで Ingress の `ADDRESS` も空でしたが、ノードの80番には届きました。ほかに `nginx` という IngressClass も用意されていて、中身は Traefik です。ドキュメントによると、`ingressClassName: nginx` の既存の Ingress をそのまま動かすためのものです。

k0s では Traefik と MetalLB を Chart リソースで入れました。k0s の設定ファイルに書く方法もありますが、[ドキュメント](https://docs.k0sproject.io/stable/helm-charts/) で推奨されているのはこちらで、k0s の再起動も要りません。MetalLB には別途 IP アドレスの範囲を設定します。

```yaml
apiVersion: helm.k0sproject.io/v1beta1
kind: Chart
metadata:
  name: traefik
  namespace: kube-system
spec:
  chartName: traefik/traefik
  version: "39.0.1"
  namespace: traefik-system
  repository:
    url: https://traefik.github.io/charts
```

### PV

RKE2 と k0s には、次のコマンドで local-path-provisioner を入れました。公式のマニフェストのままだと既定の StorageClass にならないので、アノテーションを付けます。

```sh
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.37/deploy/local-path-storage.yaml
kubectl patch storageclass local-path \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

MicroK8s はアドオンを有効にするだけです。

```sh
microk8s enable hostpath-storage
```

ただ、`hostpath-storage` を有効にすると、本番環境には向かないという警告が出ます。[アドオンの一覧](https://canonical.com/microk8s/docs/addons) でも「Not suitable for a production environment or clusters」と書かれています。複数ノードで使うなら、MicroK8s には `rook-ceph` や `mayastor` などのアドオンがあります。今回はシングルノードだけで、これらは試していません。

## CNI を比べる

標準の CNI と、ドキュメントに載っている選択肢です。

|          | 標準        | ほかの選択肢                                     |
| -------- | ----------- | ------------------------------------------------ |
| K3s      | Flannel     | Flannel を無効にして自分で導入                   |
| RKE2     | Canal       | Cilium, Calico, Flannel を同梱                   |
| k0s      | kube-router | Calico を同梱。自分で導入も可                    |
| MicroK8s | Calico      | Kube-OVN, Flannel。Cilium はコミュニティアドオン |

あとから変えるのは難しそうです。[RKE2](https://docs.rke2.io/networking/basic_network_options) は稼働中のクラスタでの変更をサポートしていません。[k0s](https://docs.k0sproject.io/stable/networking/) はクラスタの再構築が必要です。[MicroK8s](https://canonical.com/microk8s/docs/configure-cni) の Flannel への切り替えは、クラスタのリソースがすべて消える「destructive operation」だと警告されています。

NetworkPolicy は標準の CNI のままで4つとも有効でした。`app: web` への Ingress を拒否するポリシーを適用すると、次のようになりました。

|          | CNI                   | 拒否されたときの結果 |
| -------- | --------------------- | -------------------- |
| K3s      | Flannel + kube-router | Connection refused   |
| RKE2     | Canal                 | タイムアウト         |
| k0s      | kube-router           | Connection refused   |
| MicroK8s | Calico                | タイムアウト         |

私は Flannel（vxlan）だと NetworkPolicy は使えないと思っていました。Flannel 自体にはその機能がなく、K3s では組み込みの kube-router のコントローラーが処理しています。うちのクラスタのノードでも、`FORWARD` チェーンに `KUBE-ROUTER-FORWARD` がありました。

## バージョンアップの方法を比べる

ドキュメントで確認しました。実際の更新までは試していません。

|          | 仕組み                            | 最初から使えるか           | 自動更新                                                                    |
| -------- | --------------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| K3s      | system-upgrade-controller の Plan | コントローラーの導入が必要 | Plan の `channel` に追従                                                    |
| RKE2     | system-upgrade-controller の Plan | コントローラーの導入が必要 | Plan の `channel` に追従                                                    |
| k0s      | Autopilot の Plan                 | 使える                     | `UpdateConfig` で曜日や時間帯を指定（公開チャンネルは `edge_release` のみ） |
| MicroK8s | `snap refresh`                    | 使える                     | 同じチャンネル内のパッチ更新は標準で自動                                    |

K3s は更新用の CRD があって、Plan を apply すれば更新できるので便利です。[K3s](https://docs.k3s.io/upgrades/automated) と [RKE2](https://docs.rke2.io/upgrades/automated) は同じ system-upgrade-controller を使っていて、server を agent より先に更新するために Plan を2つ作るよう勧めています。

[k0s の Autopilot](https://docs.k0sproject.io/stable/autopilot/) は Plan の CRD が最初から入っていて、1つの Plan で controller を先に、そのあと worker の順に更新します。

[MicroK8s](https://canonical.com/microk8s/docs/upgrading) のマイナーバージョンの更新は、snap のチャンネルを切り替えます。複数ノードでは、drain, refresh, uncordon を1台ずつ行う手順になっています。アドオンと CNI はこの更新では上がりません。

```sh
sudo snap refresh microk8s --channel=1.36/stable
```

## メモリ使用量を比べる

`free` の `used` を比べました（単位は MB）。OS だけの状態でも 440〜490MB ほど使っています。

|          | インストール後5分 | 部品とアプリを入れたあと |
| -------- | ----------------- | ------------------------ |
| K3s      | 1,105             | 1,115                    |
| RKE2     | 1,490             | 1,562                    |
| k0s      | 938               | 1,306                    |
| MicroK8s | 1,002             | 1,240                    |

素の状態では k0s と MicroK8s のほうが K3s より少なく、部品を入れると K3s がいちばん少なくなりました。ただし、K3s の素の状態にはすでに Traefik と local-path-provisioner が含まれていて、k0s の数字には K3s にない MetalLB も含まれています。MicroK8s には、ほかの3つに入っている metrics-server がありません。

どれも1回ずつ測っただけです。K3s は単独で、ほかの3つは同時に VM を動かして測りました。x86 の VM での結果で、ラズパイでは試していません。参考値くらいに見てください。

## おわりに

同じアプリを動かすまでに足した部品は、K3s がゼロ、k0s が3つでした。K3s は全部入りですぐに使えるクラスタが、低い運用負荷で手に入るので相変わらず使い勝手が良いと思います。k0s は、Ingress とストレージを自分で選ぶ前提のディストリビューションで、パーツを選んでいく楽しさがありますね。

RKE2 は今回の調査で初めて知りました。この記事ではなんとなく影薄い感じでしたが、裏を返せば安定感がある印象です。  
MicroK8s は、開発があまり活発じゃなさそうなのが気になりはしますが、機能的に足りていないところは今回見当たりませんでした。

総じて、どのディストリビューションも運用上必要十分な機能を備えた Kubernetes だと思うので、好みや要件に合わせて選べば良いのではないでしょうか。

[^1]: [k0s - The Zero Friction Kubernetes](https://docs.k0sproject.io/stable/#scope) の Scope に「Many of the addons such as ingresses, service meshes, storage etc. are VERY opinionated.」とあります
