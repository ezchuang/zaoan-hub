(function () {
  const elements = {
    appModeBadge: document.getElementById("app-mode-badge"),
    offlineBadge: document.getElementById("offline-badge"),
    networkBadge: document.getElementById("network-badge"),
    installCopy: document.getElementById("install-copy"),
    installSteps: document.getElementById("install-steps")
  };

  init();

  function init() {
    updateAppMode();
    updateNetworkState();
    updateInstallInstructions();
    registerServiceWorker();

    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    if (window.matchMedia) {
      const displayModeQuery = window.matchMedia("(display-mode: standalone)");
      if (displayModeQuery.addEventListener) {
        displayModeQuery.addEventListener("change", updateAppMode);
      } else if (displayModeQuery.addListener) {
        displayModeQuery.addListener(updateAppMode);
      }
    }
  }

  function updateAppMode() {
    if (!elements.appModeBadge) {
      return;
    }

    if (isStandalone()) {
      setBadge(elements.appModeBadge, "主畫面 App 模式", "ok");
      if (elements.installCopy) {
        elements.installCopy.textContent =
          "這台手機已經可以像獨立 App 一樣開啟。只要這個版本曾成功載入，之後沒有 server 也能離線使用名單與產圖流程。";
      }
      return;
    }

    setBadge(elements.appModeBadge, "瀏覽器模式", "warn");
  }

  function updateNetworkState() {
    if (!elements.networkBadge) {
      return;
    }

    if (navigator.onLine) {
      setBadge(elements.networkBadge, "目前在線上", "ok");
      return;
    }

    setBadge(elements.networkBadge, "目前離線中", "offline");
  }

  function updateInstallInstructions() {
    if (!elements.installSteps) {
      return;
    }

    if (isStandalone()) {
      elements.installSteps.innerHTML = [
        "<li>目前已從主畫面開啟。</li>",
        "<li>聯絡人、群組與早安圖流程可離線使用。</li>",
        "<li>真正分享到 LINE / iMessage 時，仍需要目標 app 可用。</li>"
      ].join("");
      return;
    }

    if (isIOS()) {
      elements.installSteps.innerHTML = [
        "<li>用 iPhone Safari 打開這個網址。</li>",
        "<li>按分享按鈕，選「加入主畫面」。</li>",
        "<li>之後從主畫面打開，就能在沒有 server 的情況下離線使用已快取的版本。</li>"
      ].join("");
      return;
    }

    elements.installSteps.innerHTML = [
      "<li>第一次需要從 HTTPS 網址載入這個系統。</li>",
      "<li>支援 PWA 的瀏覽器可把它安裝成桌面或主畫面 App。</li>",
      "<li>沒有真正後端時，資料仍只會保存在目前這台裝置。</li>"
    ].join("");
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setBadge(elements.offlineBadge, "此瀏覽器不支援離線快取", "warn");
      return;
    }

    if (!isSecureOrigin()) {
      setBadge(elements.offlineBadge, "需要 HTTPS 才能正式啟用離線", "warn");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      setBadge(elements.offlineBadge, "離線快取已啟用", "ok");

      if (registration.waiting) {
        setBadge(elements.offlineBadge, "有新版本待套用，重開一次即可", "warn");
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) {
          return;
        }

        setBadge(elements.offlineBadge, "正在更新離線版本", "warn");
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setBadge(elements.offlineBadge, "新版已下載，重開 App 即可更新", "warn");
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setBadge(elements.offlineBadge, "已切換到最新離線版本", "ok");
      });
    } catch (error) {
      console.error("Failed to register service worker", error);
      setBadge(elements.offlineBadge, "離線快取註冊失敗", "offline");
    }
  }

  function setBadge(element, text, tone) {
    if (!element) {
      return;
    }

    element.textContent = text;
    element.classList.remove("ok", "warn", "offline");
    if (tone) {
      element.classList.add(tone);
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
