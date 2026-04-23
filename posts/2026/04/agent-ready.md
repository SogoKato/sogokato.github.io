---
title: "Agent-Readyなブログにしてみようと思った"
date: "2026-04-24"
tags: ["ブログ", "LLM"]
---

Cloudflare が、[自分のサイトが Agent-Ready であるかどうかを測定できるサイトを公開](https://blog.cloudflare.com/agent-readiness/) しました。AI エージェントがサイトを発見しやすいか、内容を取り込みやすいか、利用方針を機械的に解釈できるかといった観点をまとめて確認できるツールです。

と、いうことで我がブログを測定してみた結果がこちら。  
（Site type: Content site で測定）

![isitagentready score: 50](/images/posts/2026/04/isitagentready_01.png)

> Discoverability
> * ✅ robots.txt
> * ✅ Sitemap
> * ❌ Link headers
> 
> Content Accessibility
> * ❌ Markdown negotiation
> 
> Bot Access Control
> * ✅ AI bot rules
> * ❌ Content Signals

おそらく従来的な SEO だけをやっているサイトは同じ結果になるんじゃないかと思います。それぞれ結果を見てましょう。

このツールの気が利いてるポイントは、直すためのプロンプトも提供してくれてるところです。直せそうな項目はそのプロンプトをとりあえずコーディングエージェントに突っ込んでみると良いでしょう。

## Discoverability

### robots.txt

シンプルに `robots.txt` を公開しているかです。

### Sitemap

サイトマップが公開されていて `robots.txt` から辿れるようになっているかです。

### Link headers

HTTP のレスポンスヘッダに Link ヘッダを追加することで、AI が有用なリソースにたどり着けるようにすることで対応できそうです。

> Add Link response headers to your homepage that point agents to useful resources. For example: Link: </.well-known/api-catalog>; rel="api-catalog" to advertise your API catalog, or Link: </docs/api>; rel="service-doc" for API documentation. See RFC 8288 for the Link header format and IANA Link Relations for registered relation types.
>
> (日本語訳)  
> エージェントを有用なリソースへと導くために、ホームページのレスポンスに Link ヘッダーを追加しましょう。例えば、API カタログを周知したい場合は Link: </.well-known/api-catalog>; rel="api-catalog" を、API ドキュメントを案内したい場合は Link: </docs/api>; rel="service-doc" を使用します。Link ヘッダーのフォーマットについては RFC 8288 を、登録済みのリレーションタイプについては IANA Link Relations を参照してください。

ただこのブログは GitHub Pages で公開をしていて、GitHub Pages ではカスタムのレスポンスヘッダをつけたりはできないので、この項目を pass させるのは諦めました。

代わりに HTML の `<link>` タグで意味的に同じことをやっておきました。

[🔍️ Add link headers · SogoKato/sogokato.github.io@dda040f](https://github.com/SogoKato/sogokato.github.io/commit/dda040fd912dabb30170578e536ceaae5b70c1d3)

## Content Accessibility

### Markdown negotiation

> Enable Markdown for Agents so requests with Accept: text/markdown return a markdown version of your HTML response while HTML stays the default for browsers. Confirm the response uses Content-Type: text/markdown (and x-markdown-tokens if available).
>
> (日本語訳)  
> エージェント向けに Markdown を有効化しましょう。これにより、Accept: text/markdown ヘッダーを含むリクエストに対しては HTML レスポンスの Markdown 版を返し、ブラウザに対しては従来通り HTML をデフォルトとして返すようにします。また、レスポンスの Content-Type が text/markdown（および、利用可能であれば x-markdown-tokens）になっていることを確認してください。

Cloudflare は、Markdown を LLM に与えた時のトークンの使用量は HTML に比べて大幅に少ないと説明しています。

[エージェント向けマークダウンの導入](https://blog.cloudflare.com/ja-jp/markdown-for-agents/)

この項目も GitHub Pages の静的サイトでは達成が難しい（このサイトは Next.js の SSG でエクスポートしたものです）ので、諦めました。Cloudflare の Markdown for Agents は Pro プラン以上で使える機能のようです。

## Bot Access Control

### AI bot rules

robots.txt の AI エージェント向けの User-agent ルールがあるかのチェックです。

本サイトはワイルドカードで指定していたので、これで OK でした。

```
User-agent: *
Allow: /
```

### Content Signals

こちらも robots.txt の記述のチェックで、`Content-Signal` を使って AI によるコンテンツの使用に関する選択（承諾するかしないか）が定義されているかどうかです。

AI の学習、検索、入力に使っても良いかどうかを `yes` / `no` で選択します。本サイトは学習も含め全て許諾しました。

```
Content-Signal: ai-train=yes, search=yes, ai-input=yes
```

next-sitemap で robots.txt を出力するための設定ファイルを編集して対応しています。

[🔍️ Add content signal to robots.txt generation · SogoKato/sogokato.github.io@ced1a1e](https://github.com/SogoKato/sogokato.github.io/commit/ced1a1e3d73cbaf494dc4bb00567833e0dd605a4)

## おわりに

ということで、直せたのは1項目のみ、スコアは67点になりました。

![isitagentready score: 67](/images/posts/2026/04/isitagentready_02.png)

これらの項目を全てクリアするには Cloudflare のサービスを駆使すると良いぞっていう同社のポジショントークも含まれたツールということも試してみてわかりましたが、より良い AI 時代のインターネットのために一度試してみる価値のあるツールだなと思いました。
