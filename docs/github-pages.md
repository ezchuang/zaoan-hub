# 用 GitHub Pages 部署

目前的程式是純 HTML、CSS、JavaScript，正式使用不需要執行 `server.py`、租 VPS、資料庫或自己的 backend。GitHub Pages 負責提供靜態網頁與 HTTPS，不代表完全沒有伺服器；只是不用自己維運。

第一次開啟與更新需要網路。離線準備完成後，本機產圖與名單功能可離線使用，真正送出 LINE 訊息仍需要網路。

## 給部署者

1. Fork 此 repository，或使用自己有管理權限的 repository。確認預設分支包含 `.github/workflows/pages.yml` 與最新 `app/`；若變更尚在開發分支，請先合併。
2. 進入 repository 的 `Settings → Pages`。
3. 在 `Build and deployment → Source` 選 `GitHub Actions`。
4. 若 Fork 後 Actions 尚未啟用，先到 `Actions` 頁面啟用自己的 workflows。
5. 在 `Actions → Deploy GitHub Pages → Run workflow` 選預設分支，手動執行。
6. 等 `build`、`deploy` 都完成，開啟 deployment 提供的 `page_url`；預設通常是 `https://<帳號>.github.io/<repo>/`。
7. 確認網址使用 HTTPS，再用 iPhone Safari 開啟該網址，點「iPhone 安裝」依導引操作。

以原 repository 名稱為例，預期的專案網址是 `https://ezchuang.github.io/zaoan-hub/`，但只有擁有者啟用 Pages 並完成部署後才會存在；Fork 後應使用自己的網址，不能照抄這個範例。

一般使用者只需要打開部署好的網址，不需要 GitHub 帳號，也不需要每人 Fork。只有想自行管理網站版本的人才需要部署一份。

本 workflow **只接受手動執行，不會因 push 自動公開網站**；也只允許從預設分支部署。若指定其他分支而顯示 skipped，請回到預設分支操作。

## 更新網站

1. 將通過測試的完整版本合併或同步到預設分支。
2. 若修改 `app/` 內的快取檔案，遞增 `app/sw.js` 的 `CACHE_VERSION`。
3. 再次手動執行 `Deploy GitHub Pages`。
4. 已安裝的使用者連網開啟後，可確認更新；初次安裝與舊版升級都應用 iPhone 實測。

Fork 不會自動收到上游更新，部署者需要自行同步與重新發布。

## 發布範圍與安全

- workflow 只上傳 `app/`，不發布 Python server、測試、README 或整個 repository。
- 程式不會把裝置上的親友名單、草稿、圖片或 JSON 備份同步到 GitHub。請勿自己把備份、私人圖片、密碼、token 或 channel secret 放進 repository 或 `app/`。
- GitHub Pages 網頁通常是公開的；repository 設為 private 不等於網站也受同樣的登入保護。public repository 的其他檔案及 Git 歷史也會公開，不受 Pages artifact 範圍限制。
- 本程式沒有額外加入追蹤分析；GitHub 作為主機仍會依其政策記錄網站存取資訊，例如 IP。不是零網路紀錄。
- GitHub Pages 不會執行 `server.py`，因此 Python 提供的 HTTP security headers 不會跟著上線。頁面的 CSP meta fallback 仍保留，但不能等同完整的 HTTP headers 防護。不要把它改成存放登入憑證或高敏感資料的服務。
- 同一個 `https://<帳號>.github.io` 底下的不同 repo 路徑屬於同一 origin。不要把不信任的應用程式部署在同一 origin 並存放真實親友資料；有此需求時應使用獨立網域或獨立帳號。
- 不需要新增 Personal Access Token。workflow 使用 GitHub 的短效權杖，只有部署 job 具有 `pages: write` 與 `id-token: write`。

## 驗證

`node --test tests/state.test.cjs tests/pages.test.cjs` 不需要額外套件，會檢查資料驗證、相對資源路徑、manifest、離線檔案與公開 artifact 範圍。瀏覽器測試另涵蓋子目錄部署和離線更新。

GitHub Actions 實際執行、Pages 是否啟用及真機 LINE 分享，需要部署者完成後另外驗收；本機測試通過不代表網站已公開。

## 官方文件

- [GitHub Pages 的靜態網站定位](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [選擇 GitHub Actions 為發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [自訂 Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [HTTPS 與網站公開性](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
