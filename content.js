/**
 * My Apps Launcher - コンテンツスクリプト
 *
 * myapps.microsoft.com上で実行され、アプリ一覧をDOMから取得し
 * chrome.storage.localに保存する。
 * SPAの動的レンダリングに対応するためMutationObserverを使用する。
 */

(function () {
  "use strict";

  /** スクレイピング済みフラグ（重複実行防止） */
  let hasSscraped = false;

  /** 最大リトライ回数 */
  const MAX_RETRIES = 20;

  /** リトライ間隔（ミリ秒） */
  const RETRY_INTERVAL = 2000;

  /**
   * アプリ一覧をDOMから抽出する
   *
   * Microsoft My Appsポータルの複数のDOM構造パターンに対応する。
   * @returns {Array} アプリデータの配列
   */
  function scrapeApps() {
    const apps = [];
    const seen = new Set();

    // パターン1: 新しいMy AppsポータルのDOM構造
    // アプリタイルは通常 data-automationid や role="listitem" を持つ
    const selectors = [
      // 新しいUIのセレクタパターン
      '[data-automationid="AppTile"]',
      '[role="listitem"] a[href]',
      ".ms-List-cell a[href]",
      // 旧UIのセレクタパターン
      ".app-tile",
      ".tile-link",
      'a[data-appid]',
      // 一般的なパターン
      '[class*="appTile"]',
      '[class*="app-tile"]',
      '[class*="AppCard"]',
      '[class*="app-card"]',
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => extractAppFromElement(el, apps, seen));
      } catch (e) {
        // セレクタが無効な場合はスキップ
      }
    }

    // フォールバック: href属性にsigninを含むリンクを探す
    if (apps.length === 0) {
      const links = document.querySelectorAll('a[href*="signin/"]');
      links.forEach((el) => extractAppFromElement(el, apps, seen));
    }

    // フォールバック2: 画像とテキストを含むクリック可能な要素を探す
    if (apps.length === 0) {
      const candidates = document.querySelectorAll(
        'div[role="button"], div[tabindex="0"], a[role="link"]'
      );
      candidates.forEach((el) => {
        const img = el.querySelector("img");
        const text = el.textContent?.trim();
        if (img && text && text.length < 100) {
          extractAppFromElement(el, apps, seen);
        }
      });
    }

    return apps;
  }

  /**
   * DOM要素からアプリデータを抽出する
   * @param {Element} el - 対象のDOM要素
   * @param {Array} apps - アプリデータの格納先配列
   * @param {Set} seen - 重複チェック用セット
   */
  function extractAppFromElement(el, apps, seen) {
    // アプリ名の取得（複数のソースを試行）
    const name =
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.querySelector('[class*="name"], [class*="Name"], [class*="title"]')
        ?.textContent?.trim() ||
      el.querySelector("span, div:not(:has(*))")?.textContent?.trim() ||
      el.textContent?.trim();

    if (!name || name.length > 100 || seen.has(name)) return;

    // URLの取得
    let url =
      el.href ||
      el.getAttribute("href") ||
      el.querySelector("a")?.href ||
      el.closest("a")?.href ||
      "";

    // 相対パスの場合はベースURLを付加
    if (url && !url.startsWith("http")) {
      url = new URL(url, window.location.origin).href;
    }

    // アイコンの取得
    const icon =
      el.querySelector("img")?.src ||
      el.querySelector('[class*="icon"] img, [class*="logo"] img')?.src ||
      "";

    if (name && (url || icon)) {
      seen.add(name);
      apps.push({
        name: name,
        url: url || `https://myapps.microsoft.com`,
        icon: icon,
      });
    }
  }

  /**
   * スクレイピング結果をchrome.storageに保存する
   * @param {Array} apps - アプリデータの配列
   */
  async function saveApps(apps) {
    if (apps.length === 0) return;

    try {
      await chrome.storage.local.set({
        myApps: apps,
        lastUpdated: new Date().toISOString(),
      });
      console.log(
        `[My Apps Launcher] ${apps.length}個のアプリを保存しました`
      );
    } catch (error) {
      console.error("[My Apps Launcher] 保存エラー:", error);
    }
  }

  /**
   * ページのAPIレスポンスをインターセプトしてアプリデータを取得する
   *
   * Performance APIを使用してfetchリクエストを監視する。
   */
  function interceptApiResponse() {
    // fetch APIをフック
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

      // My Apps APIのレスポンスを監視
      if (
        url.includes("/api/myapps") ||
        url.includes("/api/") && url.includes("application")
      ) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          processApiResponse(data);
        } catch (e) {
          // JSONパースエラーは無視
        }
      }

      return response;
    };

    // XMLHttpRequestもフック
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._myAppsUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        if (
          this._myAppsUrl &&
          (this._myAppsUrl.includes("/api/myapps") ||
            (this._myAppsUrl.includes("/api/") &&
              this._myAppsUrl.includes("application")))
        ) {
          try {
            const data = JSON.parse(this.responseText);
            processApiResponse(data);
          } catch (e) {
            // JSONパースエラーは無視
          }
        }
      });
      return originalSend.apply(this, args);
    };
  }

  /**
   * APIレスポンスからアプリデータを処理・保存する
   * @param {Object|Array} data - APIレスポンスデータ
   */
  function processApiResponse(data) {
    const apps = [];
    const items = Array.isArray(data) ? data : data?.appList || data?.value || [];

    for (const item of items) {
      const name = item.displayName || item.name || item.appDisplayName;
      const url =
        item.launchUrl || item.loginUrl || item.url || item.homepageUrl || "";
      const icon = item.logoUrl || item.iconUrl || item.logo || "";

      if (name) {
        apps.push({ name, url, icon });
      }
    }

    if (apps.length > 0) {
      hasSscraped = true;
      saveApps(apps);
    }
  }

  /**
   * DOMの変更を監視してアプリが完全に読み込まれたタイミングで取得する
   */
  function observeAndScrape() {
    let retryCount = 0;

    const tryToScrape = () => {
      const apps = scrapeApps();

      if (apps.length > 0) {
        hasScrapped = true;
        saveApps(apps);
        return true;
      }

      return false;
    };

    // 初回試行
    if (tryToScrape()) return;

    // MutationObserverで変更を監視
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (hasScrapped) {
        observer.disconnect();
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (tryToScrape()) {
          observer.disconnect();
        }
      }, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 定期的にリトライ（SPAの読み込みが遅い場合）
    const retryInterval = setInterval(() => {
      retryCount++;

      if (hasScrapped || retryCount >= MAX_RETRIES) {
        clearInterval(retryInterval);
        observer.disconnect();
        return;
      }

      tryToScrape();
    }, RETRY_INTERVAL);
  }

  // タイポ修正: hasScrapped -> hasScrapped を変数として使用
  let hasScrapped = false;

  /**
   * メイン処理
   */
  function main() {
    console.log("[My Apps Launcher] コンテンツスクリプトを開始しました");

    // APIインターセプトを設定（ページコンテキストに注入）
    const script = document.createElement("script");
    script.textContent = `(${interceptApiResponse.toString()})();`;
    // ページコンテキストでAPIインターセプトを実行するため
    // script要素として注入する（content scriptでは直接アクセスできないため）
    // ただしMV3ではこの方法が制限される場合がある
    try {
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      // CSP制限でスクリプト注入が失敗した場合はDOMスクレイピングのみに依存
      console.log(
        "[My Apps Launcher] APIインターセプトは利用できません。DOMスクレイピングを使用します"
      );
    }

    // DOMスクレイピングを開始
    observeAndScrape();

    // chrome.runtime.onMessageでバックグラウンドからの指示に応答
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "scrapeApps") {
        const apps = scrapeApps();
        saveApps(apps);
        sendResponse({ success: true, count: apps.length });
      }
      return true;
    });
  }

  // ページ読み込み完了後に実行
  if (document.readyState === "complete") {
    main();
  } else {
    window.addEventListener("load", main);
  }
})();
