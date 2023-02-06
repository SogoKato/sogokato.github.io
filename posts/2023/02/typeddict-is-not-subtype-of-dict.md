---
title: "TypedDictはdictのsubtypeではないので関数の引数にはMappingを使う"
date: "2023-02-06"
tags: ["Python"]
---

Python の dict（辞書）を TypeScript の interface のように扱えて便利な [TypedDict](https://peps.python.org/pep-0589/) ですが、**dict のサブクラスではない**というのが少し落とし穴だなと思ったのでメモ。

## まずは PEP を見よう

大抵のことは公式ドキュメントを見れば書いてあります。今回も例外なくそうでした。

> First, any TypedDict type is consistent with `Mapping[str, object]`.

https://peps.python.org/pep-0589/#type-consistency

言いたいことは以上です。関数の引数として、その TypedDict 以外の辞書も受け取りたいときは Mapping を使いましょう。

```py
from typing import Mapping, TypedDict

class Movie(TypedDict):
    name: str
    year: int

def from_mapping(map: Mapping[str, object]):
    """TypedDictを含む任意のマップを受け取る関数."""

def from_dict(dict: dict[str, object]):
    """任意のdictを受け取る関数."""

movie: Movie = {
  "name": "Harry Potter and the Philosopher's Stone",
  "year": 1999,
}

# OK
from_mapping(movie)

# NG
from_dict(movie)
```

## どんなエラーが出る？

型ヒントなので実行時にエラーになることはありませんが、静的型検査で怒られます。

```
$ poetry run pyright main.py
...
pyright 1.1.292
/path/to/main.py
  /path/to/main.py:22:11 - error: Argument of type "Movie" cannot be assigned to parameter "dict" of type "dict[str, object]" in function "from_dict"
    "Movie" is incompatible with "dict[str, object]" (reportGeneralTypeIssues)
1 error, 0 warnings, 0 informations
Completed in 0.512sec
```

ちなみに上記の例では `Mapping[str, object]` を使っていますが `Mapping[str, Any]` でも問題ないです。

## まとめ

とりあえず `dict[str, Any]` でいけるかな～と思っていたら引っかかったので勉強になりました。

少し話はそれますが[ロバストネス原則](https://ja.wikipedia.org/wiki/%E3%83%AD%E3%83%90%E3%82%B9%E3%83%88%E3%83%8D%E3%82%B9%E5%8E%9F%E5%89%87)というのを最近知りました。

> 貴方が自分ですることに関しては厳密に、貴方が他人から受けることに関しては寛容に  
> (be conservative in what you do, be liberal in what you accept from others)

今回の例では `dict[str, Any]` を引数として指定するよりも `Mapping[str, Any]` と書くほうが、よりソフトウェアを堅牢な作りにできるのかもと思いました。ちょっと影が薄い（？）Mapping くん、有効に活用していきたい所存です。

## 参考文献

* https://peps.python.org/pep-0589/
* https://stackoverflow.com/questions/73242556/typeddict-class-is-an-incompatible-type-for-function-expecting-dict

Robustness Principle 的にも Mapping を使うようにした方がいいかも
