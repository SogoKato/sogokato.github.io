---
title: "LangChain agentで関数呼び出し"
date: "2024-01-24"
tags: ["ChatGPT", "LangChain", "Python"]
---

個人で使っている LINE bot を賢くしたくて、ChatGPT を組み込んでみました。ChatGPT を自分のアプリに組み込むのは初めてなのですが、[LangChain](https://python.langchain.com/) の機能の豊富さに驚かされました。

## 対象読者

* 人間のあいまいな指示を機械が実行できるアクションに落とし込ませたい人

## 検証環境

* Python 3.11.6
* LangChain 0.1.1
* langchain-openai 0.0.2.post1

## できたもの

```python
from dataclasses import dataclass
from typing import Any

from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
)
from langchain.tools import StructuredTool
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic.v1 import BaseModel, Field

_SYSTEM_PROMPT = """
あなたは食品の管理を行うチャットbotです。以下の操作をすることができます。
- 求められた食品の一覧を表示することができます。
- 食品の数量の更新をすることができます。まず`fetch_items`で候補の一覧を取得してください。その候補に基づいて`mark_as_used`で数量を更新してください。候補が複数ある場合はどの食品に対して操作するのかユーザーに確認してください。

分類は以下のいずれかです。
ごはん
ラーメン
味噌汁
飲料

場所は以下のいずれかです。
戸棚
押入れ

賞味期限はYYYY-MM-DD形式です。
"""


@dataclass
class Item:
    id: str
    category: str
    manufacturer: str
    product: str
    location: str
    expires_on: str
    amount: int

    def export(self) -> dict[str, Any]:
        return {
            "ID": self.id,
            "分類": self.category,
            "メーカー": self.manufacturer,
            "品名": self.product,
            "場所": self.location,
            "賞味期限": self.expires_on,
            "数量": self.amount,
        }


class QueryInput(BaseModel):
    query: list[str] = Field(
        description="検索する単語（例: 食品の分類、メーカー、品名、場所、賞味期限）のリスト。例: ['押入れ', 'ごはん']"
    )


class MarkAsUsedInput(BaseModel):
    id: str = Field(description="食品ID")
    new_amount: int = Field(description="食品の新しい数量。現在の数量が10で、1つ食べた場合、新しい数量は9。")


def get_tools() -> list[StructuredTool]:
    fetch_tool = StructuredTool.from_function(
        func=fetch_items,
        name="fetch_items",
        description="検索する単語（例: 食品の分類、メーカー、品名、場所、賞味期限）のリストを入力すると、その単語を含む食品の詳細なリストが出力されます。",
        return_direct=False,
        args_schema=QueryInput,
    )
    mark_as_used_tool = StructuredTool.from_function(
        func=mark_as_used,
        name="mark_as_used",
        description="ある食品を食べたり、数を減らす時に使います。食品IDと新しい数量を入力すると、その食品の情報を更新します。",
        return_direct=False,
        args_schema=MarkAsUsedInput,
    )
    return [fetch_tool, mark_as_used_tool]


def fetch_items(query: list[str]) -> list[dict[str, Any]]:
    items = _fetch_items(query)
    return [item.export() for item in items]


def mark_as_used(id: str, new_amount: int):
    item = _fetch_items([id])[0]
    item.amount = new_amount
    return item.export()


def _fetch_items(query: list[str]) -> list[Item]:
    """データベースだと思ってください"""
    items = [
        Item(
            id="xxx",
            category="ごはん",
            manufacturer="カトウ食品",
            product="カトウのごはん",
            location="戸棚",
            expires_on="2024-10-10",
            amount=10,
        ),
        Item(
            id="yyy",
            category="ごはん",
            manufacturer="カトウ食品",
            product="カトウのごはん",
            location="押入れ",
            expires_on="2024-11-11",
            amount=20,
        ),
        Item(
            id="zzz",
            category="味噌汁",
            manufacturer="カトウフーズ",
            product="いつもと違うみそ汁",
            location="押入れ",
            expires_on="2024-12-12",
            amount=30,
        ),
    ]

    def matches(item: Item, q: list[str]) -> bool:
        for q_ in q:
            matched = False
            for v in item.export().values():
                if not isinstance(v, str):
                    continue
                if q_ in v:
                    matched = True
                    break
            if not matched:
                return False
        return True

    ret = [item for item in items if matches(item, query)]
    return ret


chat_history: list[BaseMessage] = []

tools = get_tools()
llm = ChatOpenAI(model_name="gpt-3.5-turbo")

prompt = ChatPromptTemplate.from_messages(
    [
        SystemMessage(content=_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        HumanMessagePromptTemplate.from_template(
            input_variables=["input"], template="{input}"
        ),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
```

## テストする

`OPENAI_API_KEY` を環境変数に設定しておいてください。

まずは「味噌汁」のデータを更新してみたいと思います。「味噌汁」はデータベースにひとつだけなので、一発で操作が完了します。

```python
res = agent_executor.invoke({"chat_history": chat_history, "input": "味噌汁を3つ減らして"})
print(res)
```

```
> Entering new AgentExecutor chain...

Invoking: `fetch_items` with `{'query': ['味噌汁']}`


[{'ID': 'zzz', '分類': '味噌汁', 'メーカー': 'カトウフーズ', '品名': 'いつもと違うみそ汁', '場所': '押入れ', '賞味期限': '2024-12-12', '数量': 30}]
Invoking: `mark_as_used` with `{'id': 'zzz', 'new_amount': 27}`


{'ID': 'zzz', '分類': '味噌汁', 'メーカー': 'カトウフーズ', '品名': 'いつもと違うみそ汁', '場所': '押入れ', '賞味期限': '2024-12-12', '数量': 27}味噌汁の数量を3つ減らしました。現在の数量は27です。

> Finished chain.
{'chat_history': [], 'input': '味噌汁を3つ減らして', 'output': '味噌汁の数量を3つ減らしました。現在の数量は27です。'}
```

次に「ごはん」のデータを更新してみます。「ごはん」は2つのデータがあるので、どちらを更新するか聞き返してくれます。ここでは `input()` に「1番」と入力しています。

```python
res = agent_executor.invoke({"chat_history": chat_history, "input": "ご飯を3つ減らして"})
print(res)
chat_history.extend(
    [HumanMessage(content=res["input"]), AIMessage(content=res["output"])]
)

res = agent_executor.invoke({"chat_history": chat_history, "input": input()})
print(res)
```

```
> Entering new AgentExecutor chain...

Invoking: `fetch_items` with `{'query': ['ごはん']}`


[{'ID': 'xxx', '分類': 'ごはん', 'メーカー': 'カトウ食品', '品名': 'カトウのごはん', '場所': '戸棚', '賞味期限': '2024-10-10', '数量': 10}, {'ID': 'yyy', '分類': 'ごはん', 'メーカー': 'カトウ食品', '品名': 'カトウのごはん', '場所': '押入れ', '賞味期限': '2024-11-11', '数量': 20}]以下の候補が見つかりました。どの食品に対して操作しますか？

1. ID: xxx, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 戸棚, 賞味期限: 2024-10-10, 数量: 10
2. ID: yyy, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 押入れ, 賞味期限: 2024-11-11, 数量: 20

どの食品に対して操作しますか？（番号を入力してください）

> Finished chain.
{'chat_history': [], 'input': 'ご飯を3つ減らして', 'output': '以下の候補が見つかりました。どの食品に対して操作しますか？\n\n1. ID: xxx, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 戸棚, 賞味期限: 2024-10-10, 数量: 10\n2. ID: yyy, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 押入れ, 賞味期限: 2024-11-11, 数量: 20\n\nどの食品に対して操作しますか？（番号を入力してください）'}
1 番


> Entering new AgentExecutor chain...

Invoking: `mark_as_used` with `{'id': 'xxx', 'new_amount': 7}`


{'ID': 'xxx', '分類': 'ごはん', 'メーカー': 'カトウ食品', '品名': 'カトウのごはん', '場所': '戸棚', '賞味期限': '2024-10-10', '数量': 7}食品の数量を更新しました。以下が更新後の情報です。

- ID: xxx
- 分類: ごはん
- メーカー: カトウ食品
- 品名: カトウのごはん
- 場所: 戸棚
- 賞味期限: 2024-10-10
- 数量: 7

> Finished chain.
{'chat_history': [HumanMessage(content='ご飯を3つ減らして'), AIMessage(content='以下の候補が見つかりました。どの食品に対して操作しますか？\n\n1. ID: xxx, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 戸棚, 賞味期限: 2024-10-10, 数量: 10\n2. ID: yyy, 分類: ごはん, メーカー: カトウ食品, 品名: カトウのごはん, 場所: 押入れ, 賞味期限: 2024-11-11, 数量: 20\n\nどの食品に対して操作しますか？（番号を入力してください）')], 'input': '1番', 'output': '食品の数量を更新しました。以下が更新後の情報です。\n\n- ID: xxx\n- 分類: ごはん\n- メーカー: カトウ食品\n- 品名: カトウのごはん\n- 場所: 戸棚\n- 賞味期限: 2024-10-10\n- 数量: 7'}
```

## ちょっと解説

LangChain の agent は言語モデルを使って取るべきアクションを決定するためのものです。Tools はすなわち関数です。簡単に言うと、agent を呼び出すことで ChatGPT を使って取るべきアクションを決め、適切な関数を呼び出させることができるようになります。

### 関数の定義

ChatGPT に関数を定義させるには、以下を記述します。
* 関数の説明
* 関数の引数の型と説明

```python
class QueryInput(BaseModel):
    query: list[str] = Field(
        description="検索する単語（例: 食品の分類、メーカー、品名、場所、賞味期限）のリスト。例: ['押入れ', 'ごはん']"
    )

def fetch_items(query: list[str]) -> list[dict[str, Any]]:
    items = _fetch_items(query)
    return [item.export() for item in items]
```

自作の関数を tool として定義します。

```python
fetch_tool = StructuredTool.from_function(
    func=fetch_items,
    name="fetch_items",
    description="検索する単語（例: 食品の分類、メーカー、品名、場所、賞味期限）のリストを入力すると、その単語を含む食品の詳細なリストが出力されます。",
    return_direct=False,
    args_schema=QueryInput,
)
```

### システムプロンプトの工夫

上記のように関数周りの説明を書いても、AI にその使い方を教えないといい感じには動いてくれません。

#### 使い方のレクチャー

よくある感じで AI 自身の役割なのかを教えます。

```
あなたは食品の管理を行うチャットbotです。以下の操作をすることができます。
- 求められた食品の一覧を表示することができます。
- 食品の数量の更新をすることができます。まず`fetch_items`で候補の一覧を取得してください。その候補に基づいて`mark_as_used`で数量を更新してください。候補が複数ある場合はどの食品に対して操作するのかユーザーに確認してください。
```

特に、

> まず`fetch_items`で候補の一覧を取得してください。その候補に基づいて`mark_as_used`で数量を更新してください。

と書かないと、いきなり更新のための `mark_as_used` を呼び出してしまい、当然それでは「食品ID」や減らす前の「数量」がわからないのでデタラメに入力されてしまいました。

#### 入力値のバリデーション

上のテストでは「ご飯を〜」と漢字で指示しましたが、関数への入力値は「ごはん」とひらがなになっていました。

> agent_executor.invoke({..., "input": "ご飯を3つ減らして"})

> Invoking: `fetch_items` with `{'query': ['ごはん']}`

これは以下の「分類」の定義によるもののはずです。今回のアプリでは「分類」や「場所」は定数的な値なのでプロンプトに含めました。  
「品名」などは種類が多いので全部入れるとトークンを浪費してしまうので、そのような値をどうバリデーションしていくかは今後の課題です。

```
分類は以下のいずれかです。
ごはん
ラーメン
味噌汁
飲料

場所は以下のいずれかです。
戸棚
押入れ

賞味期限はYYYY-MM-DD形式です。
```

### チャット履歴の保存

ChatGPT はステートレスなので、毎回のリクエストに文脈を書く必要があります。[Langchain ドキュメント](https://python.langchain.com/docs/use_cases/question_answering/chat_history)を参考に、過去の会話をプロンプトに埋め込みましょう。

## 最後に

これまで IBM Watson でチャットボットを作ったりしてきましたが、あいまいな指示を機械が実行できるアクションに落とし込むというのが結局うまくできていなかったので、ChatGPT は魔法のようですね。「こういう時にこうする」というロジックのコードを書いていないので「プログラミングとは何だろうか？」と再考させられます。

## 参考文献

* [OpenAI functions | 🦜️🔗 Langchain](https://python.langchain.com/docs/modules/agents/agent_types/openai_functions_agent)
* [Quick Start | 🦜️🔗 Langchain](https://python.langchain.com/docs/modules/model_io/prompts/quick_start)
* [Add chat history | 🦜️🔗 Langchain](https://python.langchain.com/docs/use_cases/question_answering/chat_history)
