---
title: "Microsoft Agent Framework実践ガイド: Workflowって結局なんなのか"
date: "2026-06-27"
tags: ["Microsoft Agent Framework", "Python", "LLM"]
---

Microsoft Agent Framework (MAF) には、AI エージェントをビジネスプロセスに組み込むための **Workflow** という仕組みがあります。

この記事では Workflow の概要と各機能を解説しますが、私個人が試しながら得た経験をもとに書くので、筆者の意見が多分に含まれていることをご留意ください。MAF は公式リファレンスも充実していますので、初めての方はまずは全体を一読してみてもらって「なるほどわからん」ってなってからここに戻ってきてもいいかもしれません。

最初に整理しておきたいのが、**Workflow は「決定論的なもの」ではない**という点です。Workflow という言葉の印象から「フローを固定するもの」と思いがちですが、実際にはマルチエージェントの協調パターン（GroupChat・Magentic など）も Workflow として実装されており、それらは LLM 主導の非決定論的な動作をします。この前提を踏まえて読んでもらえると理解しやすいと思います。

## 3つのアプローチ

MAF で業務自動化を考えるとき、大きく3つのアプローチがあります。

| アプローチ                 | 決定論的？ | 概要                                                           |
| -------------------------- | ---------- | -------------------------------------------------------------- |
| **シングル Agent + Tool**  | No         | LLM が全体を判断。外せない操作だけ Tool で定義                 |
| **Workflow（非決定論的）** | No         | オーケストレーションパターンで複数 Agent を協調させる          |
| **Workflow（決定論的）**   | Yes        | WorkflowBuilder でグラフを固定。型安全なメッセージルーティング |

### シングル Agent + Tool から始める

「分類してからルーティングして回答する」というフローをプログラムで書くより、LLM に全体の判断を任せて、外せない操作だけを Tool として定義する方がシンプルで柔軟です。「フロー全体を決定論的にして、一部を LLM に任せる」より、「LLM に全体を任せて、外せないところだけ Tool 定義や `approval_mode` で縛る」方が、LLM の柔軟性を活かしながらリスクを局所化できます。

```python
from agent_framework import Agent, tool

@tool(approval_mode="always_require")  # 実行前に人間の承認を必須にする
def escalate_to_tier2(ticket_id: str, reason: str) -> str:
    """Tier2 チームへエスカレーションする"""
    ...

agent = Agent(
    name="SupportAgent",
    instructions="問い合わせを受けて適切に対応してください。Tier2 対応が必要と判断したらエスカレーションツールを使ってください。",
    tools=[escalate_to_tier2],
    client=client,
)
```

### Workflow を選ぶ場面

シングル Agent で対応が難しくなったら Workflow を検討します。

**マルチエージェント協調が必要な場合**は Workflow のオーケストレーションパターンを使います。「複数の専門 Agent を協調させたい」「処理の途中経過も見えるようにしたい」といったニーズに応えます。これらは非決定論的です。

**決定論的な制御が必要な場合**は Graph API で固定グラフを組みます。「このカテゴリの問い合わせは必ずこのチームへ」のようにルーティング自体がビジネスロジックになっている場合がこれに当たります。そのルーティング部分だけを Workflow で固めて `workflow.as_agent()` で Agent として包み、全体のオーケストレーションに組み込む使い方も現実的です。

また、**プロセス再起動をまたいだ長時間実行・耐障害性**が必要な場合も Workflow の Checkpoint 機能が力を発揮します（後述）。

## Workflow の2種類の API

Workflow の API は2種類あります。

1つ目は Graph API で、AutoGen 時代からあります。名前の通り LangGraph に似ています。オーケストレーションパターン（Sequential/GroupChat/Magentic 等）は内部的に Graph API で実装されています。

もう一つの Functional API は Python 関数として自前でパイプラインを書く別のアプローチです。

### Graph API（WorkflowBuilder）

`WorkflowBuilder` で **有向グラフ** としてワークフローを定義します。ノード（Executor）とエッジを明示的に設定し、型安全なメッセージルーティングをもとに並列実行（スーパーステップ）が行われます。

```python
from agent_framework import WorkflowBuilder

workflow = (
    WorkflowBuilder(start_executor=triage_executor)
    .add_edge(triage_executor, routing_executor)
    .add_edge(routing_executor, answer_executor)
    .build()
)

async for event in workflow.run("注文の状況を教えてください", stream=True):
    ...
```

### Functional API（@workflow / @step）

`@workflow` デコレーターを async 関数に付けるだけで、Python ネイティブの制御フロー（`if/else`、ループ、`asyncio.gather`）を使ってワークフローを書けます。

> **注意**: Functional API は2026年6月現在 **実験的** な扱いで、将来変更・廃止される可能性があります。

```python
from agent_framework import workflow, step

@step  # Checkpoint/HITL 再開時にこの結果がキャッシュされ再実行をスキップできる
async def classify(text: str) -> str:
    return (await classifier_agent.run(text)).text

@workflow
async def support_pipeline(user_input: str) -> str:
    category = await classify(user_input)
    return (await answer_agent.run(f"[{category}] {user_input}")).text
```

`@step` を付けることで結果がキャッシュされ、**Checkpoint から再開したとき・HITL で中断後に再実行したときに、完了済みのステップをスキップできます**。これが `@step` を使う実質的な意義で、Checkpoint も HITL も使わないなら、`@step` は何もしない普通の async 関数と変わりません。

### どちらを選ぶか

|                              | Functional API                                 | Graph API                          |
| ---------------------------- | ---------------------------------------------- | ---------------------------------- |
| 制御フロー                   | Python ネイティブ（if, loops, asyncio.gather） | エッジと条件                       |
| オーケストレーションパターン | 非対応                                         | Sequential/GroupChat/Magentic 等   |
| チェックポイント             | `@step` 単位のキャッシュ                       | スーパーステップ境界               |
| 向いている場面               | 自前パイプライン・柔軟な分岐・実験的用途       | 固定グラフ・マルチエージェント協調 |
| 状態                         | 実験的                                         | 安定                               |

## オーケストレーションパターン

Workflow には複数エージェントを協調させるための **オーケストレーション** パターンが用意されています。これらはすべて Workflow として実装されていますが、LLM が動作を判断するため**非決定論的**です。

| パターン   | 概要                                                         |
| ---------- | ------------------------------------------------------------ |
| Sequential | エージェントを順番に実行し、前の出力を次のエージェントに渡す |
| Concurrent | 複数エージェントを並列実行する                               |
| Handoff    | コンテキストに応じてエージェント間で制御を引き渡す           |
| Group Chat | 共有の会話空間でエージェントが協調する                       |
| Magentic   | マネージャーエージェントが専門エージェントを動的に指揮する   |

いずれも `XxxBuilder` でワークフローを構築し、同じ `workflow.run()` で実行できます。

### Magentic

**Magentic** は [Magentic-One](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/magentic-one.html) の設計をベースにしたパターンで、マネージャーエージェントがタスクを計画し、専門エージェントを動的に選択しながら実行します。

```python
from agent_framework import Agent
from agent_framework.orchestrations import MagenticBuilder

search_agent = Agent(
    name="SearchAgent",
    description="社内ナレッジベースの検索を担当",
    instructions="社内 FAQ や過去のチケットから関連情報を検索してください。",
    client=client,
)
escalation_agent = Agent(
    name="EscalationAgent",
    description="エスカレーション判断を担当",
    instructions="問い合わせをエスカレーションすべきか判断し、理由を説明してください。",
    client=client,
)
manager_agent = Agent(
    name="SupportManager",
    description="サポート対応を統括するマネージャー",
    instructions="チームを調整して問い合わせに最善の回答を返してください。",
    client=client,
)

workflow = MagenticBuilder(
    participants=[search_agent, escalation_agent],
    manager_agent=manager_agent,
    max_round_count=10,
    max_stall_count=3,
    max_reset_count=2,
).build()

result = await workflow.run("注文 #12345 が届かないというお客様からの問い合わせです。対応方針を教えてください。")
print(result.text)
```

### GroupChat と Magentic の使い分け

ドキュメントでは「まず GroupChat を試してみることを推奨する」とされています。GroupChat は Magentic と同じアーキテクチャですが、複雑な計画フェーズがない分シンプルです。

Magentic はもともと Magentic-One 論文の4つの専門エージェント向けに設計されており、ドキュメントにも「元の設計外でどのくらいうまく動くかは未検証」と明記されています。まず GroupChat で要件を満たせるか確認し、もっと複雑な動的協調が必要になってから Magentic を検討するのが無難でしょう。

## Checkpoint による中断・再開

Checkpoint が活きるのは、「1回の実行の中にステップが複数あり、途中でプロセスがクラッシュしたとき、完了済みのステップを再実行したくない」という場面です。

「会話を複数ターン続けたい」「ユーザーとのやり取りを記憶したい」だけなら、Agent + HistoryProvider で十分です。HistoryProvider を渡した Agent を複数回 `run()` するだけで会話履歴は維持されるので、Checkpoint は必要ありません。

Checkpoint が必要になるのは主に以下のような場面です。

* 1回のワークフロー実行が長時間にわたり、途中のステップ結果を再実行なしに復元したい
* HITL（人間の承認待ち）でワークフローを一時停止し、プロセス再起動後に再開する必要がある

MAF のワークフローは **1インスタンス1回実行** という思想で設計されています。API コールやプロセス再起動をまたいで再開したい場合は、Checkpoint ストレージに状態を保存し、再起動後に復元する必要があります。

標準では以下の3種類の実装が提供されていますが、インターフェイスに沿ってカスタムで実装することもできます。

| ストレージ                  | 永続性           | 用途                         |
| --------------------------- | ---------------- | ---------------------------- |
| `InMemoryCheckpointStorage` | プロセス内のみ   | テスト・短命なワークフロー   |
| `FileCheckpointStorage`     | ローカルディスク | シングルマシン・ローカル開発 |
| `CosmosCheckpointStorage`   | Azure Cosmos DB  | 本番・分散環境               |

```python
from agent_framework import InMemoryCheckpointStorage, WorkflowBuilder

checkpoint_storage = InMemoryCheckpointStorage()

workflow = WorkflowBuilder(
    start_executor=start_executor,
    checkpoint_storage=checkpoint_storage,
).build()

async for event in workflow.run(input, stream=True):
    ...

# チェックポイント一覧を取得して最後の状態から再開
checkpoints = await checkpoint_storage.list_checkpoints(workflow_name=workflow.name)
saved = checkpoints[-1]
async for event in workflow.run(checkpoint_id=saved.checkpoint_id, stream=True):
    ...
```

なお、Checkpoint はワークフローの **スーパーステップ終了時**（Graph API）または **`@step` 完了時**（Functional API）に保存されます。Functional API で `@step` を使う主な意義はここにあります。

ただし、1インスタンスが1回しか使えないという制約から、アプリケーションとして仕立てる際は「ワークフローのインスタンス管理」と「Checkpoint の保存・復元」を自前で実装する必要があります。単純に Agent をホストするより設計の手間が増えるので、本当に Checkpoint が必要かどうかは最初に検討しておくべきです。

## 会話履歴の管理

「会話を記憶させたい」という要件は、Checkpoint ではなく **HistoryProvider** で対応します。エージェントに渡すだけで、複数回の `run()` をまたいで会話履歴が維持されます。Workflow を使わなくても機能します。

なお、`workflow.run()` や `workflow.as_agent()` には HistoryProvider を直接渡せません。Workflow 内で履歴を引き継ぐには、各 Agent のコンストラクタに渡す必要があります。なので、カスタム `Executor` を混在させると履歴管理を自前でやる必要があるため、可能な限りエージェントだけでフローを組む方がシンプルだと思います。[^1]

[^1]: Magentic オーケストレーションの manager agent には HistoryProvider を渡すことができないので注意。

```python
from agent_framework import Agent
from agent_framework.history import InMemoryHistoryProvider

history_provider = InMemoryHistoryProvider()

agent = Agent(
    name="SupportAgent",
    instructions="あなたはサポート担当です。",
    client=client,
    history_provider=history_provider,
)
```

## まとめ

MAF のドキュメントを見ると、Workflow は多機能で魅力的に見えますが、その分複雑でもあります。仕事でやるとなると「このフローじゃなくちゃいけない」と先入観が入りがちでもあります。まず「何が必要か」で MVP を作るためのアプローチを選ぶのがおすすめです。

| やりたいこと                                | アプローチ                                      |
| ------------------------------------------- | ----------------------------------------------- |
| まず動くものを作りたい                      | シングル Agent + Tool                           |
| 一部の操作を確実に人間が確認したい          | `approval_mode="always_require"` で Tool を定義 |
| 複数 Agent の協調が必要（非決定論的でよい） | GroupChat → 不十分なら Magentic                 |
| 特定のルーティングを LLM に任せたくない     | Graph API でエッジ・条件を固定（決定論的）      |
| プロセス再起動をまたいだ長時間実行が必要    | Workflow + Checkpoint（最初から設計に組み込む） |

## 参考文献

* [Microsoft Agent Framework ワークフロー | Microsoft Learn](https://learn.microsoft.com/ja-jp/agent-framework/workflows/)
* [Functional Workflow API | Microsoft Learn](https://learn.microsoft.com/ja-jp/agent-framework/workflows/functional?pivots=programming-language-python)
* [Workflow Checkpoints | Microsoft Learn](https://learn.microsoft.com/ja-jp/agent-framework/workflows/checkpoints?tabs=py-ckpt-inmemory&pivots=programming-language-python)
* [Magentic Orchestration | Microsoft Learn](https://learn.microsoft.com/ja-jp/agent-framework/workflows/orchestrations/magentic?pivots=programming-language-python)
* [Sequential Orchestration | Microsoft Learn](https://learn.microsoft.com/ja-jp/agent-framework/workflows/orchestrations/sequential?pivots=programming-language-python)
