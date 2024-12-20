---
title: "Pythonで長すぎるログを分割して出力するハンドラ"
date: "2024-12-21"
tags: ["Python", "ログ"]
showTerminalAside: true
---

システムの仕様上、稀によくめちゃめちゃ長いログが発生することがありますね（？）。そういう時、そのまま出してしまうとログを収集したり集約したりするどこかの上限に引っかかってしまうことが考えられます。もしくは、閾値を超えたときに分割される場合もありますが、JSON のような構造化ログを送るようなケースでは分割されるとデータが破損してしまいます。そのような背景から、長いログの場合にはアプリ側で分割して構造化ログを吐き出せるようにした方がいいと考えて、作ってみました。

## 成果物

```python:pyscript
import hashlib
import logging


class ChunkingHandler(logging.Handler):
    target: logging.Handler
    chunk_size: int

    def __init__(self, target: logging.Handler, chunk_size=100_000, level=logging.NOTSET) -> None:
        super().__init__(level)
        self.target = target
        self.chunk_size = chunk_size

    def emit(self, record: logging.LogRecord) -> None:
        msg = record.getMessage()
        chunked_count = len(msg) // self.chunk_size + int(len(msg) % self.chunk_size > 0)
        if chunked_count > 1:
            record.chunked_count = chunked_count
            record.chunked_id = hashlib.md5(f"{record.created}_{msg}".encode()).hexdigest()
        for idx, i in enumerate(range(0, len(msg), self.chunk_size)):
            chunk = msg[i:i + self.chunk_size]
            record.msg = chunk
            if chunked_count > 1:
                record.chunked_index = idx
            self.target.emit(record)


# 実際にはログをJSON化するフォーマッターを使う想定
class MyFormatter(logging.Formatter):
    def format(self, record):
        formatted_message = super().format(record)
        extra_attributes = vars(record)
        extra_info = "".join([f"[{k}={v}] " for k, v in extra_attributes.items() if k.startswith("chunked")])
        return f"{extra_info}{formatted_message}"
```

ログ探索時の利便性のため、チャンク化する際は chunked_count, chunked_id, chunked_index をログレコードに付与しています。そして、チャンク化した文字列でログレコードの msg 属性を上書きして、ターゲットのハンドラの emit() メソッドを呼びます。「元のログレコードを上書きするより copy.deepcopy() した方がいいんじゃない？」と思って試してみたんですが、traceback がある時におかしくなったので素直に上書きするようにしました。少なくとも StreamHandler は同期的にストリームに出力されて終わるので問題ありませんでしたが、ターゲットハンドラの種類によっては工夫が必要なこともあるかもしれません。

以下、動作確認です。

```python:pyscript
logger = logging.getLogger()
logger.setLevel(logging.INFO)

formatter = MyFormatter()

stream_handler = logging.StreamHandler()
stream_handler.setLevel(logging.INFO)
stream_handler.setFormatter(formatter)

# 100文字でチャンクする
chunking_handler = ChunkingHandler(stream_handler, chunk_size=100)
logger.addHandler(chunking_handler)

# ふつうのログ
logger.info("futsuu no log")
# 105文字のログ（1回目）
logger.info("nagasugiru log desu! " * 5)
```
