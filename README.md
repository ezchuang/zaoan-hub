# Zaoan Hub

一個給長輩使用的早安圖群發 MVP。這個版本先解決三件事：

1. 用 browser 管理聯絡人與常用群組
2. 在 iPhone / iPad / 公務電腦上用同一套介面操作
3. 把「發送名單」與「真正送出訊息」拆開，避免一開始就被特定通訊平台綁死

目前不處理圖片上傳或內建圖庫，介面會先產生一張 placeholder 早安圖，驗證整體流程。

## 為什麼先做成 browser app

已知限制是：

- 長輩可能只有公務電腦，不適合安裝桌面軟體
- 長輩有 iOS 手機

因此 MVP 先採用 browser-first：

- 公務電腦：用瀏覽器維護聯絡人、群組、發送清單
- iPhone：用 Safari 開啟同一套系統，直接用 Web Share API 叫出系統分享面板
- 若使用者願意，可把網站加入主畫面，接近 App 體驗，但仍不需要上架或安裝企業版 App

## 目前專案內容

- `app/index.html`: 單頁介面
- `app/styles.css`: 針對長輩操作設計的高對比、大按鈕 UI
- `app/app.js`: 本地資料管理、群組管理、發送預覽、iOS share-sheet 流程
- `app/manifest.webmanifest`: 方便加入 iOS 主畫面
- `app/icon.svg`: 基本 icon
- `server.py`: 不依賴第三方套件的本地開發 server

## 啟動方式

```powershell
cd C:\code\zaoan-hub
python server.py
```

預設會開在 `http://127.0.0.1:8765`。

## MVP 使用方式

1. 新增聯絡人
2. 用聯絡人建立群組
3. 在發送區選群組或手動勾選對象
4. 按 `手機分享` 產生 placeholder 早安圖並叫出系統分享面板
5. 若裝置不支援檔案分享，系統會退回成下載圖片 + 複製文字

## 架構決策

### 1. 發送通道先抽象化

這個專案先支援兩種概念上的通道：

- `share-sheet`: 立刻可用，依賴 iOS / browser 原生分享能力
- `official-channel`: 未實作，保留給未來串接 LINE Official Account、Email、SMS 或其他正式 API

這樣做的原因是「幫長輩選群發對象」與「真正送到哪個通訊平台」其實是兩件不同的事。MVP 先把可控的部分做穩。

### 2. 真正自動群發，取決於目標平台

如果未來目標是 LINE，需要特別注意：

- LINE Messaging API 的 push / broadcast / narrowcast 是針對已加入你的 LINE Official Account 的使用者
- 不適合拿來直接對任意私人聯絡人名單做個人帳號式群發

因此如果需求是：

- `A.` 長輩自己挑私人 LINE 朋友直接自動送出
  - 這不適合當成第一版正式方案
  - 目前 MVP 用 iPhone 分享面板當 fallback，最後一步由使用者自己選目標 app / 對象
- `B.` 一群固定長輩 / 親友願意先加官方帳號
  - 這才適合做成正式自動化群發系統
  - 下一階段可加 backend、登入、排程、受眾標籤與發送紀錄

### 3. 為什麼沒有先做 backend

因為這一版主要風險不是 CRUD，而是「可不可以在不裝 App 的前提下，完成操作與送出」。先驗證互動流程，再決定要不要投資真正的訊息平台整合。

## 建議的下一步

如果你要把它做成真正可上線的系統，我會建議二選一：

1. `iPhone assisted sending`
   - 長輩在手機上用系統分享
   - 優點：最快可落地，不受公務電腦安裝限制
   - 缺點：最後一步仍要手動選 app / 對象
2. `Official account broadcasting`
   - 讓收件者先訂閱官方帳號，再由後台廣播
   - 優點：可真正自動化、可管理名單與發送紀錄
   - 缺點：需要平台申請、權限設定、收件者 onboarding

## 已知限制

- 目前資料存在 `localStorage`，還沒有跨裝置同步
- 目前圖片是動態產生的 placeholder，不是正式圖庫
- `手機分享` 是否能直接顯示特定 app，仍受 iOS share sheet 與裝置安裝狀態影響
- 若未來要做真正自動群發，必須先確認目標平台與法規/權限限制

## 參考資料

- LINE Developers: [Send messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/)
- LINE Developers: [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/nojs/)
- WebKit: [New WebKit Features in Safari 12.1](https://webkit.org/blog/8718/new-webkit-features-in-safari-12-1/)
- WebKit: [New WebKit Features in Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)
- WebKit: [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- WebKit: [Allowing Web Share on Third-Party Sites](https://webkit.org/blog/13708/allowing-web-share-on-third-party-sites/)

