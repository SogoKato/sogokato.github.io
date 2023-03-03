---
title: "Pythonのunittest.mock.patchではどこにパッチするかが重要"
date: "2023-03-04"
tags: ["Python", "単体テスト"]
---

[Python 公式ドキュメントの unittest.mock のページ](https://docs.python.org/ja/3/library/unittest.mock.html#where-to-patch)にドンピシャの内容が書いてありますが、なかなか気づけずにハマってしまっていたのでメモです。

`unittest.mock.patch` でパッチしたけど当たってない気がする人は参考にしてみてください。

下記の引用に要点が凝縮されています。

> ### どこにパッチするか
>
> `patch()` は (一時的に) ある 名前 が参照しているオブジェクトを別のものに変更することで適用されます。任意のオブジェクトには、それを参照するたくさんの名前が存在しえます。なので、必ずテスト対象のシステムが使っている名前に対して patch しなければなりません。
>
> 基本的な原則は、オブジェクトが _ルックアップ_ されるところにパッチすることです。その場所はオブジェクトが定義されたところとは限りません。

つまり、宣言した場所ではなく import している側から見たオブジェクトの位置を指定しなさい、ということです。ただ、`from a import SomeClass` とするか、`import a` して `a.SomeClass` とするかでパッチの当て方が変わってくるので注意が必要です。

以下のファイルがある想定で実験してみます。

```pyconfig
terminal = false

[[fetch]]
from = "../../../assets/posts/2023/03/a.py"
to_file = "./a.py"

[[fetch]]
from = "../../../assets/posts/2023/03/b.py"
to_file = "./b.py"

[[fetch]]
from = "../../../assets/posts/2023/03/c.py"
to_file = "./c.py"

[[fetch]]
from = "../../../assets/posts/2023/03/test_b.py"
to_file = "./test_b.py"

[[fetch]]
from = "../../../assets/posts/2023/03/test_c.py"
to_file = "./test_c.py"
```

`a.py` の `SomeClass` はテスト対象システムが依存しているクラスです。これがモックの対象となるクラスです。

```python:a.py
class SomeClass:
    def some_method(self):
        raise NotImplementedError()
```

`b.py` の `SystemUnderTest` はその名の通りテスト対象システムです。`b.py` では `from a import SomeClass` で import してから `SomeClass()` でインスタンス化しています。

> この状態で `a.SomeClass` を patch() を使って mock out してもテストには影響しません。モジュール b はすでに 本物の `SomeClass` への参照を持っていて、パッチの影響を受けないからです。
>
> 重要なのは、 SomeClass が使われている (もしくはルックアップされている) 場所にパッチすることです。この場合、 `some_function` はモジュール b の中にインポートされた `SomeClass` をルックアップしています。

なのでパッチする時は `@patch("b.SomeClass")` とします。

```python:b.py
from a import SomeClass


class SystemUnderTest:
    def some_function(self):
        sc = SomeClass()
        return sc.some_method()
```

`c.py` の `SystemUnderTest` もその名の通りテスト対象システムです。`ｃ.py` では `import a` で import してから `a.SomeClass()` でインスタンス化しています。

> この場合、パッチしたいクラスはそのモジュールからルックアップされているので、 `a.SomeClass` をパッチする必要があります

なので `@patch("a.SomeClass")` と書いてパッチを当てます。

```python:c.py
import a


class SystemUnderTest:
    def some_function(self):
        sc = a.SomeClass()
        return sc.some_method()
```

それぞれに対するテストを書いて確かめてみます。`TestB` の `test_patching_a` はパッチが当たらないので失敗するはずです。

```python:test_b.py
import unittest
from unittest.mock import patch

from b import SystemUnderTest


class TestB(unittest.TestCase):
    @patch("a.SomeClass")
    def test_patching_a(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        # Call below will raise NotImplementedError since it is not patched
        actual = sut.some_function()
        assert actual == "mock"

    @patch("b.SomeClass")
    def test_patching_b(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        actual = sut.some_function()
        assert actual == "mock"
```

`TestC` の `test_patching_c` ではパッチを当てることに失敗します。

```python:test_c.py
import unittest
from unittest.mock import patch

from c import SystemUnderTest


class TestC(unittest.TestCase):
    @patch("a.SomeClass")
    def test_patching_a(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        actual = sut.some_function()
        assert actual == "mock"

    @patch("c.SomeClass")  # will raise AttributeError
    def test_patching_c(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        actual = sut.some_function()
        assert actual == "mock"
```

実行します。

```python:main.py:pyscript
from unittest import TestLoader
from unittest import TextTestRunner


loader = TestLoader()
test = loader.discover(".")
runner = TextTestRunner()
runner.run(test)
```

期待通りの結果が得られていますね。Python の import まわりはやっぱりなんか面倒くさい・・・。

## 参考文献

* [unittest.mock --- モックオブジェクトライブラリ](https://docs.python.org/ja/3/library/unittest.mock.html)
