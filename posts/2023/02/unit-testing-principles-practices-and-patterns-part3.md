---
title: "プロセス外依存は統合テストで確認しよう：単体テストの考え方／使い方 第3部"
date: "2023-02-22"
tags: ["単体テスト", "読書"]
---

[『単体テストの考え方／使い方』（Vladimir Khorikov 著、須田智之訳）](https://book.mynavi.jp/ec/products/detail/id=134252)を読んだので、そのまとめを部ごとに書いていこうと思います。

1. [単体テストの目的・定義・学派・命名について：単体テストの考え方／使い方 第1部](/posts/2023/01/unit-testing-principles-practices-and-patterns-part1)
1. [リファクタリングしやすいテストを書こう：単体テストの考え方／使い方 第2部前半](/posts/2023/02/unit-testing-principles-practices-and-patterns-part2-1)
1. [ビジネス・ロジックと連携の指揮を分離すれば良いテストが書ける：単体テストの考え方／使い方 第2部後半](/posts/2023/02/unit-testing-principles-practices-and-patterns-part2-2)
1. プロセス外依存は統合テストで確認しよう：単体テストの考え方／使い方 第3部（この記事）

今回は第3部「統合（integration）テスト」についての感想と考察になります。第3部は以下の3章で構成されています。第4部「単体テストのアンチ・パターン」については割愛しますが、ここにもまた重要かつ気になるトピックの内容が書かれていたので、興味のある方はぜひ手に取って読んでみてください。

* 第8章：なぜ、統合（integration）テストを行うのか？
* 第9章：モックのベスト・プラクティス
* 第10章：データベースに対するテスト

これらの章では、私がこの本を読みながら実際にどのように自分のプロジェクトをリファクタリングしていくかを考えているときに浮かんでいた疑問点をほぼすべて解消してくれました。

特に印象に残ったところをまとめていきたいと思います。

## モックを使うべきタイミング

> 管理下にある依存に対しては実際のインスタンスを使うようにし、管理下にない依存に対してはモックを使うようにしましょう。

_『単体テストの考え方／使い方』（Vladimir Khorikov 著、須田智之訳）p.270 より引用。_

ここでいう「管理下にある依存」とは、テスト対象のアプリケーションからしか利用されない「好きなようにできる」依存のことで、多くのアプリケーションにおいてはデータベースなどが該当します。「管理下にない依存」とは、テスト対象のアプリケーションが「好きなようにできない」依存のことで、外部から観測可能な振る舞いになります。

著者は、管理下にない依存をモックの置き換えることで「どのようなリファクタリングを行ったとしても、管理下にない依存とのコミュニケーションを行う際の仕様が壊れていないことを確認できる」ため、非常に効果的と言っています。逆に、管理下にある依存に対しては、そのまま使うことで「対象のアプリケーションが最終的にどのような状態になるのかを外部の視点から検証しやすく」なり、加えて、「データベースへのリファクタリング（たとえば、カラムの名前の変更やほかのデータベースへの移行）もおこないやすく」なると言っています（p.270）。

## 開発者しか見ないログはテストで確認しない

> ログ出力をテストすべきか、という問いの答えは、**テスト対象とするログ出力がアプリケーションの観測可能な振る舞いの一部なのか、それとも、実装の詳細なのかによって変わる**、ということになります。

_『単体テストの考え方／使い方』（Vladimir Khorikov 著、須田智之訳）p.292 より引用。太字は原文ママ。_

なので、ほかのすべての外部依存と同じように「外部から観測可能な振る舞い」なのか「実装の詳細」なのかで考えればよく、つまり、「ビジネス要求に応じたログ」なのか「開発者しか見ないログ」なのか、ということになります。

## 本番と同じ種類のデータベースでテストを行おう

実際のデータベースをテストで使えるようにするためにはそれなりの工夫が必要でしょう。また、そのコストを考えてモックにしているという人も多いのではないでしょうか。とはいえ、前々項で著者が挙げている利点は、そのコストを上回るものだと思います。テスト用のデータベースを用意する際の指針をまとめると以下のようになります。

> * 統合テストでのデータの後始末
>   * 各テスト・ケースを実行する前にバックアップからデータベースを復元させる
>     * テストに費やされる時間は他の方法よりも長くなる
>   * テスト・ケースの実行後にデータの後始末をする
>     * データの後始末の処理が実行されなかったときに問題となってしまう
>   * 各テスト・ケースを1つのデータベース・トランザクション内で行い、コミットせずにロールバックする
>     * 本番環境では行わないデータベース・トランザクションの利用をテストでは行うことになってしまう
>   * **テスト・ケースの実行前にデータの後始末を行う**
>     * これらの中では、この方法がもっとも優れている
>     * あまり時間がかからず、本番環境での振る舞いとテスト時の振る舞いが異なることもなく、データの後始末がきちんと実行されるのかを心配する必要もなくなるから
> * メモリ内（in-memory）データベースの使用に関する問題
>   * SQLite
>   * 本書では、テストの際に、**メモリ内データベースを使うことを推奨していません**
>   * 機能面において一般的なデータベースと異なる部分があるから

_『単体テストの考え方／使い方』（Vladimir Khorikov 著、須田智之訳）pp.349-352 より引用し箇条書きにまとめた。太字は筆者によるもの。_

ローカル環境では大抵の場合ローカルで動かす用の DB コンテナが建っているのでそれをテストでも使用すれば問題なさそうですし、CI 環境でも実行環境に別のコンテナを立てる手段が用意されている（たとえば、[Gitllab では services を使う方法がある](https://docs.gitlab.com/ee/ci/services/mysql.html)）ので、何とかなる気がします。

## モックの対象になる型は自身のプロジェクトが所有する型のみにする

モックを使うような、管理下にない依存を扱うとき、サード・パーティ製の SDK などのライブラリを使うことが多いでしょう。著者はモックを使用する際のベスト・プラクティスの1つとして「そのライブラリに対するアダプタを独自に作成し、そのアダプタに対してモックを作成する」ということを勧めています。理由は下記です。

> * サード・パーティ製のライブラリが実際に機能しているのかを深く知ることは滅多にできないから。
> * サード・パーティ製のライブラリ自体が利用可能なインターフェイスを既に提供していた場合、そのインターフェイスをモックに置き換える対象にすると、モックの振る舞いとサード・パーティ製のライブラリの実際の振る舞いとが一致することを保証しなくてはならなくなり、リスクを伴うことになるから。
> * アダプタを挟むことで、サード・パーティ製のライブラリに含まれるビジネス的に本質ではない技術的な詳細を隠蔽できるようになり、さらに、自身のアプリケーションの用語を用いてライブラリとの関係を定義できるようになるから。

_『単体テストの考え方／使い方』（Vladimir Khorikov 著、須田智之訳）p.323 より引用。_

これによって、ライブラリの更新によってインターフェイスが変わった場合でも、「変更による影響をそのアダプタだけに抑えられる」ことも利点として挙げられています（p.323）。

## リポジトリ（データベース操作クラス）はテストすべきか？

データベースを操作するためのリポジトリに対する単位テストを行わなくてよいのか、ということがこの本を読んでいく中で気になっていました。

リポジトリを[前回出てきたプロダクション・コードの4種類](/posts/2023/02/unit-testing-principles-practices-and-patterns-part2-2)に当てはめると「あまり複雑にはならないが、プロセス外依存を扱うため……『コントローラ』に属することになる」とされています。プロセス外依存を扱っていて保守コストが高い一方で、複雑さを伴っていないので退行に対する保護があまり備わっていないということから、著者は「**リポジトリを直接検証するのではなく、統合テストのシナリオの一部に含めて検証する**」という結論を出しています（pp.363-365）。

たとえば、assert フェーズで実際のリポジトリのメソッドを使って取得することで、取得メソッドの動作確認が行えます。

## まとめ

以上、第3部「統合（integration）テスト」についてのまとめと所感でした。

『単体テストの考え方／使い方』では本当に多くの学びがあったので、いま私が担当しているコード・ベースにもその学びを反映させたいと思い、計画を立ててみました。まず、コード・ベースをあるべき姿の3種類に分類しました。

* ドメイン・モデル／アルゴリズム
* コントローラ
* 取るに足らないコード

現状では「ドメイン・モデル／アルゴリズム」の多くでコントローラに関するコードが混在してしまっている（外部依存をそのまま扱っている）ので、該当箇所に印をつけていき、それぞれについてどのようにコントローラの分離が行えるかを検討しました。

次に、今あるテスト・ケースをどのようにリファクタリングしていくかを検討しました。これらのリファクタリングは、リファクタリングのためのリファクタリングと言えそうです（これが完了することで、リファクタリングへの耐性がつくので）。

これらはまだ素案の段階ですが、これからチームメンバーと議論してさらに煮詰めていき、これを実行に移していくのがとても楽しみです。

最後に、素晴らしい本を執筆・翻訳くださった方々へ、その努力に敬意を表するとともに感謝申し上げます。
