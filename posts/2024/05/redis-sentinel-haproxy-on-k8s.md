---
title: "Kubernetes上でRedisをSentinelで冗長化しつつエンドポイントは1つにしたい"
date: "2024-05-11"
tags: ["Redis", "Kubernetes", "HAProxy"]
---

おうち Kubernetes で動かすアプリの一時的なデータの保存場所として Redis を使用しています。[redis](https://hub.docker.com/_/redis) イメージのコンテナを立てているだけで何の永続化もしていないのでコンテナが落ちればもちろんデータは消えます。本当に永続化したい情報は DynamoDB に格納しているとはいえ、もうちょい Redis の可用性（というか永続性？）も上げたい、でもクラウドのマネージドサービスを使うほどでもない……という微妙な要件を満たすために Redis Sentinel に挑戦してみます。

## やること

* Redis の冗長化を実現する方法について理解する
* Helm chart [dandydev/redis-ha](https://github.com/DandyDeveloper/charts/tree/master/charts/redis-ha) でデプロイ
  * Sentinel が自動フェイルオーバー
  * HAProxy が master を検出してプロキシする
    * なのでクライアント側は Sentinel 用のクライアントじゃなくて OK

### 環境

* Kubernetes 1.28
* Helm 3.11.2
* dandydev/redis-ha 4.26.6

## Redis の冗長化

まず、Redis の冗長化について何も知らなかったので勉強するところから始めました。分かりやすかった記事のリンクを参考文献に載せておきますのでご参照ください。

ポイントとしては、

* Replication
  * Master と replica のみ
  * 自動フェイルオーバーはなし
  * Replica は read-only
* Sentinel
  * Master/replica の死活監視をして、障害時に自動フェイルオーバーをするソフトウェアのこと
  * 多数決で決めるので3台以上の奇数台の Sentinel プロセスを立ち上げる必要がある
  * 仮想 IP (VIP) の機能はない
    * クライアントからは誰が master なのかわからないので、Sentinel 対応したクライアントを使うか、HAProxy や keepalived のようなソフトウェアを組み合わせる
    * Sentinel が設定情報を提供してくれるので、Sentinel に聞けば誰が master をやってるか教えてくれる
* Cluster
  * マルチマスター構成
  * シャーディングできる
    * データによって違う master に書き込むようにするので負荷分散ができる
  * Master がダウンしても各シャード内で replica が生きていれば稼働できる

今回は Redis に大量の書き込みがあるわけでもないのでシャーディングは不要です。Sentinel を導入して自動フェイルオーバーができれば十分そうです。しかしながら、Sentinel だけだとクライアント側も Sentinel に対応したものでなくてはならず、既存のアプリのコードも書き換えなきゃいけません。Redis のエンドポイントをバチッと切り替えるだけで済ませたいので、今回は何らかの方法で単一のエンドポイントで受けて、そこから稼働中 master に対してアクセスできるようにしたいと考えました。

と思って調べたら、ドンピシャの Helm chart が紹介されていました。

[Redis on Kubernetesの検討ポイントとredis-ha Helm chart](https://blog.mosuke.tech/entry/2021/03/03/redis-on-kubernetes/)

[DandyDeveloper/charts](https://github.com/DandyDeveloper/charts/tree/master) というリポジトリで公開されている [redis-ha](https://github.com/DandyDeveloper/charts/tree/master/charts/redis-ha) という chart を使えば Redis + Sentinel + HAProxy の構成を作れそうです。

## デプロイ

```sh
helm repo add dandydev https://dandydeveloper.github.io/charts
helm install redis-ha dandydev/redis-ha \
  -n redis --create-namespace \
  --version 4.26.6 \
  --set haproxy.enabled=true
```

```
NAME: redis-ha
LAST DEPLOYED: Sat May 11 19:30:41 2024
NAMESPACE: redis
STATUS: deployed
REVISION: 1
NOTES:
Redis can be accessed via port 6379   and Sentinel can be accessed via port 26379    on the following DNS name from within your cluster:
redis-ha.redis.svc.cluster.local

To connect to your Redis server:
1. Run a Redis pod that you can use as a client:

   kubectl exec -it redis-ha-server-0 -n redis -c redis -- sh

2. Connect using the Redis CLI:

  redis-cli -h redis-ha.redis.svc.cluster.local
```

案内されているように動作確認してみます。

```sh
kubectl exec -it redis-ha-server-0 -n redis -c redis -- sh
```

```sh
redis-cli -h redis-ha.redis.svc.cluster.local
```

```
$ kubectl exec -it redis-ha-server-0 -n redis -c redis -- sh
/data $ redis-cli -h redis-ha.redis.svc.cluster.local
redis-ha.redis.svc.cluster.local:6379> SET test:hoge fuga
OK
redis-ha.redis.svc.cluster.local:6379> GET test:hoge
"fuga"
```

何がデプロイされているのか見てみます。[^1]

```
$ kubectl -n redis get all
NAME                                    READY   STATUS    RESTARTS   AGE
pod/redis-ha-haproxy-5d999d867c-9vwf8   1/1     Running   0          5m59s
pod/redis-ha-haproxy-5d999d867c-czdbz   1/1     Running   0          5m59s
pod/redis-ha-haproxy-5d999d867c-jcrdh   1/1     Running   0          5m59s
pod/redis-ha-server-0                   3/3     Running   0          5m59s
pod/redis-ha-server-1                   3/3     Running   0          4m43s
pod/redis-ha-server-2                   3/3     Running   0          3m42s

NAME                          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)              AGE
service/redis-ha              ClusterIP   None            <none>        6379/TCP,26379/TCP   5m59s
service/redis-ha-announce-0   ClusterIP   10.43.65.114    <none>        6379/TCP,26379/TCP   5m59s
service/redis-ha-announce-1   ClusterIP   10.43.221.168   <none>        6379/TCP,26379/TCP   5m59s
service/redis-ha-announce-2   ClusterIP   10.43.30.206    <none>        6379/TCP,26379/TCP   5m59s
service/redis-ha-haproxy      ClusterIP   10.43.116.194   <none>        6379/TCP             5m59s

NAME                               READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/redis-ha-haproxy   3/3     3            3           5m59s

NAME                                          DESIRED   CURRENT   READY   AGE
replicaset.apps/redis-ha-haproxy-5d999d867c   3         3         3       5m59s

NAME                               READY   AGE
statefulset.apps/redis-ha-server   3/3     5m59s
```

[^1]: ちなみに Helm chart に設定された replica の数よりもスケジュール可能なノードの数が少ないと、pod は Pending のままになります（`topologyKey: kubernetes.io/hostname` のため）。  
https://github.com/DandyDeveloper/charts/blob/0fe831e1c5171dd0217e1f543d40798f473a561f/charts/redis-ha/templates/redis-ha-statefulset.yaml#L73-L92

適当に Sentinel を選択して、master が誰かを確認してみます。

```
$ kubectl exec -it redis-ha-server-0 -n redis -c redis -- sh
/data $ redis-cli -h 10.42.0.53 -p 26379
10.42.0.53:26379> sentinel masters
1)  1) "name"
    2) "mymaster"
    3) "ip"
    4) "10.43.65.114"
    5) "port"
    6) "6379"
    ... (省略)
```

`10.43.65.114` は `redis-ha-announce-0` の service でした。つまり、現在の master は `redis-ha-server-0` ぽいです。

<details><summary>kubectl の出力</summary>

```
$ kubectl -n redis describe svc redis-ha-announce-0
Name:              redis-ha-announce-0
Namespace:         redis
Labels:            app=redis-ha
                   app.kubernetes.io/managed-by=Helm
                   chart=redis-ha-4.26.6
                   heritage=Helm
                   release=redis-ha
Annotations:       meta.helm.sh/release-name: redis-ha
                   meta.helm.sh/release-namespace: redis
Selector:          app=redis-ha,release=redis-ha,statefulset.kubernetes.io/pod-name=redis-ha-server-0
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.43.65.114
IPs:               10.43.65.114
Port:              tcp-server  6379/TCP
TargetPort:        redis/TCP
Endpoints:         10.42.0.53:6379
Port:              tcp-sentinel  26379/TCP
TargetPort:        sentinel/TCP
Endpoints:         10.42.0.53:26379
Session Affinity:  None
Events:            <none>
$ kubectl -n redis get po -l app=redis-ha -o custom-columns=NAME:.metadata.name,IP:.status.podIP
NAME                IP
redis-ha-server-0   10.42.0.53
redis-ha-server-1   10.42.1.82
redis-ha-server-2   10.42.3.9
```

</details>

`redis-ha-server-0` では SET できますが `redis-ha-server-1` では SET できません。

```
/data $ redis-cli -h 10.42.0.53
10.42.0.53:6379> SET test:piyo piyo
OK
10.42.0.53:6379> exit
/data $ redis-cli -h 10.42.1.82
10.42.1.82:6379> SET test:foo bar
(error) READONLY You can't write against a read only replica.
```

Master である `redis-ha-server-0` pod を削除してみます。

```
kubectl -n redis delete po redis-ha-server-0
```

もう一回 redis-cli のためのシェルを開きます。

```
kubectl exec -it redis-ha-server-0 -n redis -c redis -- sh
```

Master を確認すると IP が変わっています。これは `redis-ha-announce-2` service でした。

```
/data $ redis-cli -h 10.42.0.55 -p 26379
10.42.0.55:26379> sentinel masters
1)  1) "name"
    2) "mymaster"
    3) "ip"
    4) "10.43.30.206"
    5) "port"
    6) "6379"
    ... (省略)
```

今度は `redis-ha-server-0` では書き込みできず、新しい master の `redis-ha-server-2` では書き込みできました。HAProxy 経由も OK でした。

```
/data $ redis-cli -h 10.42.0.55
10.42.0.55:6379> SET test:foo bar
(error) READONLY You can't write against a read only replica.
10.42.0.55:6379> exit
/data $ redis-cli -h 10.42.3.9
10.42.3.9:6379> SET test:foo bar
OK
/data $ redis-cli -h redis-ha-haproxy.redis.svc.cluster.local
redis-ha-haproxy.redis.svc.cluster.local:6379> SET test:baz baz
OK
```

HAProxy のログ的にも切り替わっていることがわかります。

```
$ kubectl -n redis logs redis-ha-haproxy-5d999d867c-9vwf8
... (省略)
[ALERT]    (8) : backend 'check_if_redis_is_master_0' has no server available!
[WARNING]  (8) : Server check_if_redis_is_master_2/R0 is UP, reason: Layer7 check passed, code: 0, info: "(tcp-check)", check duration: 2ms. 3 active and 0 backup servers online. 0 sessions requeued, 0 total in queue.
```

お片付けします。

```sh
helm -n redis uninstall redis-ha
```

## 参考文献

* [charts/charts/redis-ha at master · DandyDeveloper/charts](https://github.com/DandyDeveloper/charts/tree/master/charts/redis-ha)
* [Redis on Kubernetesの検討ポイントとredis-ha Helm chart](https://blog.mosuke.tech/entry/2021/03/03/redis-on-kubernetes/)
* [Redisの冗長化 - SRA OSS Tech Blog](https://www.sraoss.co.jp/tech-blog/redis/redis-ha/)
* [Redis Clusterを冗長構成で構築 - Carpe Diem](https://christina04.hatenablog.com/entry/redis-cluster-redundancy)
* [High availability with Redis Sentinel | Docs](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/)
