import { Html, Head, Main, NextScript } from "next/document";
import { siteTitle } from "../utils/const";

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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
