---
title: "Next.js 13以降では公式ライブラリでGoogle Tag Managerを導入できる"
date: "2024-03-01"
tags: ["Next.js", "Google Analytics", "ブログ"]
---

ブログ開設当初に [Next.jsとTailwind CSSでブログを作るときに考えたこと](/posts/2022/11/blog-with-nextjs-and-tailwindcss) の記事で紹介したように、このブログは Next.js で作られています。作ったころの Next.js のバージョンは12だったのですが、2024年2月時点で14まで進んでいます。改めて Google Tag Manager と向き合ってみたら公式ライブラリで簡単に導入できるようになっていたので共有です。

## 公式ライブラリ @next/third-parties

[@next/third-parties](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries) というライブラリがあり、執筆時点では下記の Google の機能を統合できます。

* Google Tag Manager
* Google Analytics
* Google Maps 埋め込み
* YouTube 埋め込み

2つ目の Google Analytics は Google タグ (gtag.js) を使用しています。Google Tag Manager (GTM) でも gtag.js でも Google Analytics 4 (GA4) に対応させることができます。両者の違いについての解説はここでは割愛します。

今回は GTM を使用して Google Analytics との連携をやっていきます。

## 前提条件

* GTM のアカウントやコンテナを作成済み
* GA4 のプロパティを作成済み

## やってみよう

### GTM で Google タグを作成

[[GA4] 測定 ID - アナリティクス ヘルプ](https://support.google.com/analytics/answer/12270356?hl=ja) を参考に GA の測定 ID を確認しておきます。

タグの画面で「新規」ボタンをクリックして新しいタグを作成します。

![新しいタグを作成](/images/posts/2024/03/gtm_01.png)

「タグの種類」は「Google タグ」、「タグ ID」は GA の測定 ID で、`G-` と12文字の英数字で構成される文字列です。「配信トリガー」は「Initialization - All Pages」です。「All Pages」でもいいのかもですが、Google タグ未作成の状態で GA4 イベントのタグを作ろうとしたときに作成するよう促される Google タグの初期設定では「Initialization - All Pages」になっていたのでこっちにしました（よくわかってない）。

完了したら変更を公開します。

### Next.js のコードを編集

`_app.tsx` で `GoogleTagManager` をインポートして、タグを挿入します。`gtmId` は `GTM-` と6文字の英数字で構成される文字列（コンテナ ID）です。

https://github.com/SogoKato/sogokato.github.io/blob/20218c09a85e6eaad58e6c6d3dd1d3ef21ac3372/pages/_app.tsx

```tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import { GoogleTagManager } from '@next/third-parties/google'
import Layout from "../components/Layout";
import "../styles/globals.css";
import { googleTagManagerId } from "../utils/const";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout {...pageProps}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
      <GoogleTagManager gtmId={googleTagManagerId} />
    </Layout>
  );
}

export default MyApp;
```

ちなみに自分は `_document.tsx` に最初書いてしまって反映されずに唸っていたので、間違えないようご注意ください。

### GA で確認してみる

以上で基本的な設定は終わりなので、ページにアクセスしてみて Google Analytics のリアルタイムの画面などで確認してみましょう。

## カスタムイベントを設定してみる

このブログではいいねボタンを設置しています。gtag.js を使っていた頃から、いいねボタン押下したタイミングでカスタムイベントを発火させていたので、同じことを GTM でも実装してみます。

gtag.js ではこうやっていました。

```tsx
window.gtag("event", "like", {
  event_category: "button",
  event_label: "thumbs_up",
});
```

GTM ではまず `sendGTMEvent()` で GTM にイベントを送ります。

```tsx
import { sendGTMEvent } from "@next/third-parties/google"

sendGTMEvent({ event: "like", value: "thumbs_up" });
```

次に GTM の管理画面で新規トリガーを作ります。トリガーのタイプは「カスタム イベント」、イベント名は `sendGTMEvent()` の引数に渡したオブジェクトの `event` に同じ（上記の場合は `like`）にします。「このトリガーの発生場所」はいったん「すべてのカスタム イベント」にしておきます。

![新しいトリガーを作成](/images/posts/2024/03/gtm_02.png)

その後、このトリガーをもとに発火するタグを作成します。「タグの種類」は「Google アナリティクス: GA4 イベント」、測定 ID は上と同じ `G-` と12文字の英数字のやつです。イベント名には適当な名前をつけます。[[GA4] 推奨イベント - アナリティクス ヘルプ](https://support.google.com/analytics/answer/9267735?hl=ja) を見る感じ snake_case で命名しておくのが良さそうです。

![新しいタグを作成](/images/posts/2024/03/gtm_03.png)

ここまで設定したら GTM のプレビュー機能を使ってイベントが発火しているかどうかを確認してみて、変更を公開しましょう。

## おわりに

お疲れさまでした。今回の変更の全容はこちら。

https://github.com/SogoKato/sogokato.github.io/commit/418a232a8f74f7d710b42f7fab6d79b596da4740

## 参考文献

* [Optimizing: Third Party Libraries | Next.js](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries)
* [Next.js で GTM + GA4を利用する](https://zenn.dev/keitakn/articles/nextjs-google-tag-manager)
