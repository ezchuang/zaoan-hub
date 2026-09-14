(function () {
  const storage = window.ZaoanStorage;

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

  let loadFailed = false;
  let storedSnapshot = null;
  let storageConflict = false;
  let shareFile = null;
  let previewVersion = 0;
  let sharing = false;
  const imageCache = new Map();
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
    selectedCount: document.getElementById("selected-count"),
    downloadButton: document.getElementById("download-button"),
    copyButton: document.getElementById("copy-button"),
    shareResult: document.getElementById("share-result"),
    shareHelp: document.getElementById("share-help"),
    nextGreetingButton: document.getElementById("next-greeting-button"),
    greetingEditor: document.getElementById("greeting-editor"),
    artworkStatus: document.getElementById("artwork-status"),
    receivedPicker: document.getElementById("received-picker"),
    replyChecklist: document.getElementById("reply-checklist"),
    dailyRepliesCount: document.getElementById("daily-replies-count"),
    pendingReplies: document.getElementById("pending-replies"),
    prepareRepliesButton: document.getElementById("prepare-replies-button"),
    draftStatus: document.getElementById("draft-status"),
    storageWarning: document.getElementById("storage-warning")
  };

  bindEvents();
  render();
  window.ZaoanApp = Object.freeze({
    getState() {
      if (loadFailed) throw new Error("原有資料無法讀取，請先修復或還原備份，避免把空白資料當成備份");
      refreshDailyView();
      return deepClone(state);
    }
  });
  showView(false);

  function bindEvents() {
    elements.seedButton.addEventListener("click", handleSeedData);
    elements.resetButton.addEventListener("click", handleResetData);
    elements.contactForm.addEventListener("submit", handleAddContact);
    elements.groupForm.addEventListener("submit", handleAddGroup);
    elements.campaignForm.addEventListener("input", handleCampaignInput);
    elements.campaignGroup.addEventListener("input", handleCampaignInput);
    document.getElementById("campaign-title").addEventListener("input", handleCampaignInput);
    document.getElementById("add-contact-shortcut").addEventListener("click", () => document.getElementById("contact-name").focus());
    elements.shareButton.addEventListener("click", handleShare);
    elements.exportButton.addEventListener("click", handleExport);
    elements.downloadButton.addEventListener("click", handleDownload);
    elements.copyButton.addEventListener("click", handleCopy);
    elements.receivedPicker.addEventListener("change", handleDailyToggle);
    elements.replyChecklist.addEventListener("change", handleDailyToggle);
    elements.nextGreetingButton.addEventListener("click", () => {
      if (sharing) return;
      window.ZaoanGreetings.next(state);
      fillCampaignFields();
      persistState();
      setShareStatus("");
      updatePreview();
    });
    document.getElementById("use-daily-button").addEventListener("click", () => {
      if (sharing) return;
      if (state.greeting.mode === "custom" && !window.confirm("改用今日推薦會取代目前的祝福文字，署名與名單會保留。確定更換嗎？")) return;
      window.ZaoanGreetings.apply(state);
      fillCampaignFields();
      persistState();
      updatePreview();
    });
    elements.prepareRepliesButton.addEventListener("click", () => {
      if (refreshDailyView(true)) return;
      window.location.hash = "today";
    });
    const refreshWhenVisible = () => { if (!document.hidden) refreshDailyView(true); };
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.setInterval(refreshWhenVisible, 60000);
    document.getElementById("edit-message-button").addEventListener("click", () => {
      openGreetingEditor();
      document.getElementById("campaign-message").scrollIntoView({ block: "center" });
    });
    elements.campaignForm.addEventListener("submit", (event) => event.preventDefault());
    window.addEventListener("hashchange", () => showView(true));
    window.addEventListener("zaoan:before-reload", (event) => {
      const pendingForm = ["contact-name", "contact-note", "group-name"].some((id) => document.getElementById(id).value.trim())
        || elements.groupMembersPicker.querySelector("input:checked");
      if (sharing || (pendingForm && !event.detail?.discardForms)) {
        event.preventDefault();
        setStatus(sharing ? "分享面板使用中，暫不重新開啟頁面。" : "尚有未新增的親友或未建立的名單，暫不重新開啟。請先完成表單，或在更新時確認捨棄這些輸入。");
        return;
      }
      if (!persistState()) event.preventDefault();
    });
    document.querySelectorAll("[data-message]").forEach((button) => {
      button.addEventListener("click", () => {
        state.campaign.message = button.dataset.message;
        state.greeting.mode = "custom";
        document.getElementById("campaign-message").value = state.campaign.message;
        persistState();
        updatePreview();
      });
    });
    document.getElementById("clear-selection-button").addEventListener("click", () => {
      state.campaign.selectedGroupId = "";
      state.campaign.selectedContactIds = [];
      render();
    });
  }

  function showView(focus) {
    refreshDailyView(focus);
    const name = window.location.hash.slice(1);
    const view = ["today", "contacts", "settings"].includes(name) ? name : "today";
    document.querySelectorAll("[data-view]").forEach((section) => {
      section.hidden = section.id !== view;
    });
    document.querySelectorAll("[data-view-link]").forEach((link) => {
      if (link.dataset.viewLink === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (focus) {
      document.getElementById(`${view}-title`).focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  function openGreetingEditor() {
    elements.greetingEditor.open = true;
    document.getElementById("campaign-message").focus();
  }

  function emptyState() {
    return window.ZaoanState.createEmpty();
  }

  function loadState() {
    try {
      const stored = storage.getState();
      storedSnapshot = stored;
      if (!stored) {
        return emptyState();
      }

      return window.ZaoanState.normalize(JSON.parse(stored));
    } catch (error) {
      loadFailed = true;
      return emptyState();
    }
  }

  function persistState() {
    try {
      if (loadFailed) throw new Error("Stored data could not be loaded");
      if (storage.getState() !== storedSnapshot) {
        storageConflict = true;
        throw new Error("Another tab changed the stored data");
      }
      const serialized = JSON.stringify(state);
      storage.setState(serialized);
      storedSnapshot = serialized;
      storageConflict = false;
      elements.draftStatus.textContent = storage.isSharedDeviceMode() ? "已儲存於此分頁" : "已儲存於此裝置";
      elements.storageWarning.hidden = true;
      return true;
    } catch (error) {
      elements.draftStatus.textContent = "尚未儲存";
      elements.storageWarning.textContent = storageConflict
        ? "其他分頁已變更或移動資料，這個分頁暫停儲存，避免蓋掉新資料。請先在設定下載本分頁的備份，再重新整理取得最新資料。"
        : loadFailed
        ? "原有資料無法讀取，未覆蓋舊資料。目前仍可製作圖片，但新變更不會儲存。請勿重新整理；可在設定還原備份，或確認不需舊資料後清空重試。"
        : "這台裝置暫時無法儲存資料。請勿關閉頁面或更新；目前的祝福仍可分享或下載。";
      elements.storageWarning.hidden = false;
      return false;
    }
  }

  function render() {
    window.ZaoanState.refreshDailyReplies(state);
    window.ZaoanGreetings.refresh(state);
    renderContacts();
    renderGroups();
    renderGroupPickers();
    fillCampaignFields();
    renderDailyReplies();
    updatePreview();
    return persistState();
  }

  function refreshDailyView(announce = false) {
    const dayChanged = window.ZaoanState.refreshDailyReplies(state);
    const greetingChanged = !sharing && !elements.campaignForm.contains(document.activeElement) && window.ZaoanGreetings.refresh(state);
    if (!dayChanged && !greetingChanged) return false;
    renderDailyReplies();
    if (greetingChanged) {
      fillCampaignFields();
      updatePreview();
    }
    persistState();
    if (announce && window.location.hash === "#contacts") elements.statusBox.textContent = "已換日，今天的回覆勾記重新開始。親友名單與手寫祝福都還在。";
    return true;
  }

  function renderDailyReplies() {
    const daily = state.dailyReplies;
    const dateLabel = new Intl.DateTimeFormat("zh-TW", {
      month: "long", day: "numeric", weekday: "long"
    }).format(new Date());
    document.getElementById("today-date").textContent = dateLabel;
    document.getElementById("daily-replies-date").textContent = `${dateLabel} · 手動記錄`;
    const pending = daily.receivedContactIds.filter((id) => !daily.repliedContactIds.includes(id));
    elements.dailyRepliesCount.textContent = daily.receivedContactIds.length
      ? `待回覆 ${pending.length} 位 · 已勾記 ${daily.repliedContactIds.length} 位` : "尚未勾記";
    elements.receivedPicker.innerHTML = state.contacts.map((contact) => `
      <label class="picker-chip"><input type="checkbox" data-role="daily-received" value="${escapeHtml(contact.id)}" ${daily.receivedContactIds.includes(contact.id) ? "checked" : ""}><span>${escapeHtml(contact.name)}</span></label>
    `).join("") || '<p class="empty-state">還沒有備忘名單。先新增親友或聊天室暱稱；不建立名單也能直接分享圖片。</p>';
    elements.replyChecklist.innerHTML = daily.receivedContactIds.map((id) => {
      const replied = daily.repliedContactIds.includes(id);
      return `<label class="reply-row"><input type="checkbox" data-role="daily-replied" value="${escapeHtml(id)}" ${replied ? "checked" : ""}><span><strong>${escapeHtml(findContact(id).name)}</strong><small>${replied ? "已手動標記回覆，可取消勾記" : "我已在 LINE 回覆，再勾這裡"}</small></span></label>`;
    }).join("");
    document.getElementById("daily-replies-empty").hidden = daily.receivedContactIds.length > 0;
    elements.pendingReplies.textContent = pending.length
      ? `待回覆：${pending.map((id) => findContact(id).name).join("、")}`
      : daily.receivedContactIds.length ? "今天勾記的對象都已手動標記回覆；是否送達仍以 LINE 為準。" : "";
    elements.prepareRepliesButton.disabled = pending.length === 0;
  }

  function handleDailyToggle(event) {
    const checkbox = event.target;
    if (!checkbox.matches('input[data-role="daily-received"], input[data-role="daily-replied"]')) return;
    // A click on yesterday's checklist must not silently become today's record.
    if (refreshDailyView(true)) return;
    const id = checkbox.value;
    if (!findContact(id)) return;
    const daily = state.dailyReplies;
    const received = checkbox.dataset.role === "daily-received";
    const key = received ? "receivedContactIds" : "repliedContactIds";
    if (!received && !daily.receivedContactIds.includes(id)) return;
    daily[key] = daily[key].filter((value) => value !== id);
    if (checkbox.checked) daily[key].push(id);
    if (received && !checkbox.checked) daily.repliedContactIds = daily.repliedContactIds.filter((value) => value !== id);
    const role = checkbox.dataset.role;
    renderDailyReplies();
    persistState();
    document.querySelector(`input[data-role="${role}"][value="${id}"]`)?.focus({ preventScroll: true });
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
              <button class="button button-ghost" type="button" data-action="remove-contact" data-id="${escapeHtml(contact.id)}">
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
              <button class="button button-ghost" type="button" data-action="remove-group" data-id="${escapeHtml(group.id)}">
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
            <input type="checkbox" data-role="campaign-contact" value="${escapeHtml(contact.id)}" ${checked}>
            <span>${escapeHtml(contact.name)}</span>
          </label>
        `;
      })
      .join("");

    const pendingMembers = new Set(Array.from(elements.groupMembersPicker.querySelectorAll("input:checked"), (input) => input.value));
    const groupPickerHtml = state.contacts
      .map((contact) => {
        return `
          <label class="picker-chip">
            <input type="checkbox" data-role="group-member" value="${escapeHtml(contact.id)}" ${pendingMembers.has(contact.id) ? "checked" : ""}>
            <span>${escapeHtml(contact.name)}</span>
          </label>
        `;
      })
      .join("");

    elements.groupMembersPicker.innerHTML = groupPickerHtml || '<p class="empty-state">先建立聯絡人，才能建立群組。</p>';
    elements.campaignRecipientsPicker.innerHTML =
      contactPickerHtml || '<p class="empty-state">還沒有名單也沒關係，分享時直接在 LINE 選親友就好。</p>';

    elements.campaignGroup.innerHTML = [
      '<option value="">自己勾選</option>',
      ...state.groups.map((group) => {
        const selected = group.id === state.campaign.selectedGroupId ? "selected" : "";
        return `<option value="${escapeHtml(group.id)}" ${selected}>${escapeHtml(group.name)}</option>`;
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
  }

  function handleSeedData() {
    if (!window.confirm("示範名單會取代目前的名單、草稿與回覆勾記。請先備份，確定要載入嗎？")) return;
    if (!allowExplicitReplacement()) return;
    Object.assign(state, window.ZaoanState.normalize(deepClone(sampleState)));
    const saved = render();
    setStatus(saved ? "已載入示範名單，方便你直接試流程。" : "示範名單已載入此頁，但尚未儲存。請查看上方提示。");
  }

  function handleResetData() {
    if (!window.confirm("確定要清空名單、草稿與回覆勾記嗎？此操作無法復原，建議先下載備份。")) {
      return;
    }

    if (!allowExplicitReplacement()) return;
    Object.assign(state, emptyState());

    const saved = render();
    setStatus(saved ? "本程式使用中的名單與草稿已清空。" : "無法清空裝置上的資料。請勿把此頁的空白名單視為已刪除，請查看上方提示。");
  }

  function allowExplicitReplacement() {
    try {
      storedSnapshot = storage.getState();
      loadFailed = false;
      storageConflict = false;
      return true;
    } catch (error) {
      setStatus("目前無法讀取裝置資料，未執行取代或清空。");
      return false;
    }
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

    if (state.contacts.length >= 500) {
      setStatus("親友名單最多可保留 500 位，請先整理再新增。");
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
    if (state.groups.length >= 100) {
      setStatus("常用名單最多可保留 100 組，請先整理再新增。");
      return;
    }
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
    if (!window.confirm(`確定刪除「${findContact(contactId)?.name}」？也會從常用名單中移除。`)) return;
    state.contacts = state.contacts.filter((contact) => contact.id !== contactId);
    state.groups = state.groups
      .map((group) => ({
        ...group,
        contactIds: group.contactIds.filter((id) => id !== contactId)
      }))
      .filter((group) => group.contactIds.length > 0);

    state.campaign.selectedContactIds = state.campaign.selectedContactIds.filter((id) => id !== contactId);
    state.dailyReplies.receivedContactIds = state.dailyReplies.receivedContactIds.filter((id) => id !== contactId);
    state.dailyReplies.repliedContactIds = state.dailyReplies.repliedContactIds.filter((id) => id !== contactId);
    if (state.campaign.selectedGroupId && !findGroup(state.campaign.selectedGroupId)) {
      state.campaign.selectedGroupId = "";
    }

    render();
    setStatus("已刪除聯絡人。");
  }

  function removeGroup(groupId) {
    if (!window.confirm(`確定刪除「${findGroup(groupId)?.name}」這份名單？親友資料仍會保留。`)) return;
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
      state.greeting.mode = "custom";
    }

    if (target.id === "campaign-group") {
      state.campaign.selectedGroupId = target.value;
      applyGroupSelection(target.value);
    }

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
    if (sharing || !shareFile) return;
    if (!canShareFiles([shareFile])) {
      handleDownload();
      return;
    }
    sharing = true;
    updateActionButtons();
    try {
      // The file is prepared before the click to preserve transient user activation.
      await navigator.share({ files: [shareFile] });
      setShareStatus("已交給分享面板。是否送出請以 LINE 聊天室為準；本程式無法確認送達。");
    } catch (error) {
      if (error && error.name === "AbortError") {
        setShareStatus("已取消分享，圖片和祝福都還在，可以再試一次。");
        return;
      }

      setShareStatus("暫時無法開啟分享。請按「下載圖片」，再到 LINE 選擇圖片傳送。");
    } finally {
      sharing = false;
      updateActionButtons();
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

    setStatus(`已下載 ${recipients.length} 位親友的備忘名單，這不代表已送出訊息。檔案包含親友資料，請妥善保管。`);
  }

  function updatePreview() {
    const recipients = getSelectedRecipients();
    elements.selectedCount.textContent = recipients.length ? `記下 ${recipients.length} 位` : "選填";
    elements.previewSummary.textContent = `早安。${getGreetingText()}`;
    elements.previewCanvas.setAttribute("aria-label", elements.previewSummary.textContent);
    document.getElementById("message-count").textContent = `${state.campaign.message.length} / 500`;

    elements.recipientPreview.innerHTML = recipients
      .map((recipient) => `<li>${escapeHtml(recipient.name)}</li>`)
      .join("");

    const background = window.ZaoanGreetings.backgrounds.find((item) => item.id === state.greeting.backgroundId);
    document.getElementById("greeting-label").textContent = `${state.greeting.mode === "daily" ? "今日推薦" : "你的祝福"} · ${background.label}`;
    document.getElementById("recommendation-help").textContent = state.greeting.mode === "daily"
      ? "每天自動搭配新的推薦組合。署名會保留；手動修改祝福後，就不會被換日覆蓋。"
      : "已保留你的祝福，換日不會更動；「換一張」只換背景。想重新自動搭配，可改用今日推薦。";
    prepareShareFile();
  }

  function drawPreview(background) {
    const canvas = elements.previewCanvas;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    context.fillStyle = "#f4f1e5";
    context.fillRect(0, 0, width, height);
    if (background) context.drawImage(background, 0, 0, width, height);
    const veil = context.createLinearGradient(0, 0, width, 0);
    veil.addColorStop(0, "rgba(255,253,243,0.88)");
    veil.addColorStop(0.48, "rgba(255,253,243,0.72)");
    veil.addColorStop(0.76, "rgba(255,253,243,0)");
    context.fillStyle = veil;
    context.fillRect(0, 0, width, height);
    canvas.dataset.background = background ? state.greeting.backgroundId : "fallback";
    context.fillStyle = "#244e3d";
    context.font = "bold 124px 'Noto Serif TC', 'Songti TC', 'PMingLiU', serif";
    context.fillText("早安", 80, 192);

    const layout = (size) => {
      context.font = `600 ${size}px 'Noto Sans TC', 'PingFang TC', sans-serif`;
      return wrapText(context, state.campaign.message, 620);
    };
    let fontSize = 76;
    let lines = layout(fontSize);
    if (lines.length * fontSize * 1.38 > 330) {
      // Find a readable fit without remeasuring the entire message at every size.
      let low = 18;
      let high = 74;
      fontSize = low;
      while (low <= high) {
        const size = Math.floor((low + high) / 4) * 2;
        const candidate = layout(size);
        if (candidate.length * size * 1.38 <= 330) {
          fontSize = size;
          low = size + 2;
        } else {
          high = size - 2;
        }
      }
      lines = layout(fontSize);
    }
    const maxLines = Math.floor(330 / (fontSize * 1.38));
    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      visibleLines[maxLines - 1] = visibleLines[maxLines - 1].slice(0, -1) + "…";
    }
    visibleLines.forEach((line, index) => context.fillText(line, 84, 302 + index * fontSize * 1.38));
    document.getElementById("message-hint").textContent = lines.length > maxLines
      ? "文字太長，圖片末尾已省略。請縮短祝福，或另按「複製祝福文字」取得全文。"
      : fontSize < 32 ? "文字較多，圖上的字會縮小。短一點的祝福更容易閱讀。" : "修改文字，圖片會一起更新。";

    if (state.campaign.sender.trim()) {
      context.fillStyle = "rgba(255,253,243,0.85)";
      context.fillRect(64, 666, width - 128, 84);
      context.fillStyle = "#244e3d";
      context.font = "700 48px 'Noto Sans TC', 'PingFang TC', sans-serif";
      context.fillText(`來自 ${state.campaign.sender.trim()}`, 84, 724, width - 168);
    }
  }

  function loadBackground(id) {
    if (imageCache.has(id)) return imageCache.get(id);
    const asset = window.ZaoanGreetings.backgrounds.find((item) => item.id === id);
    const pending = new Promise((resolve) => {
      const image = new Image();
      const finish = (value) => {
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        if (!value) image.removeAttribute("src");
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(null), 6000);
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = asset.path;
    }).then((image) => {
      if (!image) imageCache.delete(id);
      return image;
    });
    imageCache.set(id, pending);
    return pending;
  }

  async function prepareShareFile() {
    const version = ++previewVersion;
    shareFile = null;
    updateActionButtons();
    try {
      if (!imageCache.has(state.greeting.backgroundId)) drawPreview(null);
      const background = await loadBackground(state.greeting.backgroundId);
      if (version !== previewVersion) return;
      drawPreview(background);
      elements.artworkStatus.hidden = Boolean(background);
      elements.artworkStatus.textContent = background ? "" : "背景暫時無法載入，已使用簡易底圖，仍可分享。";
      const file = await canvasToFile(elements.previewCanvas, "zaoan-greeting.png");
      if (version !== previewVersion) return;
      shareFile = file;
      updateActionButtons();
    } catch (error) {
      if (version !== previewVersion) return;
      elements.shareButton.textContent = "圖片尚未準備好";
      setShareStatus("圖片製作失敗，請修改文字再試一次。也可以先複製祝福文字。");
    }
  }

  function canShareFiles(files) {
    try {
      return Boolean(navigator.share && navigator.canShare && files.length && navigator.canShare({ files }));
    } catch (error) {
      return false;
    }
  }

  function getGreetingText() {
    return [state.campaign.message.trim(), state.campaign.sender.trim() ? `來自 ${state.campaign.sender.trim()}` : ""].filter(Boolean).join("\n\n");
  }

  function handleDownload() {
    if (!shareFile || sharing) return;
    downloadBlob(shareFile.name, shareFile, shareFile.type);
    setShareStatus("已開始下載圖片。iPhone 可從「檔案」打開圖片再分享至 LINE；電腦可在 LINE 附加下載的圖片。");
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(getGreetingText());
      setShareStatus("已複製祝福與署名。到 LINE 長按輸入框，再選「貼上」。");
    } catch (error) {
      openGreetingEditor();
      document.getElementById("campaign-message").focus();
      document.getElementById("campaign-message").select();
      setShareStatus("無法自動複製。已選取祝福文字，請長按或使用複製快捷鍵；署名需另外複製。");
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

  function updateActionButtons() {
    elements.shareButton.disabled = sharing || !shareFile;
    elements.downloadButton.disabled = sharing || !shareFile;
    elements.nextGreetingButton.disabled = sharing;
    const nativeShare = shareFile && canShareFiles([shareFile]);
    elements.shareButton.textContent = sharing ? "分享面板使用中…" : !shareFile ? "正在準備圖片…" : nativeShare ? "分享圖片" : "下載圖片";
    if (shareFile) elements.shareHelp.textContent = nativeShare
      ? "下一步：選 LINE → 選親友 → 在 LINE 送出。"
      : "這個瀏覽器無法直接分享圖片，下載後仍可自行傳送。";
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
    return Object.hasOwn(mapping, channel) ? mapping[channel] : "未確認";
  }

  function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setStatus(message) {
    elements.statusBox.textContent = message;
    elements.statusBox.scrollIntoView({ block: "nearest" });
  }

  function setShareStatus(message) {
    elements.shareResult.textContent = message;
  }

  function wrapText(context, text, maxWidth) {
    const words = Array.from(text.replaceAll("\r", ""));
    const lines = [];
    let line = "";

    for (const word of words) {
      if (word === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      const testLine = `${line}${word}`;
      const { width } = context.measureText(testLine);
      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      lines.push(line);
    }
    return lines;
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
