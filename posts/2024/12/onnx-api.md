---
title: "scikit-learnで作ったモデルをAPIで提供するならONNXがよさそう"
date: "2024-12-12"
tags: ["Python", "ONNX", "scikit-learn", "FastAPI"]
---

この記事は [Fujitsu Advent Calendar 2024](https://qiita.com/advent-calendar/2024/fujitsu) の12日目の記事です。

昨日は [@Syuparn](https://qiita.com/Syuparn) さんの [バックエンドの動作確認に使用できるワンライナーAPIサーバーの紹介](https://qiita.com/Syuparn/items/9d7edac345bd1e039692) でした。私も動かしてみましたが、本当に動いていてすごいと思いました。

---

優秀な弊弟が scikit-learn で、いぬの画像分類をするモデルを作ったのでそれを API として提供できるようにしてみました。下記はその奮闘記です。

## 環境

* Python 3.12.2
* numpy 2.1.3
* scikit-learn 1.5.2
* skl2onnx 1.17.0
* onnxruntime 1.20.1
* img2feat 0.3.0
* FastAPI 0.115.6
* pillow 11.0.0
* Rye 0.31.0

M2 MacBook Air で動作確認しています。

## 前置き: どんなモデル？

いぬの画像を与えると `eating` `playing` `sleeping` のそれぞれについて確率を計算するモデルです。転移学習（Fine-tuning）ではなく、既存のニューラルネットワークを特徴量抽出器としてのみ使い、抽出した特徴量を学習データとして、ロジスティック回帰によってシンプルなモデルを作成しています。使用した画像は十数枚です。少ない学習データでも効率よく学習でき、過学習のリスクも低いことが利点です。

4年くらい前に私が学生時代に作った同じ目的のモデルは（記憶が正しければ）VGG をベースに、数百枚の画像を使って転移学習を行なったものでした。今回、未知のデータを使って両モデルの性能を比較してみたところ、弟が作ったモデルの方が高い正答率を出したことから、特徴量抽出によって作られたモデルの汎化性能の高さが示されました。

なお、以下の説明やサンプルコードでは上記で使ったデータセットではなく、[CIFAR_10](https://www.cs.toronto.edu/~kriz/cifar.html) のデータセットを用います。

## scikit-learn で訓練したモデルを永続化する

ここから本題です。

[scikit-learn のドキュメント](https://scikit-learn.org/stable/model_persistence.html)を見ると、訓練したモデルを永続化する方法はいくつかあることがわかります。検索で最もよく出てくる代表的な方法は Python の標準ライブラリの [pickle](https://docs.python.org/3/library/pickle.html#module-pickle) を使用する方法です。

Pickle を使えば Python のオブジェクト構造を丸々保存できるのですが、環境依存になるので、クラスは元と同じ場所に定義されている必要があります[^1]。また、信頼できないソースから取得した場合は任意のコードを実行されてしまうリスクがあります。[Joblib](https://joblib.readthedocs.io/en/latest/index.html#module-joblib) も pickle ベースのライブラリです。

[^1]: 違う環境で動かすと `AttributeError: Can't get attribute '...' on <module ...>` みたいなエラーになります。

今回は学習済みのモデルを読み込んで提供する API を作りたいので、学習時の環境とは全然違う構成になっていますし、セキュリティも重視する必要があります。

[skops.io](https://skops.readthedocs.io/en/stable/modules/classes.html#module-skops.io) は pickle ベースの方法よりは安全なようですが、訓練時の環境と同じ環境が必要そうなのでこれも選択肢から外れます。

結果として [ONNX](https://onnx.ai/index.html) が最も適していそうだということがわかりました。ONNX (Open Neural Network Exchange) は、学習したモデルを Python だけでなく他の言語でも実行できるように表現したフォーマットです。「オニキス」って読むみたいです。

scikit-learn で訓練したモデルは [sklearn-onnx](http://onnx.ai/sklearn-onnx/index.html) ライブラリを使って書き出しができます。

`to_onnx()` の第一引数には scikit-learn のモデル、第二引数には訓練に使用した入力を渡します（入力の型を知るために使います）。

```python
from sklearn.model_selection import train_test_split
from skl2onnx import to_onnx
from sklearn.linear_model import LogisticRegression

X_train, X_test, y_train, y_test = train_test_split(X, y)
clr = LogisticRegression(max_iter=500)
clr.fit(X_train, y_train)

onx = to_onnx(clr, X_train, target_opset=12)
```

[Choose appropriate output of a classifier - sklearn-onnx 1.18.0 documentation](http://onnx.ai/sklearn-onnx/auto_tutorial/plot_dbegin_options_zipmap.html) より一部抜粋

## 成果物

というわけで、公開用に CIFAR_10 データセットを使って同じような手法で訓練してみました。

https://github.com/SogoKato/fastapi-onnx-sklearn

上記リンク先の README の通りにやれば、画像を分類した結果を返してくれる API が立ち上がります。

```
curl -s -X POST http://localhost:8000/prediction -F "file=@$(pwd)/examples/dog/dog1.png;type=image/jpeg" | jq
```

結果

```json
{
  "result": [
    {
      "label": "dog",
      "probability": 0.6963527798652649
    },
    {
      "label": "cat",
      "probability": 0.17074337601661682
    },
    {
      "label": "horse",
      "probability": 0.06515106558799744
    },
    {
      "label": "truck",
      "probability": 0.03153929114341736
    },
    {
      "label": "deer",
      "probability": 0.012792888097465038
    },
    {
      "label": "automobile",
      "probability": 0.010493496432900429
    },
    {
      "label": "ship",
      "probability": 0.005543916951864958
    },
    {
      "label": "airplane",
      "probability": 0.003050298895686865
    },
    {
      "label": "frog",
      "probability": 0.0022715579252690077
    },
    {
      "label": "bird",
      "probability": 0.002061390085145831
    }
  ]
}
```

## ちょこっと解説

アプリケーションの起動時に ONNX やその他の推論に必要な情報を読み込んでいます。

```python
models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global models
    ...
    with open("cifar10.onnx", "rb") as f:
        onx = f.read()
    models["session"] = InferenceSession(onx, providers=["CPUExecutionProvider"])
    ...
    yield
    models.clear()
```

以下が実際に推論するコードです。入力 (`X`) はモデルで定義されている形式に変換して渡すようにします。出力 (`.run()` の第一引数) には `["output_probability"]` を指定しています。`["output_label"]` を指定すると、最も確率が高いラベルだけが返ります。`None` を指定すると全部が返ります。

あとはよしなに整形して API レスポンスを返却するだけです。

```python
@app.post("/prediction")
async def predict(req: Annotated[ImageRequest, Form()]):
    image = to_array(await req.file.read())

    # Feature Extraction (特徴量抽出)
    X = models["cnn"]([image])

    # Feature Standardization (特徴量の標準化)
    X = X - models["mean"]
    X = X / models["scale"]

    X = X.astype(np.float32)

    input_name = models["session"].get_inputs()[0].name  # is "X"
    # label_name = models["session"].get_outputs()[0].name  # is "output_label"
    label_name = models["session"].get_outputs()[1].name  # is "output_probability"

    proba = models["session"].run([label_name], {input_name: X})[0][0]
    print(proba)
    # >>> {0: 0.003050298895686865, 1: 0.010493496432900429, 2: 0.002061390085145831, 3: 0.17074337601661682, 4: 0.012792888097465038, 5: 0.6963527798652649, 6: 0.0022715579252690077, 7: 0.06515106558799744, 8: 0.005543916951864958, 9: 0.03153929114341736}

    proba_list = [(k, v) for k, v in proba.items()]
    proba_list = sorted(proba_list, key=lambda i: i[1], reverse=True)
    result = [{"label": LABELS[d[0]], "probability": d[1]} for d in proba_list]
    return {"result": result}
```

## おわりに

scikit-learn での訓練後にそのモデルをデプロイしたいケースは結構あると思いますが、意外とネット上の情報が少なそうだったので記事にしてみました。誰かの役に立てば幸いです。

明日は [@norikmb](https://qiita.com/norikmb) さんが何か書いてくれるみたいです。お楽しみに。

## 参考文献

* [9. Model persistence — scikit-learn 1.5.2 documentation](https://scikit-learn.org/stable/model_persistence.html)
* [sklearn-onnx 1.18.0 documentation](http://onnx.ai/sklearn-onnx/index.html)
* [Python API documentation (onnxruntime.ai)](https://onnxruntime.ai/docs/api/python/index.html)
* [mastnk/img2feat](https://github.com/mastnk/img2feat)
* [Lifespan Events - FastAPI](https://fastapi.tiangolo.com/advanced/events/#lifespan)
* [CIFAR-10 and CIFAR-100 datasets](https://www.cs.toronto.edu/~kriz/cifar.html)
