(function () {
  const storage = window.ZaoanStorage;
  const elements = {
    badge: document.getElementById("privacy-mode-badge"),
    button: document.getElementById("privacy-mode-button"),
    copy: document.getElementById("privacy-mode-copy")
  };

  if (!storage || !elements.badge || !elements.button || !elements.copy) {
    return;
  }

  render();
  elements.button.addEventListener("click", handleToggle);

  function handleToggle() {
    const sharedMode = storage.isSharedDeviceMode();
    const message = sharedMode
      ? "要改回永久儲存嗎？目前分頁中的資料會移回這個 browser profile。"
      : "要啟用共用裝置模式嗎？資料會移到目前 page session，不再寫入永久 localStorage。";

    if (!window.confirm(message)) {
      return;
    }

    try {
      if (sharedMode) {
        storage.disableSharedDeviceMode();
      } else {
        storage.enableSharedDeviceMode();
      }
      window.location.reload();
    } catch (error) {
      console.error("Failed to change privacy mode", error);
      elements.copy.textContent = "切換失敗；這個瀏覽器可能禁止本機 storage。";
    }
  }

  function render() {
    if (storage.isSharedDeviceMode()) {
      elements.badge.textContent = "共用裝置模式";
      elements.badge.classList.add("warn");
      elements.button.textContent = "改回永久儲存";
      elements.copy.textContent = "資料只保留在目前 page session，通常會在分頁關閉後清除。離開前請先匯出全部資料。";
      return;
    }

    elements.badge.textContent = "永久儲存模式";
    elements.badge.classList.add("ok");
    elements.button.textContent = "啟用共用裝置模式";
    elements.copy.textContent = "目前資料會留在這個 browser profile。公務或共用電腦建議切換共用裝置模式。";
  }
})();
