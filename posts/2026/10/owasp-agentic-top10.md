---
title: "OWASP Agentic Top 10の対策を、ツールと設定例で具体的に考える"
date: "2026-10-23"
tags: ["セキュリティ", "MCP", "認証/認可"]
---

[OWASP Top 10 for Agentic Applications for 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) を読むと、10項目それぞれのリスクには納得できます。ただ、じゃあ具体的にどうすればいいのかとなると、よく分かりませんでした。どのツールを使ってどう実現するのかまで書いた記事も多くありません。

そこで、10項目それぞれについてどんな脅威なのかを簡単に説明したうえで、どんなソフトウェアでどう対策できそうかを、イメージできるように具体的に考えてみました。完全に防げる項目はほとんどないので、多くは乗っ取られたときの被害範囲を狭くする対策になります。

机上調査レベルの情報が多く含まれている点はあらかじめご留意ください。設定例は公式ドキュメントを元にしていて、agentgateway の設定は v1.6.0 をローカルで動かして確かめました。agentgateway は [AGNTCon + MCPCon Japanに参加しました（1日目）](/posts/2026/09/agntcon-mcpcon-day1) のワークショップで少し触りましたので興味あればそちらもどうぞ。

![OWASP Agentic Top 10 の全体図。Inputs、Integration/Processing、Outputs の3つの領域に、ASI01〜ASI10 がそれぞれ配置されている](/images/posts/2026/10/owasp_agentic_01.png)

出典: [OWASP Top 10 for Agentic Applications for 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) p.8（OWASP Gen AI Security Project - Agentic Security Initiative、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)）

## ASI01 乗っ取られる前提で被害を絞る

Agent Goal Hijack は、エージェントが読むメールやドキュメント、Web ページに指示を隠しておき、エージェントの目的をすり替える攻撃です。Microsoft 365 Copilot では、細工したメールを読ませるだけでデータが持ち出された事例（EchoLeak）があります。

文面から攻撃を見分けるのは難しく、乗っ取り自体を確実に防ぐ方法はありません。なので、メインの対策は ASI02 で後述するような、データの持ち出しや破壊的な操作を防ぐ制限をかけることになります。

そのうえで、外部からの入力を前提にした補助策として、次のようなものが考えられます。どれも効果はあると思いますが、いずれも完全ではありません。

* 正規表現や機械学習の分類モデルを使った検知
  * 正規表現は言い換えや多言語ですり抜けられる。分類モデルも確率的な判定なので保証にはならない
* 外部のコンテンツを読み込んだかどうかのフラグ管理と、それに応じた制限
* 人間の承認
  * 承認が増えすぎると、中身を見ずに承認するようになる（ASI09 で後述）

フラグ管理は、外部のコンテンツを読み込んだセッションにフラグを立て、その後の外に出ていく操作を止めたり、承認を求めたりするものです。外部のコンテンツを目印にするのは、プロンプトインジェクションは外部のコンテンツから混入することが多いと考えられるからです（ユーザーの入力から混入することもあり得ますが…）。Meta の [Agents Rule of Two](https://ai.meta.com/blog/practical-ai-agent-security/) も、1つのセッションで「信頼できない入力を処理する」「機密なシステムやデータにアクセスする」「状態を変える、外と通信する」の3つを揃えない、という同じ方向の考え方です。

Claude Code なら、[Hooks](https://code.claude.com/docs/en/hooks) でこの仕組みを作れそうです。  
`WebFetch` や `WebSearch` の実行後に動く `PostToolUse` のフックで、セッション ID ごとにフラグを記録しておきます。`Bash` の実行前に動く `PreToolUse` のフックでは、そのセッションにフラグがあれば `permissionDecision` に `ask` を返して、人間に確認を求めます。

ただ、普通の作業でもたいていのセッションは何かしら外部のものを読むので、フラグは立ちっぱなしになりがちです。また、リポジトリ内のファイルや MCP ツールの結果に仕込まれた指示ではフラグが立ちませんし、`WebFetch` の URL や MCP ツールのように、`Bash` 以外の出口も残ります。

## ASI02 許可されたツールの使い方まで絞る

Tool Misuse and Exploitation は、正規のツールを危険な使い方で使わせる攻撃です。OWASP は、許可された権限の中であっても、データの削除、コストのかかる API の過剰な呼び出し、情報の流出を引き起こすケースをここに含めています。

権限があるかどうかだけでは止まらないので、どこまで、どのくらい使えるかを決めます。

* エージェントに見せるツールを必要なものだけにする
* 引数を絞る（送信先は社内ドメインだけ、など）
* エグレスを許可リストにして、知らない宛先には出さない
* 呼び出し回数とコストに上限をかける
* 削除のような操作は、エージェントの権限から外すか、人間の承認を挟む

agentgateway なら、ツール、引数、呼び出し回数の制限を、MCP の通信を中継しながら CEL のルールで書けます。

```yaml:config.yaml
gateways:
  default:
    port: 3000
routes:
- policies:
    # 呼べるツールを絞る。許可されていないツールは tools/list にも出ない
    mcpAuthorization:
      rules:
      - 'mcp.tool.name in ["search", "send_email"]'
    # 引数を見て判定する。評価エラーのときも拒否されるよう require で書く
    authorization:
      rules:
      - require: 'mcp.methodName != "tools/call" || mcp.tool.name != "send_email" || mcp.tool.arguments.to.endsWith("@example.com")'
    # 1分あたり10回まで
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 10
      fillInterval: 60s
      type: requests
  backends:
  - mcp:
      targets:
      - name: tools
        stdio:
          cmd: npx
          args: ["-y", "some-mcp-server@1.2.3"]
```

[`mcpAuthorization`](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/mcp-authz/) からは引数が見えませんが、ルートの [`authorization`](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/http-authz/) からは `mcp.tool.arguments` で見えます。

実際に、MCP のテスト用サーバー（server-everything）の `echo` ツールで試しました。  
たくさん用意されているツールのうち `echo` ツールだけを許可し、引数に `secret` を含む呼び出しを拒否するルールです。[試した設定ファイル](/assets/posts/2026/10/agentgateway-config.yaml)は、記事の例とは書き方が違う簡易方式で、UI から試すための CORS の設定も入っています。

![agentgateway の UI の MCP Playground。ツールの一覧には許可した echo だけが表示され、thisismysecret を引数にして呼び出すと authorization failed で拒否されている](/images/posts/2026/10/owasp_agentic_02.png)

右側の Result は、最初にツールの一覧を取得したときの結果で、`echo` ツールだけが返ってきたことが分かります。上の authorization failed は Call tool を押したときのものです。画面には 403 と出ていませんが、agentgateway 側には次のように 403 のログが残っています（一部を省略しています）。

```text
error request http.method=POST http.path=/mcp http.status=403
  protocol=http error="authorization failed" reason=Authorization
```

ただし、agentgateway が見えるのは MCP の通信だけです。  
Claude Code の `Bash` やファイル操作のように GW を通らないローカルのツールには、Microsoft の [Agent Governance Toolkit](https://github.com/microsoft/agent-governance-toolkit)（2026年10月時点で Public preview）のような、エージェントのプロセス内で動くミドルウェアが役に立ちそうです。

AWS のように、ツールの先にあるサービスの権限で止めることもできます。Amazon Q Developer の件では、混入したプロンプトがファイルやクラウドのリソースを消させようとしていました[^amazonq]。エージェント用の IAM ロールに削除系の操作の `Deny` を付けておけば、何を言われても実行できません。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": ["s3:DeleteBucket", "s3:DeleteObject", "ec2:TerminateInstances"],
      "Resource": "*"
    }
  ]
}
```

## ASI03 権限を狭く短くする

Identity and Privilege Abuse は、エージェントが人間から借りた資格情報や、権限の広い長期のトークンで動いているせいで、乗っ取られたときの被害が広がる問題です。GitHub MCP の事例では、公開リポジトリの Issue に仕込んだ指示でエージェントが乗っ取られ、プライベートリポジトリの中身が持ち出されました。エージェントの権限がプライベートリポジトリまで届いていたので、被害がそこまで広がりました[^githubmcp]。

* エージェントごとに ID を分け、必要な範囲だけの権限を持たせる
* トークンの期限を短くする

エージェント用のアイデンティティはまだ普及途上という印象ですが、最近はたいていのサービスにトークンのスコープや期限を絞る機能があると思うので、今あるもので狭く短くはできます。

GW を使うなら、エージェントには資格情報を持たせず、GW でトークン交換するやり方もあります。agentgateway の [RFC 8693 のトークン交換](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/backend-authn/token-exchange/standard/) は、受け取ったユーザーのトークンを、バックエンドごとに audience を絞ったトークンに交換してから転送します。ドキュメントでは Keycloak を IdP にした例が載っています。

![エージェント、agentgateway、IdP（Keycloak）、バックエンドの4者のシーケンス図。エージェントがユーザーのトークンでリクエストを送ると、agentgateway が IdP にトークン交換を依頼し、バックエンド用に audience を絞ったトークンを受け取って、そのトークンでバックエンドにリクエストを転送する](//www.plantuml.com/plantuml/png/TP91Im915CVlyoa6ptaAeZg45IJH9RfuMOXf7SIqMT7PmkFC52a9HGGTWl8G9WP9I56nt-RLsislq9jLCjUyxB9l_k__-x-tawf8LfR-GP6Ky9rtyoKc94s0ReC9GB-1VW3J0rDBK5QXgpakvAIIsLAEINx4gf4cdPaKR6Qt1q5jYrVTeiSAWw0UgR0Q8veBC0PqDq8ZSQXROsw1YomX4PecLz1_cOBfZ9Jw7RCv0WbWMb7aL_jKJrYEFhjeXb2IpjXcnDhkyT7dntruVeFjEnlhT75XQHwrZgZuU_lSbRlIGxXjc6dj2EPdyroutChY8n3aqUHlwFXn_wezPOTHq962QaphGJtsNsv1rq4tGBL07OC-6mytsjN_wnaE2keQr5ryDqHuabFla9U7VtZkZzNKHG3LdJN9T-yqR0QXEVbgFeE-31lAmbG7Wv8KsjbhzWC0)

```yaml
backends:
- host: localhost:18080
  policies:
    backendAuth:
      oauthTokenExchange:
        host: localhost:7080
        path: /realms/backend-oauth/protocol/openid-connect/token
        clientAuth:
          clientId: requester-client
          clientSecret: requester-secret
          method: clientSecretBasic
        audiences:
        - target-client
```

## ASI04 部品の版を固定する

Agentic Supply Chain Vulnerabilities は、エージェントを構成するフレームワーク、MCP サーバー、プロンプトなどの部品に問題が入り込むリスクです。mcp-remote には CVSS 9.6 のコマンドインジェクション（CVE-2025-6514）がありました[^mcpremote]。

基本的には、これまでのサプライチェーン攻撃の対策がそのまま有効そうです。ただ、コーディングエージェントは作業の途中で自分で `npm install` を実行したり、MCP サーバーを追加したりするので、人間が確認してから依存を入れるという前提が崩れます。OWASP も、改ざんされた npm パッケージ（nx や debug）をコーディングエージェントが自動でインストールし、SSH 鍵や API トークンが持ち出されたシナリオを挙げています。

* 使える MCP サーバーの一覧は人間が管理し、エージェントに勝手に追加させない
* MCP サーバーの版を固定する。`npx -y some-mcp-server` のように毎回最新を取ってくる起動はしない
* 公開されたばかりの版は入れない
  * pnpm なら [`minimumReleaseAge`](https://pnpm.io/settings/dependency-resolution) で設定できる。設定ファイルに書くので、エージェントが自分で実行したインストールにも同じ制限がかかる

MCP サーバーの一覧は、Claude Code なら[管理者向けの設定](https://code.claude.com/docs/en/managed-mcp)で絞れます。`managed-mcp.json` を置くと、そこに書いたサーバーしか使えなくなり、ユーザーもエージェントも追加できません。`allowedMcpServers` と `allowManagedMcpServersOnly: true` を組み合わせて、承認したサーバーだけを許可するカタログのような運用もできます。

agentgateway を使う場合は、接続先の MCP サーバーを GW の設定の `targets` に書くので、エージェントは GW に登録されたサーバーにしかつなげません。ただし、エージェントが GW を通らずに外へ出られないよう、エグレスの制限とセットにする必要があります。侵害された MCP サーバーが見つかったときも、GW の設定から外せば全エージェントから一斉に使えなくなります。

一覧に入れた MCP サーバーが後から中身を変えるケースには、ツール定義のハッシュを記録しておき、変化を検知する方法があります（Agent Governance Toolkit の [MCP Security Gateway](https://github.com/microsoft/agent-governance-toolkit/blob/main/docs/specs/MCP-SECURITY-GATEWAY-1.0.md) など）。

## ASI05 コードは隔離して実行する

Unexpected Code Execution は、エージェントが生成したコードや、信頼できない文字列が、想定の外で実行されてしまうリスクです。

* コードは隔離した環境で実行する
* 実行環境に秘密情報を置かない。ネットワークは原則なしにする

gVisor の `runsc` を [Docker のランタイムとして入れておけば](https://gvisor.dev/docs/user_guide/quick_start/docker/)、`--runtime=runsc` を付けるだけで、ホストのカーネルから隔離されたコンテナで実行できます。

## ASI06 エージェントが書ける場所を分ける

Memory and Context Poisoning は、セッションの文脈や RAG のインデックス、長期メモリに嘘や悪意ある情報を仕込み、後の振る舞いを操る攻撃です。Gemini では、文書に隠した指示で偽の長期メモリを書き込ませ、後の会話でもその偽の情報に基づいて答えさせた事例があります[^gemini]。

* RAG に取り込むデータは、信頼できるソースからだけにする
* エージェントが動的に書ける範囲（メモリ）と、人間が管理する知識を分ける
* メモリに書く前に人間の確認を挟む。何が書かれたかを後から見て消せるようにする

この項目に効果のあるソフトウェアは、今回は見つけられませんでした。メモリの管理は各エージェントアプリケーションの中核だと思うので、それぞれが独自に実装する形になりそうです。

## ASI07 外部のエージェントを GW で確認する

Insecure Inter-Agent Communication は、エージェント同士のメッセージに認証や完全性の確認がないせいで、なりすまし、改ざん、リプレイができてしまう問題です。

同じプロセスで動く同じコードベースのエージェント同士なら、メッセージはネットワークを通らないので、この脅威はほとんど当てはまりません。重きを置くのは A2A でつなぐ外部のエージェントで、ここは GW が得意なところです。

* 相手のエージェントを認証し、つないでよい相手を許可リストにする
* 通信は TLS にする

agentgateway は [A2A の通信も中継できます](https://agentgateway.dev/docs/standalone/latest/documentation/agent/a2a/)。相手の認証や許可リストも、MCP と同じように JWT と CEL のルールで書けます。MCP サーバーと同様に、A2A でつなぐ相手も GW で一括管理するのが望ましいと思います。

## ASI08 連鎖を途中で止める

Cascading Failures は、1つの誤りや侵害が、つながったエージェントやワークフローに伝わって増幅する問題です。OWASP は、最初の欠陥そのものは ASI04 や ASI06 などに分類し、それが広がったときに ASI08 として扱う、と区別しています。

原因を防ぐ項目ではないので、広がりを途中で止める対策が中心になります。

* 回数、コスト、時間に上限をかける
* 本番の資格情報を持たせない。エージェントが消せない場所にバックアップを置く
* 影響の大きい操作の前に、人間かポリシーのチェックを挟む

GW の側では、ASI02 の `localRateLimit` で呼び出し回数に、`timeout` でリクエストの時間に上限をかけられます。`localRateLimit` は LLM の通信ならトークン数にも上限をかけられるので、コストの上限としても使えます。

```yaml
policies:
  timeout:
    requestTimeout: 30s
```

エージェントの側では、ASI02 で触れた Agent Governance Toolkit に [Agent SRE](https://github.com/microsoft/agent-governance-toolkit/tree/main/agent-governance-python/agent-sre) というパッケージがあります。サーキットブレーカー、タスクごとのコストの上限、キルスイッチなどを持っていて、README でも ASI08 の対策として挙げられています。

## ASI09 承認を人間だけに頼らない

Human-Agent Trust Exploitation は、人間がエージェントを信頼していることを逆手に取り、危険な操作を承認させたり、資格情報を聞き出したりする問題です。

難しい項目です。人間に全部見せても判断しきれないので、最近は専門のエージェントに判断させる方向になっていると思います。Anthropic の [auto mode の解説記事](https://www.anthropic.com/engineering/claude-code-auto-mode) では、ユーザーが承認プロンプトの93%をそのまま承認していたとして、人間の代わりに分類器が操作を判定する auto mode を作っています。

* 人間に見せるのは、エージェントの要約ではなく実際の diff やコマンドにする
* 判定役は、エージェントの説明文に説得されないようにする

auto mode の分類器は、ユーザーのメッセージとツール呼び出しだけを見て、エージェント自身の説明文やツールの出力は見ません。OWASP も「モデルが生成した理由付けではなく、平易なリスクの要約を見せる」としていて、同じ考え方だと思います。

[権限モードのドキュメント](https://code.claude.com/docs/en/permission-modes) によると、Claude Code v2.1.283 以降は、ターミナルと VS Code のセッションが auto mode で始まります。対応していないモデルを使っているときなどは、従来の Manual mode になります。

ただし auto mode も安全を保証するものではないと、ドキュメント自身が書いています。Anthropic の記事の数字でも、ユーザーの依頼を超えた操作の17%は見逃しています。

## ASI10 いつでも止められるようにする

Rogue Agents は、侵害や目的のずれによって、エージェントが見た目は正規のままポリシーの外で動き続ける問題です。

* トークンの期限を短くする。止めたいときは資格情報を失効させる
* 動いているエージェントを把握する。サブエージェントを勝手に作らせない
* 監査ログで、普段と違う宛先や呼び出し量の急増を見る

ASI03 のトークン交換で期限の短いトークンを使っていれば、IdP 側でエージェントを無効にするだけで、次の交換からバックエンドに届かなくなるはずです。

## ログを取る

ここまで見てきたとおり、どの項目も完全には防げません。後から何が起きたかを追えるように、ログはちゃんと取るようにしたいです。

agentgateway の [アクセスログ](https://agentgateway.dev/docs/standalone/latest/documentation/observability/access-logs/) では、どのツールがどの引数で、誰に呼ばれたかを残せます。

```yaml
frontendPolicies:
  accessLog:
    add:
      tool: 'mcp.tool.name'
      tool_args: 'mcp.tool.arguments'
      user: 'jwt.sub'
```

ただし GW で残せるのは、GW を通った通信だけです。ローカルで完結するコマンドの実行やファイルの編集、同じプロセス内のサブエージェントとのやり取りは残りません。エージェントの中で起きたことは、フレームワークから OpenTelemetry（OTel）で送るのが良さそうです。

* Claude Code: `CLAUDE_CODE_ENABLE_TELEMETRY=1` で、[メトリクスとイベントを OTLP で送れる](https://code.claude.com/docs/en/monitoring-usage)。トレースはベータ。Bash のコマンドやツールの引数は既定では伏せられていて、`OTEL_LOG_TOOL_DETAILS=1` で含められる
* Strands Agents: `StrandsTelemetry().setup_otlp_exporter()` で、エージェント、モデル呼び出し、ツール実行の[スパンを送れる](https://strandsagents.com/latest/documentation/docs/user-guide/observability-evaluation/traces/)
* Microsoft Agent Framework: Python なら `configure_otel_providers()` で、`OTEL_EXPORTER_OTLP_*` の環境変数を読んで [OTel で送れる](https://learn.microsoft.com/agent-framework/agents/observability)

```sh
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_LOG_TOOL_DETAILS=1
```

Strands と Microsoft Agent Framework のトレースは、OTel の GenAI のセマンティック規約（`gen_ai.*` の属性）に沿っています。ただ、エージェント向けの規約はまだ Development の段階なので、フレームワークをまたいで属性名が揃うとは限らないです。

ログはエージェントが触れない場所に置く必要があります。OWASP の ASI08 のシナリオには、盗まれた資格情報で動くエージェントがログを消して、何もなかったように報告するものがあります。

## おわりに

軽い気持ちで OWASP Top 10 for Agentic Applications for 2026 について考え方を整理しようと思って始めましたが、結構骨のある作業でした。どなたかの参考になれば幸いです。

[^amazonq]: [Hacker inserts destructive code in Amazon Q tool as update goes live](https://www.csoonline.com/article/4027963/hacker-inserts-destructive-code-in-amazon-q-as-update-goes-live.html)
[^githubmcp]: [GitHub MCP Exploited: Accessing private repositories via MCP](https://invariantlabs.ai/blog/mcp-github-vulnerability)
[^mcpremote]: [Critical RCE Vulnerability in mcp-remote: CVE-2025-6514 Threatens LLM Clients](https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/)
[^gemini]: [New hack uses prompt injection to corrupt Gemini’s long-term memory](https://arstechnica.com/security/2025/02/new-hack-uses-prompt-injection-to-corrupt-geminis-long-term-memory/)
