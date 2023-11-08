---
title: "AWS SigV4リクエストの「検証する側」を実装する"
date: "2023-11-09"
tags: ["認証/認可", "AWS", "Python", "FastAPI"]
---

世の中には AWS Signature V4 署名の実装方法についての記事はたくさんありますが、その署名を付与して検証する側（サーバー）の実装方法について見つけるのは難しいです。AWS API Gateway を使えば簡単に自分で書かなくても良いのでそれはそうなのですが、AWS SigV4 は [curl のオプションとしても使える](https://curl.se/libcurl/c/CURLOPT_AWS_SIGV4.html) くらいの地位を獲得しているので、AWS SigV4 を利用した認証機能の実装方法についての記事があってもいいでしょう。

ということで、今回は Python と FastAPI で SigV4 署名付きリクエストの検証をするサーバーを書いてみます。

## 対象読者

* AWS SigV4 署名の検証方法を知りたい人

## 検証環境

* Python 3.10.6
* FastAPI 0.104.1
* botocore 1.31.78
* curl 7.81.0

## できたもの

```python
import hashlib
import hmac
import re
import urllib.parse
from datetime import datetime, timedelta
from typing import Annotated, Mapping, Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel
from pydantic_settings import BaseSettings

app = FastAPI()


class Config(BaseSettings):
    # サンプルなのでここに雑に書きます
    host: str = "localhost"
    service: str = "sugoi-api"
    region: str = "sekai-no-dokoka"
    keys: dict[str, str] = {
        "AKIAIOSFODNN7EXAMPLE": "THISISMYSECRETACCESSKEYxxxxxxxxxxxxxxxxx"
    }


config = Config()


def parse_authorization_header(authorization: str) -> tuple[str, str, str]:
    """Authorizatonヘッダーをパースします

    Args:
        authorization (str): Authorizatonヘッダー
    Returns:
        tuple[str, str, str]: Credential, SignedHeaders, Signatureの値
    Raises:
        HTTPException: パースの失敗時に発生
    """
    regexp = r"^AWS4-HMAC-SHA256\s+Credential=(.+),\s+SignedHeaders=(.+),\s+Signature=(.+)$"
    matched = re.match(regexp, authorization.strip())
    if matched is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    credential = matched.group(1)  # e.g. AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request
    signed_headers_str = matched.group(2)  # e.g. host;range;x-amz-date
    signature = matched.group(3)  # e.g. fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024
    return (credential, signed_headers_str, signature)


def create_canonical_headers(headers: Mapping[str, str], signed_headers: list[str]) -> str:
    """正規リクエストのためのヘッダーを作成します

    Args:
        headers (Mapping[str, str]): リクエストヘッダー
        signed_headers (list[str]): SignedHeadersリスト
    Returns:
        str: 正規リクエストのためのヘッダー
    """
    header_names = sorted([k for k in headers.keys() if k in signed_headers])
    return "".join([f"{k.lower()}:{headers[k].strip()}\n" for k in header_names])


def get_signature_key(secret_access_key: str, date: str, region: str, service: str) -> bytes:
    k_date = sign(f"AWS4{secret_access_key}".encode(), date)
    k_region = sign(k_date, region)
    k_service = sign(k_region, service)
    k_signing = sign(k_service, "aws4_request")
    return k_signing


def sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


async def authorize(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    host: Optional[str] = Header(default=None),
    x_amz_date: Optional[str] = Header(default=None),
):
    if authorization is None or x_amz_date is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # 1. 署名されてから5分以内のリクエストかどうかを判定
    dt_x_amz_date = datetime.strptime(x_amz_date, "%Y%m%dT%H%M%SZ").replace(tzinfo=ZoneInfo("UTC"))
    dt_threshold = datetime.now(tz=ZoneInfo("UTC")) - timedelta(minutes=5)
    if dt_x_amz_date < dt_threshold:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # 2. Authorizatonヘッダーをパースする
    credential, signed_headers_str, signature = parse_authorization_header(authorization)
    access_key_id, date, region, service, other_scope = tuple(credential.split("/", 4))
    signed_headers = signed_headers_str.split(";")
    # 3. 設定されたリージョン、サービス以外は認めない
    if region != config.region or service != config.service:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # 4. ヘッダーの検証
    if "host" not in signed_headers or host != config.host:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if "content-type" in request.headers.keys() and "content-type" not in signed_headers:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # 5. 正規リクエストを作成する
    uri = urllib.parse.quote(request.url.path)
    qs = "&".join([f"{urllib.parse.quote(k)}={urllib.parse.quote(v)}" for k, v in request.query_params.items()])
    hdrs = create_canonical_headers(request.headers, signed_headers)
    payload = hashlib.sha256(await request.body()).hexdigest()
    canonical_request = f"{request.method}\n{uri}\n{qs}\n{hdrs}\n{signed_headers_str}\n{payload}"
    # 6. 署名を計算する
    scope = "/".join([date, region, service, other_scope])
    request_hash = hashlib.sha256(canonical_request.encode()).hexdigest()
    string_to_sign = f"AWS4-HMAC-SHA256\n{x_amz_date}\n{scope}\n{request_hash}"
    secret_access_key = config.keys.get(access_key_id)
    k_signing = get_signature_key(secret_access_key, date, region, service)
    valid_signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
    # 7. 署名を比較する
    if not hmac.compare_digest(signature, valid_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return


# ダミーデータ
items = [{"name": "Foo"}, {"name": "FooBar"}, {"name": "Baz"}]


@app.get("/items")
async def read_items(_: Annotated[None, Depends(authorize)], q: Optional[str] = None):
    queried_items = [item for item in items if q is None or q in item["name"]]
    return {"items": queried_items}


class CreateRequest(BaseModel):
    name: str


@app.post("/items")
async def create_item(_: Annotated[None, Depends(authorize)], body: CreateRequest):
    item = {"name": body.name}
    items.append(item)
    return {"item": item}
```

## テストする

上記のコードをどこかに貼り付けて localhost:80 でサーバーを立ち上げてください。80番以外のポートの場合は `Host: localhost` のヘッダーを付与してください。

curl でリクエストを送ってみます。

```
$ curl -s http://localhost/items
{"detail":"Forbidden"}
$ curl -s http://localhost/items?q=Foo --aws-sigv4 "aws:amz:sekai-no-dokoka:sugoi-api" --user "AKIAIOSFODNN7EXAMPLE:THISISMYSECRETACCESSKEYxxxxxxxxxxxxxxxxx"
{"items":[{"name":"Foo"},{"name":"FooBar"}]}
$ curl -s http://localhost/items --aws-sigv4 "aws:amz:sekai-no-dokoka:sugoi-api" --user "AKIAIOSFODNN7EXAMPLE:THISISMYSECRETACCESSKEYxxxxxxxxxxxxxxxxx" -XPOST -H 'Content-Type: application/json' -d '{"name": "Hoge"}'
{"item":{"name":"Hoge"}}
```

クエリを使ってもリクエストボディを使っても正常に署名を検証できていることが確認できました。🚀

## ちょっと解説

AWS 公式ドキュメントを参考に、リクエスト元と同じ署名を作成するように実装します。

### 1. 署名されてから5分以内のリクエストかどうかを判定

[AWS API リクエストの署名](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/reference_aws-signing.html)のページには下記のような記載があるので、`x-amz-date` が5分以内のリクエストのみを有効にしました。[^1]

> * **潜在的なリプレイ攻撃の防止**  
>   多くの場合、リクエストは、リクエストのタイムスタンプの 5 分以内に AWS に到達する必要があります。その条件を満たさない場合、AWS はリクエストを拒否します。

[^1]: `x-amz-date` がない場合は `date` ヘッダーを探すように実装したほうが良さそうです。 https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/signing-elements.html

### 2. Authorizaton ヘッダーをパースする

`Authorization` ヘッダーが下記のように付与されているので、`Credential` `SignedHeaders` `Signature` にパースします。  
`Credential` は `<your-access-key-id>/<date>/<AWS Region>/<AWS-service>/aws4_request` の形式になっているので、それもパースします。

```
Authorization: AWS4-HMAC-SHA256
Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, 
SignedHeaders=host;range;x-amz-date, 
Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024
```

（上の例は読みやすさのために改行されていますが実際はないです）

### 3. 設定されたリージョン、サービス以外は認めない

申し訳程度のチェックしかしていないですが、[AWS API の署名済みリクエストのトラブルシューティング](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/signature-v4-troubleshooting.html)のページを見ると、もう少し詳しく条件が書いてあるのでこれを参考に実装してもいいかもです。

### 4. ヘッダーの検証

`Host` ヘッダーは必須なので存在を確認したうえで値も確認します。今回は localhost ですが、実際のドメインにはリージョン名やサービス名が入るはずなので（`protocol://service-code.region-code.amazonaws.com`）、上のステップ3の実装をすることでここがカバーされるのかなと思います。

`Content-Type` がある場合にはそれを署名に含めなくてはいけないので、その検証も行っています。

> CanonicalHeaders リストには以下が含まれている必要があります。
> * HTTP host ヘッダー。
> * Content-Type ヘッダーがリクエスト内に存在する場合は、それを CanonicalHeaders リストに追加する必要があります。
> * リクエストに含める予定の x-amz-* ヘッダーも追加する必要があります。例えば、一時的なセキュリティ認証情報を使用している場合は、リクエストに x-amz-security-token を含める必要があります。このヘッダーを CanonicalHeaders リストに追加する必要があります。

https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/create-signed-request.html#create-canonical-request

### 5. 正規リクエストを作成する

正規リクエストは以下の形式をとります。

```
<HTTPMethod>\n
<CanonicalURI>\n
<CanonicalQueryString>\n
<CanonicalHeaders>\n
<SignedHeaders>\n
<HashedPayload>
```

これらの情報をリクエストから集めて、サーバー側でも正規リクエストを作成します。

ヘッダーは、通信経路上のプロキシが付与しているケースもあるので、サーバーに届いた全部のヘッダーを含めるのではなく `SignedHeaders` に記載のヘッダー名だけを集めます。

### 6. 署名を計算する

以下の文字列の形式の署名文字列を作成し、シークレットアクセスキー・日付・リージョン・サービス名で作ったキーを使って署名します。

```
Algorithm \n
RequestDateTime \n
CredentialScope  \n
HashedCanonicalRequest
```

### 7. 署名を比較する

最後に、リクエストに付与されている署名と、サーバー側で作成した署名とを比較します。タイミング攻撃のリスクを減らすために [`hmac.compare_digest()`](https://docs.python.org/ja/3/library/hmac.html#hmac.compare_digest) などを使いましょう。

## 最後に

完全互換ではないですが、趣味レベルで実用的な AWS SigV4 認証機能を持ったサーバーを作ることができました。~~「え、API Gateway 使えばいいじゃん」というのは言わない約束でお願いします（今更）。~~

## 参考文献

* [AWS API リクエストの署名](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/reference_aws-signing.html)
* [署名付き AWS API リクエストを作成する](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/create-signed-request.html)
* [認証方法](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/aws-signing-authentication-methods.html)
* [AWS API の署名済みリクエストのトラブルシューティング](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/signature-v4-troubleshooting.html)
* [Authenticating Requests: Using the Authorization Header (AWS Signature Version 4)](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/API/sigv4-auth-using-authorization-header.html)
* [botocore/botocore/signers.py at develop · boto/botocore](https://github.com/boto/botocore/blob/develop/botocore/signers.py)
* [requests-auth-aws-sigv4/requests_auth_aws_sigv4/\_\_init\_\_.py at master · andrewjroth/requests-auth-aws-sigv4](https://github.com/andrewjroth/requests-auth-aws-sigv4/blob/master/requests_auth_aws_sigv4/__init__.py)
* [CURLOPT_AWS_SIGV4 explained](https://curl.se/libcurl/c/CURLOPT_AWS_SIGV4.html)
