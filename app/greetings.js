(function () {
  const backgrounds = Object.freeze([
    Object.freeze({ id: "flowers", label: "晨光花語", path: "./morning-flowers.png" }),
    Object.freeze({ id: "lake", label: "山水清晨", path: "./morning-lake.png" }),
    Object.freeze({ id: "tea", label: "一杯暖心", path: "./morning-tea.png" })
  ]);
  const messages = Object.freeze([
    "平安常在，\n好事慢慢來。",
    "願你今天，\n自在又開心。",
    "心有陽光，\n日子就溫暖。",
    "照顧好自己，\n健康最珍貴。",
    "帶著微笑，\n迎接新的一天。",
    "把心放寬，\n讓日子有甜。",
    "一聲早安，\n一份真心祝福。",
    "願你所遇皆暖，\n所行皆安。"
  ]);
  const count = backgrounds.length * messages.length;

  function recommendation(date = new Date(), variant = 0) {
    // Use the local calendar day, not UTC midnight or elapsed milliseconds (DST).
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    const index = ((day + variant) % count + count) % count;
    return {
      date: window.ZaoanState.localDateKey(date),
      variant,
      backgroundId: backgrounds[index % backgrounds.length].id,
      message: messages[index % messages.length]
    };
  }

  function apply(state, variant = 0, date = new Date()) {
    const next = recommendation(date, variant);
    state.greeting = { mode: "daily", date: next.date, variant, backgroundId: next.backgroundId };
    state.campaign.message = next.message;
  }

  function refresh(state, date = new Date()) {
    if (state.greeting.mode !== "daily" || state.greeting.date === window.ZaoanState.localDateKey(date)) return false;
    apply(state, 0, date);
    return true;
  }

  function next(state, date = new Date()) {
    if (state.greeting.mode === "daily") {
      const variant = state.greeting.date === window.ZaoanState.localDateKey(date) ? (state.greeting.variant + 1) % count : 0;
      apply(state, variant, date);
    } else {
      const index = backgrounds.findIndex((background) => background.id === state.greeting.backgroundId);
      state.greeting.backgroundId = backgrounds[(index + 1) % backgrounds.length].id;
    }
  }

  window.ZaoanGreetings = Object.freeze({ backgrounds, count, recommendation, apply, refresh, next });
})();
