---
title: "AGNTCon + MCPCon Japanに参加しました（2日目）"
date: "2026-09-11"
tags: ["会議", "MCP", "認証/認可"]
---

[AGNTCon + MCPCon Japan](https://events.linuxfoundation.org/agntcon-mcpcon-japan/) の2日目のメモです。今日は午後から参加しました。1日目は [AGNTCon + MCPCon Japanに参加しました（1日目）](/posts/2026/09/agntcon-mcpcon-day1) に書いています。

## Workshop: Delegated Authorization for AI Agents

[Workshop: Delegated Authorization for AI Agents: Build an Agent with Fine-Grained Permissions](https://agntconmcpconjapan26.sched.com/event/2SrLI/workshop-delegated-authorization-for-ai-agents-build-an-agent-with-fine-grained-permissions-sohan-maheshwar-authzed)

* ReBAC + オープンソースを使用
* スコープ付きの委譲、有効期限付きの権限付与

昨日の日立のワークショップも Keycloak や MCP Inspector を使ったハンズオンだったので、興味のある方は [AGNTCon + MCPCon Japanに参加しました（1日目）](/posts/2026/09/agntcon-mcpcon-day1) も併せてご覧ください。

* Ambient Authority
  * N users × M agents × O actions
  * ユーザ、エージェント、リソースの関係や状態は変化し続けるグラフ
  * トークン、JWT、ACL、リクエストのペイロードだけには収まらない
  * RBAC のような粗い粒度の手法では複雑すぎる
* Google は ACL、RBAC、ABAC のどれも彼らの規模に合わないと考えたので Google Zanzibar を作った
  * グローバル分散型の認可システム
  * ReBAC（Relationship-based access control）

Relation
* オブジェクトの間の関係で表す
  * member of a group
  * editor of a document
* Relation tuple: `document:123#owner@user:3`
  * User 3 is an owner of a document with id 123
* Graph で表現される
  * writer は reader の持つ権限も持ち合わせる、ということも表現可能
* 可能な限りキャッシュを活用してパフォーマンス向上
  * 他の人の権限チェック時に取得した内容もキャッシュに使える
* Zanzibar-like なシステムが活きるところ
  * 低レイテンシ、高スループットの認可チェック
  * 階層的な権限モデル
  * Ambient Authorization
* SpiceDB: Zanzibar の OSS 実装

メモ: AWS の Cedar と比較してみたいです。以前 [Cedarで（超最小限な）RBAC認可を実装してみる](/posts/2023/12/cedar-rbac) を書いたときの記憶では、あっちは認可を表す言語という性格が強かった気がします。

資料: [authzed/workshops の delegated-agent-authorization](https://github.com/authzed/workshops/tree/main/delegated-agent-authorization)

### Part 1

まずは権限チェックを行わないバージョンで試します。

```text
definition user {}

definition agent {
    relation delegator: user
}

definition environment {}
```

### Part 2

エージェントがユーザに代わって動作し、全てのアクションに対して権限がチェックされるようにします。

* user、agent、environment という種類を定義し、定義の中に relation を定義する
* 権限の判断のたびに SpiceDB が呼ばれ、allowed、needs approval、blocked の3種類の意思決定をする
  * 承認は human in the loop
* なぜ Agentic AI に重要か: 決定論的なチェックができる
  * プロンプトインジェクションを止める
  * Ambient Authorization
  * 毎回同じ答えになる
  * これは RBAC やアクセストークンでは簡単には実現できない

```text
definition user {}

definition agent {
    relation delegator: user
}

definition environment {
    relation direct_deployer: user
    relation agent_deployer: agent
    relation approver: user
    relation destroyer: user
    permission deploy  = direct_deployer + agent_deployer
    permission approve = approver
    permission destroy = destroyer
}
```

staging には deploy できるけれど、production への deploy は承認が必要、という状態になります。

![staging への deploy は許可され、production への deploy は承認待ちになっている画面](/images/posts/2026/09/agntcon-mcpcon-day2_01.png)

### Part 3

期限付きのアクセス（time-bound access）です。`agent_deployer` に `with expiration` を付けます。

```text
use expiration

definition user {}

definition agent {
    relation delegator: user
}

definition environment {
    relation direct_deployer: user
    relation agent_deployer: agent with expiration
    relation approver: user
    relation destroyer: user
    permission deploy  = direct_deployer + agent_deployer
    permission approve = approver
    permission destroy = destroyer
}
```

needs approval → staging を30秒だけ grant → allowed → 期限切れ → needs approval、と変わります。

![30秒の期限付きで staging への deploy を許可し、期限切れ後に再び承認待ちになる様子](/images/posts/2026/09/agntcon-mcpcon-day2_02.png)

### Part 4

ヒエラルキー構造です。`gated_by` で環境同士に親子関係を持たせ、`agent_deploy` を「自分の環境の `agent_deployer` であり、かつ gated_by 先の環境の `agent_deployer` でもある」という `&` の条件にします。

```text
use expiration

definition user {}

definition agent {
    relation delegator: user
}

definition environment {
    relation direct_deployer: user
    relation agent_deployer: agent with expiration
    relation approver: user
    relation destroyer: user
    relation gated_by: environment
    permission agent_deploy = agent_deployer & gated_by->agent_deployer
    permission deploy = direct_deployer + agent_deploy
    permission approve = approver
    permission destroy = destroyer
}
```

production を approve → production deploy → allowed → staging を revoke → production deploy → needs approval、と変わります。production が staging に gated_by されているので、staging の権限を取り消すと production の deploy も止まる、という動きです。

![production の承認後に staging を revoke すると、production への deploy が再び承認待ちになる様子](/images/posts/2026/09/agntcon-mcpcon-day2_03.png)

## Beyond Prototypes: Building Enterprise-scale Agentic Systems

[Beyond Prototypes: Building Enterprise-scale Agentic Systems - Kevin Dubois, IBM](https://agntconmcpconjapan26.sched.com/event/2QlEV/beyond-prototypes-building-enterprise-scale-agentic-systems-kevin-dubois-ibm)

* エンタープライズ言語が次の AI フロンティア = Java
  * LangChain4j、Quarkus といったエコシステムはもうある
* 1つの AI サービスから始めて、エージェンティックなシステムへ
  * エージェンティックなワークフローや状態などが加わる
* ツールが本番環境を破壊することがあるかもしれない
  * 1ツールの不具合が連鎖的に障害を引き起こすかもしれない
  * 適切な信頼境界が必要
* ガードレール
  * プロンプトインジェクション対策
  * ツール引数をツール内でバリデーションするようにする
* Java の型やフレームワークは MCP とよく適合する

## MCP × A2A Platform for the Enterprise: Security by Spec

[MCP × A2A Platform for the Enterprise: Security by Spec - Masaki Tsukada, Mitsubishi Electric Corporation](https://agntconmcpconjapan26.sched.com/event/2WCMf/mcp-x-a2a-platform-for-the-enterprise-security-by-spec-masaki-tsukada-mitsubishi-electric-corporation)

* スライド: [MCP × A2A Platform for the Enterprise ～ Security by Spec ～ (PDF)](https://hosted-files.sched.co/agntconmcpconjapan26/f1/MCP%C3%97A2A_Platform_for_the_Enterprise.pdf)

* 社内業務向けに1つの enterprise-wide agent platform を作って展開している
  * トークン使用量を見られる管理者向け機能
  * エージェントを多数用意していて、使いたいエージェントを明示的にユーザが選ぶ設計
  * いらなくなったエージェントを削除するという取り組みもしている

Point 1 “Open protocols at the boundary”
* いろんなチーム、エンジニアが作ったエージェントをどう繋げるか
* 個々にインターフェイスの調整をするのは現実的じゃない
* → オープンプロトコルである MCP、A2A を採用

Point 2 “Centralized governance at the gateway”
* 認証・認可が必要になる
* 何も考えずにやると
  * 個別に認可が必要になる
  * 誰がどれだけトークンを使ったか、といった観測が難しくなる
  * ガードレールの一貫性がなくなる
* → 全ての通信をゲートウェイに通す
* A2A の Agent Card に role 属性を追加し、誰がそのエージェントを使っていいのかを規定して、事前にデータベース化
  * 例えば manager role だけが strategy agent を呼び出せる

Point 3 “Task decomposition by the Orchestrator”
* タスクの解釈を orchestrator にやらせる
* 社内のさまざまな業務の人がいるので、スーパバイザ型

このプラットフォームをどう作ったか
* Coding agent を中心において開発

Point A “Build Security into the Specification”
* 要件を抜け漏れなく定義
  * 人が指示していないものはうまくいく保証がない
  * セキュリティに関しても同様で、抜け漏れなく定義した
* 守り
  * OWASP Top 10 for LLM Applications、OWASP Top 10 for Agentic Applications
  * 社内ポリシー
* 攻め
  * MITRE ATT&CK Enterprise
  * MITRE ATLAS
* まずは見出しレベルで抜けがないかを確認 → 守りの項目チェック → 攻めの項目チェック、を繰り返し

Point B “Use Design Documents as the SSOT”
* 並行して開発することができるようになった一方、誰かが共通機能をいじったときの同期が難しくなった
* 設計書を SSOT として Git で管理して対応
* ADR（Architecture Decision Record）を残す

Point C “Scale Code Review with AI”
* レビューがボトルネックになった
* GitHub Copilot
* AWS Continuum（AWS Security Agent）
* AWS DevOps Agent

## 感想

昨日に引き続き、本番環境で動かす上での実践的な内容が多く、大変勉強になりました。昨日がどちらかといえば戦略・戦術的な話が多いとしたら、今日は特に、明日からすぐに試してみたいと思えるような、具体的に持ち帰れるものが多く、技術的な好奇心をくすぐられました。

---

ステッカーをもらいました。SpiceDB の名前は DUNE のスパイスから来ていて、マスコットの Dibs は砂漠のネズミの Muad'Dib だそうです。

![SpiceDB のステッカーシート。マスコットの Dibs と「THE ACLs MUST FLOW」の文字](/images/posts/2026/09/agntcon-mcpcon-day2_04.jpg)
