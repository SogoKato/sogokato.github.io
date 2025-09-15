---
title: "Difyで会話しながらRAGナレッジを追加する"
date: "2025-09-15"
tags: ["Dify"]
---

Dify で会話しながら、AI が資料を探してくれて RAG ナレッジベースへの資料の追加までやってくれたら便利かもと思ったのでやってみました。

## 環境

* Dify クラウド版（無料プラン）

## できたもの

```youtube
MqhuiDMH3dM
```

動画では、途中エージェント部分の処理は長いので4倍速にしています。

DSL ファイルはこちらです。

[GoogleSearch.yml](/assets/posts/2025/09/dify/GoogleSearch.yml)

動かすために必要なのは以下です。

* Gemini API キー（今回は Google AI Studio を利用）
* Serp API キー（月250回まで無料）
* Dify API キー

## ちょっと解説

![activity](//www.plantuml.com/plantuml/png/SoWkIImgAStDuG8pkBYiNaxhVhgysnh8yl7nLT1mJytDpClKZCbxjcJEyosB7ZUjVzoqud7pgYTxvpphc01IvfwVdvwJ6foQM9ISeH2Idvy34WGhslEuQSVZfkMFcpS_Rkw8oTC8JqrI24ukIYn8BG8hr550DxrnzUFcIO-Rcu7g7pTEVzmu_t7pB9WvavxsJtkwRpgconutxdlSkE9nKoF4uiqW3SsTJzVDVx6m9oRF9JEjyd5pr-FcDK1pGGOrpmIRk1DesOlzUvzsBG1fUpfxtlErKu2iufBy0Yw7rBmKO9W00000)

だいたい見ての通りですが、まずユーザの質問を Google 検索用のクエリに変換します。[Serp API](https://serpapi.com/) を使用して Google 検索したら、検索結果の URL からページを取得し、それを LLM がまとめます。最後にまとめの文章を [Dify の API](https://docs.dify.ai/ja-jp/guides/knowledge-base/knowledge-and-documents-maintenance/maintain-dataset-via-api) でナレッジベースに追加する、といった流れになってます。

## プロンプト・コード

`検索クエリ作成` のプロンプト

```
ユーザの質問をGoogle検索クエリに変換し、検索クエリだけを出力せよ。
```

`エージェント` のプロンプト

```
Google検索結果を解析し、検索結果に含まれる URL を Web Scraper tool で開き、情報を収集せよ。ユーザへの追加確認は不要。
```

```
検索クエリ: {検索クエリ作成/text}

検索結果:
{GoogleSearch/json}
```

`まとめ` のプロンプト

```
検索クエリに関して Google 検索を行い、情報を収集したのでこれを分かりやすいレポートにまとめよ。出力はレポート本文のみとする。
```

```
検索クエリ: {検索クエリ作成/text}

収集結果:
{エージェント/text}
```

`コード実行` のコード

```py
import os
import requests

def main(doc_name: str, text: str, api_key: str, dataset_id: str) -> dict:
    url = f"https://api.dify.ai/v1/datasets/{dataset_id}/document/create-by-text"

    res = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
        },
        json={
            "name": doc_name,
            "text": text,
            "indexing_technique": "economy",
            "process_rule": {
                "mode": "automatic",
            },
        },
    )

    return {
        "result": res.text,
    }
```

## 今後のアイデア

応用していけば色々可能性ありそうです。

* ループでぐるぐる回して Deep Research 的なものを再現する
* LLM がまとめた文章ではなく取得したページをそのままナレッジベースに保存する
* 既存ナレッジベースを最初に調べて足りてなさそうな情報を探索して追加する
* Enterprise のみみたいですが、NotebookLM と連携させる

とかとか。ではまた。

## 参考文献

* [APIを活用したナレッジベースのメンテナンス - Dify Docs](https://docs.dify.ai/ja-jp/guides/knowledge-base/knowledge-and-documents-maintenance/maintain-dataset-via-api)
