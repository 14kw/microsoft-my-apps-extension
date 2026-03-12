/**
 * My Apps Launcher - バックグラウンドサービスワーカー
 *
 * chrome.runtime APIを管理し、拡張機能のライフサイクルイベントを処理する。
 */

/**
 * 拡張機能インストール時の初期化処理
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[My Apps Launcher] 拡張機能がインストールされました");

    // 初期設定を保存
    chrome.storage.local.set({
      myApps: [],
      viewPreference: "grid",
    });
  }

  if (details.reason === "update") {
    console.log(
      `[My Apps Launcher] バージョン ${chrome.runtime.getManifest().version} に更新されました`
    );
  }
});

/**
 * ポップアップやコンテンツスクリプトからのメッセージを処理する
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "getApps":
      // ストレージからアプリデータを取得
      chrome.storage.local.get(["myApps", "lastUpdated"], (data) => {
        sendResponse({
          apps: data.myApps || [],
          lastUpdated: data.lastUpdated || null,
        });
      });
      return true; // 非同期レスポンスのためtrueを返す

    case "openMyApps":
      // My Appsページを新しいタブで開く
      chrome.tabs.create({ url: "https://myapps.microsoft.com" });
      sendResponse({ success: true });
      break;

    case "appsSaved":
      // コンテンツスクリプトからアプリが保存された通知
      console.log(`[My Apps Launcher] ${message.count}個のアプリが保存されました`);
      sendResponse({ success: true });
      break;

    default:
      break;
  }
});

/**
 * バッジを表示する対象のホスト名一覧
 */
const ALLOWED_HOSTS = [
  "myapps.microsoft.com",
  "myapplications.microsoft.com",
];

/**
 * タブ更新時にMy Appsページであればバッジを表示する
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const parsedUrl = new URL(tab.url);
      const host = parsedUrl.hostname;
      if (ALLOWED_HOSTS.includes(host)) {
        // My Appsページが開かれたことを示すバッジ
        chrome.action.setBadgeText({ text: "✓", tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#107c10", tabId });
      }
    } catch (e) {
      // 無効なURLの場合はバッジを更新しない
    }
  }
});
