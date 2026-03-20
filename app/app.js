(function () {
  const STORAGE_KEY = "zaoan-hub-state-v1";

  const sampleState = {
    contacts: [
      { id: "c1", name: "王阿姨", channel: "line", note: "只用 iPhone" },
      { id: "c2", name: "陳伯伯", channel: "imessage", note: "早上 8 點後比較會看" },
      { id: "c3", name: "李媽媽", channel: "line", note: "社區群組常聯絡" },
      { id: "c4", name: "林叔叔", channel: "email", note: "偶爾看電腦信箱" },
      { id: "c5", name: "張阿嬤", channel: "line", note: "需要字大一點" }
    ],
    groups: [
      { id: "g1", name: "社區朋友", contactIds: ["c1", "c3", "c5"] },
      { id: "g2", name: "家族群", contactIds: ["c2", "c4"] }
    ],
    campaign: {
      title: "今天的早安圖",
      sender: "家族早安小編",
      message: "早安，祝大家今天平安順心、心情愉快。",
      selectedGroupId: "g1",
      selectedContactIds: ["c1", "c3", "c5"],
      sendMode: "share-sheet"
    }
  };

  const state = loadState();

  const elements = {
    seedButton: document.getElementById("seed-button"),
    resetButton: document.getElementById("reset-button"),
    contactForm: document.getElementById("contact-form"),
    groupForm: document.getElementById("group-form"),
    campaignForm: document.getElementById("campaign-form"),
    contactsList: document.getElementById("contacts-list"),
    groupsList: document.getElementById("groups-list"),
    contactsEmpty: document.getElementById("contacts-empty"),
    groupsEmpty: document.getElementById("groups-empty"),
    groupMembersPicker: document.getElementById("group-members-picker"),
    campaignRecipientsPicker: document.getElementById("campaign-recipients-picker"),
    campaignGroup: document.getElementById("campaign-group"),
    previewCanvas: document.getElementById("preview-canvas"),
    recipientPreview: document.getElementById("recipient-preview"),
    previewSummary: document.getElementById("preview-summary"),
    statusBox: document.getElementById("status-box"),
    shareButton: document.getElementById("share-button"),
    exportButton: document.getElementById("export-button"),
    contactCount: document.getElementById("contact-count"),
    groupCount: document.getElementById("group-count"),
    selectedCount: document.getElementById("selected-count")
  };

  bindEvents();
  render();

  function bindEvents() {
    elements.seedButton.addEventListener("click", handleSeedData);
    elements.resetButton.addEventListener("click", handleResetData);
    elements.contactForm.addEventListener("submit", handleAddContact);
    elements.groupForm.addEventListener("submit", handleAddGroup);
    elements.campaignForm.addEventListener("input", handleCampaignInput);
    elements.shareButton.addEventListener("click", handleShare);
    elements.exportButton.addEventListener("click", handleExport);

    document.querySelectorAll('input[name="send-mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.campaign.sendMode = input.value;
        syncModeCards();
        persistState();
        updatePreview();
      });
    });
  }

  function loadState() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return deepClone(sampleState);
      }

      const parsed = JSON.parse(stored);
      return {
        contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        campaign: {
          title: parsed.campaign?.title || sampleState.campaign.title,
          sender: parsed.campaign?.sender || sampleState.campaign.sender,
          message: parsed.campaign?.message || sampleState.campaign.message,
          selectedGroupId: parsed.campaign?.selectedGroupId || "",
          selectedContactIds: Array.isArray(parsed.campaign?.selectedContactIds)
            ? parsed.campaign.selectedContactIds
            : [],
          sendMode: parsed.campaign?.sendMode || "share-sheet"
        }
      };
    } catch (error) {
      console.error("Failed to load state", error);
      return deepClone(sampleState);
    }
  }

  function persistState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    renderContacts();
    renderGroups();
    renderGroupPickers();
    fillCampaignFields();
    syncModeCards();
    updatePreview();
    persistState();
  }

  function renderContacts() {
    elements.contactCount.textContent = `${state.contacts.length} 位`;
    elements.contactsEmpty.hidden = state.contacts.length > 0;
    elements.contactsList.innerHTML = state.contacts
      .map((contact) => {
        return `
          <article class="list-card">
            <div class="card-head">
              <div class="card-title">
                <strong>${escapeHtml(contact.name)}</strong>
                <span class="tag">${formatChannel(contact.channel)}</span>
              </div>
              <button class="button button-ghost" type="button" data-action="remove-contact" data-id="${contact.id}">
                刪除
              </button>
            </div>
            <p class="contact-note">${escapeHtml(contact.note || "沒有備註")}</p>
          </article>
        `;
      })
      .join("");

    elements.contactsList.querySelectorAll('[data-action="remove-contact"]').forEach((button) => {
      button.addEventListener("click", () => removeContact(button.dataset.id));
    });
  }

  function renderGroups() {
    elements.groupCount.textContent = `${state.groups.length} 組`;
    elements.groupsEmpty.hidden = state.groups.length > 0;
    elements.groupsList.innerHTML = state.groups
      .map((group) => {
        const names = group.contactIds
          .map((contactId) => findContact(contactId)?.name)
          .filter(Boolean);

        return `
          <article class="list-card">
            <div class="card-head">
              <div class="card-title">
                <strong>${escapeHtml(group.name)}</strong>
                <span class="tag">${names.length} 位成員</span>
              </div>
              <button class="button button-ghost" type="button" data-action="remove-group" data-id="${group.id}">
                刪除
              </button>
            </div>
            <p class="group-meta">${escapeHtml(names.join("、") || "沒有成員")}</p>
          </article>
        `;
      })
      .join("");

    elements.groupsList.querySelectorAll('[data-action="remove-group"]').forEach((button) => {
      button.addEventListener("click", () => removeGroup(button.dataset.id));
    });
  }

  function renderGroupPickers() {
    const contactPickerHtml = state.contacts
      .map((contact) => {
        const checked = state.campaign.selectedContactIds.includes(contact.id) ? "checked" : "";
        return `
          <label class="picker-chip">
            <input type="checkbox" data-role="campaign-contact" value="${contact.id}" ${checked}>
            <span>${escapeHtml(contact.name)}</span>
          </label>
        `;
      })
      .join("");

    const groupPickerHtml = state.contacts
      .map((contact) => {
        return `
          <label class="picker-chip">
            <input type="checkbox" data-role="group-member" value="${contact.id}">
            <span>${escapeHtml(contact.name)}</span>
          </label>
        `;
      })
      .join("");

    elements.groupMembersPicker.innerHTML = groupPickerHtml || '<p class="empty-state">先建立聯絡人，才能建立群組。</p>';
    elements.campaignRecipientsPicker.innerHTML =
      contactPickerHtml || '<p class="empty-state">先建立聯絡人，才能選發送對象。</p>';

    elements.campaignGroup.innerHTML = [
      '<option value="">不套用群組</option>',
      ...state.groups.map((group) => {
        const selected = group.id === state.campaign.selectedGroupId ? "selected" : "";
        return `<option value="${group.id}" ${selected}>${escapeHtml(group.name)}</option>`;
      })
    ].join("");

    elements.campaignRecipientsPicker.querySelectorAll('[data-role="campaign-contact"]').forEach((checkbox) => {
      checkbox.addEventListener("change", handleRecipientToggle);
    });
  }

  function fillCampaignFields() {
    document.getElementById("campaign-title").value = state.campaign.title;
    document.getElementById("campaign-sender").value = state.campaign.sender;
    document.getElementById("campaign-message").value = state.campaign.message;
    document.querySelector(`input[name="send-mode"][value="${state.campaign.sendMode}"]`).checked = true;
  }

  function handleSeedData() {
    Object.assign(state, deepClone(sampleState));
    render();
    setStatus("已載入示範名單，方便你直接試流程。");
  }

  function handleResetData() {
    if (!window.confirm("確定要清空本地資料嗎？")) {
      return;
    }

    Object.assign(state, {
      contacts: [],
      groups: [],
      campaign: {
        title: sampleState.campaign.title,
        sender: sampleState.campaign.sender,
        message: sampleState.campaign.message,
        selectedGroupId: "",
        selectedContactIds: [],
        sendMode: "share-sheet"
      }
    });

    render();
    setStatus("本地資料已清空。");
  }

  function handleAddContact(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const channel = String(form.get("channel") || "unknown");
    const note = String(form.get("note") || "").trim();

    if (!name) {
      setStatus("請先輸入聯絡人姓名。");
      return;
    }

    state.contacts.unshift({
      id: createId("c"),
      name,
      channel,
      note
    });

    event.currentTarget.reset();
    render();
    setStatus(`已新增聯絡人：${name}`);
  }

  function handleAddGroup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const selectedIds = Array.from(elements.groupMembersPicker.querySelectorAll('[data-role="group-member"]:checked')).map(
      (checkbox) => checkbox.value
    );

    if (!name) {
      setStatus("請先輸入群組名稱。");
      return;
    }

    if (selectedIds.length === 0) {
      setStatus("請至少選擇一位群組成員。");
      return;
    }

    state.groups.unshift({
      id: createId("g"),
      name,
      contactIds: selectedIds
    });

    event.currentTarget.reset();
    render();
    setStatus(`已建立群組：${name}`);
  }

  function removeContact(contactId) {
    state.contacts = state.contacts.filter((contact) => contact.id !== contactId);
    state.groups = state.groups
      .map((group) => ({
        ...group,
        contactIds: group.contactIds.filter((id) => id !== contactId)
      }))
      .filter((group) => group.contactIds.length > 0);

    state.campaign.selectedContactIds = state.campaign.selectedContactIds.filter((id) => id !== contactId);
    if (state.campaign.selectedGroupId && !findGroup(state.campaign.selectedGroupId)) {
      state.campaign.selectedGroupId = "";
    }

    render();
    setStatus("已刪除聯絡人。");
  }

  function removeGroup(groupId) {
    state.groups = state.groups.filter((group) => group.id !== groupId);
    if (state.campaign.selectedGroupId === groupId) {
      state.campaign.selectedGroupId = "";
    }

    render();
    setStatus("已刪除群組。");
  }

  function handleCampaignInput(event) {
    const target = event.target;

    if (target.id === "campaign-title") {
      state.campaign.title = target.value;
    }

    if (target.id === "campaign-sender") {
      state.campaign.sender = target.value;
    }

    if (target.id === "campaign-message") {
      state.campaign.message = target.value;
    }

    if (target.id === "campaign-group") {
      state.campaign.selectedGroupId = target.value;
      applyGroupSelection(target.value);
    }

    syncModeCards();
    persistState();
    updatePreview();
  }

  function handleRecipientToggle() {
    state.campaign.selectedContactIds = Array.from(
      elements.campaignRecipientsPicker.querySelectorAll('[data-role="campaign-contact"]:checked')
    ).map((checkbox) => checkbox.value);

    if (state.campaign.selectedGroupId) {
      const activeGroup = findGroup(state.campaign.selectedGroupId);
      const sameAsGroup =
        activeGroup &&
        activeGroup.contactIds.length === state.campaign.selectedContactIds.length &&
        activeGroup.contactIds.every((id) => state.campaign.selectedContactIds.includes(id));

      if (!sameAsGroup) {
        state.campaign.selectedGroupId = "";
        elements.campaignGroup.value = "";
      }
    }

    persistState();
    updatePreview();
  }

  function applyGroupSelection(groupId) {
    if (!groupId) {
      persistState();
      updatePreview();
      return;
    }

    const group = findGroup(groupId);
    state.campaign.selectedContactIds = group ? [...group.contactIds] : [];

    elements.campaignRecipientsPicker.querySelectorAll('[data-role="campaign-contact"]').forEach((checkbox) => {
      checkbox.checked = state.campaign.selectedContactIds.includes(checkbox.value);
    });

    persistState();
    updatePreview();
  }

  async function handleShare() {
    const recipients = getSelectedRecipients();
    if (recipients.length === 0) {
      setStatus("請先至少選擇一位收件者。");
      return;
    }

    try {
      const payload = await buildSharePayload();

      if (canShareFiles(payload.files)) {
        await navigator.share(payload);
        setStatus(`已開啟系統分享面板，準備送給 ${recipients.length} 位對象。`);
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: payload.title,
          text: payload.text
        });
        setStatus("裝置支援文字分享，但不一定支援圖片檔；已先叫出分享面板。");
        return;
      }

      await fallbackDownload(payload.files[0], payload.text);
      setStatus("此裝置不支援原生分享，已改成下載圖片並複製文字。");
    } catch (error) {
      if (error && error.name === "AbortError") {
        setStatus("已取消分享。");
        return;
      }

      console.error("share failed", error);
      setStatus("分享失敗，已改建議使用匯出發送批次。");
    }
  }

  function handleExport() {
    const recipients = getSelectedRecipients();
    if (recipients.length === 0) {
      setStatus("沒有可匯出的收件者。");
      return;
    }

    const batch = {
      exportedAt: new Date().toISOString(),
      strategy: state.campaign.sendMode,
      campaign: {
        title: state.campaign.title,
        sender: state.campaign.sender,
        message: state.campaign.message
      },
      recipients
    };

    downloadTextFile(
      `zaoan-batch-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(batch, null, 2)
    );

    setStatus(`已匯出 ${recipients.length} 位收件者的發送批次 JSON。`);
  }

  function updatePreview() {
    const recipients = getSelectedRecipients();
    elements.selectedCount.textContent = `${recipients.length} 位收件者`;
    elements.previewSummary.textContent =
      recipients.length > 0
        ? `${state.campaign.title}，由 ${state.campaign.sender} 發送給 ${recipients.length} 位對象`
        : "尚未選擇收件者";

    elements.recipientPreview.innerHTML = recipients
      .map((recipient) => `<li>${escapeHtml(recipient.name)}</li>`)
      .join("");

    drawPreview(recipients);
  }

  function drawPreview(recipients) {
    const canvas = elements.previewCanvas;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0b6e4f");
    gradient.addColorStop(0.55, "#1d8a74");
    gradient.addColorStop(1, "#efb11d");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,0.13)";
    context.beginPath();
    context.arc(width * 0.85, height * 0.14, 120, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.12)";
    context.beginPath();
    context.arc(width * 0.18, height * 0.82, 180, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff8ea";
    context.font = "bold 120px 'Noto Sans TC', 'PingFang TC', sans-serif";
    context.fillText("早安", 90, 190);

    context.font = "600 42px 'Noto Sans TC', 'PingFang TC', sans-serif";
    wrapText(context, state.campaign.message, 92, 280, width - 180, 58);

    context.fillStyle = "rgba(255,248,234,0.85)";
    context.font = "600 32px 'Noto Sans TC', 'PingFang TC', sans-serif";
    context.fillText(`收件對象：${recipients.length} 位`, 92, 492);

    context.fillStyle = "#fff8ea";
    context.font = "700 34px 'Noto Sans TC', 'PingFang TC', sans-serif";
    context.fillText(`來自 ${state.campaign.sender}`, 92, 546);
  }

  async function buildSharePayload() {
    const recipients = getSelectedRecipients();
    const text = [
      state.campaign.message,
      "",
      `這次預計送給：${recipients.map((recipient) => recipient.name).join("、")}`,
      `發送人：${state.campaign.sender}`
    ].join("\n");

    const file = await canvasToFile(elements.previewCanvas, "zaoan-placeholder.png");

    return {
      title: state.campaign.title,
      text,
      files: [file]
    };
  }

  function canShareFiles(files) {
    return Boolean(navigator.canShare && files && files.length && navigator.canShare({ files }));
  }

  async function fallbackDownload(file, text) {
    downloadBlob(file.name, file, file.type);

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error("clipboard failed", error);
      }
    }
  }

  function getSelectedRecipients() {
    return state.campaign.selectedContactIds
      .map((contactId) => findContact(contactId))
      .filter(Boolean)
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        channel: contact.channel,
        note: contact.note
      }));
  }

  function syncModeCards() {
    document.querySelectorAll("[data-mode-card]").forEach((card) => {
      card.classList.toggle("active", card.dataset.modeCard === state.campaign.sendMode);
    });
    updateActionButtons();
  }

  function updateActionButtons() {
    const shareMode = state.campaign.sendMode === "share-sheet";
    elements.shareButton.disabled = !shareMode;
    elements.shareButton.textContent = shareMode ? "手機分享" : "官方通道模式下請改用匯出";
  }

  function findContact(contactId) {
    return state.contacts.find((contact) => contact.id === contactId);
  }

  function findGroup(groupId) {
    return state.groups.find((group) => group.id === groupId);
  }

  function formatChannel(channel) {
    const mapping = {
      line: "LINE",
      imessage: "iMessage",
      email: "Email",
      unknown: "未確認"
    };
    return mapping[channel] || "未確認";
  }

  function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setStatus(message) {
    elements.statusBox.textContent = message;
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = Array.from(text);
    let line = "";
    let offset = 0;

    for (const word of words) {
      const testLine = `${line}${word}`;
      const { width } = context.measureText(testLine);
      if (width > maxWidth && line) {
        context.fillText(line, x, y + offset);
        line = word;
        offset += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) {
      context.fillText(line, x, y + offset);
    }
  }

  async function canvasToFile(canvas, filename) {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Canvas export failed"));
          return;
        }
        resolve(result);
      }, "image/png");
    });

    return new File([blob], filename, { type: "image/png" });
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    downloadBlob(filename, blob, blob.type);
  }

  function downloadBlob(filename, blob, mimeType) {
    const objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
