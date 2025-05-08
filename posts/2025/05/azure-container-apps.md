---
title: "Azure Container Appsを触って「もうこれでいいじゃん」って思った"
date: "2025-05-08"
tags: ["Azure", "コンテナ", "Kubernetes"]
---

[Azure Container Apps](https://learn.microsoft.com/ja-jp/azure/container-apps/overview) を触ってみて、他サービスと比べて選びたくなるポイントがあったので書いてみたいと思います。

## 要約

* Azure Container Apps は Kubernetes ベースのマネージドなコンテナプラットフォーム
  * Kubernetes に慣れている人ならとても扱いやすいけど、面倒なクラスタ管理はしなくていい
* Azure Container Apps では [KEDA (Kubernetes-based Event Driven Autoscaler)](https://keda.sh/) をサポートしている
  * Azure Container Apps Jobs ではイベント駆動でコンテナを0個からスケーリングできる
* ライトなコンテナランタイムじゃ痒いところに手が届かないけど、自分でクラスタを管理するのは避けたい人に刺さりそう

## 経緯

Azure App Service で動くアプリから何らかのキューにジョブを追加したら実行してくれるような仕組みを構築できないかと検討していたら、Azure Container Apps Jobs で Azure Service Bus とか Event Hubs と連携してイベント駆動なアーキテクチャが実現できそうっていうことに気づきました。私は恥ずかしながら KEDA がなにかを知らなかったので調べてみたら、めちゃめちゃサポートされているスケーラーの種類が多く、拡張性の高さに驚きました。

個人的に Kubernetes ベースなところ、オープンソースなスケーラーをサポートしているところ（[Microcoft 自身も貢献している](https://keda.sh/community/#partners)）が気に入りました。

## KEDA とは

KEDA は Kubernetes 上で動作するイベント駆動型オートスケーラーで、外部イベントの数に応じて任意のコンテナをスケーリングできます。70種類以上のビルトインスケーラーを持ち、メッセージキュー、データベース、メトリクスシステム、CI/CD、さらにはカスタムスケーラーまで幅広くサポートしているのが強みです。

## スケーリングが柔軟

上述の通り KEDA ではたくさんのスケーラーがサポートされているので、ユーザーの要件に合わせてアプリやジョブをスケーリングできます。キューにジョブを追加したい場合、Azure Service Bus のような専用のキューサービスを使ってもいいですし、MongoDB で任意のフィルタを組んでもいいです。

よくあるクラウドの自動スケーリング機能では CPU やメモリの負荷に応じてスケールさせることはできますが、例えば利用者数に関わらず使えるだけの計算リソースを使ってしまうアプリのようなケースだとうまくスケーリングさせられません。KEDA ならビジネス要件に合わせて柔軟なロジックを組むことができて便利そうです。

## 全部これでいけそう

![Azure Container Apps のシナリオ例](https://learn.microsoft.com/ja-jp/azure/container-apps/media/overview/azure-container-apps-example-scenarios.png)

Web アプリをデプロイするケースだけでなく、バックグラウンド処理やイベント駆動処理、さらには Dapr を活用したマイクロサービス構成まで幅広く対応できるので、アプリケーションの実行環境としてやりたいこと大体これで済みそうだと思いました。色々なクラウドサービスを使い分けるのは認知負荷も高まりますしひとつのサービスで完結するなら理想です。Kubernetes ベースなので馴染みやすさもあります。

A/B テストや Blue-Green deployment、証明書管理の機能などもあるので、Kubernetes クラスタを建てて自分で追加インストールする機能は大抵備わっていそうです。

## おわりに

クラウドサービスながら、メジャーな OSS をフル活用した仕様なので、独自仕様みたいなのが少ないのが嬉しいですね。また、毎月最初の 180,000 vCPU 秒、360,000 GiB 秒（メモリ）、2,000,000 万件のリクエストは無料なので、手軽に試せます。

## 参考文献

* [Azure Container Apps の概要 | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/container-apps/overview)
* [Azure Container Apps の変更を更新してデプロイする | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/container-apps/revisions)
* [Azure Container Apps での証明書 | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/container-apps/certificates-overview)
* [MongoDB-Powered Autoscaling: Harnessing KEDA to Scale Applications Dynamically Based on Database Events Triggered by MongoDB Query Results. | by Mohammad saquib | Medium](https://medium.com/@mohammadsaquib.ee/mongodb-powered-autoscaling-harnessing-keda-to-scale-applications-dynamically-based-on-database-f38a68e71db6)
