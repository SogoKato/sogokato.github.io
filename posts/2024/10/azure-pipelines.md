---
title: "Azure PipelinesのYAMLをGitLab/GitHubと比較しつつ理解してみる"
date: "2024-10-11"
tags: ["Azure", "CI/CD"]
---

Azure DevOps の Azure Pipelines のパイプライン YAML に入門してみます。

## 想定読者

* GitHub Actions や GitLab CI/CD には馴染みがあるけど Azure Pipelines はよく分からん人
* Azure Pipelines の YAML の書き方の雰囲気をつかみたい人

## 公式ドキュメント

まずはここを見ましょう。

[Azure Pipelines の YAML スキーマ リファレンス](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/?view=azure-pipelines)

## 簡単な例

```yaml
trigger: # main または develop ブランチに push されたとき
- main
- develop

stages: # Build -> Test -> Deploy の順に実行される
- stage: Build
  jobs:
  - job: BuildJob
    steps:
    - script: echo Building!
- stage: Test
  jobs: # TestOnWindows と TestOnLinux は並列実行される
  - job: TestOnWindows
    steps:
    - script: echo Testing on Windows!
  - job: TestOnLinux
    steps:
    - script: echo Testing on Linux!
- stage: Deploy
  jobs:
  - job: Deploy
    steps:
    - script: echo Deploying the code!
```

## トリガー

GitHub Actions でいう `on`、GitLab でいう `workflow` で、パイプラインの開始条件を記述します。

* [trigger](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/trigger?view=azure-pipelines)
  * ブランチやファイルのパス、git タグを include/exclude で指定
* [pr](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/pr?view=azure-pipelines)
  * pull request ビルドを実行するブランチやファイルのパスを include/exclude で指定
* [schedules](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/schedules?view=azure-pipelines)
  * cron 表現を指定

## 階層構造

雑に言うと pipeline > stages > jobs > steps の階層構造になっています。

* [pipeline](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/pipeline?view=azure-pipelines)
  * GitHub でいうワークフロー、GitLab でいうパイプライン
* [stages](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/stages?view=azure-pipelines)
  * GitLab でいうステージ（※ GitHub では依存関係を `needs` で指定）
  * GitLab と同様、ステージ内のジョブは並列実行される
* [jobs](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/jobs?view=azure-pipelines)
  * GitHub でいうジョブ
  * GitLab では対応する概念なし（強いて言えば `before_script` `script` `after_script` か）
  * ステージの入れ子にしないでパイプラインに直接書いても OK
* [steps](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/steps?view=azure-pipelines)
  * GitHub でいうジョブのステップ、GitLab でいう `script` の配列の要素
  * GitHub と同様、コマンドだけでなく、事前定義されたタスクを指定できる
  * ステップの1つ目のプロパティには `script` や `checkout`、`task` 等、ステップで何を実行するかを書かないといけない
  * ジョブの入れ子にしないでパイプラインに直接書いても OK

## コンポーネント化

GitHub Actions や [GitLab CI/CD Components](https://docs.gitlab.com/ee/ci/components/) のように、コンポーネント化して再利用できるようにするための Azure Pipelines の機能がタスクです。上述の `steps[].task` に指定して使います。GitHub Actions の `uses` と同じように使えそうです。

* [Azure Pipelines タスク リファレンス | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/tasks/reference/?view=azure-pipelines)
* [タスクの種類と使用方法 - Azure Pipelines | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/process/tasks?view=azure-devops&tabs=yaml)

[ContainerBuild@0](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/tasks/reference/container-build-v0?view=azure-pipelines) を使う例

```yaml
stages:
- stage: Build
  jobs:
  - job: BuildJob
    steps:
    # Container Build v0
    # Container Build Task.
    - task: ContainerBuild@0
      inputs:
        dockerRegistryServiceConnection: # string. Docker registry service connection. 
        repository: # string. Container repository. 
        Dockerfile: 'Dockerfile' # string. Required. Dockerfile. Default: Dockerfile.
        buildContext: '.' # string. Build context. Default: ..
        tags: '$(Build.BuildId)' # string. Tags. Default: $(Build.BuildId).
```

## 感想

* 同じ会社なので、GitHub Actions に結構似てる
  * jobs, steps っていう言葉の使い方とか、出来合いのタスクを使えるところとか
* ステージの概念がある辺りは GitLab ぽい
* ざっと調査した感じでは不足している機能はなさそう

## 参考文献

* [Azure Pipelines の YAML スキーマ リファレンス](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/yaml-schema/?view=azure-pipelines)
* [Azure Pipelines タスク リファレンス | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/tasks/reference/?view=azure-pipelines)
* [タスクの種類と使用方法 - Azure Pipelines | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/process/tasks?view=azure-devops&tabs=yaml)
* [事前定義済み変数 - Azure Pipelines | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml)
* [Azure Pipelines でのトリガー - Azure Pipelines | Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/devops/pipelines/build/triggers?view=azure-devops)
* [CI/CD YAML syntax reference | GitLab](https://docs.gitlab.com/ee/ci/yaml/)
* [GitLab CI/CD から GitHub Actions への移行 - GitHub Docs](https://docs.github.com/ja/actions/migrating-to-github-actions/manually-migrating-to-github-actions/migrating-from-gitlab-cicd-to-github-actions)
