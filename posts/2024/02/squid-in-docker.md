---
title: "SquidをDockerで動かす"
date: "2024-02-06"
tags: ["Squid", "Docker"]
---

Squid を Docker コンテナで実行したかったのですが、2024年2月現在で最新の v6 で起動するものがなさそうだったので作りました。apt リポジトリにはビルド済みの squid がないのですが、alpine にはあったので alpine を使うと楽です。また、シャットダウン時の挙動に要注意。

## できたもの

* [SogoKato/docker-squid](https://github.com/SogoKato/docker-squid)
* [noroch/squid - Docker Image | Docker Hub](https://hub.docker.com/r/noroch/squid)

[sameersbn/docker-squid](https://github.com/sameersbn/docker-squid) からフォークさせてもらいました。原作者の方に感謝申し上げます。

こんな感じで動きます。

```
docker run --name squid -d --restart=always \
  --publish 3128:3128 \
  --volume /srv/docker/squid/cache:/var/spool/squid \
  noroch/squid:6.6
```

`squid.conf` を入れ込みたいときは bind マウントで渡します。

```
docker run --name squid -d --restart=always \
  --publish 3128:3128 \
  --volume /path/to/squid.conf:/etc/squid/squid.conf \
  --volume /srv/docker/squid/cache:/var/spool/squid \
  noroch/squid:6.6
```

## シャットダウン時の挙動について

Squid のデフォルトの設定では `shutdown_lifetime` の値が `30 seconds` になっています。[^1]

[^1]: http://www.squid-cache.org/Doc/config/shutdown_lifetime/

しかしながら、何らかの問題が発生した場合や手動で停止（stop）や再起動（restart）をかける場合に、Docker がコンテナに SIGTERM を送ってから SIGKILL を送るまでの graceful shutdown の時間はデフォルトで10秒です。

そのためデフォルトの設定値では Squid が未処理のリクエストを待機している間に SIGKILL によってプロセスが強制停止されます。正常に終了されないことによって Squid の PID ファイルが残ってしまうので、次回の起動時に Squid プロセスを開始できない問題が発生することになります。

Docker デーモンのログ（journalctl）

```
Feb 06 00:00:00 xxxxxxxx dockerd[814]: time="2024-02-06T00:00:00.000000000+09:00" level=info msg="Container failed to exit within 10s of signal 15 - using the force" container=b806a87b780c8b11ecd5057b666a44c1c1dea1d99a519258df20a6e14b735b1c
```

Squid 再起動時のログ

```
2024/02/06 00:00:00| FATAL: Squid is already running: Found fresh instance PID file (/var/run/squid.pid) with PID 1
    exception location: Instance.cc(122) ThrowIfAlreadyRunningWith
```

`shutdown_lifetime` を5秒などの十分に短い値に設定するか、Docker 側の設定を直す、もしくは Squid の PID ファイルを作らない設定 [^2] にするといった対策が考えられます（`shutdown_lifetime 5 seconds` で直ることは検証済み）。

[^2]: http://www.squid-cache.org/Doc/config/pid_filename/

## 参考文献

* [sameersbn/docker-squid: Dockerfile to create a Docker container image for Squid proxy server](https://github.com/sameersbn/docker-squid)
