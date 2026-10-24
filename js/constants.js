/**
 * 定聯 x 議題 x 案件｜紀錄管理系統 (Regular Contact, Topic & Case Tracking System)
 * 核心應用程式邏輯 (app.js)
 * 特色：二維稀疏矩陣渲染、CSS Sticky 雙向凍結、三秒極速定聯微紀錄、UMBC 說帖庫、LocalStorage 自動防呆持久化
 */

// =============================================================================
// 1. 常數與預設資料 (Fallback Mock Data)
// =============================================================================
const STORAGE_KEYS = {
  CONTACTS: 'CONTACT_TOPIC_SYSTEM_CONTACTS_V1',
  DELETED_CONTACTS: 'CONTACT_TOPIC_SYSTEM_DELETED_CONTACTS_V1',
  TOPICS: 'CONTACT_TOPIC_SYSTEM_TOPICS_V1',
  DELETED_TOPICS: 'CONTACT_TOPIC_SYSTEM_DELETED_TOPICS_V1',
  TOUCHPOINTS: 'CONTACT_TOPIC_SYSTEM_TOUCHPOINTS_V1',
  VEHICLES: 'CONTACT_TOPIC_SYSTEM_VEHICLES_V1',
  FIXED_MESSAGES: 'crm_fixed_messages', // 與案件系統共享相同 LocalStorage Key，達成雙向即時互通
  FIXED_MESSAGES_LAST_UPDATE: 'crm_fixed_messages_last_update',
  DOC_PRINTS: 'crm_doc_prints', // 與案件管理系統共享相同 LocalStorage Key，達成雙向即時互通
  DOC_PRINTS_LAST_UPDATE: 'crm_doc_prints_last_update',
  WORK_LOGS: 'CONTACT_TOPIC_SYSTEM_WORK_LOGS_V1', // 工作日誌紀錄本地持久化
  REMINDERS: 'CONTACT_TOPIC_SYSTEM_REMINDERS_V1', // 備忘提醒待辦清單本地持久化
  STUDENT_SCHEDULES: 'CONTACT_TOPIC_SYSTEM_STUDENT_SCHEDULES_V1', // 學生增員作息課表本地持久化
  THEME: 'CONTACT_TOPIC_SYSTEM_THEME_V1',
  SYNC_SETTINGS: 'CONTACT_TOPIC_SYSTEM_SYNC_SETTINGS_V1',
  DEMO_MASKED: 'CONTACT_TOPIC_SYSTEM_DEMO_MASKED_V1'
};

// 客戶名稱去識別化遮蔽（Demo展示專用：字元頭尾保留，中間全部用Ｏ代替）
function formatMaskedName(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const len = trimmed.length;
  if (len <= 1) return trimmed;
  if (len === 2) {
    // 兩字中文名：保留首字，次字用全形 Ｏ (如「陳樂」➔「陳Ｏ」)
    return trimmed[0] + 'Ｏ';
  }
  // 三字或以上：保留首尾字元，中間全部替換為全形 Ｏ (如「游長霖」➔「游Ｏ霖」，「歐陽大為」➔「歐ＯＯ為」)
  const middleCount = len - 2;
  return trimmed[0] + 'Ｏ'.repeat(middleCount) + trimmed[len - 1];
}

// 根據目前系統是否處於 Demo 遮罩模式，取得客戶顯示名稱
function getClientDisplayName(name) {
  if (typeof window !== 'undefined' && window.state && window.state.isDemoMasked) {
    return formatMaskedName(name);
  }
  return name || '';
}

if (typeof window !== 'undefined') {
  window.formatMaskedName = formatMaskedName;
  window.getClientDisplayName = getClientDisplayName;
}

// 取得當前本地時區的 YYYY-MM-DD 日期字串（避免 UTC 跨日偏差）
function getLocalTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 產生依時間遞增、人眼秒懂的標準年月日時分秒編碼 (YYYYMMDD_HHmmss_fff)
// 範例：h_20261020_213825_120，純數字遞增，大小一眼立判
function generateTimeCodeId(prefix = '') {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  const timeCode = `${y}${m}${day}_${hh}${mm}${ss}_${ms}`;
  return prefix ? `${prefix}_${timeCode}` : timeCode;
}

if (typeof window !== 'undefined') {
  window.generateTimeCodeId = generateTimeCodeId;
}
if (typeof global !== 'undefined') {
  global.generateTimeCodeId = generateTimeCodeId;
}

// 取得本週（週一至週日）的所有 YYYY-MM-DD 日期集合 (Set)
function getCurrentWeekDateStringsSet() {
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
  // 計算距離本週一的差距天數
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const datesSet = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    datesSet.add(`${y}-${m}-${day}`);
  }
  return datesSet;
}

// 取得本週（週一至週日）7 天結構陣列 (用於繪製趨勢圖)
function getCurrentWeekDaysList() {
  const now = new Date();
  const todayStr = getLocalTodayDateString();
  const currentDay = now.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const list = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    list.push({
      date: dateStr,
      dayName: dayNames[i],
      shortDate: `${parseInt(m, 10)}/${parseInt(day, 10)}`,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr
    });
  }
  return list;
}

// =============================================================================
// 預設文件列印清單 (優先載入 js/doc_prints_data.js，具備醫療前中後高清 PDF)
// =============================================================================
const DEFAULT_DOC_PRINTS = (typeof window !== 'undefined' && Array.isArray(window.DEFAULT_DOC_PRINTS) && window.DEFAULT_DOC_PRINTS.length > 0)
  ? window.DEFAULT_DOC_PRINTS
  : [
  {
    "id": "doc_1",
    "title": "保險需求分析卡",
    "desc": "面談時引導客戶進行人生各階段責任、醫療防護與資產傳承缺口盤點。",
    "fileType": "text/html",
    "fileName": "保險需求分析卡.html",
    "fileData": "data:text/html;charset=utf-8,%3C%21DOCTYPE%20html%3E%3Chtml%3E%3Chead%3E%3Cmeta%20charset%3D%22utf-8%22%3E%3Ctitle%3E%E4%BF%9D%E9%9A%AA%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90%E5%8D%A1%3C%2Ftitle%3E%3Cstyle%3Ebody%7Bfont-family%3A-apple-system%2CBlinkMacSystemFont%2C%22Noto%20Sans%20TC%22%2Csans-serif%3Bpadding%3A30px%3Bcolor%3A%231e293b%3Bline-height%3A1.6%3Bbackground%3A%23fff%7Dh1%7Bborder-bottom%3A2px%20solid%20%232563eb%3Bpadding-bottom%3A8px%3Bcolor%3A%231e40af%3Bfont-size%3A1.5rem%7D.section%7Bmargin-bottom%3A16px%3Bpadding%3A14px%3Bbackground%3A%23f8fafc%3Bborder-left%3A4px%20solid%20%233b82f6%3Bborder-radius%3A4px%7D.item%7Bdisplay%3Aflex%3Bjustify-content%3Aspace-between%3Bmargin-bottom%3A10px%3Bborder-bottom%3A1px%20dashed%20%23cbd5e1%3Bpadding-bottom%3A6px%7D.item%20span%3Alast-child%7Bfont-weight%3Abold%3Bcolor%3A%232563eb%7D%3C%2Fstyle%3E%3C%2Fhead%3E%3Cbody%3E%3Ch1%3E%F0%9F%93%8B%20%E5%AE%B6%E5%BA%AD%E9%A2%A8%E9%9A%AA%E8%88%87%E4%BF%9D%E9%9A%AA%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90%E5%8D%A1%3C%2F1%3E%3Cdiv%20class%3D%22section%22%3E%3Ch3%20style%3D%22margin-top%3A0%3Bcolor%3A%230f172a%22%3E%E4%B8%80%E3%80%81%20%E8%B2%AC%E4%BB%BB%E8%88%87%E4%BF%9D%E9%9A%9C%E9%A1%8D%E5%BA%A6%E4%BC%B0%E7%AE%97%3C%2Fh3%3E%3Cdiv%20class%3D%22item%22%3E%3Cspan%3E1.%20%E5%A3%BD%E9%9A%AA%E8%88%87%E5%AE%B6%E5%BA%AD%E6%88%BF%E8%B2%B8%E7%B8%BD%E9%A1%8D%EF%BC%9A%3C%2Fspan%3E%3Cspan%3E__________%20%E8%90%AC%E5%85%83%3C%2Fspan%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22item%22%3E%3Cspan%3E2.%20%E9%86%AB%E7%99%82%E8%88%87%E7%99%8C%E7%97%87%E6%A8%99%E9%9D%B6%E5%84%B2%E5%82%99%EF%BC%9A%3C%2Fspan%3E%3Cspan%3E__________%20%E8%90%AC%E5%85%83%3C%2Fspan%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22item%22%3E%3Cspan%3E3.%20%E6%84%8F%E5%A4%96%E9%98%B2%E8%AD%B7%E8%88%87%E5%A4%B1%E8%83%BD%E7%85%A7%E8%AD%B7%EF%BC%9A%3C%2Fspan%3E%3Cspan%3E__________%20%E8%90%AC%E5%85%83%3C%2Fspan%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22item%22%3E%3Cspan%3E4.%20%E9%80%80%E4%BC%91%E7%8F%BE%E9%87%91%E6%B5%81%E8%88%87%E8%B3%87%E7%94%A2%E5%82%B3%E6%89%BF%EF%BC%9A%3C%2Fspan%3E%3Cspan%3E__________%20%E8%90%AC%E5%85%83%3C%2Fspan%3E%3C%2Fdiv%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22section%22%3E%3Ch3%20style%3D%22margin-top%3A0%3Bcolor%3A%230f172a%22%3E%E4%BA%8C%E3%80%81%20%E9%9D%A2%E8%AB%87%E8%A9%95%E4%BC%B0%E8%88%87%E7%B5%90%E8%AB%96%3C%2Fh3%3E%3Cp%20style%3D%22margin%3A6px%200%22%3E%E5%BB%BA%E8%AD%B0%E5%84%AA%E5%85%88%E8%A6%8F%E5%8A%83%E9%A0%85%E7%9B%AE%EF%BC%9A__________________________________________________%3C%2Fp%3E%3Cp%20style%3D%22margin-top%3A20px%22%3E%E5%AE%A2%E6%88%B6%E7%B0%BD%E5%90%8D%EF%BC%9A____________________%20%20%20%20%E6%97%A5%E6%9C%9F%EF%BC%9A____%E5%B9%B4__%E6%9C%88__%E6%97%A5%3C%2Fp%3E%3C%2Fdiv%3E%3C%2Fbody%3E%3C%2Fhtml%3E"
  },
  {
    "id": "doc_2",
    "title": "保單健診與校正授權書",
    "desc": "協助客戶進行既有保單資料盤點、缺口校正與權益檢視之授權憑證。",
    "fileType": "text/html",
    "fileName": "保單健診與校正授權書.html",
    "fileData": "data:text/html;charset=utf-8,%3C%21DOCTYPE%20html%3E%3Chtml%3E%3Chead%3E%3Cmeta%20charset%3D%22utf-8%22%3E%3Ctitle%3E%E4%BF%9D%E5%96%AE%E5%81%A5%E8%A8%BA%E8%88%87%E6%A0%A1%E6%AD%A3%E6%8E%88%E6% human%22%3E%3Cstyle%3Ebody%7Bfont-family%3A-apple-system%2CBlinkMacSystemFont%2C%22Noto%20Sans%20TC%22%2Csans-serif%3Bpadding%3A30px%3Bcolor%3A%231e293b%3Bline-height%3A1.6%3Bbackground%3A%23fff%7Dh1%7Bborder-bottom%3A2px%20solid%20%230891b2%3Bpadding-bottom%3A8px%3Bcolor%3A%230e7490%3Bfont-size%3A1.5rem%7D.section%7Bmargin-bottom%3A16px%3Bpadding%3A14px%3Bbackground%3A%23f0fdfa%3Bborder-left%3A4px%20solid%20%2314b8a6%3Bborder-radius%3A4px%7D.terms%7Bfont-size%3A0.88rem%3Bcolor%3A%23334155%3Bmargin-bottom%3A12px%7D%3C%2Fstyle%3E%3C%2Fhead%3E%3Cbody%3E%3Ch1%3E%F0%9F%94%8D%20%E4%BF%9D%E5%96%AE%E5%81%A5%E8%A8%BA%E8%88%87%E6%AC%8A%E7%9B%8A%E6%A0%A1%E6%AD%A3%E6%8E%88%E6%AC%8A%E6%9B%B8%3C%2Fh1%3E%3Cdiv%20class%3D%22section%22%3E%3Cp%20class%3D%22terms%22%3E%E7%AB%8B%E6%8E%88%E6%AC%8A%E6%9B%B8%E4%BA%BA%E5%90%8C%E6%84%8F%E5%A7%94%E8%A8%97%E5%B0%88%E6%A5%AD%E9%A1%A7%E5%95%8F%E5%8D%94%E5%8A%A9%E5%BD%99%E6%95%B4%E3%80%81%E5%88%86%E6%9E%90%E5%80%8B%E4%BA%BA%E5%8F%8A%E5%AE%B6%E5%BA%AD%E6%97%A2%E6%9C%89%E4%BF%9D%E9%9A%AA%E5%A5%91%E7%B4%84%E7%8F%BE%E6%B3%81%EF%BC%8C%E4%B8%A6%E6%AA%A2%E8%A6%96%E9%87%8D%E8%A4%87%E6%8A%95%E4%BF%9D%E3%80%81%E4%BF%9D%E9%9A%9C%E7%A9%BA%E7%AA%97%E6%88%96%E7%90%86%E8%B3%A赔%E6%AC%8A%E7%9B%8A%E5%81%8F%E5%B7%AE%E3%80%82%3C%2Fp%3E%3Cp%20class%3D%22terms%22%3E%E6%9C%AC%E8%B3%87%E6%96%99%E5%83%85%E4%BE%9B%E5%B0%88%E5%B1%AC%E8%B2%A1%E5%8B%99%E8%88%87%E4%BF%9D%E9%9A%AA%E9%9C%80%E6%B1%82%E8%A9%95%E4%BC%B0%E4%BD%BF%E7%94%A8%EF%BC%8C%E5%8F%97%E3%80%8A%E5%80%8B%E4%BA%BA%E8%B3%87%E6%96%99%E4%BF%9D%E8%AD%B7%E6%B3%95%E3%80%8B%E5%AE%8C%E6%95%B4%E8%A6%8F%E7%AF%84%E8%88%87%E4%BF%9D%E8%AD%B7%E3%80%82%3C%2Fp%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22section%22%3E%3Cp%3E%E5%A7%94%E8%A8%97%E4%BA%BA%EF%BC%88%E5%AE%A2%E6%88%B6%EF%BC%89%E7%B0%BD%E7%AB%A0%EF%BC%9A____________________%3C%2Fp%3E%3Cp%3E%E8%81%AF%E7%B5%A1%E9%9B%BB%E8%A9%B1%EF%BC%9A____________________%3C%2Fp%3E%3Cp%3E%E6%8E%88%E6%AC%8A%E6%97%A5%E6%9C%9F%EF%BC%9A____%E5%B9%B4__%E6%9C%88__%E6%97%A5%3C%2Fp%3E%3C%2Fdiv%3E%3C%2Fbody%3E%3C%2Fhtml%3E"
  },
  {
    "id": "doc_3",
    "title": "投保切結與意願確認書",
    "desc": "確認要保人投保意願、健康告知與重要事項告知之實體存根。",
    "fileType": "text/html",
    "fileName": "投保切結與意願確認書.html",
    "fileData": "data:text/html;charset=utf-8,%3C%21DOCTYPE%20html%3E%3Chtml%3E%3Chead%3E%3Cmeta%20charset%3D%22utf-8%22%3E%3Ctitle%3E%E6%8A%95%E4%BF%9D%E5%88%87%E7%B5%90%E8%88%87%E6%84%8F%E9%A1%98%E7%A2%BA%E8%AA%8D%E6%9B%B8%3C%2Ftitle%3E%3Cstyle%3Ebody%7Bfont-family%3A-apple-system%2CBlinkMacSystemFont%2C%22Noto%20Sans%20TC%22%2Csans-serif%3Bpadding%3A30px%3Bcolor%3A%231e293b%3Bline-height%3A1.6%3Bbackground%3A%23fff%7Dh1%7Bborder-bottom%3A2px%20solid%20%23d97706%3Bpadding-bottom%3A8px%3Bcolor%3A%23b45309%3Bfont-size%3A1.5rem%7D.section%7Bmargin-bottom%3A16px%3Bpadding%3A14px%3Bbackground%3A%23fffbeb%3Bborder-left%3A4px%20solid%20%23f59e0b%3Bborder-radius%3A4px%7D.check-item%7Bmargin-bottom%3A8px%3Bfont-size%3A0.9rem%7D%3C%2Fstyle%3E%3C%2Fhead%3E%3Cbody%3E%3Ch1%3E%E2%9C%85%20%E6%8A%95%E4%BF%9D%E5%88%87%E7%B5%90%E8%88%87%E6%84%8F%E9%A1%98%E7%A2%BA%E8%AA%8D%E6%9B%B8%3C%2Fh1%3E%3Cdiv%20class%3D%22section%22%3E%3Cdiv%20class%3D%22check-item%22%3E%E2%96%A1%20%E6%9C%AC%E4%BA%BA%E5%B7%B2%E5%85%85%E5%88%86%E7%9E%AD%E8%A7%A3%E4%BF%9D%E9%9A%AA%E5%95%86%E5%93%81%E5%85%A7%E5%AE%B9%E3%80%81%E7%B7%A0%E7%B4%84%E6%A2%9D%E6%AC%BE%E8%88%87%E5%85%8D%E8%B2%AC%E4%BA%8B%E7%94%B1%E3%80%82%3C%2Fdiv%3E%3Cdiv%20class%3D%22check-item%22%3E%E2%96%A1%20%E6%9C%AC%E4%BA%BA%E5%B7%B2%E7%A2%BA%E8%AA%8D%E5%81%A5%E5%BA%B7%E8%A9%B3%E5%AF%A6%E5%91%8A%E7%9F%A5%E4%BA%8B%E9%A0%85%E4%B8%A6%E7%84%A1%E9%9A%B1%E5%8C%BF%E3%80%82%3C%2Fdiv%3E%3Cdiv%20class%3D%22check-item%22%3E%E2%96%A1%20%E6%9C%AC%E4%BA%BA%E5%B7%B2%E6%B8%85%E6%A5%9A%E9%A6%96%E6%9C%9F%E4%BF%9D%E8%B2%BB%E6%89%A3%E6%AC%BE%E6%99%82%E7%A8%8B%E8%88%87%E5%A5%91%E7%B4%84%E7%8F%BE%E6%95%88%E6%97%A5%E6%9C%9F%E3%80%82%3C%2Fdiv%3E%3C%2Fdiv%3E%3Cdiv%20class%3D%22section%22%3E%3Cp%3E%E8%A6%81%E4%BF%9D%E4%BA%BA%E7%B0%BD%E7%AB%A0%EF%BC%9A____________________%20%20%20%20%E8%A2%AB%E4%BF%9D%E9%9A%AA%E4%BA%BA%E7%B0%BD%E7%AB%A0%EF%BC%9A____________________%3C%2Fp%3E%3Cp%3E%E7%B0%BD%E7%BD%B2%E6%97%A5%E6%9C%9F%EF%BC%9A____%E5%B9%B4__%E6%9C%88__%E6%97%A5%3C%2Fp%3E%3C%2Fdiv%3E%3C%2Fbody%3E%3C%2Fhtml%3E"
  }
];

// =============================================================================
// 預設固定訊息清單 (從客戶案件管理系統 Google Sheets 完整搬移備份)
// =============================================================================
const DEFAULT_FIXED_MESSAGES = [
  {
    "id": "fixed_1784536734444",
    "title": "簽約前資料提供",
    "content": "先跟你說，簽約需要準備的資料如下，先傳給我，我先把資料登打好，簽約的時間可以大大縮短\n\n【基本資料】\n姓名：\n身份證字號：\n出生年／月／日：\n住址：\n手機電話：\nE-MAIL：\n出生地：\n\n【工作資料】\n工作的公司名稱：\n公司的營業性質：\n目前在公司的職位：\n工作內容（簡單敘述就好）：\n\n【繳費資訊】\n繳別：年繳/月繳\n繳費方式：信用卡/轉帳\n受益人：\n\n【身體衡量狀況】\n身高：\n體重：\n\n【財務狀況】（大概抓一下就好，公司參考用的而已，不會真的去查）\n目前個人年收入：\n目前個人存款總額：\n比較常使用的銀行："
  },
  {
    "id": "fixed_1784729346192",
    "title": "訪前規劃",
    "content": "Ａ了解客戶現況與財務資料\nＢ了解客戶（或是觸發客戶沒想過）對未來生活的期待與擔心。（類似設定目標）\n１發覺客戶（或是讓客戶發覺）期待與現況的落差 （現況跟期待有落差）\n２誘發客戶彌補落差的急迫性 （而且是身為顧問的我有辦法彌補，是緊急的，越快處理才好的）\n３了解客戶對於解決方案的偏好及原因\nＣ探尋決策者\nＤ了解客戶可投入的資金規模及有無競爭者"
  },
  {
    "id": "fixed_1784734408369",
    "title": "ＡＩ｜訪前規劃提示詞",
    "content": "### 🤖 進階實戰銷售：情境腳本與脈絡性提問 AI 生成指令\n**(請複製以下區塊內容，並填寫括號中的資訊後發送給 AI)**\n\n**【角色設定】**\n你是一位擁有頂尖實戰經驗的保險/財務顧問，精通「顧問式引導」與「提問式銷售」。你的對話風格極度自然、像朋友聊天，擅長在日常情境中無縫切入理財議題，並透過層層剝洋蔥的脈絡性提問，引導客戶自己發現財務缺口。\n\n**【任務目標】**\n請根據我提供的「見面情境」、「客戶背景」與「切入議題」，為我產出一份可以直接實戰對話的「結構化銷售腳本」。\n\n**【輸入資訊】**\n*   **見面情境**：[請填寫，例如：在便利商店趁客戶簽署行政文件時的短暫 10 分鐘 / 陪同客戶去體檢的車程上 / 在咖啡廳喝下午茶]\n*   **客戶對象與背景**：[請填寫，例如：60歲中小企業老闆娘與30歲很會花錢的女兒 / 剛買房的新婚夫妻 / 擁有海外債券的高資產客戶]\n*   **預計切入的議題**：[請填寫，例如：保單隱形贈與 / 夫妻剩餘財產檢視 / 理財機器人創造現金流 / 海外免稅額度]\n\n**【生成心法與要求】**\n1.  **口語化與情境融入**：對話必須高度符合設定的「見面情境」，用閒聊開場，絕對不可像在做生硬的身家調查或業務推銷。\n2.  **運用故事包裝**：在帶入生硬的金融概念前，必須用一個「生活化的故事」或「比喻」（如：朋友的真實案例、理財機器人）來包裝。\n3.  **嚴格遵守脈絡性提問結構**：提問必須環環相扣，依序引導出客戶的期待、落差與急迫性，最後自然銜接到下一次的碰面邀約。\n\n**【輸出格式要求】**\n請針對每一個「切入議題」，嚴格依照以下 5 大結構產出對話內容：\n\n**1. 隨口開啟的第一句話**：（結合當下的見面情境，自然無違和地帶入話題）\n**2. 激發興趣的腳本重點**：（用一句大白話點出該議題的核心利益或避險價值）\n**3. 講故事**：（用 3~4 句話講述一個情境比喻或真實案例，讓客戶產生共鳴與畫面感）\n**4. 脈絡與結構性提問**：（請嚴格依據以下七階段，設計連貫的聊天式提問）\n*   **Ａ【了解現況】**：（了解客戶目前的真實狀態與財務資料）\n*   **Ｂ【期待與擔心】**：（了解或觸發客戶對未來生活的期待與恐懼）\n*   **１【發覺落差】**：（讓客戶自己發覺目前的做法與未來期待之間存在的落差）\n*   **２【急迫性】**：（誘發彌補落差的急迫性，強調現在不處理的代價）\n*   **３【偏好與原因】**：（提出解決方案並測試客戶偏好，例如：你比較喜歡做法一還是做法二？）\n*   **Ｃ【探尋決策者】**：（輕描淡寫確認這件事由誰作主）\n*   **Ｄ【資金與競爭者】**：（了解客戶可動用的資金規模，以及是否有其他同業在服務）\n**5. UMBC邀約話稿**：（結合上述討論，給出一個合理、無壓力的理由，約定下一次的見面與進一步提案）\n\n***\n\n### 💡 顧問解析：為什麼你需要這套提示詞？\n這套提示詞的核心價值在於**「模組化你的高轉換率思維」**。\n在錄音檔中，教學者不斷強調要「先收集資訊（如不動產是誰的、有沒有做贈與）」、「挑選客戶在意的利益點放大（如3000萬變6000萬）」，最後再「埋一個伏筆邀約下次見面」。\n這套提示詞將上述心法徹底結構化，未來無論你面對多複雜的客戶屬性或多零碎的見面場合，AI 都能幫你快速武裝好一套邏輯嚴密且充滿人情味的「實戰劇本」。"
  },
  {
    "id": "fixed_1784914684329",
    "title": "旅平卡１｜簡介",
    "content": "新增"
  },
  {
    "id": "fixed_1784792945892",
    "title": "旅平卡２｜簽約前資料提供",
    "content": "以下資料先提供給我，我先登打在系統裡，見面的時候可以處理的比較快喔～\n\n【基本資料】\n姓名：\n身份證字號：\n出生年／月／日：\n住址：\n手機電話：\nE-MAIL："
  },
  {
    "id": "fixed_1784914620113",
    "title": "旅平卡３｜投保教學",
    "content": "ＯＯ～或許會收到簡訊，是申辦通知，留意就好，不需要你們做什麼事情。\n\n這個是投保流程影片，你可以看看。\nhttps://www.youtube.com/watch?v=PrF8cSBcQSk\n\n這個是投保入口，它叫做「旅遊小管家」\nhttps://b2c.518fb.com/TravelHouseKeeper/index.html#\n\n■要是購買了機票，就可以投保了，這跟班機延誤以及取消行整有關係。\n■只要是你踏出家門前往機場以及歸國家門裡，就可以是保險的起迄時間喔～\n■但要是忙到忘記了，最晚在飛機起飛前一小時要投保完成就可以生效了（但我建議還是兩小時前）"
  },
  {
    "id": "fixed_1785828290982",
    "title": "旅平卡４｜海外旅遊醫療加值",
    "content": "對了，我覺得旅平險在於海外醫療的部分，特別要跟您說明一下，國外商品組合內容，分有「國外旅遊適用」以及「國外旅遊醫療加值型」的計劃別。\n\n■國外旅遊適用：醫療保額與身故保額高度綁定（上限約身故保額的 10%）。若身故僅投保 100 萬，傷害及海外突發疾病醫療上限即鎖死在 10 萬（門診最高僅 2,000 元、急診僅 5,000 元），需提高身故保額才能拉高醫療額度。特別適合預算有限、主要偏重旅遊不便險，或是前往東南亞等醫療費用相對較低地區的旅客。\n\n■國外旅遊醫療加值型：醫療保額與身故保額完全脫鉤。不受限於「身故額度 10%」的傳統限制，即使身故只保 100 萬，醫療同樣給足 150 萬。所以連同海外門診（最高 3 萬）、急診與住院（最高 150 萬）額度一次到位，特別適合重視海外高額醫療花費，例如前往歐美、日韓或申根國家等地區。\n\n提供給您瞭解。"
  },
  {
    "id": "fixed_1785921704441",
    "title": "旅平卡５｜投保資訊確認",
    "content": "陳小姐，上午您好，我有收到公司您投保的資訊，作為服務人員來跟您確認一下資訊（曾有客戶按錯日期，理賠上就發生了遺憾）：\n\n■保險期間：\n【踏出家門】2026年08月07日（週五）09時00分~\n【返抵家門】2026年08月24日（週一）09時00分 共17天\n\n■出國地區(含轉機地點)：泰國\n\n如果沒問題的話，可以在本留言按個小貼圖也讓我知道您確認了。\n如果發現有需要異動，也沒關係，可以在旅遊小管家原保單中更改保期，又或是打電話到0809-019-888轉2，由客服協助處理。"
  },
  {
    "id": "fixed_1784946736609",
    "title": "旅平卡６｜服務權益",
    "content": "跟你說～歐陽針對於你申辦完旅平卡之後的服務權益，要讓你知道\n\n【理賠文件詢問】\n當你在出國時有遇到狀況，第一時間當然可以聯繫我，把理賠所需文件問清楚。讓你在海外當下可以把文件取得完整，才不會回國之後資料不齊全而無法申請理賠。\n\n【緊急聯絡人設定】\n建議你可以把我的 LINE 丟給這次同行的夥伴，或者隨手拉個群組都好。主要是因應遇到狀況是你剛好不方便或是無法聯繫時，至少夥伴能直接對接我，讓我第一時間幫你把理賠文件或是其他需要幫忙的地方處理掉，不讓你孤立無援。\n\n而這只是個「備而不用」的安全機制，除了緊急狀況或你們主動找我，我不會去做任何打擾。\n\n【保單建檔】\n要是發生需要理賠的情形，既然都聯繫我了，不如也讓我把你的所有保單在我這邊建檔（含公司團險），我們有系統都可以查得到所有保險公司所發行過產品的條款。這樣你只要聯繫我一個人，就可以取得所有你在保險權益上的資訊。要不要在我這邊建檔呢？"
  },
  {
    "id": "fixed_1787287658951",
    "title": "旅平卡７｜官方網站DM",
    "content": "https://b2c.518fb.com/TravelHouseKeeper/docDownload/downloadDocFile?id=1701943959328809&fileName=1701943959328809"
  }
];


// HTML 特殊字元跳脫安全防護函式
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// 台灣產險報價規格日期轉換工具 (ROC / AD Date Converter for Insurance Quoting)
// =============================================================================

// 出生年月日轉換 (產險常用：民國7碼 0810801 / 81/08/01，西元 1992-08-01)
function formatRocBirthDate(dateStr) {
  if (!dateStr) return { roc7: '', rocSlash: '', rocShortSlash: '', ad: '', adDigits: '' };
  let cleaned = String(dateStr).trim().replace(/[./]/g, '-');
  if (!cleaned.includes('-')) {
    if (/^\d{8}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    } else if (/^\d{7}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 7)}`;
    } else if (/^\d{6}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
    }
  }
  const parts = cleaned.split('-');
  if (parts.length < 3) return { roc7: dateStr, rocSlash: dateStr, rocShortSlash: dateStr, ad: dateStr, adDigits: dateStr };

  let year = parseInt(parts[0], 10);
  const month = parts[1].padStart(2, '0');
  const day = parts[2].padStart(2, '0');

  // 若輸入的是民國年 (小於 1900)
  if (year < 1900) {
    const rocYear = year;
    const adYear = year + 1911;
    const roc7 = String(rocYear).padStart(3, '0') + month + day;
    return {
      roc7,
      rocSlash: `${String(rocYear).padStart(3, '0')}/${month}/${day}`,
      rocShortSlash: `${rocYear}/${month}/${day}`,
      ad: `${adYear}-${month}-${day}`,
      adDigits: `${adYear}${month}${day}`
    };
  } else {
    // 西元年轉民國
    const rocYear = year - 1911;
    const roc7 = String(rocYear).padStart(3, '0') + month + day;
    return {
      roc7,
      rocSlash: `${String(rocYear).padStart(3, '0')}/${month}/${day}`,
      rocShortSlash: `${rocYear}/${month}/${day}`,
      ad: `${year}-${month}-${day}`,
      adDigits: `${year}${month}${day}`
    };
  }
}

// 出廠年月轉換 (產險常用：西元 201605 / 2016-05，民國 105/05 / 10505)
function formatManufactureDate(dateStr) {
  if (!dateStr) return { adDigits: '', adDash: '', rocSlash: '', rocDigits: '' };
  let cleaned = String(dateStr).trim().replace(/[./]/g, '-');
  if (!cleaned.includes('-')) {
    if (/^\d{6}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`;
    } else if (/^\d{5}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}`;
    } else if (/^\d{4}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}`;
    }
  }
  const parts = cleaned.split('-');
  if (parts.length < 2) return { adDigits: dateStr, adDash: dateStr, rocSlash: dateStr, rocDigits: dateStr };

  let year = parseInt(parts[0], 10);
  const month = parts[1].padStart(2, '0');

  if (year < 1900) {
    const adYear = year + 1911;
    const rocYear = year;
    return {
      adDigits: `${adYear}${month}`,
      adDash: `${adYear}-${month}`,
      rocSlash: `${rocYear}/${month}`,
      rocDigits: `${String(rocYear).padStart(3, '0')}${month}`
    };
  } else {
    const rocYear = year - 1911;
    return {
      adDigits: `${year}${month}`,
      adDash: `${year}-${month}`,
      rocSlash: `${rocYear}/${month}`,
      rocDigits: `${String(rocYear).padStart(3, '0')}${month}`
    };
  }
}

// 發照日期轉換 (產險與監理站規格：民國 105/11/02 / 1051102，西元 2016-11-02)
function formatIssueDate(dateStr) {
  if (!dateStr) return { rocSlash: '', rocDigits: '', ad: '', adDigits: '' };
  let cleaned = String(dateStr).trim().replace(/[./]/g, '-');
  if (!cleaned.includes('-')) {
    if (/^\d{8}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    } else if (/^\d{7}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 7)}`;
    } else if (/^\d{6}$/.test(cleaned)) {
      cleaned = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
    }
  }
  const parts = cleaned.split('-');
  if (parts.length < 3) return { rocSlash: dateStr, rocDigits: dateStr, ad: dateStr, adDigits: dateStr };

  let year = parseInt(parts[0], 10);
  const month = parts[1].padStart(2, '0');
  const day = parts[2].padStart(2, '0');

  if (year < 1900) {
    const adYear = year + 1911;
    const rocYear = year;
    return {
      rocSlash: `${rocYear}/${month}/${day}`,
      rocDigits: `${String(rocYear).padStart(3, '0')}${month}${day}`,
      ad: `${adYear}-${month}-${day}`,
      adDigits: `${adYear}${month}${day}`
    };
  } else {
    const rocYear = year - 1911;
    return {
      rocSlash: `${rocYear}/${month}/${day}`,
      rocDigits: `${String(rocYear).padStart(3, '0')}${month}${day}`,
      ad: `${year}-${month}-${day}`,
      adDigits: `${year}${month}${day}`
    };
  }
}

const DEFAULT_TOPICS = [
  // --- 0. 個人客群核心日常 - 生活議題 (聊天第1、出國旅遊第2) ---
  {
    id: "t_034",
    category: "生活議題",
    title: "聊天",
    scriptTips: "【U】日常生活近況隨聊與信任升溫【M】不帶目的性關心家庭、工作與休閒，掌握潛在生活變動情報【B】建立長久信賴陪伴關係，自然切入人生階段關鍵話題【C】定期相約喝咖啡、傳送生活問候或關心近況",
    isActive: true,
    order: 1,
    scope: "INDIVIDUAL",
    isSystem: true
  },
  {
    id: "t_travel",
    category: "生活議題",
    title: "出國旅遊",
    scriptTips: "【U】得知朋友即將出國旅遊或洽公【M】出發前常遺漏旅平險或突發疾病醫療額度不足，海外天價醫療與班機延誤常措手不及【B】協助開通旅平卡一鍵投保、規劃海外突發急難救助與不便險權益告知，回國暖心接風【C】順口關心「這次去哪一國？幾號出發回國呢？」，我幫您預先準備旅平卡與出國保障小叮嚀！",
    isActive: true,
    order: 2,
    scope: "INDIVIDUAL",
    isSystem: true
  },

  // --- 1. 個人客群專屬 - 風險管控 ---
  {
    id: "t_008",
    category: "風險管控",
    title: "車險",
    scriptTips: "【U】路上超跑與高價車碰撞風險【M】強制險不賠財損，天價修車費直接侵蝕個人資產【B】銅板價升級千萬超額責任險，自用車免費保單檢視【C】順手拍一下目前車險保單，我幫您檢視超額額度",
    isActive: true,
    order: 3,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_001",
    category: "風險管控",
    title: "癌症一次金",
    scriptTips: "【U】新式標靶與免疫療法需第一時間大額現金【M】傳統住院日額無法在確診初期提供百萬救急金【B】確診即給付一次金，專心治療不受工作停擺壓力【C】比對現有防癌額度是否達到兩年年薪天花板",
    isActive: true,
    order: 2,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_010",
    category: "風險管控",
    title: "男女癌",
    scriptTips: "【U】特定性別高發癌症好發年齡提早【M】乳癌、卵巢癌、攝護腺癌等自費精準治療費用高昂【B】針對性別特定重症加成給付，精準強化關鍵保障【C】安排10分鐘了解男女專屬特定重疾額度差異",
    isActive: true,
    order: 3,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_011",
    category: "風險管控",
    title: "在宅醫療",
    scriptTips: "【U】衛福部在宅急症照護政策與高齡居家醫療趨勢【M】未來長輩或自己生病不見得能即時排到病房【B】在宅醫療新條款相容給付，在家也能安心獲得醫院級照護【C】提供最新在宅急症醫療條款核保指引",
    isActive: true,
    order: 4,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_002",
    category: "風險管控",
    title: "實支實付",
    scriptTips: "【U】醫療新制上路與自費醫材自付額持續攀升【M】舊式實支實付雜費額度過低，動手術需自掏腰包數十萬【B】升級新式實支實付或自負額專案，補齊醫療天花板【C】免費一頁式自費清單與既有保單額度對照",
    isActive: true,
    order: 5,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_012",
    category: "風險管控",
    title: "保單檢視",
    scriptTips: "【U】人生不同責任期與通膨環境下保單需定期校正【M】買了十年沒看過，往往繳了保費卻在理賠時才發現不賠【B】全家一頁式保障權益圖，清楚釐清重複與缺口【C】週四下午帶保單出來，我幫您做客觀無痛體檢",
    isActive: true,
    order: 6,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_013",
    category: "風險管控",
    title: "新生兒保單",
    scriptTips: "【U】寶寶報戶口與黃金投保期（出院/滿月無體況期）【M】若篩檢出異常可能面臨延後加費或加註批註【B】千元小預算打造雙實支、大額一次金與燒燙傷防護網【C】傳送一份新生兒極簡防護懶人包給您參考",
    isActive: true,
    order: 7,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_014",
    category: "風險管控",
    title: "旅平卡",
    scriptTips: "【U】海外突發疾病、班機延誤與緊急醫療救援【M】信用卡贈送旅平險限制多，海外就醫自費天價【B】一通電話即時開卡出單，全球緊急救援專線隨身備【C】下次出國前直接在 LINE 上回傳天數即可啟動",
    isActive: true,
    order: 8,
    scope: "INDIVIDUAL"
  },

  // --- 2. 個人客群專屬 - 投資與生活 ---
  {
    id: "t_005",
    category: "投資理財",
    title: "財務檢視與規劃",
    scriptTips: "【U】家庭資產配置、現金流平衡與人生各階段目標回推【M】無系統性盤點導致通膨侵蝕購買力、資產過度集中【B】建構短中長期專款專用蓄水池，確保財務獨立自由【C】預約一小時財務健檢，梳理個人收支資產負債表",
    isActive: true,
    order: 9,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_003",
    category: "投資理財",
    title: "月配息",
    scriptTips: "【U】兼顧本金安全性與每個月穩定現金流回饋【M】單純放定存利息被通膨吃光，放高風險商品又擔心本金腰斬【B】鎖定低波動穩定配息架構，打造終身不退休被動月收入【C】試算不同本金規模對應之每月確定配息金額",
    isActive: true,
    order: 10,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_006",
    category: "稅務傳承",
    title: "意定監護",
    scriptTips: "【U】在意識清楚時自行選任信賴之監護人【M】避免中風失智時法院指定親屬監護引發家族爭產【B】確保未來生活、醫療及財產管理完全依照自己意願執行【C】法律顧問團隊陪同擬定意定監護契約公證流程",
    isActive: true,
    order: 11,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_018",
    category: "稅務傳承",
    title: "分配",
    scriptTips: "【U】特留分與應繼分法規限制下的資產自主移轉【M】傳統生前贈與或身後繼承易引發手足訴訟與稅負重擔【B】活用指定受益人權限，精準將財富分配給最想照顧的對象【C】試算不同子女分配比例與合法避開特留分爭端架構",
    isActive: true,
    order: 12,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_019",
    category: "稅務傳承",
    title: "遺囑",
    scriptTips: "【U】自書、代筆、公證等法定有效遺囑撰寫【M】遺囑形式瑕疵導致無效，引發繼承人曠日廢時對簿公堂【B】白紙黑字明確財產清單與執行人，讓愛完整傳承無紛爭【C】提供五大民法法定遺囑範本與注意事項檢視清單",
    isActive: true,
    order: 13,
    scope: "INDIVIDUAL"
  },
  {
    id: "t_020",
    category: "稅務傳承",
    title: "親生監護",
    scriptTips: "【U】單親、再婚或身心障礙子女之指定監護與財產信託【M】父母若先離開，未成年子女遺產恐遭前配偶或親戚挪用【B】結合保險金信託與遺囑指定監護人，確保專款專用於子女成年【C】安排信託架構師量身設計子女教育與生活金防護網",
    isActive: true,
    order: 14,
    scope: "INDIVIDUAL"
  },

  {
    id: "t_021",
    category: "生活議題",
    title: "生日",
    scriptTips: "【U】客戶生日月份是最佳關心切入點與保單年齡加費前夕【M】錯過生日前半年（保險年齡晉級）將面臨終身保費調漲【B】暖心祝福加碼提醒在保險年齡加一歲前鎖住原費率【C】生日前兩週預先寄發溫馨祝福卡與生日前夕保費權益通知",
    isActive: true,
    order: 16,
    scope: "INDIVIDUAL"
  },

  // --- 3. 企業客戶專屬議題 ---
  {
    id: "t_015",
    category: "風險管控",
    title: "團險",
    scriptTips: "【U】雇主職災法定補償責任與員工福利留才【M】職災意外一旦發生，雇主需負勞基法第59條無過失連帶賠償責任【B】團體傷害與醫療險合法轉嫁雇主職災風險與抵稅【C】提供公司員工人數與職業等級，為您試算低成本團險方案",
    isActive: true,
    order: 16,
    scope: "CORPORATE"
  },
  {
    id: "t_016",
    category: "風險管控",
    title: "企業險",
    scriptTips: "【U】營業場所公共意外責任險與關鍵商業火險【M】顧客在廠區或店內意外摔傷或重大火災導致營業中斷天價求償【B】全方位轉嫁營業財產損害、產品責任與第三方責任風險【C】提供行業別與營業坪數，免費評估法定投保門檻",
    isActive: true,
    order: 17,
    scope: "CORPORATE"
  },
  {
    id: "t_022",
    category: "投資理財",
    title: "留才金牌與員工年金",
    scriptTips: "【U】核心技術幹部與關鍵高階主管黃金手銬【M】中高階人才遭競業高薪挖角，研發與客戶流失造成企業重創【B】透過留才年金或遞延獎酬保單，滿期轉移所有權綁定關鍵人才【C】客製留才合約範本與主管激勵試算表",
    isActive: true,
    order: 18,
    scope: "CORPORATE"
  },
  {
    id: "t_023",
    category: "風險管控",
    title: "關鍵人物保險 Keyman",
    scriptTips: "【U】企業負責人與核心靈魂人物之意外身故風險【M】負責人一旦突發變故，銀行抽銀根、供應鏈信任危機引發倒閉【B】保單價值準備金列入公司資產，理賠金第一時間注入營運周轉【C】依企業營收規模與銀行貸款額度，精算關鍵人保險適足部位",
    isActive: true,
    order: 19,
    scope: "CORPORATE"
  },
  {
    id: "t_024",
    category: "稅務傳承",
    title: "企業稅務與CFC反避稅",
    scriptTips: "【U】未分配盈餘稅5%與境外公司受控外國企業(CFC)法規上路【M】海外盈餘全數穿透課稅，企業未分配盈餘面臨加徵重稅【B】合法善用企業保單列支費用與專款留存，優化資產負債表【C】由會計師協同檢視近三年財報與境外金流架構",
    isActive: true,
    order: 20,
    scope: "CORPORATE"
  },
  {
    id: "t_025",
    category: "稅務傳承",
    title: "股東互保與退夥協議",
    scriptTips: "【U】合夥股東身故後的股權繼承與經營權穩定【M】合夥人過世其配偶子女繼承股權卻不懂經營，導致公司營運癱瘓甚至賣給外人【B】股東互相以對方為被保險人投保，身故金直接作為買回股權專用資金【C】提供閉鎖性公司章程限制股權移轉與股東互保合約指引",
    isActive: true,
    order: 21,
    scope: "CORPORATE"
  },
  {
    id: "t_026",
    category: "稅務傳承",
    title: "二代接班與股權信託",
    scriptTips: "【U】家族企業所有權、經營權與受益權平穩交接【M】創辦人年邁未立傳承架構，驟逝引發手足爭奪經營權與高額遺產稅【B】結合閉鎖性公司黃金特別股、家族股權信託與分紅保單現金流【C】預約家族財富傳承架構師為二代接班梳理診斷藍圖",
    isActive: true,
    order: 22,
    scope: "CORPORATE"
  },

  // --- 4. 個人與企業通用議題 ---
  {
    id: "t_007",
    category: "投資理財",
    title: "海外所得免稅額",
    scriptTips: "【U】基本所得額（最低稅負制）與每年750萬免稅額活用【M】海外投資、美股、境外債券獲利若未合規申報將遭補稅重罰【B】合法善用保險金與海外所得免稅額度，達成資產無痕跨境配置【C】提供最新海外所得申報門檻與合法免稅規劃範例",
    isActive: true,
    order: 23,
    scope: "BOTH"
  },
  {
    id: "t_017",
    category: "投資理財",
    title: "不動產活化",
    scriptTips: "【U】老屋高價值但低租金投報，或面臨高額持有稅【M】紙上富貴缺乏流動現金，面臨長照或醫療時無法變現【B】透過保單留房養老、分紅轉化或信託，將死資產變活現金流【C】為名下不動產做一份流動性與稅務效益評估",
    isActive: true,
    order: 24,
    scope: "BOTH"
  },
  {
    id: "t_004",
    category: "稅務傳承",
    title: "預留稅源",
    scriptTips: "【U】遺產稅必須在申報後以『現金』限期繳納【M】繼承人若無大額現金，不動產或股票將面臨被強制拍賣低賣【B】身故保險金第一時間免扣繳遺產稅，直接作為繳稅現金庫【C】試算未來預估遺產總額與應納稅額之現金缺口",
    isActive: true,
    order: 25,
    scope: "BOTH"
  },
  {
    id: "t_009",
    category: "組織發展",
    title: "職涯轉換與事業合夥發展",
    scriptTips: "【U】金融體系獨立創業與事業合夥人機制【M】打破單一職場薪資天花板與時間綁架【B】透明分潤、團隊資源賦能與客戶資產終身積累【C】輕鬆品杯咖啡了解團隊文化與賦能資源",
    isActive: true,
    order: 26,
    scope: "RECRUIT"
  },
  {
    id: "t_030",
    category: "組織發展",
    title: "兼職斜槓與多元被動收入",
    scriptTips: "【U】在主業之外拓展合法第二曲線與財務護城河【M】單一收入源在通膨與經濟波動下抗風險能力極弱【B】運用業餘時間考照與受訓，漸進式建立可累積客戶資產【C】安排線上30分鐘，評估兼職合作模式與時間配比",
    isActive: true,
    order: 27,
    scope: "RECRUIT"
  },
  {
    id: "t_031",
    category: "組織發展",
    title: "金融創業與零資本團隊經營",
    scriptTips: "【U】不需店面囤貨與大額資本的平台型輕創業【M】傳統創業開店風險巨大、人事租金固定成本沉重【B】借力大型壽險金控平台資源，專注組織裂變與團隊倍增【C】參與團隊月度創業說明茶會，了解真實合夥人成長歷程",
    isActive: true,
    order: 28,
    scope: "RECRUIT"
  },
  {
    id: "t_032",
    category: "組織發展",
    title: "專業轉型與高資產顧問培育",
    scriptTips: "【U】由傳統商品推銷升級為稅務傳承與家族財富規劃顧問【M】單純話術銷售容易被AI與網路投保取代淘汰【B】體系完整傳承信託、稅法精算與企業主頂級諮詢培育系統【C】預約參訪高資產實戰研討會，體驗專業顧問日常作業模式",
    isActive: true,
    order: 29,
    scope: "RECRUIT"
  },
  {
    id: "t_033",
    category: "組織發展",
    title: "家庭與事業自主時間重塑",
    scriptTips: "【U】兼顧家庭陪伴、個人健康與高產能事業自主權【M】朝九晚五打卡與超長工時剝奪陪伴家人關鍵黃金期【B】高彈性排程自主、績效導向成果與無上限成長空間【C】聊聊目前時間分配現況，探索更有品質的生活節奏",
    isActive: true,
    order: 30,
    scope: "RECRUIT"
  }
];

const DEFAULT_CONTACTS = [
  // --- 個人客戶群 ---
  {
    id: "c_001",
    name: "游長霖",
    category: "公教客群",
    clientType: "INDIVIDUAL",
    phone: "0912-345-678",
    mbti: "INTJ",
    disc: "SC",
    tags: ["公教在職碩士", "減重自律58kg", "心血管家族史", "身心停藥一年", "單身居龍井"],
    notes: "剛修完碩士課程，想了解防癌一次金與養生村居住，父親有腸道問題，騎車通勤需留意超額險。",
    lastContactDate: "2026-09-29",
    isRecruit: true
  },
  {
    id: "c_006",
    name: "古家蓁",
    category: "一般緣故",
    clientType: "INDIVIDUAL",
    phone: "",
    mbti: "ISFJ",
    disc: "S",
    tags: ["單親媽媽", "撫養大兒子沐宸", "無監護權但極度護子", "前夫家族產權爭議", "帳目不清受害者", "排斥Lexus品牌"],
    notes: "大兒子沐宸（約5~6歲）。2020年曾遭前夫弟弟家暴出血急診。離婚未拿贍養費與財產，無監護權但將孩子視為絕對底線。對財務查帳、明細公開透明度有極高安全感需求。排斥Lexus品牌。",
    lastContactDate: "2026-10-04"
  },
  {
    id: "c_003",
    name: "陳怡婷",
    category: "竹科新貴",
    clientType: "INDIVIDUAL",
    phone: "0933-778-899",
    mbti: "ISTJ",
    disc: "CD",
    tags: ["雙薪家庭", "新生兒一歲", "重視自費醫療", "高所得稅率20%"],
    notes: "對自費達文西微創手術與標靶藥物缺口高度敏感，亦想評估勞退自提與年金儲蓄規劃。",
    lastContactDate: "2026-08-20"
  },
  {
    id: "c_004",
    name: "趙文華",
    category: "退休公務員",
    clientType: "INDIVIDUAL",
    phone: "0919-556-677",
    mbti: "ISFJ",
    disc: "S",
    tags: ["屆齡退休", "房產自住", "偏好確定金流", "關注養生村"],
    notes: "剛從教育界退休，子女在海外工作，積極評估台南/台中指標養生村保證金與意定監護流程。",
    lastContactDate: "2026-07-10"
  },
  {
    id: "c_005",
    name: "張敏芳",
    category: "專業醫護",
    clientType: "INDIVIDUAL",
    phone: "0955-443-322",
    mbti: "ESTJ",
    disc: "DC",
    tags: ["診所副院長", "高壓輪班", "重視重症防護", "有車輛通勤"],
    notes: "熟悉醫療現況因此極度重視一次金大額賠付，曾提及上下班開進口休旅車需檢視超額超跑險。",
    lastContactDate: "2026-09-25"
  },
  {
    id: "c_007",
    name: "陳樂",
    category: "一般緣故",
    clientType: "INDIVIDUAL",
    phone: "0963-630-613",
    mbti: "",
    disc: "",
    tags: ["行照車主:陳佳瑜", "機車車險", "南投水里", "富邦續保"],
    notes: "要保人與被保險人登記為陳樂，名下機車光陽124cc (MDT-3323，行照名義車主為陳佳瑜)。email: chenjiayu1992@gmail.com，地址：南投縣水里鄉南光村南昌街32號。富邦第三人責任險(保單號0426KV / 報價單0426KAQ0540520)。",
    lastContactDate: "2026-10-04"
  },

  // --- 企業客戶群 ---
  {
    id: "c_002",
    name: "林建宏",
    category: "中小企業主",
    clientType: "CORPORATE",
    phone: "0928-112-233",
    mbti: "ENTJ",
    disc: "D",
    tags: ["高資產", "二代接班", "不動產多筆", "關注遺贈稅"],
    notes: "公司擴張穩定，考慮以分紅保單與安養信託提早將現金流平穩移轉給子女，防範遺產爭端。",
    lastContactDate: "2026-09-15"
  },
  {
    id: "c_007",
    name: "郭崇文",
    category: "精密機械董座",
    clientType: "CORPORATE",
    phone: "0932-889-101",
    mbti: "ESTJ",
    disc: "D",
    tags: ["員工人數50人", "外銷歐美", "職災責任", "留才金牌"],
    notes: "台中精密機械廠創辦人，關注勞基法59條雇主職災補償責任轉嫁，想為5位核心研發主管規劃留才金牌保單。",
    lastContactDate: "2026-09-18"
  },
  {
    id: "c_008",
    name: "曾立偉",
    category: "禾廣生技總經理",
    clientType: "CORPORATE",
    phone: "0911-223-344",
    mbti: "ENTP",
    disc: "DI",
    tags: ["新創生技", "合夥創業", "關鍵人保險", "CFC反避稅"],
    notes: "竹北生醫園區新創，兩位合夥股東，已啟動A輪融資，高度需要關鍵人物金鑰保險維持銀行授信與股東互保退夥機制。",
    lastContactDate: "2026-09-22"
  }
];

const DEFAULT_TOUCHPOINTS = {
  // 古家蓁
  "c_006_t_020": {
    id: "tp_c006_t020",
    contactId: "c_006",
    topicId: "t_020",
    latestDate: "2026-10-04",
    status: "planned",
    history: [
      {
        id: "h_c006_1",
        date: "2026-10-04",
        channel: "網路社群貼文分析",
        summary: "社群公開發文：控訴2020年懷孕遭前夫胞弟施暴出血急診、五年婚姻遭家庭介入且共同財產/公司款項進私人帳戶帳目不清。目前已離婚無監護權但極度護子（沐宸），宣示不准碰孩子、不買Lexus。高度需要親生監護、保險金信託防挪用與資產保全規劃。",
        nextAction: "暫不直接提及前夫家暴敏感字眼；適時以『單親媽媽如何為孩子築起法律防護罩（信託＋指定監護人）』切入交流"
      }
    ]
  },
  // 游長霖
  "c_001_t_001": {
    id: "tp_c001_t001",
    contactId: "c_001",
    topicId: "t_001",
    latestDate: "2026-09-29",
    status: "in_progress",
    history: [
      {
        id: "h_1",
        date: "2026-09-29",
        channel: "LINE",
        summary: "以UMBC架構傳送無痕預審說帖，長霖回饋很感謝顧問替他著想，已約定週五傍晚電話核對重點。",
        nextAction: "週五電話前先將內部防癌一次金核保指引重點整理成一頁備忘"
      },
      {
        id: "h_0",
        date: "2026-07-02",
        channel: "面對面訪談",
        summary: "生活訪談中吐露5月剛被南山拒保、軍公教團保也沒過，心情極為灰心，打算放著兩三年後再說。",
        nextAction: "先不強推，待找到非住院醫療的防癌或一次金寬鬆案例後再啟動"
      }
    ]
  },
  "c_001_t_005": {
    id: "tp_c001_t005",
    contactId: "c_001",
    topicId: "t_005",
    latestDate: "2026-07-02",
    status: "pitched",
    history: [
      {
        id: "h_2",
        date: "2026-07-02",
        channel: "面對面訪談",
        summary: "長霖主動提及若未來單身不買房，是否能住進養生村，請我幫忙研究中部養生村條件與月費。",
        nextAction: "調研潤福、長庚養生文化村與中部日照機構入住標準"
      }
    ]
  },
  "c_001_t_008": {
    id: "tp_c001_t008",
    contactId: "c_001",
    topicId: "t_008",
    latestDate: "2026-07-02",
    status: "planned",
    history: [
      {
        id: "h_3",
        date: "2026-07-02",
        channel: "生活隨聊",
        summary: "日常仍有騎機車習慣，預計提出強制險不賠財損之缺口，提醒補足第三人與超額責任險。",
        nextAction: "下次碰面順便幫忙檢視機車保單"
      }
    ]
  },
  // 企業客戶 touchpoints
  "c_002_t_026": {
    id: "tp_c002_t026",
    contactId: "c_002",
    topicId: "t_026",
    latestDate: "2026-09-15",
    status: "in_progress",
    history: [
      {
        id: "h_c002_1",
        date: "2026-09-15",
        channel: "球場敘舊",
        summary: "林董透露長子對接班意願高但次女在外商，擔心未來股權分散導致家族爭產。初步說明閉鎖性公司黃金特別股與股權信託雙軌防護機制。",
        nextAction: "準備閉鎖性公司章程限制出資轉讓之架構簡報"
      }
    ]
  },
  "c_007_t_015": {
    id: "tp_c007_t015",
    contactId: "c_007",
    topicId: "t_015",
    latestDate: "2026-09-18",
    status: "preparing",
    history: [
      {
        id: "h_c007_1",
        date: "2026-09-18",
        channel: "廠區拜訪",
        summary: "實地評估精密沖壓車間工安等級，現有團險每人僅100萬且未附加雇主意外責任險，缺口巨大。已取得現場50位同仁名冊與工種清單。",
        nextAction: "產出500萬雇主補償責任＋團傷雙軌投保試算表"
      }
    ]
  },
  "c_008_t_023": {
    id: "tp_c008_t023",
    contactId: "c_008",
    topicId: "t_023",
    latestDate: "2026-09-22",
    status: "pitched",
    history: [
      {
        id: "h_c008_1",
        date: "2026-09-22",
        channel: "線上會議",
        summary: "曾總與財務長與會，說明關鍵人保險如何列入資產負債表保單價值準備金，並於發生突發事故時向創投基金及銀行提供信賴保證。",
        nextAction: "協同會計師出具Keyman保單在財務報表之認列說明"
      }
    ]
  }
};

// =============================================================================
// 家庭車庫車籍資料庫 (Default Vehicles Mock Data)
// =============================================================================
const DEFAULT_VEHICLES = [
  {
    id: "veh_001",
    contactId: "c_001",
    plateNumber: "BTM-9821",
    vehicleType: "MOTORCYCLE",
    ownerName: "游長霖",
    ownerIdNumber: "B123456789",
    ownerBirthDate: "1988-06-15",
    primaryDriver: "游長霖",
    primaryDriverRelation: "本人",
    brand: "YAMAHA 山葉",
    modelType: "XC155R (FORCE)",
    displacement: "155",
    engineNumber: "G3C4E-889102",
    vinNumber: "",
    manufactureDate: "2020-08",
    issueDate: "2020-09-02",
    passengerCapacity: 2,
    licenseImage: "",
    notes: "龍井每日騎車通勤往返市區，需確認附加超額責任險1000萬與第三人責任財損",
    insuranceExpiryDate: "2026-10-15"
  },
  {
    id: "veh_002",
    contactId: "c_002",
    plateNumber: "BLP-8899",
    vehicleType: "CAR",
    ownerName: "林建宏",
    ownerIdNumber: "A120988776",
    ownerBirthDate: "1972-11-20",
    primaryDriver: "林建宏",
    primaryDriverRelation: "本人",
    brand: "LEXUS 凌志",
    modelType: "RX350 (2393cc)",
    displacement: "2393",
    engineNumber: "T24A-099821",
    vinNumber: "JTJBDCA88P2099182",
    manufactureDate: "2023-03",
    issueDate: "2023-04-10",
    passengerCapacity: 5,
    licenseImage: "",
    notes: "自用高階進口SUV，重點在車體乙式免自負額、超額責任險2000萬及約定駕駛人",
    insuranceExpiryDate: "2026-11-05"
  },
  {
    id: "veh_003",
    contactId: "c_002",
    plateNumber: "RDK-7766",
    vehicleType: "CAR",
    ownerName: "林建宏",
    ownerIdNumber: "A120988776",
    ownerBirthDate: "1972-11-20",
    primaryDriver: "王美鳳",
    primaryDriverRelation: "配偶",
    brand: "BENZ 賓士",
    modelType: "GLA 200 (1332cc)",
    displacement: "1332",
    engineNumber: "M282-332910",
    vinNumber: "W1N2477872J889102",
    manufactureDate: "2022-09",
    issueDate: "2022-10-18",
    passengerCapacity: 5,
    licenseImage: "",
    notes: "太太接送小孩與市區採買代步車，主要駕駛人為配偶，注意年齡係數（女性30-60歲體況）",
    insuranceExpiryDate: "2026-10-28"
  },
  {
    id: "veh_004",
    contactId: "c_007",
    plateNumber: "MDT-3323",
    vehicleType: "MOTORCYCLE",
    ownerName: "陳佳瑜",
    ownerIdNumber: "M22****148",
    ownerBirthDate: "1992-08-01",
    primaryDriver: "陳樂",
    primaryDriverRelation: "本人 (行照車主:陳佳瑜)",
    brand: "KYMCO 光陽",
    modelType: "SJ25KF (124cc)",
    displacement: "124",
    engineNumber: "SJ25KF-116626",
    vinNumber: "RFBSJ25KFGB116741",
    manufactureDate: "2016-05",
    issueDate: "2016-11-02",
    passengerCapacity: 2,
    licenseImage: "data/vehicles/licenses/2026-10-04_行照_陳佳瑜_MDT-3323_光陽SJ25KF.jpg",
    insuranceCompany: "富邦產物保險",
    policyNumber: "0426KAQ0540520",
    premiumTotal: 2138,
    coverages: [
      {
        code: "3B27",
        name: "慰問金保險",
        insuredAmount: "每人死亡 5萬 / 事故總額 5萬",
        deductible: "無",
        premium: ""
      },
      {
        code: "3B31",
        name: "第三人傷害責任險",
        insuredAmount: "每人體傷 200萬 / 事故總額 400萬",
        deductible: "無",
        premium: ""
      },
      {
        code: "3B32",
        name: "第三人財損責任險",
        insuredAmount: "每一事故財損 50萬",
        deductible: "無",
        premium: ""
      }
    ],
    notes: "富邦產險要保書(報價單號0426KAQ0540520)。保期2026/10/05~2027/10/05。險種：3B27慰問金(5萬/5萬)、3B31傷害責任(200萬/400萬)、3B32財損責任(50萬)。總保費2,138元。",
    insuranceExpiryDate: "2026-10-05"
  }
];

// =============================================================================
// 外部實用工具地圖清單資料庫 (External Specialized Tools Directory)
// =============================================================================
const DEFAULT_EXTERNAL_TOOLS = [
  {
    category: "保險商品分析",
    tools: [
      {
        id: "tool_participating_policy",
        name: "分紅保單",
        url: "../【02保險商品】｜分紅保單分類網頁/分紅保單.html"
      },
      {
        id: "tool_ci_compare",
        name: "重傷癌症比價",
        url: "../【02保險商品】｜商品對照/重大傷病｜癌症/【保額保費比較表】重大傷病.html"
      },
      {
        id: "tool_sdl_compare",
        name: "費率數線圖",
        url: "../【02保險商品】｜商品對照/SDL｜SWZ｜UCR/富邦人壽_SDL_SWZ_UCR_保費費率比較與數線圖.html"
      },
      {
        id: "tool_ltc_slider",
        name: "長照險試算",
        url: "../【02保險商品】｜保險｜長照險與殘扶險/長照險滑桿.html"
      }
    ]
  },
  {
    category: "財務與退休規劃",
    tools: [
      {
        id: "tool_fin_planning",
        name: "財務數據回推",
        url: "../【03財務規劃】｜財務檢視與規劃（數據回推）/index.html"
      },
      {
        id: "tool_fin_mgmt",
        name: "財務規劃系統",
        url: "../【03財務規劃】｜財務規劃管理系統/index.html"
      },
      {
        id: "tool_taiwan_econ",
        name: "台灣經濟動態",
        url: "../【03財務規劃】｜台灣經濟系統動態/index.html"
      },
      {
        id: "tool_fund_compare",
        name: "基金標的對照",
        url: "../【03財務規劃】｜基金對照/index.html"
      }
    ]
  },
  {
    category: "稅務與傳承規劃",
    tools: [
      {
        id: "tool_tax_flow",
        name: "稅務流程網頁",
        url: "../【04稅務傳承】｜稅務流程網頁/index.html"
      },
      {
        id: "tool_overseas_tax",
        name: "海外所得稅賦",
        url: "../【04稅務傳承】｜海外所得税賦/index.html"
      },
      {
        id: "tool_triz_guard",
        name: "意定監護專案",
        url: "../【04稅務傳承】｜TRIZ/專案Law01意定監護.html"
      }
    ]
  },
  {
    category: "需求探詢與面談",
    tools: [
      {
        id: "tool_parenting_interview",
        name: "育兒開銷訪談",
        url: "../【01需求探詢】｜育兒開銷訪談/web-platform/index.html"
      },
      {
        id: "tool_five_dimensions",
        name: "五向度需求",
        url: "../【01需求探詢】｜五向度/五向度.html"
      },
      {
        id: "tool_contextual_questions",
        name: "脈絡提問庫",
        url: "../【01需求探詢】｜脈絡化情報提問/index.html"
      }
    ]
  },
  {
    category: "案件與業務管理",
    tools: [
      {
        id: "tool_fixed_messages",
        name: "💬 固定訊息庫",
        action: "open_fixed_messages",
        url: "#fixed-messages"
      },
      {
        id: "tool_doc_prints",
        name: "📄 文件列印",
        action: "open_doc_prints",
        url: "#doc-prints"
      },
      {
        id: "tool_crm_system",
        name: "客戶案件管理",
        url: "../【05案件管理】｜客戶案件管理系統/index.html"
      },
      {
        id: "tool_group_insurance",
        name: "團險寄件管理",
        url: "../【05案件管理】｜團險寄件與案件管理/index.html"
      },
      {
        id: "tool_recruiting_system",
        name: "準增情報系統",
        url: "../【06團隊增員】｜●增員/準增輪廓情報搜集管理系統/index.html"
      }
    ]
  }
];

// =============================================================================
// 7. 準增員學生課表展示範例資料 (Student Schedule Fallback Mock Data)
// =============================================================================
const SAMPLE_SCHEDULE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620" width="900" height="620"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="20" y="20" width="860" height="580" rx="12" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="1.5"/><rect x="20" y="20" width="860" height="64" rx="12" fill="%231e293b"/><text x="450" y="58" font-family="-apple-system,BlinkMacSystemFont,PingFang TC,sans-serif" font-size="20" font-weight="bold" fill="%23ffffff" text-anchor="middle">🎓 115 學年度第一學期 學生每週作息課表 (游長霖)</text><g font-family="-apple-system,BlinkMacSystemFont,PingFang TC,sans-serif" font-size="14" font-weight="bold" fill="%23475569" text-anchor="middle"><rect x="40" y="96" width="100" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="90" y="120">節次 / 時間</text><rect x="140" y="96" width="144" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="212" y="120">星期一 (Mon)</text><rect x="284" y="96" width="144" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="356" y="120">星期二 (Tue)</text><rect x="428" y="96" width="144" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="500" y="120">星期三 (Wed)</text><rect x="572" y="96" width="144" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="644" y="120">星期四 (Thu)</text><rect x="716" y="96" width="144" height="38" fill="%23f1f5f9" stroke="%23e2e8f0"/><text x="788" y="120">星期五 (Fri)</text></g><g font-family="-apple-system,BlinkMacSystemFont,PingFang TC,sans-serif"><rect x="40" y="134" width="100" height="75" fill="%23ffffff" stroke="%23e2e8f0"/><text x="90" y="165" font-size="12" fill="%2364748b" text-anchor="middle">第 1-2 節</text><text x="90" y="185" font-size="11" fill="%2394a3b8" text-anchor="middle">09:10-11:00</text><rect x="140" y="134" width="144" height="75" fill="%23eff6ff" stroke="%23e2e8f0"/><text x="212" y="166" font-size="13" font-weight="bold" fill="%231d4ed8" text-anchor="middle">📚 財務管理 (必修)</text><text x="212" y="188" font-size="11" fill="%233b82f6" text-anchor="middle">商學院 302 教室</text><rect x="284" y="134" width="144" height="75" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="356" y="166" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">📊 統計學與實務</text><text x="356" y="188" font-size="11" fill="%2364748b" text-anchor="middle">經研所 204 教室</text><rect x="428" y="134" width="144" height="75" fill="%23fdf4ff" stroke="%23e2e8f0"/><text x="500" y="166" font-size="13" font-weight="bold" fill="%23a21caf" text-anchor="middle">🎯 行銷策略管理</text><text x="500" y="188" font-size="11" fill="%23c026d3" text-anchor="middle">管理大樓 401</text><rect x="572" y="134" width="144" height="75" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="644" y="166" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">🌐 商業英文簡報</text><text x="644" y="188" font-size="11" fill="%2364748b" text-anchor="middle">外語館 108</text><rect x="716" y="134" width="144" height="380" fill="%23f0fdf4" stroke="%2386efac" stroke-dasharray="4 4"/><text x="788" y="270" font-size="15" font-weight="bold" fill="%23166534" text-anchor="middle">✨ 全天空堂</text><text x="788" y="300" font-size="12" font-weight="bold" fill="%2315803d" text-anchor="middle">【校外實習 / 可約面談】</text><text x="788" y="325" font-size="11" fill="%2316a34a" text-anchor="middle">整天皆可彈性聯繫</text><rect x="40" y="209" width="100" height="75" fill="%23ffffff" stroke="%23e2e8f0"/><text x="90" y="240" font-size="12" fill="%2364748b" text-anchor="middle">第 3-4 節</text><text x="90" y="260" font-size="11" fill="%2394a3b8" text-anchor="middle">11:10-13:00</text><rect x="140" y="209" width="144" height="75" fill="%23eff6ff" stroke="%23e2e8f0"/><text x="212" y="241" font-size="13" font-weight="bold" fill="%231d4ed8" text-anchor="middle">📚 財務管理 (討論)</text><text x="212" y="263" font-size="11" fill="%233b82f6" text-anchor="middle">商學院 302 教室</text><rect x="284" y="209" width="144" height="75" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="356" y="241" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">📊 統計學實習課</text><text x="356" y="263" font-size="11" fill="%2364748b" text-anchor="middle">電腦教室 B</text><rect x="428" y="209" width="144" height="75" fill="%23fdf4ff" stroke="%23e2e8f0"/><text x="500" y="241" font-size="13" font-weight="bold" fill="%23a21caf" text-anchor="middle">🎯 案例研討</text><text x="500" y="263" font-size="11" fill="%23c026d3" text-anchor="middle">管理大樓 401</text><rect x="572" y="209" width="144" height="75" fill="%23f0fdf4" stroke="%2386efac"/><text x="644" y="245" font-size="12" font-weight="bold" fill="%2315803d" text-anchor="middle">✨ 午休空堂</text><text x="644" y="265" font-size="11" fill="%2316a34a" text-anchor="middle">12:00-13:30 可簡聊</text><rect x="40" y="284" width="100" height="115" fill="%23ffffff" stroke="%23e2e8f0"/><text x="90" y="335" font-size="12" fill="%2364748b" text-anchor="middle">第 5-6 節</text><text x="90" y="355" font-size="11" fill="%2394a3b8" text-anchor="middle">13:30-15:20</text><rect x="140" y="284" width="144" height="115" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="212" y="336" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">🏢 組織行為學</text><text x="212" y="358" font-size="11" fill="%2364748b" text-anchor="middle">綜大 102</text><rect x="284" y="284" width="144" height="230" fill="%23f0fdf4" stroke="%2386efac" stroke-width="2"/><text x="356" y="360" font-size="14" font-weight="bold" fill="%2315803d" text-anchor="middle">⭐ 黃金面談空堂</text><text x="356" y="388" font-size="12" font-weight="bold" fill="%23166534" text-anchor="middle">14:00 後完全沒課</text><text x="356" y="412" font-size="11" fill="%2316a34a" text-anchor="middle">【最推薦約喝咖啡洽談】</text><rect x="428" y="284" width="144" height="115" fill="%23eff6ff" stroke="%23e2e8f0"/><text x="500" y="336" font-size="13" font-weight="bold" fill="%231d4ed8" text-anchor="middle">📈 總體經濟學</text><text x="500" y="358" font-size="11" fill="%233b82f6" text-anchor="middle">經研所 101</text><rect x="572" y="284" width="144" height="115" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="644" y="336" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">💼 專案管理實務</text><text x="644" y="358" font-size="11" fill="%2364748b" text-anchor="middle">管院 205</text><rect x="40" y="399" width="100" height="115" fill="%23ffffff" stroke="%23e2e8f0"/><text x="90" y="450" font-size="12" fill="%2364748b" text-anchor="middle">第 7-8 節</text><text x="90" y="470" font-size="11" fill="%2394a3b8" text-anchor="middle">15:30-17:20</text><rect x="140" y="399" width="144" height="115" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="212" y="451" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">🏢 組織分組實作</text><text x="212" y="473" font-size="11" fill="%2364748b" text-anchor="middle">研討室 C</text><rect x="428" y="399" width="144" height="115" fill="%23f0fdf4" stroke="%2386efac"/><text x="500" y="455" font-size="12" font-weight="bold" fill="%2315803d" text-anchor="middle">✨ 傍晚空堂</text><text x="500" y="475" font-size="11" fill="%2316a34a" text-anchor="middle">15:30 後可面談</text><rect x="572" y="399" width="144" height="115" fill="%23f8fafc" stroke="%23e2e8f0"/><text x="644" y="451" font-size="13" font-weight="bold" fill="%23475569" text-anchor="middle">💼 專案小組會議</text><text x="644" y="473" font-size="11" fill="%2364748b" text-anchor="middle">管院 205</text></g><rect x="40" y="528" width="820" height="52" rx="8" fill="%23f1f5f9" stroke="%23cbd5e1"/><text x="60" y="559" font-family="-apple-system,BlinkMacSystemFont,PingFang TC,sans-serif" font-size="13" font-weight="bold" fill="%23334155">💡 顧問專用備忘：週二 14:00 後完全沒課、週五全天實習空堂，最推薦約週二下午或週五上午！</text></svg>`;

const DEFAULT_STUDENT_SCHEDULES = {
  "c_001": {
    contactId: "c_001",
    semester: "115-1 (大三上)",
    freeTimeNotes: "週二 14:00 後沒課、週五全天實習空堂",
    imageUrl: SAMPLE_SCHEDULE_SVG,
    updatedAt: "2026-10-19 10:45"
  }
};

// =============================================================================
// 8. 客群分類判定統一規範 (Client Category Classification Rules)
// =============================================================================
// 企業客群正則規範：僅匹配真正的企業法人、董座、負責人等核心關鍵字
// ⚠️ 嚴禁納入單獨的「公司」或「工廠」，避免上班族受薪個人（如「會計公司會計」、「科技公司工程師」）被誤判為企業客戶
const CORPORATE_CATEGORY_REGEX = /企業|董座|董事長|總經理|法人|企業主|公司行號負責人|機構客戶/;

/**
 * 判定客戶是否符合【企業客戶】維度
 * 核心準則：
 * 1. 若資料中明確設定 isCorporate (true/false)，以其為最高權威！
 * 2. 若為 undefined，則比對 clientType === 'CORPORATE' 或客群屬性是否命中核心企業關鍵字
 * 3. 若客戶在企業範疇議題中有歷史推進紀錄，智慧識別為具備企業身分
 */
function isClientCorporate(contact, touchpoints, topics) {
  if (!contact) return false;
  if (contact.isCorporate !== undefined) return !!contact.isCorporate;
  if (contact.clientType === 'CORPORATE') return true;
  if (contact.category && CORPORATE_CATEGORY_REGEX.test(contact.category)) return true;
  if (Array.isArray(contact.tags) && contact.tags.some(t => CORPORATE_CATEGORY_REGEX.test(t))) return true;
  if (contact.title && CORPORATE_CATEGORY_REGEX.test(contact.title)) return true;
  if (touchpoints && topics) {
    return Object.keys(touchpoints).some(k => {
      if (!k.startsWith(`${contact.id}_`)) return false;
      const topicId = k.slice(contact.id.length + 1);
      const t = topics.find(top => top.id === topicId);
      return t && t.scope === 'CORPORATE';
    });
  }
  return false;
}

/**
 * 判定客戶是否符合【個人客戶】維度
 * 核心準則：
 * 1. 若資料中明確設定 isIndividual (true/false)，以其為準
 * 2. 若為 undefined，只要不是純企業客戶（或同時具有個人屬性/三棲標籤），即視為個人客戶
 */
function isClientIndividual(contact) {
  if (!contact) return false;
  if (contact.isIndividual !== undefined) return !!contact.isIndividual;
  if (contact.clientType === 'CORPORATE') {
    // 若 clientType 設為企業，但同時具有個人緣故或非企業分類，仍視為多棲個人客戶
    if (contact.category && !CORPORATE_CATEGORY_REGEX.test(contact.category)) return true;
    if (Array.isArray(contact.tags) && contact.tags.some(t => /個人|生活|親友|一般|緣故/.test(t))) return true;
    return false;
  }
  return true;
}

/**
 * 判定客戶是否符合【準增員】維度
 * 核心準則：
 * 1. 明確 isRecruit === true
 * 2. clientType === 'RECRUIT'
 * 3. category 或 tags 命中增員、準增員、組織關鍵字
 */
function isClientRecruit(contact) {
  if (!contact) return false;
  if (contact.isRecruit !== undefined) return !!contact.isRecruit;
  if (contact.clientType === 'RECRUIT') return true;
  if (contact.category && /增員|準增員|組織/.test(contact.category)) return true;
  if (Array.isArray(contact.tags) && contact.tags.some(t => /增員|準增員|組織/.test(t))) return true;
  return false;
}

/**
 * 統一格式化日期字串為標準 YYYY-MM-DD（消除 -、/、.、時區與時間戳偏差）
 */
function normalizeStandardDate(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, '0');
    const d = String(m[3]).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const mCode = str.match(/^c_(\d{4})(\d{2})(\d{2})/);
  if (mCode) {
    return `${mCode[1]}-${mCode[2]}-${mCode[3]}`;
  }
  const ts = parseInt(str.replace(/^c_/, ''), 10);
  if (!isNaN(ts) && ts > 1600000000000) {
    const dt = new Date(ts);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/**
 * 安全日期比對函式（杜絕 ASCII 字串中 '-' < '/' 陷阱）
 * 回傳 1 若 dateA > dateB, -1 若 dateA < dateB, 0 若相等
 */
function compareDateStrings(dateA, dateB) {
  const normA = normalizeStandardDate(dateA);
  const normB = normalizeStandardDate(dateB);
  if (!normA && !normB) return 0;
  if (!normA) return -1;
  if (!normB) return 1;
  if (normA > normB) return 1;
  if (normA < normB) return -1;
  return 0;
}

/**
 * 健壯提取客戶的建立日期 (YYYY-MM-DD)
 * 支援三層容錯：
 * 1. 明確記錄之 createdAt / createdDate / date (支援 ISO 字串、斜線、點號)
 * 2. 新版標準時間碼 ID：c_YYYYMMDD_HHmmss_fff (如 c_20261023_095200_123)
 * 3. 舊版 Unix 毫秒時間戳 ID：c_1729600000000
 * 4. 最後降級回 lastUpdated / updatedAt (若存在)
 */
function extractDateFromContact(c) {
  if (!c) return '';
  // 1. 若有明確 createdAt 或 createdDate 或 date
  const rawCreated = c.createdAt || c.createdDate || c.date;
  if (rawCreated) {
    const norm = normalizeStandardDate(rawCreated);
    if (norm) return norm;
  }
  // 2. 從 ID 時間碼或時間戳解析
  if (c.id && typeof c.id === 'string') {
    const normId = normalizeStandardDate(c.id);
    if (normId) return normId;
  }
  // 3. 降級回 lastUpdated 或 updatedAt
  const rawUpdated = c.lastUpdated || c.updatedAt;
  if (rawUpdated) {
    const norm = normalizeStandardDate(rawUpdated);
    if (norm) return norm;
  }
  return '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    formatMaskedName,
    getLocalTodayDateString,
    CORPORATE_CATEGORY_REGEX,
    isClientCorporate,
    isClientIndividual,
    isClientRecruit,
    extractDateFromContact,
    normalizeStandardDate,
    compareDateStrings,
    formatRocBirthDate,
    formatManufactureDate,
    formatIssueDate
  };
}



