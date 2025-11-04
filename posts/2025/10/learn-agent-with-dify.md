---
title: "Difyでミニマルに学ぶLLM/RAG/Agentの違い"
date: "2025-11-04"
tags: ["Dify"]
---

毎日 AI Agent についての話題は絶えないですが、一方で「Agent って何？」みたいな人もいるかと思います。
今回はノーコード AI アプリ開発ツールである Dify を使って、LLM、RAG、Agent の違いをミニマルな形で手を動かして学んでみようと思います。とある機会でデモとして用意した内容なので、サクサクと手を動かしていければ準備を含めても30分くらいでいける内容だと思います。

## 前提条件

* [Dify SaaS 版](https://cloud.dify.ai/) に登録済み
* [Google AI Studio](https://aistudio.google.com/) の API キーを持っている
  * 無料、クレジットカード不要で使えます
* [OpenWeather API](https://openweathermap.org/api) のサブスクリプションを持っている
  * 無料枠内で使えますがクレジットカードの登録は必要です

## DSL ファイル

DSL ファイルも配布しますので、時間がない方はご利用ください。

[AgentDemo.yml](/assets/posts/2025/11/dify/AgentDemo.yml)

## 準備

前提条件にあるものを払い出した上で、Dify で以下のプラグインをインストールし、設定します。

* [Dify Agent Strategies](https://marketplace.dify.ai/plugins/langgenius/agent)
  * インストールするだけで OK
* [Gemini](marketplace.dify.ai/plugins/langgenius/gemini)
  * Google AI Studio の API キーを設定
* [Open weather query](https://marketplace.dify.ai/plugins/langgenius/openweather)
  * OpenWeather API の API キーを設定

## 新しいアプリを作成

まずは「スタジオ」タブで「最初から作成」をクリックし、「チャットフロー」を選んで新しいアプリを作ります。名前は適当に決めちゃってください。

![screenshot](/images/posts/2025/11/dify_01.png)

最初はシンプルに `開始` ノードと `LLM` ノードだけがあります。

![screenshot](/images/posts/2025/11/dify_02.png)

## LLM に時間を聞いてみよう

モデルを Gemini 2.5 Flash にして、最初のまっさらな状態で LLM に時間を聞いてみましょう。

![screenshot](/images/posts/2025/11/dify_03.png)

「2024年7月29日」と実際の日付とは違う回答が返ってきました。
LLM には [ナレッジカットオフ](https://en.wikipedia.org/wiki/Knowledge_cutoff) という概念があり、ナレッジカットオフ日以降の知識は学習されていません。そのため LLM に「今日の日付」という最新情報を求めても、モデルはリアルタイムの情報を知りません。

## RAG っぽくしてみよう

LLM を使いつつ未学習の知識を扱うための手法として、よく使われる手法が [RAG (Retrieval-augmented generation)](https://en.wikipedia.org/wiki/Retrieval-augmented_generation) です。

RAG とは簡単に言えば、情報を別の場所から取得してきて、そのテキストをプロンプトの中に混ぜ込んで LLM に回答させる手法です。ほとんどのケースでエンベディングやベクターデータベースという言葉が登場します。RAG ではいかに質の高い情報を持ってこられるかで LLM の回答の精度が大きく変わります。当然ゴミみたいな検索結果を LLM に渡してもゴミみたいな回答しか作れないです。RAG の精度を向上させる方法は世の中に色々出回っているので興味があれば調べてみてください。

RAG においてどう検索するかは重要な要素ではありますが、あくまで方法論の話です。本質的には「取得して、それを基に回答」っていうところなので、今回はこれをやってみましょう。

プラスボタンをクリックし、ツールタブから、CurrentTime > Current Time をクリックすると `CURRENT TIME` ノードが追加されます。

![screenshot](/images/posts/2025/11/dify_04.png)

これを `開始` ノードと `LLM` ノードの間に置き、線で繋ぎましょう。`Timezone` は `Azia/Tokyo` にしておきます。

![screenshot](/images/posts/2025/11/dify_05.png)

次に `LLM` ノードの SYSTEM メッセージに `今日は { Current Time / text } です。` と入れます。変数の部分は `CURRENT TIME` ノードの出力です。

もう一度さっきと同じ質問をすると、今度は正しい回答が返ってきます。

![screenshot](/images/posts/2025/11/dify_06.png)

## Agent にしてみよう

よくいう AI Agent の説明は「タスクを自律的に遂行する」ということです。この「自律的に」という動きを支えている重要な技術が「関数呼び出し（Function calling）」です。簡単に言えば LLM が必要に応じて、関数（プログラム）を実行できるということです。Agent の文脈では呼び出す関数などのことを「ツール」と総称したりします。

プラスボタンをクリックし、ブロックタブからエージェントをクリックすると `エージェント` ノードが追加されます。

![screenshot](/images/posts/2025/11/dify_07.png)

`エージェンティック戦略` には `FunctionCalling` を、 `MODEL` には `Gemini 2.5 Flash` を選択します。`TOOL LIST` にはさっきと同じ `Current Time` ツールを追加します。`INSTRUCTION` には `ユーザの要求を達成するようツールを使ってください。` と入れておきます。`QUERY` には `{ 開始 / sys.query }` を入れます。

![screenshot](/images/posts/2025/11/dify_08.png)

また、最後の `回答` ノードの `応答` には `{ エージェント / text }` を入れます。

これで Agent がツールを自律的に呼び出してタスクを遂行できるようになったので、これまで同様の質問をしてみます。

![screenshot](/images/posts/2025/11/dify_09.png)

エージェントの出力の JSON を確認すると、ちゃんとツールを呼べていることもわかります。

```json
{
  "text": "\n今日は2025年10月31日です。",
  "usage": {...},
  "files": [],
  "json": [
    {
      "data": {
        "output": {
          "llm_response": "",
          "tool_responses": [
            {
              "tool_call_id": "gemini_call_current_time_1761837330164072080",
              "tool_call_input": {
                "format": "%Y-%m-%d %H:%M:%S",
                "timezone": "Asia/Tokyo"
              },
              "tool_call_name": "current_time",
              "tool_response": "2025-10-31 00:15:30"
            }
          ]
        }
      },
      "error": null,
      "id": "1ef71196-ae62-41d5-ab95-33292e400a30",
      "label": "ROUND 1",
      "metadata": {...},
      "node_id": "1761833927526",
      "parent_id": null,
      "status": "success"
    },
    {
      "data": {
        "output": "",
        "tool_input": [
          {
            "args": {},
            "name": "current_time"
          }
        ],
        "tool_name": "current_time"
      },
      "error": null,
      "id": "c23837b4-4330-421c-b771-c50c196dc68f",
      "label": "gemini-2.5-flash Thought",
      "metadata": {...},
      "node_id": "1761833927526",
      "parent_id": "1ef71196-ae62-41d5-ab95-33292e400a30",
      "status": "success"
    },
    {
      "data": {
        "output": {
          "tool_call_id": "gemini_call_current_time_1761837330164072080",
          "tool_call_input": {
            "format": "%Y-%m-%d %H:%M:%S",
            "timezone": "Asia/Tokyo"
          },
          "tool_call_name": "current_time",
          "tool_response": "2025-10-31 00:15:30"
        }
      },
      "error": null,
      "id": "83db34ba-914c-472d-9430-4f5ac06f838c",
      "label": "CALL current_time",
      "metadata": {...},
      "node_id": "1761833927526",
      "parent_id": "1ef71196-ae62-41d5-ab95-33292e400a30",
      "status": "success"
    },
    {
      "data": {
        "output": {
          "llm_response": "今日は2025年10月31日です。",
          "tool_responses": []
        }
      },
      "error": null,
      "id": "09bf40c3-b911-4c6b-b31d-6920b6d6b67f",
      "label": "ROUND 2",
      "metadata": {...},
      "node_id": "1761833927526",
      "parent_id": null,
      "status": "success"
    },
    {
      "data": {
        "output": "今日は2025年10月31日です。",
        "tool_input": [],
        "tool_name": ""
      },
      "error": null,
      "id": "bc2b108f-3095-476c-b941-972f9eccfdab",
      "label": "gemini-2.5-flash Thought",
      "metadata": {...},
      "node_id": "1761833927526",
      "parent_id": "09bf40c3-b911-4c6b-b31d-6920b6d6b67f",
      "status": "success"
    },
    {
      "data": []
    }
  ]
}
```

## Multi-agent にしてみよう

ここまでで Single agent の仕組みがわかったので、今度は複数の agent を動かしてみましょう。
今回はループ内に天気を調べる agent とフィードバックを行う agent を配置し、ユーザの要求を満たすまでループするように作ってみました。

![screenshot](/images/posts/2025/11/dify_10.png)

Dify には会話変数という機能があるので、`context` という名前の `array[string]` の変数に agent の出力を追加していきます。

![screenshot](/images/posts/2025/11/dify_11.png)

ループの中に `Agent` ノードを配置します。`TOOL LIST` には `Open Weather Query` を追加します。`INSTRUCTION` には `ツールを使って天気を取得してください。` と入れます。`QUERY` は下記のようにユーザの質問と `context` 変数を渡します。

```
ユーザの質問: { 開始 / sys.query }

コンテキスト: { context }
```

![screenshot](/images/posts/2025/11/dify_12.png)

`Agent` ノードの次には `変数代入` ノードを配置し、`context` 変数に `{ 天気Agent / text }` を `追加` します。

![screenshot](/images/posts/2025/11/dify_13.png)

その次には `LLM` ノードを置き、天気 Agent の回答をレビューさせます。このノードには天気 Agent が知らない情報を入れ知恵しておきます。

```
コンテキストには agent 同士の会話が含まれています。ユーザの質問を回答するための材料が揃っているかを確認してください。

夢の国は千葉県浦安市にあります。他のエージェントはそれがどこにあるかを知らないかもなのでフィードバックしてあげてください。
```

![screenshot](/images/posts/2025/11/dify_14.png)

`LLM` ノードの出力変数に構造化出力を使用します。

* `satisfied`
  * `string`
  * `ユーザが求めている情報が満たされている。満たされていればyes。満たされていない場合は必ず空文字にすること。`
* `feedback`
  * `string`
  * `フィードバック`

![screenshot](/images/posts/2025/11/dify_15.png)

`LLM` ノードの次の `変数代入` ノードでは、`context` 変数に `{ LLM2 / structured_output / feedback }` を `追加` します。

![screenshot](/images/posts/2025/11/dify_16.png)

`ループ終了条件` は `{ LLM2 / structured_output.satisfied }` が `空でない` にします。

![screenshot](/images/posts/2025/11/dify_17.png)

ループを抜けた後の `LLM` ノードはユーザの質問と agent 同士のやり取りを渡して、最終的な回答を作成させます。

![screenshot](/images/posts/2025/11/dify_18.png)

それでは実際に「東京、福岡、夢の国の天気を教えて」と質問を投げてみます。

![screenshot](/images/posts/2025/11/dify_19.png)

実行追跡を見てみると、1回目の天気 Agent は `東京は曇りで気温は13.1℃です。福岡は快晴で気温は12.95℃です。「夢の国」の天気については、実在する地名ではないため、お調べすることができませんでした。` という結果になっています。`LLM2` の `feedback` は `夢の国は千葉県浦安市にあります。` と返されていて、`satisfied` は空文字でした。

![screenshot](/images/posts/2025/11/dify_20.png)

2回目のループではそのフィードバックを受けてきちんと `Urayasu` で天気をクエリできています。

![screenshot](/images/posts/2025/11/dify_21.png)

## おわりに

拙いデモでしたが、どなたかのお役に立てば幸いです。
