/**
 * My Apps Launcher - ポップアップスクリプト
 *
 * Chrome拡張機能のポップアップUIを管理するスクリプト。
 * chrome.storage.localからアプリデータを読み込み、
 * 検索・フィルタ・表示切替の機能を提供する。
 */

// DOM要素の参照
const elements = {
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  appGrid: document.getElementById("appGrid"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyDescription: document.getElementById("emptyDescription"),
  fetchAppsBtn: document.getElementById("fetchAppsBtn"),
  loadingState: document.getElementById("loadingState"),
  appCount: document.getElementById("appCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  refreshBtn: document.getElementById("refreshBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettings: document.getElementById("closeSettings"),
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  exportBtn: document.getElementById("exportBtn"),
  gridViewBtn: document.getElementById("gridViewBtn"),
  listViewBtn: document.getElementById("listViewBtn"),
  sortBtn: document.getElementById("sortBtn"),
  sortLabel: document.getElementById("sortLabel"),
};

// アプリデータの状態
let allApps = [];
let currentView = "grid";

/** ソート状態: "none" | "asc" | "desc" */
let currentSort = "none";

/**
 * 初期化処理
 */
async function init() {
  await loadApps();
  setupEventListeners();
  await loadViewPreference();
}

/**
 * chrome.storage.localからアプリデータを読み込む
 */
async function loadApps() {
  elements.loadingState.style.display = "flex";
  elements.appGrid.style.display = "none";
  elements.emptyState.style.display = "none";

  try {
    const data = await chrome.storage.local.get(["myApps", "lastUpdated"]);
    allApps = data.myApps || [];

    if (data.lastUpdated) {
      const date = new Date(data.lastUpdated);
      elements.lastUpdated.textContent = formatDate(date);
    }

    renderApps(sortApps(allApps));
  } catch (error) {
    console.error("アプリデータ読み込みエラー:", error);
    showEmptyState("読み込みエラー", "アプリデータの読み込みに失敗しました。");
  } finally {
    elements.loadingState.style.display = "none";
  }
}

/**
 * アプリ一覧を描画する
 * @param {Array} apps - 表示するアプリの配列
 */
function renderApps(apps) {
  if (apps.length === 0) {
    elements.appGrid.style.display = "none";
    if (allApps.length === 0) {
      showEmptyState(
        "アプリが登録されていません",
        "myapps.microsoft.com にアクセスしてアプリ一覧を取得してください。"
      );
    } else {
      showEmptyState(
        "検索結果がありません",
        "別のキーワードで検索してみてください。"
      );
      elements.fetchAppsBtn.style.display = "none";
    }
    elements.appCount.textContent = `${apps.length} / ${allApps.length} 個のアプリ`;
    return;
  }

  elements.emptyState.style.display = "none";
  elements.appGrid.style.display = "grid";
  elements.appCount.textContent =
    allApps.length === apps.length
      ? `${apps.length} 個のアプリ`
      : `${apps.length} / ${allApps.length} 個のアプリ`;

  elements.appGrid.innerHTML = apps.map((app) => createAppTile(app)).join("");
}

/**
 * アプリタイルのHTMLを生成する
 * @param {Object} app - アプリデータ
 * @returns {string} HTML文字列
 */
function createAppTile(app) {
  const iconHtml = app.icon
    ? `<img class="app-tile-icon" src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.name)}" onerror="this.outerHTML='<div class=\\'app-tile-icon-placeholder\\'>${escapeHtml(getInitial(app.name))}</div>'">`
    : `<div class="app-tile-icon-placeholder">${escapeHtml(getInitial(app.name))}</div>`;

  return `
    <a class="app-tile" href="${escapeHtml(app.url)}" target="_blank" title="${escapeHtml(app.name)}">
      ${iconHtml}
      <span class="app-tile-name">${escapeHtml(app.name)}</span>
    </a>
  `;
}

/**
 * アプリ名の頭文字を取得する
 * @param {string} name - アプリ名
 * @returns {string} 頭文字
 */
function getInitial(name) {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

/**
 * 空状態を表示する
 * @param {string} title - タイトル
 * @param {string} description - 説明文
 */
function showEmptyState(title, description) {
  elements.emptyState.style.display = "flex";
  elements.emptyTitle.textContent = title;
  elements.emptyDescription.textContent = description;
  elements.fetchAppsBtn.style.display = "inline-flex";
}

/**
 * ソート済みのアプリ配列を返す
 * @param {Array} apps - ソート対象のアプリ配列
 * @returns {Array} ソート済みの配列
 */
function sortApps(apps) {
  if (currentSort === "none") return apps;

  return [...apps].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (currentSort === "asc") return nameA.localeCompare(nameB, "ja");
    return nameB.localeCompare(nameA, "ja");
  });
}

/**
 * 検索処理
 * @param {string} query - 検索文字列
 */
function searchApps(query) {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    renderApps(sortApps(allApps));
    return;
  }

  const filtered = allApps.filter((app) =>
    app.name.toLowerCase().includes(normalizedQuery)
  );
  renderApps(sortApps(filtered));
}

/**
 * イベントリスナーを設定する
 */
function setupEventListeners() {
  // 検索入力
  elements.searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    elements.clearSearch.style.display = query ? "flex" : "none";
    searchApps(query);
  });

  // 検索クリア
  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.clearSearch.style.display = "none";
    searchApps("");
    elements.searchInput.focus();
  });

  // 更新ボタン
  elements.refreshBtn.addEventListener("click", async () => {
    // myapps.microsoft.comを新しいタブで開く
    chrome.tabs.create({ url: "https://myapps.microsoft.com" });
    showToast("My Appsを開いています...");
  });

  // 表示切替（グリッド）
  elements.gridViewBtn.addEventListener("click", () => {
    setView("grid");
  });

  // 表示切替（リスト）
  elements.listViewBtn.addEventListener("click", () => {
    setView("list");
  });

  // ソート切替
  elements.sortBtn.addEventListener("click", () => {
    toggleSort();
  });

  // 設定ボタン
  elements.settingsBtn.addEventListener("click", () => {
    elements.settingsModal.style.display = "flex";
  });

  // 設定閉じる
  elements.closeSettings.addEventListener("click", () => {
    elements.settingsModal.style.display = "none";
  });

  // モーダル外クリックで閉じる
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.style.display = "none";
    }
  });

  // キャッシュクリア
  elements.clearCacheBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove(["myApps", "lastUpdated"]);
    allApps = [];
    elements.lastUpdated.textContent = "未取得";
    renderApps([]);
    elements.settingsModal.style.display = "none";
    showToast("キャッシュをクリアしました");
  });

  // エクスポート
  elements.exportBtn.addEventListener("click", () => {
    exportData();
  });

  // storageの変更を検知してリアルタイム反映
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.myApps) {
      allApps = changes.myApps.newValue || [];
      applyCurrentFilter();

      if (changes.lastUpdated) {
        const date = new Date(changes.lastUpdated.newValue);
        elements.lastUpdated.textContent = formatDate(date);
      }
    }
  });

  // キーボードショートカット
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + K で検索にフォーカス
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      elements.searchInput.focus();
    }
    // Escで検索クリアまたはモーダル閉じる
    if (e.key === "Escape") {
      if (elements.settingsModal.style.display === "flex") {
        elements.settingsModal.style.display = "none";
      } else if (elements.searchInput.value) {
        elements.searchInput.value = "";
        elements.clearSearch.style.display = "none";
        searchApps("");
      }
    }
  });
}

/**
 * 表示モードを切り替える
 * @param {string} view - "grid" または "list"
 */
function setView(view) {
  currentView = view;

  if (view === "grid") {
    elements.appGrid.classList.remove("list-view");
    elements.gridViewBtn.classList.add("active");
    elements.listViewBtn.classList.remove("active");
  } else {
    elements.appGrid.classList.add("list-view");
    elements.listViewBtn.classList.add("active");
    elements.gridViewBtn.classList.remove("active");
  }

  // 設定を保存
  chrome.storage.local.set({ viewPreference: view });
}

/**
 * ソートの状態を切り替える
 * none → asc → desc → none の順で切り替わる
 */
function toggleSort() {
  if (currentSort === "none") {
    currentSort = "asc";
  } else if (currentSort === "asc") {
    currentSort = "desc";
  } else {
    currentSort = "none";
  }

  updateSortButton();
  applyCurrentFilter();
  chrome.storage.local.set({ sortPreference: currentSort });
}

/**
 * ソートボタンの表示を更新する
 */
function updateSortButton() {
  const btn = elements.sortBtn;
  const label = elements.sortLabel;

  btn.classList.remove("active", "desc");

  if (currentSort === "asc") {
    btn.classList.add("active");
    label.textContent = "A-Z";
  } else if (currentSort === "desc") {
    btn.classList.add("active", "desc");
    label.textContent = "Z-A";
  } else {
    label.textContent = "A-Z";
  }
}

/**
 * 現在の検索・ソート条件でアプリ一覧を再描画する
 */
function applyCurrentFilter() {
  const query = elements.searchInput.value;
  searchApps(query);
}

/**
 * 保存された表示設定を読み込む
 */
async function loadViewPreference() {
  const data = await chrome.storage.local.get(["viewPreference", "sortPreference"]);
  if (data.viewPreference) {
    setView(data.viewPreference);
  }
  if (data.sortPreference) {
    currentSort = data.sortPreference;
    updateSortButton();
    applyCurrentFilter();
  }
}

/**
 * アプリデータをJSONファイルとしてエクスポートする
 */
function exportData() {
  const exportObj = {
    apps: allApps,
    exportedAt: new Date().toISOString(),
    count: allApps.length,
  };

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `my-apps-export-${formatDateForFile(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("エクスポートしました");
}

/**
 * トースト通知を表示する
 * @param {string} message - 表示するメッセージ
 */
function showToast(message) {
  // 既存のトーストを削除
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

/**
 * 日時をフォーマットする
 * @param {Date} date - 日付オブジェクト
 * @returns {string} フォーマットされた日時文字列
 */
function formatDate(date) {
  const now = new Date();
  const diff = now - date;

  // 1分以内
  if (diff < 60000) return "たった今";
  // 1時間以内
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  // 24時間以内
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ファイル名用の日時フォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYYMMDD-HHmmss形式の文字列
 */
function formatDateForFile(date) {
  return date
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15);
}

/**
 * HTMLエスケープ
 * @param {string} str - エスケープ対象の文字列
 * @returns {string} エスケープ済みの文字列
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 初期化実行
document.addEventListener("DOMContentLoaded", init);
