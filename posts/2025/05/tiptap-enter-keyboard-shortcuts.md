---
title: "TipTapでEnterキーを押したときにマークをリセットする"
date: "2025-05-28"
tags: ["JavaScript", "TipTap"]
---

TipTap のデフォルトの挙動では、Enter キーで改行（新しい段落に移動）したときにその時点のマーク（太字や斜体などのスタイル）が次の段落にも引き継がれるようになっています。

しかしながら、Notion をはじめ世の中の多くのエディタでは段落が切り替わったらマークはリセットされるという仕様になっていることが多く、そちらに慣れていると TipTap の仕様に違和感を感じたりします。今回は段落やリストアイテムが切り替わったら、スタイルをリセットするという仕様を実現する拡張機能を作ってみました。

ちょっと調べてみた感じ discussion には上がっているけど、回答が集まっていない [^1] ちょっとややこしい（？）ネタぽいです。

[^1]: [Reset marks on pressing "enter" · ueberdosis/tiptap · Discussion #2541](https://github.com/ueberdosis/tiptap/discussions/2541) や [How to Clear Marks on Enter (Notion-like Behavior) without Custom Extensions? · ueberdosis/tiptap · Discussion #5944](https://github.com/ueberdosis/tiptap/discussions/5944) の discussion があるが回答が執筆時点で1件も来ていない。

## 成果物

![TipTap](/images/posts/2025/05/tiptap.gif)

[React | Tiptap Editor Docs](https://tiptap.dev/docs/editor/getting-started/install/react) に従い環境を作成し `src/Tiptap.tsx` を下記コードに置き換えてください。

<details>
<summary>コマンド</summary>

```sh
pnpm create vite@latest my-tiptap-project --template react-ts
cd my-tiptap-project
npm install @tailwindcss/vite @tiptap/core @tiptap/pm @tiptap/react @tiptap/starter-kit tailwindcss
```

`index.css`

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

</details>

`src/Tiptap.tsx`

```ts
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/* よくあるキーボード操作を実現する拡張機能
 * StarterKit に含まれるノードを対象として実装する
 */
const SmartKeyboardShortcuts = Extension.create({
  name: "smartKeyboardShortcuts",
  priority: 101,  // StarterKit より先に実行するようにする

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from } = state.selection;

        const grandParentNodeTypeName = $from.node(-1)?.type.name;
        const parentNodeTypeName = $from.parent.type.name;
        const isParentContentEmpty = $from.parent.content.size === 0;

        // CodeBlock ではデフォルトの挙動を優先
        if ([editor.schema.nodes.codeBlock.name].includes(parentNodeTypeName)) {
          return false;
        }

        // TaskItem を使う場合はこの配列に追加する
        if ([editor.schema.nodes.listItem.name].includes(grandParentNodeTypeName)) {
          // 親ノードが空の場合はデフォルトの挙動を優先
          if (isParentContentEmpty) return false;

          // TipTap 2.12.0 時点ではリストアイテム分割時に
          // `keepMarks: false` を指定することができない
          // `storedMarks` を空にして新カーソルに渡すようにする
          editor
            .chain()
            .splitListItem(grandParentNodeTypeName)
            .unsetAllMarks()
            .command(({ tr }) => {
              tr.setStoredMarks(null);
              return true;
            })
            .run();
          return true;
        }

        // Blockquote で、親ノードが空の場合はデフォルトの挙動を優先
        if (grandParentNodeTypeName === editor.schema.nodes.blockquote.name && isParentContentEmpty) {
          return false;
        }

        editor.chain().splitBlock({ keepMarks: false }).run();
        return true;
      },
    };
  },
});

// define your extension array
const extensions = [StarterKit, SmartKeyboardShortcuts];

const content = `
<p><strong>Hello World!</strong></p>
<h2>Lists</h2>
<ul>
  <li><p><strong>Bullet List Item 1</strong></p></li>
</ul>
<ol>
  <li><p><strong>Ordered List Item 1</strong></p></li>
</ol>
<h2>Blocks</h2>
<pre>code</pre>
<blockquote><p><strong>quote</strong></p></blockquote>
`;

const Tiptap = () => {
  const editor = useEditor({
    content,
    extensions,
    editorProps: {
      attributes: {
        class: "focus:outline-none prose",
      },
    },
  });
  return (
    <div className="mx-auto mt-8 w-xl">
      <button
        className={editor?.isActive("bold") ? "font-bold" : "font-normal text-gray-500"}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        Bold
      </button>
      <EditorContent
        editor={editor}
        className="w-full rounded-lg border border-amber-500 p-4"
      />
    </div>
  );
};

export default Tiptap;
```

## ちょっと解説

重要な点はコード内のコメントに書いているのですが、簡単に解説します。

* `splitBlock({ keepMarks: false })` で段落の分割時にマークを維持しないようにすることが可能
* HardBreak (Shift+Enter での `br` タグでの改行) はデフォルトのまま
* `priority` は数値が大きい順に呼び出される
  * 今回はデフォルト（StarterKit の 100）より先に流れて欲しいので 101 にしている
* 空行時に Enter を押すとリストや引用ブロックが外れるようになっている
  * デフォルトの挙動がそうなので `return false` でデフォルトの実装に流す
* リストや引用ブロックでは中に `p` タグが作られるので親の親のノード名で判定
  * `$from.node(-1)?.type.name`
  * 例えば `<li><code>hoge</code></li>` のような入れ子でも `code` タグはノード扱いにならず、動作に影響しないので再起的にやらなくても良さそう（他のパターンがないかは要検証？）
* リストアイテムの分割はちょっと複雑
  * `splitListItem('listItem', { keepMarks: false })` は効果なし
  * `StarterKit.configure({ bulletList: { keepMarks: false } })` は段落↔️リストの切り替え時の挙動を操作するだけなので、リストアイテムの分割は関係ない
