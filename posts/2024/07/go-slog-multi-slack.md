---
title: "Goのslogで複数の出力先にロギングする（標準出力+Slack）"
date: "2024-07-01"
tags: ["Go", "ログ"]
---

Go 1.21 から使えるようになった標準の構造化ログライブラリ [slog](https://pkg.go.dev/log/slog) を使ってロギングをうまくやろうと画策してみました。

## やること

* 標準出力と Slack にログを送る
  * 標準出力には全部のログ
  * Slack には指定したログのみを送る

![uml](//www.plantuml.com/plantuml/png/SoWkIImgAStDuTBmoKzFJotILD3LjLFG22v9oIyjqLImKd1Bp0EoqAI3W4903a8QBgARab-U1pOX9p4v6wJ2CqqXDx4aEICrXSiXDIy5P1S0)

今回は送信先として Slack を使用していますが、samber 氏が Fluentd や Kafka 等様々なライブラリを公開してくれているので、用途に合わせて見てみると良いと思います。

## 環境

* Go 1.22.4
* [samber/slog-multi](https://github.com/samber/slog-multi) 1.1.0
* [samber/slog-slack](https://github.com/samber/slog-slack) 2.6.0

Slack の incoming webhook の URL を取得しておいてください。

## やったこと

```go
package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	slogmulti "github.com/samber/slog-multi"
	slogslack "github.com/samber/slog-slack/v2"
)

const (
	NotifyToKey = "notify_to"
	GracePeriod = 2 * time.Second
)

func main() {
	webhook, ok := os.LookupEnv("SLACK_WEBHOOK_URL")
	if !ok {
		os.Exit(1)
	}

	logger := slog.New(
		// slog-multi の Fanout でログを複製する
		slogmulti.Fanout(
			// 標準出力のハンドラ
			slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{}),
			// ルーティングするハンドラ
			// slog-multi の Router の機能を使って Slack に送る条件を設定する
			slogmulti.Router().
				Add(
					slogslack.Option{WebhookURL: webhook, ReplaceAttr: replaceAttrSlack}.NewSlackHandler(),
					recordMatchNotifyTo("slack"),
				).
				Handler(),
		),
	)

	logger = logger.With(slog.String("environment", "test"))

	// 標準出力にのみ出すログ
	logger.Info("Logger initialized.")

	// 標準出力と Slack に出すログ
	logger.Info("Hello world!", slog.String(NotifyToKey, "slack"))

	// 以下は動かない
	// recordMatchNotifyTo() の slog.Record.Attrs() で
	// 各属性をループして notify_to 属性をチェックする際に見るのは
	// logger.Info() や logger.Error() といったメソッドに渡された属性のみ
	//
	// logger.With(NotifyToKey, "slack").Info("Hello world!")

	// goroutine が完了する前にプログラムが終了するのを防ぐ
	// see https://github.com/samber/slog-slack/issues/4
	time.Sleep(GracePeriod)
}

func recordMatchNotifyTo(target string) func(ctx context.Context, r slog.Record) bool {
	return func(ctx context.Context, r slog.Record) bool {
		ok := false

		r.Attrs(func(attr slog.Attr) bool {
			if attr.Key == NotifyToKey && attr.Value.Kind() == slog.KindString && strings.Contains(strings.ToLower(attr.Value.String()), strings.ToLower(target)) {
				ok = true
				return false
			}

			return true
		})

		return ok
	}
}

func replaceAttrSlack(groups []string, a slog.Attr) slog.Attr {
	// notify_to は Slack のメッセージでは見せたくないので落とす
	if a.Key == NotifyToKey {
		return slog.Attr{}
	}
	return a
}
```

結果

```
% go run main.go
time=2024-07-01T23:49:30.011+09:00 level=INFO msg="Logger initialized." environment=test
time=2024-07-01T23:49:30.012+09:00 level=INFO msg="Hello world!" environment=test notify_to=slack
```

![Hello world! environment=test](/images/posts/2024/07/incoming_webhook.png)

## 参考文献

* [example/slog-handler-guide/README.md at master · golang/example](https://github.com/golang/example/blob/master/slog-handler-guide/README.md)
* [samber/slog-multi](https://github.com/samber/slog-multi) 1.1.0
* [samber/slog-slack](https://github.com/samber/slog-slack) 2.6.0
