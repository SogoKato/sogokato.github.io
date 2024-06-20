---
title: "非EKSなK8sクラスターでmountpoint-s3-csi-driverを試す"
date: "2024-06-20"
tags: ["Kubernetes", "AWS", "S3"]
---

AWS が公開している [mountpoint-s3-csi-driver](https://github.com/awslabs/mountpoint-s3-csi-driver) を使うと Kubernetes 上のコンテナから S3 オブジェクトをファイルシステム的に扱えるようになるみたいなので、（EKS クラスターは持っていないので自宅のクラスタで）試してみました。

画像などのファイルをキャッシュとして置いているアプリケーションをコードの書き換えなしで S3 に置くようにしたり、大きめの（コンテナイメージには含めたくない）ファイルを S3 に置いておいて読み込むようにしたりとか、便利に使えるシチュエーションがありそうです。

## 環境

* Kubernetes 1.29.4
  * [k3s で構築](/posts/2023/06/k3s-setup)
* Kubectl 1.29.1
* Helm 3.15.2
* awslabs/mountpoint-s3-csi-driver 1.7.0

## 準備

### S3 バケット作成

任意の名前でバケットを作成します。管理コンソールからデフォルトの設定のままで作りました。

### IAM 設定

[ドキュメント](https://github.com/awslabs/mountpoint-s3/blob/main/doc/CONFIGURATION.md#iam-permissions)に記載のサンプルを参考に、IAM ポリシーを作ります。`YOUR-BUCKET-NAME-HERE` 部分には作ったバケットの名前を入れます。

```json
{
   "Version": "2012-10-17",
   "Statement": [
        {
            "Sid": "MountpointFullBucketAccess",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME-HERE"
            ]
        },
        {
            "Sid": "MountpointFullObjectAccess",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:AbortMultipartUpload",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME-HERE/*"
            ]
        }
   ]
}
```

IAM ユーザーを作成して、上記ポリシーをアタッチします。

## Secret の作成

IAM ユーザーのアクセスキーを発行して、secret として保存します。名前は helm でデフォルト値として設定されているのでそのまま作ってください。

```sh
kubectl create secret generic aws-secret \
    --namespace kube-system \
    --from-literal "key_id=${AWS_ACCESS_KEY_ID}" \
    --from-literal "access_key=${AWS_SECRET_ACCESS_KEY}"
```

今回は検証なので secret を作りましたが、ちゃんとやるなら [IAM Roles Anywhere](https://aws.amazon.com/jp/blogs/news/extend-aws-iam-roles-to-workloads-outside-of-aws-with-iam-roles-anywhere/) を使ったほうがいいかも。

> Using a secret object: create an IAM user, attach the policy to it, then create a generic secret in the kube-system namespace with the IAM user's credentials. We don't recommend this option because it requires long-lived credentials.

https://github.com/awslabs/mountpoint-s3-csi-driver/blob/main/docs/install.md#configure-access-to-s3

## CSI ドライバーのインストール

Helm でデプロイします。IAM ユーザーのアクセスキーを発行して環境変数に入れておきます。

```sh
helm repo add aws-mountpoint-s3-csi-driver https://awslabs.github.io/mountpoint-s3-csi-driver
helm repo update
helm upgrade --install aws-mountpoint-s3-csi-driver \
    --namespace kube-system \
    aws-mountpoint-s3-csi-driver/aws-mountpoint-s3-csi-driver
```

Pod が実行されているか検証します。

```sh
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-mountpoint-s3-csi-driver
```

```
NAME                READY   STATUS    RESTARTS   AGE
s3-csi-node-9mc24   3/3     Running   0          17s
s3-csi-node-ghzhg   3/3     Running   0          17s
s3-csi-node-jrrr9   3/3     Running   0          17s
s3-csi-node-vcj4h   3/3     Running   0          17s
```

## Pod に persistent volume をマウントしてオブジェクトを書き込み

[mountpoint-s3-csi-driver/examples/kubernetes/static_provisioning](https://github.com/awslabs/mountpoint-s3-csi-driver/tree/main/examples/kubernetes/static_provisioning) に色んな例が載っているのでみてみると良いと思います。

とりあえず一番シンプルな [static_provisioning.yaml](https://github.com/awslabs/mountpoint-s3-csi-driver/blob/main/examples/kubernetes/static_provisioning/static_provisioning.yaml) を試します。

ダウンロードして PV の `spec.mountOptions` と `spec.csi.volumeAttributes.bucketName` を編集しました。

```sh
curl -LO https://raw.githubusercontent.com/awslabs/mountpoint-s3-csi-driver/main/examples/kubernetes/static_provisioning/static_provisioning.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: s3-pv
spec:
  capacity:
    storage: 1200Gi # ignored, required
  accessModes:
    - ReadWriteMany # supported options: ReadWriteMany / ReadOnlyMany
  mountOptions:
    - allow-delete
    - region ap-northeast-1
  csi:
    driver: s3.csi.aws.com # required
    volumeHandle: s3-csi-driver-volume
    volumeAttributes:
      bucketName: YOUR-BUCKET-NAME-HERE
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: s3-claim
spec:
  accessModes:
    - ReadWriteMany # supported options: ReadWriteMany / ReadOnlyMany
  storageClassName: "" # required for static provisioning
  resources:
    requests:
      storage: 1200Gi # ignored, required
  volumeName: s3-pv
---
apiVersion: v1
kind: Pod
metadata:
  name: s3-app
spec:
  containers:
    - name: app
      image: centos
      command: ["/bin/sh"]
      args: ["-c", "echo 'Hello from the container!' >> /data/$(date -u).txt; tail -f /dev/null"]
      volumeMounts:
        - name: persistent-storage
          mountPath: /data
  volumes:
    - name: persistent-storage
      persistentVolumeClaim:
        claimName: s3-claim
```

```sh
kubectl apply -f static_provisioning.yaml
```

バケットにファイルが作成されていることを確認します。

```sh
aws s3 ls s3://YOUR-BUCKET-NAME-HERE
```

```
2024-06-20 18:42:18         26 Thu Jun 20 09:42:17 UTC 2024.txt
```

オブジェクトの中身を見てみます。

```sh
aws s3 cp s3://YOUR-BUCKET-NAME-HERE/"Thu Jun 20 09:42:17 UTC 2024.txt" ./
cat "Thu Jun 20 09:42:17 UTC 2024.txt"
```

```
Hello from the container!
```

良さそうですね。

## お片付け

```sh
kubectl delete -f static_provisioning.yaml
helm uninstall aws-mountpoint-s3-csi-driver --namespace kube-system
kubectl delete secret aws-secret --namespace kube-system
```

## 参考文献

* [awslabs/mountpoint-s3-csi-driver: Mountpoint for Amazon S3 CSI Driver](https://github.com/awslabs/mountpoint-s3-csi-driver)
* [awslabs/mountpoint-s3: A simple, high-throughput file client for mounting an Amazon S3 bucket as a local file system.](https://github.com/awslabs/mountpoint-s3/tree/main)
