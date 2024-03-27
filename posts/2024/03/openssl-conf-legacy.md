---
title: "やむを得ず最近のOpenSSLでレガシーなプロトコルを使いたい時の設定"
date: "2024-03-27"
tags: ["OpenSSL"]
---

レガシーなプロトコルやアルゴリズムにしか対応していないサーバーに接続する際、最近の OpenSSL がインストールされた環境からはデフォルト設定のままでは接続できないことがあります。サーバー側がすぐに改修できないなどのやむを得ない状況で回避する方法を紹介します。

## やること

OpenSSL は `OPENSSL_CONF` 環境変数に設定ファイルへのパスを入れることで作成した設定ファイルを読み込んでくれます。

今回は任意のディレクトリに次のような設定ファイルを作ります。

```
openssl_conf = openssl_init

[openssl_init]
ssl_conf = ssl_sect

[ssl_sect]
system_default = system_default_sect

[system_default_sect]
MinProtocol  = TLSv1
CipherString = DEFAULT:@SECLEVEL=0
```

`MinProtocol` は読んで字の如くです。

`CipherString` の `SECLEVEL` については [OpenSSL ドキュメント](https://www.openssl.org/docs/man3.0/man3/SSL_CTX_set_security_level.html)に記載があります。今回の検証環境では `0`（全て許可）まで下げる必要がありました。

## 検証する

### 検証環境

* OpenSSL 3.0.11
* nginx 1.25.4
* curl 7.88.1
* docker 25.0.3

```
├── cert
│   ├── cert.pem
│   └── key.pem
├── nginxconf
│   └── default.conf
└── opensslconf
    └── tlsv1.cnf
```

### 検証の準備

検証用に docker ネットワークと証明書を作ります。

```
docker network create mynet
openssl req \
  -x509 \
  -newkey rsa:4096 \
  -keyout cert/key.pem \
  -out cert/cert.pem \
  -sha256 \
  -days 3650 \
  -nodes \
  -subj "/CN=testserver"
```

nginx サーバーを立ち上げます。`./nginxconf/default.conf` に各ケースに記載の設定を入れます。

```
docker run -it --rm \
  -v ${PWD}/nginxconf:/etc/nginx/conf.d \
  -v ${PWD}/cert:/etc/ssl/certs/my \
  --net mynet \
  --name testserver \
  nginx
```

### サーバーが TLS 1.3 に対応している場合

まずは nginx をデフォルトの状態にして試します。

```
server {
    listen       443 ssl;
    server_name  localhost;
    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
    ssl_certificate     /etc/ssl/certs/my/cert.pem;
    ssl_certificate_key /etc/ssl/certs/my/key.pem;
}
```

そしてクライアント側（curl）も何も設定せずにアクセスします。当然うまくいきます。

```
docker run -it --rm --net mynet nginx curl -kvs -o /dev/null https://testserver
```

<details>
<summary>出力</summary>

```
*   Trying 172.20.0.2:443...
* Connected to testserver (172.20.0.2) port 443 (#0)
* ALPN: offers h2,http/1.1
} [5 bytes data]
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
} [512 bytes data]
* TLSv1.3 (IN), TLS handshake, Server hello (2):
{ [122 bytes data]
* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
{ [25 bytes data]
* TLSv1.3 (IN), TLS handshake, Certificate (11):
{ [1207 bytes data]
* TLSv1.3 (IN), TLS handshake, CERT verify (15):
{ [520 bytes data]
* TLSv1.3 (IN), TLS handshake, Finished (20):
{ [52 bytes data]
* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
} [1 bytes data]
* TLSv1.3 (OUT), TLS handshake, Finished (20):
} [52 bytes data]
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
* ALPN: server accepted http/1.1
* Server certificate:
*  subject: CN=testserver
*  start date: Mar  8 12:01:47 2024 GMT
*  expire date: Mar  6 12:01:47 2034 GMT
*  issuer: CN=testserver
*  SSL certificate verify result: self-signed certificate (18), continuing anyway.
* using HTTP/1.1
} [5 bytes data]
> GET / HTTP/1.1
> Host: testserver
> User-Agent: curl/7.88.1
> Accept: */*
> 
{ [5 bytes data]
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
{ [265 bytes data]
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
{ [281 bytes data]
* old SSL session ID is stale, removing
{ [5 bytes data]
< HTTP/1.1 200 OK
< Server: nginx/1.25.4
< Date: Fri, 08 Mar 2024 12:42:55 GMT
< Content-Type: text/html
< Content-Length: 615
< Last-Modified: Wed, 14 Feb 2024 16:03:00 GMT
< Connection: keep-alive
< ETag: "65cce434-267"
< Accept-Ranges: bytes
< 
{ [615 bytes data]
* Connection #0 to host testserver left intact
```

</details>

### TLS v1/v1.1 のみ対応している場合

次にサーバー側がレガシーな場合を想定して古いプロトコルのみに限定します。

```
server {
    listen       443 ssl;
    server_name  localhost;
    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
    ssl_certificate     /etc/ssl/certs/my/cert.pem;
    ssl_certificate_key /etc/ssl/certs/my/key.pem;
    ssl_protocols       TLSv1 TLSv1.1;
    ssl_ciphers         @SECLEVEL=0:ALL:!aNULL:!EXPORT56:RC4+RSA:+HIGH:+MEDIUM:+LOW:+SSLv2:+EXP
}
```

デフォルト状態のクライアントではエラーになりました。

```
docker run -it --rm --net mynet nginx curl -kvs -o /dev/null https://testserver --tlsv1
```

<details>
<summary>出力</summary>

```
*   Trying 172.20.0.2:443...
* Connected to testserver (172.20.0.2) port 443 (#0)
* ALPN: offers h2,http/1.1
} [5 bytes data]
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
} [512 bytes data]
* TLSv1.3 (IN), TLS handshake, Server hello (2):
{ [116 bytes data]
* TLSv1.1 (IN), TLS handshake, Certificate (11):
{ [1204 bytes data]
* TLSv1.1 (IN), TLS handshake, Server key exchange (12):
{ [554 bytes data]
* TLSv1.1 (OUT), TLS alert, internal error (592):
} [2 bytes data]
* OpenSSL/3.0.11: error:0A00014D:SSL routines::legacy sigalg disallowed or unsupported
* Closing connection 0
```

</details>

最初に記載した OpenSSL の設定ファイルを投入してみるとうまくいきました。

```
docker run -it --rm -v ${PWD}/opensslconf/tlsv1.cnf:/openssl.cnf -e OPENSSL_CONF=/openssl.cnf --net mynet nginx curl -kvs -o /dev/null https://testserver --tlsv1
```

<details>
<summary>出力</summary>

```
*   Trying 172.20.0.2:443...
* Connected to testserver (172.20.0.2) port 443 (#0)
* ALPN: offers h2,http/1.1
} [5 bytes data]
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
} [512 bytes data]
* TLSv1.3 (IN), TLS handshake, Server hello (2):
{ [116 bytes data]
* TLSv1.1 (IN), TLS handshake, Certificate (11):
{ [1204 bytes data]
* TLSv1.1 (IN), TLS handshake, Server key exchange (12):
{ [554 bytes data]
* TLSv1.1 (IN), TLS handshake, Server finished (14):
{ [4 bytes data]
* TLSv1.1 (OUT), TLS handshake, Client key exchange (16):
} [37 bytes data]
* TLSv1.1 (OUT), TLS change cipher, Change cipher spec (1):
} [1 bytes data]
* TLSv1.1 (OUT), TLS handshake, Finished (20):
} [16 bytes data]
* TLSv1.1 (IN), TLS handshake, Finished (20):
{ [16 bytes data]
* SSL connection using TLSv1.1 / ECDHE-RSA-AES256-SHA
* ALPN: server accepted http/1.1
* Server certificate:
*  subject: CN=testserver
*  start date: Mar  8 12:01:47 2024 GMT
*  expire date: Mar  6 12:01:47 2034 GMT
*  issuer: CN=testserver
*  SSL certificate verify result: self-signed certificate (18), continuing anyway.
* using HTTP/1.1
} [5 bytes data]
> GET / HTTP/1.1
> Host: testserver
> User-Agent: curl/7.88.1
> Accept: */*
> 
{ [5 bytes data]
< HTTP/1.1 200 OK
< Server: nginx/1.25.4
< Date: Fri, 08 Mar 2024 13:58:03 GMT
< Content-Type: text/html
< Content-Length: 615
< Last-Modified: Wed, 14 Feb 2024 16:03:00 GMT
< Connection: keep-alive
< ETag: "65cce434-267"
< Accept-Ranges: bytes
< 
{ [615 bytes data]
* Connection #0 to host testserver left intact
```

</details>

## 参考文献

* [OpenSSL | Ubuntu](https://ubuntu.com/server/docs/openssl)
* [/docs/man1.1.1/man5/config.html](https://www.openssl.org/docs/man1.1.1/man5/config.html)
* [Module ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
* [AlmaLinux 9 上の nginx で TLSv1, TLSv1.1 を有効にする](https://zenn.dev/labocho/articles/f38e8de5012bdd)
