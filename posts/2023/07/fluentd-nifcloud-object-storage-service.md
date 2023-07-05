---
title: "Fluentdでニフクラのオブジェクトストレージサービスにログを送る"
date: "2023-07-05"
tags: ["Fluentd", "ニフクラ", "ログ"]
---

Fluentd の [fluent-plugin-s3](https://docs.fluentd.org/output/s3) を使ってニフクラのオブジェクトストレージサービスにログをアップロードする時のメモです。

## ポイント

* `s3_endpoint` を指定する
  * https://jp-east-1.storage.api.nifcloud.com または https://jp-west-2.storage.api.nifcloud.com
  * 参照: [エンドポイント](https://pfs.nifcloud.com/api/endpoint.htm#objectstorageservice)
* `force_path_style` を true にする
  * オブジェクトストレージサービスではパス形式にのみ対応しているのでこれを有効にします

## 試してみる

以下の3ファイルを用意して、立ち上げます。

```
$ docker compose build
$ docker compose up -d
```

`fluent.conf`

```
<source>
  @type forward
  port 24224
  bind 0.0.0.0
</source>

<match *.**>
  @type copy

  <store>
    @type s3
    aws_key_id YOUR_ACCESS_KEY
    aws_sec_key YOUR_SECRET_KEY
    s3_bucket testlogs
    s3_endpoint https://jp-east-1.storage.api.nifcloud.com
    force_path_style true
    store_as json
    <buffer tag,time>
        @type file
        path /home/fluent/s3
        timekey 5m
        timekey_wait 1m
        timekey_use_utc true
        chunk_limit_size 256m
    </buffer>
    <format>
        @type json
    </format>
  </store>

  <store>
    @type stdout
  </store>
</match>
```

`Dockerfile`

```dockerfile
FROM fluent/fluentd:v1.16-1

USER root

RUN gem install fluent-plugin-s3 --no-document

USER fluent

CMD ["fluentd", "-c", "/fluentd/etc/fluent.conf"]
```

`compose.yaml`

```yaml
services:
  web:
    image: httpd
    ports:
      - "30080:80"
    links:
      - fluentd
    logging:
      driver: fluentd
      options:
        fluentd-address: localhost:24224
        tag: httpd.access
  fluentd:
    build: .
    ports:
      - "24224:24224"
    volumes:
      - type: bind
        source: ./fluent.conf
        target: /fluentd/etc/fluent.conf
```

Apache サーバーにアクセスしてログを記録します。

```
$ curl localhost:30080
<html><body><h1>It works!</h1></body></html>
```

`<buffer>` セクションで `tag,time` と指定しているので、tag 毎 timekey の周期毎にログファイルが出力されます。今回は fluentd コンテナと web コンテナがそれぞれ別のタグを持つので、これらのログが5分おきに出力されることになります。

5分周期の1分後にバケットを見てみるとオブジェクトが入っているのが確認できます。例えば 14:23 に記録されたログは 14:20～14:25 まででまとめられ、14:26 にアップロードされます（タイムゾーンは UTC にしています）。

```json
$ nifcloud storage get-bucket --bucket testlogs
{
    "ContentType": "application/xml",
    "Contents": [
        {
            "ETag": "\"68cf22a205dc0c4266f3b5fa85446784\"",
            "Key": "202307051420_0.json",
            "LastModified": "2023-07-05T14:26:04.810000+00:00",
            "Owner": {
                "DisplayName": "...",
                "ID": "..."
            },
            "Size": "241",
            "StorageClass": "STANDARD"
        },
        {
            "ETag": "\"0f1244d190e74e397f3ce36b498b8228\"",
            "Key": "202307051420_1.json",
            "LastModified": "2023-07-05T14:26:10.045000+00:00",
            "Owner": {
                "DisplayName": "...",
                "ID": "..."
            },
            "Size": "1831",
            "StorageClass": "STANDARD"
        }
    ],
    "IsTruncated": false,
    "Marker": "",
    "MaxKeys": "1000",
    "Name": "testlogs",
    "Prefix": ""
}
```

web コンテナの方のログに、こんな感じのアクセスログが入っていれば OK です。

```
$ nifcloud storage get-object --bucket testlogs --object 202307051420_1.json 202307051420_1.json
```

```json
...
{"container_id":"448cfbf8ac075a8397acbd9cbffccf2d385b13febfef093b8270dba524b23d86","container_name":"/fluentd-web-1","source":"stdout","log":"172.23.0.1 - - [05/Jul/2023:14:23:18 +0000] \"GET / HTTP/1.1\" 200 45"}
```

## 参考文献

* [s3 - Fluentd](https://docs.fluentd.org/output/s3)
* [Buffer Plugins - Fluentd](https://docs.fluentd.org/buffer)
* [Docker Logging Driver - Fluentd](https://docs.fluentd.org/container-deployment/docker-logging-driver)
* [Docker Compose - Fluentd](https://docs.fluentd.org/container-deployment/docker-compose)
* [fluent-plugin-s3/lib/fluent/plugin/in_s3.rb at master · fluent/fluent-plugin-s3 · GitHub](https://github.com/fluent/fluent-plugin-s3/blob/master/lib/fluent/plugin/in_s3.rb)
