---
title: "Firefoxでコピペのショートカットキーが使えない時の対処法"
date: "2024-09-06"
tags: ["開発環境", "Firefox"]
---

小ネタです。Firefox で [Code Server](https://github.com/coder/code-server) を使っている時にターミナルで Ctrl + V が効かなくて困ったのでメモ（Chromium 系のブラウザでは問題なし）。

アドレスバーに `about:config` と入力して `dom.events.testing.asyncClipboard` を `true` にすれば OK。

調べてみたら https://github.com/coder/code-server/issues/1106 には他の WA も載ってた。
