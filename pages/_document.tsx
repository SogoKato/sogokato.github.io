import { Html, Head, Main, NextScript } from "next/document";
import { googleAdsenseId, siteTitle } from "../utils/const";
import Script from "next/script";

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="stylesheet" href="https://use.typekit.net/suf5fdm.css" />
        <link rel="stylesheet" href="https://pyscript.net/latest/pyscript.css" />
        <style>{`
        .py-overlay, .py-pop-up {display: none;}
        `}</style>
        <link
          rel="alternate"
          href="/feed.xml"
          type="application/rss+xml"
          title={siteTitle}
        />
        <meta name="google-adsense-account" content={googleAdsenseId} />
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdsenseId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </Head>
      <body className="bg-neutral-200 dark:bg-neutral-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
