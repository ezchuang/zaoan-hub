(function () {
  const STORAGE_KEY = "zaoan-hub-state-v1";
  const MAX_IMPORT_BYTES = 1024 * 1024;
  const MAX_CONTACTS = 500;
  const MAX_GROUPS = 100;
  const MAX_GROUP_MEMBERS = 500;
  const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const VALID_CHANNELS = new Set(["line", "imessage", "email", "unknown"]);

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
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      const state = rawState ? normalizeState(JSON.parse(rawState)) : createEmptyState();
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
      console.error("Failed to export state", error);
      setStatus("匯出失敗，本機資料格式可能已損壞。");
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

      if (!window.confirm("匯入會覆蓋目前這台裝置的本地資料，確定要繼續嗎？")) {
        elements.importFile.value = "";
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setStatus("已匯入全部資料，頁面即將重新載入。");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      console.error("Failed to import state", error);
      const reason = error instanceof Error ? error.message : "檔案格式不正確";
      setStatus(`匯入失敗：${reason}`);
    } finally {
      elements.importFile.value = "";
    }
  }

  function normalizeState(state) {
    if (!isRecord(state)) {
      throw new Error("Invalid state payload");
    }

    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const groups = Array.isArray(state.groups) ? state.groups : [];
    const campaign = isRecord(state.campaign) ? state.campaign : {};

    if (contacts.length > MAX_CONTACTS) {
      throw new Error(`聯絡人不可超過 ${MAX_CONTACTS} 位`);
    }

    if (groups.length > MAX_GROUPS) {
      throw new Error(`群組不可超過 ${MAX_GROUPS} 組`);
    }

    const contactIds = new Set();
    const normalizedContacts = contacts.map((contact, index) => {
      if (!isRecord(contact)) {
        throw new Error(`第 ${index + 1} 位聯絡人格式不正確`);
      }

      const id = normalizeId(contact.id, `第 ${index + 1} 位聯絡人 ID`);
      if (contactIds.has(id)) {
        throw new Error(`聯絡人 ID 重複：${id}`);
      }
      contactIds.add(id);

      const channel = String(contact.channel || "unknown");
      if (!VALID_CHANNELS.has(channel)) {
        throw new Error(`第 ${index + 1} 位聯絡人的通道不正確`);
      }

      return {
        id,
        name: normalizeText(contact.name, 20, `第 ${index + 1} 位聯絡人姓名`, true),
        channel,
        note: normalizeText(contact.note, 40, `第 ${index + 1} 位聯絡人備註`)
      };
    });

    const groupIds = new Set();
    const normalizedGroups = groups.map((group, index) => {
      if (!isRecord(group)) {
        throw new Error(`第 ${index + 1} 個群組格式不正確`);
      }

      const id = normalizeId(group.id, `第 ${index + 1} 個群組 ID`);
      if (groupIds.has(id)) {
        throw new Error(`群組 ID 重複：${id}`);
      }
      groupIds.add(id);

      const rawContactIds = Array.isArray(group.contactIds) ? group.contactIds : [];
      if (rawContactIds.length > MAX_GROUP_MEMBERS) {
        throw new Error(`單一群組不可超過 ${MAX_GROUP_MEMBERS} 位成員`);
      }

      const normalizedContactIds = [...new Set(rawContactIds.map((contactId) => normalizeId(contactId, "群組成員 ID")))];
      if (normalizedContactIds.some((contactId) => !contactIds.has(contactId))) {
        throw new Error(`第 ${index + 1} 個群組包含不存在的聯絡人`);
      }

      return {
        id,
        name: normalizeText(group.name, 20, `第 ${index + 1} 個群組名稱`, true),
        contactIds: normalizedContactIds
      };
    });

    const selectedGroupId = campaign.selectedGroupId
      ? normalizeId(campaign.selectedGroupId, "目前群組 ID")
      : "";
    if (selectedGroupId && !groupIds.has(selectedGroupId)) {
      throw new Error("目前選取的群組不存在");
    }

    const selectedContactIds = Array.isArray(campaign.selectedContactIds)
      ? [...new Set(campaign.selectedContactIds.map((contactId) => normalizeId(contactId, "收件者 ID")))]
      : [];
    if (selectedContactIds.length > MAX_CONTACTS || selectedContactIds.some((contactId) => !contactIds.has(contactId))) {
      throw new Error("收件者清單包含不存在的聯絡人");
    }

    return {
      contacts: normalizedContacts,
      groups: normalizedGroups,
      campaign: {
        title: normalizeText(campaign.title || "今天的早安圖", 30, "發送標題", true),
        sender: normalizeText(campaign.sender || "家族早安小編", 20, "署名", true),
        message: normalizeText(campaign.message || "早安，祝大家今天平安順心、心情愉快。", 500, "祝福文字", true),
        selectedGroupId,
        selectedContactIds,
        sendMode: campaign.sendMode === "official-channel" ? "official-channel" : "share-sheet"
      }
    };
  }

  function validatePayloadMetadata(payload) {
    if (!isRecord(payload)) {
      throw new Error("檔案內容必須是 JSON object");
    }

    if (payload.app !== undefined && payload.app !== "zaoan-hub") {
      throw new Error("這不是 Zaoan Hub 匯出的資料");
    }

    if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
      throw new Error("不支援這個備份版本");
    }
  }

  function normalizeId(value, fieldName) {
    const id = String(value || "");
    if (!VALID_ID.test(id)) {
      throw new Error(`${fieldName} 格式不正確`);
    }
    return id;
  }

  function normalizeText(value, maxLength, fieldName, required = false) {
    const text = String(value || "").trim();
    if (required && !text) {
      throw new Error(`${fieldName} 不可空白`);
    }
    if (text.length > maxLength) {
      throw new Error(`${fieldName} 不可超過 ${maxLength} 個字元`);
    }
    return text;
  }

  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
