---
title: "ブラウザだけで完結する暗号化ファイルマネージャを作ってみた"
date: "2025-02-03"
tags: ["OPFS", "WebAssembly", "JavaScript", "Rust"]
---

ちょっとした思いつきで、ブラウザだけでファイルを暗号化して保管できるアプリを作れるのではないかと思い作ってみました。使い道はよくわからないですが、何かの役に立つこともあるかもしれません。

アプリ: https://sogo.dev/local-file-locker/  
ソースコード: https://github.com/SogoKato/local-file-locker

ファイルを選んで encrypt ボタンを押すと……

![local_file_locker_1](/images/posts/2025/02/local_file_locker_1.png)

ファイルが暗号化されて保存されます！

![local_file_locker_2](/images/posts/2025/02/local_file_locker_2.png)

ファイル名をクリックすると復号して表示できます。

![local_file_locker_3](/images/posts/2025/02/local_file_locker_3.png)

以下のブラウザで動作確認しています。
* Firefox 134.0.2 (macOS, Android)
* Chrome 132.0.6834 (macOS, Android)

## ポイント

* WASM でファイルを AES 暗号化
* [OPFS (Origin Private File System)](https://developer.mozilla.org/ja/docs/Web/API/File_System_API/Origin_private_file_system) でファイルを保管

## WASM でファイルを AES 暗号化

JS にも [SubtleCrypto API](https://developer.mozilla.org/ja/docs/Web/API/SubtleCrypto) が用意されていますが、今回は Rust の暗号化ライブラリである [aes_gcm](https://docs.rs/aes-gcm/0.10.3/aes_gcm/index.html) を使用してファイルを暗号化する関数を作り、WebAssembly 化して JS から呼び出すようにしてみました。WASM を使ったのは使ってみたかった理由が大きいですが、その方が高速かもという期待もあります。これから SubtleCrypto とのパフォーマンス比較とかもやってみたいなと思います。

処理自体は一般的な AES-GCM 暗号化です。ライブラリを呼んでいるだけなのでコードはこれだけです。

```rust
use aes_gcm::{AeadCore, Aes256Gcm, Key};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use sha2::digest::generic_array::GenericArray;
use sha2::{Sha256, Digest};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn encrypt(password: &str, file: &[u8]) -> Box<[u8]> {
    let key = hash_password(password);
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher.encrypt(&nonce, file).expect("encryption failure!");
    [nonce.as_slice(), &ciphertext].concat().into_boxed_slice()
}

#[wasm_bindgen]
pub fn decrypt(password: &str, file: &[u8]) -> Box<[u8]> {
    let key = hash_password(password);
    let cipher = Aes256Gcm::new(&key.into());

    let (nonce_bytes, ciphertext) = file.split_at(12);
    let nonce = GenericArray::from_slice(nonce_bytes);

    let plaintext = cipher.decrypt(&nonce, ciphertext).expect("decryption failure!");
    plaintext.into_boxed_slice()
}

fn hash_password(password: &str) -> Key<Aes256Gcm> {
    let hash = Sha256::digest(password.as_bytes());
    Key::<Aes256Gcm>::from_slice(&hash).clone()
}
```

[wasm_bindgen](https://rustwasm.github.io/wasm-bindgen/introduction.html) が `Uint8Array` ↔️ `&[u8]` `Box[u8]` のような複雑な型の変換までしてくれるので感動しました。

## OPFS でファイルを保管

[OPFS (Origin Private File System)](https://developer.mozilla.org/ja/docs/Web/API/File_System_API/Origin_private_file_system) は、モダンなブラウザで利用できる origin ごとに隔離された、パフォーマンスとセキュリティに優れたファイルシステムです。

TypeScript から利用するときに `tsconfig.json` の compilerOptions.lib に `dom.asynciterable` を追加しないと [`FileSystemDirectoryHandle`](https://developer.mozilla.org/ja/docs/Web/API/FileSystemDirectoryHandle/removeEntry) の `entries()` メソッド等が使えないという罠があって少し引っかかりました。

* [Missing iterators for `FileSystemDirectoryHandle` · Issue #1639 · microsoft/TypeScript-DOM-lib-generator](https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1639)

## 今後やりたいこと

* SubtleCrypto とのパフォーマンス比較
* Web Worker 化？
  * 2025年2月現在、Safari では [`FileSystemSyncAccessHandle`](https://developer.mozilla.org/ja/docs/Web/API/FileSystemSyncAccessHandle) しかサポートされていないが、これは Web Worker 内でしか利用できない
