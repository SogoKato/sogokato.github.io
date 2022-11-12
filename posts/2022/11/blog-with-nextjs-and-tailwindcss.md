---
title: "Next.jsとTailwind CSSでブログを作るときに考えたこと"
date: "2022-11-13"
tags: ["JavaScript", "React", "Next.js", "Tailwind CSS"]
---

このブログは Next.js の SSG（Static Site Generation; 静的サイト生成）機能を使いながら、デザインの大半は Tailwind CSS を使用して整えています。そして生成された HTML, CSS, JS は GitHub Pages でホストさせてもらっています。

そこそこの出来栄えになったので、今回はこのブログができるまでのお話をしたいなと思ったのですが、正直なところ、以下のリンク先のページを~~まるパク~~参考にさせてもらいながら作成したので、具体的な構築方法についてはそちらをご覧いただけると良いかと思います。1ステップずつ丁寧に解説されておりとても有用でした🙏

* [Next.jsを利用した初めての本格的Markdownブログサイトの構築](https://reffect.co.jp/react/nextjs-markdown-blog)

なので、今回は技術的な詳細というよりも、筆者が始める前に疑問だった点や技術選定、設計まわりについて書ければなと思います。

## 対象読者

* 自分のブログを作ってみたい人
* React や Next.js に興味がある人

## ブログをどこでホストするか

技術に関する記事を書くのであれば Qiita や Zenn でいいじゃんと思いますし、実際その方がはるかに楽で、多くのリアクションをもらいやすいと思います。そんな中、自分のブログを作る理由としては「やってみたかったから」以上の理由は存在しません。つまりロマンです。

しかしながら、いざ自分のブログを作ろうと思ったときに

* 簡単に、かつ高度なカスタマイズができる
* ランニングコストが安い

といった美味しい環境は思ったよりも少ないです。

ブログを作ると言ったら WordPress が超定番ですが、テーマを作るとなると php や WordPress の知識が必要になります。WordPress テーマづくりに携わったことがあるので、やってみると思ったより簡単なのですが、筆者のお仕事の分野とはかすらないのであまりモチベーションが湧きません。  
また、最低月数百円のランニングコストもかかりますし、動的にページを生成するのでレスポンスも遅くなりがちです。

次に SSG（Static Site Generation; 静的サイト生成）を検討します。Markdown で原稿を書き、静的な HTML などのファイルを出力すれば、GitHub Pages で無料で公開できるので結構良さそうです。

SSG のツールとしては有名なものがいくつかあります。

* Next.js
* Gatsby
* Hugo
* NuxtJS
* Jekyll

このうち、Next.js と Gatsby は React ベースのため当初は検討から外していました。筆者は Hugo を選び、配布テーマを適用してみたり、自作テーマを作り始めたりしましたが、想像より学習コストが高かったので挫折してしまいました。

代わりに最近波に乗っていそうな Next.js を使ってみることにしました。React を使うのは初めてだったので（チュートリアルしかやったことがない）躊躇していましたが、[最初に紹介した記事](https://reffect.co.jp/react/nextjs-markdown-blog)のおかげもあって、すんなりと構築することができました。React の基本的な知識さえあれば問題なさそうです。

## どうやってデザインするか

まずは Adobe XD でデザインカンプを作成します。いきなりマークアップを始めても、作りたいものが定まっていないと無駄に時間がかかってしまうので、多少手間でも作りたいもののイメージを先に決めておくと良いです。

![XD](/images/posts/2022/11/xd.png)

上図のような感じで、ヘッダーやサイドバー、記事一覧、記事ページをざっくりと作りました。

## React の CSS よくわからん問題

筆者の経験不足のせいなのですが、React で CSS でスタイルを適用するベストな方法がよくわかりませんでした😇

デザインカンプを作ってみて、そこまで複雑な CSS を記述する必要がなさそうだったので、Tailwind CSS を使ってみることにしました。

[Tailwind CSS](https://tailwindcss.com/) とは、HTML のクラス属性に `flex`, `pt-4`, `text-center` のようなクラス名を記述することで、`display: flex` をかけたり `padding-top` や `text-align: center` を設定できるというヤツです。

軽く個人的な感想をまとめてみると

Pros
* コード量が減る
* HTML 要素を消したけど CSS は消し忘れた、みたいなことはなくなる
* カスタムの色を設定できるなど、一定の柔軟性がある

Cons
* CSS の知識は必要（それはそう）
* 都度リファレンスを見てクラス名を確認する必要がある
* 複雑なことはできないので割り切るか、別の方法で書かなくてはいけない

な感じです。良いところも悪いところもありますが、今回筆者はアリだと判断して採用しましたし、実際良かったです。

## クライアント側で実行させたい処理どう書くの

SSG で静的なページを書き出すと言っても、クライアント側で実行させたい処理はあります。このサイトでは、ライトモード↔︎ダークモード切り替えや「いいね」ボタンがそれに該当します。いずれもユーザーのアクションによって DOM を書き換える必要性があります。

普通に React のコンポーネントとして書いてしまうと SSG でのビルド時に静的なページとして書き出されてしまうため、なんとかする必要があります。最初は public ディレクトリ内に js ファイルを置いて Next.js の [Script](https://nextjs.org/docs/basic-features/script) タグで読み込ませていたのですが、それよりも Next.js の [Dynamic Import](https://nextjs.org/docs/advanced-features/dynamic-import) 機能を使った方がスマートに書けます。

`{ ssr: false }` 引数を渡してあげることで、そのコンポーネントはブラウザ上でレンダリングされるようになります。

## GitHub Pages で公開するときの罠

晴れて準備完了！いざ公開！と意気揚々と GitHub Pages にデプロイしても、うまくいかないことがあります。

ビルド時には以下のコマンドを実行しましょう。

```
next build
next export -o docs/
touch docs/.nojekyll
echo 'sogo.dev' > docs/CNAME
```

ポイントは公開ディレクトリ（上記の場合は `docs`）の直下に `.nojekyll` というファイルを作成していることです。これがないと `_next` ディレクトリは以下が公開されずリンク切れになります。  
参考: [Next.js の SSG 機能で生成した静的サイトを GitHub Actions 経由で GitHub Pages に公開する](https://sidearrow.github.io/article/next-js-ssg-on-github-pages)

最後のコマンドはカスタムドメイン名を使用しない場合は不要ですが、使用する場合は都度生成しておかないと消えてしまうため、カスタムドメイン名でアクセスできなくなります。

## 今後やっていきたいこと

以上がこのブログを作るにあたって考えたことなのですが、まだやり残したことはあります。

* 記事をリッチにしたい
  * シンタックスハイライト
  * リンクカード
  * 目次（ToC）
* おすすめ記事をいい感じのアルゴリズムで出したい
  * まずは記事を書きためなきゃ。。

## 最後に

つらつらと駄文を書き連ねてしまいました。勘の良い方は気づいていると思いますが、このブログは GitHub Pages でホストされている＝[ソースが見れる](https://github.com/SogoKato/sogokato.github.io)なので、もし興味のある方がいらっしゃいましたら覗いてみてください。