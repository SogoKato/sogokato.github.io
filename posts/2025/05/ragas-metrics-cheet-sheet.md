---
title: "RAGASメトリクスチートシート"
date: "2025-05-09"
tags: ["LLM", "RAG", "監視"]
---

RAG システムの精度を評価するためのフレームワークとして2023年に RAGAS が提案されてから、RAGAS は進化を続けていて2025年5月時点では RAG において8つの指標が定義されています。[^1]

[^1]: 論文に登場する3つの指標のうち Context Relevancy は既に廃止されています。Nvidia metrics の中にある [Context Relevance](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/nvidia_metrics/#context-relevance) は計算方法が異なるため、別物です。

RAGAS を利用するメリットとして、一番大きな点は人間が作った正解のデータ（アノテーション、参照、Ground truth）を必要としない点です。しかしながら、指標の説明を読んでいくと全部の指標が参照を必要としないわけではないと気づいたので、以下の観点からまとめたいと思います。

* アノテーションを必要とするか
  * 人間が作業する必要があるかどうかはメトリックを導入する上で重要
* LLM-based (LLM-as-a-Judge) か、LLM-based ではない従来の手法もサポートされるか
  * どのメトリックも LLM-based な手法で算出できますが、いくつかのメトリクスは Non LLM-based な手法もサポートしています

以下は RAGAS v0.2.15 時点の情報になります。

## 前提：指標の種類

![Metrics mind map](https://docs.ragas.io/en/v0.2.15/_static/imgs/metrics_mindmap.png)

メトリクスはメカニズムに基づいて LLM-based なものと LLM-based ではないものに分けられ、さらにそれぞれについて対象データの種類に基づいて Single turn と Multi turn に分けられます。

LLM-based な指標では、評価するためのプロンプトを用いて LLM を呼び出して算出します。そのため、算出されたスコアは決定論的ではない（同じ入力でも毎回出力が変わるかもしれない）です。しかしながら、人間による評価により近いとも言われています。LLM-based ではない指標では対照的に LLM 呼び出しを行わずに、類似度や BLEU スコアといった従来的な手法に基づいて評価します。

Single turn は1回の質問と回答のセット、Multi turn は複数回の質問と回答のセットです。今回まとめる指標は全て Single turn な指標になります。Multi turn な指標の例は [AgentGoalAccuracy](https://docs.ragas.io/en/v0.2.15/howtos/integrations/llamaindex_agents/) です。ここについてはまだ深く調べていないですが、エージェントでは複数回のやり取りが発生するのでエージェント系の指標を評価する時に使うのだと思います。

## チートシート

取得コンテキストは噛み砕いて言うと RAG の実際の検索結果（top-k 個のチャンク）、参照コンテキストは RAG の正解データとなる検索結果（top-k 個のチャンク）を指します。

| 指標                                                                                                                                                       | クラス名                              | 概要                                                                                                                                                        | 評価に必要な情報（引数）                   | LLM-based?    | アノテーション要否 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------- | ------------------ |
| [Faithfulness (忠実性)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/faithfulness/)                                                 | `Faithfulness`                        | 応答に含まれる主張のうち、取得コンテキストから推測できる主張の割合                                                                                          | 応答、取得コンテキスト                     | LLM-based     | 不要               |
| [Response Relevancy (回答の関連性)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/answer_relevance/) [^2]                            | `ResponseRelevancy`                   | 応答から複数の質問を生成し、ユーザー入力とのコサイン類似度の平均を取る                                                                                      | ユーザー入力、応答                         | LLM-based     | 不要               |
| [Context Precision (コンテキストの精度)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_precision/)                           | `LLMContextPrecisionWithoutReference` | 関連性の高い取得コンテキストがより上位にランク付けされているか（各取得コンテキストが関連性があるかを LLM が応答と比較して判断）                             | ユーザー入力、応答、取得コンテキスト       | LLM-based     | 不要               |
| [Context Precision (コンテキストの精度)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_precision/)                           | `LLMContextPrecisionWithReference`    | 関連性の高い取得コンテキストがより上位にランク付けされているか（各取得コンテキストが関連性があるかを LLM が参照と比較して判断）                             | ユーザー入力、参照、取得コンテキスト       | LLM-based     | 必要               |
| [Context Precision (コンテキストの精度)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_precision/)                           | `NonLLMContextPrecisionWithReference` | 関連性の高い取得コンテキストがより上位にランク付けされているか（各取得コンテキストが関連性があるかを非 LLM の類似度尺度で各参照コンテキストと比較して判断） | 取得コンテキスト、参照コンテキスト         | Non LLM-based | 必要               |
| [Context Recall (コンテキストの回収効率)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_recall/)                             | `LLMContextRecall`                    | 参照を参照コンテキストの代わりに使用。参照に含まれる主張のうち、取得コンテキストから推測できる主張の割合                                                    | ユーザー入力、応答、参照、取得コンテキスト | LLM-based     | 必要               |
| [Context Recall (コンテキストの回収効率)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_recall/)                             | `NonLLMContextRecall`                 | 参照コンテキストのうち、関連性のある取得コンテキストの割合（関連性があるかどうかは非 LLM の文字列比較で判断）                                               | 取得コンテキスト、参照コンテキスト         | Non LLM-based | 必要               |
| [Context Entities Recall (コンテキストエンティティの記憶性)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_entities_recall/) | `ContextEntityRecall`                 | 参照に含まれるエンティティのうち、取得コンテキストに含まれているエンティティの割合（エンティティは抜き出したキーワードや数値、日付など重要な情報）          | 参照、取得コンテキスト                     | LLM-based     | 必要               |
| [Noise Sensitivity (ノイズ感度)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/noise_sensitivity/)                                   | `NoiseSensitivity`                    | 応答に含まれる主張のうち、正しくない主張（参照に基づかない主張）の割合                                                                                      | ユーザー入力、応答、参照、取得コンテキスト | LLM-based     | 必要               |
| [Multimodal Faithfulness (マルチモーダル忠実性)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/multi_modal_faithfulness/)            | `MultiModalFaithfulness`              | LLM が直接0か1かで評価                                                                                                                                      | ユーザー入力、応答、取得コンテキスト       | LLM-based     | 不要               |
| [Multimodal Relevance (マルチモーダル関連性)](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/multi_modal_relevance/)                  | `MultiModalRelevance`                 | LLM が直接0か1かで評価                                                                                                                                      | ユーザー入力、応答、取得コンテキスト       | LLM-based     | 不要               |

[^2]: Response Relevancy は論文では Answer Relevancy と言われています。

マルチモーダル系は、取得したコンテキストとして渡すデータが画像などの視覚データの場合に使用します。これらのメトリクスでは LLM が直接スコアを決めるため0か1かの2値になるようです。それ以外のメトリクスでは、LLM をアシスト的に用いて数式によってスコアを算出します。

## 参考文献

* [Overview - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/overview/#different-types-of-metrics)
* [Faithfulness - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/faithfulness/)
* [Response Relevancy - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/answer_relevance/)
* [Context Precision - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_precision/)
* [Context Recall - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_recall/)
* [Context Entities Recall - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/context_entities_recall/)
* [Noise Sensitivity - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/noise_sensitivity/#example)
* [Multi modal faithfulness - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/multi_modal_faithfulness/)
* [Multi modal relevance - Ragas](https://docs.ragas.io/en/v0.2.15/concepts/metrics/available_metrics/multi_modal_relevance/)
* [Metrics - Ragas](https://docs.ragas.io/en/v0.2.15/references/metrics/)
* [Ragas: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/pdf/2309.15217)
