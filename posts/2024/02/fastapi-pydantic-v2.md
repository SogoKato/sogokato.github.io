---
title: "FastAPIとPydantic V2で任意のcontextを渡してみる"
date: "2024-02-20"
tags: ["Python", "FastAPI", "Pydantic"]
---

Pydantic V2 が2023年6月にリリースされました。結構いろいろ変わっていて移行作業はそこそこ大変な気がしますが対応される方は [Migration Guide](https://docs.pydantic.dev/2.0/migration/) を読んで頑張ってください。

私はというと V1 のころに Pydantic の `@validator` デコレータをカスタムしまくったので、V2 でそれがほぼ使えなくなってしまいました。そもそもなんでカスタムしたのかというと、バリデータのメソッドに DB にアクセスするためのセッションオブジェクトとかを渡したかったからでした。V2 では [model_validate](https://docs.pydantic.dev/2.0/api/main/#pydantic.main.BaseModel.model_validate) で任意の context を差し込めるようになったので、今回はこれを使う方法を検証してみました。

## 環境

* Python 3.12.0
* FastAPI 0.109.2
* Pydantic 2.6.1
* Rye 0.24.0

## 成果物

https://github.com/SogoKato/fastapi-pydantic-v2

FastAPI の dependency（`Depends()` で呼び出されるやつ）として実装しました。

**2024-09-11 追記**

Pyright/Pylance がエラーを出すようになったので型チェック用の定義を追記しました。

```py
def validate(model: Type[BaseModel]):
    """ユーザーの入力値を検証する関数を返す高階関数"""

    if TYPE_CHECKING:
        model = NewType("model", BaseModel)

    async def func(content: model, db: Session = Depends(get_db)) -> model:
        # ValidationContextはTypedDict
        context = dict(ValidationContext(db=db, items_cache=None))
        try:
            model.model_validate(content.model_dump(), context=context)
        except ValidationError as e:
            raise RequestValidationError(errors=e.errors())
        return content

    return func
```

```py
@app.post("/items")
async def create_item(
    db: Annotated[Session, Depends(get_db)],
    body: Annotated[CreateRequest, Depends(validate(CreateRequest))],
):
    item = Item(name=body.name)
    db.add(item)
    return {"item": asdict(item)}
```

## ちょこっと解説

`validate()` 関数は高階関数になっていて、`validate(CreateRequest)` のように Pydantic モデルのクラスを渡します。返り値の関数の引数としてそのクラスが指定されているので、FastAPI がそのインスタンス（`CreateRequest` のインスタンス）を渡してくれるようになります。

そして、あらかじめ定めた TypedDict の通りに context の辞書を作成して `model_validate()` をコールします。ここまでで分かるように、FastAPI が `CreateRequest` をインスタンス化する時と、`model_validate()` が呼ばれた時とで、2回 Pydantic のバリデーション処理が走ります。

そのため、モデルは以下のように書かれています。1回目のバリデーション時には context が渡されていないのでそれでも問題ないように実装します。

また、DB への負荷を下げる工夫として、最初に DB から取得した結果を再利用できるようにバリデータ内で context の値を更新してキャッシュするようにしています。

```py
class CreateRequest(BaseModel):
    """新しいアイテムを作成するリクエスト"""

    name: str

    @model_validator(mode="before")
    def is_under_limit(self, info: ValidationInfo):
        """アイテムの最大数を超えないかどうかの確認"""
        context: Optional[ValidationContext] = info.context
        # contextがない場合は確認できないのでスキップ
        if not context:
            return self
        # 最初のバリデータでDBから取得
        items = context["db"].get_all()
        if len(items) >= 5:
            raise ValueError("max 5 items.")
        # contextに格納して2つ目以降のバリデータで使えるようにする
        context["items_cache"] = items
        return self

    @field_validator("name")
    @classmethod
    def is_unique_name(cls, v: str, info: ValidationInfo):
        context: Optional[ValidationContext] = info.context
        # contextがない場合は確認できないのでスキップ
        if not context:
            return v
        # 2つめ以降のバリデータではDBから取得せずキャッシュを使用
        if context["items_cache"] is None:
            raise RuntimeError()
        matched = [i for i in context["items_cache"] if i.name == v]
        if matched:
            raise ValueError("name must be unique.")
        return v
```

## まとめ

Pydantic V2 になって、非常にシンプルに任意のオブジェクトをバリデータに渡せるようになってうれしいです。

## 参考文献

* [Validators - Pydantic](https://docs.pydantic.dev/2.0/usage/validators/)
