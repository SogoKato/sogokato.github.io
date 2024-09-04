---
title: "2つのディレクトリ内のファイルの差分を取る"
date: "2024-09-04"
tags: ["コマンド"]
---

小ネタです。2つのディレクトリ内のファイルの差分を取る方法。

個人的最終形は以下。

```
diff -r --speed-large-files dir1 dir2
```

中身が異なっているファイルの差分だけを表示してくれます。

```
$ tree dir1 dir2
dir1
|-- fuga
`-- hoge
    `-- foo
dir2
|-- fuga # dir1と同じ
`-- hoge
    `-- foo

2 directories, 4 files
$ diff -r --speed-large-files dir1 dir2
diff -r --speed-large-files dir1/hoge/foo dir2/hoge/foo
1c1
< bar
---
> barbaz
```

使っているオプションを解説。

```
-r, --recursive
      recursively compare any subdirectories found
```

サブディレクトリ内のファイルも再帰的に比較するオプション。

```
--speed-large-files
      assume large files and many scattered small changes
```

大きいファイルの中に小さい変更が大量にあるような場合に、このオプションを付けると通常の diff とは異なるアルゴリズムが使用されるため高速化されるそうです（出力される結果は同じ）。

---

他にも使えそうなオプションをピックアップしてみたので、状況に応じて下記もつけると良さそうです。

```
-q, --brief
      report only when files differ
```

`Files dir1/hoge/foo and dir2/hoge/foo differ` のようにファイルの中身を表示せず、異なっているということだけを教えてくれます。

```
-s, --report-identical-files
      report when two files are the same
```

`Files dir1/fuga and dir2/fuga are identical` のように同じであることを報告してくれます。

## 参考文献

* `man diff`
* [2つのディレクトリを比較する](https://bonyari-dtp.hatenablog.com/entry/2019/01/17/112856)
* [diff Performance (Comparing and Merging Files)](https://www.gnu.org/software/diffutils/manual/html_node/diff-Performance.html)
* [【 diff 】コマンド（基本編）――テキストファイルの差分を出力する：Linux基本コマンドTips（102） - ＠IT](https://atmarkit.itmedia.co.jp/ait/articles/1704/13/news021.html)
