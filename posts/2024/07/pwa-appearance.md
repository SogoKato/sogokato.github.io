---
title: "PWAの見栄えをそこそこ良くする設定まとめ【令和最新版】"
date: "2024-07-28"
tags: ["PWA", "Next.js"]
---

PWA (Progressive Web App) が普及し始めてからしばらく経ちました。Android が積極的に対応を進めてきましたが、最近は iOS でもそれなりに対応が進みました。久しぶりに PWA と向き合い、今時のスマホ向けに見栄えを良くするための設定をまとめました。

## やること

* アイコン
* ステータスバーの色の設定
* iPhone の画面への対応

通知や Service Worker 等の機能面はこの記事のスコープ外とします。

## デモ

<a href="/assets/posts/2024/07/pwa/index.html" target="_blank">PWA デモ</a>

リンク先のページで実際にこの記事で試した内容を試せます。

## アイコン

これは数年前から特に変わりないと思いますが、改めて作り直しました。

### アイコン画像の作成

[Apple のベストプラクティス](https://developer.apple.com/jp/design/human-interface-guidelines/app-icons#Best-practices) を軽く見ておくといいかもしれません。私は [Apple Design Resources](https://developer.apple.com/design/resources/) のページにある Production Templates を使用してアイコンを作りました（と言っても背景の上にシンボルを載せただけですが……）。だいたいどの範囲にロゴやシンボルを収めればいいのかがわかるので便利です。

![photoshop](/images/posts/2024/07/pwa_01.png)

1024px で作成し、必要なサイズのアイコン画像を書き出せば良いでしょう。

### manifest.json の icons プロパティ

下記の内容を検証しました。

```json
{
  "icons": [
    {
      "purpose": "any",
      "src": "./img/icons/192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "purpose": "any",
      "src": "./img/icons/512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "purpose": "maskable",
      "src": "./img/icons/maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "purpose": "maskable",
      "src": "./img/icons/maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

画像サイズは Chromium で最低限必要な `192x192` と `512x512` を用意しました。[^1]

[^1]: https://web.dev/articles/add-manifest?hl=ja#icons

Purpose `any` デフォルトで使用されるアイコンです。iOS はこれを使うみたいです。`maskable` は画像からシステムが様々な形にマスクする（切り抜く）時に使われます。Android のアダプティブアイコンがその例で、サークルやスクワークルに切り抜けることは Android ユーザーにはお馴染みかと思います。

`maskable` に指定する画像は `any` に指定する画像よりもアイコンに描かれるロゴやシンボルを小さめにしておく必要があります。具体的には、画像の（基本は正方形かと思いますが）短辺の80%の直径の円（= 安全領域）の中に描かれないといけません。

![safe zone](https://w3c.github.io/manifest/images/safe-zone.svg)

https://maskable.app/ ではアイコンがどのように `maskable` として使用されるのかプレビューできます。

![maskable.app](/images/posts/2024/07/pwa_02.png)

Puepose には他に `monochrome` があります。これに指定された画像は色情報が破棄され、アルファデータ（透明度）だけが使用されます。主に塗りつぶしのマスクの用途です。

https://monochrome.fyi/ ではアイコンがどのように `monochrome` として使用されるのかプレビューできます。

![monochrome.fyi](/images/posts/2024/07/pwa_03.png)

Material You で `monochrome` アイコンを使っているのか気になりましたが、未実装のようです。[^2]  
iOS 18 のアイコンも Material You と同じようにアイコンの色をテーマに合わせられるようになるみたいなので、PWA にも適用されるのかが気になります。

[^2]: https://stackoverflow.com/questions/74620798/material-you-icon-on-pwa  
https://issues.chromium.org/issues/40277264

Android 版 Chrome でインストールした PWA では通知バーのアイコンに使われるのかもと思って試してみましたが、[`ServiceWorkerRegistration.showNotification()`](https://developer.mozilla.org/ja/docs/Web/API/ServiceWorkerRegistration/showNotification) の `badge` オプションで渡さないと通知バーのアイコンとして表示されませんでした。[^3]

そのため、現時点で manifest.json の `monochrome` アイコンを使用する実装を見つけることはできませんでした。

[^3]: Android 版 Firefox では `badge` オプションをつけても無視されました。

## ステータスバーの色の設定

時刻や Wi-Fi のアイコンが並んでいるステータスバーが真っ白や真っ黒ではなく、アプリと一体になっているとネイティブアプリ感が増します。manifest.json の `theme_color` で設定することが多かったと思いますが、manifest では動的に変えることができないので、現時点では `<meta>` タグで記述する方が良さそうです。

下記はライトモードとダークモードで `theme-color` を出し分ける書き方です。複数の `theme-color` に未対応のブラウザもあるので、フォールバックさせたい方を最初に持ってくると良いです。

```html
<meta name="theme-color" content="#E5E5E5" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
```

![android chrome light](/images/posts/2024/07/pwa_04.jpg)

Android 版 Chrome でページをタブで開いているとき（PWA でないとき）、かつ、ダークモード時に `theme-color` が適用されないのは仕様ですので覚えておきましょう。

![android chrome dark](/images/posts/2024/07/pwa_05.jpg)

↑ Android 版 Chrome では UI のアドレスバーの色が `theme-color` にならない

<details>
<summary>Next.js の `next/head` 内に記述する場合</summary>

同じ name 属性のタグがあると最後のやつだけが生き残って他のタグは HTML に出力されないので、`key` を使って別物だと認識させましょう。`key` の値はなんでもいいです。

```html
<meta name="theme-color" content="#E5E5E5" media="(prefers-color-scheme: light)" key="theme-color-light" />
<meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" key="theme-color-dark" />
```

</details>

### iOS

iOS の PWA では Apple 特有の `<meta>` タグで `black-translucent` を指定して、ステータスバーの背景を透過させるとネイティブアプリ感が高まっておすすめです。`apple-mobile-web-app-status-bar-style` を使うためには `apple-mobile-web-app-capable` も指定する必要があります。

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

![ios pwa](/images/posts/2024/07/pwa_06.jpg)

↑ PWA として動作しているとき

ただし PWA として動作していないとき（= ホーム画面に追加されていないとき、Safari のタブとして開いているとき）は `theme-color` が使用されます。

![ios safari](/images/posts/2024/07/pwa_07.jpg)

↑ Safari のタブとして開いているとき

## iPhone の画面への対応

今回重要なのは `viewport-fit=cover` の部分で、これをつけることでステータスバーやホームバーの後ろに Web サイトをレンダリングできるようになります。

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />
```

![viewport-fit=cover](https://web.dev/static/learn/pwa/app-design/image/at-top-notch-based-devi-8193966f8a04c_1920.png)

その代わり、画面の上下左右に位置する HTML 要素にはパディングをつけてあげる必要があります。安全領域（safe area）外の上下左右の大きさは `env(safe-area-inset-top)` `env(safe-area-inset-right)` `env(safe-area-inset-bottom)` `env(safe-area-inset-left)` で取得できます。

例えば、画面の上部に `.header` があったとして従来は以下のように指定していたとしたら

```css
.header {
  padding-top: 10px;
}
```

次のように `safe-area-inset-top` の分だけ足してあげれば良いです。安全領域がない端末ではこの値は `0px` なので、端末によって出し分けたりする必要はありません。

```css
.header {
  padding-top: calc(env(safe-area-inset-top) + 10px);
}
```

![ios safearea portrait](/images/posts/2024/07/pwa_08.jpg)

![ios safearea landscape](/images/posts/2024/07/pwa_09.jpg)

## 参考文献

* [Web Application Manifest](https://w3c.github.io/manifest/)
  * W3C によって標準化された Web アプリマニフェストの仕様書
* [アプリの設計  |  web.dev](https://web.dev/learn/pwa/app-design?hl=ja)
  * Web アプリについて全般的に書かれているので作るときは一読しましょう
* [ウェブアプリ マニフェストを追加する  |  Articles  |  web.dev](https://web.dev/articles/add-manifest?hl=ja)
* [display - ウェブアプリマニフェスト | MDN](https://developer.mozilla.org/ja/docs/Web/Manifest/display)
* [display_override - ウェブアプリマニフェスト | MDN](https://developer.mozilla.org/ja/docs/Web/Manifest/display_override)
  * 今回は使用しませんでしたが、iOS Safari 等への互換性に配慮しつつ対応しているブラウザで `window-controls-overlay` や `fullscreen` を有効にしたりしたい時に使えます。
  * [明日の表示モードに備える  |  Capabilities  |  Chrome for Developers](https://developer.chrome.com/docs/capabilities/display-override?hl=ja)
* [icons - ウェブアプリマニフェスト | MDN](https://developer.mozilla.org/ja/docs/Web/Manifest/icons)
* [theme-color - HTML: HyperText Markup Language | MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color)
  * `<meta>` タグ
* [Supported Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html#//apple_ref/doc/uid/TP40008193-SW3)
  * Apple 特有の `<meta>` タグ
* [Meta Theme Color And Trickery | CSS-Tricks](https://css-tricks.com/meta-theme-color-and-trickery/)
* [今から始めるPWA対応（Web App Manifest編） | フロントエンドBlog | ミツエーリンクス](https://www.mitsue.co.jp/knowledge/blog/frontend/202203/01_1359.html)
* [CSSだけでiPhoneの特殊な画面に対応する方法と、XcodeとXAMPPを使って実際に確認する方法|Webデザインの教科書](https://web-design-textbook.com/recipe/iphone-design/)
* [アプリアイコン | Apple Developer Documentation](https://developer.apple.com/jp/design/human-interface-guidelines/app-icons)
* [next/head | Next.js](https://nextjs-ja-translation-docs.vercel.app/docs/api-reference/next/head)
