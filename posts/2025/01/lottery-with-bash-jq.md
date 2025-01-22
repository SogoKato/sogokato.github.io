---
title: "配列のJSONの要素をランダムで取り出すおみくじシェルスクリプト"
date: "2025-01-22"
tags: ["シェル", "コマンド"]
---

表題の通り、配列の JSON から指定した数だけの要素をランダムで取り出すシェルスクリプトを jq のラッパーとして作ってみました。プルリクエストやマージリクエストのレビュワーをランダムで指名するときに、API で権限のあるメンバーリストを取得してその JSON から抽選できたらいいなーと妄想してます。

## 前提条件

* Bash
* jq

## 成果物

```bash:jrand.sh
#!/bin/bash

input=$(jq . ${@:2})
length=$(echo $input | jq -e 'if type == "array" then length else error("Input is not an array") end')

count=$1
if [ -z "$count" ] || [ $count -lt 1 ]; then
  echo "Count must be 1 or greater."
  exit 1
fi

if [ $count -gt $length ]; then
  echo "The value of count is greater than the length of the array."
  exit 1
fi

declare -A indices
while [ ${#indices[@]} -lt $count ]; do
  v=$((RANDOM % length))
  if [ -z "${indices[$v]}" ]; then
    indices[$v]=1
  fi
done

selector="["
for index in "${!indices[@]}"; do
  selector+=".[${index}], "
done
selector="${selector%, }]"

echo $input | jq "$selector" ${@:2}
```

## つかいかた

選ぶ数を必ず第1引数に指定します。以下は2つ選ぶ例です。

JSON の渡し方は jq と同様、パイプまたはファイル名です。

パイプで渡すなら

```bash
$ echo '["foo", "bar", "buzz", "hoge", "piyo"]' | ./jrand.sh 2
[
  "piyo",
  "bar"
]
```

ファイルから渡すなら

```json:input.json
[
  "foo",
  "bar",
  "buzz",
  "hoge",
  "piyo"
]
```

```bash
$ ./jrand.sh 2 input.json
[
  "buzz",
  "foo"
]
```

その他、jq コマンドのオプションも渡せます。

```bash
$ ./jrand.sh 2 -c input.json
["piyo","buzz"]
```

誰かのお役に立てば幸いです。
