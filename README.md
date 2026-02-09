# My Apps Launcher

Microsoft My Appsポータルのアプリ一覧を素早く表示・アクセスするChrome拡張機能。

## 機能

- myapps.microsoft.com からアプリ一覧を自動取得
- ポップアップからアプリにワンクリックでアクセス
- アプリ名での検索・フィルタリング
- グリッド表示とリスト表示の切替
- ローカルストレージへのキャッシュによるオフライン利用
- アプリデータのJSONエクスポート

## インストール方法

1. このディレクトリをローカルにクローンまたはダウンロードする
2. Chromeで `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリックする
5. `my-apps-extension` ディレクトリを選択する

## 使い方

### アプリ一覧の取得

1. 拡張機能のアイコンをクリックしてポップアップを開く
2. 「My Appsを開く」ボタンをクリックする（または更新ボタンを押す）
3. myapps.microsoft.com にログインする
4. ページ読み込み後にアプリ一覧が自動的に取得・保存される
5. 次回からはポップアップを開くだけでアプリ一覧を確認できる

### アプリの検索

- 検索バーにアプリ名を入力すると即座にフィルタリングされる
- `Ctrl + K`（macOS: `Cmd + K`）で検索バーにフォーカスする
- `Esc`で検索をクリアする

### 表示切替

- グリッド表示: アプリをタイル形式で表示する
- リスト表示: アプリをリスト形式で表示する

## ファイル構成

```text
my-apps-extension/
├── manifest.json      # Chrome拡張マニフェスト（Manifest V3）
├── popup.html         # ポップアップUI
├── popup.css          # ポップアップスタイル
├── popup.js           # ポップアップロジック
├── content.js         # コンテンツスクリプト（スクレイピング）
├── background.js      # サービスワーカー
├── icons/             # 拡張機能アイコン
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 技術仕様

- **Manifest Version**: V3
- **権限**: `storage`, `activeTab`
- **ホスト権限**: `myapps.microsoft.com`, `myapplications.microsoft.com`
- **データ保存**: `chrome.storage.local`

## プライバシー

- すべてのデータはローカルのブラウザストレージに保存される
- 外部サーバーへのデータ送信は行わない
- Microsoft My Appsポータルでのみコンテンツスクリプトが動作する
