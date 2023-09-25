---
title: "ニフクラのリソースを比較できるツールnifdiffを作った"
date: "2023-09-25"
tags: ["ニフクラ", "Go"]
---

2つのファイアウォールグループのルールの差分を見たいことがあって、ちょっとしたツールを作ってみました。

## nifdiff とは

* 2つのニフクラリソースの差分を見ることができるツール
* 同一アカウント内であれば、リージョンまたぎで比較できる
* 現状対応しているのはファイアウォールグループのみ

https://github.com/SogoKato/nifdiff

こんな感じのコマンドを投げると

```
nifdiff nrn:nifcloud:computing:jp-east-1::security_group:FirewallJE1 nrn:nifcloud:computing:jp-west-2::security_group:FirewallJW2
```

こんなふうに差分がわかります。

```
Mismatch:
  types.SecurityGroupInfo{
-       AvailabilityZone:        &"east-11",
+       AvailabilityZone:        &"jp-west-21",
-       GroupDescription:        &"イーストイチイチ",
+       GroupDescription:        &"",
        GroupLogFilterBroadcast: &true,
        GroupLogFilterNetBios:   &false,
-       GroupLogLimit:           &1000,
+       GroupLogLimit:           &100000,
-       GroupName:               &"FirewallJE1",
+       GroupName:               &"FirewallJW2",
        GroupRuleLimit:          &100,
        GroupStatus:             &"applied",
        ... // 2 ignored fields
        IpPermissions: []types.IpPermissions{
                {
                        ... // 1 ignored and 4 identical fields
                        IpProtocol: &"TCP",
                        IpRanges:   {{CidrIp: &"192.168.0.0/24"}},
-                       ToPort:     &444,
+                       ToPort:     &443,
                        ... // 1 ignored field
                },
                {Description: &"", FromPort: &80, InOut: &"IN", IpProtocol: &"TCP", ...},
        },
        OwnerId:   &"",
        RouterSet: nil,
        ... // 1 ignored and 1 identical fields
  }
```

詳しくは [README](https://github.com/SogoKato/nifdiff/blob/main/README.md) をご覧ください。

## しくみ

とてもシンプルで、特に捻りはないです。

1. [nifcloud-sdk-go](https://github.com/nifcloud/nifcloud-sdk-go) で指定されたリソースを取得する
1. 構造体を [go-cmp](https://github.com/google/go-cmp) で比較する

とにかく go-cmp が優秀なので、オプションをいい感じに渡してあげればやりたい比較は大抵できるんじゃないかと思います。今回[ファイアウォールグループの比較の実装](https://github.com/SogoKato/nifdiff/blob/main/pkg/plugin/computing/security_group.go)にあたって使用したオプションを2つ紹介します。

### `IgnoreFields`

おそらく一番追加そうなオプション。指定した任意の数の名前のフィールドを無視できます。

https://pkg.go.dev/github.com/google/go-cmp@v0.5.9/cmp/cmpopts#IgnoreFields

### `SortSlices`

スライスの内容を比較する上では必須になりそうなオプション。順番が重要ではなく、スライスの各要素の内容を比較したい場合、ソート用関数を渡すことで正確に比較できるようになります。

https://pkg.go.dev/github.com/google/go-cmp@v0.5.9/cmp/cmpopts#SortSlices

## コントリビュートお待ちしてます

欲しい機能がある方は issue を立てていただくか、プルリクしていただければと思います。😊
