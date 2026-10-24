// =============================================================================
// 定聯 x 議題 x 案件｜紀錄管理系統 - Google Apps Script 後端同步引擎 (code.gs)
// 用途：部署為 Web App 後，作為本機前端網頁與 Google Sheets 之間的雙向同步中樞
// 自動同步引擎：Google clasp 官方通道已連動啟用 (版本 12 驗證)
// =============================================================================

const SHEET_NAMES = {
  CONTACTS: 'Contacts',         // 客戶名單工作表
  TOPICS: 'Topics',             // 議題庫工作表
  TOUCHPOINTS: 'Touchpoints',   // 定聯交匯歷程工作表
  AI_LEARNING: 'AI_Learning',   // AI 未匹配學習工作表
  FIXED_MESSAGES: 'FixedMessages', // 固定訊息工作表
  DOC_PRINTS: 'DocPrints',         // 文件列印工作表
  WORK_LOGS: 'WorkLogs',           // 工作日誌工作表
  REMINDERS: 'Reminders',          // 備忘提醒待辦工作表
  STUDENT_SCHEDULES: 'StudentSchedules' // 學生/準增員課表作息工作表
};

// Telegram 推播設定
const TELEGRAM_CONFIG = {
  BOT_TOKEN: '8662081689:AAFXqe-4KSR7L0ZyLESpniSJ2CjjVRjBM0Y',
  CHAT_ID: '8195097183'
};

// 輔助函式：回傳 CORS 相容之 JSON 字串回應
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------
// 1. 初始化與取得各工作表
// -----------------------------------------------------------------------------

// 取得或建立「Contacts 客戶名單」工作表
function getOrCreateContactsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.CONTACTS);
  const headers = ["客戶ID", "客戶姓名", "客群分類", "聯絡電話", "MBTI", "DISC", "個人標籤", "現況脈絡備忘", "最後定聯日期", "加強關注", "重點列管", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CONTACTS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (currentHeaders.indexOf("重點列管") === -1) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
    }
  }
  return sheet;
}

// 取得或建立「Topics 議題庫」工作表
function getOrCreateTopicsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.TOPICS);
  const headers = ["議題ID", "議題類別", "議題標題", "UMBC切入說帖小抄", "是否啟用", "排序權重", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TOPICS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「Touchpoints 定聯交匯歷程」工作表
function getOrCreateTouchpointsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.TOUCHPOINTS);
  const headers = ["交匯鍵", "客戶ID", "客戶姓名", "議題ID", "議題標題", "最近接觸日期", "推進狀態", "歷史溝通筆數", "完整歷程JSON", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TOUCHPOINTS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「AI_Learning AI學習紀錄」工作表
function getOrCreateAiLearningSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.AI_LEARNING);
  const headers = ["紀錄時間", "來源平台", "原始輸入文字", "AI推測意圖", "狀態", "備註標記"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.AI_LEARNING);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#475569').setFontColor('#f8fafc').setFontWeight('bold');
  }
  return sheet;
}

// 取得或建立「FixedMessages 固定訊息」工作表
function getOrCreateFixedMessagesSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.FIXED_MESSAGES);
  const headers = ["id", "title", "content", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.FIXED_MESSAGES);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「DocPrints 文件列印」工作表
function getOrCreateDocPrintsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.DOC_PRINTS);
  const headers = ["id", "title", "desc", "fileType", "fileName", "fileData", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.DOC_PRINTS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「WorkLogs 工作日誌」工作表
function getOrCreateWorkLogsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
  const headers = ["日誌ID", "日誌日期", "主旨標題", "內容要點備忘", "建立時間戳", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.WORK_LOGS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「Reminders 備忘提醒」工作表
function getOrCreateRemindersSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.REMINDERS);
  const headers = ["提醒ID", "客戶ID", "客戶姓名", "議題ID", "議題標題", "待辦事項", "截止時間", "是否完成", "建立時間", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.REMINDERS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (currentHeaders.length < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
    }
  }
  return sheet;
}

// 取得或建立「StudentSchedules 學生/準增員課表」工作表
function getOrCreateStudentSchedulesSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES.STUDENT_SCHEDULES);
  const headers = ["客戶ID", "客戶姓名", "適用學期", "空堂作息備忘", "課表檔案名", "檔案大小位元組", "課表圖片Base64", "建立時間戳", "最後更新時間"];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.STUDENT_SCHEDULES);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (currentHeaders.length < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');
    }
  }
  return sheet;
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const type = (e && e.parameter && e.parameter.type) ? e.parameter.type : 'all';

    // 1. 連線測試 Ping
    if (type === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'Google Sheets API 連線正常！',
        spreadsheetName: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. 讀取全量資料 (Contacts + Topics + Touchpoints)
    if (type === 'all') {
      const contactsSheet = getOrCreateContactsSheet(ss);
      const topicsSheet = getOrCreateTopicsSheet(ss);
      const touchpointsSheet = getOrCreateTouchpointsSheet(ss);

      // (A) 讀取 Contacts
      const cValues = contactsSheet.getDataRange().getValues();
      const contacts = [];
      const headerRow = cValues.length > 0 ? cValues[0] : [];
      const hasMbtiCol = headerRow.length >= 10 && headerRow[4] === "MBTI";
      const colIdxControlled = headerRow.indexOf("重點列管");
      const colIdxFocused = headerRow.indexOf("加強關注");

      for (let i = 1; i < cValues.length; i++) {
        const row = cValues[i];
        if (!row[0]) continue;
        let mbti = '';
        let disc = '';
        let tags = [];
        let notes = '';
        let lastDateVal = '';

        let isFocused = false;
        let isControlled = false;

        if (hasMbtiCol) {
          mbti = String(row[4] || '');
          disc = String(row[5] || '');
          try {
            tags = typeof row[6] === 'string' ? row[6].split(',').map(t => t.trim()).filter(Boolean) : [];
          } catch(err) {}
          notes = String(row[7] || '');
          lastDateVal = row[8];
          
          if (colIdxFocused !== -1 && row.length > colIdxFocused) {
            isFocused = String(row[colIdxFocused]).toUpperCase() === 'TRUE' || String(row[colIdxFocused]).includes('是') || String(row[colIdxFocused]).includes('⭐');
          } else if (row.length >= 11) {
            isFocused = String(row[9]).toUpperCase() === 'TRUE' || String(row[9]).includes('是') || String(row[9]).includes('⭐');
          }

          if (colIdxControlled !== -1 && row.length > colIdxControlled) {
            isControlled = String(row[colIdxControlled]).toUpperCase() === 'TRUE' || String(row[colIdxControlled]).includes('是') || String(row[colIdxControlled]).includes('🚨') || String(row[colIdxControlled]).includes('列管');
          }
        } else {
          // 舊版 8 欄向下相容
          try {
            tags = typeof row[4] === 'string' ? row[4].split(',').map(t => t.trim()).filter(Boolean) : [];
          } catch(err) {}
          notes = String(row[5] || '');
          lastDateVal = row[6];
        }

        contacts.push({
          id: String(row[0]),
          name: String(row[1] || ''),
          category: String(row[2] || ''),
          phone: String(row[3] || ''),
          mbti: mbti,
          disc: disc,
          tags: tags,
          notes: notes,
          isFocused: isFocused,
          isControlled: isControlled,
          lastContactDate: lastDateVal instanceof Date ? Utilities.formatDate(lastDateVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(lastDateVal || '')
        });
      }

      // (B) 讀取 Topics
      const tValues = topicsSheet.getDataRange().getValues();
      const topics = [];
      for (let i = 1; i < tValues.length; i++) {
        const row = tValues[i];
        if (!row[0]) continue;
        topics.push({
          id: String(row[0]),
          category: String(row[1] || '風險管控'),
          title: String(row[2] || ''),
          scriptTips: String(row[3] || ''),
          isActive: row[4] === true || String(row[4]).toLowerCase() === 'true',
          order: Number(row[5]) || (i)
        });
      }

      // (C) 讀取 Touchpoints
      const tpValues = touchpointsSheet.getDataRange().getValues();
      const touchpoints = {};
      for (let i = 1; i < tpValues.length; i++) {
        const row = tpValues[i];
        const key = String(row[0]);
        if (!key) continue;
        let history = [];
        try {
          history = JSON.parse(row[8] || '[]');
        } catch(err) {
          history = [];
        }

        touchpoints[key] = {
          id: `tp_${row[1]}_${row[3]}`,
          contactId: String(row[1] || ''),
          topicId: String(row[3] || ''),
          latestDate: row[5] instanceof Date ? Utilities.formatDate(row[5], Session.getScriptTimeZone(), "yyyy-MM-dd") : String(row[5] || ''),
          status: String(row[6] || 'pitched'),
          history: history
        };
      }

      // (D) 讀取 FixedMessages 固定訊息
      const fmSheet = getOrCreateFixedMessagesSheet(ss);
      const fmValues = fmSheet.getDataRange().getValues();
      const fixedMessages = [];
      for (let i = 1; i < fmValues.length; i++) {
        const row = fmValues[i];
        if (!row[0] && !row[1]) continue;
        fixedMessages.push({
          id: String(row[0] || `fixed_${Date.now()}_${i}`),
          title: String(row[1] || ''),
          content: String(row[2] || '')
        });
      }

      // (E) 讀取 DocPrints 文件列印
      const dpSheet = getOrCreateDocPrintsSheet(ss);
      const dpValues = dpSheet.getDataRange().getValues();
      const docPrints = [];
      for (let i = 1; i < dpValues.length; i++) {
        const row = dpValues[i];
        if (!row[0] && !row[1]) continue;
        docPrints.push({
          id: String(row[0] || `doc_${Date.now()}_${i}`),
          title: String(row[1] || ''),
          desc: String(row[2] || ''),
          fileType: String(row[3] || ''),
          fileName: String(row[4] || ''),
          fileData: String(row[5] || '')
        });
      }

      // (F) 讀取 WorkLogs 工作日誌
      const wlSheet = getOrCreateWorkLogsSheet(ss);
      const wlValues = wlSheet.getDataRange().getValues();
      const workLogs = [];
      for (let i = 1; i < wlValues.length; i++) {
        const row = wlValues[i];
        if (!row[0] && !row[1] && !row[2]) continue;
        const dVal = row[1];
        const dateStr = dVal instanceof Date ? Utilities.formatDate(dVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(dVal || '');
        workLogs.push({
          id: String(row[0] || `wlog_${Date.now()}_${i}`),
          date: dateStr,
          subject: String(row[2] || '未命名工作日誌'),
          content: String(row[3] || ''),
          createdAt: Number(row[4]) || Date.now(),
          updatedAt: row[5] ? (new Date(row[5]).getTime() || Date.now()) : Date.now()
        });
      }

      // (G) 讀取 Reminders 備忘提醒
      const remSheet = getOrCreateRemindersSheet(ss);
      const remValues = remSheet.getDataRange().getValues();
      const reminders = [];
      for (let i = 1; i < remValues.length; i++) {
        const row = remValues[i];
        if (!row[0] && !row[5]) continue;
        reminders.push({
          id: String(row[0] || `rem_${Date.now()}_${i}`),
          contactId: String(row[1] || ''),
          contactName: String(row[2] || ''),
          topicId: String(row[3] || ''),
          topicTitle: String(row[4] || ''),
          content: String(row[5] || ''),
          dueTime: String(row[6] || ''),
          isCompleted: row[7] === true || String(row[7]).toUpperCase() === 'TRUE',
          createdAt: Number(row[8]) || Date.now(),
          updatedAt: Number(row[9]) || Date.now()
        });
      }

      // (H) 讀取 StudentSchedules 課表作息
      const schedSheet = getOrCreateStudentSchedulesSheet(ss);
      const schedValues = schedSheet.getDataRange().getValues();
      const studentSchedules = {};
      for (let i = 1; i < schedValues.length; i++) {
        const row = schedValues[i];
        const cid = String(row[0] || '').trim();
        if (!cid) continue;
        studentSchedules[cid] = {
          contactId: cid,
          contactName: String(row[1] || ''),
          semester: String(row[2] || ''),
          freeTimeNotes: String(row[3] || ''),
          fileName: String(row[4] || ''),
          fileSize: Number(row[5]) || 0,
          imageUrl: String(row[6] || ''),
          createdAt: Number(row[7]) || 0,
          updatedAt: (row[8] && !isNaN(new Date(row[8]).getTime())) ? new Date(row[8]).getTime() : 0,
          updatedAtStr: String(row[8] || '')
        };
      }

      return jsonResponse({
        status: 'success',
        contacts,
        topics,
        touchpoints,
        fixed_messages: fixedMessages,
        doc_prints: docPrints,
        work_logs: workLogs,
        reminders: reminders,
        studentSchedules: studentSchedules,
        timestamp: new Date().toISOString()
      });
    }

    // 3. 單獨讀取固定訊息
    if (type === 'fixed_messages') {
      const fmSheet = getOrCreateFixedMessagesSheet(ss);
      const fmValues = fmSheet.getDataRange().getValues();
      const fixedMessages = [];
      for (let i = 1; i < fmValues.length; i++) {
        const row = fmValues[i];
        if (!row[0] && !row[1]) continue;
        fixedMessages.push({
          id: String(row[0] || `fixed_${Date.now()}_${i}`),
          title: String(row[1] || ''),
          content: String(row[2] || '')
        });
      }
      return jsonResponse({
        status: 'success',
        fixed_messages: fixedMessages,
        timestamp: new Date().toISOString()
      });
    }

    // 4. 單獨讀取文件列印
    if (type === 'doc_prints') {
      const dpSheet = getOrCreateDocPrintsSheet(ss);
      const dpValues = dpSheet.getDataRange().getValues();
      const docPrints = [];
      for (let i = 1; i < dpValues.length; i++) {
        const row = dpValues[i];
        if (!row[0] && !row[1]) continue;
        docPrints.push({
          id: String(row[0] || `doc_${Date.now()}_${i}`),
          title: String(row[1] || ''),
          desc: String(row[2] || ''),
          fileType: String(row[3] || ''),
          fileName: String(row[4] || ''),
          fileData: String(row[5] || '')
        });
      }
      return jsonResponse({
        status: 'success',
        doc_prints: docPrints,
        timestamp: new Date().toISOString()
      });
    }

    // 5. 單獨讀取工作日誌
    if (type === 'work_logs') {
      const wlSheet = getOrCreateWorkLogsSheet(ss);
      const wlValues = wlSheet.getDataRange().getValues();
      const workLogs = [];
      for (let i = 1; i < wlValues.length; i++) {
        const row = wlValues[i];
        if (!row[0] && !row[1] && !row[2]) continue;
        const dVal = row[1];
        const dateStr = dVal instanceof Date ? Utilities.formatDate(dVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(dVal || '');
        workLogs.push({
          id: String(row[0] || `wlog_${Date.now()}_${i}`),
          date: dateStr,
          subject: String(row[2] || '未命名工作日誌'),
          content: String(row[3] || ''),
          createdAt: Number(row[4]) || Date.now(),
          updatedAt: row[5] ? (new Date(row[5]).getTime() || Date.now()) : Date.now()
        });
      }
      return jsonResponse({
        status: 'success',
        work_logs: workLogs,
        timestamp: new Date().toISOString()
      });
    }

    // 4. 觸發信箱自動巡檢並推播 (支援手動觸發或測試)
    if (type === 'check_travel_emails') {
      const result = checkAndProcessTravelInsuranceEmails(ss);
      return jsonResponse(result);
    }

    return jsonResponse({ status: 'error', message: '未知的請求類型' });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// -----------------------------------------------------------------------------
// 3. POST 請求處理 (前端推送更新資料至試算表)
// -----------------------------------------------------------------------------
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action || 'sync_all';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    if (action === 'sync_all') {
      const contacts = postData.contacts || [];
      const topics = postData.topics || [];
      const touchpoints = postData.touchpoints || {};

      // 建立客戶與議題 ID 對照表以補足冗餘欄位
      const contactMap = {};
      contacts.forEach(c => { contactMap[c.id] = c.name; });
      const topicMap = {};
      topics.forEach(t => { topicMap[t.id] = t.title; });

      // 1. 全量覆寫 Contacts Sheet
      const cSheet = getOrCreateContactsSheet(ss);
      const cHeaders = ["客戶ID", "客戶姓名", "客群分類", "聯絡電話", "MBTI", "DISC", "個人標籤", "現況脈絡備忘", "最後定聯日期", "加強關注", "重點列管", "最後更新時間"];
      cSheet.clear();
      cSheet.appendRow(cHeaders);
      cSheet.setFrozenRows(1);
      cSheet.getRange(1, 1, 1, cHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (contacts.length > 0) {
        const cRows = contacts.map(c => [
          c.id,
          c.name,
          c.category || '',
          c.phone || '',
          c.mbti || '',
          c.disc || '',
          (c.tags || []).join(', '),
          c.notes || '',
          c.lastContactDate || '',
          c.isFocused ? 'TRUE' : 'FALSE',
          c.isControlled ? 'TRUE' : 'FALSE',
          nowStr
        ]);
        cSheet.getRange(2, 1, cRows.length, cHeaders.length).setValues(cRows);
      }

      // 2. 全量覆寫 Topics Sheet
      const tSheet = getOrCreateTopicsSheet(ss);
      const tHeaders = ["議題ID", "議題類別", "議題標題", "UMBC切入說帖小抄", "是否啟用", "排序權重", "最後更新時間"];
      tSheet.clear();
      tSheet.appendRow(tHeaders);
      tSheet.setFrozenRows(1);
      tSheet.getRange(1, 1, 1, tHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (topics.length > 0) {
        const tRows = topics.map(t => [
          t.id,
          t.category,
          t.title,
          t.scriptTips || '',
          t.isActive !== false,
          t.order || 0,
          nowStr
        ]);
        tSheet.getRange(2, 1, tRows.length, tHeaders.length).setValues(tRows);
      }

      // 3. 全量覆寫 Touchpoints Sheet
      const tpSheet = getOrCreateTouchpointsSheet(ss);
      const tpHeaders = ["交匯鍵", "客戶ID", "客戶姓名", "議題ID", "議題標題", "最近接觸日期", "推進狀態", "歷史溝通筆數", "完整歷程JSON", "最後更新時間"];
      tpSheet.clear();
      tpSheet.appendRow(tpHeaders);
      tpSheet.setFrozenRows(1);
      tpSheet.getRange(1, 1, 1, tpHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      const tpKeys = Object.keys(touchpoints);
      if (tpKeys.length > 0) {
        const tpRows = tpKeys.map(k => {
          const item = touchpoints[k];
          return [
            k,
            item.contactId,
            contactMap[item.contactId] || '未知客戶',
            item.topicId,
            topicMap[item.topicId] || '未知議題',
            item.latestDate || '',
            item.status || 'pitched',
            (item.history || []).length,
            JSON.stringify(item.history || []),
            nowStr
          ];
        });
        tpSheet.getRange(2, 1, tpRows.length, tpHeaders.length).setValues(tpRows);
      }

      // 4. 全量覆寫 WorkLogs Sheet
      const wlSheet = getOrCreateWorkLogsSheet(ss);
      const wlHeaders = ["日誌ID", "日誌日期", "主旨標題", "內容要點備忘", "建立時間戳", "最後更新時間"];
      wlSheet.clear();
      wlSheet.appendRow(wlHeaders);
      wlSheet.setFrozenRows(1);
      wlSheet.getRange(1, 1, 1, wlHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      const workLogsList = postData.workLogs || postData.work_logs || [];
      if (workLogsList.length > 0) {
        const wlRows = workLogsList.map(w => [
          w.id || '',
          w.date || '',
          w.subject || '',
          w.content || '',
          w.createdAt || '',
          w.updatedAt ? Utilities.formatDate(new Date(w.updatedAt), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : nowStr
        ]);
        wlSheet.getRange(2, 1, wlRows.length, wlHeaders.length).setValues(wlRows);
      }

      // 5. 全量覆寫 Reminders Sheet
      const remList = postData.reminders || [];
      const rSheet = getOrCreateRemindersSheet(ss);
      const rHeaders = ["提醒ID", "客戶ID", "客戶姓名", "議題ID", "議題標題", "待辦事項", "截止時間", "是否完成", "建立時間", "最後更新時間"];
      rSheet.clear();
      rSheet.appendRow(rHeaders);
      rSheet.setFrozenRows(1);
      rSheet.getRange(1, 1, 1, rHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (remList.length > 0) {
        const rRows = remList.map(r => [
          r.id || '',
          r.contactId || '',
          r.contactName || contactMap[r.contactId] || '',
          r.topicId || '',
          r.topicTitle || topicMap[r.topicId] || '',
          r.content || '',
          r.dueTime || '',
          r.isCompleted ? 'TRUE' : 'FALSE',
          r.createdAt || '',
          r.updatedAt || nowStr
        ]);
        rSheet.getRange(2, 1, rRows.length, rHeaders.length).setValues(rRows);
      }

      // 6. 全量覆寫 StudentSchedules Sheet (含單一儲存格字元上限防呆保護)
      try {
        const schedMap = postData.studentSchedules || {};
        const sSheet = getOrCreateStudentSchedulesSheet(ss);
        const sHeaders = ["客戶ID", "客戶姓名", "適用學期", "空堂作息備忘", "課表檔案名", "檔案大小位元組", "課表圖片Base64", "建立時間戳", "最後更新時間"];
        sSheet.clear();
        sSheet.appendRow(sHeaders);
        sSheet.setFrozenRows(1);
        sSheet.getRange(1, 1, 1, sHeaders.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

        const schedKeys = Object.keys(schedMap);
        if (schedKeys.length > 0) {
          const sRows = schedKeys.map(k => {
            const item = schedMap[k];
            let imgStr = String(item.imageUrl || '');
            // Google Sheets 單一儲存格硬性上限 50,000 字元防呆截斷保護，杜絕整批同步拋出例外崩潰
            if (imgStr.length > 48000) {
              imgStr = imgStr.substring(0, 48000);
            }
            return [
              item.contactId || k,
              item.contactName || contactMap[item.contactId] || contactMap[k] || '',
              item.semester || '',
              item.freeTimeNotes || '',
              item.fileName || '',
              item.fileSize || 0,
              imgStr,
              item.createdAt || '',
              item.updatedAtStr || nowStr
            ];
          });
          sSheet.getRange(2, 1, sRows.length, sHeaders.length).setValues(sRows);
        }
      } catch (schedErr) {
        console.error('寫入 StudentSchedules 工作表發生非致命錯誤:', schedErr);
      }

      return jsonResponse({
        status: 'success',
        message: 'Google Sheets 資料已全量更新同步完成！',
        stats: {
          contactsCount: contacts.length,
          topicsCount: topics.length,
          touchpointsCount: tpKeys.length,
          workLogsCount: workLogsList.length,
          remindersCount: remList.length,
          studentSchedulesCount: schedKeys.length
        },
        timestamp: nowStr
      });
    }

    if (action === 'log_unmatched') {
      const learningSheet = getOrCreateAiLearningSheet(ss);
      const rawText = postData.rawText || '';
      const predictedIntent = postData.predictedIntent || '';
      const platform = postData.platform || 'Telegram';
      const status = postData.status || '待學習';
      learningSheet.appendRow([nowStr, platform, rawText, predictedIntent, status, '']);
      return jsonResponse({
        status: 'success',
        message: '已記錄至 AI_Learning 學習分頁！',
        timestamp: nowStr
      });
    }

    // 4. 固定訊息覆蓋式同步 (支援 action 為 save_fixed_messages 或 saveFixedMessages)
    if (action === 'save_fixed_messages' || action === 'saveFixedMessages') {
      const fmSheet = getOrCreateFixedMessagesSheet(ss);
      const fixedMessagesList = postData.fixed_messages || postData.fixedMessages || [];
      const headers = ["id", "title", "content", "最後更新時間"];

      fmSheet.clear();
      fmSheet.appendRow(headers);
      fmSheet.setFrozenRows(1);
      fmSheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (fixedMessagesList.length > 0) {
        const rows = fixedMessagesList.map(m => [
          m.id || '',
          m.title || '',
          m.content || '',
          nowStr
        ]);
        fmSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      return jsonResponse({
        status: 'success',
        message: '固定訊息資料已成功同步至 Google Sheets！(' + fixedMessagesList.length + ' 筆)',
        count: fixedMessagesList.length,
        timestamp: nowStr
      });
    }

    // 5. 文件列印覆蓋式同步 (支援 action 為 save_doc_prints 或 saveDocPrints)
    if (action === 'save_doc_prints' || action === 'saveDocPrints') {
      const dpSheet = getOrCreateDocPrintsSheet(ss);
      const docPrintsList = postData.doc_prints || postData.docPrints || [];
      const headers = ["id", "title", "desc", "fileType", "fileName", "fileData", "最後更新時間"];

      dpSheet.clear();
      dpSheet.appendRow(headers);
      dpSheet.setFrozenRows(1);
      dpSheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (docPrintsList.length > 0) {
        const rows = docPrintsList.map(m => [
          m.id || '',
          m.title || '',
          m.desc || '',
          m.fileType || '',
          m.fileName || '',
          m.fileData || '',
          nowStr
        ]);
        dpSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      return jsonResponse({
        status: 'success',
        message: '文件列印資料已成功同步至 Google Sheets！(' + docPrintsList.length + ' 筆)',
        count: docPrintsList.length,
        timestamp: nowStr
      });
    }

    // 6. 工作日誌覆蓋式同步 (支援 action 為 save_work_logs 或 saveWorkLogs)
    if (action === 'save_work_logs' || action === 'saveWorkLogs') {
      const wlSheet = getOrCreateWorkLogsSheet(ss);
      const workLogsList = postData.work_logs || postData.workLogs || [];
      const headers = ["日誌ID", "日誌日期", "主旨標題", "內容要點備忘", "建立時間戳", "最後更新時間"];

      wlSheet.clear();
      wlSheet.appendRow(headers);
      wlSheet.setFrozenRows(1);
      wlSheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold');

      if (workLogsList.length > 0) {
        const rows = workLogsList.map(w => [
          w.id || '',
          w.date || '',
          w.subject || '',
          w.content || '',
          w.createdAt || '',
          w.updatedAt ? Utilities.formatDate(new Date(w.updatedAt), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : nowStr
        ]);
        wlSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      return jsonResponse({
        status: 'success',
        message: '工作日誌資料已成功同步至 Google Sheets！(' + workLogsList.length + ' 筆)',
        count: workLogsList.length,
        timestamp: nowStr
      });
    }

    // 6. 手動觸發信箱巡檢
    if (action === 'check_travel_emails') {
      const result = checkAndProcessTravelInsuranceEmails(ss);
      return jsonResponse(result);
    }

    return jsonResponse({ status: 'error', message: '未支援的 Action 操作' });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// =============================================================================
// 4. Telegram 推播服務 (Telegram Bot Messenger)
// =============================================================================
function escapeTelegramHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendTelegramMessage(textHtml) {
  if (!TELEGRAM_CONFIG.BOT_TOKEN || !TELEGRAM_CONFIG.CHAT_ID) {
    Logger.log('Telegram 設定未填寫 BOT_TOKEN 或 CHAT_ID');
    return;
  }
  const url = 'https://api.telegram.org/bot' + TELEGRAM_CONFIG.BOT_TOKEN + '/sendMessage';
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: TELEGRAM_CONFIG.CHAT_ID,
        text: textHtml,
        parse_mode: 'HTML'
      }),
      muteHttpExceptions: true
    });
    const respCode = response.getResponseCode();
    const respBody = response.getContentText();
    Logger.log('Telegram 發送結果 [' + respCode + ']: ' + respBody);

    // 若 HTML 解析失敗，改用純文字 fallback 重新發送，確保 100% 抵達
    if (respCode !== 200) {
      Logger.log('HTML 解析或發送失敗，嘗試純文字模式重新發送...');
      const plainText = textHtml.replace(/<[^>]+>/g, '');
      UrlFetchApp.fetch(url, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: TELEGRAM_CONFIG.CHAT_ID,
          text: plainText
        }),
        muteHttpExceptions: true
      });
    }
  } catch (err) {
    Logger.log('發送 Telegram 發生例外: ' + err.toString());
  }
}

// 測試 Telegram 發送（可在 Apps Script 介面直接手動執行以完成連線授權）
function testSendTelegram() {
  const testText = "🔔 <b>【定聯系統測試】</b>\nTelegram 連線測試成功！已具備發送與外部存取權限。";
  sendTelegramMessage(testText);
}

// =============================================================================
// 5. Gmail 旅平險線上投保信件自動巡檢與範本抽換引擎
//    支援定時 Trigger (例如每 5 分鐘執行一次)
// =============================================================================
function checkAndProcessTravelInsuranceEmails(ss) {
  // 防呆相容：被 Trigger 定時觸發時，傳入的參數是 Event 物件 e，而非 Spreadsheet 物件
  if (!ss || typeof ss.getSheetByName !== "function") {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {}
  }
  // 容錯備援：若仍無法取得（如獨立排程情境），直接以 Google 試算表 ID 開啟
  if (!ss || typeof ss.getSheetByName !== "function") {
    try {
      ss = SpreadsheetApp.openById("1sUgOA7p8vDWlR3zCSHTJgMsgNwmnc_g9VPrJd-aiwpw");
    } catch (err) {
      console.error("[checkAndProcessTravelInsuranceEmails] 無法開啟試算表: " + err);
      return { status: "error", message: "無法取得試算表: " + err.toString() };
    }
  }
  const timeZone = Session.getScriptTimeZone() || 'Asia/Taipei';
  const now = new Date();
  const nowStr = Utilities.formatDate(now, timeZone, "yyyy-MM-dd HH:mm:ss");
  const todayStr = Utilities.formatDate(now, timeZone, "yyyy-MM-dd");

  // 1. 取得旅平卡５固定訊息範本
  const fmSheet = getOrCreateFixedMessagesSheet(ss);
  const fmValues = fmSheet.getDataRange().getValues();
  let templateContent = "";
  for (let i = 1; i < fmValues.length; i++) {
    const title = String(fmValues[i][1] || "");
    if (title.indexOf("旅平卡５") !== -1 || title.indexOf("投保資訊確認") !== -1) {
      templateContent = String(fmValues[i][2] || "");
      break;
    }
  }

  // 預設範本 fallback
  if (!templateContent) {
    templateContent = "【稱謂】，【時段問候】，我有收到公司您投保的資訊，作為服務人員來跟您確認一下資訊（曾有客戶按錯日期，理賠上就發生了遺憾）：\n\n■保險期間：\n【踏出家門】{出發時間}（{出發星期}）~\n【返抵家門】{回國時間}（{回國星期}） 共{天數}天\n\n■出國地區(含轉機地點)：{旅遊地區}\n\n如果沒問題的話，可以在本留言按個小貼圖也讓我知道您確認了。\n如果發現有需要異動，也沒關係，可以在旅遊小管家原保單中更改保期，又或者是打電話到0809-019-888轉2，由客服協助處理。";
  }

  // 2. 搜尋未讀投保信件 (富邦產險 / 富邦人壽)
  const query = 'is:unread ("富邦產險旅平卡投保完成通知" OR "富邦人壽旅行平安險保單投保完成通知" OR "旅平險線上投保已完成投保")';
  const threads = GmailApp.search(query, 0, 10);
  const processedList = [];

  const contactsSheet = getOrCreateContactsSheet(ss);
  const touchpointsSheet = getOrCreateTouchpointsSheet(ss);
  const topicsSheet = getOrCreateTopicsSheet(ss);

  // 確保「出國旅遊」議題存在
  const topicValues = topicsSheet.getDataRange().getValues();
  let travelTopicId = 't_travel';
  let travelTopicTitle = '出國旅遊';
  for (let i = 1; i < topicValues.length; i++) {
    if (String(topicValues[i][2] || '').indexOf('出國旅遊') !== -1 || String(topicValues[i][0] || '') === 't_travel') {
      travelTopicId = String(topicValues[i][0] || 't_travel');
      travelTopicTitle = String(topicValues[i][2] || '出國旅遊');
      break;
    }
  }

  const weekDayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  for (let t = 0; t < threads.length; t++) {
    const thread = threads[t];
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1];
    const body = lastMsg.getPlainBody();

    // 正則解析
    // (A) 客戶姓名
    let clientName = "";
    const nameMatch = body.match(/客戶\s*([^\s]+?)\s*於/) || body.match(/客戶[姓名]*[：:]\s*([^\r\n]+)/) || body.match(/被保險人[：:]\s*([^\r\n]+)/);
    if (nameMatch) {
      clientName = nameMatch[1].trim();
    }
    if (!clientName) clientName = "線上投保客戶";

    // (B) 保險期間
    // 例如：2026年10月14日 00時00分~2026年10月20日 00時00分 共6天
    let departureRaw = "";
    let returnRaw = "";
    let durationDays = "";
    const periodMatch = body.match(/保險期間[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}時\d{1,2}分)\s*~\s*(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}時\d{1,2}分)(?:\s*共\s*(\d+)\s*天)?/);
    if (periodMatch) {
      departureRaw = periodMatch[1].trim();
      returnRaw = periodMatch[2].trim();
      durationDays = periodMatch[3] ? periodMatch[3].trim() : "";
    }

    // (C) 旅遊地區
    let destination = "";
    const destMatch = body.match(/旅遊地區[：:]\s*([^\r\n]+)/);
    if (destMatch) {
      destination = destMatch[1].trim();
    }
    if (!destination) destination = "國外";
    const cleanDest = destination.split(/[;；]/)[0].trim() || destination;

    // 解析出發日與回國日之 Date
    function parseChnDate(str) {
      const m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})時(\d{1,2})分/);
      if (m) {
        return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10));
      }
      return null;
    }

    const depDateObj = departureRaw ? parseChnDate(departureRaw) : null;
    const retDateObj = returnRaw ? parseChnDate(returnRaw) : null;

    const depWeek = depDateObj ? weekDayNames[depDateObj.getDay()] : '週三';
    const retWeek = retDateObj ? weekDayNames[retDateObj.getDay()] : '週二';

    if (!durationDays && depDateObj && retDateObj) {
      const diffMs = retDateObj.getTime() - depDateObj.getTime();
      durationDays = String(Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24))));
    }
    if (!durationDays) durationDays = "數";

    // 格式化 ISO 時間供前端日期選擇器
    function toLocalIso(d) {
      if (!d) return "";
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, '0');
      const D = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${Y}-${M}-${D}T${h}:${m}`;
    }
    const depIso = toLocalIso(depDateObj);
    const retIso = toLocalIso(retDateObj);

    // 時段問候判斷
    const currentHour = now.getHours();
    let timeGreeting = "上午您好";
    if (currentHour >= 12 && currentHour < 18) {
      timeGreeting = "下午您好";
    } else if (currentHour >= 18 || currentHour < 5) {
      timeGreeting = "晚間您好";
    }

    // 稱謂判斷 (尋找現有名單比對全名)
    let matchedContact = null;
    let contactId = "";
    const contactValues = contactsSheet.getDataRange().getValues();
    for (let c = 1; c < contactValues.length; c++) {
      const cRow = contactValues[c];
      const existingName = String(cRow[1] || "").trim();
      const existingId = String(cRow[0] || "").trim();
      if (!existingName) continue;
      // 若姓名完全吻合或遮蔽比對 (如 "林**瑛" 比對 "林婉瑛")
      if (existingName === clientName) {
        matchedContact = existingName;
        contactId = existingId;
        break;
      }
      if (clientName.includes('*')) {
        const firstChar = clientName.charAt(0);
        const lastChar = clientName.charAt(clientName.length - 1);
        if (existingName.startsWith(firstChar) && existingName.endsWith(lastChar)) {
          matchedContact = existingName;
          contactId = existingId;
          break;
        }
      }
    }

    const displayName = matchedContact || clientName;
    const familyName = displayName.charAt(0);
    const salutation = familyName ? `${familyName}小姐/先生` : displayName;

    // (D) 替換「旅平卡５」範本
    let confirmMsg = templateContent;
    confirmMsg = confirmMsg.replace(/陳小姐/g, salutation)
                           .replace(/【稱謂】/g, salutation)
                           .replace(/上午您好/g, timeGreeting)
                           .replace(/【時段問候】/g, timeGreeting);

    // 替換時間與星期
    if (departureRaw && returnRaw) {
      confirmMsg = confirmMsg.replace(/【踏出家門】[^\n~]+~/g, `【踏出家門】${departureRaw}（${depWeek}）~`);
      confirmMsg = confirmMsg.replace(/【返抵家門】[^\n]+共\d+天/g, `【返抵家門】${returnRaw}（${retWeek}） 共${durationDays}天`);
    }

    // 替換出國地區
    confirmMsg = confirmMsg.replace(/■出國地區\(含轉機地點\)：[^\n]+/g, `■出國地區(含轉機地點)：${cleanDest}`);

    // (E) 寫入 Contacts 表 (若不存在則新增在第 1 列)
    if (!contactId) {
      contactId = `c_travel_${Date.now()}_${t}`;
      const newContactRow = [
        contactId,
        displayName,
        'INDIVIDUAL',
        '', // 電話
        '', // MBTI
        '', // DISC
        `["旅平險線上投保", "${cleanDest}"]`,
        `系統自動自【富邦投保完成信】建檔。目的地：${cleanDest} (${departureRaw} ~ ${returnRaw})`,
        todayStr,
        true, // 加強關注
        false, // 重點列管
        nowStr
      ];
      contactsSheet.insertRowAfter(1);
      contactsSheet.getRange(2, 1, 1, newContactRow.length).setValues([newContactRow]);
    }

    // (F) 寫入 Touchpoints 表 (更新交匯歷程)
    const tpKey = `${contactId}_${travelTopicId}`;
    const tpValues = touchpointsSheet.getDataRange().getValues();
    let tpRowIndex = -1;
    let existingHistory = [];
    for (let r = 1; r < tpValues.length; r++) {
      if (String(tpValues[r][0] || "") === tpKey) {
        tpRowIndex = r + 1;
        try {
          existingHistory = JSON.parse(tpValues[r][8] || "[]");
          if (!Array.isArray(existingHistory)) existingHistory = [];
        } catch (e) {
          existingHistory = [];
        }
        break;
      }
    }

    const newHistoryItem = {
      date: todayStr,
      channel: '線上投保通知',
      status: 'preparing',
      note: confirmMsg,
      travel: {
        destination: cleanDest,
        departureTime: depIso,
        returnTime: retIso,
        customizedConfirmMessage: confirmMsg,
        cardState: 'done',
        insuranceState: 'done',
        rightsState: 'none',
        returnState: 'none',
        hasCard: true,
        insuranceReminded: true,
        rightsNotified: false,
        returnCared: false
      }
    };

    existingHistory.unshift(newHistoryItem);

    if (tpRowIndex !== -1) {
      touchpointsSheet.getRange(tpRowIndex, 6).setValue(todayStr); // 最近接觸日期
      touchpointsSheet.getRange(tpRowIndex, 7).setValue('preparing'); // 狀態：籌劃
      touchpointsSheet.getRange(tpRowIndex, 8).setValue(existingHistory.length); // 筆數
      touchpointsSheet.getRange(tpRowIndex, 9).setValue(JSON.stringify(existingHistory)); // JSON
      touchpointsSheet.getRange(tpRowIndex, 10).setValue(nowStr);
    } else {
      touchpointsSheet.appendRow([
        tpKey,
        contactId,
        displayName,
        travelTopicId,
        travelTopicTitle,
        todayStr,
        'preparing',
        1,
        JSON.stringify(existingHistory),
        nowStr
      ]);
    }

    // (G) 發送 Telegram 推播 (純話術內容，點擊或複製即可直接發送給客戶，零多餘文字)
    const escapedMsg = escapeTelegramHtml(confirmMsg);
    const tgText = `<code>${escapedMsg}</code>`;

    sendTelegramMessage(tgText);

    // 標記該郵件為已讀，防止重複處理
    thread.markRead();

    processedList.push({
      clientName: displayName,
      destination: cleanDest,
      departureRaw,
      returnRaw,
      confirmMsg
    });
  }

  return {
    status: 'success',
    processedCount: processedList.length,
    list: processedList
  };
}
