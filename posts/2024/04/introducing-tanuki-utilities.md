---
title: "Tanuki Utilitiesの紹介（旧 gitlab-project-favicon）"
date: "2024-04-05"
tags: ["GitLab"]
---

以前 Qiita で書いた [GitLabのタブを開きすぎて見分けづらいのでfaviconを変える拡張機能を作った](https://qiita.com/SogoK/items/31f74b517dc3c6884c04) の記事のブラウザ拡張機能を **Tanuki Utilities** と改称してリニューアルしたので改めて紹介します。名前の通り、GitLab ユーザに便利な機能を提供するための拡張機能です。

* ソースコード  
  https://github.com/SogoKato/gitlab-project-favicon/
* Firefox  
  https://addons.mozilla.org/firefox/addon/gitlab-project-favicon/
* Chrome  
  https://chromewebstore.google.com/detail/tanuki-utilities/bakcfpilmcemknpdfdakmfnfikedmodh

## なにができるの？

v2.1.1 現在、提供している機能は2つです。Enabled GitLab Sites の設定を入れない限り、全サイトで拡張機能が実行されます。

* **GitLab の favicon をプロジェクトやグループのアイコンに変更**  
  これは従来からの機能で、拡張機能を入れるだけで動作します。たくさんの GitLab タブがある時に見分けやすくなります。  
  ![Firefox](https://raw.githubusercontent.com/SogoKato/gitlab-project-favicon/b9a3c3f4923bcdc0395725c1c2cd5b8c675a73b2/images/screenshot_firefox_overview.png)  
  ![Chrome](https://raw.githubusercontent.com/SogoKato/gitlab-project-favicon/b9a3c3f4923bcdc0395725c1c2cd5b8c675a73b2/images/screenshot_chrome_overview.png)
* **"Copy reference" ボタンをトップバーに追加** 🆕  
  Issue や Merge request への参照（`group/project#1` みたいな）をコピーするボタンを常に表示します。最近の GitLab では3点メニューの中に隠れてしまい、かつページ下部では3点メニューが表示されないので重宝します。デフォルトでは無効なので設定から有効化してください。  
  ![Firefox](https://raw.githubusercontent.com/SogoKato/gitlab-project-favicon/b9a3c3f4923bcdc0395725c1c2cd5b8c675a73b2/images/screenshot_firefox_copy_reference.png)  
  ![Chrome](https://raw.githubusercontent.com/SogoKato/gitlab-project-favicon/b9a3c3f4923bcdc0395725c1c2cd5b8c675a73b2/images/screenshot_chrome_copy_reference.png)

## なんで名前変えたの？

旧称 `gitlab-project-favicon` には GitLab 社の商標が入っており、その点が「GitLab が公式にサポートするプロジェクトであると混同される可能性がある」ので [Trademark Guidelines](https://handbook.gitlab.com/handbook/marketing/brand-and-product-marketing/brand/brand-activation/trademark-guidelines/) に従って名前から GitLab を抜いてね、と GitLab 知財チームからメールをもらってしまったのがきっかけになります。GitLab 社としてはそのエコシステムに貢献してくれることを嬉しく思い、拡張機能を開発することに協力的であり、感謝していることが書かれていました。

せっかく名前を変えるので、favicon 変更以外の機能を追加できるような名前に変えさせてもらいました。

## おわりに

この記事の執筆時点で、Tanuki Utilities は Chrome で70人程度、Firefox で10人程度のユーザが使ってくれています。レビュー評価で⭐️5をもらえていることも嬉しく思います。今後も自分が必要と感じた機能があれば追加したいと思いますのでよろしくお願いします。
