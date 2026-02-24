---
title: "Auth.js (NextAuth v5) がリバプロ時に違うURLにリダイレクトする問題の対処"
date: "2026-02-25"
tags: ["Next.js", "Auth.js", "認証/認可"]
---

表題の通りで [Authjs v5 redirecting to the wrong URL](https://github.com/nextauthjs/next-auth/issues/10928) という issue で知られている問題なんですが、2026年2月時点でもまだクローズされていません。[Pull request も出ていて]((https://github.com/nextauthjs/next-auth/pull/13323))、私もその修正を試してみたところ、それがマージされれば直りそうではあります。ただ、Auth.js は今後、セキュリティパッチや深刻な問題以外は対処されない可能性があるため [^1] 、マージされることはあまり期待できないかもしれません。

ということもあって、今回は同問題の暫定対処を書き留めておきます。
あくまでワークアラウンドなので、近いうちに Better Auth に移行することを検討すると良いかと思います。

[^1]: [Migrating from Auth.js to Better Auth](https://authjs.dev/getting-started/migrate-to-better-auth)

## 前提

* Next.js + Auth.js を使用したアプリケーションをリバースプロキシ配下で運用している
* リバースプロキシは X-Forwarded-Proto と X-Forwarded-Host ヘッダを設定している
* [`AUTH_TRUST_HOST`](https://authjs.dev/getting-started/deployment#auth_trust_host) の設定の意味を理解している

## 検証環境

* next 16.1.6
* react 19.2.3
* next-auth 5.0.0-beta.30

環境変数

* `AUTH_TRUST_HOST=true`
* `AUTH_SECRET=yoursecret`

## やったこと

### 修正のコア部分

[2024/6/3 の @toshgoodson によるコメント](https://github.com/nextauthjs/next-auth/issues/10928#issuecomment-2144241314) を掲載します。

```ts
import { NextRequest } from "next/server"

const reqWithTrustedOrigin = (req: NextRequest): NextRequest => {
	if (process.env.AUTH_TRUST_HOST !== 'true') return req
	const proto = req.headers.get('x-forwarded-proto')
	const host = req.headers.get('x-forwarded-host')
	if (!proto || !host) {
		console.warn("Missing x-forwarded-proto or x-forwarded-host headers.")
		return req
	}
	const envOrigin = `${proto}://${host}`
	const { href, origin } = req.nextUrl
	return new NextRequest(href.replace(origin, envOrigin), req)
}
```

X-Forwarded-Proto と X-Forwarded-Host ヘッダを取得した上で、元々の `NextRequest` オブジェクトを差し替えています。`NextRequest` の各属性は readonly で直接的に属性を書き換えられないので、新しいオブジェクトを作るしかありません。その際、一部の情報は抜け落ちてしまうので、上記のワークアラウンドを必要に応じて修正する必要があります。

私は Next.js の [basePath](https://nextjs.org/docs/pages/api-reference/config/next-config-js/basePath) が考慮されない問題に遭遇しましたが、このあたりは Auth.js の config (provider や callbacks の実装) によりけりだったりするので一概には言えません。

原因: 差し替え後の `NextRequest` の `basePath` 属性が空文字になっている  
対処: `RequestInit` に `nextConfig.basePath` を渡す

```ts
const reqWithTrustedOrigin = (req: NextRequest): NextRequest => {
  ...
  const reqInit = {
    // ...req だと Headers オブジェクトはコピーされない
    // → Cookie がなくて認証情報が取れない
    headers: req.headers,
    nextConfig: {
      basePath: req.nextUrl.basePath,
    },
  }
  return new NextRequest(href.replace(origin, envOrigin), reqInit)
}
```

### 適用先1. 認証エンドポイント

GitHub issue のコメントに書いてある通りです。

```ts
import { handlers } from "@/auth"

export const GET = (req: NextRequest) => {
	return handlers.GET(reqWithTrustedOrigin(req))
}

export const POST = (req: NextRequest) => {
	return handlers.POST(reqWithTrustedOrigin(req))
}
```

### 適用先2. Proxy (旧 Middleware)

Auth.js の config の [`pages.signIn`](https://authjs.dev/reference/core#pages) を設定している時、未ログイン時のリダイレクトがうまくいかないことがありました。Proxy をラップする使い方は型定義的にサポートされていないので無理矢理な方法ですが、以下のようにすると動作します。ほかにも authorized callback まわりでうまくいかない時に試す価値があるかもしれません。

```ts
import { NextFetchEvent, NextRequest } from 'next/server';
import { auth } from "@/auth";

export const proxy = async (request: NextRequest, event: NextFetchEvent) => {
  const req = reqWithTrustedOrigin(request);
  // @ts-ignore
  return await auth(req, event);
};
```

## おわりに

Auth.js にはお世話になっていましたが、深くコードを読み込んだのは初めてで興味深かったです。メンテナンスモードに入ってしまうのは少し寂しい感じもありますが、今後は機会があれば Better Auth を試してみようと思います。

## 参考文献

* [Authjs v5 redirecting to the wrong URL · Issue #10928 · nextauthjs/next-auth](https://github.com/nextauthjs/next-auth/issues/10928)
* [fix: support X-Forwarded-* headers in proxy environments (#10928) by UNILORN · Pull Request #13323 · nextauthjs/next-auth](https://github.com/nextauthjs/next-auth/pull/13323)
