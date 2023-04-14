---
title: "IPoE回線の自宅のWebサービスをVPN経由で固定IPのクラウドから公開する"
date: "2023-04-15"
tags: ["自宅サーバー", "ネットワーク", "VPN", "WireGuard", "HAProxy"]
---

PPPoE 回線が遅いので IPoE（IPv4 over IPv6）へ移行しようと思いました。以前は2つのルーターを使って、PPPoE と IPoE の2セッションを張ることができたのですが、ある時からできなくなり、しばらく PPPoE だけで生活していました。とはいえやはり遅い、遅すぎる……ということで、今回の記事に至ります。

IPoE に移行するにあたっての課題は**任意のポートを開放できないこと**です。

代わりの方法を考えていたところ、ちょうど手元に1台 AWS Lightsail のサーバーがあったので、今回はこのサーバーに L4 Load Balancer 的なものをたて、自宅サーバーと VPN で接続することで実現しようと思いました。

## つくった構成

Home Server となっている部分は実際には単一のサーバーではなく Kubernetes クラスタ（MetalLB, Ingress NGINX Controller, cert-manager 使用）となっていてもう少し複雑ですが、基本的な構成は以下の通りです。

![network](//www.plantuml.com/plantuml/png/VP91IyCm68Rl_HKlEPUOT9tKZi661-TDzE11TeZDnrRScf6cLf7zTvlYOhLGwA5VyhoyUKXMjLFMDST3LBMwL3jyHK15hZNs3VUL8ziD_IAmCKTwD8qZYnUbjQMwnX9CtcHyBhaKWYTik-ZHsuDfz1FPztyikRs8CKX81arrOSkJAqtbaK4qncRzOCt79_9C84_JMOpdqj9Tewn6FfTP8YwDwyAPhglUgnDX2UN7VkiS3Ooyme_D7uE4o-kC2owkafGjeadT04ks3U24Qy37hh_9JenUuV_BWe8k6naC_CSQNSVCVy5YuYRQdOWH4j8t3LqcwUHohdEqeahxr_CD)

* クラウドサーバー
  * 固定グローバル IP があり、その IP が DNS に登録されている
  * WireGuard が 51820 番ポートで接続を受け付ける（サーバー役）
  * HAProxy が80・443番ポートで接続を受け付ける
    * リクエストが来たら仮想ネットワーク側に転送する
* 自宅
  * IPoE（IPv4 over IPv6）回線
  * 自宅サーバー
    * クラウドサーバーの WireGuard につなぎに行く（クライアント役）
      * OUT 方向なのでポート開放は不要
    * 80・443番ポートで Web サービスが稼働していることを想定
      * クラウドサーバーから仮想ネットワーク経由でつなぎに来る

## レシピ

### クラウドサーバー

クラウドサーバー上の各コンポーネントは docker compose で起動します。

`haproxy.cfg`

```
frontend http_rproxy
    mode tcp
    default_backend http_servers
    bind *:80

frontend https_rproxy
    mode tcp
    default_backend https_servers
    bind *:443

backend http_servers
    server home-server 10.13.13.2:80

backend https_servers
    server home-server 10.13.13.2:443
```

`compose.yaml`

```yaml
services:
  wireguard:
    image: linuxserver/wireguard
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Tokyo
      - SERVERURL=クラウドサーバーのIP
      - SERVERPORT=51820
      - PEERS=home-server
      - INTERNAL_SUBNET=10.13.13.0
      - ALLOWEDIPS=10.13.13.0/24
    volumes:
      - type: bind
        source: ./config
        target: /config
      - type: bind
        source: /lib/modules
        target: /lib/modules
    network_mode: "host"
    restart: unless-stopped
  haproxy:
    image: haproxy:lts
    volumes:
      - type: bind
        source: haproxy.cfg
        target: /usr/local/etc/haproxy/haproxy.cfg
    ports:
      - 80:80/tcp
      - 443:443/tcp
    sysctls:
      - net.ipv4.ip_unprivileged_port_start=0
    restart: unless-stopped
```

`docker compose up -d` します。

`ip a` や `ip r` で `wg0` のネットワークインターフェイスがあることや静的ルートが登録されていることを確認します。

起動すると config ディレクトリが作成され、その中に各 peer で使うためのコンフィグがあります。上記の設定例の場合は `config/peer_home-server/peer_home-server.conf` がそのファイルです。これを何らかの方法で自宅サーバーに転送してください。

`config/wg0.conf` は VPN サーバーのためのコンフィグです。この中の `[Peer]` セクションの AllowedIPs に任意の CIDR を書くことで、その CIDR への静的ルートを設定して wg0 で引き受けることができるようになります（要コンテナ再起動）。

また、今回は WireGuard のコンテナをホストのネットワークを使って構成しています。コンテナ環境に閉じた方が安全なのはそうなのですが、ちょっと手を抜きました。。

### 自宅サーバー側

ホストに WireGuard をインストールします。[^1]

[^1]: コンテナで起動させたい方は参考文献のリンク先に Client Mode の説明がありますのでそちらを見てください。

```shell
sudo apt update
sudo apt install wireguard resolvconf
```

転送してきた `peer_home-server.conf` を編集します。

`[Peer]` のセクションの後ろに `PersistentKeepAlive = 25` と1行追記します。この設定があることで、25秒おきにクライアントからサーバーに接続を確立し続けます（WireGuard は起動しただけでは接続を確立しません）。

この設定によって、常に VPN クライアント（自宅サーバー）から VPN サーバー（クラウドサーバー）に接続するようになるので、クラウドサーバーにいつエンドユーザーからのリクエストが飛んできても、そのリクエストを HAProxy が自宅サーバーに回すことができるようになります。

逆にこの設定がないと、サーバー側からクライアント側に接続しに行くことはできないので、エンドユーザーからのリクエストを転送できないことになります。

```
[Peer]
PublicKey = XI6TJ...
Endpoint = クラウドサーバーのIP:51820
AllowedIPs = 10.13.13.0/24
PersistentKeepAlive = 25
```

配置して、systemd が自動起動するように設定します。

```shell
sudo cp path/to/peer_home-server.conf /etc/wireguard/wg0.conf
sudo systemctl enable wg-quick@wg0.service --now
```

`ip a` で `wg0` のネットワークインターフェイスがあることを確認できれば OK です。

### 動作確認

DNS にクラウドの IP アドレスを設定して、リクエストが成功すれば OK です！

### おわりに

いったん最小の構成でうまくいくことがわかりました。レスポンス時間も個人で適当に使っているやつなのでほとんど気になりません。

VPN でクラウドと自宅との間が暗号化されているので、HAProxy で SSL 終端する、みたいな構成も可能かも。WireGuard の自宅サーバー側の peer や HAProxy の転送先を冗長化する、みたいな構成をとるのも面白いかも。

ではでは。

## 参考文献

* [haproxy](https://hub.docker.com/_/haproxy/)
* [linuxserver/wireguard](https://hub.docker.com/r/linuxserver/wireguard)
