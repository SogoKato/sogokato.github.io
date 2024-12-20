---
title: "Dockerが16KiB以上のログを分割する問題にFluentd側で対処する"
date: "2024-01-15"
tags: ["Fluentd", "Docker", "ログ"]
---

Docker のログドライバーは 16KiB (16384 バイト) 以上のメッセージの場合、ログを分割してしまいます。

[fluent-plugins-nursery/fluent-plugin-concat](https://github.com/fluent-plugins-nursery/fluent-plugin-concat) を使うことで分割されてしまったログを連結して1つにまとめられるようなので検証してみました。

## 試してみる

用意したファイルは以下です。16383バイトのログと16384バイトのログを20秒間隔で出力するアプリを用意して docker の fluentd ログドライバーで fluentd コンテナに送ります。この方法は Docker 19.03 以上で使えるようです[^1]。

[^1]: 20.10 以上かつ journald ログドライバーの場合はより良い方法があるので [fluent-plugins-nursery/fluent-plugin-concat の README](https://github.com/fluent-plugins-nursery/fluent-plugin-concat) を参照してください

<details>
<summary> compose.yaml </summary>

```yaml
services:
  app:
    build:
      context: ./
      dockerfile: app.dockerfile
    links:
      - fluentd
    logging:
      driver: fluentd
      options:
        fluentd-address: 127.0.0.1:24224
        tag: docker.{{.Name}}
  fluentd:
    build:
      context: ./
      dockerfile: fluentd.dockerfile
    ports:
      - "24224:24224"
    volumes:
      - type: bind
        source: ./fluent.conf
        target: /fluentd/etc/fluent.conf
```

</details>

<details>
<summary> app.dockerfile </summary>

```dockerfile
FROM python

COPY main.py main.py

EXPOSE 8080

CMD ["python3", "main.py"]
```

</details>

<details open>
<summary> main.py </summary>

```python
from time import sleep


def main():
    while True:
        # 128 chars * 128 = 16384 chars
        TEXT = "Lorem ipsum dolor sit amet suscipit est molestie dolor et sit. Id invidunt eos sed tation amet sadipscing nulla et magna minim. "
        COUNT = 128
        print((TEXT * COUNT)[:-1])  # ok
        print((TEXT * COUNT))  # will be split
        sleep(20)


if __name__ == "__main__":
    main()
```

</details>

<details>
<summary> fluentd.dockerfile </summary>

```dockerfile
FROM fluent/fluentd:v1.16-1

USER root

RUN gem install fluent-plugin-concat --no-document

USER fluent

CMD ["fluentd", "-c", "/fluentd/etc/fluent.conf"]
```

</details>

<details open>
<summary> fluent.conf </summary>

```
<source>
  @type forward
  port 24224
  bind 0.0.0.0
</source>

# これを追加
<filter>
  @type concat
  key log
  use_partial_metadata true
  separator ""
</filter>

<match *.**>
  @type stdout
</match>
```

</details>

`docker compose up --build -d` で実行します。

`<filter>` が書かれていない場合は `main.py` の2つめの `print` が分割されてしまいます。

`docker compose logs fluentd` した結果が以下です。`partial_message` や `partial_id` `partial_ordinal` `partial_last` のキーがあり、ログが2つに分割されてしまっています。

```
fluentd-fluentd-1  | 2024-01-15 09:12:40.000000000 +0000 docker.fluentd-app-1: {"source":"stdout","log":"Lorem ipsum ...省略... magna minim.","container_id":"b84c01ade2c56482bd6ba101d84a4b0816a55ea997ecf3921396857323a26c59","container_name":"/fluentd-app-1"}
fluentd-fluentd-1  | 2024-01-15 09:12:40.000000000 +0000 docker.fluentd-app-1: {"container_id":"b84c01ade2c56482bd6ba101d84a4b0816a55ea997ecf3921396857323a26c59","container_name":"/fluentd-app-1","source":"stdout","log":"Lorem ipsum ...省略... magna minim. ","partial_message":"true","partial_id":"3ca26e62f6e0c2ad87d6961eeef2af0456d655102d07cb2668020a01b2882bf1","partial_ordinal":"1","partial_last":"false"}
fluentd-fluentd-1  | 2024-01-15 09:12:40.000000000 +0000 docker.fluentd-app-1: {"container_id":"b84c01ade2c56482bd6ba101d84a4b0816a55ea997ecf3921396857323a26c59","container_name":"/fluentd-app-1","source":"stdout","log":"","partial_message":"true","partial_id":"3ca26e62f6e0c2ad87d6961eeef2af0456d655102d07cb2668020a01b2882bf1","partial_ordinal":"2","partial_last":"true"}
```

次は `<filter>` が追記された状態でコンテナを起動します。16384バイトのメッセージも1つのログとして扱われるようになりました。😊

```
fluentd-fluentd-1  | 2024-01-15 09:28:28.000000000 +0000 docker.fluentd-app-1: {"log":"Lorem ipsum ...省略... magna minim.","container_id":"b84c01ade2c56482bd6ba101d84a4b0816a55ea997ecf3921396857323a26c59","container_name":"/fluentd-app-1","source":"stdout"}
fluentd-fluentd-1  | 2024-01-15 09:28:28.000000000 +0000 docker.fluentd-app-1: {"container_id":"b84c01ade2c56482bd6ba101d84a4b0816a55ea997ecf3921396857323a26c59","container_name":"/fluentd-app-1","source":"stdout","log":"Lorem ipsum ...省略... magna minim. "}
```

## 参考文献

* [fluent-plugins-nursery/fluent-plugin-concat: Fluentd Filter plugin to concatenate multiline log separated in multiple events.](https://github.com/fluent-plugins-nursery/fluent-plugin-concat)
* [log message is split when using fluentd logging driver · Issue #34620 · moby/moby](https://github.com/moby/moby/issues/34620)
* [Dockerのログが16Kで分割されてしまう制限について | book-reviews.blog](https://book-reviews.blog/docker-log-is-splitted-by-16k/)
