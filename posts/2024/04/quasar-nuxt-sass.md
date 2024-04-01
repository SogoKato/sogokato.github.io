---
title: "Nuxt 3 + QuasarでSassを使うための設定【2024】"
date: "2024-04-01"
tags: ["Vue.js", "Nuxt", "Quasar"]
---

Vue.js のためのフレームワークである Nuxt 3 と UI フレームワークである Quasar を組み合わせて使うときに Sass を設定する方法です。[Nuxt 3 + Quasarで、Sass Variablesが使えない問題を解消した](https://zenn.dev/yoonchulkoh/articles/16cb0e7ee2e5af)の記事を初めに拝見したのですが、2024年4月時点で `@quasar/vite-plugin` のインストールは不要だったので書き留めておきます。

## やること

### 環境

* node 20.12.0
* pnpm 8.15.5
* vue 3.4.21
* nuxt 3.11.1
* quasar 2.15.2
* @quasar/extras 1.16.11
* nuxt-quasar-ui 2.0.8
* sass 1.72.0

### 環境のセットアップ

セットアップ済みの方は飛ばしてください。

```
pnpm dlx nuxi@latest init sample-project
cd sample-project
pnpm add quasar @quasar/extras
pnpm add -D nuxt-quasar-ui sass
```

`nuxt.config.ts` の `modules` セクションに `nuxt-quasar-ui` を追加します。

```ts
export default defineNuxtConfig({
  /* 既存の設定に加えて以下を追加 */
  modules: [
    'nuxt-quasar-ui'
  ],
  quasar: { /* */ }
})
```

まずは動くことを確認します。  
`components/MyCard.vue` を作成します。

```vue
<template>
  <q-card class="my-card">
    <img src="https://cdn.quasar.dev/img/mountains.jpg">

    <q-card-section>
      <div class="text-h6">Our Changing Planet</div>
      <div class="text-subtitle2">by John Doe</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      {{ lorem }}
    </q-card-section>
  </q-card>
</template>

<script setup lsng="ts">
const lorem = ref("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.");
</script>

<style lang="sass" scoped>
.my-card
  width: 100%
  max-width: 250px
</style>
```

`app.vue` に作成したコンポーネントを挿入します。

```vue
<script setup lang="ts">
import MyCard from './components/MyCard.vue';
</script>

<template>
  <div>
    <h1>ニュースサイト</h1>
    <h2>最新の記事</h2>
    <div class="q-pa-md row items-start q-gutter-md">
      <MyCard />
      <MyCard />
      <MyCard />
      <MyCard />
      <MyCard />
      <MyCard />
      <MyCard />
      <MyCard />
    </div>
  </div>
</template>
```

無事表示されました。  
ただ、h1 や h2 のデフォルトのフォントサイズは大きすぎませんか？ Quasar ではデフォルトで定義されている Sass の変数を上書きすることができますので試してみましょう。

![preview](/images/posts/2024/04/nuxt_quasar_01.png)

### Sass 変数を書き換える

先ほど修正した `nuxt.config.ts` の `quasar` セクションに `sassVariables` という項目があるので、ここに Sass ファイルへのパスを渡してあげれば良さそうです。

好きなパスに好きな名前でファイルを作ります。ここではプロジェクトルートに `quasar.variables.sass` を置いて、h1 から h6 のデフォルト値を上書きします（実際には h5 と h6 は元のままですが）。元の h1 は 6rem もあったみたいで、そりゃ大きいはずだ。

```sass
$h1:        (size: 2.5rem,  line-height: 2.7rem, letter-spacing: -.01562em, weight: 300) !default
$h2:        (size: 2.25rem, line-height: 2.4rem, letter-spacing: -.00833em, weight: 300) !default
$h3:        (size: 2rem,    line-height: 2.2rem, letter-spacing: normal,    weight: 400) !default
$h4:        (size: 1.75rem, line-height: 2rem,   letter-spacing: .00735em,  weight: 400) !default
$h5:        (size: 1.5rem,  line-height: 2rem,   letter-spacing: normal,    weight: 400) !default
$h6:        (size: 1.25rem, line-height: 2rem,   letter-spacing: .0125em,   weight: 500) !default
```

`nuxt.config.ts` を直します。

```ts
export default defineNuxtConfig({
  modules: [
    'nuxt-quasar-ui'
  ],
  quasar: {
    /* これを追加 */
    sassVariables: './quasar.variables.sass'
  }
})
```

程よい大きさになりました。

![preview](/images/posts/2024/04/nuxt_quasar_02.png)

他にも [Quasar · Nuxt Modules](https://nuxt.com/modules/quasar) のページを覗いてみると発見があるかもしれません。ではでは。

## 参考文献

* [Quasar · Nuxt Modules](https://nuxt.com/modules/quasar)
* [Sass/SCSS Variables | Quasar Framework](https://quasar.dev/style/sass-scss-variables/)
* [Nuxt 3 + Quasarで、Sass Variablesが使えない問題を解消した](https://zenn.dev/yoonchulkoh/articles/16cb0e7ee2e5af)
