---
title: "PyScriptを使ってブログのサンプルコードを実行させる"
date: "2023-03-06"
tags: ["Python", "WebAssembly", "PyScript", "JavaScript", "React", "Next.js"]
showTerminalAside: false
---

[前回の記事](/posts/2023/03/pyscript-codeblock)を書くときに WebAssembly でブログのコードブロックのコードを実行させられたら面白いかも、ということで PyScript を使って実装してみました。React & Next.js で使う際の注意点についても書こうと思います。

以下については前提知識としてこの記事では解説しません。

* [PyScript](https://pyscript.net/)
* [Pyodide](https://pyodide.org/en/stable/)
* [WebAssembly](https://webassembly.org/)
* [react-markdown](https://github.com/remarkjs/react-markdown) のコードブロック（バッククォート3つ \```）をカスタマイズする方法

## 2024-12-21 更新

いつの間にか動かなくなっていたので最新化しておきました。

## やったこと

* react-markdown のコードブロックでのオレオレ文法で PyScript を導入
* PyScript のカスタム要素（以下）に対応する React コンポーネントを作成
  * `<py-script>`, `<script type="py-editor">`, `<py-script terminal>`, `<py-config>`
* React のハイドレーションのエラーを回避するために Next.js の [Dynamic Import](https://nextjs.org/docs/advanced-features/dynamic-import) を使用
* PyScript の初期化の仕様に合わせた最適化

## まずは遊んでみよう

こちらが成果物になります。コードブロック開始の \`\`\` の横に書いた文字列が、コードブロックをカスタマイズする関数の引数に渡されるので、ここでオレオレ文法を制定します。

### py-terminal タグ

ターミナルの出力を表示するためのタグです。後述の `<py-script>` での標準出力や標準エラーはここに出てきます。ページに複数配置することができますが、表示される内容は同じになります。

Markdown では以下のように記述しています。

\`\`\`pyterminal  
\`\`\`

```pyterminal
```

### py-script タグ

最も基本的なタグです。

\`\`\`python:pyscript  
print("Hello world!")  
\`\`\`

それを `<py-script>` タグに変換することで、PyScript 初期化時にスクリプトが実行されます。

```python:pyscript
print("Hello world!")
```

### script タグ type="py-editor"

Jupyter Notebook のような感じで逐次実行ができます。

```pyrepl
print("こんにちは世界!")
x = 1
print(x)
```

### py-config タグ

[各種設定値](https://docs.pyscript.net/2024.11.1/user-guide/configuration/)を入れるためのタグです。

ページ内に配置できる `<py-config>` は一つだけであることに注意が必要です。

今回の実装時には PyScript の fetch 機能を使ってスクリプトファイルのロードを行うという要件があったので、`pyconfig` の markdown の記述は、記事ではファイル一覧として見せるようにしました。

\`\`\`pyconfig  
\[files\]  
"../../../assets/posts/2023/03/dog.py" = "./dog.py"
\`\`\`

```pyconfig
[files]
"../../../assets/posts/2023/03/dog.py" = "./dog.py"
```

アップロードしたファイルを PyScript に読み込むことで、自作スクリプトを使用できます。

`dog.py` の中身はこうなっています。

```python:dog.py
class Dog:
    def bark(self):
        print("Bow-wow!")
```

`<py-script>` で実行すると print したものがターミナルに出てきます。

```python:pyscript
from dog import Dog

wanchan = Dog()
wanchan.bark()
```

## react-markdown のコードブロックでのオレオレ文法で PyScript を導入

すでに見ていただいたように、コードブロックの言語を記載する部分を拡張したオレオレ文法で実装しています。

コードブロック開始の \`\`\` の横に書いた文字列が [`CodeBlock`](https://github.com/SogoKato/sogokato.github.io/blob/8769da4e6bb4bdecf4a0c59d274d4a439b66535b/components/CodeBlock.tsx) コンポーネントの `className` 引数に渡されるので、それを `split` して条件分岐を作ります。

関連するソースコード（2024-12-21 時点）
* [components/CodeBlock.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/CodeBlock.tsx)
* ~~[components/CodeBlock.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/CodeBlock.tsx)~~

## PyScript のカスタム要素に対応する React コンポーネントを作成

上記の CodeBlock やその他の場所から呼び出される PyScript のカスタム要素を表すコンポーネントです。汎用的なライブラリを目指しているわけではないので、すべての引数を受け取れるようにはしていません。

関連するソースコード（2024-12-21 時点）
* `<py-script>`
  * [components/PyScript.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PyScript.tsx)
  * ~~[components/PyScript.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PyScript.tsx)~~
* `<script type="py-editor">`
  * [components/PyRepl.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PyRepl.tsx)
  * ~~[components/PyRepl.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PyRepl.tsx)~~
* `<py-script terminal>`
  * [components/PyTerminal.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PyTerminal.tsx)
  * ~~[components/PyTerminal.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PyTerminal.tsx)~~
* `<py-config>`
  * [components/PyConfig.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PyConfig.tsx)
  * ~~[components/PyConfig.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PyConfig.tsx)~~

## React のハイドレーションのエラーを回避するために Next.js の Dynamic Import を使用

PyScript が DOM の書き換えを行うので、サーバー側で SSR した結果とクライアントの DOM との不整合が発生し、ハイドレーションのエラーが発生してしまいます。

[Next.jsとTailwind CSSでブログを作るときに考えたこと](/posts/2022/11/blog-with-nextjs-and-tailwindcss)の記事でも紹介したことがありますが Next.js には [Dynamic Import](https://nextjs.org/docs/advanced-features/dynamic-import) という機能があり、これを使うことでクライアント側のみで実行したい処理を書くことができます。

上で作成した PyScript のカスタム要素に対応するコンポーネント（`PyConfig` 以外）を使う際は Dynamic Import を使用するようにしています。`PyConfig` については DOM が変更されることがないので Dynamic Import にする必要がないです（また、これを Dynamic Import にしたらうまく動作しませんでした）。

関連するソースコード（2024-12-21 時点）
* [components/CodeBlock.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/CodeBlock.tsx)
* ~~[components/CodeBlock.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/CodeBlock.tsx)~~

## PyScript の初期化の仕様に合わせた最適化

PyScript では script タグで読み込みが完了したタイミングで、初期化の処理が行われ、現状では初期化後に設定の変更等は行えません。つまり、script タグの読み込みが完了する時には `<py-config>` をはじめとする各要素が宣言されている必要があります（詳しくは要検証ですが）。

この仕様は、動的に要素を管理する React と相性が良くないです。とりあえず、`<ReactMarkdown>` の呼び出し側で、PyScript の各要素よりも後ろに配置し `lazyOnload` strategy で読み込むようにしています。

また、SPA のようなクライアント側でのルーティングを行なっているので、別の記事に移動しても前のページの実行結果がターミナルに残ってしまいます。現状では PyScript 側に destroy 系のメソッドが用意されていないので、こちらもとりあえずの対応として閲覧者にページをリロードするように促す仕組みを入れています・・・。🙇

関連するソースコード（2024-12-21 時点）
* [components/PostCard.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PostCard.tsx)
* ~~[components/PostCard.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PostCard.tsx)~~
* [components/PyTerminal.tsx](https://github.com/SogoKato/sogokato.github.io/blob/03e8408491b21db8a05d3fba6d754bdef6207a7e/components/PyTerminal.tsx)
* ~~[components/PyTerminal.tsx](https://github.com/SogoKato/sogokato.github.io/blob/3471507cfa722c763bdda0781e2d97ea17934a8d/components/PyTerminal.tsx)~~

## おわりに

PyScript はまだまだ発展途上感があり、周辺のエコシステムも整備されていませんが、今回は気合でブログのコードブロックに WASM を導入しました。サードパーティのライブラリも読み込めたりするので、ちょっとしたコードを載せて動かすには十分だと思います。

この記事が良ければ RSS 登録と「いいね」「役に立った」ボタンをポチッとお願いします！（YouTuber 風）  
そして、同じようなことを思いついた誰かの助けになれば幸いです！

## 参考文献

* [PyScript](https://pyscript.net/)
* [Pyodide](https://pyodide.org/en/stable/)
* [pyscript-react](https://github.com/Py4Js/pyscript-react)
* [オレオレ記法のMarkdownを任意のReactElementとして変換する](https://qiita.com/bigmon/items/de62335fbf8388192499)
