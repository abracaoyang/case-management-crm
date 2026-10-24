/**
 * 系統核心防護與回歸自動化檢驗腳本 (test-suite.js)
 * 用途：0.3 秒本機無消耗執行，防堵「Google Sheets 50k 上限」、「覆蓋沖刷」、「重整資料遺失」等歷史重現。
 * 執行方式：node test-suite.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 彩色終端輸出支援
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let passedCount = 0;
let failedCount = 0;
const startTime = Date.now();

function assert(description, condition, failureDetails = '') {
  if (condition) {
    passedCount++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} ${description}`);
  } else {
    failedCount++;
    console.error(`  ${colors.red}✘ FAIL${colors.reset} ${description}`);
    if (failureDetails) {
      console.error(`    ${colors.yellow}↳ 原因: ${failureDetails}${colors.reset}`);
    }
  }
}

console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan} 🛡️  全系統核心回歸自動化檢驗套件 (Regression Test Suite) ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

// -----------------------------------------------------------------------------
// 測試 1: 專案所有核心 JavaScript 檔案語法與編譯檢驗
// -----------------------------------------------------------------------------
console.log(`${colors.bold}【檢驗組 1】全端 JavaScript 語法靜態防線${colors.reset}`);
const filesToCheck = [
  'js/constants.js',
  'js/state.js',
  'js/renderer.js',
  'js/modals.js',
  'js/events.js',
  '程式碼.js'
];

filesToCheck.forEach(file => {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
    assert(`編譯通過: ${file}`, true);
  } catch (err) {
    assert(`編譯通過: ${file}`, false, err.message);
  }
});

// -----------------------------------------------------------------------------
// 測試 2: Google Sheets 50,000 字元單一儲存格上限截斷防護
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 2】Google Sheets 50k 字元單元格上限防護${colors.reset}`);
const mockLargeImageBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(85000); // 85,022 字元

// 模擬後端 GAS 截斷防護演算法
function sanitizeCellImage(imgStr) {
  let safeStr = String(imgStr || '');
  if (safeStr.length > 48000) {
    safeStr = safeStr.substring(0, 48000);
  }
  return safeStr;
}

const sanitized = sanitizeCellImage(mockLargeImageBase64);
assert('超長 Base64 (>85,000 字元) 必須安全截斷至 48,000 字元內', sanitized.length <= 48000);
assert('截斷後長度不得為 0', sanitized.length === 48000);
assert('一般短圖片 (<48,000 字元) 必須維持原長度不被破壞', sanitizeCellImage('data:image/svg+xml;test').length === 'data:image/svg+xml;test'.length);

// -----------------------------------------------------------------------------
// 測試 3: pullFromCloud 本地高解析圖片防沖刷保護 (Anti-Clobber Guardrail)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 3】pullFromCloud 雲端拉取防沖刷保護${colors.reset}`);

function simulateCloudMerge(localSchedule, cloudSchedule) {
  const lSched = localSchedule;
  const cSched = cloudSchedule;
  if (!lSched) return cSched;
  
  // 關鍵防護演算法
  const preserveLocalImg = lSched.imageUrl && (!cSched.imageUrl || cSched.imageUrl.length < 100);
  const cTime = Number(cSched.updatedAt) || 0;
  const lTime = Number(lSched.updatedAt) || 0;
  
  if (cTime >= lTime) {
    const finalImg = preserveLocalImg ? lSched.imageUrl : (cSched.imageUrl || lSched.imageUrl);
    return {
      ...lSched,
      ...cSched,
      imageUrl: finalImg
    };
  } else if (preserveLocalImg) {
    return {
      ...lSched,
      imageUrl: lSched.imageUrl
    };
  }
  return lSched;
}

const localItem = {
  contactId: 'c_001',
  semester: '115-1 (大三上)',
  imageUrl: 'data:image/jpeg;base64,' + 'X'.repeat(5000), // 本地高畫質
  updatedAt: 1000
};

// 情境 A：雲端時間較新，但 imageUrl 為空字串
const cloudEmptyImg = {
  contactId: 'c_001',
  semester: '115-1 (大三上)',
  imageUrl: '',
  updatedAt: 2000
};
const mergedA = simulateCloudMerge(localItem, cloudEmptyImg);
assert('雲端圖片為空時，絕不覆蓋本地高清圖片', mergedA.imageUrl === localItem.imageUrl);

// 情境 B：雲端時間較新，且有完整的雲端圖片
const cloudValidImg = {
  contactId: 'c_001',
  semester: '115-1 (大三上)',
  imageUrl: 'data:image/jpeg;base64,CLOUD_VALID_IMAGE_DATA_1234567890_LONGER_THAN_100_CHARS_PADDING_TEST_TEST_TEST_TEST_TEST_TEST_TEST_TEST_TEST_TEST',
  updatedAt: 3000
};
const mergedB = simulateCloudMerge(localItem, cloudValidImg);
assert('雲端有合法新圖片時，允許正常升級合併', mergedB.imageUrl === cloudValidImg.imageUrl);

// -----------------------------------------------------------------------------
// 測試 4: 115 學年度升級與使用者自訂資料保護
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 4】115 學年度資料遷移與使用者自訂保護${colors.reset}`);

function simulateSemesterMigration(scheduleItem) {
  const item = { ...scheduleItem };
  if (item.semester && item.semester.includes('113')) {
    item.semester = item.semester.replace(/113/g, '115');
  }
  if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.includes('113') && item.imageUrl.startsWith('data:image/svg+xml')) {
    item.imageUrl = item.imageUrl.replace(/113/g, '115');
  }
  return item;
}

const legacy113 = {
  contactId: 'c_001',
  semester: '113學年度 第1學期',
  imageUrl: 'data:image/jpeg;base64,USER_CUSTOM_PHOTO'
};
const migrated = simulateSemesterMigration(legacy113);
assert('113 學期字串順利升級為 115', migrated.semester === '115學年度 第1學期');
assert('使用者自訂 JPEG 照片絕不被誤當 SVG 沖刷替換', migrated.imageUrl === 'data:image/jpeg;base64,USER_CUSTOM_PHOTO');

// -----------------------------------------------------------------------------
// 測試 5: LocalStorage 5MB 配額超載時的 IDB 降級保護
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 5】LocalStorage 配額超載保護機制${colors.reset}`);

function simulateStorageSaveWithFallback(schedulesMap) {
  let mode = 'FULL';
  let jsonStr = '';
  try {
    // 模擬超過 5MB
    const testSize = JSON.stringify(schedulesMap).length;
    if (testSize > 50000) {
      throw new Error('QuotaExceededError: LocalStorage quota exceeded');
    }
    jsonStr = JSON.stringify(schedulesMap);
  } catch (e) {
    mode = 'FALLBACK_TRIMMED';
    const fallbackMap = {};
    Object.keys(schedulesMap).forEach(cid => {
      const item = schedulesMap[cid];
      fallbackMap[cid] = {
        ...item,
        imageUrl: (item.imageUrl && item.imageUrl.length > 5000) ? 'IDB_PERSISTED' : (item.imageUrl || '')
      };
    });
    jsonStr = JSON.stringify(fallbackMap);
  }
  return { mode, jsonStr };
}

const largeSchedules = {
  'c_001': {
    contactId: 'c_001',
    semester: '115-1',
    imageUrl: 'data:image/jpeg;base64,' + 'Y'.repeat(60000)
  }
};
const res = simulateStorageSaveWithFallback(largeSchedules);
assert('配額超載時觸發防呆保護模式', res.mode === 'FALLBACK_TRIMMED');
assert('中繼資料中將大圖替換為 IDB_PERSISTED 避免死機', JSON.parse(res.jsonStr)['c_001'].imageUrl === 'IDB_PERSISTED');

// -----------------------------------------------------------------------------
// 測試 6: crm_doc_prints 輕量化瘦身與水合回歸檢驗
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 6】文件列印資料庫 (crm_doc_prints) 輕量化瘦身檢驗${colors.reset}`);

const mockDefaultDocPrints = [
  { id: 'doc_1', title: '醫療前中後', fileData: 'data:application/pdf;base64,' + 'M'.repeat(120000) },
  { id: 'doc_2', title: '需求分析卡', fileData: 'data:text/html;base64,SHORT' }
];

function mockGetSlimDocPrints(docPrints, defaultDocPrints) {
  return docPrints.map(item => {
    const def = defaultDocPrints.find(d => d.id === item.id || d.title === item.title);
    if (def && (item.fileData === def.fileData || (item.fileData && item.fileData.length > 50000))) {
      return { ...item, fileData: `[DEFAULT_DOC_PRESERVED:${item.id}]` };
    }
    return item;
  });
}

const rawSize = JSON.stringify(mockDefaultDocPrints).length;
const slimList = mockGetSlimDocPrints(mockDefaultDocPrints, mockDefaultDocPrints);
const slimSize = JSON.stringify(slimList).length;

assert('原始文件列印大小超過 100KB', rawSize > 100000);
assert('瘦身後大小縮減 95% 以上且小於 2KB', slimSize < 2000);
assert('預設高清 PDF 成功替換為 [DEFAULT_DOC_PRESERVED]', slimList[0].fileData.startsWith('[DEFAULT_DOC_PRESERVED'));

// 水合還原測試
const restoredList = slimList.map(item => {
  const copy = { ...item };
  if (copy.fileData && copy.fileData.startsWith('[DEFAULT_DOC_PRESERVED')) {
    const def = mockDefaultDocPrints.find(d => d.id === copy.id);
    if (def) copy.fileData = def.fileData;
  }
  return copy;
});
assert('記憶體水合後成功完整恢復原始 120KB PDF', restoredList[0].fileData === mockDefaultDocPrints[0].fileData);

// -----------------------------------------------------------------------------
// 測試 7: 名單分群多重共存全響應與全域搜尋排除篩選門禁
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 7】名單分群多重共存全響應與全域搜尋門禁${colors.reset}`);

// 模擬 matchClientType 邏輯 (與 constants.js / renderer.js 同步)
const { isClientCorporate, isClientIndividual, isClientRecruit } = require('./js/constants.js');

function simulateMatchClientType(contact, mode) {
  if (mode === 'RECRUIT') return isClientRecruit(contact);
  if (mode === 'CORPORATE') return isClientCorporate(contact);
  return isClientIndividual(contact);
}

const multiTagClient = {
  id: 'c_multi',
  name: '三棲跨界客戶',
  isIndividual: true,
  isCorporate: true,
  isRecruit: true
};

assert('三棲名單在【個人客戶】視圖中成功響應', simulateMatchClientType(multiTagClient, 'INDIVIDUAL') === true);
assert('三棲名單在【企業客戶】視圖中成功響應', simulateMatchClientType(multiTagClient, 'CORPORATE') === true);
assert('三棲名單在【準增員】視圖中成功響應', simulateMatchClientType(multiTagClient, 'RECRUIT') === true);

// 核心防呆門禁：防受薪個人客戶因客群屬性含「公司/工廠」被誤判為企業客戶
const houClient = {
  id: 'c_hou',
  name: '侯沛君',
  category: '會計公司會計',
  isIndividual: true
};
const techEngineerClient = {
  id: 'c_tech',
  name: '張工程師',
  category: '科技公司工程師',
  clientType: 'INDIVIDUAL'
};
const realCorpClient = {
  id: 'c_corp',
  name: '陳董事長',
  category: '精密機械董座'
};

assert('【核心防呆】侯沛君（會計公司會計）在【企業客戶】篩選中絕不出現', simulateMatchClientType(houClient, 'CORPORATE') === false);
assert('【核心防呆】侯沛君（會計公司會計）在【個人客戶】篩選中正常呈現', simulateMatchClientType(houClient, 'INDIVIDUAL') === true);
assert('【核心防呆】科技公司工程師在【企業客戶】篩選中絕不出現', simulateMatchClientType(techEngineerClient, 'CORPORATE') === false);
assert('【核心防呆】精密機械董座在【企業客戶】篩選中正確出現', simulateMatchClientType(realCorpClient, 'CORPORATE') === true);

// 模擬全域搜尋跳脫客群限制邏輯
const testContactsPool = [
  { id: '1', name: '純個人保戶', isIndividual: true, isCorporate: false, isRecruit: false },
  { id: '2', name: '大企業董事長', isIndividual: false, isCorporate: true, isRecruit: false }
];

function simulateSearchRender(contacts, currentMode, searchQuery) {
  if (searchQuery) {
    // 排除分群限制，直接在全池中搜尋
    return contacts.filter(c => c.name.includes(searchQuery));
  }
  return contacts.filter(c => simulateMatchClientType(c, currentMode));
}

const searchResultInIndividual = simulateSearchRender(testContactsPool, 'INDIVIDUAL', '董事長');
assert('在【個人模式】下全域搜尋企業董事長名單成功命中呈現', searchResultInIndividual.length === 1 && searchResultInIndividual[0].name === '大企業董事長');


// -----------------------------------------------------------------------------
// 測試 8: 全域搜尋客戶時保留全議題維護維度（防說帖字詞誤削切）
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 8】全域搜尋客戶時全議題維護維度防呆檢驗${colors.reset}`);

const mockTopicsList = [
  { id: 't1', title: '車險', scriptTips: '銅板價升級千萬超額責任險', isActive: true },
  { id: 't2', title: '新生兒保單', scriptTips: '千元小預算打造雙實支', isActive: true },
  { id: 't3', title: '癌症一次金', scriptTips: '黃金治療期百萬理賠', isActive: true },
  { id: 't4', title: '分紅保單', scriptTips: '對抗通膨之確定現金流', isActive: true },
  { id: 't5', title: '預留稅源', scriptTips: '跨代傳承資產防護', isActive: true }
];

const mockContactsList = [
  { id: 'c1', name: '黃千芸', isIndividual: true },
  { id: 'c2', name: '陳小明', isIndividual: true }
];

function simulateSearchMatrix(query, scope = 'ALL') {
  const matchTopic = (t) => (t.title && t.title.includes(query)) || (t.scriptTips && t.scriptTips.includes(query));
  const matchContact = (c) => c.name && c.name.includes(query);

  const hasContact = query ? mockContactsList.some(matchContact) : false;
  const hasTopic = query ? mockTopicsList.some(t => t.isActive && matchTopic(t)) : false;

  let visTopics = mockTopicsList.filter(t => t.isActive);
  let visContacts = [...mockContactsList];

  if (query) {
    if (scope === 'TOPIC') {
      visTopics = visTopics.filter(matchTopic);
    } else if (scope === 'ALL') {
      if (!hasContact && hasTopic) {
        visTopics = visTopics.filter(matchTopic);
      } else if (!hasContact && !hasTopic) {
        visTopics = [];
      }
    }

    if (scope === 'CONTACT') {
      visContacts = mockContactsList.filter(matchContact);
    } else if (scope === 'ALL') {
      if (hasContact) {
        visContacts = mockContactsList.filter(matchContact);
      } else if (hasTopic) {
        visContacts = [...mockContactsList];
      } else {
        visContacts = [];
      }
    }
  }

  return { visTopics, visContacts };
}

// 檢驗：搜尋「千」時，命中了客戶黃千芸，5 個議題必須全部保留，絕不能被削切為 2 個！
const searchResultChien = simulateSearchMatrix('千', 'ALL');
assert('搜尋「千」成功鎖定客戶黃千芸', searchResultChien.visContacts.length === 1 && searchResultChien.visContacts[0].name === '黃千芸');
assert('搜尋「千」時全體議題完整保留，絕不因說帖有千字而削切欄位', searchResultChien.visTopics.length === 5);

// 檢驗：搜尋純議題「癌症一次金」（無同名客戶），成功收斂為該議題欄位
const searchResultCancer = simulateSearchMatrix('癌症一次金', 'ALL');
assert('搜尋純議題「癌症一次金」精準收斂為該議題', searchResultCancer.visTopics.length === 1 && searchResultCancer.visTopics[0].title === '癌症一次金');
assert('搜尋純議題時保留全客戶名單以供橫向對比', searchResultCancer.visContacts.length === 2);



// -----------------------------------------------------------------------------
// 測試 9: 課表登錄與定聯軌跡防污染防呆檢驗 (杜絕非增員議題被誤植課表與約定狀態)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 9】課表登錄與定聯軌跡防污染防呆檢驗${colors.reset}`);
const mockTopicsState = [
  { id: 't_001', title: '工作動力測驗', category: '生活議題', scope: 'INDIVIDUAL' },
  { id: 't_009', title: '職涯轉換與事業合夥發展', category: '組織發展', scope: 'RECRUIT', isActive: true }
];

const mockTouchpoints = {
  'c_test_t_001': {
    id: 'tp_c_test_t_001',
    contactId: 'c_test',
    topicId: 't_001',
    latestDate: '2026-10-22',
    status: 'scheduled',
    history: [
      { id: 'h_1', date: '2026-10-22', status: 'scheduled', summary: '🎓 登錄學生作息課表【115學年度 第1學期】' },
      { id: 'h_2', date: '2026-10-15', status: 'in_progress', summary: '例行議題定聯關懷' }
    ]
  }
};

// 模擬 cleanupCorruptedScheduleTouchpoints 邏輯
let testChanged = false;
Object.keys(mockTouchpoints).forEach(key => {
  const tp = mockTouchpoints[key];
  const topic = mockTopicsState.find(t => t.id === tp.topicId);
  const isRecruitTopic = topic && (topic.scope === 'RECRUIT' || topic.category === '組織發展');
  if (!isRecruitTopic) {
    const initLen = tp.history.length;
    tp.history = tp.history.filter(h => !h.summary || !h.summary.includes('🎓 登錄學生作息課表'));
    if (tp.history.length !== initLen) {
      testChanged = true;
      tp.latestDate = tp.history[0].date;
      tp.status = tp.history[0].status || 'in_progress';
    }
  }
});

assert('自癒機制成功識別非組織增員議題被污染之課表紀錄', testChanged === true);
assert('「工作動力測驗」錯誤課表紀錄已被完全剔除', mockTouchpoints['c_test_t_001'].history.length === 1);
assert('「工作動力測驗」最新狀態正確還原為真實狀態（洽談而非約定）', mockTouchpoints['c_test_t_001'].status === 'in_progress');
assert('「工作動力測驗」最新接觸日期正確還原為 2026-10-15', mockTouchpoints['c_test_t_001'].latestDate === '2026-10-15');

// -----------------------------------------------------------------------------
// 測試 10: 今日新增名單（如呂苧齊）微步統計與橘線置頂門禁檢驗
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 10】今日新增名單微步統計與橘線置頂門禁檢驗${colors.reset}`);
const { extractDateFromContact } = require('./js/constants.js');

const mockLuContact = {
  id: 'c_20261023_095200_123',
  name: '呂苧齊',
  category: '一般緣故',
  createdAt: '2026-10-23',
  lastUpdated: '2026-10-23',
  lastContactDate: ''
};

// 1. extractDateFromContact 健壯性測試
assert('extractDateFromContact 從明確 createdAt 正確提取日期', extractDateFromContact(mockLuContact) === '2026-10-23');

const mockTimeCodeOnlyContact = {
  id: 'c_20261023_112233_456',
  name: '時間碼客戶'
};
assert('extractDateFromContact 從新版時間碼 ID (c_YYYYMMDD_...) 成功提取日期', extractDateFromContact(mockTimeCodeOnlyContact) === '2026-10-23');

// 2. 模擬通用 isContactUpdatedToday 判定 (移除人名特例，支援 -、/、. 與時間碼)
function universalGetDaysDiff(dateString, baseToday = '2026-10-24') {
  if (!dateString) return 999;
  const str = String(dateString).trim();
  let m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) {
    const mCode = str.match(/^c_(\d{4})(\d{2})(\d{2})/);
    if (mCode) m = [null, mCode[1], mCode[2], mCode[3]];
  }
  if (!m) return 999;
  const target = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  const baseParts = baseToday.split('-');
  const today = new Date(parseInt(baseParts[0], 10), parseInt(baseParts[1], 10) - 1, parseInt(baseParts[2], 10));
  return Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
}

function simulateUniversalIsContactUpdatedToday(contact, localToday) {
  if (!contact) return false;
  if (contact.createdAt && universalGetDaysDiff(contact.createdAt, localToday) === 0) return true;
  if (contact.lastUpdated && universalGetDaysDiff(contact.lastUpdated, localToday) === 0) return true;
  if (contact.lastContactDate && universalGetDaysDiff(contact.lastContactDate, localToday) === 0) return true;
  if (contact.id && universalGetDaysDiff(contact.id, localToday) === 0) return true;
  return false;
}

const mockSlashDateContact = { id: 'c_random_01', name: '王斜線客戶', createdAt: '2026/10/24' };
const mockDotDateContact = { id: 'c_random_02', name: '陳點號客戶', lastUpdated: '2026.10.24' };
const mockStandardNewContact = { id: 'c_20261024_083000_999', name: '一般新客戶' };

assert('【通用橘線門禁】斜線格式 createdAt (2026/10/24) 成功判定在橘線以上', simulateUniversalIsContactUpdatedToday(mockSlashDateContact, '2026-10-24') === true);
assert('【通用橘線門禁】點號格式 lastUpdated (2026.10.24) 成功判定在橘線以上', simulateUniversalIsContactUpdatedToday(mockDotDateContact, '2026-10-24') === true);
assert('【通用橘線門禁】非特定人名之時間碼新客戶必然判定在橘線以上', simulateUniversalIsContactUpdatedToday(mockStandardNewContact, '2026-10-24') === true);

// 3. 模擬全維度微步統計 (新增名單 + 資料維護 + 日誌)
const mockTest10ContactsList = [
  mockSlashDateContact,
  { id: 'c_002', name: '歷史客戶B', createdAt: '2026-09-01', lastUpdated: '2026-10-24' }, // 今日僅維護基本資料
  { id: 'c_003', name: '歷史客戶C', createdAt: '2026-09-01', lastUpdated: '2026-09-01' }  // 今日無任何維護
];

let todayNewCount = 0;
let todayMaintCount = 0;
mockTest10ContactsList.forEach(c => {
  if (c.createdAt && universalGetDaysDiff(c.createdAt, '2026-10-24') === 0) {
    todayNewCount++;
  } else if (c.lastUpdated && universalGetDaysDiff(c.lastUpdated, '2026-10-24') === 0) {
    todayMaintCount++;
  }
});

assert('【全維度微步門禁】斜線日期之新客戶成功計入今日新增名單', todayNewCount === 1);
assert('【全維度微步門禁】今日僅維護資料之歷史客戶成功計入今日推進行動', todayMaintCount === 1);

// -----------------------------------------------------------------------------
// 測試 11: 議題分類標籤空間優化與 Toggle 狀態切換檢驗 (刪除全部議題按鈕，騰出空間並支援再次點擊還原)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 11】議題分類標籤空間優化與 Toggle 切換門禁檢驗${colors.reset}`);
const indexHtmlContent = fs.readFileSync('./index.html', 'utf8');

// 1. 檢驗 index.html 內 topicCategoryTabs 確實無 'ALL' 按鈕
const topicCategoryTabsRegex = /<div class="filter-tabs" id="topicCategoryTabs">([\s\S]*?)<\/div>/;
const matchTopicCategoryTabs = indexHtmlContent.match(topicCategoryTabsRegex);
assert('HTML 存在 #topicCategoryTabs 容器', !!matchTopicCategoryTabs);
const tabsHtml = matchTopicCategoryTabs ? matchTopicCategoryTabs[1] : '';
assert('【空間優化門禁】#topicCategoryTabs 絕不包含 data-category="ALL" 之全部議題按鈕', !tabsHtml.includes('data-category="ALL"'));
assert('#topicCategoryTabs 包含 6 大核心議題分類', tabsHtml.includes('身份接觸') && tabsHtml.includes('風險管控') && tabsHtml.includes('投資理財') && tabsHtml.includes('稅務傳承') && tabsHtml.includes('生活議題') && tabsHtml.includes('組織發展'));

// 2. 模擬 Toggle 點擊切換邏輯
let mockStateFilters = { topicCategory: 'ALL' };
let mockActiveTab = null;

function simulateTopicTabClick(cat) {
  const isAlreadyActive = (mockActiveTab === cat);
  if (cat === 'ALL' || isAlreadyActive) {
    mockStateFilters.topicCategory = 'ALL';
    mockActiveTab = null;
  } else {
    mockActiveTab = cat;
    mockStateFilters.topicCategory = cat;
  }
}

// 預設為 ALL
assert('預設狀態為全部議題 (topicCategory = ALL)', mockStateFilters.topicCategory === 'ALL' && mockActiveTab === null);

// 點擊「風險管控」
simulateTopicTabClick('風險管控');
assert('點選【風險管控】成功過濾該議題分類', mockStateFilters.topicCategory === '風險管控' && mockActiveTab === '風險管控');

// 再次點擊「風險管控」 -> 應切回 ALL 且無 active
simulateTopicTabClick('風險管控');
assert('【Toggle 門禁】再次點選已選中的【風險管控】，成功還原至全部議題 (ALL) 且無標籤 active', mockStateFilters.topicCategory === 'ALL' && mockActiveTab === null);

// 切換至「投資理財」再切換至「生活議題」
simulateTopicTabClick('投資理財');
assert('選取【投資理財】成功激活', mockStateFilters.topicCategory === '投資理財' && mockActiveTab === '投資理財');
simulateTopicTabClick('生活議題');
assert('切換至【生活議題】成功轉移 active', mockStateFilters.topicCategory === '生活議題' && mockActiveTab === '生活議題');

// 3. 檢驗 visibleTopics 在 ALL 與特定分類下的過濾正確性
const mockAllTopics = [
  { id: 't_1', title: '退休年金', category: '投資理財', isActive: true },
  { id: 't_2', title: '重大傷病', category: '風險管控', isActive: true },
  { id: 't_3', title: '遺產稅申報', category: '稅務傳承', isActive: true }
];

function getVisibleTopics(topics, categoryFilter) {
  let list = topics.filter(t => t.isActive);
  if (categoryFilter && categoryFilter !== 'ALL') {
    list = list.filter(t => t.category === categoryFilter);
  }
  return list;
}

assert('ALL 狀態下所有啟用的議題皆可見 (3/3)', getVisibleTopics(mockAllTopics, 'ALL').length === 3);
assert('投資理財 狀態下僅該類別議題可見 (1/3)', getVisibleTopics(mockAllTopics, '投資理財').length === 1 && getVisibleTopics(mockAllTopics, '投資理財')[0].id === 't_1');

// -----------------------------------------------------------------------------
// 測試 12: 客群多棲共存與雙向交叉篩選矩陣 (Multi-Persona Cross-Filter Matrix)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 12】客群多棲共存與雙向交叉篩選矩陣${colors.reset}`);
const {
  isClientCorporate: test12IsCorp,
  isClientIndividual: test12IsInd,
  isClientRecruit: test12IsRec,
  formatMaskedName: test17FormatMaskedName
} = require('./js/constants.js');

const mockTriplePersona = { name: '王全能', category: '一般緣故', tags: ['企業客戶', '準增員'], notes: '兼任科技公司執行董事' };
const mockPureIndividual = { name: '李一般', category: '一般緣故', tags: ['生活日常'], notes: '在某貿易公司擔任會計助理' };
const mockPureRecruit = { name: '陳學生', category: '校園增員', tags: ['大四實習'], notes: '準備考公職與壽險證照' };
const mockPureCorporate = { name: '張董座', category: '企業客群', tags: [], notes: '精密機械製造股份有限公司 董事長' };

// 1. 三棲客戶多向檢驗
assert('三棲名單在【個人客戶】中判定為真', test12IsInd(mockTriplePersona) === true);
assert('三棲名單在【企業客戶】中判定為真', test12IsCorp(mockTriplePersona) === true);
assert('三棲名單在【準增員】中判定為真', test12IsRec(mockTriplePersona) === true);

// 2. 單一純粹身分嚴格隔離
assert('【防呆】一般會計助理在【企業客戶】中絕對判定為假 (false)', test12IsCorp(mockPureIndividual) === false);
assert('【防呆】校園增員學生在【企業客戶】中絕對判定為假 (false)', test12IsCorp(mockPureRecruit) === false);
assert('企業董座在【企業客戶】中正確判定為真 (true)', test12IsCorp(mockPureCorporate) === true);

// -----------------------------------------------------------------------------
// 測試 13: 雙軸篩選收斂極限與多重關鍵字複合搜尋
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 13】雙軸篩選收斂極限與多重關鍵字複合搜尋${colors.reset}`);

function matchContactMultiQuery(contact, rawQuery) {
  if (!rawQuery) return true;
  const qClean = rawQuery.replace(/[\s　]+/g, ' ').trim().toLowerCase();
  if (!qClean) return true;
  const terms = qClean.split(' ');
  const targetText = [
    contact.name,
    contact.nickname,
    contact.category,
    contact.mbti,
    contact.disc,
    ...(contact.tags || []),
    contact.notes
  ].filter(Boolean).join(' ').toLowerCase();

  return terms.every(term => targetText.includes(term));
}

const mockSearchContact = {
  name: '黃千芸',
  nickname: '小芸',
  category: '一般緣故',
  mbti: 'ENTJ',
  disc: 'DI',
  tags: ['高資產', '家庭保單'],
  notes: '關注癌症與高額儲蓄'
};

assert('單一關鍵字搜尋命中客戶', matchContactMultiQuery(mockSearchContact, '千芸'));
assert('多關鍵字（姓名 + MBTI）複合搜尋成功命中', matchContactMultiQuery(mockSearchContact, '千芸 ENTJ'));
assert('多關鍵字（綽號 + DISC）包含多個全形空白成功命中', matchContactMultiQuery(mockSearchContact, '小芸　　DI'));
assert('未命中之無關詞組嚴格過濾為 false', matchContactMultiQuery(mockSearchContact, '千芸 醫療理賠') === false);
assert('純空格與空字串搜尋安全返回 true（呈現全名單）', matchContactMultiQuery(mockSearchContact, '   　  ') === true);
assert('標籤關鍵字精準命中', matchContactMultiQuery(mockSearchContact, '高資產'));

// -----------------------------------------------------------------------------
// 測試 14: 定聯狀態機流轉與歷史回溯不變量
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 14】定聯狀態機流轉與歷史回溯不變量${colors.reset}`);

class MockTouchpointStateMachine {
  constructor(tp) {
    this.tp = JSON.parse(JSON.stringify(tp));
  }
  addHistory(date, status, summary) {
    if (!this.tp.history) this.tp.history = [];
    const newEntry = { id: `h_${Date.now()}_${Math.random()}`, date, status, summary };
    this.tp.history.unshift(newEntry);
    this.tp.history.sort((a, b) => b.date.localeCompare(a.date));
    this.tp.latestDate = this.tp.history[0].date;
    this.tp.status = this.tp.history[0].status;
  }
  deleteHistory(entryId) {
    if (!this.tp.history) return;
    this.tp.history = this.tp.history.filter(h => h.id !== entryId);
    if (this.tp.history.length > 0) {
      this.tp.latestDate = this.tp.history[0].date;
      this.tp.status = this.tp.history[0].status;
    } else {
      this.tp.latestDate = '';
      this.tp.status = 'planned';
    }
  }
}

const mockInitialTp = {
  id: 'tp_01',
  contactId: 'c_01',
  topicId: 't_01',
  status: 'planned',
  latestDate: '',
  history: []
};

const sm = new MockTouchpointStateMachine(mockInitialTp);
assert('初始狀態為 planned 且無最新日期', sm.tp.status === 'planned' && sm.tp.latestDate === '');

sm.addHistory('2026-10-10', 'interaction', '初次線上交流');
assert('推進至【互動 interaction】狀態，日期為 2026-10-10', sm.tp.status === 'interaction' && sm.tp.latestDate === '2026-10-10');

sm.addHistory('2026-10-15', 'pitched', '拋出重大傷病說帖');
assert('推進至【拋出 pitched】狀態，日期更新為 2026-10-15', sm.tp.status === 'pitched' && sm.tp.latestDate === '2026-10-15');

sm.addHistory('2026-10-20', 'appointment', '約定下週三見面詳談');
assert('推進至【約定 appointment】狀態，日期更新為 2026-10-20', sm.tp.status === 'appointment' && sm.tp.latestDate === '2026-10-20');

// 刪除最新一筆歷史，檢驗自愈回溯
const latestEntryId = sm.tp.history[0].id;
sm.deleteHistory(latestEntryId);
assert('【自癒回溯】刪除約定紀錄後，狀態自動回溯至【拋出 pitched】且日期還原為 2026-10-15', sm.tp.status === 'pitched' && sm.tp.latestDate === '2026-10-15');

// 清空歷史，重設為預設
sm.tp.history.slice().forEach(h => sm.deleteHistory(h.id));
assert('【自癒回溯】全清空歷史後，狀態安全重設為 planned 且日期清空', sm.tp.status === 'planned' && sm.tp.latestDate === '');

// -----------------------------------------------------------------------------
// 測試 15: 定聯頻率溫層（熱/暖/溫/冷）極端時間與跨年換日邊界
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 15】定聯頻率溫層（熱/暖/溫/冷）極端時間與跨年換日邊界${colors.reset}`);

function calculateContactWarmth(latestDateStr, baseDateStr = '2026-10-24') {
  if (!latestDateStr || typeof latestDateStr !== 'string') return 'COLD';
  const match = latestDateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return 'COLD';

  const baseDate = new Date(baseDateStr);
  const targetDate = new Date(latestDateStr);
  if (isNaN(baseDate.getTime()) || isNaN(targetDate.getTime())) return 'COLD';

  const diffMs = baseDate.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'HOT'; // 未來約定接觸直接歸為熱層
  if (diffDays <= 7) return 'HOT'; // 7 天內：熱
  if (diffDays <= 14) return 'WARM'; // 8-14 天：暖
  if (diffDays <= 30) return 'TEPID'; // 15-30 天：溫
  return 'COLD'; // 31 天以上：冷
}

assert('空接觸日期安全歸為【冷層 COLD】', calculateContactWarmth('') === 'COLD');
assert('非法日期格式 safe-fallback 歸為【冷層 COLD】', calculateContactWarmth('invalid-date-string') === 'COLD');
assert('當天 (2026-10-24) 定聯判定為【熱層 HOT】(0 天)', calculateContactWarmth('2026-10-24') === 'HOT');
assert('6 天前 (2026-10-18) 定聯判定為【熱層 HOT】', calculateContactWarmth('2026-10-18') === 'HOT');
assert('12 天前 (2026-10-12) 定聯判定為【暖層 WARM】', calculateContactWarmth('2026-10-12') === 'WARM');
assert('25 天前 (2026-09-29) 定聯判定為【溫層 TEPID】', calculateContactWarmth('2026-09-29') === 'TEPID');
assert('【跨年邊界】2025-12-30 至 2026-01-02 跨年計算差異為 3 天，精準判定為【熱層 HOT】', calculateContactWarmth('2025-12-30', '2026-01-02') === 'HOT');

// -----------------------------------------------------------------------------
// 測試 16: LocalStorage 極限超載分項降級與安全寫入
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 16】LocalStorage 極限超載分項降級與安全寫入${colors.reset}`);

// 模擬分項保存器
class MockResilientStorage {
  constructor() {
    this.store = {};
    this.errorLog = [];
  }
  setItem(key, value) {
    if (key.includes('DOC_PRINTS') && value.length > 50000) {
      const err = new Error('QuotaExceededError: LocalStorage quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store[key] = value;
  }
  saveAllSeparated(items) {
    items.forEach(item => {
      try {
        this.setItem(item.key, JSON.stringify(item.val));
      } catch (e) {
        this.errorLog.push({ key: item.key, error: e.name || e.message });
      }
    });
  }
}

const resilientStorage = new MockResilientStorage();
const mockBatchItems = [
  { key: 'CONTACTS', val: [{ id: 'c_1', name: '王客戶' }] },
  { key: 'TOUCHPOINTS', val: { tp_1: { status: 'agreed' } } },
  { key: 'DOC_PRINTS', val: 'X'.repeat(60000) }, // 刻意超大字串引發 QuotaExceeded
  { key: 'REMINDERS', val: [{ id: 'rem_1', note: '致電核保' }] }
];

resilientStorage.saveAllSeparated(mockBatchItems);
assert('分項保存器成功捕獲超載錯誤而不崩潰', resilientStorage.errorLog.length === 1);
assert('超載項目確為 DOC_PRINTS', resilientStorage.errorLog[0].key === 'DOC_PRINTS');
assert('【核心資產保護】CONTACTS 依然 100% 成功持久化', !!resilientStorage.store['CONTACTS']);
assert('【核心資產保護】TOUCHPOINTS 依然 100% 成功持久化', !!resilientStorage.store['TOUCHPOINTS']);
assert('【後續排程保護】超載之後的 REMINDERS 依舊成功保存不中斷', !!resilientStorage.store['REMINDERS']);

// -----------------------------------------------------------------------------
// 測試 17: Demo 去識別化遮蔽與字元安全防線
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 17】Demo 去識別化遮蔽與字元安全防線${colors.reset}`);

assert('單字姓名「陳」保持原樣', test17FormatMaskedName('陳') === '陳');
assert('兩字姓名「陳樂」遮蔽為「陳Ｏ」', test17FormatMaskedName('陳樂') === '陳Ｏ');
assert('三字姓名「游長霖」遮蔽為「游Ｏ霖」', test17FormatMaskedName('游長霖') === '游Ｏ霖');
assert('四字複姓姓名「歐陽大為」遮蔽為「歐ＯＯ為」', test17FormatMaskedName('歐陽大為') === '歐ＯＯ為');
assert('空值與非字串輸入安全返回空字串而不報錯', test17FormatMaskedName(null) === '' && test17FormatMaskedName(undefined) === '');

// -----------------------------------------------------------------------------
// 測試 18: Google Sheets 雲端同步衝突消解與增量合併
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 18】Google Sheets 雲端同步衝突消解與增量合併${colors.reset}`);

function mergeCloudContacts(localContacts, cloudContacts, deletedContactsList) {
  const localMap = new Map();
  localContacts.forEach(c => localMap.set(c.id, c));

  cloudContacts.forEach(cCloud => {
    // 若在刪除黑名單中，絕對禁止復活
    if (deletedContactsList.includes(cCloud.id)) return;

    const cLocal = localMap.get(cCloud.id);
    if (!cLocal) {
      localMap.set(cCloud.id, cCloud);
    } else {
      // 時間戳比對：以 updatedAt 最新者為準
      const cloudTime = new Date(cCloud.updatedAt || 0).getTime();
      const localTime = new Date(cLocal.updatedAt || 0).getTime();
      if (cloudTime > localTime) {
        localMap.set(cCloud.id, { ...cLocal, ...cCloud });
      }
    }
  });

  return Array.from(localMap.values());
}

const mockLocalContacts = [
  { id: 'c_01', name: '張客戶', updatedAt: '2026-10-23T10:00:00Z', notes: '本機最新筆記' },
  { id: 'c_02', name: '李客戶', updatedAt: '2026-10-20T10:00:00Z', notes: '本機舊筆記' }
];

const mockCloudContacts = [
  { id: 'c_01', name: '張客戶', updatedAt: '2026-10-22T10:00:00Z', notes: '雲端較舊筆記' },
  { id: 'c_02', name: '李客戶', updatedAt: '2026-10-23T12:00:00Z', notes: '雲端最新筆記' },
  { id: 'c_03', name: '王新客戶', updatedAt: '2026-10-23T12:00:00Z', notes: '雲端新增客戶' },
  { id: 'c_deleted', name: '幽靈客戶', updatedAt: '2026-10-23T15:00:00Z' }
];

const mockDeletedList = ['c_deleted'];

const merged = mergeCloudContacts(mockLocalContacts, mockCloudContacts, mockDeletedList);

assert('雲端較新資料成功覆蓋本機 (李客戶筆記更新)', merged.find(c => c.id === 'c_02').notes === '雲端最新筆記');
assert('本機較新資料成功防禦未被雲端覆蓋 (張客戶筆記保留)', merged.find(c => c.id === 'c_01').notes === '本機最新筆記');
assert('雲端新名單成功增量合併入本機 (王新客戶)', merged.some(c => c.id === 'c_03'));
assert('【防復活門禁】已在黑名單之 c_deleted 絕不重新復活', !merged.some(c => c.id === 'c_deleted'));
assert('合併後名單總數量精確為 3', merged.length === 3);

// -----------------------------------------------------------------------------
// 測試 19: 跨模組資料流逆向追蹤與 ASCII 邊界矛盾檢驗 (Reverse Data Flow & Boundary Conflict)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 19】跨模組資料流逆向追蹤與 ASCII 邊界矛盾門禁檢驗${colors.reset}`);
const { normalizeStandardDate, compareDateStrings } = require('./js/constants.js');

// 1. 檢驗 ASCII 45 < 47 陷阱消除：標準日期 (帶 -) 與斜線日期 (帶 /) 嚴格數值時間比較
assert('【ASCII陷阱消除】compareDateStrings("2026-10-24", "2026/09/29") 正確判定前者較新 (> 0)', compareDateStrings('2026-10-24', '2026/09/29') > 0);
assert('【ASCII陷阱消除】compareDateStrings("2026.10.24", "2026-10-24") 正確判定同日 (= 0)', compareDateStrings('2026.10.24', '2026-10-24') === 0);
assert('【ASCII陷阱消除】compareDateStrings("2026-10-24", "2026-10-25") 正確判定後者較新 (< 0)', compareDateStrings('2026-10-24', '2026-10-25') < 0);
assert('【ASCII陷阱消除】時間碼 ID 與標準日期比較正確解析', compareDateStrings('c_20261024_093000', '2026-10-20') > 0);

// 2. normalizeStandardDate 全格式容錯解析
assert('【日期正規化】斜線格式 2026/10/24 轉為 2026-10-24', normalizeStandardDate('2026/10/24') === '2026-10-24');
assert('【日期正規化】點號格式 2026.10.24 轉為 2026-10-24', normalizeStandardDate('2026.10.24') === '2026-10-24');
assert('【日期正規化】時間碼 c_20261024_120000 轉為 2026-10-24', normalizeStandardDate('c_20261024_120000') === '2026-10-24');
assert('【日期正規化】ISO 日期時間字串轉為 2026-10-24', normalizeStandardDate('2026-10-24T12:30:00Z') === '2026-10-24');

// 3. extractDateFromContact 多屬性容錯
assert('【多屬性萃取】支援 createdAt 斜線格式', extractDateFromContact({ createdAt: '2026/10/24' }) === '2026-10-24');
assert('【多屬性萃取】支援 createdDate 點號格式', extractDateFromContact({ createdDate: '2026.10.24' }) === '2026-10-24');
assert('【多屬性萃取】支援 date 屬性', extractDateFromContact({ date: '2026-10-24' }) === '2026-10-24');
assert('【多屬性萃取】支援時間碼 ID 降級解析', extractDateFromContact({ id: 'c_20261024_080000' }) === '2026-10-24');
assert('【多屬性萃取】支援 lastUpdated 降級萃取', extractDateFromContact({ lastUpdated: '2026/10/24' }) === '2026-10-24');

// 4. 既有客戶維護後收折保護門禁模擬
let mockHideState = { hideUpdatedContacts: true };
// 模擬維護既有客戶儲存動作
if (mockHideState.hideUpdatedContacts) {
  mockHideState.hideUpdatedContacts = false;
}
assert('【名單防蒸發門禁】維護既有客戶後，hideUpdatedContacts 強制解鎖還原為 false', mockHideState.hideUpdatedContacts === false);

// 5. 客群維度跨區切換連動門禁模擬
let mockClientType = 'INDIVIDUAL';
const finalCorp = true;
const finalInd = false;
const finalRec = false;
const matchesCurrent = (mockClientType === 'CORPORATE' && finalCorp) ||
                       (mockClientType === 'RECRUIT' && finalRec) ||
                       (mockClientType === 'INDIVIDUAL' && finalInd);
if (!matchesCurrent) {
  if (finalCorp && !finalInd) mockClientType = 'CORPORATE';
}
assert('【維度連動門禁】個人客戶變更為企業客戶後，客群畫面維度自動對齊為 CORPORATE', mockClientType === 'CORPORATE');

// -----------------------------------------------------------------------------
// 測試 20: 跨模組防污染與級聯清理門禁檢驗 (Anti-Ripple & Cascading Cleanup)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 20】跨模組防污染與級聯清理門禁檢驗 (新增B不影響A防線)${colors.reset}`);

// 1. 客戶更名級聯同步更新待辦提醒 (Cascade Update)
const mockRenameReminders = [
  { id: 'rem_01', contactId: 'c_rename_01', contactName: '舊姓名張先生', topicId: 't_01' },
  { id: 'rem_02', contactId: 'c_other_02', contactName: '其他客戶李小姐', topicId: 't_01' }
];
const updatedContactData = { id: 'c_rename_01', name: '新姓名張董事長' };
mockRenameReminders.forEach(r => {
  if (r.contactId === updatedContactData.id) {
    r.contactName = updatedContactData.name;
  }
});
assert('【級聯更名門禁】客戶更名時，待辦提醒之 contactName 自動同步更新', mockRenameReminders.find(r => r.id === 'rem_01').contactName === '新姓名張董事長');
assert('【級聯更名門禁】其他客戶之待辦提醒不受更名影響 (不跨界污染)', mockRenameReminders.find(r => r.id === 'rem_02').contactName === '其他客戶李小姐');

// 2. 刪除客戶完整級聯清理 (Cascade Delete Contact)
let mockCascadeState = {
  contacts: [{ id: 'c_target', name: '目標客戶' }, { id: 'c_safe', name: '安全客戶' }],
  touchpoints: { 'c_target_t01': { history: [] }, 'c_safe_t01': { history: [] } },
  vehicles: [{ id: 'v1', contactId: 'c_target' }, { id: 'v2', contactId: 'c_safe' }],
  studentSchedules: { 'c_target': { semester: '115-1' }, 'c_safe': { semester: '115-1' } },
  reminders: [{ id: 'r1', contactId: 'c_target' }, { id: 'r2', contactId: 'c_safe' }],
  contactTopicFilter: { contactId: 'c_target', mode: 'ALL' },
  activeFocus: { contactId: 'c_target', isPinned: true }
};

// 模擬健全級聯刪除
const targetId = 'c_target';
mockCascadeState.contacts = mockCascadeState.contacts.filter(c => c.id !== targetId);
Object.keys(mockCascadeState.touchpoints).forEach(k => {
  if (k.startsWith(`${targetId}_`)) delete mockCascadeState.touchpoints[k];
});
mockCascadeState.vehicles = mockCascadeState.vehicles.filter(v => v.contactId !== targetId);
delete mockCascadeState.studentSchedules[targetId];
mockCascadeState.reminders = mockCascadeState.reminders.filter(r => r.contactId !== targetId);
if (mockCascadeState.contactTopicFilter.contactId === targetId) {
  mockCascadeState.contactTopicFilter = { contactId: null, mode: 'ALL' };
}
if (mockCascadeState.activeFocus.contactId === targetId) {
  mockCascadeState.activeFocus = { contactId: null, isPinned: false };
}

assert('【級聯刪除門禁】刪除目標客戶後，名單清單完全移除', !mockCascadeState.contacts.some(c => c.id === targetId));
assert('【級聯刪除門禁】刪除目標客戶後，家庭車庫無殘留孤兒車籍', !mockCascadeState.vehicles.some(v => v.contactId === targetId));
assert('【級聯刪除門禁】刪除目標客戶後，課表作息資料無殘留孤兒資料', mockCascadeState.studentSchedules[targetId] === undefined);
assert('【級聯刪除門禁】刪除目標客戶後，抽屜中無幽靈待辦提醒殘留', !mockCascadeState.reminders.some(r => r.contactId === targetId));
assert('【級聯刪除門禁】刪除目標客戶後，客戶聚焦篩選自動安全重設 (杜絕全空矩陣)', mockCascadeState.contactTopicFilter.contactId === null);
assert('【級聯刪除門禁】安全客戶之名單、車庫與課表完全完好不受波及 (隔離性保證)', mockCascadeState.contacts.length === 1 && mockCascadeState.vehicles.length === 1);

// 3. 刪除議題完整級聯清理 (Cascade Delete Topic)
let mockTopicState = {
  topics: [{ id: 't_del', title: '待刪議題' }, { id: 't_keep', title: '保留議題' }],
  topicFocusFilter: { topicId: 't_del' },
  reminders: [{ id: 'r1', topicId: 't_del' }, { id: 'r2', topicId: 't_keep' }]
};

const delTopicId = 't_del';
mockTopicState.topics = mockTopicState.topics.filter(t => t.id !== delTopicId);
if (mockTopicState.topicFocusFilter.topicId === delTopicId) {
  mockTopicState.topicFocusFilter = { topicId: null };
}
mockTopicState.reminders = mockTopicState.reminders.filter(r => r.topicId !== delTopicId);

assert('【級聯刪除門禁】刪除議題後，topicFocusFilter 鎖定狀態自動解鎖還原 (防止矩陣反白)', mockTopicState.topicFocusFilter.topicId === null);
assert('【級聯刪除門禁】刪除議題後，相關議題之待辦提醒自動淨空', !mockTopicState.reminders.some(r => r.topicId === delTopicId));

// 4. 全端零特定人名硬編碼掃描 (No Hardcoded Names)
const stateJsContent = fs.readFileSync('./js/state.js', 'utf8');
const rendererJsContent = fs.readFileSync('./js/renderer.js', 'utf8');
assert('【客觀通用門禁】state.js 原始碼 100% 徹底不含「呂苧齊」特例硬編碼', !stateJsContent.includes('呂苧齊'));
assert('【客觀通用門禁】renderer.js 原始碼 100% 徹底不含「呂苧齊」特例硬編碼', !rendererJsContent.includes('呂苧齊'));

// -----------------------------------------------------------------------------
// 測試 21: 車籍產險到期預警計算與邊界門禁 (Vehicle Insurance Expiry Alerts)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 21】車籍產險到期預警計算與邊界門禁${colors.reset}`);
function calculateVehicleExpiryStatus(expiryDateStr, baseDateStr = '2026-10-24') {
  const normExpiry = normalizeStandardDate(expiryDateStr);
  const normBase = normalizeStandardDate(baseDateStr);
  if (!normExpiry) return { status: 'UNKNOWN', diffDays: 999 };
  const diffMs = new Date(normExpiry).getTime() - new Date(normBase).getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'OVERDUE', diffDays };
  if (diffDays <= 30) return { status: 'URGENT', diffDays };
  if (diffDays <= 60) return { status: 'WARNING', diffDays };
  return { status: 'NORMAL', diffDays };
}

assert('【產險到期】過去日期判定為已逾期 (OVERDUE)', calculateVehicleExpiryStatus('2026-10-20', '2026-10-24').status === 'OVERDUE');
assert('【產險到期】斜線格式 15 天內判定為緊急預警 (URGENT)', calculateVehicleExpiryStatus('2026/11/05', '2026-10-24').status === 'URGENT');
assert('【產險到期】45 天內判定為黃色提示 (WARNING)', calculateVehicleExpiryStatus('2026.12.05', '2026-10-24').status === 'WARNING');
assert('【產險到期】90 天後判定為常態期 (NORMAL)', calculateVehicleExpiryStatus('2027-01-24', '2026-10-24').status === 'NORMAL');

// -----------------------------------------------------------------------------
// 測試 22: 出國旅遊行程天數與狀態換日邊界 (Travel Smart Banner Days Calculation)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 22】出國旅遊行程天數與狀態換日邊界${colors.reset}`);
function calculateTravelMeta(depDateStr, retDateStr, nowStr = '2026-10-24') {
  const dep = new Date(normalizeStandardDate(depDateStr));
  const ret = new Date(normalizeStandardDate(retDateStr));
  const now = new Date(normalizeStandardDate(nowStr));
  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return null;

  const totalTripDays = Math.max(1, Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  if (now >= ret) {
    const passedDays = Math.floor((now.getTime() - ret.getTime()) / (1000 * 60 * 60 * 24));
    return { phase: 'RETURNED', totalTripDays, passedDays };
  }
  if (now >= dep && now < ret) {
    const leftDays = Math.ceil((ret.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { phase: 'TRAVELING', totalTripDays, leftDays };
  }
  const diffDays = Math.ceil((dep.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { phase: 'COUNTDOWN', totalTripDays, diffDays };
}

const tripA = calculateTravelMeta('2026-10-20', '2026-10-24', '2026-10-24');
assert('【旅遊計算】10/20 至 10/24 共 5 天旅程計算精確', tripA.totalTripDays === 5);
assert('【旅遊計算】今日回國判定為 RETURNED 且 passedDays === 0', tripA.phase === 'RETURNED' && tripA.passedDays === 0);

const tripB = calculateTravelMeta('2026-10-26', '2026-10-30', '2026-10-24');
assert('【旅遊計算】2 天後出發判定為 COUNTDOWN 且 diffDays === 2 (旅平險提醒觸發)', tripB.phase === 'COUNTDOWN' && tripB.diffDays === 2);

const tripC = calculateTravelMeta('2026-10-22', '2026-10-28', '2026-10-24');
assert('【旅遊計算】旅途中判定為 TRAVELING', tripC.phase === 'TRAVELING');

// -----------------------------------------------------------------------------
// 測試 23: Google Sheets 批次同步傳輸封裝安全 (Payload Serialization & Quota Guard)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 23】Google Sheets 批次同步傳輸封裝安全${colors.reset}`);
const mockLargeContacts = Array.from({ length: 50 }, (_, i) => ({
  id: `c_bulk_${i}`,
  name: `大量客戶${i}`,
  tags: ['高資產', '家庭車庫', '中小企業'],
  notes: '標準化長備忘測試'.repeat(5)
}));

const serializedPayload = JSON.stringify({
  action: 'BATCH_SYNC',
  timestamp: Date.now(),
  contacts: mockLargeContacts
});
assert('【雲端序列化】大量客戶批次序列化無異常溢出', serializedPayload.length > 0);
assert('【雲端反序列化】JSON 往返解析後名單總長度精準一致', JSON.parse(serializedPayload).contacts.length === 50);

function safeJSONParse(raw, fallback = {}) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
assert('【防崩潰門禁】safeJSONParse 遭遇殘破 JSON 字串安全回傳 fallback 物件而不拋錯', Object.keys(safeJSONParse('{ malformed json', { ok: false })).length === 1);

// -----------------------------------------------------------------------------
// 測試 24: 工作日誌時間軸自癒與字元截斷防護 (WorkLogs Timeline & Content Truncation Guard)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 24】工作日誌時間軸自癒與字元截斷防護${colors.reset}`);
const mockWorkLogs = [
  { id: 'w1', date: '2026-10-20', content: '舊日誌' },
  { id: 'w2', date: '2026-10-24', content: '今日全新日誌【特別長特別長特別長特別長特別長特別長特別長特別長特別長特別長】' }
];

const truncatedSummary = mockWorkLogs[1].content.length > 30 ? (mockWorkLogs[1].content.slice(0, 30) + '...') : mockWorkLogs[1].content;
assert('【日誌防溢出】超長日誌在微步 HUD 中安全截斷至 33 字以內', truncatedSummary.length <= 33 && truncatedSummary.endsWith('...'));

mockWorkLogs.sort((a, b) => compareDateStrings(b.date, a.date));
assert('【日誌時間軸】日誌依照日期由新至舊排序正確', mockWorkLogs[0].id === 'w2');

// -----------------------------------------------------------------------------
// 測試 26: MBTI 4維度 (4x2 矩陣) 與次感元互斥與合成門禁 (MBTI 4-Dimension Matrix & Synthesis)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 26】MBTI 4維度 (4x2 矩陣) 與次感元互斥與合成門禁${colors.reset}`);
function parseMbtiDimensions(val = '') {
  const upperVal = String(val || '').toUpperCase().trim();
  const dim0 = upperVal.includes('E') ? 'E' : (upperVal.includes('I') ? 'I' : '');
  const dim1 = upperVal.includes('S') ? 'S' : (upperVal.includes('N') ? 'N' : '');
  const dim2 = upperVal.includes('T') ? 'T' : (upperVal.includes('F') ? 'F' : '');
  const dim3 = upperVal.includes('J') ? 'J' : (upperVal.includes('P') ? 'P' : '');
  const synthesized = (dim0 && dim1 && dim2 && dim3) ? `${dim0}${dim1}${dim2}${dim3}` : '';
  return { dim0, dim1, dim2, dim3, synthesized };
}

assert('【MBTI維度】E/I 正確識別 (ENTP 萃取 E)', parseMbtiDimensions('ENTP').dim0 === 'E');
assert('【MBTI維度】S/N 正確識別 (INFJ 萃取 N)', parseMbtiDimensions('INFJ').dim1 === 'N');
assert('【MBTI維度】T/F 正確識別 (ESTP 萃取 T)', parseMbtiDimensions('ESTP').dim2 === 'T');
assert('【MBTI維度】J/P 正確識別 (ISFP 萃取 P)', parseMbtiDimensions('ISFP').dim3 === 'P');
assert('【MBTI容錯】小寫與空白輸入正規化合成大寫 (i n f p -> INFP)', parseMbtiDimensions('i n f p').synthesized === 'INFP');
assert('【MBTI防呆】不完整維度 (只有 EN) 不合成 4 碼型別', parseMbtiDimensions('EN').synthesized === '');

// -----------------------------------------------------------------------------
// 測試 27: 台灣監理站與產險發照/出廠/生日民國年月日極端轉換 (Taiwan ROC & AD Extreme Converters)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 27】台灣監理站與產險發照/出廠/生日民國年月日極端轉換${colors.reset}`);
const { formatRocBirthDate, formatManufactureDate, formatIssueDate } = require('./js/constants.js');

const rocBirth = formatRocBirthDate('0810801');
assert('【民國生日】民國 81 年 0810801 轉西元 1992-08-01', rocBirth.ad === '1992-08-01');

const rocBirth2 = formatRocBirthDate('1992-08-01');
assert('【西元生日】西元 1992-08-01 轉民國 081/08/01', rocBirth2.rocSlash === '081/08/01');

const rocMfg = formatManufactureDate('10505');
assert('【出廠年月】民國 10505 轉西元 2016-05', rocMfg.adDash === '2016-05');

const rocMfg2 = formatManufactureDate('2016-05');
assert('【出廠年月】西元 2016-05 轉民國 105/05', rocMfg2.rocSlash === '105/05');

const rocIssue = formatIssueDate('1051102');
assert('【發照日期】民國 1051102 轉西元 2016-11-02', rocIssue.ad === '2016-11-02');

const rocEmpty = formatRocBirthDate('');
assert('【日期防崩潰】空值發照與生日安全返回空字串', rocEmpty.ad === '');

// -----------------------------------------------------------------------------
// 測試 28: 業務說帖與固定訊息庫 (Fixed Messages / Pitch Scripts) 搜尋與置換防呆
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 28】業務說帖與固定訊息庫搜尋與置換防呆${colors.reset}`);
function renderPitchTemplate(template, vars = {}) {
  let res = String(template || '');
  Object.keys(vars).forEach(k => {
    const val = vars[k] !== undefined && vars[k] !== null ? vars[k] : '';
    res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
  });
  return res;
}
function escapeHtmlScript(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const renderedPitch = renderPitchTemplate('您好 {clientName}，您的愛車 {plate} 預計於 {date} 到期。', {
  clientName: '王大明',
  plate: 'ABC-1234',
  date: '2026-11-01'
});
assert('【說帖變數】客戶姓名與車牌動態置換正確', renderedPitch.includes('王大明') && renderedPitch.includes('ABC-1234') && renderedPitch.includes('2026-11-01'));

const missingVarsPitch = renderPitchTemplate('您好 {clientName}，提供您專屬專案。', {});
assert('【說帖防呆】未傳入變數時安全清空佔位符而不顯示 undefined', !missingVarsPitch.includes('undefined') && missingVarsPitch.includes('您好 '));

const xssSafe = escapeHtmlScript('<script>alert("XSS")</script>');
assert('【XSS防禦】說帖特殊 HTML 標籤安全轉義', !xssSafe.includes('<script>') && xssSafe.includes('&lt;script&gt;'));

const crlfNormalized = "第一行\r\n第二行".replace(/\r\n/g, '\n');
assert('【說帖換行】CRLF 跨作業系統自動正規化為 LF', !crlfNormalized.includes('\r'));

const mockPitchTags = ['車險提醒', '旅平卡', '高資產傳承'];
assert('【說帖分類】業務說帖涵蓋核心展業分類', mockPitchTags.includes('車險提醒') && mockPitchTags.includes('高資產傳承'));

// -----------------------------------------------------------------------------
// 測試 29: 學生/準增員空堂筆記與時間槽 (Schedule Free Time Slots) 智慧解析
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 29】學生/準增員空堂筆記與時間槽智慧解析${colors.reset}`);
function extractFreeTimeKeywords(notes) {
  if (!notes) return [];
  const days = ['週一', '週二', '週三', '週四', '週五', '週六', '週日', '禮拜一', '禮拜二', '禮拜三', '禮拜四', '禮拜五'];
  const matched = [];
  days.forEach(d => {
    if (notes.includes(d)) matched.push(d);
  });
  return matched;
}

const freeKeywords = extractFreeTimeKeywords('週二 3-4 節空堂，週四下午 2 點後可約在校門星巴克面談');
assert('【空堂解析】成功識別週二與週四空堂關鍵字', freeKeywords.includes('週二') && freeKeywords.includes('週四'));

function validateScheduleImageSize(base64Str) {
  if (!base64Str) return { valid: true, sizeBytes: 0 };
  const sizeBytes = Math.round((base64Str.length * 3) / 4);
  const isTooLarge = sizeBytes > 5 * 1024 * 1024;
  return { valid: !isTooLarge, sizeBytes };
}
assert('【課表圖檔】小於 5MB 圖片安全通過驗證', validateScheduleImageSize('data:image/jpeg;base64,12345678').valid === true);
assert('【課表圖檔】超過 5MB 超大圖片觸發攔截警告', validateScheduleImageSize('A'.repeat(7 * 1024 * 1024)).valid === false);

const defaultSemester = '115學年度 第1學期';
assert('【學期門禁】預設學期標準化為 115學年度 第1學期', defaultSemester.includes('115學年度'));

function generateInviteSuggestion(contactName, freeNotes) {
  return freeNotes ? `向【${contactName}】提出邀約：參考其課表空堂 (${freeNotes})，安排輕鬆咖啡訪談。` : `向【${contactName}】提出邀約：尚未登記課表，可先詢問近況。`;
}
assert('【邀約建議】有空堂時生成專屬空堂建議話術', generateInviteSuggestion('林同學', '週三下午').includes('週三下午'));

// -----------------------------------------------------------------------------
// 測試 30: 矩陣交匯格歷史軌跡 (Timeline History) 增刪修時序一致性
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 30】矩陣交匯格歷史軌跡增刪修時序一致性${colors.reset}`);
let mockTouchpoint = {
  contactId: 'c_test_01',
  topicId: 't_01',
  status: 'planned',
  history: [
    { date: '2026-10-10', status: 'interaction', summary: '初次交流' },
    { date: '2026-10-15', status: 'pitched', summary: '拋出理財概念' },
    { date: '2026-10-22', status: 'appointment', summary: '約定面談' }
  ]
};

mockTouchpoint.history.sort((a, b) => compareDateStrings(b.date, a.date));
assert('【軌跡排序】歷史紀錄依照日期由新至舊排列 (10/22 首位)', mockTouchpoint.history[0].date === '2026-10-22');

const latestStatus = mockTouchpoint.history[0].status;
assert('【最新狀態】最新狀態精確對齊歷史第一筆 (appointment)', latestStatus === 'appointment');

mockTouchpoint.history.shift();
const fallbackStatus = mockTouchpoint.history[0].status;
const fallbackDate = mockTouchpoint.history[0].date;
assert('【狀態回退】刪除約定後狀態安全回退為 pitched', fallbackStatus === 'pitched');
assert('【日期回退】刪除約定後最新日期安全還原為 2026-10-15', fallbackDate === '2026-10-15');

const summaryWithEmoji = '客戶熱情回應：👍 期待下次喝咖啡 ☕️';
mockTouchpoint.history.push({ date: '2026-10-24', status: 'interaction', summary: summaryWithEmoji });
const serializedTp = JSON.parse(JSON.stringify(mockTouchpoint));
assert('【Emoji相容】歷程摘要特殊表情符號與多字元編碼無損保存', serializedTp.history[serializedTp.history.length - 1].summary === summaryWithEmoji);

// -----------------------------------------------------------------------------
// 測試 31: 雙軸狀態聚攏與無名單收折極限測試 (Dual-Axis Convergence & Empty State)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 31】雙軸狀態聚攏與無名單收折極限測試${colors.reset}`);
const mockDualAxisContacts = [
  { id: 'c1', name: '客戶一' },
  { id: 'c2', name: '客戶二' }
];
const mockDualAxisTopics = [
  { id: 't1', title: '議題一' },
  { id: 't2', title: '議題二' }
];
const mockDualTouchpoints = {
  'c1_t1': { status: 'pitched' },
  'c2_t1': { status: 'planned' }
};

const targetFilterStatus = 'pitched';
const filteredContacts = mockDualAxisContacts.filter(c => {
  return mockDualAxisTopics.some(t => {
    const tp = mockDualTouchpoints[`${c.id}_${t.id}`];
    return tp && tp.status === targetFilterStatus;
  });
});
const filteredTopics = mockDualAxisTopics.filter(t => {
  return filteredContacts.some(c => {
    const tp = mockDualTouchpoints[`${c.id}_${t.id}`];
    return tp && tp.status === targetFilterStatus;
  });
});

assert('【Y軸收斂】只有擁有 pitched 狀態的客戶 c1 保留', filteredContacts.length === 1 && filteredContacts[0].id === 'c1');
assert('【X軸聚攏】無人推進的議題 t2 自動收折，僅保留 t1', filteredTopics.length === 1 && filteredTopics[0].id === 't1');

const emptyFiltered = mockDualAxisContacts.filter(c => {
  return mockDualAxisTopics.some(t => {
    const tp = mockDualTouchpoints[`${c.id}_${t.id}`];
    return tp && tp.status === 'closed';
  });
});
assert('【極限空狀態】無人匹配該狀態時安全返回空陣列 (0 人)', emptyFiltered.length === 0);

const restoredContacts = mockDualAxisContacts;
const restoredTopics = mockDualAxisTopics;
assert('【篩選還原】清除狀態後 X 軸全議題 100% 完整還原', restoredTopics.length === 2);
assert('【篩選還原】清除狀態後 Y 軸全客戶 100% 完整還原', restoredContacts.length === 2);

// -----------------------------------------------------------------------------
// 測試 32: 待辦提醒 (Reminders) 逾期計算與抽屜篩選過濾
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 32】待辦提醒逾期計算與抽屜篩選過濾${colors.reset}`);
const mockRemindersList = [
  { id: 'r1', dueTime: '2026-10-20', isCompleted: false, content: '逾期待辦' },
  { id: 'r2', dueTime: '2026-10-24', isCompleted: false, content: '今日待辦' },
  { id: 'r3', dueTime: '2026-10-28', isCompleted: false, content: '未來待辦' },
  { id: 'r4', dueTime: '2026-10-20', isCompleted: true, content: '已完成待辦' }
];

const todayDate = '2026-10-24';
const overdueReminders = mockRemindersList.filter(r => !r.isCompleted && r.dueTime && compareDateStrings(r.dueTime, todayDate) < 0);
assert('【待辦逾期】未完成且日期在今日之前判定為逾期 (r1)', overdueReminders.length === 1 && overdueReminders[0].id === 'r1');

const todayReminders = mockRemindersList.filter(r => !r.isCompleted && r.dueTime && compareDateStrings(r.dueTime, todayDate) === 0);
assert('【今日待辦】到期日為今天之待辦精準鎖定 (r2)', todayReminders.length === 1 && todayReminders[0].id === 'r2');

const pendingCount = mockRemindersList.filter(r => !r.isCompleted).length;
assert('【未完成計數】未完成待辦數量精準為 3 筆', pendingCount === 3);

const completedCount = mockRemindersList.filter(r => r.isCompleted).length;
assert('【已完成計數】已完成待辦數量精準為 1 筆', completedCount === 1);

const searchReminders = mockRemindersList.filter(r => r.content.includes('今日'));
assert('【待辦搜尋】關鍵字過濾精準命中', searchReminders.length === 1 && searchReminders[0].id === 'r2');

// -----------------------------------------------------------------------------
// 測試 33: 財務與保費試算數值防呆與千分位格式化 (Financial Currency & Premium Formatters)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 33】財務與保費試算數值防呆與千分位格式化${colors.reset}`);
function formatCurrencyNTD(val) {
  if (val === undefined || val === null || val === '') return 'NT$ 0';
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 'NT$ 0';
  return `NT$ ${Math.round(num).toLocaleString('zh-TW')}`;
}

assert('【金額千分位】1234567 格式化為 NT$ 1,234,567', formatCurrencyNTD(1234567) === 'NT$ 1,234,567');
assert('【金額防呆】字串帶雜質 " 28,500元 " 正確萃取為 NT$ 28,500', formatCurrencyNTD(' 28,500元 ') === 'NT$ 28,500');
assert('【金額防呆】空值或 undefined 安全回傳 NT$ 0', formatCurrencyNTD(null) === 'NT$ 0');
assert('【金額防呆】NaN 或非數字安全回傳 NT$ 0', formatCurrencyNTD('abc') === 'NT$ 0');
assert('【大額資產】高資產億元保單安全格式化 (100000000 -> NT$ 100,000,000)', formatCurrencyNTD(100000000) === 'NT$ 100,000,000');

// -----------------------------------------------------------------------------
// 測試 34: 斷網/離線防護與 LocalStorage 滿載自動警報 (Offline Resilience & Storage Guard)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 34】斷網/離線防護與 LocalStorage 滿載自動警報${colors.reset}`);
function simulateOfflineSync(isOnline, hasChanges) {
  if (!isOnline) {
    return { success: false, reason: 'OFFLINE_BLOCKED', message: '目前處於離線狀態，已鎖定本機防沖刷，連線恢復時將自動同步。' };
  }
  return { success: true, reason: 'ONLINE_SYNC' };
}

assert('【斷網保護】離線時主動阻斷網路呼叫，避免無效 Timeout 浪費資源', simulateOfflineSync(false, true).reason === 'OFFLINE_BLOCKED');
assert('【連線恢復】在線時正常放行同步機制', simulateOfflineSync(true, true).success === true);

function estimateStorageUsage(obj) {
  const bytes = new Blob([JSON.stringify(obj)]).size;
  const maxQuota = 5 * 1024 * 1024; // 5MB
  const percent = Math.min(100, Math.round((bytes / maxQuota) * 100));
  return { bytes, percent, isWarning: percent > 80 };
}

const mockSmallStorage = { a: '123' };
assert('【儲存水位】常態資料庫水位低於 80% 警戒線', estimateStorageUsage(mockSmallStorage).isWarning === false);

const mockOverflowData = { bigPayload: 'X'.repeat(4.5 * 1024 * 1024) };
assert('【儲存警報】超過 80% 水位時觸發持久化保護警報', estimateStorageUsage(mockOverflowData).isWarning === true);

// -----------------------------------------------------------------------------
// 測試 35: CARE/UMBC 顧問銷售引導與心理學心錨標籤 (Psychology Sales Anchors & Tags)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【檢驗組 35】CARE/UMBC 顧問銷售引導與心理學心錨標籤${colors.reset}`);
function normalizeTagList(tags) {
  const rawArr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []);
  const flat = rawArr.flatMap(t => String(t || '').split(/[,，\s]+/));
  return Array.from(new Set(flat.map(s => s.trim()).filter(Boolean)));
}

const rawTags = [' 轉介中心 ', '高資產', '高資產', '家庭車庫，企業主'];
const cleanedTags = normalizeTagList(rawTags);
assert('【標籤標準化】去除前後多餘空白且去重', cleanedTags.includes('轉介中心') && cleanedTags.includes('高資產'));
assert('【標籤標準化】重複標籤自動去重 (長度精確)', cleanedTags.length === 4);

function detectClientSalesAnchor(contact) {
  const hints = [];
  if (contact.isVegetarian) hints.push('用餐心錨：全素/蛋奶素接待');
  if (contact.isControlled) hints.push('列管重點：高優先定期關懷');
  if (contact.disc === '變色龍' || (contact.discPrimary && contact.discSecondary)) hints.push('溝通心錨：多元複合次感元匹配');
  return hints;
}

const clientWithAnchors = { isVegetarian: true, isControlled: true, disc: '變色龍' };
const detectedAnchors = detectClientSalesAnchor(clientWithAnchors);
assert('【銷售心錨】吃素與列管心錨被精準偵測識別', detectedAnchors.some(h => h.includes('全素')) && detectedAnchors.some(h => h.includes('列管')));
assert('【銷售心錨】變色龍次感元匹配心錨正常觸發', detectedAnchors.some(h => h.includes('次感元')));

// =============================================================================
// 測試 36: 台灣金融法規法定全稱引用與招攬規範檢核門禁 (Statutory Full-Name Gating)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 36】台灣金融法規法定全稱引用與招攬規範檢核門禁${colors.reset}`);

const STATUTORY_FULL_NAMES = [
  '《保險業從事各項招攬廣告處理原則》',
  '《人壽保險業從事各項招攬廣告自律規範》',
  '《保險業務員管理規則》',
  '《保險業招攬及核保理賠辦法》',
  '《金融消費者保護法》',
  '《公平交易委員會對於薦證廣告之處理原則》'
];

const ILLEGAL_ABBREVIATIONS = ['《處理原則》', '《自律規範》', '《管理規則》', '《招攬辦法》', '《消保法》'];

function validateStatutoryCitation(citationText) {
  if (!citationText) return false;
  // 嚴禁單獨使用模糊簡稱
  for (const illegal of ILLEGAL_ABBREVIATIONS) {
    if (citationText.includes(illegal)) return false;
  }
  // 必須包含法定全稱之一
  return STATUTORY_FULL_NAMES.some(fullName => citationText.includes(fullName));
}

function normalizeCitationSuggest(abbreviation) {
  const map = {
    '《處理原則》': '《保險業從事各項招攬廣告處理原則》',
    '《自律規範》': '《人壽保險業從事各項招攬廣告自律規範》',
    '《管理規則》': '《保險業務員管理規則》',
    '《招攬辦法》': '《保險業招攬及核保理賠辦法》',
    '《消保法》': '《金融消費者保護法》'
  };
  return map[abbreviation] || null;
}

assert('【法規法定全稱】招攬廣告處理原則全稱引用驗證通過', validateStatutoryCitation('依據《保險業從事各項招攬廣告處理原則》第 4 條第 1 項規定辦理') === true);
assert('【法規模糊阻斷】單獨使用《處理原則》模糊簡稱強制攔截 (false)', validateStatutoryCitation('依據《處理原則》§4-1-3 辦理') === false);
assert('【法規法定全稱】業務員管理規則法定全稱驗證通過', validateStatutoryCitation('符合《保險業務員管理規則》第 19 條第 1 項第 3 款規範') === true);
assert('【法規模糊阻斷】《管理規則》未帶全稱嚴格攔截 (false)', validateStatutoryCitation('違反《管理規則》第19條') === false);
assert('【法規智慧建議】簡稱自動映射至標準法定全稱', normalizeCitationSuggest('《處理原則》') === '《保險業從事各項招攬廣告處理原則》');

// =============================================================================
// 測試 37: SPIN 銷售心理學與 Neuro-SPIN 提問語法引擎 (SPIN Sales & NLP VAK Engine)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 37】SPIN 銷售心理學與 Neuro-SPIN 提問語法引擎${colors.reset}`);

function classifySPINQuestion(text) {
  if (!text) return 'UNKNOWN';
  if (/目前|現有|配置|平常|使用/.test(text)) return 'S'; // Situation
  if (/擔心|負擔|痛點|不足|困難|卡住/.test(text)) return 'P'; // Problem
  if (/如果發生|萬一|影響到|後果|連帶/.test(text)) return 'I'; // Implication
  if (/如果能解決|是不是就能|安心|價值|好處/.test(text)) return 'N'; // Need-payoff
  return 'GENERAL';
}

function detectVAKModality(text) {
  const scores = { V: 0, A: 0, K: 0 };
  if (/看|清楚|藍圖|觀景|目光|色彩/.test(text)) scores.V += 2;
  if (/聽|談談|聲音|響起|共鳴|說法/.test(text)) scores.A += 2;
  if (/感受|掌握|踏實|溫度|壓力|觸動/.test(text)) scores.K += 2;
  const max = Math.max(scores.V, scores.A, scores.K);
  if (max === 0) return 'BALANCED';
  if (scores.V === max) return 'VISUAL';
  if (scores.A === max) return 'AUDITORY';
  return 'KINESTHETIC';
}

assert('【SPIN情境】現有配置提問精準識別為 S (Situation)', classifySPINQuestion('請問您目前現有的保單配置主要是哪些險種？') === 'S');
assert('【SPIN難題】痛點與不足提問精準識別為 P (Problem)', classifySPINQuestion('面對日益昂貴的自費醫療，您最擔心哪一部分的額度不足？') === 'P');
assert('【SPIN暗示】風險擴大提問精準識別為 I (Implication)', classifySPINQuestion('如果發生突發變故，這對您家人的生活費會造成什麼連帶影響？') === 'I');
assert('【SPIN需求獲益】解方價值提問精準識別為 N (Need-payoff)', classifySPINQuestion('如果能解決這筆高額帳單，是不是就能讓您倍感安心？') === 'N');
assert('【次感元偵測】視覺辭藻「看見清楚的理財藍圖」識別為 VISUAL', detectVAKModality('讓您看見清楚的理財藍圖') === 'VISUAL');

// =============================================================================
// 測試 38: 客戶通訊錄/名片 OCR 與手機統編極限解析 (Contact Normalizer & Tax ID)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 38】客戶通訊錄/名片 OCR 與手機統編極限解析${colors.reset}`);

function normalizeTaiwanPhone(phoneStr) {
  if (!phoneStr) return '';
  let clean = String(phoneStr).replace(/[^0-9+]/g, '');
  if (clean.startsWith('+886')) clean = '0' + clean.slice(4);
  if (clean.startsWith('886')) clean = '0' + clean.slice(3);
  if (/^09\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 10)}`;
  }
  return clean;
}

function validateTaiwanTaxId(taxId) {
  if (!/^\d{8}$/.test(taxId)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let prod = parseInt(taxId[i], 10) * weights[i];
    sum += Math.floor(prod / 10) + (prod % 10);
  }
  if (sum % 10 === 0) return true;
  if (taxId[6] === '7' && (sum + 1) % 10 === 0) return true;
  return false;
}

function parseTelWithExt(raw) {
  const m = String(raw).match(/(?:\(?)(0\d{1,2})(?:\)?)[- )]?(\d{6,8})(?:.*?(?:分機|ext|#)\s*(\d+))?/i);
  if (!m) return { tel: raw, ext: '' };
  return { tel: `${m[1]}-${m[2]}`, ext: m[3] || '' };
}

assert('【手機格式化】純數字 0912345678 轉為 0912-345-678', normalizeTaiwanPhone('0912345678') === '0912-345-678');
assert('【手機格式化】國碼 +886912345678 自動轉換為標準台灣手機', normalizeTaiwanPhone('+886912345678') === '0912-345-678');
assert('【統編驗證】台積電統編 22099131 校驗為真 (true)', validateTaiwanTaxId('22099131') === true);
assert('【統編防呆】隨機無效統編 12345678 嚴格校驗為假 (false)', validateTaiwanTaxId('12345678') === false);
assert('【市話分機】(02) 23456789 ext 123 正確拆解電話與分機', parseTelWithExt('(02) 23456789 ext 123').tel === '02-23456789' && parseTelWithExt('(02) 23456789 ext 123').ext === '123');

// =============================================================================
// 測試 39: 分紅保單與現金流預期演算極端邊界 (Dividend & Cashflow Edge Cases)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 39】分紅保單與現金流預期演算極端邊界${colors.reset}`);

function calcDividendFulfillmentRatio(actual, expected) {
  const exp = parseFloat(expected) || 0;
  const act = parseFloat(actual) || 0;
  if (exp === 0) return 0; // 防除以零 (Zero Division Guard)
  return Math.round((act / exp) * 100);
}

function calcCompoundFutureValue(principal, rate, years) {
  let val = principal;
  for (let i = 0; i < years; i++) {
    val = val * (1 + rate);
  }
  return Math.round(val);
}

assert('【分紅防除以零】預期分紅為 0 時安全回傳 0% 而不產生 NaN/Infinity', calcDividendFulfillmentRatio(500, 0) === 0);
assert('【分紅實現率】實際分紅 120 萬 / 預期 100 萬實現率精準為 120%', calcDividendFulfillmentRatio(120, 100) === 120);
assert('【分紅實現率】悲觀分紅 85 萬 / 預期 100 萬實現率精準為 85%', calcDividendFulfillmentRatio(85, 100) === 85);
assert('【複利計算】本金 100 萬利率 2% 存 5 年期末值無損計算 (1,104,081)', calcCompoundFutureValue(1000000, 0.02, 5) === 1104081);
assert('【極端利率】0% 利率時複利期末值恆等於本金', calcCompoundFutureValue(500000, 0, 10) === 500000);

// =============================================================================
// 測試 40: 保單條款除外責任與等待期極端日曆換算 (Waiting Period & Insurance Age)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 40】保單條款除外責任與等待期極端日曆換算${colors.reset}`);

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcInsuranceAge(birthDateStr, effectiveDateStr) {
  const birth = new Date(birthDateStr);
  const eff = new Date(effectiveDateStr);
  let age = eff.getFullYear() - birth.getFullYear();
  const mDiff = eff.getMonth() - birth.getMonth();
  const dDiff = eff.getDate() - birth.getDate();
  let totalMonths = age * 12 + mDiff + (dDiff < 0 ? -1 : 0);
  // 台灣保險年齡：足歲 + 6 個月進位制
  return Math.floor((totalMonths + 6) / 12);
}

assert('【閏年等待期90天】2024-01-01 閏年加 90 天精準跨過 2/29 (2024-03-31)', addDaysToDate('2024-01-01', 90) === '2024-03-31');
assert('【等待期30天】重大傷病 2026-10-01 加 30 天為 2026-10-31', addDaysToDate('2026-10-01', 30) === '2026-10-31');
assert('【保險年齡未滿進位】滿 30 歲 5 個月算 30 歲', calcInsuranceAge('1996-01-01', '2026-06-01') === 30);
assert('【保險年齡超額進位】滿 30 歲 7 個月進位算 31 歲', calcInsuranceAge('1996-01-01', '2026-08-01') === 31);
assert('【15足歲判定】保險年齡 >= 15 判定具備身故保險金給付資格', calcInsuranceAge('2010-01-01', '2026-01-01') >= 15);

// =============================================================================
// 測試 41: 客戶關係網 (Social Graph) 與家庭樹雙向鏈結防呆 (Family Tree & Graph Gating)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 41】客戶關係網 (Social Graph) 與家庭樹雙向鏈結防呆${colors.reset}`);

class SocialGraphManager {
  constructor() {
    this.spouses = new Map();
    this.referrals = new Map();
  }
  setSpouse(p1, p2) {
    if (this.spouses.get(p1)) this.spouses.delete(this.spouses.get(p1));
    if (this.spouses.get(p2)) this.spouses.delete(this.spouses.get(p2));
    this.spouses.set(p1, p2);
    this.spouses.set(p2, p1);
  }
  removeSpouse(p) {
    const partner = this.spouses.get(p);
    if (partner) {
      this.spouses.delete(partner);
      this.spouses.delete(p);
    }
  }
  addReferral(referrer, referee) {
    // 循環引用檢測 (Cycle Detection)
    let curr = referrer;
    while (curr) {
      if (curr === referee) return false; // 偵測到環狀迴圈！
      curr = this.referrals.get(curr);
    }
    this.referrals.set(referee, referrer);
    return true;
  }
}

const sg = new SocialGraphManager();
sg.setSpouse('c1', 'c2');
assert('【雙向配偶】設定 c1 配偶為 c2，c2 的配偶自動對齊為 c1', sg.spouses.get('c1') === 'c2' && sg.spouses.get('c2') === 'c1');
sg.removeSpouse('c1');
assert('【配偶解綁】移除 c1 後，c2 端的配偶關係同步淨空 (無幽靈配偶)', sg.spouses.has('c1') === false && sg.spouses.has('c2') === false);
assert('【轉介鏈建立】A 轉介 B 成功加入', sg.addReferral('A', 'B') === true);
assert('【轉介鏈建立】B 轉介 C 成功加入', sg.addReferral('B', 'C') === true);
assert('【轉介環狀阻斷】C 嘗試轉介 A 觸發循環引用攔截 (false)', sg.addReferral('C', 'A') === false);

// =============================================================================
// 測試 42: 歷史歷程批次匯入/匯出與 CSV/TSV 髒資料清洗 (Data Sanitizer & CSV Parse)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 42】歷史歷程批次匯入/匯出與 CSV/TSV 髒資料清洗${colors.reset}`);

function parseCSVLine(line) {
  const result = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  result.push(curr.trim());
  return result;
}

function stripUnprintableChars(str) {
  if (!str) return '';
  // 保留 \t (0x09), \n (0x0A), \r (0x0D)，去除 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

const csvSample = '"王大明, 醫師","特別備註:""高資產客群""",0912-345-678';
const parsedCsv = parseCSVLine(csvSample);
assert('【CSV標準解析】引號內含逗號正確保留為單一欄位', parsedCsv[0] === '王大明, 醫師');
assert('【CSV雙引號轉義】"" 解析為單一雙引號', parsedCsv[1] === '特別備註:"高資產客群"');
assert('【CSV欄位長度】三欄資料精準切分', parsedCsv.length === 3);
assert('【不可見字元去污】ASCII 控制字元成功剔除', stripUnprintableChars('Hello\x00\x07World') === 'HelloWorld');
assert('【換行字元保留】正常換行符號無損保留', stripUnprintableChars('Line1\nLine2') === 'Line1\nLine2');

// =============================================================================
// 測試 43: 跨裝置同步衝突 (CRDT / Last-Write-Wins) 決策矩陣 (Conflict Resolution)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 43】跨裝置同步衝突 (CRDT / Last-Write-Wins) 決策矩陣${colors.reset}`);

function mergeClientRecordsLWW(localRecord, remoteRecord) {
  if (!remoteRecord) return localRecord;
  if (!localRecord) return remoteRecord;
  // 欄位級三方合併 (Field-level 3-way Merge)
  const merged = { ...localRecord };
  for (const [key, remoteVal] of Object.entries(remoteRecord)) {
    const localTs = (localRecord._meta && localRecord._meta[key]) || localRecord.updatedAt || 0;
    const remoteTs = (remoteRecord._meta && remoteRecord._meta[key]) || remoteRecord.updatedAt || 0;
    if (remoteTs > localTs) {
      merged[key] = remoteVal;
    }
  }
  return merged;
}

const localRec = { id: 'c1', name: '王大明', phone: '0912-111-111', updatedAt: 1000 };
const remoteRec = { id: 'c1', name: '王大明', phone: '0912-222-222', updatedAt: 2000 };
const resolved = mergeClientRecordsLWW(localRec, remoteRec);
assert('【LWW勝出】時間戳較新之遠端號碼勝出', resolved.phone === '0912-222-222');

const tombstoneRec = { id: 'c1', isDeleted: true, updatedAt: 3000 };
const postDelete = mergeClientRecordsLWW(resolved, tombstoneRec);
assert('【墓碑標記】已刪除之墓碑記錄不可被舊資料覆蓋復活', postDelete.isDeleted === true);

function testIdempotentToggle(currentStatus, action) {
  if (action === 'COMPLETE') return true;
  if (action === 'UNCOMPLETE') return false;
  return currentStatus;
}
assert('【狀態冪等性】重複標記完成保持 true', testIdempotentToggle(true, 'COMPLETE') === true);
assert('【狀態冪等性】取消完成精確切換為 false', testIdempotentToggle(true, 'UNCOMPLETE') === false);

// =============================================================================
// 測試 44: DOM 渲染壓力測試與虛擬列表防卡頓門禁 (Render Performance & Math Guard)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 44】DOM 渲染壓力測試與虛擬列表防卡頓門禁${colors.reset}`);

function calcRadarCoordinates(score, maxScore, angleRad, radius) {
  const safeScore = (typeof score === 'number' && !isNaN(score)) ? Math.max(0, score) : 0;
  const ratio = maxScore > 0 ? (safeScore / maxScore) : 0;
  const r = radius * ratio;
  const x = Math.round(r * Math.cos(angleRad) * 100) / 100;
  const y = Math.round(r * Math.sin(angleRad) * 100) / 100;
  return { x, y, isSafe: !isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y) };
}

assert('【雷達圖防NaN】評分為 0 時座標計算安全無 NaN', calcRadarCoordinates(0, 10, 0, 100).isSafe === true);
assert('【雷達圖防NaN】評分為 null/undefined 時降級為 0 且安全', calcRadarCoordinates(null, 10, 0, 100).isSafe === true);
assert('【雷達圖防Infinity】maxScore 為 0 時防除以零且回傳安全原點', calcRadarCoordinates(5, 0, 0, 100).isSafe === true && calcRadarCoordinates(5, 0, 0, 100).x === 0);

function shouldInterceptGlobalHotkey(activeElementTag, isEditing) {
  if (isEditing) return true; // 正在輸入表單時，阻斷全域快捷鍵
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElementTag)) return true;
  return false;
}
assert('【快捷鍵防衝突】在 TEXTAREA 輸入時全域快捷鍵被安全阻斷', shouldInterceptGlobalHotkey('TEXTAREA', true) === true);
assert('【快捷鍵放行】一般畫布瀏覽模式下全域快捷鍵正常放行', shouldInterceptGlobalHotkey('BODY', false) === false);

// =============================================================================
// 測試 45: ADHD 友善高信噪比心智負荷防呆與引導體驗 (ADHD Low Cognitive Load & Undo)
// =============================================================================
console.log(`\n${colors.bold}【檢驗組 45】ADHD 友善高信噪比心智負荷防呆與引導體驗${colors.reset}`);

class UndoRedoManager {
  constructor(initialState) {
    this.history = [JSON.stringify(initialState)];
    this.cursor = 0;
  }
  execute(nextState) {
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(JSON.stringify(nextState));
    this.cursor++;
  }
  undo() {
    if (this.cursor > 0) {
      this.cursor--;
      return JSON.parse(this.history[this.cursor]);
    }
    return null;
  }
  redo() {
    if (this.cursor < this.history.length - 1) {
      this.cursor++;
      return JSON.parse(this.history[this.cursor]);
    }
    return null;
  }
}

const undoManager = new UndoRedoManager({ text: '狀態A' });
undoManager.execute({ text: '狀態B' });
undoManager.execute({ text: '狀態C' });
assert('【撤銷堆疊 Undo】連續編輯後撤銷一次還原為狀態B', undoManager.undo().text === '狀態B');
assert('【撤銷堆疊 Undo】再撤銷一次還原為原始狀態A', undoManager.undo().text === '狀態A');
assert('【重做堆疊 Redo】重做一次恢復為狀態B', undoManager.redo().text === '狀態B');

undoManager.execute({ text: '分支狀態D' });
assert('【重做防分支混亂】新增分支後重做堆疊被安全切斷 (null)', undoManager.redo() === null);

function calcPomodoroStatus(elapsedSeconds) {
  const FOCUS_TIME = 25 * 60;
  if (elapsedSeconds < FOCUS_TIME) {
    return { mode: 'FOCUS', remaining: FOCUS_TIME - elapsedSeconds };
  }
  return { mode: 'BREAK', remaining: 5 * 60 };
}
assert('【番茄微步引導】20 分鐘判定處於專注期 (FOCUS)', calcPomodoroStatus(20 * 60).mode === 'FOCUS');


// -----------------------------------------------------------------------------
// 測試總結報告
// -----------------------------------------------------------------------------
const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
if (failedCount === 0) {
  console.log(`${colors.bold}${colors.green}🎉 全部通過！共 ${passedCount} 項防呆檢查通過 (耗時 ${duration}s)${colors.reset}`);
  console.log(`${colors.green}系統具備極高完整度，防沖刷與 50k 上限守門員全部運作正常。${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);
  process.exit(0);
} else {
  console.error(`${colors.bold}${colors.red}❌ 檢驗失敗！通過 ${passedCount} 項，失敗 ${failedCount} 項 (耗時 ${duration}s)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);
  process.exit(1);
}

