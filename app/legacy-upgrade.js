(function () {
  // v1-v5 served network HTML with cached scripts. This new path bypasses their
  // allowlist so an incompatible old shell can update without erasing local data.
  window.addEventListener("DOMContentLoaded", async () => {
    if (window.ZaoanApp || !("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    const notice = document.getElementById("update-notice");
    const button = document.getElementById("update-button");
    notice.hidden = false;
    notice.querySelector("span").textContent = "偵測到舊版離線程式。請完成更新，原有名單會保留，不需要清除瀏覽器資料。";
    button.textContent = "正在準備相容更新…";
    button.disabled = true;
    let accepted = false;
    let registration;
    const sync = () => {
      button.disabled = !registration?.waiting;
      button.textContent = registration?.waiting ? "保留名單並更新" : "請連網後重新開啟";
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      sync();
      if (accepted) window.location.reload();
    });
    button.addEventListener("click", () => {
      if (!registration?.waiting || !window.confirm("將完成版本更新並重新開啟。原有名單會保留；本次尚未儲存的輸入不會保留。繼續嗎？")) return;
      accepted = true;
      button.disabled = true;
      button.textContent = "正在更新…";
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
    try {
      registration = await navigator.serviceWorker.getRegistration();
      if (!registration) { sync(); return; }
      const watch = () => {
        registration.installing?.addEventListener("statechange", sync);
        sync();
      };
      registration.addEventListener("updatefound", watch);
      watch();
      await registration.update();
      watch();
    } catch (error) {
      sync();
    }
  });
})();
