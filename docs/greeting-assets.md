# 預製早安圖背景

本版使用內建 `image_gen` 工具在開發時生成三張背景，再以原始 PNG 複製至 repository。沒有使用 CLI fallback 或付費 API runner，也沒有在使用者手機即時呼叫 AI。

## 輸出與用途

| Repository 路徑 | 背景 | 尺寸 | 大小 |
| --- | --- | --- | --- |
| `app/morning-flowers.png` | 晨光花語 | 1536 × 1024 | 1,899,249 bytes |
| `app/morning-lake.png` | 山水清晨 | 1536 × 1024 | 1,880,412 bytes |
| `app/morning-tea.png` | 一杯暖心 | 1536 × 1024 | 1,777,416 bytes |

圖中景色是 AI 生成，不宣稱為任何真實地點。背景不含姓名、文字或個人資料；祝福與署名在本機 canvas 合成。三張合計約 5.6 MB，包含在 service worker 的完整離線快取中。

## 實際使用的 Prompts

### 晨光花語

Use case: photorealistic-natural. Asset type: landscape background for a Traditional Chinese good-morning greeting card used by older adults. Generate ONE beautiful 1536x1024 landscape image, no text whatsoever. Primary subject: fresh blush-pink and ivory cosmos flowers in a small sunlit garden at dawn, dew on petals, lush but uncluttered, warm and welcoming. Composition requirement for real app: concentrate detailed flowers in the rightmost 40 percent and lower right edge; left 55 percent is softly blurred, very light warm ivory/sage background with generous calm negative space for later programmatic dark Chinese lettering. Natural editorial botanical photography, gentle morning light, refined true-to-life textures, not clipart. No people, no logos, no watermark, no typography, no border or collage. Image is a production asset, not a UI screenshot.

### 山水清晨

Use case: photorealistic-natural. Asset type: production landscape background for an elegant good-morning greeting card for older Taiwanese adults. ONE 1536x1024 landscape image. A serene lake and layered blue-green mountains at first light, delicate mist, warm sunlight gently illuminating water, a slender leafy branch at far right. Natural editorial landscape photography, restrained and realistic, peaceful not dramatic. For programmatic text overlay keep LEFT 55 percent very pale ivory-blue mist, low contrast and nearly empty; the mountain silhouettes and natural details should be concentrated on the right half and lower right. No dark objects behind the left text zone. No people, boats, buildings, text, lettering, watermark, logos, frames, or collage. A usable background, not a mockup.

### 一杯暖心

Use case: photorealistic-natural. Asset type: production background image for a warm sophisticated good-morning greeting card aimed at older Taiwanese adults. ONE 1536x1024 landscape image. Subject: a small celadon ceramic cup of gently steaming tea on a warm pale wooden breakfast table, a few small osmanthus blossoms on a branch beside it, soft morning window light. Inviting quiet everyday beauty, realistic editorial still-life photography, natural materials, no dramatic props. Composition for an app's later Chinese text overlay: keep cup and blossoms in the rightmost 40 percent; LEFT 55 percent and left-middle must be calm softly lit warm ivory wall / blurred cream background with no contrasting details. No text, no calligraphy, no labels, no logos, no people, no watermark, no frame, no collage. Not a UI mockup.

## 維護

`app/greetings.js` 定義背景清單、八句預設祝福與依本地日期決定的 24 種循環搭配；不是 24 張獨立 AI 背景。個人署名和自行改寫的祝福不會上傳到網站。

新增背景時需同時更新 `app/state.js` 的 ID allowlist、`app/sw.js` 的快取清單與 cache version，並確認新版本仍能處理舊備份。不要允許備份檔提供任意背景 URL，以免載入外部追蹤圖片或污染 canvas。

若未來接上線上圖像服務，需另外確認供應商、預算、憑證保存與發布審查；本版本未啟用該功能。
