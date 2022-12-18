import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";
import { gaId } from "../utils/const";

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="stylesheet" href="https://use.typekit.net/suf5fdm.css" />
        <Script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
        <Script
          id="_gtag"
          defer
          dangerouslySetInnerHTML={{
            __html: `
              if (window.location.hostname === "sogo.dev") {
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag("js", new Date());
                gtag("config", "${gaId}");
              }`,
          }}
          strategy="afterInteractive"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};
