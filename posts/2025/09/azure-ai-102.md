---
title: "Microsoft AI-102 Azure AI Engineer Associate 受験記録"
date: "2025-09-27"
tags: ["Azure", "資格"]
---

Microsoft AI-102 Azure AI Engineer Associate を取得したので学習メモです。

過去の資格に関する記事はこちら
* [AWS Certified Solutions Architect - Professionalを取得した](/posts/2023/09/aws-solutions-architect-professional)
* [AWS Certified Solutions Architect - Associateを取得した](/posts/2023/08/aws-solutions-architect-associate)
* [CKAD受検記録【2023年版】](/posts/2023/03/certified-kubernetes-application-developer)
* [GCP未経験の新卒2年目がAssociate Cloud EngineerとProfessional Cloud Architectを連続で受検したときの記録](https://qiita.com/SogoK/items/bb5187524c2c7cde3620)
* [新卒エンジニアがCKA取得を目指してKubernetesを勉強したときの記録](https://qiita.com/SogoK/items/4ed2e118d0412c868169)

## 対象読者

* Azure の生成 AI 系サービスや、いくつかの AI 系サービスの利用経験がある人

## タイムライン

### 開始前のスペック

以下のサービスの利用経験がありました。

* Azure AI Foundry Agent Service
  * 関連記事: [Azure OpenAI Assistants APIとAI Agent Serviceを比較](/posts/2025/03/assistants-api-vs-azure-ai-agent-service)
* Azure OpenAI
* Azure AI Search
* Azure AI Document Intelligence
* 他の Microsoft 資格は AZ-900 くらい

### Azure 公式のサンプル問題を解いてみる

公式のページに [サンプル問題（練習評価）へのリンク](https://learn.microsoft.com/ja-jp/credentials/certifications/azure-ai-engineer/practice/assessment?assessment-type=practice&assessmentId=61&practice-assessment-type=certification) がありますので、まずはそれを使って試験の難易度を推察します。

複数回やって80%以上を得点できることが目安とされています。
私は学習開始前にやってみて70%でした。最初にしてはいい手応えだと思いました。やはり自分が触ったことがあるサービス以外は全然わからないという感触でした。

### 公式の学習コース (Microsoft Learn)

資格のページに掲載されている [Azure で AI ソリューションを開発する](https://learn.microsoft.com/ja-jp/training/courses/ai-102t00/) のコースを一通り完了させました。すごく量が多いわけではないですが、今回は学習期間をあまり確保できなかったのでサクサクとやりました。

ひとつひとつのモジュールの最後にハンズオンが付いていて、私はスキップしちゃいましたが、もしまだ Azure OpenAI や AI Foundry などを触ったことがなければやったほうがいいと思います。テストでは普通に Azure SDK を使うコードの問題がたくさん出ます。

### 本番

在宅で受験しました。今回はパスポートを使用しました。OnVUE のソフトウェアは事前にインストールしておき試験環境のチェックをしておくとスムーズです。

前回の反省を活かし、パソコンは充電しながら臨みました（[前回ヒヤヒヤしたので](/posts/2023/09/aws-solutions-architect-professional) 笑）。

ケーススタディが数問あり、他の一般的な問題とは独立していました。その数問の後は見直しの画面になり見直すことができますが、その先に進むともうケーススタディ問題の回答を修正することができません。

一般的な問題の方は、以下のような形式の出題が多かったです。

- 通常の選択肢
- 並べ替え問題（操作手順）
- コードの虫食い（引数やメソッド名など）
- Azure Portal のスクショが提示され、どのボタンを操作するか

結構出題形式のバラエティが豊かで面白いなと思いました。

全体を通して Microsoft のドキュメントを参照することができます。サイト内検索は正直かなりポンコツなので、自分の頭の中にどこに何が書いてあるかを入れておくといいでしょう……と無責任なことを言いましたが、そこまで覚えている人は余裕で満点合格できるでしょうから、関係ないですね。

API リクエストスキーマみたいな細かいところこそドキュメントを参照したかったのですが、自分は試験中全然辿り着けませんでした。
「なんもわからん！」みたいな問題で、雑に検索して検索結果をざっくり見たり、サービスページの階層を辿ったりして、それっぽい情報があればラッキー✌️みたいな使い方がいいかもです。

自分は100分のうち、25分くらい残して一周解き終わり、残りの時間でドキュメントを調べたりして見直ししました。全問を見直すほどの余裕はなく試験時間を使い切りました。

試験が完了するとその場で結果がわかります。私は805点でした（700点が合格ライン）。

## 感想

RAG とかを作るために使われるサービスは大体触ったことがあったので、学習の難易度はあまり高くありませんでした。とはいえ資格勉強によって、網羅的に知ることができるのでおすすめです。
AI 系は変化が速いのもあって資格の有効期間は1年と短いですが、更新していきたいですね。

## 参考リンク

* [マイクロソフト認定: Azure AI エンジニア アソシエイト - Certifications | Microsoft Learn](https://learn.microsoft.com/ja-jp/credentials/certifications/azure-ai-engineer/?practice-assessment-type=certification)
