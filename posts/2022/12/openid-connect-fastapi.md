---
title: "よくあるSPA+API構成でのOpenID Connectクライアント実装"
date: "2022-12-02"
tags: ["OpenID Connect", "認証/認可", "SPA", "Python", "FastAPI"]
---

この記事は[ニフクラ](https://www.nifcloud.com/)等を提供している、[富士通クラウドテクノロジーズ Advent Calendar 2022](https://qiita.com/advent-calendar/2022/fjct)の2日目の記事です。

昨日は [@ntoofu](https://qiita.com/ntoofu) さんの [パケットキャプチャからKubernetes APIのTLS通信を解析する](https://ntoofu.github.io/blog/post/sniffing-kube-apiserver-tls/) でした。  
私は TLS な時点でパケットキャプチャを諦めてしまいそうですが Linux の便利な仕組みと気合があれば TLS 1.3 のパケットキャプチャも可能だとわかり、とても有益でした。私もギークなエンジニア目指して頑張ります。

今日は OpenID Connect のクライアントをどう実装するかについて検討してみたいと思います。

FastAPI + SPA (Vue.js) でちょっとした社内ツールを開発した時に社内の認可基盤との OpenID Connect を用いたログイン連携機能を作りたかったのですが、実装のための情報が少なかったので記事に残しておきたいと思ったのがきっかけです。「これがベストプラクティスだ！」というわけではありませんが、1つの実践例としてどなたかの参考になれば幸いです。

## 対象読者

* OpenID Connect を使ってログインするアプリを作りたいけど実装方法がわからない人
  * 色んなフローがあるっぽいけどどれを使うべき？
  * アクセストークン？ ID トークン？
  * サーバーで何してクライアントで何するの？
* Python の FastAPI で作ったサーバーでのログイン〜リダイレクト〜トークン検証の実装例が知りたい人

## OpenID Connect とは

**OpenID Connect は OAuth 2.0 を拡張する形で策定された、認証・認可のための仕組み**です。OAuth 2.0 は認可を行うことを目的とした仕様です。すでに10年も前の話ですが、OAuth を認証にも使ってしまう「SNS ログイン」の手法は「[単なる OAuth 2.0 を認証に使うと、車が通れるほどのどでかいセキュリティー・ホールができる](https://www.sakimura.org/2012/02/1487/)」と指摘されていました。OpenID Connect は OAuth 2.0 を拡張して認証の用途にも使えるようにした、ID トークンを発行するための仕組みとなっています。

下図は認証・認可の流れの一例です（response_type=id_token の場合）。

![overview](//www.plantuml.com/plantuml/png/NP6zIiDG5CVt-nINJkbGgBg9I0SNfrlo1g7DKD0q9EckzpW4KHfGS6aH9KWeIeMYK1FmOGv9u-GhUEvDH9lbSCBv_J_2xVc1vGMJqnDc3OAnnn6U43AKxpIvvVE9Rtjyx0rfxdIPI-neC78j9-0jb6yAXHkKQswO_NPB2Sn-ZUysSE7Qpl4HmXt22qA4CaOuuuQeTU9NjzTbEhHpgBpskSBbgyPN23EKdsgHIuG50j3222DOABXSN9T9HYS5o8IQ8OILtq67a8RVvZRzcZyYf7bqLLnCgy_o8Td47vMewPlIaa-NJEX8y__fMOVDTRcreVuqHCXqqLMRcN-2xLCHpqXUtrLces8HHldb_NTspdgsCwI7-W40)

OP: OpenID Provider; ID トークンの発行者  
RP: Relying Party; OP に認証機能を既存するクライアントアプリ

ユーザーがサービスにログインしようとすると、サービスはまず OpenID プロバイダー（OP）のエンドポイントに対してユーザーをリダイレクトします。OP は未認証であればログイン画面を出しユーザーを認証してから、サービスに対して認可を行うかどうか同意を取ります。ユーザーが同意すると、OP は ID トークンをリクエストに含めてサービスのコールバック URL にリダイレクトします。サービスは受け取った ID トークンが正規の OP からのものであることを OP の公開鍵を使用して検証します（そのほかにも複数の検証をする）。検証が正常に終了すればサービスへのログインの処理は完了です。

## で、どうやってクライアントを実装するの？

### まずは結論

![code flow](//www.plantuml.com/plantuml/png/RPBFIW9H5CRtzoakhdGXJNzM4Q7GnfL3FS6aBeHI6KTewTmROQ4e94YWX28XKXdq1t8a7-OuEgvwXRwPKN2apULSlz_vpdUk4oiQccwKBY-ObZBoEYVvH792uWidrugyLCpeFA-dSUugx3n_nKCaFbr4tfFuvk5JDH9Y1NXaKzc2bZFucHfVDUmf0I6k9bR2li8okJI7Mm089GkPNEA4P8la2ya6YJx9CWydCSBDabHN_GSAyt95ZxrfXzpbnPl7lvDiavYwXHYH79AKA1Wuu6w6RTniaVb3vWE31WHJG3Z3cZEOkEqm4GDiIhBY3psA0jaoMJIjPQT7qh8RrVbrtRywtS6YF_QRjdqj57PznF2Zdsf3U_QcTM2B8ko39B0NjDj8C6PGN9RDsRGRC2NHyrQm_1N0uGhh7RppnjMPDktQX--zRWqIytuRwLpY_sUtNwkpyStwdRsbWy2yqh3l7dyd9elXpySNzmS0)

* API サーバーで認証リクエストや ID トークン検証を行う
  * 今回は採用するライブラリの都合で Authorization Code Flow を使います
* ID トークンは Cookie で管理
  * localStorage ではセキュリティ上問題がある
  * インメモリでは利便性に欠ける
  * Cookie の属性
    * HttpOnly: true
      * JavaScript からは触らせない
    * SameSite: Lax
      * 他サイトへの Cookie 送信を最低限にする
      * Strict にすると OP にリダイレクトした際に破棄されてしまうため Lax
    * Secure: true
      * HTTPS でのみ Cookie を送信する

### SPA なら全部 SPA にやらせればいいんじゃないの？

はい、Implicit Flow を使うことで実現できます。

冒頭の「車が通れるほどのどでかいセキュリティー・ホール」の話は OAuth 2.0 を Implicit Flow で使用した時の話ですが、OpenID Connect はそれを踏まえて策定された仕様なので、OpenID Connect において Implicit Flow を使うことに問題はありません。

Implicit Flow を使う場合、下図のようになります（response_type=id_token）。

![implicit flow](//www.plantuml.com/plantuml/png/TP9FIm916CRlyoa6JteGjZydYL3euicbFi6c7eHIMLVegFD6I1WA1LsKC2H4AWCfq5tmmxpkkfxw2hqpxWO3THbcz_dDypppxcORZcKxpSiBPXMTciqHNX0y55-qSgl1cusopMjsYTOzWvtNhdW2nQT4u1x5WYTFpLI2rScZKgpKhQh3pynST63Vq8IScO-40uELgoLERXgGADJBrVm9mYF26q8VnHYXnPC5Yf1T2cPq_j1WgbVwMALbkEJ5X-Bd20CKAxaHCuGf0j264KSuMH0TJk_2YKUQ9CI4he7GsJaUfIMY6suUtEtm6S7r-ztWkhTx34UJpNWPrz1zNThulHcZbxyDO-rLfGrLlKLINhQZvarLvwcufPnKXklYjjLUhqQCfF-8O3oW24dyFHZ_lRjUtiGPghaE19s-V_lqxRLPbZuF_HC_)

上記のフローでは、SPA 側で Client Secret を管理する必要がありません。ClientSecret が必要になるのは主にトークンエンドポイント（認可コードやアクセストークンを使って、アクセストークンや ID トークンを取得するためのやつ）を使う時なので、response_type=id_token で OIDC クライアントを実装する場合には困りません。response_type=id_token で問題がないかという観点では、ログイン完了時にだけユーザー情報が手に入れば問題ない場合（ユーザー情報が最新である必要がない場合）には事足りると思われます。

SPA でエンドユーザーに見せたくない機密情報を扱うのはほとんど不可能だと思いますので Client Secret を SPA に持たせる必要がないのは嬉しい仕様ですね。**Implicit Flow では CSRF 対策のために nonce の検証が必須**なので注意してください。

### ID トークンどこ置く問題

ただ、Client Secret を SPA で管理する必要がないからといって SPA 上で ID トークンを扱えるようにすると、ID トークンをどこに保管するか、という問題が出てきます。これは OIDC のスコープ外の議論ですが、クライアント実装にあたって必ず検討するべき点だと思うので、今回はこれも考えていきたいと思います。

ID トークンを置く場所として考えられる候補を比較してみます。

||Cookie (HttpOnly: true, Secure: true, SameSite: Lax)|インメモリ|localStorage|
|---|---|---|---|
|保持期間|**設定された有効期限まで**|ページがリロードされるまで|**なし**|
|CSRF 対策|**更新系は防げる**|**他の JS ライブラリは基本的にアクセスできない**|どの JS ライブラリも取得可|
|JS での ユーザー情報取得|できない [^1]|**できる**|**できる**|

[^1]: サーバー側で Cookie の ID トークンを検証した上で、JSON レスポンスでユーザー情報を返却する API を作ったりすれば可能です。

どれも一長一短な感がありますが、この中で一番安全性と利便性のバランスがいいのは Cookie (HttpOnly: true, Secure: true, SameSite: Lax) だと思ったので、今回は Cookie に ID トークンを置くようにしました。

なお、Auth0 のクライアントライブラリではインメモリに ID トークンを保存しつつ、セッションを長く保たせることもできるようです。  
[SPA認証トークンはlocalStorageでもCookieでもない、Auth0方式はいいねというお話](https://mizumotok.hatenablog.jp/entry/2021/08/04/114431)

## FastAPI で OpenID Connect クライアントを実装する

以上で、一通りクライアントの実装方針について議論ができたと思うので、ここからは具体的な Python (FastAPI) での実装に移りたいと思います。  
今回使うライブラリ Authlib では FastAPI の他に Starlette, Flask や Django の Oauth Client とその実装例も公開されているので、それらを参考にすれば他のフレームワークでも割と簡単に実装できるのではないかなと思います。

### ソースコード

https://github.com/SogoKato/oidc-fastapi-authlib

動かしてみたい方は README に従って起動してみてください。

### 必要なもの

前準備として OpenID プロバイダを用意する必要があります。どのプロバイダでも大丈夫ですが、まだ持っていない場合は [Auth0](https://auth0.com/jp) に登録してみるのがおすすめです。個人で使うようなリクエスト量であれば無料で使えます（2022年12月現在）。

登録後、Application を作成したら、リダイレクト URI (Allowed Callback URLs) に `http://localhost:8080/api/auth` を入れておきます。また、下記の情報を探してメモっておきましょう。

* Client ID
* Client Secret
* OpenID Configuration Endpoint
  * アクセスすると OIDC クライアントで必要な情報を返してくれるエンドポイント
  * 通常 `https://example.com/.well-known/openid-configuration`

### アーキテクチャ

![architecture](//www.plantuml.com/plantuml/png/SoWkIImgAStDuKfCBialKdZSlEnnyvx7JTk0f49YiK9fSMeHLs9HSaPcRc99ge9oIMfoHbv-JdvwfK9UUcPUXOAD3L15MMPogfqT3dME0Pv4g5Bo2F7rqNSE3jRt2bO2sGnqM4bcCefEa6CKTEsWDbi17RlgSTFwnqqh7ZVjVDpSmGKHrzMr0za9bDTFBCX4249D18bpEQJcfG0z3G00)

今回は Cookie の SameSite 属性を使用しているので、SPA と API とで同じドメイン名を使い、パスでリクエストを振り分けます。

### 解説

#### ログイン時の処理

```python
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="MYSTRONGKEY", https_only=True)
```

FastAPI の初期化と Cookie のための SessionMiddleware の追加をします。

```python
oauth = OAuth()
oauth.register(
    name="auth0",
    server_metadata_url="https://example.com/.well-known/openid-configuration",
    client_id="クライアントID",
    client_secret="クライアントシークレット",
    client_kwargs={"scope": "openid profile"},
)
```

Authlib のインスタンスを作ります。scope に `openid` と入れておくことで Authorization Code Flow の時にトークンエンドポイントで ID トークンが手に入ります。

```python
@app.get("/api/login")
async def login(request: Request):
    redirect_uri = request.url_for("auth")
    return await oauth.auth0.authorize_redirect(request, redirect_uri)
```

認証リクエストを開始するためのエンドポイントです。ユーザーがここにアクセスすることで `http://localhost:8080/api/auth` をリダイレクト URI とした認証リクエストを開始します（OpenID プロバイダにリダイレクトされる）。

ちなみにこんな URL でリダイレクトされます。state と nonce があることも確認できますね。

```
https://example.com/authorize
  ?response_type=code
  &client_id=クライアントID
  &redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth
  &scope=openid+profile
  &state=PGO5TxTujESoXuLlfzYTWZsioK5Up5
  &nonce=HfyA3eugosoOuieiTGRZ
```

![OP login](/images/posts/2022/12/oidc_op_login.png)

ログインが完了するとリダイレクト URI にリダイレクトされ、次のエンドポイントが呼ばれます。

```python
@app.get("/api/auth")
async def auth(request: Request):
    try:
        token = await oauth.auth0.authorize_access_token(request)
    except OAuthError:
        logger.exception("An error occurred while verifying authorization response.")
        raise UnauthenticatedError()
    userinfo = token.get("userinfo")
    # userinfoのclaims(subやnameなど)を使ってDBにユーザーを登録する処理がここにきます.
    request.session["id_token"] = token.get("id_token")
    return RedirectResponse(url="/")
```

`authorize_access_token` で認可コードと state を使って ID トークンを取得し、ID トークンと nonce を検証するところまでやってくれます（楽ちん）。  
その後は自分の好きなように処理をして OK です。sub クレームをユーザー ID として、ユーザーがまだ DB に登録されていなければ insert するとか、ユーザーのプロフィール情報が変わってたら更新するとか、そういう処理が来るのかなと思います。

最後に、Cookie に ID トークンをセットして `/` にリダイレクトして、ログイン処理は完了です。

#### ログイン後の処理

ログイン後は JS 側で fetch や axios でリクエストをすると、Cookie も自動的に送信されます。なので、ログインしたユーザーにしか使わせたくないエンドポイントでは、Depends を使って ID トークンを検証します。

```python
@app.get("/api/items")
async def list_items(user: User = Depends(verify_user)):
    logger.info(f"Successful log in: user_id={user.id} name={user.name}")
    return {
        "items": [
            {"name": "Teddy bear", "icon": "🧸", "price": 99},
            {"name": "Apple", "icon": "🍎", "price": 2},
            {"name": "Sushi", "icon": "🍣", "price": 200},
            {"name": "Bento", "icon": "🍱", "price": 50},
        ]
    }
```

`verify_user` 関数で Cookie から ID トークンを取り出します。

```python
async def verify_user(request: Request):
    id_token = request.session.get("id_token")
    if id_token is None:
        raise UnauthenticatedError()
    decoded_jwt = await verify_token(id_token=id_token)
    # DBにユーザーが登録されているか確認する処理がここにきます.
    # user = user_repo.select_by_user_id(user_id=user_id)
    return user
```

`verify_token` が ID トークンを検証する関数です。

```python
async def verify_token(id_token: str):
    jwks = await oauth.auth0.fetch_jwk_set()
    try:
        decoded_jwt = jwt.decode(s=id_token, key=jwks)
    except Exception:
        logger.exception("An error occurred while decoding jwt.")
        raise UnauthenticatedError()
    metadata = await oauth.auth0.load_server_metadata()
    if decoded_jwt["iss"] != metadata["issuer"]:
        raise UnauthenticatedError()
    if decoded_jwt["aud"] != settings.oidc_client_id:
        raise UnauthenticatedError()
    exp = datetime.fromtimestamp(decoded_jwt["exp"])
    if exp < datetime.now():
        raise UnauthenticatedError()
    return decoded_jwt
```

ID トークンの検証として最低限必要なのは以下の通りです（Authorization Code Flow の場合）。

1. JWK Set（OP の公開鍵）を使用して JWT をデコードする
2. iss クレーム（Issuer Identifier; 発行者）を検証する
3. aud クレーム（Audience(s); 誰に対して発行したか = Client ID）を検証する
4. exp クレーム（Expiration time; 有効期限）を検証する

以上が完了すれば基本的な OIDC クライアント実装は完了です🎉

![log in](/images/posts/2022/12/oidc_log_in.gif)

## 最後に

いかがでしたか？？

一見複雑そうな OpenID Connect ですが、一つずつ紐解いてみると意外と簡単に実装できるように仕様が設計されていることがわかりました。自分でパスワードを頑張って管理するよりもこういうところは信頼できる OpenID プロバイダに任せてしまった方が楽ですし、何よりも安全ですよね。

ぜひ皆さんも Web サービスを作る時には活用してみてください。

この記事は[富士通クラウドテクノロジーズ Advent Calendar 2022](https://qiita.com/advent-calendar/2022/fjct)の2日目の記事でした。

明日は [@Syuparn](https://qiita.com/Syuparn) さんが SQL のテストについて書いてくれるようです。  
SQL のテストってあまりやってなかったりするので、他の人がどのように考えて実施しているのか気になります。それでは、明日の記事もお楽しみに！

（👇この記事がよかったらいいねボタンを押してください！）

## 参考文献

* [OpenID Connect Basic Client Implementer's Guide 1.0 - draft 42](https://openid.net/specs/openid-connect-basic-1_0.html)
* [OpenID Connect Implicit Client Implementer's Guide 1.0 - draft 25](https://openid.net/specs/openid-connect-implicit-1_0.html)
* [Google login for FastAPI](https://blog.authlib.org/2020/fastapi-google-login)
* [一番分かりやすい OpenID Connect の説明](https://qiita.com/TakahikoKawasaki/items/498ca08bbfcc341691fe)
* [IDトークンが分かれば OpenID Connect が分かる](https://qiita.com/TakahikoKawasaki/items/8f0e422c7edd2d220e06)
* [OpenID Connect 全フロー解説](https://qiita.com/TakahikoKawasaki/items/4ee9b55db9f7ef352b47)
* [OAuth 2.0/OpenID Connectの2つのトークンの使いみち](https://qiita.com/wadahiro/items/ad36c7932c6627149873)
* [単なる OAuth 2.0 を認証に使うと、車が通れるほどのどでかいセキュリティー・ホールができる](https://www.sakimura.org/2012/02/1487/)
* [OIDCのImplicit FlowでClientSecretを使わずにID連携する](https://zenn.dev/ritou/articles/a)
* [SPA認証トークンはlocalStorageでもCookieでもない、Auth0方式はいいねというお話](https://mizumotok.hatenablog.jp/entry/2021/08/04/114431)
* [GoでOpenID ConnectのClientを実装する（実装編）](https://times.hrbrain.co.jp/entry/go-openid-connect-implement)
