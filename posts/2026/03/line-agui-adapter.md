---
title: "LINE Messaging APIでAG-UIを使えるアダプタを作った"
date: "2026-03-20"
tags: ["Python", "AG-UI", "LINE"]
---

LINE Bot を作るとき、単純なテキスト往復だけならまだしも、画像や音声も扱いたい、既存の Agent 基盤をそのまま使いたい、将来は Web UI にも広げたい……となると意外と面倒です。

最近は多くのメジャーな Agent フレームワークが [AG-UI](https://docs.ag-ui.com/introduction) を話せるようになっています。  
今回作った [SogoKato/line-agui-adapter](https://github.com/SogoKato/line-agui-adapter) は **LINE Messaging API と AG-UI の橋渡しをする Python ライブラリ** です。LINE から受け取ったメッセージイベントを AG-UI リクエストに変換し、AG-UI サーバの最終応答を LINE の返信メッセージに戻してくれます。

```youtube
SygA3jxyOvg
```

## AG-UI とは

AG-UI は Agent–User Interaction Protocol の略で、**AI Agent とユーザ接点のあいだをつなぐためのプロトコル** です。

MCP が「Agent からツールを呼ぶための取り決め」、A2A が「Agent 同士が対話するための取り決め」だとすると、AG-UI は「Agent がユーザ向け UI とどうやりとりするか」の取り決めです。

たとえば次のような情報を扱いやすくなります。

* テキストのストリーミング出力
* 画像・音声・動画・ファイルのようなマルチモーダル入出力
* ツール実行やアクティビティの表現
* UI 側での操作を挟む Human-in-the-loop 的なやりとり

AG-UI というと Web のチャット UI である [CopilotKit](https://www.copilotkit.ai/) が思い浮かびますが、ユーザと Agent の間を繋ぐという意味では、LINE のようなメッセージングアプリでも一緒です。Agent 側で AG-UI を話せるようになっている一方で、クライアント側はまだあまり実装例が少なそうなのですが、AG-UI の普及のためにはクライアント側のエコシステムが充実することも大切だと思います。

関連記事: [CopilotKitで爆速チャットUI構築](/posts/2026/01/copilotkit)

## なぜ LINE 用の AG-UI アダプタが欲しかったのか

AG-UI 対応の Agent をすでに持っていると、Web フロントエンドからつなぐのは比較的やりやすいです。一方で LINE Bot に載せようとすると、だいたい次のような実装が必要になります。

* LINE webhook の署名検証
* 受信したテキスト・画像・音声・動画・ファイルの解釈
* LINE 独自のメッセージ形式から AG-UI への変換
* AG-UI 応答から LINE reply message への再変換
* ストリーミング前提の応答を、LINE の非ストリーミングな返信フローに合わせる調整

この変換処理は毎回似たようなコードになりがちです。だったらライブラリにしてしまおう、というのが今回の動機です。

## LINE AG-UI Adapter でできること

### 1. LINE メッセージと AG-UI 入出力の相互変換

テキストはもちろん、次のメッセージも AG-UI の入力パーツとして扱えます。

* 画像
* 音声
* 動画
* ファイル

AG-UI 側から返ってきた応答は、次のように LINE メッセージへ変換されます。

* テキスト → テキストメッセージ
* 画像 / 音声 / 動画 → URL ベースのソースを持つ場合に LINE のメディアメッセージ
* ドキュメント → ドキュメント URL を含むテキストメッセージ

AG-UI はストリーミングの世界観を持っていますが、LINE の reply は基本的に「最終的なメッセージを返す」形です。このアダプタは、AG-UI のイベント列をバッファして最終応答に畳み込んでから LINE に返すようになってます。

### 2. middleware hook で前後処理を差し込める

AG-UI に送る前、AG-UI から返ってきた後の両方で hook を差し込めます。

たとえば以下のような用途を想定しています。

* 任意の属性を `forwarded_props` に付与する
* Agent の応答文面を最終調整する
* 監査ログやメトリクス収集を入れる

```python
async def before_hook(request):
    request.forwarded_props["tenant_id"] = "tenant-a"
    return request


def after_hook(response):
    for message in response.assistant_messages:
        if isinstance(message.content, str) and message.content:
            message.content = f"[AG-UI] {message.content}"
    return response


adapter.pipeline.add_before(before_hook)
adapter.pipeline.add_after(after_hook)
```

## インストール

```bash
uv add line-agui-adapter
```

または

```bash
pip install line-agui-adapter
```

FastAPI のサンプルも動かすなら追加で以下も入れます。

```bash
uv add fastapi uvicorn python-dotenv
```

## 試してみよう

前提条件

* LINE チャネルが設定済みであること
* webhook サーバが HTTPS で公開され、LINE から到達できること
* AG-UI サーバが別途起動していること
  * まだ AG-UI サーバを用意していない場合は、リポジトリ内のテスト用サーバを使って試せるようにもしています
* 必要な環境変数が設定されていること
  * `LINE_CHANNEL_SECRET`
  * `LINE_CHANNEL_ACCESS_TOKEN`
  * `AGUI_ENDPOINT`

README に載せているサンプルはこんな感じです。

```python
import os
from typing import cast

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from linebot.v3 import WebhookParser, WebhookPayload
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    Configuration,
    MessagingApi,
    MessagingApiBlob,
    ReplyMessageRequest,
    ShowLoadingAnimationRequest,
)
from linebot.v3.webhooks import MessageEvent

from line_agui_adapter import AguiHttpClient, LineAguiAdapter, create_content_fetcher

load_dotenv()

app = FastAPI()
parser = WebhookParser(channel_secret=os.environ["LINE_CHANNEL_SECRET"])
configuration = Configuration(access_token=os.environ["LINE_CHANNEL_ACCESS_TOKEN"])
agui_client = AguiHttpClient(
    endpoint=os.environ["AGUI_ENDPOINT"],
    headers=(
        {"Authorization": f"Bearer {os.environ['AGUI_AUTH_TOKEN']}"}
        if os.environ.get("AGUI_AUTH_TOKEN")
        else {}
    ),
)


async def before_agui(request):
    request.forwarded_props["tenant_id"] = "example-tenant"
    request.forwarded_props["source"] = "line-fastapi-example"
    return request


def after_agui(response):
    for message in response.assistant_messages:
        if isinstance(message.content, str) and message.content:
            message.content = f"[AG-UI] {message.content}"
    return response


@app.post("/callback")
async def callback(
    request: Request, x_line_signature: str = Header(...)
) -> dict[str, bool]:
    body = (await request.body()).decode("utf-8")

    try:
        payload = cast(
            WebhookPayload, parser.parse(body, x_line_signature, as_payload=True)
        )
    except InvalidSignatureError as exc:
        raise HTTPException(status_code=400, detail="invalid signature") from exc

    with ApiClient(configuration) as api_client:
        line_api = MessagingApi(api_client)
        blob_api = MessagingApiBlob(api_client)
        adapter = LineAguiAdapter(
            agui_client=agui_client,
            content_fetcher=create_content_fetcher(blob_api),
        )
        adapter.pipeline.add_before(before_agui)
        adapter.pipeline.add_after(after_agui)

        for event in payload.events or []:
            if not isinstance(event, MessageEvent):
                continue
            if event.mode == "standby" or not event.reply_token:
                continue

            user_id = getattr(event.source, "user_id", None)
            if user_id:
                line_api.show_loading_animation(
                    ShowLoadingAnimationRequest(
                        chatId=user_id,
                        loadingSeconds=60,
                    )
                )

            messages = await adapter.handle_event(event)
            line_api.reply_message(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=messages,
                    notificationDisabled=False,
                )
            )

    return {"ok": True}
```

## おわりに

興味があれば README やソースコードを見てみてください。まだあらあらなので、バグがあれば Pull request をお待ちしております。

* [SogoKato/line-agui-adapter: AG-UI Client adapter for LINE Messaging API (@line/line-bot-sdk-python)](https://github.com/SogoKato/line-agui-adapter)
* [ag-ui-protocol/ag-ui: AG-UI: the Agent-User Interaction Protocol. Bring Agents into Frontend Applications.](https://github.com/ag-ui-protocol/ag-ui)
* [line/line-bot-sdk-python: LINE Messaging API SDK for Python](https://github.com/line/line-bot-sdk-python)
* [AG-UI Overview - Agent User Interaction Protocol](https://docs.ag-ui.com/introduction)
* [Messaging API | LINE Developers](https://developers.line.biz/ja/docs/messaging-api/)
