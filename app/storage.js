(function () {
  const STATE_KEY = "zaoan-hub-state-v1";
  const MODE_KEY = "zaoan-hub-storage-mode";
  const SHARED_DEVICE_MODE = "session";

  function isSharedDeviceMode() {
    return window.sessionStorage.getItem(MODE_KEY) === SHARED_DEVICE_MODE;
  }

  function getState() {
    return activeStorage().getItem(STATE_KEY);
  }

  function setState(value) {
    activeStorage().setItem(STATE_KEY, value);
  }

  function enableSharedDeviceMode() {
    const persistentState = window.localStorage.getItem(STATE_KEY);
    if (persistentState !== null) {
      window.sessionStorage.setItem(STATE_KEY, persistentState);
    }
    window.sessionStorage.setItem(MODE_KEY, SHARED_DEVICE_MODE);
    window.localStorage.removeItem(STATE_KEY);
  }

  function disableSharedDeviceMode() {
    const sessionState = window.sessionStorage.getItem(STATE_KEY);
    if (sessionState !== null) {
      window.localStorage.setItem(STATE_KEY, sessionState);
    }
    window.sessionStorage.removeItem(STATE_KEY);
    window.sessionStorage.removeItem(MODE_KEY);
  }

  function activeStorage() {
    return isSharedDeviceMode() ? window.sessionStorage : window.localStorage;
  }

  window.ZaoanStorage = Object.freeze({
    getState,
    setState,
    isSharedDeviceMode,
    enableSharedDeviceMode,
    disableSharedDeviceMode
  });
})();
