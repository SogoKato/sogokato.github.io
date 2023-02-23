---
title: "TerraformでAPI Gatewayのスロットリングを設定する"
date: "2023-02-23"
tags: ["AWS", "API Gateway", "Terraform"]
---

AWS API Gateway のスロットリングを Terraform を使って設定する方法を見つけるまでに少し手間取ったのでメモ。

## AWS マネジメントコンソールでの場所

今回 Terraform で設定するのは、マネジメントコンソールの各ステージの設定画面内の「デフォルトのメソッドスロットリング」に該当する箇所です。

![management console](/images/posts/2023/02/aws_apigw_console.png)

## そもそも API Gateway のスロットリングとは

API Gateway では API が1秒あたりに処理できるリクエスト数や同時に処理できるリクエスト数を制限することができます。これによって負荷が高くなりすぎたり、攻撃によって意図しない高額請求を受けてしまったりするリスクを減らすことができます。

ただし、この設定はベストエフォートで提供されるため、**この設定値がリクエスト上限になるわけではない**という点に注意は必要です。

> API のスロットリングおよびクォータを設定して、多すぎるリクエストで API の負荷が高くなりすぎないように保護できます。スロットルとクォータの両方はベストエフォートベースで適用されるため、これらは保証されたリクエスト上限ではなく、目標として考える必要があります。

_[AWS デベロッパーガイド](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-request-throttling.html)より引用。_

### 設定できる値

以下の2つがあります。これらのリクエスト数の制限を上回った時、`429 Too Many Requests` が返るようになります。

* **レート：1秒あたりに処理できるリクエスト数**
* **バースト：同時に処理できるリクエスト数**

### スコープ

次のスコープの順序で適用されます（１が最も優先される）。

> 1. 使用量プランで API ステージに設定したクライアントあたり、またはメソッドあたりのスロットリング制限
> 2. API ステージに設定したメソッドあたりのスロットリング制限
> 3. リージョンごとのアカウントレベルのスロットリング
> 4. AWS リージョンのスロットリング

_[AWS デベロッパーガイド](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-request-throttling.html)より引用。_

1はクライアント（API キー）単位の設定です。これに関しては今回の記事のスコープ外ですので、試してみたい方は AWS デベロッパーガイド [API キーを使用した使用量プランの作成と使用](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)のページをご覧ください。

2が今回設定する項目になります。今回はあるステージにおけるすべてのメソッドを対象にした設定を行いますが、**パスごとメソッドごとの設定を行うことも可能**です。

3は AWS アカウント単位の設定になります。今回の記事のスコープ外です。

4は AWS が設定しているリージョンごとの設定になります。ユーザーは変更することができません。また、1〜3の設定値は4の値よりも高くすることはできません。

## Terraform での設定方法

Terraform で API Gateway のあるステージにおけるすべてのメソッドを対象にスロットリングの設定を行うには以下のように書けば OK です。

```tf
resource "aws_api_gateway_method_settings" "example" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  stage_name  = aws_api_gateway_stage.example.stage_name
  method_path = "*/*"

  settings {
    throttling_rate_limit  = 2
    throttling_burst_limit = 1
  }
}
```

この `settings` には上記2つ以外にも API Gateway 関連の設定ができますので気になる方は Terraform 社ドキュメント [Resource: aws_api_gateway_method_settings](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_method_settings) をご覧ください。

## サンプル

下記サンプルは [API Gateway REST API OpenAPI Example](https://github.com/hashicorp/terraform-provider-aws/tree/main/examples/api-gateway-rest-api-openapi) を基に作成しています。

注意点として、Terraform 社ドキュメントに次の記載があります。

> We recommend using this resource in conjunction with the `aws_api_gateway_stage` resource instead of a stage managed by the `aws_api_gateway_deployment` resource optional `stage_name` argument. Stages managed by the `aws_api_gateway_deployment` resource are recreated on redeployment and this resource will require a second apply to recreate the method settings.  
> 訳：このリソース（訳註：`aws_api_gateway_method_settings`）を　`aws_api_gateway_stage` リソースとあわせて使うことをおすすめします。`aws_api_gateway_deployment` リソースの任意の引数 `stage_name` で管理されるステージと一緒に使うことはおすすめしません。`aws_api_gateway_deployment` で管理されるステージは再デプロイ時に再作成され、メソッドの設定を再作成するために再度 apply する必要が出てきます。

_[Terraform 社ドキュメント](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_method_settings) より引用。_

もしすでに API Gateway に関する Terraform 設定があり、`aws_api_gateway_deployment` の `stage_name` 引数を使っている場合は、`aws_api_gateway_stage` を使って書くように修正したほうが良いでしょう。

その際、

```tf
triggers = {
  redeployment = sha1(jsonencode(aws_api_gateway_rest_api.example.body))
}

lifecycle {
  create_before_destroy = true
}
```

あたりが関連する設定になっていると思います。私の実際のプロジェクトの場合はこのサンプルと異なり、Lambda との統合を行っていたので、`sha1(jsonencode(aws_api_gateway_rest_api.example.body))` に相当する書き方がわからず、`triggers` `lifecycle` は消しちゃいました。。（今のところは大丈夫そうですが、もし更新がありましたら追記します）

```tf
#
# Variables
#

variable "aws_region" {
  default     = "ap-northeast-1"
  description = "AWS Region to deploy example API Gateway REST API"
  type        = string
}

variable "rest_api_name" {
  default     = "api-gateway-rest-api-openapi-example"
  description = "Name of the API Gateway REST API (can be used to trigger redeployments)"
  type        = string
}

variable "rest_api_path" {
  default     = "/path1"
  description = "Path to create in the API Gateway REST API (can be used to trigger redeployments)"
  type        = string
}

#
# Provider
#

provider "aws" {
  region = var.aws_region
}

#
# API Gateway
#

resource "aws_api_gateway_rest_api" "example" {
  body = jsonencode({
    openapi = "3.0.1"
    info = {
      title   = var.rest_api_name
      version = "1.0"
    }
    paths = {
      (var.rest_api_path) = {
        get = {
          x-amazon-apigateway-integration = {
            httpMethod           = "GET"
            payloadFormatVersion = "1.0"
            type                 = "HTTP_PROXY"
            uri                  = "https://ip-ranges.amazonaws.com/ip-ranges.json"
          }
        }
      }
    }
  })

  name = var.rest_api_name

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_deployment" "example" {
  rest_api_id = aws_api_gateway_rest_api.example.id

  triggers = {
    redeployment = sha1(jsonencode(aws_api_gateway_rest_api.example.body))
  }

  lifecycle {
    create_before_destroy = true
  }
}

#
# Stage and Stage Settings
#

resource "aws_api_gateway_stage" "example" {
  deployment_id = aws_api_gateway_deployment.example.id
  rest_api_id   = aws_api_gateway_rest_api.example.id
  stage_name    = "example"
}

resource "aws_api_gateway_method_settings" "example" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  stage_name  = aws_api_gateway_stage.example.stage_name
  method_path = "*/*"

  settings {
    throttling_rate_limit  = 2
    throttling_burst_limit = 1
  }
}
```

```shell
export AWS_ACCESS_KEY_ID=
export AWS_SECRET_ACCESS_KEY=
```

```shell
terraform init
terraform plan
terraform apply
```

curl で同時に複数のリクエストを投げてみて429が返ってくるかを確かめます。curl の `--parallel` を使うために、同じ内容のリクエストを12個作成します。

```shell
for i in 0 1 2 3 4 5 6 7 8 9 10 11;
do echo 'url = "https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/example/path1"' >> data.txt;
echo 'output = "/dev/null"' >> data.txt;
echo 'write-out = "%{http_code}\n"' >> data.txt;
echo 'silent' >> data.txt;
done
```

```shell
time curl --parallel --parallel-immediate --parallel-max 4 --config data.txt
```

実行結果は毎回変わりますが、以下のような結果になります。きっかりレート2・バースト1になっていなさそうなので、やはりベストエフォートなのだなということが伺えます。

```
200
200
200
200
429
429
200
200
429
200
200
200

real    0m1.527s
user    0m0.114s
sys     0m0.151s
```

## 参考文献

* [API リクエストを調整してスループットを向上させる](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-request-throttling.html)
* [Resource: aws_api_gateway_method_settings](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_method_settings)
* [API Gateway REST API OpenAPI Example](https://github.com/hashicorp/terraform-provider-aws/tree/main/examples/api-gateway-rest-api-openapi)
* [Burst Throttling on AWS API Gateway Explained](https://www.petefreitag.com/item/853.cfm)
