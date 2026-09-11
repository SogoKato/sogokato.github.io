---
title: "AGNTCon + MCPCon Japanに参加しました（1日目）"
date: "2026-09-10"
tags: ["会議", "MCP", "認証/認可"]
---

[AGNTCon + MCPCon Japan](https://events.linuxfoundation.org/agntcon-mcpcon-japan/) に参加してきました。1日目のメモです。2日目は [AGNTCon + MCPCon Japanに参加しました（2日目）](/posts/2026/09/agntcon-mcpcon-day2) に書いています。

いろんなスピーカーの口から「demo から production へ」という言葉が出てきていました。キーノートの Kaz Sato さんによる A2A の紹介の中で、WeChat が A2A でメッセージや通話・ビデオ通話ができるようになったという話があり、個人的に [LINE Messaging APIでAG-UIを使えるアダプタを作った](/posts/2026/03/line-agui-adapter) ので、メッセージングアプリが A2A 対応したという点は興味深かったです。

以下私のメモです。今回は Claude Code にメモを殴り書きして、それを裏どりしたり、追加で調べてもらったりしながら理解を深め、それをそのまま記事化しました。このやり方はとても良かったのでおすすめです。

## Towards Trustworthy Autonomous Research

[Towards Trustworthy Autonomous Research - Wataru Kumagai, NexaScience/RIKEN](https://agntconmcpconjapan26.sched.com/event/2RqMK/towards-trustworthy-autonomous-research-wataru-kumagai-nexascienceriken)

* 論文提出数が大きく増えた一方で peer review がボトルネックに
  * ソフトウェアでも同じことは起きている
* AI 研究システムの内部で Search → Hypothesize → Code → Run → Fail と進んだあとに Mishandle すると、その後のステップの結果が全部汚染される
* メッセージ: 結果を信頼するにはプロセスを検証する必要がある
* 論文は小さい主張の集まり。各主張を検証可能にする
  * 従来のやり方（結果生成 → 検証）ではなく、検証方法を先に考えてから始める
* 仕組み
  * 研究システムが直接論文を書くのではなく、DB に検証された主張を蓄積していき、DB を元に論文が作られる
* AIRAS
  * OSS、MCP、Verification-first

先に検証方法を考えるという点で、考え方がテスト駆動開発っぽいと思いました。AI エージェントを作る時にも、どう性能を確かめるかを考えてから設計するようにしていくべきだなと思いました。

## Workshop: Building MCP Authorization with Keycloak and agentgateway

[Workshop: Building MCP Authorization with Keycloak and agentgateway](https://agntconmcpconjapan26.sched.com/event/2RpxA/workshop-building-mcp-authorization-with-keycloak-and-agentgateway-yoshiyuki-tabata-michito-okai-hitachi)

* 資料: [Hitachi/oss-assets](https://github.com/Hitachi/oss-assets/tree/main/sessions/2026/agntcon-jp/workshop)
* スライド: [Workshop Building MCP Authorization with Keycloak and agentgateway (PDF)](https://hosted-files.sched.co/agntconmcpconjapan26/3e/Workshop%20Building%20MCP%20Authorization%20with%20Keycloak%20and%20agentgateway.pdf)

MCP を認可なしに使うとどうなるか？というところから始まる、Keycloak のハンズオンワークショップでした。ハンズオンを進めながらスクショを撮っておきました。

`agentgateway/config/config-auth.yaml` を見てみると、OPA（Open Policy Agent）が設定されています。ポリシーは Rego で書かれています。

JWT の scope に注目します。

```json
{
  "header": { ... },
  "payload": {
    ...
    "azp": "https://hitachi.github.io/oss-assets/sessions/2026/agntcon-jp/workshop/mcp-client.json",
    "scope": "offline_access read"
  }
}
```

この状態で `delete_customer` 操作をしてみて、権限不足のダイアログが出ることを確認します。

![delete_customer を呼び出して権限不足になった MCP Inspector の画面](/images/posts/2026/09/agntcon-mcpcon-day1_01.png)

```json
{
  "ok": false,
  "kind": "auth_challenge",
  "authChallenge": {
    "reason": "insufficient_scope",
    "requiredScopes": [
      "admin"
    ],
    "raw": {
      "httpStatus": 403,
      "wwwAuthenticate": "Bearer error=\"insufficient_scope\", scope=\"admin\""
    }
  }
}
```

ワークショップ環境には OpenTelemetry Collector、Tempo、Grafana も入っていて、Grafana でリクエストのトレースを見ることができます。さっきの権限不足のリクエストを見ると、MCP Inspector からの POST がエラーになっていて、その下に agentgateway のスパンと ExtAuthz のスパンがぶら下がっています。ExtAuthz が OPA への認可の問い合わせだと思います。

![Grafana で権限不足になった delete_customer のトレースを表示している画面。mcp-inspector の POST の下に agentgateway と ExtAuthz のスパンが見える](/images/posts/2026/09/agntcon-mcpcon-day1_02.png)

Keycloak の画面で権限を追加します。

![Keycloak のクライアント設定で admin スコープを追加している画面](/images/posts/2026/09/agntcon-mcpcon-day1_03.png)

* optional = 要求されなければ与えない
* standard flow = authorization code flow

JWT の scope を再確認すると `admin` が増えています。

```json
{
  "header": { ... },
  "payload": {
    ...
    "azp": "https://hitachi.github.io/oss-assets/sessions/2026/agntcon-jp/workshop/mcp-client.json",
    "scope": "offline_access admin read"
  }
}
```

delete できるようになったことを確認しました。

![delete_customer が成功した MCP Inspector の画面](/images/posts/2026/09/agntcon-mcpcon-day1_04.png)

質疑応答
* Q. 今回試したのは人間がログインに関与・同意していたが、エージェントが本人と別のアイデンティティとしてログインするにはどうするべきか？
* A. 議論中の分野だと思っている。CIBA など、事前にリソースオーナーが同意する方式になるはず
* Q. 今回 tool 単位で認可していたが、その tool 内でアクセスする特定のリソースに対して認可することも可能なのか？
* A. 今答えられないが、おそらく可能

CIBA については自分でも調べてみたいと思います。

## Designing Trust Boundaries for Agent-to-Agent Systems

[Designing Trust Boundaries for Agent-to-Agent Systems: Lessons Learned from a Technical PoC](https://agntconmcpconjapan26.sched.com/event/2RCwp/designing-trust-boundaries-for-agent-to-agent-systems-lessons-learned-from-a-technical-poc-ryuji-iijima-softbank-corp)

* A2A でエージェント同士が会話するようになる上で、新しい信頼境界の設計が必要になった
* AgentFirewall として、Agent が話す時の間に入るシステムを試作した
* 統制したいエージェントとは何だったのかを改めて定義する作業をした
  * エージェント = 意思決定をして実行をするもの

学び#1: A2A だけでは統制しきれない
* Agent A が意思決定をして Agent B に対して A2A アクションを起こしたとして、Agent B 内での活動は A2A では捕捉できない
* → AgentFirewall から AgentSecOps へ

学び#2: Agent 間の接続（src/dst）が許可されていることだけでは、通すことができない
* → 会話文脈をみて判定する必要がある（ルールベース、LLM as judge）

課題#1: Streaming response をどう扱うか？
* 一定程度バッファリングした上で返すのか？

課題#2: 非決定性・説明可能性
* 評価する側の精度も100%ではない
* 監査証跡を残すことも重要

学び#3: トークンコストがかかる
* 何を評価したいのか？→ ルールベースで表現できないか？
  * YES → 決定論的・ルールベース制御をデフォルトにする
  * NO → モデルを使った検査を選択的に使う（ストリーミング時の難しさや、非決定性といったトレードオフあり）

## The Agent Builder Loop from Daily Work to OSS

[The Agent Builder Loop from Daily Work to OSS](https://agntconmcpconjapan26.sched.com/event/2Qn4a/the-agent-builder-loop-from-daily-work-to-oss-minoru-onda-kddi-agile-development-center-corporation)

コーディングエージェントをコーディング以外に使っている人いる？という問いかけから始まり、多くの人が挙手していました。私も手を挙げました。このブログのメモも今 Claude Code に取ってもらっています。

コーディング以外の例
* 経費レポート
* プロジェクトワーク（フォルダ内に文字起こしや資料を配置）

* 人間が指示を出し、エージェントが人間に確認、人間がゴーを出す
  * これを semi automation と呼んでいる
* 1つ1つの仕事は早くなっているわけじゃないかもしれない
  * 並行して複数動かせることが強み。人間はやりたいことに集中

出力の品質はいいか？
* ゴール・対象読者 → アウトライン → … → 最後の10%を自分でやる
* 声に出して指示する
* プロンプトには量が必要、プロンプトを磨き上げる必要はない

エンプラ環境ではよくあること: MCP も SaaS アクセスもない
* → 「自分で操作するからコピペできるようにして」
* 人間は操作するだけ
* 下書きや読むことは任せて良い。送信するみたいなのは任せない

日々の仕事 → 困りごと → 作る → 使う → OSS
* 自分がビルドしたものはオープンソースにしている
* 出会ったバグはアップストリームに PR を投げている
* 社内では Inner Source

> The code shows what. The why needs words.

## The Production Gap

[The Production Gap: Why Governing Agent Traffic Is the Key To Shipping Multi-Agent Systems](https://agntconmcpconjapan26.sched.com/event/2QlDL/the-production-gap-why-governing-agent-traffic-is-the-key-to-shipping-multi-agent-systems-juhi-singh-kong-prithvi-raj-mirantis)

* 現在多くの人は orchestrator + sub agents の構成
* 分散環境でエージェントを実行しようとすると複雑になる
  * 答え: キューの背後でステートレスワーカーとして実行する
* スキルレジストリを作る
  * 概要文 → スキル本体 → 参照文献
* 統制レイヤーのためのゲートウェイを作る

デモはオープンソースで組んだ次の構成でした。すべてのホップが統制ポイントになっていて、MCP と A2A の2層がオープン標準、という説明です。

* Producers → Event Gateway（Kafka に store、消費を統制）→ Orchestrator（LangGraph、CrewAI、AutoGen）
* Orchestrator → AI Gateway（LiteLLM、Envoy、APISIX、Bifrost）
  * model routing → Azure、Bedrock、Gemini
  * tools → MCP Tools → Backend APIs
* Orchestrator → A2A → Support Engineer（draft PR）、Sales（regional notifs）

ステートレスで実行できるように整えるというのは、本番では確かに大事だと思いました。

## Architecting Agent-Native Data Layers

[Architecting Agent-Native Data Layers: Managing Persistent State Across MCP Tools](https://agntconmcpconjapan26.sched.com/event/2TAFy/architecting-agent-native-data-layers-managing-persistent-state-across-mcp-tools-tomohiro-ichimura-yugabyte-japan)

* ステップごとに状態が蓄積されていく
* MCP が resources、prompts、tools を標準化するが、永続化の機構ではない
* データの種類ごとにライフサイクルは異なる
  * それぞれ適した形式のデータストアに入れる？→ サイロ化
* Durable なデータプレーンがあれば、翌日に別のエージェントにハンドオフすることができるようになる

Datapack（社内プロジェクト）
* conversations
* memory
* knowledge
* traces

Meko: OSS として公開
* MCP サーバがあるので、接続して Datapack の機能をエージェントから利用可能

会話履歴や tool call 結果のようなデータを、なんで MCP ツールが取れるようになるのかよくわからなかったので、質問してきました。

* MCP で引数として渡す場合は LLM が考えた結果になるので、正確に生のコンテキストが渡るのかが保証できないのはそう
* フックの仕組みでツールの入出力やユーザ入力の原文がそのまま渡るようにすれば、そこから会話履歴をとったり、"remember" みたいなワードに反応してメモリを作ったりを、MCP 側でやることができる
  * フックの仕組みはエージェントごとに違うので、エージェントごとにプラグインを用意する形になる

## 感想

「demo から production へ」という言葉が象徴的で、本番運用に耐えるエージェントで必要になる要素をどう実現していくかの実践知が集まったイベントでした。使われている部品もクラウドネイティブの世界で見慣れたものや、オープンソースとして公開されたものがほとんどで、Linux Foundation のイベントらしいなと思いました。

2日目は [AGNTCon + MCPCon Japanに参加しました（2日目）](/posts/2026/09/agntcon-mcpcon-day2) に続きます。
