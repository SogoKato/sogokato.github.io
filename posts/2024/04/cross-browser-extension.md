---
title: "クロスブラウザ拡張機能を頑張らずに開発する"
date: "2024-04-16"
tags: ["JavaScript", "ブラウザ"]
---

ブラウザ拡張機能開発のために用意されている API は基本的にブラウザ間で共通化されていて、同じコードベースでクロスブラウザ対応させることが可能です。

> Firefox の拡張機能は WebExtensions API を使ってビルドされ、この API は拡張機能をクロスブラウザーで開発するシステムです。このシステムの大半は Google Chrome と Opera と [W3C Draft Community Group](https://browserext.github.io/browserext/) でサポートされている [extension API](https://developer.chrome.com/extensions) と互換性があります。

https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions

[前回紹介した Tanuki Utilities](/posts/2024/04/introducing-tanuki-utilities) の開発のため Firefox と Chrome で動くように作った時のメモです。なるべく頑張らずに作っているので、ちゃんと作りたい場合は [WebExtension Toolbox](https://github.com/webextension-toolbox/webextension-toolbox) を使ったほうがいいかもしれません。

## やったこと

* マニフェストの共通化
* Web Extensions API へのアクセスに chrome ネームスペースを使う

https://github.com/SogoKato/gitlab-project-favicon

### マニフェストの共通化

Chrome は既に Manifest V3 (MV3) に移行していますし、Firefox も2023年1月リリースの109からデフォルトで有効化されています。MV2 と MV3 では manifest.json で使えるキーも違うので、これから作るのであれば MV3 に統一しちゃいましょう。

[manifest.json のブラウザー互換性](https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Browser_compatibility_for_manifest.json)ページを見れば、使いたいキーがブラウザでサポートされているかどうかを確認できます。

### Web Extensions API へのアクセスに chrome ネームスペースを使う

Firefox では `browser` が、Chrome では `chrome` が Web Extensions API にアクセスするためのネームスペースですが、Firefox では移植の手助けのために `chrome` も使えるようになっています。

なので、次のように書けます。

```js
async function getSettings() {
  return await chrome.storage.sync.get(null);
}
```

Firefox のドキュメントでは Chrome は非同期処理にコールバックを使っていると説明されていたりしますが、MV3 からは Chrome でも Promise がサポートされているので Promise を使っておけば問題ないです。

## まとめ

意外と少ない対応手順でクロスブラウザ対応できることがわかりました。他にも細かい違いはあるようなので、気になる方は参考文献のリンク先を参照してください。

## 参考文献

* [ブラウザー拡張機能 - Mozilla | MDN](https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions)
* [Chrome との非互換性 - Mozilla | MDN](https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
* [manifest.json のブラウザー互換性 - Mozilla | MDN](https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Browser_compatibility_for_manifest.json)
* [Browser compatibility | Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/browser-compatibility/)
* [Manifest v3 in Firefox: Recap & Next Steps - Mozilla Add-ons Community Blog](https://blog.mozilla.org/addons/2022/05/18/manifest-v3-in-firefox-recap-next-steps/)
* [コードを更新する  |  Extensions  |  Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/api-calls?hl=ja)
