# 雙工作站任務銜接與跨裝置交接紀錄 (Cross-Device Handoff)

> **建立時間**：2026-10-24 22:50 (zh-TW)  
> **專案路徑**：`/Users/oyangyan/Library/CloudStorage/GoogleDrive-abracaoyang@gmail.com/我的雲端硬碟/IDE/入口專案/建構中專案/【05案件管理】｜定聯與議題紀錄系統`  
> **GitHub 倉庫**：`git@github.com:abracaoyang/case-management-crm.git`  
> **專案狀態**：🟢 生產級穩固（Production-Ready）｜231 項底層回歸 + BDD 活體規格 100% PASS ｜ GitHub 遠端同步完成

---

## 一、 GitHub 遠端與永久 SSH 連線記憶

* **SSH 公鑰**：`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUS69sEV+iOFdXRs4rhTsVYYmE/ABrm3X4kykwkFE0h abracaoyang@gmail.com`
* **本機私鑰位置**：`~/.ssh/id_ed25519_github`
* **本機 SSH 配置**：已寫入 `~/.ssh/config`，固定綁定 `Host github.com` 使用該金鑰，**終身免打密碼**。
* **遠端關聯**：已綁定 `origin -> git@github.com:abracaoyang/case-management-crm.git`，分支為 `main`。
* **資安防線**：`.gitignore` 嚴格阻絕 Google 試算表、語音逐字稿、客戶行照翻拍圖、KYC 報告、.env 密鑰，上傳 GitHub 0 洩漏。

---

## 二、 本次工作完成事項與核心進展

1. **深度資料流逆向追蹤與邊界巡檢**：
   - 建立了全系統 45 大檢驗組，涵蓋 **231 項全自動化測試**（耗時僅 0.42 秒）。
   - 修正「純數字民國年月日解析盲區」：`0810801`、`10505`、`1051102` 現已自動精確轉為西元格式。
   - 修正「標籤陣列包含逗號未切分」與「名片括號市話分機解析」之邊界邏輯。
   - 強化「客戶名單防蒸發門禁」（維護後強制解除 `hideUpdatedContacts` 鎖定）與「客群維度對齊」。
2. **正統 BDD（行為驅動開發）架構落地**：
   - 建立零依賴極輕量 BDD 引擎 [`js/bdd-framework.js`](file:///Users/oyangyan/Library/CloudStorage/GoogleDrive-abracaoyang@gmail.com/我的雲端硬碟/IDE/入口專案/建構中專案/【05案件管理】｜定聯與議題紀錄系統/js/bdd-framework.js)。
   - 建立 BDD 驗收執行器 [`bdd-runner.js`](file:///Users/oyangyan/Library/CloudStorage/GoogleDrive-abracaoyang@gmail.com/我的雲端硬碟/IDE/入口專案/建構中專案/【05案件管理】｜定聯與議題紀錄系統/bdd-runner.js)，涵蓋 12 大 Feature、23 個真實業務情境 Scenario、80 個 Given-When-Then 步驟（耗時 0.01 秒）。
   - 自動生成自然語言規格書 [`BDD_LIVING_SPECIFICATION.md`](file:///Users/oyangyan/Library/CloudStorage/GoogleDrive-abracaoyang@gmail.com/我的雲端硬碟/IDE/入口專案/建構中專案/【05案件管理】｜定聯與議題紀錄系統/BDD_LIVING_SPECIFICATION.md)。
3. **版本防快取更新與一鍵發布流水線**：
   - 建立 [`scripts/release.js`](file:///Users/oyangyan/Library/CloudStorage/GoogleDrive-abracaoyang@gmail.com/我的雲端硬碟/IDE/入口專案/建構中專案/【05案件管理】｜定聯與議題紀錄系統/scripts/release.js)，支援 `npm run release` 一鍵自動體檢、測試、防呆、刷新版本號並推送 GitHub。

---

## 三、 常用終端指令速查

```bash
# 1. 執行全端 JavaScript 語法靜態檢查 (0 錯誤)
npm run check

# 2. 執行底層 231 項極限整合回歸測試 (0.42 秒)
npm test

# 3. 執行上層 BDD 活體規格情境驗收 (0.01 秒)
npm run test:bdd

# 4. 一鍵執行全套雙軌測試
npm run test:all

# 5. 告一個段落時的一鍵安全發布 (自動測試 + 檢查個資 + 推送 GitHub)
npm run release "本次修改的重點"
```

---

## 四、 GitHub Pages 公開網址開啟步驟

1. 前往 GitHub 倉庫：`https://github.com/abracaoyang/case-management-crm`
2. 點擊頂部的 **Settings** 齒輪。
3. 點選左側選單的 **Pages**。
4. 在 **Build and deployment -> Branch** 下拉選單：
   - 選擇 **`main`** 分支，資料夾選擇 **`/(root)`**。
   - 點擊 **Save**。
5. 約 30 秒至 1 分鐘後，頁面頂端會出現專屬公開網址：
   👉 **`https://abracaoyang.github.io/case-management-crm/`**
6. 在 iPad、手機或任何筆電開啟此網址，即可直接跨裝置使用！
