(function () {
  const GUIDE_STORAGE_KEY = "zaoan-hub-guide-v1";
  const checkboxes = Array.from(document.querySelectorAll("[data-guide-step]"));
  const state = loadGuideState();

  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
    state.added_home_screen = true;
  }
  checkboxes.forEach((checkbox) => {
    checkbox.checked = state[checkbox.dataset.guideStep] === true;
    checkbox.addEventListener("change", () => {
      state[checkbox.dataset.guideStep] = checkbox.checked;
      try {
        const target = window.ZaoanStorage.isSharedDeviceMode() ? sessionStorage : localStorage;
        target.setItem(GUIDE_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        document.getElementById("guide-storage-warning").hidden = false;
      }
      updateProgress();
    });
  });
  updateProgress();
  inspectAppData();

  function updateProgress() {
    const count = checkboxes.filter((checkbox) => checkbox.checked).length;
    document.getElementById("guide-progress").textContent = count === checkboxes.length
      ? "三步都完成了。下次從主畫面打開，就能準備早安圖。"
      : `已完成 ${count} / ${checkboxes.length} 步；照自己的步調慢慢來。`;
  }

  function loadGuideState() {
    try {
      const target = window.ZaoanStorage.isSharedDeviceMode() ? sessionStorage : localStorage;
      const parsed = JSON.parse(target.getItem(GUIDE_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      document.getElementById("guide-storage-warning").hidden = false;
      return {};
    }
  }

  function inspectAppData() {
    try {
      const parsed = JSON.parse(window.ZaoanStorage.getState() || "{}");
      const count = Array.isArray(parsed?.contacts) ? parsed.contacts.length : 0;
      document.getElementById("guide-data-copy").textContent = count
        ? `這個版本目前有 ${count} 位親友資料。這不代表已送出或已完成還原。`
        : "目前沒有親友名單。可直接分享，不必先匯入資料。";
    } catch (error) {
      document.getElementById("guide-data-copy").textContent = "暫時無法讀取資料，請回設定確認。";
    }
  }
})();
