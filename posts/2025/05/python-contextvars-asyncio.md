---
title: "Pythonのcontextvarsのコンテキストの分離は浅いコピーだと覚えておこう"
date: "2025-05-15"
tags: ["Python", "非同期処理"]
---

Python の非同期プログラミングで複数のタスクを並列に走らせると、タスクごとに独立した状態を持たせたくなる場面がしばしばあります。イメージしやすい例を挙げれば、Web サーバーでリクエストごとに独立した状態を持たせたい場合がそうだと思います。  
そこで登場するのがコンテキストローカルな変数を提供する [`contextvars`](https://docs.python.org/ja/3.13/library/contextvars.html) モジュールです。

本記事では `contextvars` の基本から、asyncio タスク内でシャローコピーが行われる際の落とし穴、そして安全に扱うためのパターンまでを解説します。

## contextvars

`contextvars` は Python 3.7 で導入された標準ライブラリで、スレッドローカル ([`threading.local`](https://docs.python.org/ja/3.13/library/threading.html#threading.local)) と似ていますが [asyncio.Task](https://docs.python.org/3/library/asyncio-task.html#asyncio.Task) に代表されるような非同期タスクごとに正しく値を管理できるようになっています。

* `ContextVar` はコンテキスト変数
  * `ContextVar` を宣言する時はモジュールのトップレベルで宣言する（クロージャの中に書かない）
  * `set()` で値を束縛、`get()` で取得する
* `Context` はコンテキスト（`ContextVars` とその値をマッピングするもの）
  * `copy_context()` を使うと現在のコンテキストをまるごと複製できる
  * 空のコンテキストを作りたい場合は `Context()` でインスタンス化する
  * `copy_context()` `Context.copy()` はコンテキストの **浅いコピー (shallow copy) を返す** 点に注意が必要

## asyncio と組み合わせて使う

`contextvars` は [`asyncio`](https://docs.python.org/ja/3.13/library/asyncio.html#module-asyncio) をサポートしていて、追加の設定なしでタスクごとに独立したコンテキストが作成されます。

。[`asyncio.create_task()`](https://docs.python.org/ja/3.13/library/asyncio-task.html#asyncio.create_task) が呼ばれた時にデフォルトでは現在のコンテキスト（OS スレッドのコンテキスト）が **浅く複製** され、非同期タスクへ引き継がれます。`asyncio.create_task()` の引数に任意の `Context` インスタンスを渡すこともできます。これは「タスク生成時点のスナップショット」を取るイメージで、生成後に親側のコンテキストで変数を書き換えても子タスクには反映されません。

しかし上述の通り浅いコピーなので、コンテキスト変数に束縛されている値がミュータブルな値だと意図せずタスク間でコンテキストが共有されてしまう可能性があります。防止策はシンプルで「タスク開始時に新しいインスタンスを束縛する」または「イミュータブルをデフォルトにする」ことです。

## コード

### 良いコード

```python
import asyncio
import contextvars


class MyContext:
    def __init__(self):
        self.count = 0


ctx_1 = contextvars.ContextVar("ctx_1", default=0)
ctx_2: contextvars.ContextVar[MyContext] = contextvars.ContextVar("ctx_2")


async def process(name: str):
    count = ctx_1.get()
    count += 1
    ctx_1.set(count)

    my_context = MyContext()
    my_context.count += 1
    ctx_2.set(my_context)

    await asyncio.sleep(1)

    print(
        f"Task {name}:\n  ctx_1.get() -> {ctx_1.get()}\n  id(ctx_2.get()) -> {id(ctx_2.get())}\n  ctx_2.get().count -> {ctx_2.get().count} "
    )


async def main():
    tasks = [
        asyncio.create_task(process("A")),
        asyncio.create_task(process("B")),
        asyncio.create_task(process("C")),
    ]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
```

**実行結果**（ID は環境依存）

```
Task A:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4337049696
  ctx_2.get().count -> 1 
Task B:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4334282000
  ctx_2.get().count -> 1 
Task C:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4337050896
  ctx_2.get().count -> 1
```

### 悪いコード

```python
import asyncio
import contextvars


class MyContext:
    def __init__(self):
        self.count = 0


ctx_1 = contextvars.ContextVar("ctx_1", default=0)
ctx_2: contextvars.ContextVar[MyContext] = contextvars.ContextVar("ctx_2", default=MyContext())


async def process(name: str):
    count = ctx_1.get()
    count += 1
    ctx_1.set(count)

    my_context = ctx_2.get()
    my_context.count += 1
    ctx_2.set(my_context)

    await asyncio.sleep(1)

    print(
        f"Task {name}:\n  ctx_1.get() -> {ctx_1.get()}\n  id(ctx_2.get()) -> {id(ctx_2.get())}\n  ctx_2.get().count -> {ctx_2.get().count} "
    )


async def main():
    tasks = [
        asyncio.create_task(process("A")),
        asyncio.create_task(process("B")),
        asyncio.create_task(process("C")),
    ]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
```

**実行結果**（ID は環境依存）

```
Task A:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4313005856
  ctx_2.get().count -> 3 
Task B:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4313005856
  ctx_2.get().count -> 3 
Task C:
  ctx_1.get() -> 1
  id(ctx_2.get()) -> 4313005856
  ctx_2.get().count -> 3
```

`ctx_1` は int 型であり、イミュータブルなので問題ありませんが、`ctx_2` の `MyContext` が全てのタスク間で共有されてしまっていることがわかります。

## まとめ

以下の点に配慮して `contextvars` と `asyncio` を使うと無用な混乱なく、非同期タスクごとに独立したコンテキストを保てると思います。

* `ContextVar` のデフォルトにミュータブルな値を渡さない
* 非同期タスクの中で新しいインスタンスを作成して `set()` する

## 参考文献

* [contextvars --- コンテキスト変数 — Python 3.13.3 ドキュメント](https://docs.python.org/ja/3.13/library/contextvars.html)
* [PEP 567 – Context Variables | peps.python.org](https://peps.python.org/pep-0567/)
* [コルーチンと Task — Python 3.13.3 ドキュメント](https://docs.python.org/ja/3.13/library/asyncio-task.html)
