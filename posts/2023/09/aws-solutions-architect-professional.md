---
title: "AWS Certified Solutions Architect - Professionalを取得した"
date: "2023-09-21"
tags: ["AWS", "資格"]
---

[AWS 認定ソリューションアーキテクト - Professional (SAP-C02)](https://aws.amazon.com/jp/certification/certified-solutions-architect-professional/) の資格を取得したので学習メモです。

過去の資格に関する記事はこちら
* [AWS Certified Solutions Architect - Associateを取得した](/posts/2023/08/aws-solutions-architect-associate)
* [CKAD受検記録【2023年版】](/posts/2023/03/certified-kubernetes-application-developer)
* [GCP未経験の新卒2年目がAssociate Cloud EngineerとProfessional Cloud Architectを連続で受検したときの記録](https://qiita.com/SogoK/items/bb5187524c2c7cde3620)
* [新卒エンジニアがCKA取得を目指してKubernetesを勉強したときの記録](https://qiita.com/SogoK/items/4ed2e118d0412c868169)

## 対象読者

* AWS の SAP を1ヶ月強で攻略したい人
* AWS の実務経験はないが SAA を持っていて SAP の取得を目指している人

## タイムライン

### 開始前のスペック

* SAA を取得した直後

### AWS 公式のサンプル問題を解いてみる

[公式のページ](https://aws.amazon.com/jp/certification/certified-solutions-architect-professional/)にサンプル問題へのリンクがありますので、まずはそれを使って試験の難易度を推察します。

SAA の取得前に解いてみて10問中6問正解だったので少し油断しましたが、実際の試験は問題数が多いこともあり、もう少しハードルが高く感じました。

### AWS サービスの学習

SAP-C02 版の日本語教材は Udemy になかったので、下記の英語のコースを利用しました。Udemy の字幕には機械翻訳の機能がついていたので、特に違和感のない日本語字幕を見ながら、十分に理解できました。

内容としては最低でも SAA を取得した人向けで、ハンズオンはなく、重要なポイントを駆け足で触れていく形です。ジャンルごとに小テストがあります。私は SAA を取った後なるべく早く SAP を受験したかったので、内容もペースもちょうど良いと感じました。3週間ほどでこのコースを修了できました。

[Ultimate AWS Certified Solutions Architect Professional 2023](https://www.udemy.com/course/aws-solutions-architect-professional/)

### 過去問

過去問には上記の講座と同じ作者による問題を使用しました。英語ですが Google Chrome の翻訳機能を使って解きました。翻訳した際に `<code></code> タグ` の前後で語順がおかしくなってしまうのが残念でしたが、基本的には問題なく解き進めることができました。

[Practice Exam AWS Certified Solutions Architect Professional](https://www.udemy.com/course/practice-exam-aws-certified-solutions-architect-professional/)

私の成績が以下です。1回目は正解した問題も含め何日でもかけて解説とそのリンク先を見て疑問を解消していきます。2回目は間違った問題を中心にスピーディに復習します。  
難易度としては、実際の試験よりもシナリオが複雑で難しく設定されていました。一方で、本番の試験では過去問にないマイナーサービスがちょいちょい出てきていたので、そのあたりは別途軽く見ておくと良いかもしれません。

|タイトル（n回目）|得点|
|---|---|
|Mini Practice Test #1（1回目）|50%|
|Full Practice Test #2（1回目）|62%|
|Full Practice Test #3（1回目）|60%|
|Mini Practice Test #1（2回目）|90%|
|Full Practice Test #2（2回目）|88%|
|Full Practice Test #3（2回目）|88%|

### 本番

部屋をきれいに（？）片付けて在宅で受験しました。身分証は運転免許証で OK です。OnVUE のソフトウェアは事前にインストールしておき試験環境のチェックをしておくとスムーズです。

前回は、試験開始後のソフトウェアの動作が異常に遅く、クリックするごとに数秒間のビジー状態（マウスポインタのくるくる）が発生していて非常にストレスだったのですが、今回は軽快に動作したので特に問題はありませんでした。

M2 Macbook Air のバッテリー持ちが良いのを過信していましたが、試験中はカメラ等が常にオンなのでかなり発熱しますし、バッテリーの減りも早いです。試験開始後は充電ケーブルを挿せないので、途中から画面を暗くしたりしてバッテリー残量にヒヤヒヤしていました。試験終了時点でバッテリー残量は 18% になっていました。必ず充電ケーブルを挿すことをおすすめします。

所要時間はチェックインに25分程度、問題を解くのに2時間50分程度、事後アンケートに5分弱でした。

試験後2時間半程度で Credly からおめでとうございますメールが届き、合格したことを知ることができました。AWS の資格のマイページにアクセスすると結果が出ておりスコアを確認することができました。結果は799点でした（合格基準は750点）。割とギリ。

## 感想

今回の試験は今まで受けた資格試験の中でも一番難しかったと思います。去年受けた GCP の Associate Cloud Engineer と Professional Cloud Architect を受けましたが、AWS の方がどちらも一段難しいと思いました。

3時間で75問を解かなくてはいけないのはあまり時間がないですし、集中力を維持するのも大変です。夜疲れている時に過去問を解くのは確実に寝てしまうので、過去問を解くときは休日にしっかり時間を確保するか、半休を取るのが良いです。

簡単な資格ではないですが、その分達成感もありますし、価値のある資格だとも思います。AWS のサービスを最低限理解しているという自信にもなりますので、興味のある方はぜひチャレンジしてみてください。🔥

このレポートが今後受験を考えている方の参考になれば幸いです。
