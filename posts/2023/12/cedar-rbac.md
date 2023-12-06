---
title: "Cedarで（超最小限な）RBAC認可を実装してみる"
date: "2023-12-07"
tags: ["Cedar", "AWS", "認証/認可", "Rust"]
---

この記事は[ニフクラ](https://www.nifcloud.com/)等を提供している、[富士通クラウドテクノロジーズ Advent Calendar 2023](https://qiita.com/advent-calendar/2023/fjct)の7日目の記事です。

昨日は [@George22e](https://qiita.com/George22e) さんの [ヴァイオリンの音色のよさはスペクトラムアナライザーで分かるか試してみた](https://note.com/jooji/n/n4488690289ec) でした。  
自らの演奏とプロの演奏を可視化して分析する姿勢にエンジニアリングの精神と通じるものを感じました。私も仕事でも趣味でも本気でエンジニアリングしていきたいです。

今日は [AWS が公開している](https://aws.amazon.com/jp/about-aws/whats-new/2023/05/cedar-open-source-language-access-control/)アクセス制御用のオープンソース言語 [Cedar](https://docs.cedarpolicy.com/) とその認可エンジンを使って、自分のアプリにどう実装していくかについて検討してみたいと思います。

## Cedar とは

Cedar とは認可ポリシーを記述するための言語です。Cedar で書かれたポリシーを基に判断を行う認可エンジンもオープンソースとして公開されています。また、[Amazon Verified Permissions](https://aws.amazon.com/jp/verified-permissions/) としてサービス化もされています。認可の機能はほとんどのアプリケーションにとって必要な機能なので、その実装の負担を低くすることができるというのは大変ありがたいことです。

「誰のどんなリクエストを許可するか」を記述し、それを認可エンジンに読み込ませることで、実際のリクエストに対して許可するか・許可しないかという結果が得られます。

![sequence-diagram](//www.plantuml.com/plantuml/png/SoWkIImgAStDuNBCoKnELT2rKmXEBIe3CgqKWb8BIrEBIxX00b0vvzIKn285AmN7qfACAhW2Y2X2AvA2ueBylE9KP2CWzbWXv1nIyr903W00)

Cedar の認可エンジンは Rust 製で、現時点では Rust と Java で使えるみたいです。

## ポリシー言語の学習

まずは言語としての Cedar を学ばねば、実装しようにも何もできません。学習には公式のチュートリアルがおすすめです。雑にまとめます。

[Tutorial | Cedar language](https://www.cedarpolicy.com/en/tutorial)

ポリシーはこのような構造をしています。これは `alice` に `VacationPhoto94.jpg` への `update` を許可するという意味です。`permit` ではなく `forbid` を使うことで明示的に拒否することができます。何も書かれていない時は暗黙的に拒否されます。なので、IAM などと同様に暗黙的な拒否、明示的な許可、明示的な拒否の順に強くなります。

```
permit(
  principal == User::"alice", 
  action    == Action::"update", 
  resource  == Photo::"VacationPhoto94.jpg"
);
```

プリンシパルやリソースはエンティティで表現されます。上記では `User` という種類のエンティティや `Photo` という種類のエンティティが書かれています。エンティティは階層構造をとることができます。

RBAC (Role-based access control) を実現したい場合には、例えば `User` エンティティの親として `Role` エンティティを定義することで、あるユーザーがあるロールを持っていることを表現できます。

```
permit(
  principal in Role::"vacationPhotoJudges",
  action == Action::"view",
  resource == Photo::"vacationPhoto94.jpg"
);
```

ABAC (Attribute-based access control) を実現したい場合には、以下のように属性に基づいた条件を記述すればよいです。この例ではリクエストしてきた人がリソースの所有者であれば閲覧・編集・削除を許可します。

```
permit(
  principal, 
  action in [Action::"view", Action::"edit", Action::"delete"], 
  resource 
)
when {
  resource.owner == principal.id
};
```

リクエストに関する情報を付加するにはコンテクストを使用します。

```
permit(
    principal in User::"alice", 
    action in [Action::"update", Action::"delete"],
    resource == Photo::"flower.jpg")
when {
    context.mfa_authenticated == true &&
    context.request_client_ip == "222.222.222.222"
};
```

ポリシーのバリデーションに使われるのがスキーマです。エンティティやアクションなどの型を定義しておくことでミスを防ぎます。ちなみに [VS Code の拡張機能](https://marketplace.visualstudio.com/items?itemName=cedar-policy.vscode-cedar)でもスキーマを利用してポリシーのチェックができます。

<details>
<summary>スキーマの例</summary>

```json
{
    "PhotoApp": {
        "commonTypes": {
            "PersonType": {
                "type": "Record",
                "attributes": {
                    "age": {
                        "type": "Long"
                    },
                    "name": {
                        "type": "String"
                    }
                }
            },
            "ContextType": {
                "type": "Record",
                "attributes": {
                    "ip": {
                        "type": "Extension",
                        "name": "ipaddr"
                    }
                }
            }
        },
        "entityTypes": {
            "User": {
                "shape": {
                    "type": "Record",
                    "attributes": {
                        "employeeId": {
                            "type": "String",
                            "required": true
                        },
                        "personInfo": {
                            "type": "PersonType"
                        }
                    }
                },
                "memberOfTypes": [
                    "UserGroup"
                ]
            },
            "UserGroup": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                }
            },
            "Photo": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                },
                "memberOfTypes": [
                    "Album"
                ]
            },
            "Album": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                }
            }
        },
        "actions": {
            "viewPhoto": {
                "appliesTo": {
                    "principalTypes": [
                        "User",
                        "UserGroup"
                    ],
                    "resourceTypes": [
                        "Photo"
                    ],
                    "context": {
                        "type": "ContextType"
                    }
                }
            },
            "createPhoto": {
                "appliesTo": {
                    "principalTypes": [
                        "User",
                        "UserGroup"
                    ],
                    "resourceTypes": [
                        "Photo"
                    ],
                    "context": {
                        "type": "ContextType"
                    }
                }
            },
            "listPhotos": {
                "appliesTo": {
                    "principalTypes": [
                        "User",
                        "UserGroup"
                    ],
                    "resourceTypes": [
                        "Photo"
                    ],
                    "context": {
                        "type": "ContextType"
                    }
                }
            }
        }
    }
}
```

</details>

応用的な機能として、ポリシーテンプレートと呼ばれる変数化するための機能があります。これによってユーザーごとにユーザー ID やリソース名が違うだけの大量のポリシーを作らずに済みます。以下の例では `?principal` と `?resource` がプレースホルダーになっています。

```
permit(
    principal == ?principal, 
    action in [Action::"readFile", Action::"writeFile"] 
    resource  == ?resource
);
```

## シンプルな RBAC を実装してみる

前置きがやや長くなってしまいましたが、Cedar 言語について雰囲気をつかめたところで実際にコードを書いてみましょう。Rust SDK を使ってやっていきます。（Rust 勉強中の身のためコードが汚いです、すみません）

https://github.com/SogoKato/cedar-rbac

使用した [cedar-policy](https://crates.io/crates/cedar-policy) crate は 2.4.2 です。もうすぐ 3.0 が出る気配がしているので、このコードは早速古くなるかもしれません。

Kubernetes 風に `admin` ロールを持った `Alice` と `viewer` ロールを持った `Bob` という設定で `nginx-pod` という `Pod` を操作する設定です。

```
$ cedar-rbac Alice describe nginx-pod
Hello Alice! You can describe nginx-pod.

$ cedar-rbac Bob describe nginx-pod
Hello Bob! You can describe nginx-pod.

$ cedar-rbac Alice delete nginx-pod
Hello Alice! You can delete nginx-pod.

$ cedar-rbac Bob delete nginx-pod
Authorization Denied
```

全部載せるにはちょっと長いので、ポイントだけ載せます。

### ポリシー

```
permit (
    principal,
    action == Kubernetes::Action::"describe",
    resource
)
when {
    principal in Kubernetes::Role::"viewer" ||
    principal in Kubernetes::Role::"admin"
};

permit (
    principal,
    action == Kubernetes::Action::"delete",
    resource
)
when {
    principal in Kubernetes::Role::"admin"
};
```

### スキーマ

```json
{
    "Kubernetes": {
        "entityTypes": {
            "User": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                },
                "memberOfTypes": [
                    "Role"
                ]
            },
            "Role": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                },
                "memberOfTypes": []
            },
            "Pod": {
                "shape": {
                    "type": "Record",
                    "attributes": {}
                },
                "memberOfTypes": []
            }
        },
        "actions": {
            "describe": {
                "appliesTo": {
                    "principalTypes": [
                        "User"
                    ],
                    "resourceTypes": [
                        "Pod"
                    ]
                }
            },
            "delete": {
                "appliesTo": {
                    "principalTypes": [
                        "User"
                    ],
                    "resourceTypes": [
                        "Pod"
                    ]
                }
            }
        }
    }
}
```

### 認可する部分

スキーマとポリシーはファイルに定義されているものを読み込んで Rust のインスタンスにしています。エンティティには今回のリクエストの認可の判断に必要なものを全て用意します。つまり、プリンシパルやリソースに対応するエンティティとそれらの親のエンティティが必要です。

```rust
fn is_authorized(principal: &Entity, action: &str, resource: &Entity) -> std::result::Result<(), Error> {
    let authorizer = Authorizer::new();
    let schema = get_schema()?;
    let policies = get_policy_set(&schema)?;
    let entities = get_entity_set();
    let action_uid: EntityUid = format!(r#"Kubernetes::Action::"{action}""#).parse().unwrap();
    let q = Request::new(
        principal.uid().into(),
        action_uid.into(),
        resource.uid().into(),
        Context::empty(),
    );
    let response = authorizer.is_authorized(&q, &policies, &entities);
    match response.decision() {
        Decision::Allow => Ok(()),
        Decision::Deny => Err(Error::AuthDenied(response.diagnostics().clone())),
    }
}
```

### ドメインの型を Cedar のエンティティに変換する部分

多くのシステムではドメインのオブジェクトが存在すると思います。From トレイトを使用して、`Entity` 型への変換を行いました。

```rust
struct User {
    id: String,
    role: String,
}

impl From<User> for Entity {
    fn from(value: User) -> Self {
        let eid = EntityId::from_str(&value.id).unwrap();
        let type_name = EntityTypeName::from_str("Kubernetes::User").unwrap();
        let euid = EntityUid::from_type_name_and_id(type_name, eid);
        let attrs = HashMap::new();
        let parent_eid = EntityId::from_str(&value.role).unwrap();
        let parent_type_name = EntityTypeName::from_str("Kubernetes::Role").unwrap();
        let parent_euid = EntityUid::from_type_name_and_id(parent_type_name, parent_eid);
        let parents = HashSet::from([parent_euid]);
        Entity::new(euid, attrs, parents)
    }
}
```

## おわりに

初めてまとまった Rust のコードを書いたのでこんなものを世に出していいのかドキドキですが、大変勉強になりました。

Cedar を使ってみた感想としては、結構いい感じに抽象化されているのでなんでもできそうという感触はあるのですが、（自分が Rust に慣れていないのもあり）言語を問わず情報が少なく実装する際には迷うことが多かったです[^1]。エンティティを集約するところとかは今回は手を抜きましたが、ちゃんと作るとなると少し面倒そうな感じがするので（自分の中で）ノウハウが蓄積されてくるといいかなと思います。

[^1]: エンティティを参照するための `__entity` を `RestrictedExpression` で表現する方法が分からなくて挫折しました（https://github.com/cedar-policy/cedar/issues/350 に期待??）。

この記事は[富士通クラウドテクノロジーズ Advent Calendar 2023](https://qiita.com/advent-calendar/2023/fjct)の7日目の記事でした。

明日は [@o108minmin](https://qiita.com/o108minmin) さんが「N100搭載ミニPCで低コスト自宅サーバー or 料理」について書いてくれるようです。  
私自身ラズパイでクラスターを組んで自宅サーバーやってますが、最近はラズパイも高いのでミニ PC 一台で済むならなかなか魅力的です。でも、自炊勢としては料理についても気になります。それでは、明日の記事もお楽しみに！

## 参考文献

* [cedar-policy](https://github.com/cedar-policy)
* [cedar-policy/cedar-examples](https://github.com/cedar-policy/cedar-examples)
* [Cedar Policy Language Version 2.3 Reference Guide](https://docs.cedarpolicy.com/)
* [Tutorial | Cedar language](https://www.cedarpolicy.com/en/tutorial)
