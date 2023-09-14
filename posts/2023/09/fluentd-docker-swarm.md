---
title: "FluentdをDocker SwarmにDaemonSet的に配置してログを収集する"
date: "2023-09-15"
tags: ["Fluentd", "Docker"]
---

Docker Swarm 上のサービスのログを fluentd を使って送信するためのメモです。

Kubernetes で同様のことを実現する場合、Forwarder として使う fluentd を DaemonSet として起動してノード上のログを集めさせることが一般的です。今回は Swarm クラスター内の各ノードに1つずつ fluentd を起動して、あるノード上で動くコンテナのログはそのノード上の fluentd に集まるように設定していきます。

## ポイント

* 各ノードに配置するには `global` モードでデプロイ
* `fluentd-address` は `localhost` ではなく `127.0.0.1`
* buffer を永続化しておく場合は volumes を指定しておけば各ノードに volume が作られる

## 試してみる

S3 バケットは各自用意してください。

`compose.yaml`

```yaml
services:
  fluentd:
    image: testfluentd # 適当に変えてね
    ports:
      - "24224:24224"
    volumes:
      - fluentd-data:/home/fluent
    deploy:
      mode: global
  web:
    image: httpd
    ports:
      - "30080:80"
    logging:
      driver: fluentd
      options:
        fluentd-address: 127.0.0.1:24224 # ここをlocalhost:24224にするとログが届かない
        tag: httpd.access
volumes:
  fluentd-data:
```

`Dockerfile`

```dockerfile
FROM fluent/fluentd:v1.16-1

USER root

RUN gem install fluent-plugin-s3 --no-document

USER fluent

COPY fluent.conf /fluentd/etc/fluent.conf

CMD ["fluentd", "-c", "/fluentd/etc/fluent.conf"]
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
    @type stdout
  </store>

  <store>
    @type s3
    aws_key_id YOUR_ACCESS_KEY
    aws_sec_key YOUR_SECRET_KEY
    s3_bucket mytestbucket
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
</match>
```

適当に Swarm 環境を用意して（Docker Desktop で `docker swarm init` だけでも OK）、stack deploy したら、 http://localhost:30080 にアクセスしてみて fluentd のコンテナの標準出力ログに apache のログが届くかを確認してみましょう。`fluentd-address` を `localhost:24224` にしてみて本当にログが来なくなるのかを試してみるのも良いと思います。クラスターを組んでいる人は、各ノードにコンテナやボリュームがあるかを見てみてください。

何回か apache にリクエストを飛ばしてから `docker service update test_stack_fluentd --force` で fluentd コンテナを再起動させ、S3 にアップロードされたログを数分後に確認してみて、ログの欠損がないかどうかを確認できます。また、未送信のバッファファイルを見てみるのもいいかもしれません。

```
$ docker exec 3c7c8bf0fb89 ls /home/fluent/s3
buffer.b60553a7c4957c7c0d70adf0aadd8a58f.log
buffer.b60553a7c4957c7c0d70adf0aadd8a58f.log.meta
```

## 参考文献

* [Replicated or global services - Deploy services to a swarm](https://docs.docker.com/engine/swarm/services/#replicated-or-global-services)
* [Docker swarm modeでfluentdにログを集約する際の注意点](https://qiita.com/msx2mac/items/eff996ba8f028c45aaf5)
* [Log files are not being created when running fluentd as 1.12 swarm mode service #58](https://github.com/fluent/fluentd-docker-image/issues/58)
* [KubernetesでFluentdの信頼性を担保するための3つの観点](https://taisho6339.hatenablog.com/entry/2021/04/22/200508)
