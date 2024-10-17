---
title: "ファイル保存なしでWhisper APIにLINE Messaging APIから音声を渡す"
date: "2024-10-17"
tags: ["Python", "Whisper", "LINE"]
---

LINE Messaging API でユーザーから送られてきた音声を OpenAI の Whisper API に渡す方法はググるとたくさん出てきますが、私が見た範囲ではどれもサーバー内に一時ファイルを保存しているものだったので、ファイル保存なしでメモリ上でなんとかする方法を探してみました。

## 想定読者

* LINE Messaging API の使い方を知っている人
  * LINE ボットの作り方の解説は省きます
* 一時ファイルの保存はしたくないというこだわりがある人

## 環境

* Python 3.11.10
* line-bot-sdk 3.11.0
* openai 1.35.15

## 解説

### LINE Messaging API から音声を取得

```python
from linebot import LineBotApi, WebhookHandler

line_bot_api = LineBotApi(...)
handler = WebhookHandler(...)

@handler.add(MessageEvent, message=AudioMessage)
def message_audio(event):
    if event.message.content_provider.type != "line":
        return
    # 音声データの取得
    content = line_bot_api.get_message_content(event.message.id)
    transcription = transcribe(content.content)
    ...
```

`content.content` が `bytes` の実データ、`content.content_type` が content type です。

API リファレンス
* https://developers.line.biz/ja/reference/messaging-api/#message-event
* https://developers.line.biz/ja/reference/messaging-api/#get-content

SDK
* https://github.com/line/line-bot-sdk-python/blob/3.11.0/linebot/models/responses.py#L180-L221

### OpenAI の Whisper API で文字起こし

```python
from io import BytesIO
from openai import OpenAI

def transcribe(audio: bytes):
    client = OpenAI()
    audio_bytes = BytesIO(audio)
    audio_bytes.name = "audio.m4a"  # ここがミソ
    transcription = client.audio.transcriptions.create(
        model="whisper-1", file=audio_bytes
    )
```

調べたところ、OpenAI の Whisper API は拡張子でファイルのフォーマットを判定しているようでした。なのでいったん `BytesIO` に変換してファイル名を付与することで解決できます。Android と iPhone の LINE アプリ両方から録音データを送ってみましたがどっちも m4a だったのでハードコードしちゃいましたが、mp3 とかがアップロードされる場合もあるかと思うので本当は content type から拡張子を出し分けるといいんじゃないかと思います。

#### ダメだった例1: bytes をそのまま渡す

```python
def transcribe(audio: bytes):
    transcription = client.audio.transcriptions.create(
        model="whisper-1", file=audio
    )
```

ログ消えちゃったけど、[この投稿](https://community.openai.com/t/whisper-error-400-unrecognized-file-format/563474) と同じ `"Unrecognized file format. Supported formats: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']"` っていうエラーが返ったはず。

#### ダメだった例2: content type と一緒に bytes を渡す

`Transcriptions.create()` の引数の型定義的にいけるのかなと思って試したけどだめだった。

以下がその型定義ですが、3つめのパターンでいけるかも、と思って

```python
FileTypes = Union[
    # file (or bytes)
    FileContent,
    # (filename, file (or bytes))
    Tuple[Optional[str], FileContent],
    # (filename, file (or bytes), content_type)
    Tuple[Optional[str], FileContent, Optional[str]],
    # (filename, file (or bytes), content_type, headers)
    Tuple[Optional[str], FileContent, Optional[str], Mapping[str, str]],
]
```

https://github.com/openai/openai-python/blob/v1.35.15/src/openai/_types.py#L49-L58

タプルの0番目のファイル名は `None`、1番目は `bytes`、2番目に LINE から取得した `content.content_type` を渡してみましたが `Value error, Expected UploadFile, received: <class 'str'>` というエラーになってしまい、レスポンスの `input` フィールドには文字列化されたバイナリデータが入っていました（ `\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42\x00\x00\x03Ymoov...` ）。

```python
def transcribe(audio: bytes, content_type: str):
    transcription = client.audio.transcriptions.create(
        model="whisper-1", file=(None, audio, content_type)
    )
```

## 参考文献

* [Whisper error 400 "Unrecognized file format." - API - OpenAI Developer Forum](https://community.openai.com/t/whisper-error-400-unrecognized-file-format/563474)
* [Unrecognized file format error whisper BytesIO, can't write to disk - API - OpenAI Developer Forum](https://community.openai.com/t/unrecognized-file-format-error-whisper-bytesio-cant-write-to-disk/582893)
* [OpenAI Whisper- Send Bytes (python) instead of filename - API - OpenAI Developer Forum](https://community.openai.com/t/openai-whisper-send-bytes-python-instead-of-filename/84786)
