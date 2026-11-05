# 詞語隨機生成器 (Auto Question Supply)

提供形容詞與名詞自訂儲存，並隨機組合呈現 `(形容詞 的 名詞)` 的網頁應用程式。已設定完善，可一鍵部署至 **Vercel**。

## 🌟 功能特點

- **雙輸入欄**：分別提供「形容詞」與「名詞」輸入欄位，支援單獨或同時儲存。
- **隨機抽取**：點擊「隨機抽取」按鈕，自儲存詞庫中隨機選取並以 `(形容詞 的 名詞)` 格式高亮顯示。
- **本機資料保存 (LocalStorage)**：重新整理或重啟瀏覽器，自訂詞彙依然完整保留。
- **詞庫視覺化管理**：支援標籤化展示、一鍵刪除個別詞彙、載入精選範例詞庫及清空功能。
- **貼心小工具**：一鍵複製結果、抽取歷史紀錄（最近 15 筆）。

---

## ⚡ 部署至 Vercel

本專案為輕量純靜態網站，並已包含 `vercel.json` 與 `package.json`，支援以下兩種方式秒級部署：

### 方法一：透過 GitHub 與 Vercel 連結（最推薦）
1. 將此專案推送（Push）至您的 GitHub 倉庫：`https://github.com/s411318-abc/auto-question-supply.git`。
2. 前往 [Vercel 官網 (vercel.com)](https://vercel.com/) 並登入。
3. 點擊 **"Add New..."** ➜ **"Project"**。
4. 選擇您的 GitHub 倉庫 **`auto-question-supply`**，點擊 **"Import"**。
5. 架構保持預設（Other / None），直接點擊 **"Deploy"**！
6. 約 10 秒後即可取得上線網址（例如：`https://auto-question-supply.vercel.app`）。

### 方法二：透過 Vercel CLI 本地直接部署
在終端機中執行：
```bash
npx vercel
```
依照畫面提示完成登入與確認，即可直接部署上線。

---

## 💻 本地預覽

若要在本地端測試或直接開啟：
- **方式一**：在檔案總管中直接雙擊打開 `index.html`。
- **方式二**：在終端機執行 `npx serve .`。

---

## 📁 檔案結構

```
.
├── index.html    # 網頁結構、SEO Meta 與介面
├── style.css     # 響應式排版與動畫樣式
├── script.js     # 隨機抽取、詞庫管理與本機儲存邏輯
├── vercel.json   # Vercel 部署與安全性標頭設定檔
├── package.json  # 專案資訊與指令設定
├── .gitignore    # Git 忽略檔案設定
└── README.md     # 專案說明與部署指南
```
