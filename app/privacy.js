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
    let sharedMode;
    try { sharedMode = storage.isSharedDeviceMode(); } catch (error) { return; }
    const message = sharedMode
      ? "要把資料留在這台裝置嗎？關閉分頁後仍會保留，請只在自己的裝置使用。"
      : "要改用共用裝置模式嗎？資料會移到目前分頁。請先關閉本程式的其他分頁，離開前也請備份並清空資料。";

    if (!window.confirm(message)) {
      return;
    }
    if (!window.dispatchEvent(new Event("zaoan:before-reload", { cancelable: true }))) {
      elements.copy.textContent = "目前資料尚未安全儲存，請先備份，暫不切換模式。";
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
      elements.copy.textContent = "切換失敗；這個瀏覽器可能不允許儲存資料。";
    }
  }

  function render() {
    let sharedMode;
    try { sharedMode = storage.isSharedDeviceMode(); } catch (error) {
      elements.badge.textContent = "無法使用裝置儲存";
      elements.copy.textContent = "目前無法保存資料，請勿關閉尚未備份的頁面。";
      elements.button.disabled = true;
      return;
    }
    if (sharedMode) {
      elements.badge.textContent = "共用裝置模式";
      elements.badge.classList.add("warn");
      elements.button.textContent = "改為留在這台裝置";
      elements.copy.textContent = "資料改放在目前分頁。瀏覽器還原分頁時仍可能保留資料，因此離開前請先備份並清空。";
      return;
    }

    elements.badge.textContent = "保留在此裝置";
    elements.badge.classList.add("ok");
    elements.button.textContent = "啟用共用裝置模式";
    elements.copy.textContent = "關閉網頁後，名單與草稿仍會保留在這個瀏覽器。公務或共用電腦建議改用共用裝置模式。";
  }
})();
