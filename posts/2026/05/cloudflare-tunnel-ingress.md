---
title: "Kubernetesの自宅サーバー公開をCloudflare Tunnelに移行した（VPS廃止）"
date: "2026-05-10"
tags: ["自宅サーバー", "ネットワーク", "Cloudflare", "Kubernetes", "K3s"]
---

以前の記事 [IPoE回線の自宅のWebサービスをVPN経由で固定IPのクラウドから公開する](/posts/2023/04/reverse-proxy-to-home-ipoe-network) では、IPoE 回線の自宅 Kubernetes クラスタを AWS Lightsail の VPS 経由（HAProxy + WireGuard）で外部公開する方法を紹介しました。あれから約3年、**Cloudflare Tunnel** を使った構成に切り替えたので、その記録を残しておきます。

## 困っていたこと

* 自宅 Kubernetes を外部公開するために Lightsail の VPS を経由していた
* 月額 $5 の固定費がかかっていた
* `cert-manager` による証明書管理はできていたが、VPS を挟む構成をもっとシンプルにしたかった

## 変更前の構成

![UML](//www.plantuml.com/plantuml/png/PP5Fwn916CVlyoeUf8CUf4DswH1AH4eX2svvyJBgk2xkpYmpivZ7d2AX10zIe1NKeOEH5255IMzcNF-yYsOtTt_2xpJVURwVvvalpvI5n5o6leV4mAK1vjY73lC3HWcL3Jdo273IaPWw7a48ToJZa7ii2Cy15X0QWJ8SSfLc0nwvJbyAx7ejMgrOd3qT9MWV1x6-f9ik9mz2pBlmnAedqD2vz1-6RS8faKIqgCqnwRa3k0arwd0YHCAx__LbKpHxhiUVj7ghrIfXS108XEAaKEHnjkBTD0pSWQfjMmt8bqgt2YYjPjZGCOHzpuByxizwhtxKcuVDwyFyUm4P9wMo4ESpCyulKoO9j9cKp0VMo_O042r_H-k57d_JwgjMMwrcMdsfMSRPlvkSFaxXncr4Q1VY0TV6c4q175-kelKBFTwaxLjJh5diVhJySFYvC9UyLkyJSt9wyse__xlxDJr-VbQucbisolp-Fm00)

## 変更後の構成

![UML](//www.plantuml.com/plantuml/png/NP0nwzD06CRt-nGldPhXZuET7AIW1OiYXSIjopMvnD3aBjnT1aTpLIkYT92A5OKA5gnG1waw5B_CsQP-2o-NsXIdFBdtzxpvNRf2OYxpD45Y7DCCSvo2pzACKKAbAnyb13Zn9QPHGX32lcGSMWy4uIt00d8Jq1c7rgs4vK6OO4w6j1T4n49-U8duPoGOqlRTV4Gu9P886B30iRpCAIN9PQUXXjJZc8Jn6Av1dqQS264xSPqlI_lPH1SVjNgZrTeoECi4GfKoNF4uUYYlRXetk05tF6_WGhlJkUuWFso6jOW1cck1Py-CURMxM6arrMfcmpUjdXzUVIg_BnnKDvjD__HEpsPGEr4c2OoOb2m55bO_3C2xvvRRelporUJRzzroiondJqqk9yl3_AszrcVpKKHe05N__oqdUzCuFbllDqzqiTLgLycgdJdi3rXl_-v3-MDXNjfQlRV3wP_vYyFhNxz_lZok7ZlDxgv9UPhy1G00)

Cloudflare Tunnel は、`cloudflared` というクライアントがアウトバウンド接続で Cloudflare のエッジサーバーへトンネルを張り続ける仕組みです。以前の WireGuard と同様に、ポート開放なしに外部からアクセスできます。さらに VPS が不要になるので固定費がゼロになり、Cloudflare が TLS 終端してくれるため `cert-manager` の管理も不要になります。

## 移行手順

### 1. DNS を Cloudflare に移行

Cloudflare Tunnel は Cloudflare DNS を使う構成が一般的なので、今回は DNS を Cloudflare に移行しました。ドメインレジストラの設定でネームサーバーを Cloudflare のものに変更し、既存の DNS レコードが正しく移行されているか確認します。

移行前に使っていた DNS レコードと同じ内容が Cloudflare 側にも登録されていることを確認します。この時点ではまだ VPS の静的 IP を向き先にしているので、Proxy status は **Proxied ではなく DNS only** にしておきます。

### 2. Cloudflare Tunnel を作成

Cloudflare の管理画面で操作します。

1. **Networking** → **Tunnels** を開く
2. **Create Tunnel** をクリック
3. 任意のトンネル名を入力して作成
   * ドメイン毎ではなく拠点や環境毎に作るものなので、場所がわかる命名がよさそう
   * 例: home, kubernetes, k3s...
4. **Operating System** として **Docker** を選択し、表示されるコマンドに含まれるトンネルトークン（`--token` の後ろ）をメモしておく
   ```
   docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ey...
   ```

### 3. Kubernetes に cloudflared をデプロイ

トンネルトークンを Kubernetes の Secret として登録します。

```sh
kubectl create namespace cloudflare
kubectl create secret generic cloudflared-credentials \
  --from-literal=token=<トンネルトークン> \
  -n cloudflare
```

次に Deployment を作成します。`replicas: 2` にすることで cloudflared の Pod が複数起動し、
Cloudflare との接続が冗長化されるため可用性が高まります。[^1]

[^1]: Cloudflare のドキュメントでは最低2レプリカを推奨しています。レプリカ数を増やすほど接続が安定しますが、個人利用であれば2で十分でしょう。

私は Helm chart 化してデプロイしましたが、以下に同等の内容の YAML を置いておきます。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: cloudflare
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      containers:
        - name: cloudflared
          image: cloudflare/cloudflared:latest
          args:
            - tunnel
            - --no-autoupdate
            - run
            - --token
            - $(TUNNEL_TOKEN)
          env:
            - name: TUNNEL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: cloudflared-credentials
                  key: token
```

Cloudflare Tunnel の画面で接続確認が取れれば OK です。

### 4. cloudflared の転送先を Traefik の Service に変更

Cloudflare Tunnel の管理画面の **Routes** で、公開するドメイン名とバックエンドサービスを紐付けます。

Service URL にはクラスタ内の Ingress controller の URL を指定します。  
例えば k3s 環境だと `kube-system` namespace に `traefik` という 80 番ポートの Service がある [^2] ので、`http://traefik.kube-system.svc.cluster.local:80` を指定すれば OK です。

[^2]: [ネットワーキングサービス | K3s](https://docs.k3s.io/ja/networking/networking-services)

1. **Add route** をクリック
1. **Published application** をクリック
1. 必要な項目を入力
   * Subdomain: 任意。必要なければ空
   * Domain: Cloudflare のゾーン
   * Path: 任意。必要なければ空
   * Service URL: クラスタ内の Ingress controller の URL
1. ルートを追加
   * 対応する DNS レコード（`<UUID>.cfargotunnel.com`）が追加されます

ルートドメインと任意のサブドメインをまとめて転送したければ、Subdomain が空のルートとワイルドカード (`*`) のルートの 2 つを作っておきます。

### 5. 動作確認

ブラウザで各サービスにアクセスして問題がないか確認します。

Traefik の Ingress ルーティング自体は変わらないので、ホスト名が一致していれば問題なく動くはずです。

### 6. cert-manager の TLS 設定を Ingress から削除

Cloudflare が TLS を終端するため、今回は Kubernetes 側の cert-manager を削除しました。Ingress リソースの `spec.tls` セクションおよび `cert-manager` のアノテーションを削除します。

```yaml
# 変更前
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths: ...
```

```yaml
# 変更後
spec:
  rules:
    - host: app.example.com
      http:
        paths: ...
```

## おわりに

Cloudflare Tunnel への移行は想像より簡単で、サービスを止めることなくスムーズに切り替えられました。固定費ゼロ・構成シンプル・cert-manager 不要は嬉しいですね。

## 参考文献

* [Cloudflare Tunnel · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
* [Kubernetes · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/)
