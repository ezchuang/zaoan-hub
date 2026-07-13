(function () {
  const GUIDE_STORAGE_KEY = "zaoan-hub-guide-v1";
  const appStorage = window.ZaoanStorage;

  const elements = {
    modeBadge: document.getElementById("guide-mode-badge"),
    modeCopy: document.getElementById("guide-mode-copy"),
    offlineBadge: document.getElementById("guide-offline-badge"),
    offlineCopy: document.getElementById("guide-offline-copy"),
    dataBadge: document.getElementById("guide-data-badge"),
    dataCopy: document.getElementById("guide-data-copy"),
    checkboxes: Array.from(document.querySelectorAll("[data-guide-step]"))
  };

  const state = loadGuideState();

  init();

  function init() {
    hydrateChecklist();
    syncDetectedState();
    bindEvents();
    registerServiceWorker();
  }

  function bindEvents() {
    elements.checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        state[checkbox.dataset.guideStep] = checkbox.checked;
        persistGuideState();
      });
    });

    window.addEventListener("online", syncDetectedState);
    window.addEventListener("offline", syncDetectedState);
  }

  function hydrateChecklist() {
    elements.checkboxes.forEach((checkbox) => {
      checkbox.checked = Boolean(state[checkbox.dataset.guideStep]);
    });
  }

  function syncDetectedState() {
    const standalone = isStandalone();
    const hasAppData = hasPortableAppData();

    if (standalone) {
      state.added_home_screen = true;
      persistGuideState();
      hydrateChecklist();
      setCard(elements.modeBadge, elements.modeCopy, "已從主畫面打開", "這台手機目前是以獨立 App 模式開啟。", "ok");
    } else if (isIOS()) {
      setCard(elements.modeBadge, elements.modeCopy, "請先用 Safari", "第一次安裝請務必從 Safari 打開，之後再加入主畫面。", "warn");
    } else {
      setCard(elements.modeBadge, elements.modeCopy, "目前不是 iPhone Safari", "這頁主要是給 iPhone 首次安裝使用；桌面瀏覽器可用來先整理名單。", "warn");
    }

    if (navigator.onLine) {
      setCard(elements.offlineBadge, elements.offlineCopy, "目前在線上", "現在可以完成 service worker 快取與加入主畫面。", "ok");
    } else {
      setCard(elements.offlineBadge, elements.offlineCopy, "目前離線中", "若先前已成功安裝過，這不影響主程式離線開啟。", "offline");
    }

    if (hasAppData) {
      state.data_imported = true;
      persistGuideState();
      hydrateChecklist();
      setCard(elements.dataBadge, elements.dataCopy, "已偵測到名單資料", "這台裝置已經有 Zaoan Hub 本機資料，可直接進主程式確認。", "ok");
    } else {
      setCard(elements.dataBadge, elements.dataCopy, "尚未偵測到名單資料", "若你先在公務電腦整理名單，請先把 JSON 匯到這台 iPhone。", "warn");
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setCard(elements.offlineBadge, elements.offlineCopy, "瀏覽器不支援離線快取", "這個瀏覽器無法提供完整的主畫面離線體驗。", "warn");
      return;
    }

    if (!isSecureOrigin()) {
      setCard(elements.offlineBadge, elements.offlineCopy, "正式安裝需要 HTTPS", "開發時 localhost 可以測，但要讓 iPhone 正式安裝仍建議用 HTTPS。", "warn");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      setCard(elements.offlineBadge, elements.offlineCopy, "離線快取已啟用", "這台裝置已可把導引頁與主程式快取到本機。", "ok");

      if (registration.waiting) {
        setCard(elements.offlineBadge, elements.offlineCopy, "有新版待更新", "重開一次 App 或導引頁，就會切到最新快取版本。", "warn");
      }
    } catch (error) {
      console.error("Failed to register service worker from guide", error);
      setCard(elements.offlineBadge, elements.offlineCopy, "離線快取註冊失敗", "請先確認是從 Safari 打開，且目前網址可正常連線。", "offline");
    }
  }

  function loadGuideState() {
    try {
      const raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error("Failed to load guide state", error);
      return {};
    }
  }

  function persistGuideState() {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(state));
  }

  function hasPortableAppData() {
    try {
      const raw = appStorage.getState();
      if (!raw) {
        return false;
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.contacts) && parsed.contacts.length > 0;
    } catch (error) {
      console.error("Failed to inspect app data", error);
      return false;
    }
  }

  function setCard(titleElement, copyElement, title, copy, tone) {
    if (titleElement) {
      titleElement.textContent = title;
      titleElement.classList.remove("ok", "warn", "offline");
      if (tone) {
        titleElement.classList.add(tone);
      }
    }

    if (copyElement) {
      copyElement.textContent = copy;
    }
  }

  function isStandalone() {
    const mediaMatch = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    return Boolean(mediaMatch || window.navigator.standalone);
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isSecureOrigin() {
    return window.isSecureContext || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  }
})();
