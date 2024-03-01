---
title: "Next.js SSGサイトにGoogle AdSenseを入れてみる"
date: "2024-03-02"
tags: ["Next.js", "Google AdSense", "ブログ"]
---

ブログを始めてから1年そこそこが経過し、50記事を突破していました。かなりのんびり更新なので一般的に目標と言われる100記事には全然届いてないですが、ふと思い立って Google AdSense に登録してみたら半日くらいであっさり審査に通過したので Next.js 製 SSG サイトに広告を導入しました。なるべくコンテンツを邪魔しないように配置しますのでどうかご容赦ください。🙇

## そもそも GitHub Pages に広告入れていいんだっけ？

[GitHub の利用規約](https://docs.github.com/ja/site-policy/acceptable-use-policies/github-acceptable-use-policies#10-advertising-on-github) を確認してみると次のように記載されています。

> 要約: 基本的に、当社は GitHub の広告としての利用を禁止していません。しかし、GitHub が迷惑メールの温床にならないよう、当社はユーザーが特定の制限に従うことを期待します。そのような事態は誰も望まないからです。
>
> 当社は、お客様が支持者の名前またはロゴをアカウントに掲載することによって自身のコンテンツのプロモーションを行いたい場合があることを理解していますが、アカウント内またはアカウントを通して本サービスへと投稿されるコンテンツの主な目的が広告またはプロモーション活動であってはなりません。 これには、Pages、Packages、リポジトリ、および本サービスのその他一切の部分内か、またはこれを通じて投稿されるコンテンツが含まれます。 お客様のアカウントに関連する README ドキュメントまたはプロジェクト説明セクションに、静止画像、リンク、広告文を記載することはできますが、それは GitHub でホストしているプロジェクトに関連するものでなければなりません。 収益目的または過度の一括コンテンツをイシューに投稿するなど、他のユーザーのアカウントで広告を行うことはできません。
>
> 法的に、または当社のサービス使用条件または利用規約で禁じられているコンテンツまたはアクティビティのプロモーションまたは配布を行うことはできません。これには、プロモーションに関する、自動化された過度の一括アクティビティ (迷惑メール送信など)、Get-Rich-Quick スキーム、および不当表示または詐欺が含まれます。
>
> アカウントに何らかの販売促進資料を投稿することを決めた場合、お客様はすべての適用される法令従う責任を単独で負うものとします。この法令には、「推奨・証言に関する米国連邦取引委員会のガイドライン」が含まれますが、それに限定されません。 当社は、GitHub の何らかの規約またはポリシーに違反すると当社が独自に裁量した、一切の販売促進資料または広告を削除する権利を留保します。

このブログはエンジニアリングに関する内容を共有したり、もしくは私が私自身のポートフォリオとして使ったりすることを主な目的としていることは明らかなので、規約に抵触することはないと判断しました。

## ポイント

実装にあたっては [Google AdSense を Next.js 製ブログに入れるのに一手間かかる話 | stin's Blog](https://blog.stin.ink/articles/add-google-adsense-to-blog) が大変参考になりました。

やることとしては以下の通りです。

* `_document.tsx` に `adsbygoogle.js` を追加する
* `AdSense` コンポーネントを作って広告を配置したい場所に挿入する

## やってみよう

### `_document.tsx` に `adsbygoogle.js` を追加する

meta タグはなんとなく残しちゃってますが、審査通ったあとは不要かもです。前回の記事 [Next.js 13以降では公式ライブラリでGoogle Tag Managerを導入できる](/posts/2024/03/google-tag-manager-nextjs) で GTM を導入したので GTM 経由で script タグを差し込めないか試したのですが、js ファイルをダウンロードしているように見えても実際に広告が表示されることはなかったので、だめそうです。パフォーマンス向上のために `strategy="afterInteractive"` にしていますが、後述の `AdSense` コンポーネント側での対策が必要です。

```tsx
import { Html, Head, Main, NextScript } from "next/document";
import { googleAdsenseId } from "../utils/const";
import Script from "next/script";

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="google-adsense-account" content={googleAdsenseId} />
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdsenseId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

### `AdSense` コンポーネントを作って広告を配置したい場所に挿入する

まず、AdSense 管理画面の左タブ「広告」をクリックし、新しい広告ユニットを作成して元となる HTML コードを取得します。

[参考にしたブログ記事](https://blog.stin.ink/articles/add-google-adsense-to-blog)と基本的に同じです。

ただし、`adsbygoogle.js` の読み込みを `strategy="afterInteractive"` に指定したことで、このコンポーネントの描画時に `window.adsbygoogle` が未定義の可能性があります（`ReferenceError: adsbygoogle is not defined`）。なので、`if (window.adsbygoogle === undefined) return null;` を追加して、未定義であればいったん何も描画しないようにします。

その他には複数の広告タイプに対応させた点と develop 環境で位置を確認できるようにプレースホルダを追加した点が差分です。

```tsx
import { useRouter } from "next/router";
import { googleAdsenseId } from "../utils/const";
import { useEffect } from "react";

declare global {
  var adsbygoogle: unknown[];
}

type AdType = "display" | "multiplex";
type AdSenseProps = {
  type: AdType;
  className?: string;
};

export default function AdSense({ type, className }: AdSenseProps) {
  const router = useRouter();
  useEffect(() => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error(error);
    }
  }, [router.asPath]);
  if (window.adsbygoogle === undefined) return null;
  const { adSlot, adFormat, fullWidthResponsive } = getSlotValue(type);
  const baseClassName = "overflow-hidden rounded-md ";
  const placeholder =
    process.env.NODE_ENV === "development" ? (
      <div className="bg-white h-80 text-black text-center w-full">広告</div>
    ) : null;
  return (
    <div className={baseClassName + className} key={router.asPath}>
      {placeholder}
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={googleAdsenseId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
}

function getSlotValue(type: AdType) {
  switch (type) {
    case "display":
      return {
        adSlot: "1234567890",
        adFormat: "auto",
        fullWidthResponsive: "true",
      };
    case "multiplex":
      return {
        adSlot: "1234567890",
        adFormat: "autorelaxed",
        fullWidthResponsive: undefined,
      };
  }
}
```

そして、このコンポーネントを任意の位置に挿入します。

ins タグが `adsbygoogle.js` によって実際の広告（iframe）に置換されるので、これをそのまま使うとサーバ側の描画とクライアント側の描画が異なってしまい、Hydration Error が起こることになります。そこで[前にも紹介した](/posts/2022/11/blog-with-nextjs-and-tailwindcss) Next.js の [Dynamic Import](https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading) 機能を使います。

```tsx
const AdSense = dynamic(() => import("./AdSense"), { ssr: false });
```

```tsx
<AdSense type="display" />
```

これで OK です。

## おわりに

お疲れさまでした。今回の変更の全容はこちら（一部、フォーマッタによる変更が含まれています）。

https://github.com/SogoKato/sogokato.github.io/commit/d6a132a37b90714bd01430a120c2f83763c2d5c6

## 参考文献

* [Google AdSense を Next.js 製ブログに入れるのに一手間かかる話 | stin's Blog](https://blog.stin.ink/articles/add-google-adsense-to-blog)
