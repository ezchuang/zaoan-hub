(function () {
  const STORAGE_KEY = "zaoan-hub-state-v1";

  const elements = {
    exportButton: document.getElementById("export-state-button"),
    importButton: document.getElementById("import-state-button"),
    importFile: document.getElementById("import-state-file"),
    statusBox: document.getElementById("status-box")
  };

  if (!elements.exportButton || !elements.importButton || !elements.importFile) {
    return;
  }

  elements.exportButton.addEventListener("click", handleExportState);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", handleImportState);

  function handleExportState() {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    const state = rawState ? JSON.parse(rawState) : createEmptyState();
    const payload = {
      app: "zaoan-hub",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      state
    };

    downloadTextFile(
      `zaoan-hub-state-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2)
    );
    setStatus("已匯出全部資料，可傳到另一台裝置再匯入。");
  }

  async function handleImportState(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const nextState = normalizeState(payload?.state || payload);

      if (!window.confirm("匯入會覆蓋目前這台裝置的本地資料，確定要繼續嗎？")) {
        elements.importFile.value = "";
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setStatus("已匯入全部資料，頁面即將重新載入。");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      console.error("Failed to import state", error);
      setStatus("匯入失敗，請確認是 Zaoan Hub 匯出的 JSON 檔。");
    } finally {
      elements.importFile.value = "";
    }
  }

  function normalizeState(state) {
    if (!state || typeof state !== "object") {
      throw new Error("Invalid state payload");
    }

    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const groups = Array.isArray(state.groups) ? state.groups : [];
    const campaign = state.campaign && typeof state.campaign === "object" ? state.campaign : {};

    return {
      contacts: contacts.map((contact) => ({
        id: String(contact.id || createId("c")),
        name: String(contact.name || "").trim(),
        channel: String(contact.channel || "unknown"),
        note: String(contact.note || "").trim()
      })).filter((contact) => contact.name),
      groups: groups.map((group) => ({
        id: String(group.id || createId("g")),
        name: String(group.name || "").trim(),
        contactIds: Array.isArray(group.contactIds) ? group.contactIds.map(String) : []
      })).filter((group) => group.name),
      campaign: {
        title: String(campaign.title || "今天的早安圖"),
        sender: String(campaign.sender || "家族早安小編"),
        message: String(campaign.message || "早安，祝大家今天平安順心、心情愉快。"),
        selectedGroupId: String(campaign.selectedGroupId || ""),
        selectedContactIds: Array.isArray(campaign.selectedContactIds)
          ? campaign.selectedContactIds.map(String)
          : [],
        sendMode: campaign.sendMode === "official-channel" ? "official-channel" : "share-sheet"
      }
    };
  }

  function createEmptyState() {
    return {
      contacts: [],
      groups: [],
      campaign: {
        title: "今天的早安圖",
        sender: "家族早安小編",
        message: "早安，祝大家今天平安順心、心情愉快。",
        selectedGroupId: "",
        selectedContactIds: [],
        sendMode: "share-sheet"
      }
    };
  }

  function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function setStatus(message) {
    if (elements.statusBox) {
      elements.statusBox.textContent = message;
      return;
    }

    window.alert(message);
  }
})();
