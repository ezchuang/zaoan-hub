# 私人 LINE 分享與回傳早安圖的能力邊界

查核日期：2026-09-13。這份文件區分「目前已實作」與「可研究的後續方案」，不是新增了 LINE 整合功能。

## 現在如何選到聊天室

現在的流程是：本機 canvas 產生 PNG → `navigator.share({ files: [shareFile] })` → 系統分享面板 → 使用者選 LINE → LINE 讓使用者選對象並送出。

網站沒有 LINE 的登入 session、chatroom ID、好友列表或收件匣存取權。`c-...`、`g-...` 是本程式自己產生的備忘資料 ID，不是 LINE 的 `userId`、`groupId`、`roomId`，不能拿來指定 LINE 的收件對象。

聊天室 ID 與登入 session 也不是同一件事：知道一個識別碼，不代表有權限讀取或代替私人帳號送訊息。當前分享功能不需要，也不應要求使用者交出 LINE 密碼或登入 token。

## 可考慮的官方私人帳號多選分享

LINE 的 `liff.shareTargetPicker()` 可讓使用者在 LINE 提供的介面中多選目標，以使用者身分分享開發者準備的訊息；需要設定 LIFF、啟用 share target picker 並登入。這不是官方帳號 bot 廣播。

此 API 不接受我們自行保存的收件者 ID 清單來預選；其回傳值是成功狀態或取消，不是可供網站保存的聊天室 ID 清單。它也沒有授權網站讀取私人聊天室歷史或監聽收到的圖片。LIFF 的歷史 `getContext()` 聊天室內部識別碼欄位已停止提供。

圖片訊息還有另一個限制：要提供 LINE 可以取得的 HTTPS 圖片與預覽網址，不能把此裝置的 `blob:` URL 或 canvas 直接當成公開圖片網址。固定圖庫可由 Pages 提供；客製署名的動態圖片若改用 LIFF 圖片訊息，需另外設計圖片託管與刪除機制。這會改變「圖片不離開裝置，直到使用者分享」的隱私邊界。

因此建議先保持目前免登入的檔案分享作為第一版；若後續導入 LIFF，應先以固定圖庫或文字驗證多選流程，且保留現有分享方式。是否更適合長輩，要實測首次登入與 LINE 內／外瀏覽器流程，而不是只看 API 是否存在。

來源：[LIFF shareTargetPicker 參考](https://developers.line.biz/en/reference/liff/#share-target-picker)、[LIFF 開發流程](https://developers.line.biz/en/docs/liff/developing-liff-apps/)、[聊天室識別碼停止提供公告](https://developers.line.biz/en/news/2023/02/06/liff-spec-change/)、[圖片訊息網址規格](https://developers.line.biz/en/docs/messaging-api/message-types/#image-message)。

## 能不能自動找出「今天有傳早安圖來的聊天室」

在「私人 LINE 帳號＋iPhone＋一般 PWA／GitHub Pages」這組條件下，不能透過目前公開的官方介面自動讀取她的所有收件聊天室或圖片。因此無法據此自動預選聊天室、再以私人帳號批次回覆。加一台 server 也不會憑空取得這個權限。

可行的替代方案分成兩類：

- **保留私人帳號**：使用者自己勾記「今天收到問候」的親友，網站列出待回覆備忘，再由她在 LINE 選對象。也可研究手動提供截圖／匯出內容做辨識，但結果需要人工確認，且不會因此取得聊天室 ID。這些功能目前尚未實作。
- **改用官方帳號 bot**：親友傳訊息給官方帳號，或群組邀入 bot 後，可由 webhook 接收該 bot 可見範圍的訊息事件與來源 ID，再對圖片做 OCR／分類、列出候選來源。仍需使用者確認，因為「收到圖片」不等於「收到早安圖」。這不是讀取她原本私人帳號的全部收件匣，bot 回覆也是官方帳號身分。

bot 方案必須有能接收 HTTPS POST 的 webhook 服務、驗證 LINE 簽章、保管 secret／token，以及定義圖片保存與刪除政策。可以用 serverless 免自行維運主機，但 **GitHub Pages 本身不能處理 webhook**，也不能把 channel secret 放到公開前端。

不建議把偷讀 session、非官方協定登入、越獄或公務電腦背景監控當成產品前提；它們會改變帳號安全、隱私與裝置安裝風險，也不符合目前限制。

來源：[LINE webhook 接收範圍](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)、[官方帳號加入群組後的來源 ID](https://developers.line.biz/en/docs/messaging-api/group-chats/)、[Messaging API overview](https://developers.line.biz/en/docs/messaging-api/overview/)。
