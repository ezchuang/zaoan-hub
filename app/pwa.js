(function () {
  const badge = document.getElementById("offline-badge");
  const updateNotice = document.getElementById("update-notice");
  const updateButton = document.getElementById("update-button");
  let registration;
  let checkVersion = 0;
  let updateTimer;
  let installFailed = false;
  let updateRequested = false;
  const watchedWorkers = new WeakSet();

  updateAppMode();
  updateNetwork();
  window.matchMedia("(display-mode: standalone)").addEventListener("change", updateAppMode);
  window.addEventListener("online", () => {
    updateNetwork();
    registration?.update().catch(() => {});
  });
  window.addEventListener("offline", updateNetwork);

  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    setBadge(badge, window.isSecureContext ? "此瀏覽器無法離線使用" : "離線使用需要 HTTPS", "warn");
    return;
  }

  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    clearTimeout(updateTimer);
    if (hadController) {
      if (window.dispatchEvent(new CustomEvent("zaoan:before-reload", { cancelable: true, detail: { discardForms: updateRequested } }))) {
        window.location.reload();
      } else {
        setBadge(badge, "資料尚未儲存，請先備份再重新開啟", "warn");
        if (updateNotice) updateNotice.hidden = false;
        if (updateButton) updateButton.disabled = false;
      }
    } else {
      hadController = true;
      refreshStatus();
    }
  });

  updateButton?.addEventListener("click", () => {
    if (!window.confirm("將重新開啟新版。已保存的名單與草稿會保留；尚未按「新增」或「建立」的表單內容不會保留。現在更新嗎？")) return;
    if (!window.dispatchEvent(new CustomEvent("zaoan:before-reload", { cancelable: true, detail: { discardForms: true } }))) return;
    if (!registration?.waiting) {
      window.location.reload();
      return;
    }
    updateButton.disabled = true;
    updateRequested = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    updateTimer = setTimeout(() => {
      updateButton.disabled = false;
      updateRequested = false;
      setBadge(badge, "更新尚未完成，請稍後再試", "warn");
    }, 10000);
  });

  register();

  async function register() {
    try {
      registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      registration.addEventListener("updatefound", () => watchWorker(registration.installing));
      watchWorker(registration.installing);
      watchWorker(registration.active);
      refreshStatus();
    } catch (error) {
      if (navigator.serviceWorker.controller) {
        refreshStatus();
      } else {
        setBadge(badge, "離線準備未完成，請連網後再開啟", "warn");
      }
    }
  }

  function watchWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    if (worker.state === "installing") installFailed = false;
    worker.addEventListener("statechange", () => {
      if (worker.state === "redundant") installFailed = true;
      refreshStatus();
    });
  }

  async function refreshStatus() {
    const version = ++checkVersion;
    if (updateNotice) updateNotice.hidden = !registration?.waiting;
    const controller = navigator.serviceWorker.controller;
    if (!controller || controller.state !== "activated") {
      setBadge(badge, installFailed
        ? "離線準備失敗，請連網後重新開啟" : "正在準備離線使用…", "warn");
      return;
    }
    const ready = await checkCache(controller);
    if (version !== checkVersion) return;
    setBadge(badge, ready ? "已準備好離線使用" : "離線資料尚未完整，請連網確認更新", ready ? "ok" : "warn");
  }

  function checkCache(controller) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (ready) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(ready);
      };
      const timer = setTimeout(() => finish(false), 4000);
      channel.port1.onmessage = (event) => finish(event.data?.ready === true);
      try {
        controller.postMessage({ type: "CACHE_STATUS" }, [channel.port2]);
      } catch (error) {
        channel.port2.close();
        finish(false);
      }
    });
  }

  function updateAppMode() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    setBadge(document.getElementById("app-mode-badge"), standalone ? "已從主畫面開啟" : "瀏覽器模式", standalone ? "ok" : "");
  }

  function updateNetwork() {
    setBadge(document.getElementById("network-badge"), navigator.onLine ? "目前有網路連線" : "目前離線，LINE 送出需連網", navigator.onLine ? "" : "offline");
  }

  function setBadge(element, text, tone) {
    if (!element) return;
    element.textContent = text;
    element.classList.remove("ok", "warn", "offline");
    if (tone) element.classList.add(tone);
  }
})();
