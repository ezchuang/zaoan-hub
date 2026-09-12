(function () {
  const MAX_CONTACTS = 500;
  const MAX_GROUPS = 100;
  const MAX_GROUP_MEMBERS = 500;
  const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const VALID_CHANNELS = new Set(["line", "imessage", "email", "unknown"]);

  function normalizeState(state) {
    if (!isRecord(state) || !Array.isArray(state.contacts) || !Array.isArray(state.groups) || !isRecord(state.campaign)) {
      throw new Error("這不是完整的名單備份，需包含親友、常用名單與草稿");
    }

    const { contacts, groups, campaign } = state;

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

      if (!Array.isArray(group.contactIds)) throw new Error("常用名單缺少成員資料");
      const rawContactIds = group.contactIds;
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

    if (campaign.selectedContactIds !== undefined && !Array.isArray(campaign.selectedContactIds)) {
      throw new Error("勾選名單格式不正確");
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
        title: normalizeText(campaign.title ?? "今天的早安圖", 30, "發送標題"),
        sender: normalizeText(campaign.sender ?? "", 20, "署名"),
        message: normalizeText(campaign.message ?? "早安，祝大家今天平安順心、心情愉快。", 500, "祝福文字"),
        selectedGroupId,
        selectedContactIds,
        sendMode: "share-sheet"
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
    const id = value;
    if (typeof id !== "string" || !VALID_ID.test(id)) {
      throw new Error(`${fieldName} 格式不正確`);
    }
    return id;
  }

  function normalizeText(value, maxLength, fieldName, required = false) {
    if (value != null && typeof value !== "string") throw new Error(`${fieldName} 必須是文字`);
    const text = (value ?? "").trim();
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
        sender: "",
        message: "早安，祝大家今天平安順心、心情愉快。",
        selectedGroupId: "",
        selectedContactIds: [],
        sendMode: "share-sheet"
      }
    };
  }

  window.ZaoanState = Object.freeze({
    normalize: normalizeState,
    validatePayloadMetadata,
    createEmpty: createEmptyState
  });
})();
