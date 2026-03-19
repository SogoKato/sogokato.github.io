---
title: "Codex Meetup Tokyo #1に参加しました"
date: "2026-03-19"
tags: ["コーディング", "Codex"]
---

[Codex Meetup Tokyo #1](https://aiau.connpass.com/event/384679/) に参加してきました。私自身は仕事で GitHub Copilot や Roo Code を使うことが多いので、Codex の話を聞けるのは新鮮でした。去年一瞬だけ ChatGPT Plus 課金してて使ってたけど、2026年になってからはコミットの勢いが段違いみたいなので全然様相が違うのかも、と思ったりしました。

以下拙いですが私のメモです。

## Codex の最新アップデートを全部キャッチアップする

<script async class="docswell-embed" src="https://www.docswell.com/assets/libs/docswell-embed/docswell-embed.min.js" data-src="https://www.docswell.com/slide/Z4NQYD/embed" data-aspect="0.5625"></script><div class="docswell-link"><a href="https://www.docswell.com/s/fumiya-kume/Z4NQYD-2026-03-19-195137">Codex の最新アップデートを全部キャッチアップする by @fumiya-kume</a></div>

LLM
* GPT 5.4
* GPT 5.4 mini/nano
* GPT 5.3 Codex spark: Cerebras
  * 128k context window だが、速度が別格で速い
  * 今後 context window が大きくなればかなり期待できる

Codex の種類
* Codex CLI: 登壇者の方のおすすめ
  * Claude Code 相当の機能がキャッチアップされている
  * Skills/Plugin/MCP
* Codex IDE 統合
* Codex app: 最近 Windows 版も出た
* Codex cloud: パソコン閉じてもバックグラウンドで動く

[Subagents](https://developers.openai.com/codex/subagents)
* 旧: Multi agent
* Context window に限りがあるので、複数 agent で分散という考え方
* spawn_agents_on_csv: CSV で sub agents をバッチ実行する機能
* Smart approvals
  * 危険な場合は sub agent がストップしてくれる

お得情報: Rate limit が 2026/4/2 まで期間限定で2倍

## Multi-Agentsを理解しよう

[@akihiro_genai](https://x.com/akihiro_genai) さん

Sub agents はメインのエージェントの context window を最適に管理するための機能

Built-in
* default
* worker
* explorer

同時スレッド数上限: デフォルトで6
ネストの深さ: sub の sub (孫) を作るか

公式情報
* 考え方
  * read-heavy なタスクを任せると良い
  * write-heavy はコンフリクトリスクがある
* 例
  * PR review - 観点ごと
    * セキュリティ
    * コード品質
    * バグ検出
    * 競合状態
    * テスト不安定性
    * 保守性
  * PR review - 役割 + モデルを分離
    * gpt-5.3-codex-spark → pr-explorer (コードの探索)
    * gpt-5.4 → reviewer (正しさ・セキュリティ)
    * gpt-5.4-mini + MCP → docs-researcher

どんな時に起動？

* Skill に「起動しろ」って書くだけでは勝手に動かない
* ユーザーが明示的に呼ぶ仕組みで、Skills とはそのあたりがちがう
* AGENTS.md に書くといい

Codex は他と比べ、機能が少ないが、逆に Codex が採用した機能を追うと学びやすいといえる

## コーディングエージェントのポータビリティについて

[コーディングエージェントのポータビリティについて - Speaker Deck](https://speakerdeck.com/schroneko/coding-agent-portability) by ぬこぬこさん

みんな Codex CLI/Claude Code を併用  
→ `~/.claude` 資産をポータブルにしたい！

どのファイルを管理対象にする？どう管理する？
* 指示ファイル: CLAUDE.md, `.claude/rules/`, AGENTS.md
  * 専用リポジトリを作ってシンボリックリンク
* Skills
  * Vercel の skills ツールがおすすめ
* MCP
  * 管理コストが高いので最低限
    * Chrome DevTools
    * claude.ai

コーディングエージェントにイラつかないためには？
* 万能ではないと受け入れる
* 妹ロールを与える

安心できる Agent skills は？
* 大前提: 100%安心はない
* [skills.sh](https://skills.sh/) に official というのができた

## LT

### Codexを活用したポーティングの現在位置 (Codex100%のスマホアプリをリリースした話)

by GeminiDK さん

* Objective-C → Swift → Kotlin
* 5年前に開発を放棄した iOS アプリを復活
* どうやるか
  * コア部分のアーキテクチャ設計 → 最初にしっかり個別に設計
  * 機能の移植 → 丸投げ
* Firebase Crashlytics 96.3% → 99.8%
* クロスプラットフォーム環境って必要なくなる？
  * Flutter とか

### visionOS 向けの MCP / Skills をつくり続けることで XR の探究と学習を最大化する

[visionOS 開発向けの MCP / Skills をつくり続けることで XR の探究と学習を最大化 - Speaker Deck](https://speakerdeck.com/karad/skills-wotukurisok-kerukotode-xr-notan-jiu-toxue-xi-wozui-da-hua) by kazuhiro hara さん

* Seiro MCP
  * 自分で visionOS アプリ開発用のビルド・エラーまわりの MCP ツールを作った
  * 毎日 Codex + Seiro MCP で実装・思索
* やってみた先でわかったこと
  * 同じエラーようなエラーが何回も起き、解決している
    * 起こるミスに偏りがある
  * visionOS 独特なものとして、「ビジュアルエラー」があり、ランタイムエラー並みに検出が難しい
    * 意図したデザインになってなかったり、表示が微妙なケース
* 自分なりのサイクルを作ろう

### Codexメインで進める仕様駆動開発

[仕様駆動開発で見るCodexの強み - Speaker Deck](https://speakerdeck.com/beagle_dog_inu/shi-yang-qu-dong-kai-fa-dejian-rucodexnoqiang-mi) by びーぐるさん

* 仕様駆動開発は（開発方式というより）流儀
* ツールの話ではない
  * 自己流、Kiro、Spec Kit、cc-sdd
* Codex で SDD をやる強み（経験則）
  * GPT モデルの真面目さ + AGENTS.md
    * 仕様を先に変えてから実装の手順を律儀に踏む
  * Agent skills の発動安定性
    * SDD のワークフローを skill 化 → フェーズごとに自動発動
  * 厳格なレビュー性能
    * SDD では仕様の作り込みが重要
    * レビューが厳しすぎる時も…

(感想) SDD は前に Spec Kit でかじったことありましたが、せっかく仕様を作ってもその通りにやってくれなくて発狂しかけてましたが、あれはモデルの性能のせいもあったのかな…。

### ターミナルオタクが最初に知りたいCodex情報

<script async class="docswell-embed" src="https://www.docswell.com/assets/libs/docswell-embed/docswell-embed.min.js" data-src="https://www.docswell.com/slide/ZJWL93/embed" data-aspect="0.5625"></script><div class="docswell-link"><a href="https://www.docswell.com/s/mozumasu/ZJWL93-2026-03-19-codex-meetup-tokyo-1">ターミナルオタクが最初に知りたいCodex情報 by @mozumasu</a></div>

* キャッチアップどの順番でやる？
  * インストール
  * ショートカットキー
    * Claude に比べ Codex のほうがキーバインドが少ない
    * Stash: ctrl-s とか
    * Undo: Ctrl + _
    * OSS なのでコントリビュートチャンス！
  * 設定ファイル
    * `~/.config` に置けるか？ → 置けない
  * 機能
    * codex_git_commit: コミットメッセージの形式を指定（Co-authored-by とか付けれる）
    * guardian_approval: 承認要求をレビュー

### Codex CLIで（を）ソースコードリーディング！あの機能はどうできている？

[Codex CLIで（を）ソースコードリーディング！](https://ftnext.github.io/2026-slides/codex-meetup-tokyo1/from-source-reading.html#/1) by nikkie さん

* オープンソース
* シンタックスハイライト
  * syntect (Rust のライブラリ)
  * `/theme` で変更可能
* 音声入力
  * 実装？
    * API キー認証なら gpt-4o-mini-transcribe へ
    * ChatGPT アカウント認証なら API へ（その後は追えない）

### GitHub CopilotユーザーでもCodexできる！GitHubが掲げるAgent HQを堪能しよう

<script async class="docswell-embed" src="https://www.docswell.com/assets/libs/docswell-embed/docswell-embed.min.js" data-src="https://www.docswell.com/slide/KY8WED/embed" data-aspect="0.5625"></script><div class="docswell-link"><a href="https://www.docswell.com/s/yuma/KY8WED-2026-03-19-codexmeetup">GitHub CopilotユーザーでもCodexできる！ GitHubが掲げるAgent HQを堪能しよう by @yuma</a></div>

* モデル選択 → GitHub Copilot のハーネス
* Cloud agent で Codex を選択すると Codex のハーネスを利用可能
* VS Code の Codex 拡張機能で Copilot Pro+ があれば使える

(感想) GitHub Copilot ユーザなので気になる話題でした。会社のアカウントで有効になっているか来週見てみよう…。

## 感想

自分も AI コーディングを使わない日はないですが、この場に来ている皆さんは、組織の人もフリーランスの人も、活用の度合いが桁違いで大変刺激になりました。
