---
title: "git-credential-cacheをコンテナから使いたかった"
date: "2024-01-11"
tags: ["Docker", "コンテナ", "git"]
---

git でリモートサーバーに HTTPS で接続する時、ユーザー名やパスワードを入力する必要がありますが、push や pull のたびに入力するのは面倒ですよね。git には標準で認証情報を管理してくれる仕組みがあり、毎回の入力を省略することができます。

Windows や Mac の場合は OS の認証情報管理の仕組みと連携することができますが、Linux では `store` モードか `cache` モードしかありません。`store` モードでは平文でパスワードが書き込まれてしまい安全ではないので、今回は `cache` モードを使い、保存された認証情報をコンテナからも使えるようにしたいと思います。

## 結論

できますが現実的に役に立たないです。。

git-credential-cache のソケットがあるディレクトリをマウントしてやることでホストと認証情報を共有できますが、コンテナ側で最初にパスワードが保存された（デーモンが起動した）場合には、コンテナの終了とともにプロセスが消えてしまうので認証情報が使えなくなります。

そのため、コンテナ起動前に一度ホスト側で clone なり pull なりする必要があり、あまり役に立たないです。`git credential-cache` コマンドで手動で開始できないかと思いましたが、`exit` 以外の action が使われることは想定されていなそうなので諦めました。😇

```dockerfile
FROM bitnami/git:2.43.0-debian-11-r5

ARG USERNAME=sogo
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
 && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

USER $USERNAME

RUN git config --global credential.helper 'cache --timeout=3600'

WORKDIR /home/$USERNAME
ENTRYPOINT ["/bin/bash"]
```

```shell
$ docker build -t testgit .
...
$ git config --global credential.helper 'cache --timeout=3600'
$ git clone https://github.com/SogoKato/himitsu-no-project.git
Cloning into 'himitsu-no-project'...
Username for 'https://github.com': SogoKato
Password for 'https://SogoKato@github.com':
remote: Enumerating objects: 387, done.
remote: Counting objects: 100% (387/387), done.
remote: Compressing objects: 100% (223/223), done.
remote: Total 387 (delta 127), reused 359 (delta 102), pack-reused 0
Receiving objects: 100% (387/387), 211.18 KiB | 6.40 MiB/s, done.
Resolving deltas: 100% (127/127), done.
$ ls -al ~/.cache/git/credential/
total 8
drwx------ 2 sogo sogo 4096 Jan 11 23:22 .
drwxrwxr-x 3 sogo sogo 4096 Jan 11 23:22 ..
srwxrwxr-x 1 sogo sogo    0 Jan 11 23:22 socket
$ docker run -it --rm -v ${HOME}/.cache/git/credential:/home/sogo/.cache/git/credential testgit
sogo@1782fc44537c:~$ git clone https://github.com/SogoKato/himitsu-no-project.git
Cloning into 'himitsu-no-project'...
remote: Enumerating objects: 387, done.
remote: Counting objects: 100% (387/387), done.
remote: Compressing objects: 100% (223/223), done.
remote: Total 387 (delta 127), reused 359 (delta 102), pack-reused 0
Receiving objects: 100% (387/387), 211.18 KiB | 8.12 MiB/s, done.
Resolving deltas: 100% (127/127), done.
```

## 参考文献

* [Git - 認証情報の保存](https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%81%95%E3%81%BE%E3%81%96%E3%81%BE%E3%81%AA%E3%83%84%E3%83%BC%E3%83%AB-%E8%AA%8D%E8%A8%BC%E6%83%85%E5%A0%B1%E3%81%AE%E4%BF%9D%E5%AD%98)
* [Git - git-credential-cache Documentation](https://git-scm.com/docs/git-credential-cache)
