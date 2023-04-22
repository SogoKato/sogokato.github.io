---
title: "Reactで検索・ソート可能なDataTableを自作する"
date: "2023-04-22"
tags: ["React", "Joy-UI"]
---

最近、MUI の妹分の UI ライブラリである [Joy-UI](https://mui.com/joy-ui/getting-started/overview/) を使ってます。現在進行形で活発に開発が進んでいて、設計（デザイン）も今時な感じで好感触です。ところどころまだ開発されていないコンポーネントもちらほらあるものの、ドキュメントには代替策がコード付きで載っていてとても親切です。

[MUI X](https://mui.com/x/introduction/) というより発展的なコンポーネントをもつ UI ライブラリもあるのですが、そこに今回のテーマである「データテーブル」に該当する [Data Grid](https://mui.com/x/react-data-grid/) というものがあります。これは超すごくて、雑に言うと Excel がそのまま再現できちゃいそうなコンポーネントです（超雑）。

ただ残念ながら2023年4月現在では Data Grid の Joy-UI との統合は正式にサポートされていないらしいので、今回は簡易的なデータテーブルを自作していきたいと思います。

## 要件

* `rows` には表示するデータである `object[]` を渡す
* `columns` に指定したフィールド名の値が表示される
* データの検索ができる
* 特定のカラムの昇順・降順での並び替えができる

## できたもの

上の表が素の HTML 要素だけで作ったもの、下の表が Joy-UI を使ったものです。検索やソートのロジックは一緒です。Joy-UI の方はヘッダーの hover 時に矢印が表示されるのでちょっとわかりやすいです。

<iframe
  src="https://codesandbox.io/embed/datatable-react-joyui-j409vf?fontsize=14&hidenavigation=1&theme=dark&view=preview"
  style="width:100%; height:750px; border:0; border-radius: 4px; overflow:hidden;"
  title="datatable-react-joyui"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## ポイント

検索（絞り込み）はただ filter かけているだけなので書くことないです。  
並び替えの条件のところが少し複雑なのでちょっと解説します。

状態として `sortBy` と `order` を持っています。`sortBy` は並び替える対象のカラム名、`order` は昇順か降順かです。どちらも undefined になりえます（オリジナルの順番を保持する時）。

```ts
type Order = "asc" | "desc";
const [sortBy, setSortBy] = useState<string | undefined>();
const [order, setOrder] = useState<Order | undefined>();
```

ヘッダー部分はこのようになります。ヘッダーのカラム名をクリックすると、未指定（undefined）→降順（desc）→昇順（asc）→未指定の順で切り替わります。

各カラムについて CSS の `transform` と `opacity` を計算します。下向き矢印のアイコンを使用しているので、`order === "asc"` の時のみ180度回転します。`order` の状態は全カラム共通になっています。`opacity` は `sortBy === col.field` つまり該当のカラムによってソートされている時のみ表示されるようになっています。

onClick 時には `sort` 関数が呼ばれます。  
該当カラムによってソートされている時は順繰りに desc → asc → undefined を切り替えます。次が undefined の時は `sortBy` も undefined にします。  
他のカラムによってソートされている時は現在の order を維持しつつ `sortBy` だけ該当カラムに移します。どのカラムでもソートされていない時（オリジナルの順番の時）は `sortBy` を移しつつ、`order` を undefined → desc にします。

```tsx
const header = columns.map((col) => {
  const transform = order === "asc" ? "rotate(180deg)" : undefined;
  const opacity = sortBy === col.field ? 1 : 0;
  const sort = () => {
    if (sortBy === col.field) {
      const orderNext =
        order === "desc" ? "asc" : order === "asc" ? undefined : "desc";
      setSortBy(orderNext ? col.field : undefined);
      setOrder(orderNext);
    } else {
      setSortBy(col.field);
      setOrder(order ? order : "desc");
    }
  };
  return (
    <th key={`header-${col.field}`} style={{ width: col.width }}>
      <button
        style={{
          fontWeight: "bold"
        }}
        onClick={sort}
      >
        <span>{col.headerName}</span>
        <ArrowDownIcon
          style={{
            transition: "0.2s",
            transform: transform,
            opacity: opacity
          }}
        />
      </button>
    </th>
  );
});
```

実際に配列をソートしている処理はこちらです。  
[Array.prototype.sort()](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) は破壊的に配列を変更するので、注意です。下記では前の処理で filter をかけているので元の配列が変更されていませんが、そうしない場合は `[...rows].sort()` とするなど、コピーするようにしましょう。

IE11 をサポートすることはもはやないと思いますが、古いブラウザでは sort の安定性が保証されていません。サポートする場合は MUI の [Order Dashboard](https://codesandbox.io/s/7rtmil?file=/components/OrderTable.tsx) のデモにある `stableSort` を見てみてください。

```ts
const sortedRows = filteredRows.sort((a, b) => {
  if (!sortBy || !order) {
    return 0;
  }
  const aVal = sortBy in a ? a[sortBy] : "";
  const bVal = sortBy in b ? b[sortBy] : "";
  if (order === "asc") {
    return aVal > bVal ? 1 : -1;
  } else {
    return aVal < bVal ? 1 : -1;
  }
});
```

## インターフェイス

`DataTable` (素の HTML)

```ts
type DataTableProps = {
  columns: Column[];
  rows: object[];
  getRowId?: (row: object) => any;
  search?: any;
  style?: StyleHTMLAttributes<HTMLTableElement>;  // tableのstyle属性
};
```

`JoyDataTable` (Joy-UI の Table を使用)

```ts
type JoyDataTableProps = {
  columns: Column[];
  rows: object[];
  getRowId?: (row: object) => any;
  search?: any;
  sx?: SxProps;  // @mui/joy/TableのSx属性
};
```

* `column` はカラムの定義です
  ```ts
  export type Column = {
    field: string;  // rowsの各objectのフィールド名
    headerName: string;  // ヘッダーに表示するカラム名
    width?: number;  // カラムの幅
  };
  ```
* `rows` には任意のオブジェクトの配列を渡します
* `getRowId` は rows の各 object の一意の識別子を取得する関数です。デフォルトでは id フィールドを取得します
  * DataGrid にも同じ役割のものがあります[^1]
* `search` には検索する文字列や数値を渡します

[^1]: [Row identifier](https://mui.com/x/react-data-grid/row-definition/#row-identifier)

## おわりに

成熟した UI ライブラリならこういった DataTable を備えていることが多いと思いますが、開発途上のものだとあるとは限らないので、React に限らず DataTable を実装してみたい方の参考になれば幸いです！

## 参考文献

* [Table](https://mui.com/joy-ui/react-table/)
* [Order Dashboard](https://codesandbox.io/s/7rtmil?file=/components/OrderTable.tsx)
* [Data Grid](https://mui.com/x/react-data-grid/)
