(function () {
  const storage = window.ZaoanStorage;
  const MAX_IMPORT_BYTES = 1024 * 1024;
  const normalizeState = window.ZaoanState.normalize;
  const validatePayloadMetadata = window.ZaoanState.validatePayloadMetadata;

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
    try {
      const state = normalizeState(window.ZaoanApp.getState());
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
    } catch (error) {
      setStatus(`無法建立備份：${error instanceof Error ? error.message : "請確認裝置儲存空間"}`);
    }
  }

  async function handleImportState(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      if (file.size > MAX_IMPORT_BYTES) {
        throw new Error("檔案不可超過 1 MB");
      }

      const text = await file.text();
      const payload = JSON.parse(text);
      validatePayloadMetadata(payload);
      const nextState = normalizeState(payload?.state || payload);

      if (!window.confirm(`將還原 ${nextState.contacts.length} 位親友、${nextState.groups.length} 組名單與祝福草稿，並取代目前資料。請先下載目前資料的備份。確定還原嗎？`)) {
        elements.importFile.value = "";
        return;
      }

      storage.setState(JSON.stringify(nextState));
      setStatus("已匯入全部資料，頁面即將重新載入。");
      window.location.reload();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "檔案格式不正確";
      setStatus(`匯入失敗：${reason}`);
    } finally {
      elements.importFile.value = "";
    }
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
      elements.statusBox.scrollIntoView({ block: "nearest" });
      return;
    }

    window.alert(message);
  }
})();
