---
title: "Next.jsでNextResponseをシングルトンインスタンスにしてはいけない"
date: "2025-03-10"
tags: ["Next.js", "JavaScript"]
---

Next.js の App Router で API を作る時にはレスポンスを `NextResponse.json()` などで返すと思いますが、これを共通化したりする時にシングルトンにしてはいけない、という話です。

## 何がダメなのか

同時にリクエストすると、レスポンスのボディを取得できなくなります。

## 検証環境

* next 15.2.1
* react 19.0.0
* next-test-api-route-handler 4.0.15

## コード

```
app/api
├── bad
│   ├── __tests__
│   │   └── route.test.ts
│   └── route.ts
└── good
    ├── __tests__
    │   └── route.test.ts
    └── route.ts
```

### OK な例

よく見るコードはこうなっていると思います。リクエスト毎に `NextResponse.json()` を呼んでいるのでこれは問題ないです。

```ts
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({status: "good"});
}
```

試しにブラウザのコンソールから `for (let i=0; i<5; i++) { fetch("/api/good").then(res => res.json()).then(json => console.log(json)) }` とリクエストを投げてみると、全部正常に取得できます。

### ダメな例

今度は `NextResponse.json()` インスタンスにしてリクエスト間で使い回すようにしています。現実的なシナリオではエラーレスポンスなどをこのように共通化して定義しておきたくなることがあると思います。

```ts
import { NextResponse } from "next/server";

const response = NextResponse.json({status: "bad"});

export async function GET() {
    return response;
}
```

しかしながら同時にリクエストを投げると、ほとんど（もしくは全部）のレスポンスボディが空になります。

![スクリーンショット](/images/posts/2025/03/next-response.png)

## なぜダメなのか

Next.js はレスポンスを返す時に内部的に [ReadableStream](https://developer.mozilla.org/ja/docs/Web/API/ReadableStream) を使っているようですが、`NextResponse` をシングルトンにしてしまうと同時アクセスが来た際に [locked](https://developer.mozilla.org/ja/docs/Web/API/ReadableStream/locked) な状態になってしまいレスポンスを返せなくなります。

レスポンスを共通化したい場合は関数にして毎回新しい NextResponse インスタンスを返すようにしましょう。

## おまけ: テストコード

[next-test-api-route-handler](https://github.com/Xunnamius/next-test-api-route-handler) を使えば App Router のテストが簡単に書けて便利です。今回はこれでテストを書いていて `Unexpected error while handling request: Invalid state: ReadableStream is locked` というエラーが出たので原因に気づけました。

以下は両方とも通ります。

```ts
import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "../route";

it("test /api/good - 1", async () => {
  await testApiHandler({
    appHandler,
    async test({ fetch }) {
      const res = await fetch({ method: "GET" });
      await expect(res.json()).resolves.toStrictEqual({ status: "good" });
    },
  });
});

it("test /api/good - 2", async () => {
  await testApiHandler({
    appHandler,
    async test({ fetch }) {
      const res = await fetch({ method: "GET" });
      await expect(res.json()).resolves.toStrictEqual({ status: "good" });
    },
  });
});
```

以下は1つめのテストケースにより locked な状態にされるので、同時にリクエストしている2つめのテストケースでエラーになります。

```ts
import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "../route";

it("test /api/bad - 1", async () => {
  await testApiHandler({
    appHandler,
    async test({ fetch }) {
      const res = await fetch({ method: "GET" });
      await expect(res.json()).resolves.toStrictEqual({ status: "bad" });
    },
  });
});

it("test /api/bad - 2", async () => {
  await testApiHandler({
    appHandler,
    async test({ fetch }) {
      const res = await fetch({ method: "GET" });
      await expect(res.json()).resolves.toStrictEqual({ status: "bad" });
    },
  });
});
```

## 参考文献

* [ReadableStream: locked プロパティ - Web API | MDN](https://developer.mozilla.org/ja/docs/Web/API/ReadableStream/locked)
* [Logging route handler responses in Next.js 14 | by Omid Sayfun | Medium](https://medium.com/@iamomiid/logging-route-handler-responses-in-next-js-14-266397399ac5)
