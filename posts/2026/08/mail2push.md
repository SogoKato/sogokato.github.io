---
title: "メールをスマホの通知に変えるサービスを作った"
date: "2026-08-07"
tags: ["Cloudflare", "個人開発", "PWA", "JavaScript"]
---

エアコンのタイマーの作動結果をメールで通知できるのですが、当然メールの内容は毎回同じです。確認はしたいのですが、読んだあとも受信箱に残り続けて溜まっていくのは、なんかいやでした。その場で確認したいだけであって、保存しておきたいわけじゃないのです。

とはいえ、エアコンのアプリを見てもメールの設定しかなさそうでしたので、メールを通知に変えられたら便利そうっていうことで、作ってみました。

アプリ: https://push.sogo.dev  
ソースコード: https://github.com/SogoKato/mail2push

## なにができるの？

ログインすると、`a1b2c3d4.aircon.4d81b0c6f2@push.sogo.dev` のような受信専用アドレスを発行できます。あとは、これを機器やサービスの通知メールの宛先に設定するだけです。

![mail2push_01](/images/posts/2026/08/mail2push_01.png)

用途ごとに何個でも発行できて、付けた名前がそのまま通知のタイトルに出ます。どこから来たお知らせなのかが一目で分かりますし、要らなくなったものだけを個別に失効できます。

このアドレス宛にメールが届くと、登録した端末すべてにまとめて通知が飛びます。通知を見逃しても、直近7日分は履歴から読み返せます。

![mail2push_02](/images/posts/2026/08/mail2push_02.png)

そのほかの仕様はこんなところです。

* パスワードはなし。メールアドレスに届く6桁のコードでログインする
* 7日を過ぎた通知は自動的に消える
* 広告・追跡なし
* 無料

対応環境は iOS 16.4 以降と、Android の Chrome です。**iPhone / iPad ではホーム画面に追加してからでないと通知を有効にできません**（Safari のタブ上では Push API が使えないという iOS 側の制約です）。Android の Chrome はタブのままでも許可できますが、ホーム画面に追加しておくと通知が自動的に解除されにくくなります。

## しくみ

構成はこれだけです。  
個人的には、サーバレスかつネイティブアプリも不要であるこの組み方が成立していること自体がいちばん面白いところだと思っています。

```text
機器 (SMTP)
  → Cloudflare Email Routing (catch-all)
  → Email Worker      … 宛先を検証して Queue に積む
  → Queue Consumer    … VAPID 署名 + RFC 8291 暗号化して Push 送信
  → PWA (Service Worker) … 通知を表示
```

自前の SMTP 受信サーバは不要です。そもそも多くの住宅回線 ISP はインバウンドの25番ポートを塞いでいるので、家でメールを受けようとしてもそもそもできません。

Email Worker というプロダクトを今回、私自身初めて知りました。ニッチぽいですが地味に活用の幅が広がりそうなプロダクトだと思いました。`email()` ハンドラーを生やすとメールがコードに届く、というのは新鮮です。

```ts
export default {
  async email(message, env, ctx): Promise<void> {
    // message.to, message.from, message.headers, message.raw が使える
  },
};
```

ドメインを Cloudflare に置いて Email Routing を有効にし、catch-all ルールの宛先を「Send to a Worker」にすれば、そのドメイン宛のメールが全部ここに流れてきます。

### Queue を挟むと Free プランの CPU 10ms に収まる

無料で実現できる構成にする、というところにもこだわりました。

Workers の Free プランは CPU 時間が10ms/invocation です。メールをパースして、署名を検証して、DB を引いて、VAPID JWT に署名して、RFC 8291 の暗号化をして、Push サービスに投げる——これを1回の呼び出しで全部やると、暗号処理が重くて厳しそうに見えます。

ところが、I/O 待ちの時間は CPU 時間にカウントされません。カウントされるのは実際に JS を実行している時間だけです。つまり処理を分割すれば、それぞれが独立した10ms予算を持てます。

そこで責務を2つに分割しました。

* **Email Worker** … パース + 署名検証 + D1 lookup + Queue へ enqueue して終了
* **Queue Consumer** … VAPID 署名 + RFC 8291 暗号化 + Push 送信

実測は Email Worker が9ms、Queue Consumer が5msでした。どちらも余裕をもって収まっています。

Queue を使う理由はもう1つあります。  
`email()` ハンドラーには再配送の仕組みがありません。Worker が例外を投げると SMTP のトランザクション自体がエラーになりかねないので、Push サービスの一時的な失敗（429 や 5xx）を安全にリトライするには、Queue のリトライ・バックオフ・DLQ に任せるのが良いです。Cloudflare Queues は2026年2月から Free プランでも使えるようになりました。

なお、CPU 時間についてはよく分からない挙動も見ています。

| メール本文サイズ | 実測 CPU 時間 | 結果 |
| ---------------- | ------------- | ---- |
| 11.5KB           | 12ms          | `ok` |
| 35KB             | 12ms          | `ok` |
| 638KB            | 46ms          | `ok` |

公称の上限は10msのはずなのに、12msでも46msでも `outcome: "ok"` で正常終了しています。ハードな打ち切りではなく何らかの猶予があるのか、実際の上限がドキュメントより高いのかは分かっていません。

ただ、非公開の仕様的な部分を当てにはできないので、`rawSize` が 256KiB を超えたら MIME 解析をスキップしてヘッダーの Subject だけ使う、というガードを入れてあります。

### 受信側は PWA

通知を受ける側は、ネイティブアプリを作らずに PWA で済ませました。iOS も 16.4 から Web Push に対応しているので、ホーム画面に追加してもらえれば通知は届きます。App Store や Google Play の審査・登録料が要らないというのは、無料で完結させる上で重要です。

## おわりに

メールでしか通知を送れない機器をお持ちの方は、よかったら使ってみてください。ソースコードも公開しているので、自分の Cloudflare アカウントで同じものを動かすこともできます。

なお、このサービスは Claude Code と一緒に作りました。その過程の話は次の記事で書くつもりです。

**2026-08-08 追記**

[](/posts/2026/08/mail2push-with-ai) を公開しました。

## 参考文献

* [SogoKato/mail2push](https://github.com/SogoKato/mail2push)
* [Workers API · Cloudflare Email Service docs](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
* [Overview · Cloudflare Queues docs](https://developers.cloudflare.com/queues/)
* [Web Push for Web Apps on iOS and iPadOS | WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
