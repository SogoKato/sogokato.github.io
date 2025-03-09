---
title: "Azure OpenAI Assistants APIとAI Agent Serviceを比較"
date: "2025-03-09"
tags: ["Azure", "OpenAI", "LLM"]
---

[Azure OpenAI Assistants API](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/concepts/assistants) と [Azure AI Agent Service](https://learn.microsoft.com/ja-jp/azure/ai-services/agents/overview) を比較してみました。2025年3月時点での情報であり、両サービスともプレビュー版のため仕様が変更になることがあります。

## 機能の比較

### 共通していること

* ステートフルな API を提供するので API 利用者はメッセージ履歴の保存をする必要がない
* [Code interpreter](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/how-to/code-interpreter) が使える
  * AI がコードを生成して API 側のサンドボックス環境で実行してくれる機能
* Azure AI Foundry で Playground が用意されている

Assistants API Playground

![スクリーンショット](/images/posts/2025/03/azure_ai_1.png)

AI Agent Service Playground

![スクリーンショット](/images/posts/2025/03/azure_ai_2.png)

### Assistants API じゃないとできないこと

* 特にない

### AI Agent Service じゃないとできないこと

* OpenAI 以外のモデルが利用可能
* Bing 検索や Azure AI Search を統合するためのツールが用意されている
  * 自分で関数呼び出し (function calling) を実装する必要がない
* エンタープライズレベルのセキュリティ
  * BYO ストレージ
  * BYO VNet

## 機能別の比較

### 用意されているツール

* Assistants API
  * ファイル検索
  * 関数呼び出し
  * Code interpreter
* AI Agent Service
  * ファイル検索
  * Bing 検索
  * Azure AI Search
  * 関数呼び出し
  * Code interpreter
  * OpenAPI で定義された外部 API の呼び出し
  * Azure Functions

現時点で AI Agent Service で利用するデータソースとして、ファイル検索や Azure AI Search はそれぞれ1つずつしか追加できないようでした。[^1]

> 現在、各データ ソースの種類ごとに 1 つのインスタンスのみがサポートされています。

![スクリーンショット](/images/posts/2025/03/azure_ai_3.png)

[^1]: スクリーンショットで「Bing 検索を使用したグラウンディング」に「互換性がありません」と言われているのは gpt-4o-mini をデプロイしたからです。  
[Azure AI Agent Service の Bing 検索を使用してグラウンディングを使用する方法 - Azure OpenAI | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/ai-services/agents/how-to/tools/bing-grounding)

### 利用する SDK (Python 用)

* Assistants API
  * OpenAI SDK
* AI Agent Service
  * OpenAI SDK
  * Azure SDK

OpenAI SDK を使用する場合は Assistants API と AI Agent Service で同じライブラリを使うことになるので、既に Assistants API を利用している場合は移行が楽そうです。AI Foundry の Playground 画面は AI Agent Service であっても Azure OpenAI Service 配下の「アシスタント」画面に表示されます。

ただし `AzureOpenAI` クライアントのインスタンス化の方法（認証方式）が異なっていそうです。

Assistants API (クイックスタートより抜粋)

```py
from openai import AzureOpenAI

client = AzureOpenAI(...)
assistant = client.beta.assistants.create(
    name="Math Assist",
    instructions="You are an AI assistant that can write code to help answer math questions.",
    tools=[{"type": "code_interpreter"}],
    model="gpt-4-1106-preview"
)
```

AI Agent Service (クイックスタートより抜粋)

```py
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

with AIProjectClient.from_connection_string(
    credential=DefaultAzureCredential(),
    conn_str=os.environ["PROJECT_CONNECTION_STRING"],
) as project_client:
    client: AzureOpenAI = project_client.inference.get_azure_openai_client(...)
    with client:
        agent = client.beta.assistants.create(
            model="gpt-4o-mini", name="my-agent", instructions="You are a helpful agent"
        )
```

AI Agent Service では OpenAI SDK のほかに Azure SDK も使用可能です。これを使ってエージェントを作成すると AI Foundry の Playground は AI プロジェクトの「エージェント」画面に表示されます。

`AIProjectClient.from_connection_string()` の credential に渡す機密情報は `DefaultAzureCredential` (`az login` でログインする場合) や `ClientSecretCredential` (Entra ID でエンタープライズアプリケーションを作成して認証させる場合) が使えました。

OpenAI 以外のモデルを使用する場合は必然的にこっちを利用するしかないですし、新規プロジェクトの場合は特にこだわりがなければ Azure SDK を利用した方が良さそうです。

## 感想

Azure AI Agent Service はビルトインで使えるツールが多かったり、エンタープライズで要求されるセキュリティ機能が備わっていたりと将来的に有望な選択肢だと思いました。一方で、現在はプレビュー版ということもあり、ビルトインのツールを使おうとしても自分たちの要件と合わないケースや同じ種類の複数のデータソースインスタンスが作れないといった制約に引っかかるケースなど、AI Agent Service を使ううまみを享受できるユースケースはそんなにないのかもしれないとも感じました。

「とりあえず AI Agent Service を使っておく」という選択もありですし、「いったん Assistants API で作っておいて様子見て移行する」っていう選択もありだと思いました。

## 参考文献

* [Azure OpenAI Service Assistants API の概念 - Azure OpenAI Service | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/concepts/assistants)
* [クイック スタート: Azure OpenAI Assistants (プレビュー) の使用を開始する - Azure OpenAI | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/assistants-quickstart)
* [Azure AI エージェント サービスとは - Azure AI services | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/ai-services/agents/overview)
* [クイック スタート - 新しい Azure AI Agents Service プロジェクトを作成する - Azure AI services | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/ai-services/agents/quickstart)
* [Azure AI Agent Service におけるエンタープライズ対応の標準装備｜daka | Microsoft | AI](https://note.com/daka1/n/nf99612b2fafa)
