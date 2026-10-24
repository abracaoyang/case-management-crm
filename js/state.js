// =============================================================================
// 1.5 學生課表圖片 IndexedDB 持久化引擎 (防止 LocalStorage 5MB 配額爆掉與重整遺失)
// =============================================================================
const ScheduleDB = {
  dbName: 'CRM_SCHEDULE_STORAGE_V1',
  storeName: 'schedule_images',
  version: 1,
  _db: null,

  async getDB() {
    if (this._db) return this._db;
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(this.dbName, this.version);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'contactId' });
          }
        };
        request.onsuccess = (e) => {
          this._db = e.target.result;
          resolve(this._db);
        };
        request.onerror = (e) => {
          console.warn('IndexedDB 開啟失敗，降級為純 LocalStorage 模式:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB 初始化異常:', err);
        resolve(null);
      }
    });
  },

  async saveImage(contactId, imageData) {
    if (!contactId || !imageData) return false;
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.put({ contactId, imageData, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (err) {
      return false;
    }
  },

  async getImage(contactId) {
    if (!contactId) return null;
    try {
      const db = await this.getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(contactId);
          req.onsuccess = () => {
            resolve(req.result ? req.result.imageData : null);
          };
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    } catch (err) {
      return null;
    }
  },

  async getAllImages() {
    try {
      const db = await this.getDB();
      if (!db) return {};
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => {
            const map = {};
            if (Array.isArray(req.result)) {
              req.result.forEach(item => {
                if (item && item.contactId && item.imageData) {
                  map[item.contactId] = item.imageData;
                }
              });
            }
            resolve(map);
          };
          req.onerror = () => resolve({});
        } catch (e) {
          resolve({});
        }
      });
    } catch (err) {
      return {};
    }
  },

  async deleteImage(contactId) {
    if (!contactId) return false;
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.delete(contactId);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (err) {
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.ScheduleDB = ScheduleDB;
}

// =============================================================================
// 2. 狀態管理核心 (State Management)
// =============================================================================
class AppState {
  constructor() {
    this.contacts = [];
    this.topics = [];
    this.touchpoints = {};
    this.vehicles = [];
    this.fixedMessages = [];
    this.docPrints = [];
    this.workLogs = [];
    this.reminders = [];
    this.studentSchedules = {};
    
    this.filters = {
      search: '',
      searchScope: 'ALL', // 預設綜合搜尋：'ALL' (全部), 可選 'TOPIC' (議題), 'CONTACT' (名單)
      topicManagerSearch: '', // 議題庫抽屜內快速過濾
      topicCategory: 'ALL',
      aging: 'ALL', // 'ALL', 'AGING_30', 'RECENT_7'
      touchpointStatus: 'ALL' // 'ALL', 'in_progress', 'planned', 'completed', 'paused', 'rejected', 'referral'
    };

    this.activeCell = {
      contactId: null,
      topicId: null
    };

    // 名單專屬議題聚攏篩選：'ALL' (全部預設值) | 'TOUCHED' (聚攏有記錄) | 'UNTOUCHED' (聚攏無記錄/未開議題)
    this.contactTopicFilter = {
      contactId: null,
      mode: 'ALL'
    };

    // 議題專屬名單聚攏篩選 (點擊議題頭部空白處觸發)：特定 topicId 篩選對該議題有推進紀錄之客戶名單
    this.topicFocusFilter = {
      topicId: null
    };

    // 抽屜內下一個預計提出議題之暫存選定與分類
    this.pendingNextTopicId = null;
    this.drawerNextTopicCategory = 'ALL';

    this.syncSettings = {
      enabled: false,
      apiUrl: '',
      lastSyncTime: ''
    };
    this.isSyncing = false;
    this.autoSyncTimer = null;

    // 客群分類維度：'INDIVIDUAL' (個人客戶) | 'CORPORATE' (企業客戶) | 'RECRUIT' (準增員)
    this.clientType = 'INDIVIDUAL';

    this.theme = 'light';
    // 是否隱藏今天已更新名單（折疊收起）
    this.hideUpdatedContacts = false;

    // 是否啟動 Demo 展示去識別化模式（字元頭尾保留，中間全部用Ｏ代替）
    this.isDemoMasked = false;
  }

  // 切換是否隱藏已更新名單
  toggleHideUpdatedContacts() {
    this.hideUpdatedContacts = !this.hideUpdatedContacts;
    try {
      localStorage.setItem('CONTACT_TOPIC_SYSTEM_HIDE_UPDATED_V1', this.hideUpdatedContacts ? '1' : '0');
    } catch (e) {
      console.warn('隱藏已更新名單設定持久化失敗:', e);
    }
    return this.hideUpdatedContacts;
  }

  // 切換 Demo 去識別化模式
  toggleDemoMasked() {
    this.isDemoMasked = !this.isDemoMasked;
    try {
      localStorage.setItem(STORAGE_KEYS.DEMO_MASKED, this.isDemoMasked ? 'true' : 'false');
    } catch (e) {
      console.warn('Demo 去識別化設定持久化失敗:', e);
    }
    return this.isDemoMasked;
  }

  // 取得客戶顯示姓名（依去識別化模式決定）
  getClientDisplayName(name) {
    if (this.isDemoMasked) {
      return typeof formatMaskedName === 'function' ? formatMaskedName(name) : name;
    }
    return name || '';
  }

  init() {
    // 1. 載入主題
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    this.setTheme(savedTheme);

    // 1-1. 載入客群模式 (個人客戶 vs 企業客戶 vs 準增員)
    const savedClientType = localStorage.getItem('CONTACT_TOPIC_SYSTEM_CLIENT_TYPE_V1');
    if (['CORPORATE', 'INDIVIDUAL', 'RECRUIT'].includes(savedClientType)) {
      this.clientType = savedClientType;
    }

    // 1-2. 載入隱藏已更新名單狀態
    const savedHideUpdated = localStorage.getItem('CONTACT_TOPIC_SYSTEM_HIDE_UPDATED_V1');
    if (savedHideUpdated !== null) {
      this.hideUpdatedContacts = (savedHideUpdated === '1');
    }

    // 1-3. 載入 Demo 去識別化模式
    const savedDemoMasked = localStorage.getItem(STORAGE_KEYS.DEMO_MASKED);
    if (savedDemoMasked !== null) {
      this.isDemoMasked = (savedDemoMasked === 'true');
    }

    // 2. 載入名單與已刪除黑名單 (防重新整理強行復活)
    const savedDeletedContacts = localStorage.getItem(STORAGE_KEYS.DELETED_CONTACTS);
    this.deletedContacts = savedDeletedContacts ? JSON.parse(savedDeletedContacts) : [];

    const savedContacts = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    this.contacts = savedContacts ? JSON.parse(savedContacts) : [...DEFAULT_CONTACTS];

    // 過濾已明確刪除的客戶黑名單（支援 ID 與姓名比對，確保徹底消除）
    if (this.deletedContacts.length > 0) {
      const deletedSet = new Set(this.deletedContacts);
      this.contacts = this.contacts.filter(c => !deletedSet.has(c.id) && !deletedSet.has(c.name));
    }

    // 若本機毫無聯絡人資料且從未刪除過，才帶入預設範本
    if (this.contacts.length === 0 && this.deletedContacts.length === 0) {
      this.contacts = [...DEFAULT_CONTACTS];
    }

    // 確保聯絡人之 DISC / MBTI / clientType / isRecruit 屬性健全（嚴格排除已被刪除之黑名單，禁止強行復活！）
    const deletedContactSet = new Set(this.deletedContacts || []);
    DEFAULT_CONTACTS.forEach(defContact => {
      // 防呆核心：若已被使用者刪除，絕對禁止再次自動補齊復活！
      if (deletedContactSet.has(defContact.id) || deletedContactSet.has(defContact.name)) {
        return;
      }
      const existing = this.contacts.find(c => c.name === defContact.name || c.id === defContact.id);
      if (!existing) {
        // 只有未曾刪除且為新環境時補齊
        this.contacts.push({ ...defContact });
      } else {
        if (!existing.clientType) {
          existing.clientType = defContact.clientType || 'INDIVIDUAL';
        }
        if (defContact.isRecruit && existing.isRecruit === undefined) {
          existing.isRecruit = true;
        }
      }
    });

    // 確保陳樂客戶名稱一致（將舊有陳佳瑜自動規範化為陳樂）
    const chenContact = this.contacts.find(c => c.id === 'c_007' || c.name === '陳佳瑜' || c.name === '陳樂');
    if (chenContact) {
      chenContact.name = '陳樂';
      if (!chenContact.tags) chenContact.tags = [];
      if (!chenContact.tags.includes('行照車主:陳佳瑜')) chenContact.tags.unshift('行照車主:陳佳瑜');
    }

    this.contacts.forEach(c => {
      if (!c.clientType) {
        if (c.category && (c.category.includes('企業') || c.category.includes('董座') || c.category.includes('總經理') || c.category.includes('法人'))) {
          c.clientType = 'CORPORATE';
        } else {
          c.clientType = 'INDIVIDUAL';
        }
      }
      if (c.isRecruit === undefined) {
        c.isRecruit = false;
      }
      if (c.name === '游長霖' || c.id === 'c_001') {
        if (!c.mbti) c.mbti = 'INTJ';
        if (!c.disc) c.disc = 'SC';
        c.clientType = 'INDIVIDUAL';
      }
      if (c.name === '古家蓁' || c.id === 'c_006') {
        if (!c.mbti) c.mbti = 'ISFJ';
        if (!c.disc) c.disc = 'S';
        c.clientType = 'INDIVIDUAL';
      }
      if (c.name === '羅連山') {
        c.isCorporate = true;
        c.isIndividual = true;
      }
      // 核心修復與歷史資料自癒：
      // 若客戶客群分類僅是一般受薪或任職單位（如「會計公司會計」、「科技公司工程師」），非法人/企業主/董座，
      // 且其在企業範疇議題中無任何推進紀錄，若先前被誤設為 isCorporate: true，自動糾正回 false，並確保 isIndividual 為 true
      const hasCorpCategory = !!(c.category && ((typeof CORPORATE_CATEGORY_REGEX !== 'undefined')
        ? CORPORATE_CATEGORY_REGEX.test(c.category)
        : /企業|董座|董事長|總經理|法人|企業主/.test(c.category)));

      if (c.isCorporate && c.clientType !== 'CORPORATE' && !hasCorpCategory && c.name !== '羅連山') {
        const hasCorpTouchpoint = Object.keys(this.touchpoints || {}).some(k => {
          if (!k.startsWith(`${c.id}_`)) return false;
          const topicId = k.slice(c.id.length + 1);
          const t = (this.topics || []).find(top => top.id === topicId);
          return t && t.scope === 'CORPORATE';
        });
        if (!hasCorpTouchpoint) {
          c.isCorporate = false;
          c.isIndividual = true;
        }
      }

      if (c.isCorporate === undefined) {
        c.isCorporate = (c.clientType === 'CORPORATE' || hasCorpCategory);
      }
      if (c.isIndividual === undefined) {
        c.isIndividual = (c.clientType !== 'CORPORATE' || !c.isCorporate);
      }

      // 今日新增名單資料自癒：確保 createdAt 與 lastUpdated 健全，保證計入微步與橘線
      const todayStr = getLocalTodayDateString();
      const extracted = (typeof extractDateFromContact === 'function') ? extractDateFromContact(c) : '';
      if (extracted === todayStr || (c.id && c.id.includes(todayStr.replace(/-/g, '')))) {
        if (!c.createdAt) c.createdAt = todayStr;
        if (!c.lastUpdated) c.lastUpdated = todayStr;
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(this.contacts));
    } catch (e) {
      console.warn('持久化 contacts 失敗:', e);
    }

    // 3. 載入議題
    const savedDeletedTopics = localStorage.getItem(STORAGE_KEYS.DELETED_TOPICS);
    this.deletedTopics = savedDeletedTopics ? JSON.parse(savedDeletedTopics) : [];

    const savedTopics = localStorage.getItem(STORAGE_KEYS.TOPICS);
    this.topics = savedTopics ? JSON.parse(savedTopics) : [...DEFAULT_TOPICS];

    // 過濾已明確刪除的子議題黑名單
    if (this.deletedTopics.length > 0) {
      const deletedSet = new Set(this.deletedTopics);
      this.topics = this.topics.filter(t => !deletedSet.has(t.id));
    }

    // 類別遷移相容：自動升級至新類別
    const categoryMigration = {
      '醫療防癌': '風險管控',
      '退休養老': '投資理財',
      '傳承稅務': '稅務傳承',
      '生活理財': '生活議題',
      '組織增員': '組織發展'
    };
    this.topics.forEach(t => {
      if (categoryMigration[t.category]) {
        t.category = categoryMigration[t.category];
      }
    });

    // 舊版長標題平滑升級為精準子議題名稱
    const oldTitleToNew = {
      '身心停藥與防癌一次金': { title: '癌症一次金', category: '風險管控', order: 2 },
      '自費達文西與標靶醫療缺口': { title: '實支實付', category: '風險管控', order: 5 },
      '分紅保單與穩健確定金流': { title: '月配息', category: '投資理財', order: 12 },
      '遺贈稅免稅額跨代移轉': { title: '預留稅源', category: '稅務傳承', order: 18 },
      '養生村保證金與長照缺口': { title: '財務檢視與規劃', category: '投資理財', order: 11 },
      '意定監護與安養信託雙軌防呆': { title: '意定監護', category: '稅務傳承', order: 15 },
      '勞退自提6%節稅與複利效益': { title: '海外所得免稅額', category: '投資理財', order: 13 },
      '汽機車超額責任與財損防護': { title: '車險', category: '風險管控', order: 1 }
    };

    this.topics.forEach(t => {
      if (oldTitleToNew[t.title]) {
        const update = oldTitleToNew[t.title];
        t.title = update.title;
        t.category = update.category;
        t.order = update.order;
      }
    });

    // 自動補齊新增之系統預設議題（排除已加入黑名單者）
    const deletedSet = new Set(this.deletedTopics || []);
    DEFAULT_TOPICS.forEach(defTopic => {
      if (deletedSet.has(defTopic.id)) return;
      const existing = this.topics.find(t => 
        t.id === defTopic.id || 
        (t.title === defTopic.title && (t.scope || 'INDIVIDUAL') === (defTopic.scope || 'INDIVIDUAL'))
      );
      if (!existing) {
        this.topics.push({ ...defTopic });
      } else {
        if (!existing.scriptTips && defTopic.scriptTips) existing.scriptTips = defTopic.scriptTips;
        if (defTopic.isSystem) existing.isSystem = true;
        if (!existing.order) existing.order = defTopic.order;
        if (!existing.scope) existing.scope = defTopic.scope || 'INDIVIDUAL';
        if (defTopic.category === '組織發展' && existing.category === '組織增員') {
          existing.category = '組織發展';
        }
      }
    });

    // 依據類別與名稱自動規範化未設定 scope 的議題
    this.topics.forEach(t => {
      if (!t.scope) {
        if (t.category === '組織發展' || t.category === '組織增員') {
          t.scope = 'RECRUIT';
        } else if (['企業險', '團險', '留才金牌與員工年金', '關鍵人物保險 Keyman', '企業稅務與CFC反避稅', '股東互保與退夥協議', '二代接班與股權信託'].includes(t.title)) {
          t.scope = 'CORPORATE';
        } else {
          t.scope = 'INDIVIDUAL';
        }
      }
    });

    // 專屬系統議題順序嚴格保障：聊天第 1、出國旅遊第 2，其餘個人議題從 3 開始順延
    this.normalizeTopicOrders();

    // 持久化儲存確保升級後的 topics 健全
    try {
      localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(this.topics));
    } catch (e) {
      console.warn('持久化 topics 失敗:', e);
    }

    // 4. 載入交匯紀錄
    const savedTouchpoints = localStorage.getItem(STORAGE_KEYS.TOUCHPOINTS);
    this.touchpoints = savedTouchpoints ? JSON.parse(savedTouchpoints) : { ...DEFAULT_TOUCHPOINTS };

    // 自動補齊缺漏之預設交匯紀錄（如古家蓁、企業客戶之紀錄）
    Object.keys(DEFAULT_TOUCHPOINTS).forEach(k => {
      if (!this.touchpoints[k]) {
        this.touchpoints[k] = { ...DEFAULT_TOUCHPOINTS[k] };
      }
    });

    // 4-0. 溝通重點防呆與修復保護：若最新一筆為例行關懷，但歷史曾有真實自訂重點，自動將自訂重點提拔至頂層
    Object.values(this.touchpoints).forEach(tp => {
      if (tp && tp.history && tp.history.length > 1) {
        if (tp.history[0].summary === '例行議題定聯關懷') {
          const customIdx = tp.history.findIndex((h, i) => i > 0 && h.summary && h.summary !== '例行議題定聯關懷');
          if (customIdx > 0) {
            const customItem = tp.history[customIdx];
            tp.history[0].summary = customItem.summary;
            if (customItem.nextAction && !tp.history[0].nextAction) tp.history[0].nextAction = customItem.nextAction;
            if (customItem.transcript && !tp.history[0].transcript) tp.history[0].transcript = customItem.transcript;
          }
        }
      }
    });

    // 4-1. 議題智能去重與交匯紀錄遷移保護 (避免預設議題與匯入/自建議題重名導致雙重欄位)
    const topicTitleMap = new Map();
    const duplicateTopicIdsToRemove = new Set();

    this.topics.forEach(t => {
      const key = `${t.scope || 'INDIVIDUAL'}_${t.title}`;
      if (!topicTitleMap.has(key)) {
        topicTitleMap.set(key, t);
      } else {
        const primaryTopic = topicTitleMap.get(key);
        // 檢查哪一個 topic 帶有真實推進紀錄，若重複項反而有紀錄，則將 primaryTopic 內容遷入或反轉
        const primaryHasRecords = Object.keys(this.touchpoints).some(k => k.endsWith(`_${primaryTopic.id}`) && this.touchpoints[k]?.history?.length > 0);
        const currentHasRecords = Object.keys(this.touchpoints).some(k => k.endsWith(`_${t.id}`) && this.touchpoints[k]?.history?.length > 0);

        const keeper = (!primaryHasRecords && currentHasRecords) ? t : primaryTopic;
        const loser = (keeper === t) ? primaryTopic : t;

        // 遷移 loser 的 touchpoints 到 keeper
        Object.keys(this.touchpoints).forEach(k => {
          if (k.endsWith(`_${loser.id}`)) {
            const contactId = k.slice(0, -(loser.id.length + 1));
            const newKey = `${contactId}_${keeper.id}`;
            if (!this.touchpoints[newKey] || !this.touchpoints[newKey].history || this.touchpoints[newKey].history.length === 0) {
              this.touchpoints[newKey] = this.touchpoints[k];
            }
            delete this.touchpoints[k];
          }
        });

        // 繼承說帖與系統標記
        if (!keeper.scriptTips && loser.scriptTips) keeper.scriptTips = loser.scriptTips;
        if (loser.isSystem) keeper.isSystem = true;

        duplicateTopicIdsToRemove.add(loser.id);
        topicTitleMap.set(key, keeper);
      }
    });

    if (duplicateTopicIdsToRemove.size > 0) {
      this.topics = this.topics.filter(t => !duplicateTopicIdsToRemove.has(t.id));
      this.normalizeTopicOrders();
      try {
        localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(this.topics));
        localStorage.setItem(STORAGE_KEYS.TOUCHPOINTS, JSON.stringify(this.touchpoints));
      } catch (e) {
        console.warn('持久化去重後資料失敗:', e);
      }
    }


    // 5. 載入雲端同步設定 (完全解耦，不寫死私人 URL 於開源碼)
    const savedSync = localStorage.getItem(STORAGE_KEYS.SYNC_SETTINGS);
    if (savedSync) {
      try {
        this.syncSettings = { ...this.syncSettings, ...JSON.parse(savedSync) };
      } catch (e) {
        console.error('雲端同步設定載入失敗:', e);
      }
    }

    // 6. 載入家庭車庫車籍資料 (Vehicles)
    const savedVehicles = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    this.vehicles = savedVehicles ? JSON.parse(savedVehicles) : [...DEFAULT_VEHICLES];
    if (this.vehicles.length === 0) {
      this.vehicles = [...DEFAULT_VEHICLES];
    }
    // 找出陳樂實際 contactId，確保 MDT-3323 正確綁定
    const actualChenLe = this.contacts.find(c => c.name === '陳樂' || c.name === '陳佳瑜' || c.id === 'c_007');
    const chenLeId = actualChenLe ? actualChenLe.id : 'c_007';

    // 確保預設範例車輛補齊與投保明細同步
    DEFAULT_VEHICLES.forEach(defVeh => {
      let targetContactId = defVeh.contactId;
      if (defVeh.plateNumber === 'MDT-3323' || defVeh.id === 'veh_004') {
        targetContactId = chenLeId;
      }
      const existing = this.vehicles.find(v => v.id === defVeh.id || v.plateNumber === defVeh.plateNumber);
      if (!existing) {
        this.vehicles.push({ ...defVeh, contactId: targetContactId });
      } else {
        existing.contactId = targetContactId;
        if (!existing.coverages || existing.coverages.length === 0) {
          if (defVeh.coverages && defVeh.coverages.length > 0) {
            existing.coverages = defVeh.coverages;
          }
        }
        if (!existing.insuranceCompany && defVeh.insuranceCompany) existing.insuranceCompany = defVeh.insuranceCompany;
        if (!existing.policyNumber && defVeh.policyNumber) existing.policyNumber = defVeh.policyNumber;
        if (!existing.premiumTotal && defVeh.premiumTotal) existing.premiumTotal = defVeh.premiumTotal;
        if (!existing.licenseImage && defVeh.licenseImage) existing.licenseImage = defVeh.licenseImage;
        if (defVeh.primaryDriver) existing.primaryDriver = defVeh.primaryDriver;
      }
    });

    // 自動掃描全名單車險到期狀態，2個月內到期者自動將「車險」議題轉為「預計」
    this.checkVehicleInsuranceAlerts();

    // 6. 載入常用固定訊息庫 (crm_fixed_messages，與案件系統無縫共用快取)
    const savedFixedMsgs = localStorage.getItem(STORAGE_KEYS.FIXED_MESSAGES);
    if (savedFixedMsgs) {
      try {
        const parsed = JSON.parse(savedFixedMsgs);
        this.fixedMessages = (Array.isArray(parsed) && parsed.length > 0) ? parsed : [...DEFAULT_FIXED_MESSAGES];
      } catch (e) {
        this.fixedMessages = [...DEFAULT_FIXED_MESSAGES];
      }
    } else {
      this.fixedMessages = [...DEFAULT_FIXED_MESSAGES];
      try {
        localStorage.setItem(STORAGE_KEYS.FIXED_MESSAGES, JSON.stringify(this.fixedMessages));
      } catch (e) {}
    }

    // 7. 載入文件列印資料庫 (crm_doc_prints，與案件管理系統無縫共用快取)
    const savedDocPrints = localStorage.getItem(STORAGE_KEYS.DOC_PRINTS);
    if (savedDocPrints) {
      try {
        const parsed = JSON.parse(savedDocPrints);
        let list = (Array.isArray(parsed) && parsed.length > 0) ? parsed : [...DEFAULT_DOC_PRINTS];
        // 確保 DEFAULT_DOC_PRINTS 的核心檔案（醫療前中後、財務導航地圖）都在清單中
        if (Array.isArray(DEFAULT_DOC_PRINTS)) {
          DEFAULT_DOC_PRINTS.forEach(defItem => {
            const exists = list.some(x => x.id === defItem.id || x.title === defItem.title);
            if (!exists) {
              list.push(defItem);
            }
          });
        }
        this.docPrints = list;
      } catch (e) {
        this.docPrints = [...DEFAULT_DOC_PRINTS];
      }
    } else {
      this.docPrints = [...DEFAULT_DOC_PRINTS];
    }

    // 自我修復：確保預設檔案擁有完整的 Base64 高清檔案（PDF / 圖片）
    if (Array.isArray(window.DEFAULT_DOC_PRINTS)) {
      window.DEFAULT_DOC_PRINTS.forEach(defItem => {
        const item = this.docPrints.find(x => x.id === defItem.id || x.title === defItem.title);
        if (item && (!item.fileData || item.fileData.length < 1000 || item.fileData.startsWith('[LOCAL_FILE_PRESERVED') || item.fileData.startsWith('[DEFAULT_DOC_PRESERVED'))) {
          item.fileData = defItem.fileData;
        }
      });
    }

    // 核心配額保護：將文件列印瘦身持久化，立即釋放 ~2.5MB LocalStorage 空間
    try {
      localStorage.setItem(STORAGE_KEYS.DOC_PRINTS, JSON.stringify(this.getSlimDocPrints()));
    } catch (e) {}


    // 8. 載入工作日誌資料庫 (Work Logs)
    const savedWorkLogs = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
    if (savedWorkLogs) {
      try {
        const parsed = JSON.parse(savedWorkLogs);
        this.workLogs = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        this.workLogs = [];
      }
    } else {
      this.workLogs = [];
    }

    // 9. 載入備忘提醒資料庫 (Reminders)
    const savedReminders = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    if (savedReminders) {
      try {
        const parsed = JSON.parse(savedReminders);
        this.reminders = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        this.reminders = [];
      }
    } else {
      this.reminders = [];
    }

    // 10. 載入學生/準增員課表作息資料庫 (Student Schedules)
    const savedSchedules = localStorage.getItem(STORAGE_KEYS.STUDENT_SCHEDULES);
    if (savedSchedules) {
      try {
        const parsed = JSON.parse(savedSchedules);
        this.studentSchedules = (parsed && typeof parsed === 'object') ? parsed : { ...DEFAULT_STUDENT_SCHEDULES };
      } catch (e) {
        this.studentSchedules = { ...DEFAULT_STUDENT_SCHEDULES };
      }
    } else {
      this.studentSchedules = { ...DEFAULT_STUDENT_SCHEDULES };
    }

    // 115 學年度第 1 學期文字升級 (僅針對包含 113 之字串進行微調，絕不覆蓋使用者的客製上傳圖片)
    if (this.studentSchedules && typeof this.studentSchedules === 'object') {
      let migrated = false;
      Object.keys(this.studentSchedules).forEach(cid => {
        const item = this.studentSchedules[cid];
        if (item) {
          if (item.semester && item.semester.includes('113')) {
            item.semester = item.semester.replace(/113/g, '115');
            migrated = true;
          }
          if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.includes('113') && item.imageUrl.startsWith('data:image/svg+xml')) {
            item.imageUrl = item.imageUrl.replace(/113/g, '115');
            migrated = true;
          }
        }
      });
      if (migrated) {
        try {
          localStorage.setItem(STORAGE_KEYS.STUDENT_SCHEDULES, JSON.stringify(this.studentSchedules));
        } catch (e) {
          console.warn('自動升級 115 學年度課表失敗:', e);
        }
      }
    }

    // 從 IndexedDB 水合高解析圖片 (杜絕重新整理遺失)
    if (typeof ScheduleDB !== 'undefined') {
      ScheduleDB.getAllImages().then(imageMap => {
        if (imageMap && Object.keys(imageMap).length > 0) {
          let hasHydrated = false;
          Object.keys(imageMap).forEach(cid => {
            if (this.studentSchedules[cid]) {
              const currentImg = this.studentSchedules[cid].imageUrl;
              // 若記憶體內圖片為空、為中繼標記或長度過短，以 IndexedDB 內完整圖片補齊
              if (!currentImg || currentImg === 'IDB_PERSISTED' || currentImg.length < 100) {
                this.studentSchedules[cid].imageUrl = imageMap[cid];
                hasHydrated = true;
              }
            } else {
              this.studentSchedules[cid] = {
                contactId: cid,
                semester: '115-1 (大三上)',
                freeTimeNotes: '',
                imageUrl: imageMap[cid],
                updatedAt: Date.now()
              };
              hasHydrated = true;
            }
          });
          if (hasHydrated) {
            const contactModal = document.getElementById('contactModal');
            if (contactModal && contactModal.classList.contains('open')) {
              const currentContactId = document.getElementById('editContactId')?.value;
              if (currentContactId && typeof renderContactScheduleSection === 'function') {
                renderContactScheduleSection(currentContactId);
              }
            }
          }
        }
      }).catch(err => {
        console.warn('ScheduleDB 水合圖片警告:', err);
      });
    }

    this.saveAll();
    this.cleanupCorruptedScheduleTouchpoints();
    this.updateSyncUI();
    this.updateSyncTitleStatus('pending');
    this.updateRemindersBadge();

    // 若已啟用雲端同步且有 API 網址，背景自動嘗試拉取最新試算表資料
    if (this.syncSettings.enabled && this.syncSettings.apiUrl) {
      this.pullFromCloud(false);
    }

    // 視窗切換焦點時自動靜默拉取最新雲端進度 (雙機無感互通防呆)
    if (typeof window !== 'undefined' && !window.__SYNC_FOCUS_BOUND__) {
      window.__SYNC_FOCUS_BOUND__ = true;
      window.addEventListener('focus', () => {
        if (this.syncSettings.enabled && this.syncSettings.apiUrl && !this.isSyncing) {
          this.pullFromCloud(false);
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.syncSettings.enabled && this.syncSettings.apiUrl && !this.isSyncing) {
          this.pullFromCloud(false);
        }
      });
      // 每 60 秒定期巡邏同步一次，確保背景多裝置互通
      setInterval(() => {
        if (this.syncSettings.enabled && this.syncSettings.apiUrl && !this.isSyncing) {
          this.pullFromCloud(false);
        }
      }, 60000);
    }
  }

  saveAll() {
    // 依優先順序排序的儲存清單 (核心業務資產置前，確保即使配額緊張也優先固化)
    const itemsToSave = [
      { key: STORAGE_KEYS.CONTACTS, val: this.contacts, isCritical: true },
      { key: STORAGE_KEYS.TOUCHPOINTS, val: this.touchpoints, isCritical: true },
      { key: STORAGE_KEYS.TOPICS, val: this.topics, isCritical: true },
      { key: STORAGE_KEYS.DELETED_CONTACTS, val: this.deletedContacts || [] },
      { key: STORAGE_KEYS.DELETED_TOPICS, val: this.deletedTopics || [] },
      { key: STORAGE_KEYS.VEHICLES, val: this.vehicles },
      { key: STORAGE_KEYS.FIXED_MESSAGES, val: this.fixedMessages },
      { key: STORAGE_KEYS.DOC_PRINTS, val: this.getSlimDocPrints() },
      { key: STORAGE_KEYS.WORK_LOGS, val: this.workLogs || [] },
      { key: STORAGE_KEYS.REMINDERS, val: this.reminders || [] },
      { key: STORAGE_KEYS.STUDENT_SCHEDULES, val: this.studentSchedules || {} }
    ];

    let quotaErrorOccurred = false;

    itemsToSave.forEach(item => {
      try {
        localStorage.setItem(item.key, JSON.stringify(item.val));
      } catch (err) {
        if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014 || (err.message && err.message.includes('quota')))) {
          quotaErrorOccurred = true;
          console.warn(`[儲存警戒] LocalStorage 寫入 ${item.key} 觸發配額超載:`, err);
        } else {
          console.error(`LocalStorage 寫入 ${item.key} 失敗:`, err);
        }
      }
    });

    if (quotaErrorOccurred && typeof window !== 'undefined' && Array.isArray(window.__RECENT_ERRORS__)) {
      window.__RECENT_ERRORS__.unshift({
        type: 'QUOTA_EXCEEDED_WARNING',
        message: 'LocalStorage 配額已達上限，已自動啟動分項安全保護',
        time: new Date().toLocaleTimeString('zh-TW', { hour12: false })
      });
    }

    try {
      this.updateRemindersBadge();
    } catch (_) {}
  }

  // 儲存工作日誌
  saveWorkLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(this.workLogs || []));
    } catch (e) {
      console.error('LocalStorage 儲存工作日誌失敗:', e);
    }
    this.saveWorkLogsToCloud();
    this.autoSyncTrigger();
  }

  // 將工作日誌非同步推送到 Google Sheets
  async saveWorkLogsToCloud() {
    if (!this.syncSettings.apiUrl) return;
    try {
      const resp = await fetch(this.syncSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save_work_logs',
          work_logs: this.workLogs || []
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        console.log('☁️ 工作日誌已成功同步至 Google Sheets:', (this.workLogs || []).length, '筆');
      }
    } catch (err) {
      console.warn('同步工作日誌至雲端失敗:', err);
    }
  }

  // 新增工作日誌
  addWorkLog(data) {
    const newLog = {
      id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('wlog') : `wlog_${Date.now()}`,
      date: data.date || getLocalTodayDateString(),
      subject: data.subject ? data.subject.trim() : '未命名工作日誌',
      content: data.content || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    if (!Array.isArray(this.workLogs)) this.workLogs = [];
    this.workLogs.unshift(newLog);
    this.saveWorkLogs();
    return newLog;
  }

  // 更新工作日誌
  updateWorkLog(logId, data) {
    if (!Array.isArray(this.workLogs)) return null;
    const item = this.workLogs.find(l => l.id === logId);
    if (!item) return null;
    if (data.date) item.date = data.date;
    if (data.subject !== undefined) item.subject = data.subject.trim() || '未命名工作日誌';
    if (data.content !== undefined) item.content = data.content;
    item.updatedAt = Date.now();
    this.saveWorkLogs();
    return item;
  }

  // 刪除工作日誌
  deleteWorkLog(logId) {
    if (!Array.isArray(this.workLogs)) return;
    this.workLogs = this.workLogs.filter(l => l.id !== logId);
    this.saveWorkLogs();
  }

  // 取得單筆工作日誌
  getWorkLog(logId) {
    if (!Array.isArray(this.workLogs)) return null;
    return this.workLogs.find(l => l.id === logId) || null;
  }

  // 儲存並同步固定訊息
  saveFixedMessages() {
    try {
      localStorage.setItem(STORAGE_KEYS.FIXED_MESSAGES, JSON.stringify(this.fixedMessages));
    } catch (e) {
      console.error('LocalStorage 儲存固定訊息失敗:', e);
    }
    this.saveFixedMessagesToCloud();
  }

  // 將固定訊息非同步推送到 Google Sheets
  async saveFixedMessagesToCloud() {
    if (!this.syncSettings.apiUrl) return;
    try {
      const resp = await fetch(this.syncSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save_fixed_messages',
          fixed_messages: this.fixedMessages
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        console.log('☁️ 固定訊息已成功同步至 Google Sheets:', this.fixedMessages.length, '筆');
      }
    } catch (err) {
      console.warn('同步固定訊息至雲端失敗:', err);
    }
  }

  // 取得輕量化文件列印清單（避免預設高清 PDF/圖片重複塞滿 LocalStorage 5MB 配額）
  getSlimDocPrints() {
    return (this.docPrints || []).map(item => {
      const def = (window.DEFAULT_DOC_PRINTS || []).find(d => d.id === item.id || d.title === item.title);
      // 若檔案屬於內建預設文件或超大 Base64，於 LocalStorage 僅保留中繼標記，不重複佔用 ~2.5MB
      if (def && (item.fileData === def.fileData || (item.fileData && item.fileData.length > 50000))) {
        return {
          ...item,
          fileData: `[DEFAULT_DOC_PRESERVED:${item.id}]`
        };
      }
      return item;
    });
  }

  // 儲存並同步文件列印資料
  saveDocPrints() {
    try {
      localStorage.setItem(STORAGE_KEYS.DOC_PRINTS, JSON.stringify(this.getSlimDocPrints()));
    } catch (e) {
      console.error('LocalStorage 儲存文件列印資料失敗:', e);
    }
    this.saveDocPrintsToCloud();
  }

  // 將文件列印資料非同步推送到 Google Sheets (加入防爆保護)
  async saveDocPrintsToCloud() {
    if (!this.syncSettings.apiUrl) return;
    try {
      // 避免 Base64 超過 40,000 字元引發 Google Sheets 單儲存格 50,000 上限報錯崩潰
      const safeDocPrints = (this.docPrints || []).map(item => {
        const copy = { ...item };
        if (copy.fileData && copy.fileData.length > 40000) {
          copy.fileData = `[LOCAL_FILE_PRESERVED:${copy.fileName || 'file'}]`;
        }
        return copy;
      });

      const resp = await fetch(this.syncSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save_doc_prints',
          doc_prints: safeDocPrints
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        console.log('☁️ 文件列印已成功同步至 Google Sheets:', this.docPrints.length, '筆');
      }
    } catch (err) {
      console.warn('同步文件列印至雲端失敗:', err);
    }
  }

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    const themeText = document.getElementById('themeToggleText');
    if (themeText) {
      themeText.textContent = theme === 'dark' ? '淺色模式' : '深色模式';
    }
  }

  // 檢查特定名單是否有任何議題紀錄 (有歷史紀錄之交匯點)
  hasContactAnyTouchpoint(contactId) {
    return Object.keys(this.touchpoints).some(k => {
      if (k.startsWith(`${contactId}_`)) {
        const tp = this.touchpoints[k];
        return tp && tp.history && tp.history.length > 0;
      }
      return false;
    });
  }

  // 取得特定名單已切入/開展之議題數量
  getContactTouchedCount(contactId) {
    let count = 0;
    Object.keys(this.touchpoints).forEach(k => {
      if (k.startsWith(`${contactId}_`)) {
        const tp = this.touchpoints[k];
        if (tp && tp.history && tp.history.length > 0) {
          count++;
        }
      }
    });
    return count;
  }

  // 切換名單專屬議題聚攏篩選 (三段循環: 有記錄 -> 無記錄 -> 全部預設值)
  // 防呆規則：若該客戶尚無任何議題紀錄，則不觸發篩選（無反應），避免畫面進入無議題空白且無法返回之死胡同
  toggleContactTopicFilter(contactId) {
    const hasRecords = this.hasContactAnyTouchpoint(contactId);

    // 若該客戶尚無任何議題紀錄：直接維持全部模式，不進行篩選切換
    if (!hasRecords) {
      this.resetContactTopicFilter();
      return false;
    }

    if (this.contactTopicFilter.contactId !== contactId) {
      this.contactTopicFilter = {
        contactId: contactId,
        mode: 'TOUCHED'
      };
    } else {
      if (this.contactTopicFilter.mode === 'TOUCHED') {
        this.contactTopicFilter.mode = 'UNTOUCHED';
      } else if (this.contactTopicFilter.mode === 'UNTOUCHED') {
        this.contactTopicFilter.mode = 'ALL';
        this.contactTopicFilter.contactId = null;
      } else {
        this.contactTopicFilter.mode = 'TOUCHED';
      }
    }
    return true;
  }

  // 重設名單專屬議題聚攏篩選
  resetContactTopicFilter() {
    this.contactTopicFilter = {
      contactId: null,
      mode: 'ALL'
    };
    this.topicFocusFilter = {
      topicId: null
    };
  }

  // 切換議題專屬名單聚攏篩選 (點擊議題標頭空白區域時觸發)
  toggleTopicFocusFilter(topicId) {
    if (this.topicFocusFilter.topicId === topicId) {
      this.topicFocusFilter.topicId = null;
    } else {
      this.topicFocusFilter.topicId = topicId;
      // 開啟議題過濾時，重設客戶層級之對應聚焦
      this.contactTopicFilter = {
        contactId: null,
        mode: 'ALL'
      };
    }
    return !!this.topicFocusFilter.topicId;
  }

  // 取得交匯鍵名
  getCellKey(contactId, topicId) {
    return `${contactId}_${topicId}`;
  }

  // 取得特定儲存格紀錄
  getTouchpoint(contactId, topicId) {
    return this.touchpoints[this.getCellKey(contactId, topicId)] || null;
  }

  // 嚴格正規化議題排序：聊天第一 (order:1)、出國旅遊第二 (order:2)、其餘個人議題從 3 開始順延
  normalizeTopicOrders(topicList = this.topics) {
    if (!topicList || topicList.length === 0) return topicList;

    // 智能除重：若存在重複的「聊天」議題，自動合併其交匯歷程並剔除多餘項目
    const allChatTopics = topicList.filter(t => t.title === '聊天');
    if (allChatTopics.length > 1) {
      const mainChat = allChatTopics.find(t => t.id === 't_034') || allChatTopics[0];
      const dupChats = allChatTopics.filter(t => t.id !== mainChat.id);
      
      dupChats.forEach(dup => {
        // 合併 touchpoints
        if (this.touchpoints) {
          Object.keys(this.touchpoints).forEach(tpKey => {
            if (tpKey.endsWith('_' + dup.id)) {
              const contactId = tpKey.replace('_' + dup.id, '');
              const targetKey = `${contactId}_${mainChat.id}`;
              const sourceTp = this.touchpoints[tpKey];
              const targetTp = this.touchpoints[targetKey];

              if (sourceTp && sourceTp.history && sourceTp.history.length > 0) {
                if (!targetTp) {
                  this.touchpoints[targetKey] = { ...sourceTp, topicId: mainChat.id };
                } else {
                  const existingHIds = new Set((targetTp.history || []).map(h => h.id));
                  const mergedH = [...(targetTp.history || [])];
                  (sourceTp.history || []).forEach(sh => {
                    if (!existingHIds.has(sh.id)) {
                      mergedH.push(sh);
                      existingHIds.add(sh.id);
                    }
                  });
                  mergedH.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                  const latestH = mergedH[0] || {};
                  targetTp.history = mergedH;
                  targetTp.lastDate = latestH.date || targetTp.lastDate || sourceTp.lastDate;
                  if (latestH.status) targetTp.statusKey = latestH.status;
                }
              }
              delete this.touchpoints[tpKey];
            }
          });
        }
        // 加入已刪除黑名單
        if (!this.deletedTopics) this.deletedTopics = [];
        if (!this.deletedTopics.includes(dup.id)) {
          this.deletedTopics.push(dup.id);
        }
      });

      // 從 topicList 剔除重複者
      const dupIds = new Set(dupChats.map(d => d.id));
      const filteredList = topicList.filter(t => !dupIds.has(t.id));
      topicList.length = 0;
      topicList.push(...filteredList);
    }

    const chatTopic = topicList.find(t => t.title === '聊天');
    if (chatTopic) {
      chatTopic.id = 't_034';
      chatTopic.order = 1;
      chatTopic.isSystem = true;
      chatTopic.scope = 'INDIVIDUAL';
      chatTopic.category = '生活議題';
    }

    let travelTopic = topicList.find(t => t.id === 't_travel' || t.title === '出國旅遊');
    if (!travelTopic) {
      travelTopic = {
        id: "t_travel",
        category: "生活議題",
        title: "出國旅遊",
        scriptTips: "【U】得知朋友即將出國旅遊或洽公【M】出發前常遺漏旅平險或突發疾病醫療額度不足，海外天價醫療與班機延誤常措手不及【B】協助開通旅平卡一鍵投保、規劃海外突發急難救助與不便險權益告知，回國暖心接風【C】順口關心「這次去哪一國？幾號出發回國呢？」，我幫您預先準備旅平卡與出國保障小叮嚀！",
        isActive: true,
        order: 2,
        scope: "INDIVIDUAL",
        isSystem: true
      };
      topicList.push(travelTopic);
    } else {
      travelTopic.order = 2;
      travelTopic.isSystem = true;
      travelTopic.scope = 'INDIVIDUAL';
      travelTopic.category = '生活議題';
    }

    // 將其餘個人議題依原本順序，從 order: 3 依序順延重編
    let nextOrder = 3;
    topicList
      .filter(t => (t.scope === 'INDIVIDUAL' || !t.scope) && t.title !== '聊天' && t.id !== 't_travel' && t.title !== '出國旅遊')
      .sort((a, b) => (a.order || 99) - (b.order || 99))
      .forEach(t => {
        t.order = nextOrder++;
      });

    topicList.sort((a, b) => (a.order || 99) - (b.order || 99));
    return topicList;
  }

  // 新增/更新交匯紀錄
  saveTouchpointLog(contactId, topicId, logData) {
    const key = this.getCellKey(contactId, topicId);
    let tp = this.touchpoints[key];

    if (!tp) {
      tp = {
        id: `tp_${contactId}_${topicId}`,
        contactId,
        topicId,
        latestDate: logData.date,
        status: logData.status,
        history: []
      };
      this.touchpoints[key] = tp;
    }

    tp.latestDate = logData.date;
    tp.status = logData.status;
    tp.remindClientTime = logData.remindClientTime || '';
    tp.appointmentTime = logData.appointmentTime || '';

    // 若有專屬旅遊行程與檢核資料，一併保存
    if (logData.travel !== undefined) {
      tp.travel = { ...(tp.travel || {}), ...logData.travel };
    }

    tp.history.unshift({
      id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('h') : `h_${Date.now()}`,
      date: logData.date,
      channel: logData.channel,
      status: logData.status || tp.status || 'in_progress',
      summary: logData.summary || '例行議題定聯關懷',
      nextAction: logData.nextAction || '',
      transcript: logData.transcript || '',
      remindClientTime: logData.remindClientTime || '',
      appointmentTime: logData.appointmentTime || ''
    });

    // 連動更新客戶最後定聯日（使用 compareDateStrings 防範 ASCII 45 < 47 跨格式比較陷阱）
    const contact = this.contacts.find(c => c.id === contactId);
    if (contact) {
      const isNewer = !contact.lastContactDate || 
        (typeof compareDateStrings === 'function' ? compareDateStrings(logData.date, contact.lastContactDate) >= 0 : logData.date >= contact.lastContactDate);
      if (isNewer) {
        contact.lastContactDate = (typeof normalizeStandardDate === 'function') ? (normalizeStandardDate(logData.date) || logData.date) : logData.date;
      }
    }

    this.saveAll();
    this.saveSingleTouchpointToCloud(contactId, topicId);
    this.autoSyncTrigger();
  }

  // 切換客群類型 (個人客戶 ➔ 企業客戶 ➔ 準增員 ➔ 個人客戶 三態循環)
  toggleClientType() {
    if (this.clientType === 'INDIVIDUAL') {
      this.clientType = 'CORPORATE';
    } else if (this.clientType === 'CORPORATE') {
      this.clientType = 'RECRUIT';
    } else {
      this.clientType = 'INDIVIDUAL';
    }
    try {
      localStorage.setItem('CONTACT_TOPIC_SYSTEM_CLIENT_TYPE_V1', this.clientType);
    } catch (e) {
      console.warn('客群切換設定持久化失敗:', e);
    }
    this.resetContactTopicFilter();
    this.filters.topicCategory = 'ALL';
    return this.clientType;
  }

  // 設定指定客群類型
  setClientType(type) {
    if (['INDIVIDUAL', 'CORPORATE', 'RECRUIT'].includes(type)) {
      this.clientType = type;
      try {
        localStorage.setItem('CONTACT_TOPIC_SYSTEM_CLIENT_TYPE_V1', this.clientType);
      } catch (e) {
        console.warn('客群切換設定持久化失敗:', e);
      }
      this.resetContactTopicFilter();
      this.filters.topicCategory = 'ALL';
    }
    return this.clientType;
  }

  // 新增或更新名單
  saveContact(contactData) {
    const today = getLocalTodayDateString();
    const existingIdx = contactData.id ? this.contacts.findIndex(c => c.id === contactData.id) : -1;
    if (existingIdx !== -1) {
      const oldName = this.contacts[existingIdx].name;
      this.contacts[existingIdx] = {
        ...this.contacts[existingIdx],
        ...contactData,
        isIndividual: contactData.isIndividual !== undefined ? !!contactData.isIndividual : (this.contacts[existingIdx].isIndividual !== undefined ? !!this.contacts[existingIdx].isIndividual : (this.contacts[existingIdx].clientType !== 'CORPORATE')),
        isCorporate: contactData.isCorporate !== undefined ? !!contactData.isCorporate : (this.contacts[existingIdx].isCorporate !== undefined ? !!this.contacts[existingIdx].isCorporate : (this.contacts[existingIdx].clientType === 'CORPORATE')),
        isRecruit: contactData.isRecruit !== undefined ? !!contactData.isRecruit : !!this.contacts[existingIdx].isRecruit,
        isControlled: contactData.isControlled !== undefined ? !!contactData.isControlled : !!this.contacts[existingIdx].isControlled,
        isFocused: contactData.isFocused !== undefined ? !!contactData.isFocused : !!this.contacts[existingIdx].isFocused,
        isVegetarian: !!contactData.isVegetarian,
        lastUpdated: today
      };
      // 若客戶姓名變更，級聯同步更新其待辦提醒的 contactName，杜絕過期幽靈舊名殘留
      if (contactData.name && oldName && contactData.name !== oldName) {
        if (this.reminders && this.reminders.length > 0) {
          this.reminders.forEach(r => {
            if (r.contactId === contactData.id) {
              r.contactName = contactData.name;
            }
          });
        }
      }
    } else {
      const isCorp = contactData.isCorporate !== undefined ? !!contactData.isCorporate : (this.clientType === 'CORPORATE');
      const isInd = contactData.isIndividual !== undefined ? !!contactData.isIndividual : (this.clientType === 'INDIVIDUAL' || (!isCorp && !contactData.isRecruit));
      const isRec = contactData.isRecruit !== undefined ? !!contactData.isRecruit : (this.clientType === 'RECRUIT');

      const newContact = {
        id: contactData.id || ((typeof generateTimeCodeId === 'function') ? generateTimeCodeId('c') : `c_${Date.now()}`),
        name: contactData.name,
        nickname: contactData.nickname || '',
        category: contactData.category || (isCorp ? '中小企業主' : '一般緣故'),
        clientType: contactData.clientType || (isCorp ? 'CORPORATE' : 'INDIVIDUAL'),
        isIndividual: isInd,
        isCorporate: isCorp,
        isRecruit: isRec,
        phone: contactData.phone || '',
        mbti: contactData.mbti || '',
        disc: contactData.disc || '',
        discPrimary: contactData.discPrimary || '',
        discSecondary: contactData.discSecondary || '',
        tags: contactData.tags || [],
        notes: contactData.notes || '',
        isControlled: !!contactData.isControlled,
        isFocused: !!contactData.isFocused,
        isVegetarian: !!contactData.isVegetarian,
        lastContactDate: '',
        createdAt: today,
        lastUpdated: today
      };
      // 若手動新增之姓名曾存在於已刪除黑名單中，自動自黑名單中移出（重新啟用）
      if (this.deletedContacts && this.deletedContacts.length > 0) {
        this.deletedContacts = this.deletedContacts.filter(item => item !== contactData.name);
      }
      this.contacts.unshift(newContact);

      // 自動記錄新增名單至今日工作日誌與微步足跡 (ADHD 即時正向成就回饋)
      const clientName = contactData.name || '新客戶';
      const existsLog = (this.workLogs || []).some(l => l.date === today && l.content && l.content.includes(clientName) && l.content.includes('新增客戶名單'));
      if (!existsLog) {
        const newLog = {
          id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('wlog') : `wlog_${Date.now()}`,
          date: today,
          content: `新增客戶名單【${clientName}】：建立全新客戶檔案，啟動關係微步。`,
          updatedAt: Date.now()
        };
        if (!this.workLogs) this.workLogs = [];
        this.workLogs.unshift(newLog);
        this.saveWorkLogs();
      }
    }
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 取得每日與每週的成就感微步統計 (ADHD 微步推進足跡)
  getActivityStats() {
    const todayStr = getLocalTodayDateString();
    const weekDatesSet = getCurrentWeekDateStringsSet();

    // 1. 今日與本週「新增名單數」
    let todayNewContacts = [];
    let weekNewContacts = [];

    this.contacts.forEach(c => {
      let createdDate = (typeof extractDateFromContact === 'function')
        ? extractDateFromContact(c)
        : (c.createdAt || '');

      const isCreatedToday = (createdDate && (createdDate === todayStr || getDaysDiff(createdDate) === 0)) ||
                            (c.id && getDaysDiff(c.id) === 0);

      if (isCreatedToday) {
        todayNewContacts.push(c);
      }
      if (createdDate && (weekDatesSet.has(createdDate) || getDaysDiff(createdDate) <= 7)) {
        weekNewContacts.push(c);
      }
    });

    // 2. 今日與本週「更新推進次數」
    // 包含：A. 交匯紀錄推進  B. 客戶資料維護  C. 工作日誌記錄（每一步都算數！）
    let todayProgressActions = [];
    let weekProgressActions = [];
    const todayUpdatedContactMap = new Map();

    // A. 統計交匯格紀錄 (Touchpoints)
    Object.keys(this.touchpoints).forEach(key => {
      const tp = this.touchpoints[key];
      if (tp && Array.isArray(tp.history) && tp.history.length > 0) {
        const contact = this.contacts.find(c => c.id === tp.contactId);
        const topic = this.topics.find(t => t.id === tp.topicId);
        const contactName = contact ? contact.name : '客戶';
        const topicTitle = topic ? topic.title : '議題';

        tp.history.forEach(h => {
          if (!h.date) return;
          const isTodayH = (h.date === todayStr || getDaysDiff(h.date) === 0);
          if (isTodayH) {
            todayProgressActions.push({
              contactId: tp.contactId,
              contactName,
              topicTitle,
              status: h.status || tp.status,
              summary: h.summary || '例行推進'
            });
            if (contact) {
              todayUpdatedContactMap.set(contact.id, contact);
            }
          }
          if (weekDatesSet.has(h.date) || getDaysDiff(h.date) <= 7) {
            weekProgressActions.push({
              contactId: tp.contactId,
              contactName,
              topicTitle,
              status: h.status || tp.status,
              summary: h.summary || '例行推進'
            });
          }
        });
      }
    });

    // B. 統計今日有編輯維護客戶資料（排除今日剛新增者避免重複計數）
    this.contacts.forEach(c => {
      const isCreatedToday = todayNewContacts.some(tc => tc.id === c.id);
      const isUpdatedToday = c.lastUpdated && (c.lastUpdated === todayStr || getDaysDiff(c.lastUpdated) === 0);
      if (!isCreatedToday && isUpdatedToday) {
        if (!todayUpdatedContactMap.has(c.id)) {
          todayProgressActions.push({
            contactId: c.id,
            contactName: c.name || '客戶',
            topicTitle: '基本資料維護',
            status: 'updated',
            summary: '更新客戶檔案、次感元或備忘標籤'
          });
          todayUpdatedContactMap.set(c.id, c);
        }
      }
    });

    // C. 統計今日工作日誌記錄 (排除新增客戶時自動觸發的系統日誌)
    (this.workLogs || []).forEach(log => {
      const isLogToday = log.date && (log.date === todayStr || getDaysDiff(log.date) === 0);
      if (isLogToday && log.content && !log.content.includes('新增客戶名單【')) {
        todayProgressActions.push({
          contactId: 'log',
          contactName: '工作覆盤',
          topicTitle: '工作日誌',
          status: 'logged',
          summary: log.content.length > 30 ? (log.content.slice(0, 30) + '...') : log.content
        });
      }
    });

    // 3. 本週 7 天每日趨勢數據 (用於渲染激勵趨勢圖)
    const weekDaysList = typeof getCurrentWeekDaysList === 'function' ? getCurrentWeekDaysList() : [];
    const weekDaysStats = weekDaysList.map(dayInfo => {
      // 統計該天的新增名單數
      let dayNewCount = 0;
      this.contacts.forEach(c => {
        let createdDate = (typeof extractDateFromContact === 'function')
          ? extractDateFromContact(c)
          : (c.createdAt || '');
        if (createdDate === dayInfo.date) {
          dayNewCount++;
        }
      });

      // 統計該天的推進次數
      let dayProgressCount = 0;
      Object.keys(this.touchpoints).forEach(key => {
        const tp = this.touchpoints[key];
        if (tp && Array.isArray(tp.history)) {
          tp.history.forEach(h => {
            if (h.date === dayInfo.date) {
              dayProgressCount++;
            }
          });
        }
      });

      const dayTotal = dayNewCount + dayProgressCount;
      return {
        ...dayInfo,
        newContactsCount: dayNewCount,
        progressCount: dayProgressCount,
        total: dayTotal
      };
    });

    // 計算今日與本週總累積
    const todayTotal = todayNewContacts.length + todayProgressActions.length;
    const weekTotal = weekNewContacts.length + weekProgressActions.length;

    return {
      today: {
        total: todayTotal,
        newContactsCount: todayNewContacts.length,
        progressCount: todayProgressActions.length,
        newContacts: todayNewContacts,
        progressActions: todayProgressActions,
        activeClientsCount: todayUpdatedContactMap.size,
        activeClients: Array.from(todayUpdatedContactMap.values())
      },
      week: {
        total: weekTotal,
        newContactsCount: weekNewContacts.length,
        progressCount: weekProgressActions.length,
        newContacts: weekNewContacts,
        progressActions: weekProgressActions,
        days: weekDaysStats
      }
    };
  }

  // 一鍵切換關注狀態
  toggleContactFocus(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (contact) {
      contact.isFocused = !contact.isFocused;
      this.saveAll();
      this.autoSyncTrigger();
      return contact.isFocused;
    }
    return false;
  }

  // 刪除名單 (維護永久刪除黑名單，防重整復活，實施 100% 級聯淨空防幽靈殘留)
  deleteContact(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!this.deletedContacts) this.deletedContacts = [];
    if (!this.deletedContacts.includes(contactId)) {
      this.deletedContacts.push(contactId);
    }
    if (contact && contact.name && !this.deletedContacts.includes(contact.name)) {
      this.deletedContacts.push(contact.name);
    }
    this.contacts = this.contacts.filter(c => c.id !== contactId);
    
    // 1. 清除相關交匯紀錄
    Object.keys(this.touchpoints).forEach(k => {
      if (k.startsWith(`${contactId}_`)) {
        delete this.touchpoints[k];
      }
    });

    // 2. 清除該客戶家庭車庫的所有車輛
    this.vehicles = this.vehicles.filter(v => v.contactId !== contactId);

    // 3. 級聯清除學生/準增員課表與 IndexedDB 圖片 (杜絕孤兒資料消耗儲存空間)
    if (typeof this.deleteStudentSchedule === 'function') {
      this.deleteStudentSchedule(contactId);
    } else if (this.studentSchedules && this.studentSchedules[contactId]) {
      delete this.studentSchedules[contactId];
    }

    // 4. 級聯清除該客戶的待辦提醒 (避免幽靈提醒殘留在抽屜中)
    if (this.reminders && this.reminders.length > 0) {
      this.reminders = this.reminders.filter(r => r.contactId !== contactId);
      if (typeof this.updateRemindersBadge === 'function') this.updateRemindersBadge();
    }

    // 5. 級聯解除聚焦篩選與客戶鎖定 (避免矩陣卡死在已刪除之客戶)
    if (this.contactTopicFilter && this.contactTopicFilter.contactId === contactId) {
      this.contactTopicFilter = { contactId: null, mode: 'ALL' };
    }
    if (this.activeFocus && this.activeFocus.contactId === contactId) {
      this.activeFocus = { contactId: null, isPinned: false };
    }

    this.saveAll();
    this.autoSyncTrigger();
  }

  // ===========================================================================
  // 備忘提醒待辦管理 (Reminders Management Methods)
  // ===========================================================================

  // 新增或更新備忘提醒
  saveReminder(data) {
    if (!this.reminders) this.reminders = [];
    const nowTs = Date.now();
    const contact = this.contacts.find(c => c.id === data.contactId);
    const topic = this.topics.find(t => t.id === data.topicId);

    const contactName = contact ? contact.name : (data.contactName || '未知客戶');
    const topicTitle = topic ? topic.title : (data.topicTitle || '未知議題');

    if (data.id) {
      const idx = this.reminders.findIndex(r => r.id === data.id);
      if (idx !== -1) {
        this.reminders[idx] = {
          ...this.reminders[idx],
          ...data,
          contactName,
          topicTitle,
          updatedAt: nowTs
        };
      }
    } else {
      const newRem = {
        id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('rem') : `rem_${nowTs}`,
        contactId: data.contactId,
        contactName: contactName,
        topicId: data.topicId,
        topicTitle: topicTitle,
        content: String(data.content || '').trim(),
        dueTime: data.dueTime || '',
        isCompleted: false,
        createdAt: nowTs,
        updatedAt: nowTs
      };
      this.reminders.unshift(newRem);
    }
    this.saveAll();
    this.autoSyncTrigger();
    this.updateRemindersBadge();
    return true;
  }

  // 切換備忘提醒完成狀態
  toggleReminderStatus(reminderId) {
    if (!this.reminders) return false;
    const rem = this.reminders.find(r => r.id === reminderId);
    if (rem) {
      rem.isCompleted = !rem.isCompleted;
      rem.completedAt = rem.isCompleted ? Date.now() : null;
      rem.updatedAt = Date.now();
      this.saveAll();
      this.autoSyncTrigger();
      this.updateRemindersBadge();
      return rem.isCompleted;
    }
    return false;
  }

  // 刪除備忘提醒
  deleteReminder(reminderId) {
    if (!this.reminders) return false;
    this.reminders = this.reminders.filter(r => r.id !== reminderId);
    this.saveAll();
    this.autoSyncTrigger();
    this.updateRemindersBadge();
    return true;
  }

  // 取得特定客戶特定議題的備忘提醒（未完成在前，完成在後）
  getRemindersByTopic(contactId, topicId) {
    if (!Array.isArray(this.reminders)) return [];
    return this.reminders
      .filter(r => r.contactId === contactId && r.topicId === topicId)
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return (a.dueTime || '').localeCompare(b.dueTime || '');
      });
  }

  // 取得全域備忘提醒（依篩選與搜尋）
  getAllReminders(filter = 'PENDING', search = '') {
    if (!Array.isArray(this.reminders)) return [];
    let list = [...this.reminders];

    const todayStr = getLocalTodayDateString();

    if (filter === 'PENDING') {
      list = list.filter(r => !r.isCompleted);
    } else if (filter === 'TODAY') {
      list = list.filter(r => !r.isCompleted && r.dueTime && r.dueTime.startsWith(todayStr));
    } else if (filter === 'OVERDUE') {
      const nowIso = new Date().toISOString().slice(0, 16);
      list = list.filter(r => !r.isCompleted && r.dueTime && r.dueTime < nowIso);
    } else if (filter === 'COMPLETED') {
      list = list.filter(r => r.isCompleted);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.contactName && r.contactName.toLowerCase().includes(q)) ||
        (r.topicTitle && r.topicTitle.toLowerCase().includes(q)) ||
        (r.content && r.content.toLowerCase().includes(q))
      );
    }

    // 排序：未完成者依 dueTime 由近到遠，若無時間排後面；已完成者排最後
    return list.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      const tA = a.dueTime || '9999-99-99';
      const tB = b.dueTime || '9999-99-99';
      return tA.localeCompare(tB);
    });
  }

  // 取得未完成備忘數量
  getPendingRemindersCount() {
    if (!Array.isArray(this.reminders)) return 0;
    return this.reminders.filter(r => !r.isCompleted).length;
  }

  // 更新 Header 徽章
  updateRemindersBadge() {
    const badge = document.getElementById('headerRemindersCountBadge');
    if (!badge) return;
    const count = this.getPendingRemindersCount();
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  // ===========================================================================
  // 學生/準增員課表與作息管理 (Student Schedule & Routine Methods)
  // ===========================================================================
  getStudentSchedule(contactId) {
    if (!this.studentSchedules || !contactId) return null;
    return this.studentSchedules[contactId] || null;
  }

  hasStudentSchedule(contactId) {
    const s = this.getStudentSchedule(contactId);
    return !!(s && (s.imageUrl || s.freeTimeNotes));
  }

  saveStudentSchedule(contactId, data, triggerTouchpoint = true) {
    if (!this.studentSchedules) this.studentSchedules = {};
    if (!contactId) return false;
    const now = new Date().toISOString();
    const existing = this.studentSchedules[contactId] || {};

    // 1. 若有新圖片，寫入 IndexedDB 達成真正本機高畫質長久保存
    if (data.imageUrl && typeof ScheduleDB !== 'undefined') {
      ScheduleDB.saveImage(contactId, data.imageUrl);
    } else if (existing.imageUrl && !data.imageUrl) {
      // 若更新空堂備忘未傳圖片，保留既有圖片（防呆防覆蓋）
      data.imageUrl = existing.imageUrl;
    }

    this.studentSchedules[contactId] = {
      ...existing,
      ...data,
      contactId,
      updatedAt: Date.now(),
      updatedAtStr: now
    };

    // 2. 本地雙軌持久化（LocalStorage 存 metadata 與輕量圖，IndexedDB 存完整大圖）
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_SCHEDULES, JSON.stringify(this.studentSchedules));
    } catch (e) {
      console.warn('LocalStorage 配額受限，啟用防呆中繼標記保護:', e);
      try {
        const safeMap = {};
        Object.keys(this.studentSchedules).forEach(cid => {
          const item = this.studentSchedules[cid];
          safeMap[cid] = {
            ...item,
            imageUrl: (item.imageUrl && item.imageUrl.length > 5000) ? 'IDB_PERSISTED' : (item.imageUrl || '')
          };
        });
        localStorage.setItem(STORAGE_KEYS.STUDENT_SCHEDULES, JSON.stringify(safeMap));
      } catch (err2) {
        console.error('LocalStorage 降級寫入仍失敗:', err2);
      }
    }

    // 3. 若有上傳課表或空堂，且允許觸發微步，自動記錄為今日微步足跡與工作日誌
    if (triggerTouchpoint && (data.imageUrl || data.freeTimeNotes)) {
      this.recordScheduleTouchpoint(contactId, this.studentSchedules[contactId]);
    }

    this.autoSyncTrigger();
    return true;
  }

  // 自動自癒修復：清理歷史上因 schedule 誤指派導致非組織發展/增員類議題被污染的「🎓 登錄學生作息課表」錯誤歷史
  cleanupCorruptedScheduleTouchpoints() {
    let changed = false;
    if (!this.touchpoints) return false;
    Object.keys(this.touchpoints).forEach(key => {
      const tp = this.touchpoints[key];
      if (!tp || !tp.history || tp.history.length === 0) return;
      const topic = this.topics.find(t => t.id === tp.topicId);
      // 判斷此議題是否屬於增員或組織發展議題
      const isRecruitTopic = topic && (topic.scope === 'RECRUIT' || topic.category === '組織發展');
      if (!isRecruitTopic) {
        const initialLen = tp.history.length;
        tp.history = tp.history.filter(h => !h.summary || !h.summary.includes('🎓 登錄學生作息課表'));
        if (tp.history.length !== initialLen) {
          changed = true;
          if (tp.history.length === 0) {
            delete this.touchpoints[key];
          } else {
            tp.latestDate = tp.history[0].date;
            tp.status = tp.history[0].status || 'in_progress';
            tp.remindClientTime = tp.history[0].remindClientTime || '';
            tp.appointmentTime = tp.history[0].appointmentTime || '';
          }
        }
      }
    });
    if (changed) {
      this.saveAll();
      this.autoSyncTrigger();
    }
    return changed;
  }

  // 自動記錄上傳/更新課表為今日微步推進 (Touchpoint & Work Log)
  recordScheduleTouchpoint(contactId, scheduleData) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;

    const todayStr = getLocalTodayDateString();
    const sem = scheduleData.semester || '115-1 (大三上)';
    const freeNotes = scheduleData.freeTimeNotes ? `（空堂：${scheduleData.freeTimeNotes}）` : '';
    const logSummary = `🎓 登錄學生作息課表【${sem}】${freeNotes}`;

    // 1. 自動寫入工作日誌 (Work Log) -> 確保計入今日微步足跡與本週戰報
    this.addWorkLog({
      date: todayStr,
      subject: `🎓【${contact.name}】課表作息已登錄 (${sem})`,
      content: `已成功登錄並建立【${contact.name}】每週作息課表與空堂速記：${scheduleData.freeTimeNotes || '尚未備註特別時段'}。系統已自動記錄為今日微步足跡。`
    });

    // 2. 尋找專屬增員/組織發展類之議題（嚴格限制：絕不污染非組織發展之專業議題，如「工作動力測驗」）
    let targetTopicId = null;
    const existingKeys = Object.keys(this.touchpoints).filter(k => k.startsWith(`${contactId}_`));
    if (existingKeys.length > 0) {
      for (const k of existingKeys) {
        const tp = this.touchpoints[k];
        const t = this.topics.find(top => top.id === tp.topicId);
        if (t && (t.scope === 'RECRUIT' || t.category === '組織發展')) {
          targetTopicId = t.id;
          break;
        }
      }
    }

    if (!targetTopicId) {
      const recruitTopic = this.topics.find(t => (t.id === 't_009' || t.scope === 'RECRUIT' || t.category === '組織發展') && t.isActive);
      if (recruitTopic) {
        targetTopicId = recruitTopic.id;
      }
    }

    // 只有在明確找到增員/組織發展類議題時才寫入微步定聯（狀態設為「互動」，絕不設為「約定」）
    if (targetTopicId) {
      const existingTp = this.touchpoints[this.getCellKey(contactId, targetTopicId)];
      const currentStatus = (existingTp && existingTp.status) ? existingTp.status : 'interaction';
      this.saveTouchpointLog(contactId, targetTopicId, {
        date: todayStr,
        channel: 'LINE',
        status: currentStatus,
        summary: logSummary,
        nextAction: '依據課表空堂時間安排面談邀約'
      });
    }

    // 更新客戶最後定聯日（使用 compareDateStrings 消除 ASCII 跨格式比較陷阱）
    const isNewer = !contact.lastContactDate || 
      (typeof compareDateStrings === 'function' ? compareDateStrings(todayStr, contact.lastContactDate) >= 0 : todayStr >= contact.lastContactDate);
    if (isNewer) {
      contact.lastContactDate = todayStr;
      this.saveAll();
    }

    // 即時連動更新矩陣表格與成就感微步 HUD
    if (typeof renderMatrix === 'function') {
      renderMatrix();
    }
  }

  deleteStudentSchedule(contactId) {
    if (!this.studentSchedules || !contactId) return false;
    delete this.studentSchedules[contactId];
    if (typeof ScheduleDB !== 'undefined') {
      ScheduleDB.deleteImage(contactId);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_SCHEDULES, JSON.stringify(this.studentSchedules));
    } catch (e) {
      console.warn('刪除學生課表失敗:', e);
    }
    this.autoSyncTrigger();
    return true;
  }

  // ===========================================================================
  // 車籍與家庭車庫管理 (Family Vehicle Fleet Methods)
  // ===========================================================================
  // 取得特定客戶名下的所有車輛 (支援姓名智慧關聯)
  getVehiclesByContactId(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    let matched = this.vehicles.filter(v => v.contactId === contactId);
    
    // 若以 ID 未匹配到，但客戶為「陳樂」或「陳佳瑜」，自動動態連動 MDT-3323
    if (matched.length === 0 && contact) {
      if (contact.name === '陳樂' || contact.name === '陳佳瑜') {
        const chenVeh = this.vehicles.find(v => v.plateNumber === 'MDT-3323' || v.ownerName === '陳佳瑜' || v.ownerName === '陳樂' || (v.primaryDriver && v.primaryDriver.includes('陳樂')));
        if (chenVeh) {
          chenVeh.contactId = contactId;
          matched.push(chenVeh);
          this.saveAll();
        }
      }
    }
    return matched;
  }

  // 取得特定客戶名下在 2 個月 (60天) 內到期之車輛 (或已逾期)
  getContactExpiringVehicle(contactId) {
    const vehicles = this.getVehiclesByContactId(contactId);
    if (!vehicles || vehicles.length === 0) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTime = new Date(todayStr).getTime();

    for (const v of vehicles) {
      if (v.insuranceExpiryDate) {
        const expiryTime = new Date(v.insuranceExpiryDate).getTime();
        const diffDays = Math.ceil((expiryTime - todayTime) / (1000 * 60 * 60 * 24));
        // 到期日前 2 個月 (60天內) 或已逾期
        if (diffDays <= 60) {
          return {
            vehicle: v,
            diffDays,
            isOverdue: diffDays < 0,
            plateNumber: v.plateNumber,
            insuranceExpiryDate: v.insuranceExpiryDate
          };
        }
      }
    }
    return null;
  }

  // 自動掃描全客戶車險到期狀態，2個月內到期者自動將「車險」議題轉為「預計」 (暫時停用自動觸發)
  checkVehicleInsuranceAlerts() {
    return; // 車險到期自動轉換暫時關閉，保留方法主體以供後續微調
    const autoTopic = this.topics.find(t => t.title === '車險') || this.topics.find(t => t.id === 't_008');
    const autoTopicId = autoTopic ? autoTopic.id : 't_008';
    const todayStr = new Date().toISOString().split('T')[0];
    let hasChanges = false;

    this.contacts.forEach(contact => {
      const expiringInfo = this.getContactExpiringVehicle(contact.id);
      if (expiringInfo) {
        const tpKey = `${contact.id}_${autoTopicId}`;
        let tp = this.touchpoints[tpKey];
        if (!tp) {
          tp = {
            contactId: contact.id,
            topicId: autoTopicId,
            status: 'planned',
            latestDate: todayStr,
            history: [{
              date: todayStr,
              status: 'planned',
              channel: '車險到期警示',
              summary: `車輛【${expiringInfo.vehicle.plateNumber}】將於 2 個月內到期 (${expiringInfo.vehicle.insuranceExpiryDate})，系統自動轉為預計推進續保。`
            }]
          };
          this.touchpoints[tpKey] = tp;
          hasChanges = true;
        } else if (tp.status !== 'planned') {
          tp.status = 'planned';
          if (!tp.history) tp.history = [];
          tp.history.unshift({
            date: todayStr,
            status: 'planned',
            channel: '車險到期提醒',
            summary: `車輛【${expiringInfo.vehicle.plateNumber}】將於 2 個月內到期 (${expiringInfo.vehicle.insuranceExpiryDate})，自動轉為預計。`
          });
          tp.latestDate = todayStr;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      this.saveAll();
    }
  }

  // 取得單一車輛資料
  getVehicle(vehicleId) {
    return this.vehicles.find(v => v.id === vehicleId) || null;
  }

  // 新增或更新車輛
  saveVehicle(vehicleData) {
    if (vehicleData.id) {
      const idx = this.vehicles.findIndex(v => v.id === vehicleData.id);
      if (idx !== -1) {
        this.vehicles[idx] = { ...this.vehicles[idx], ...vehicleData };
      }
    } else {
      const newVehicle = {
        id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('veh') : `veh_${Date.now()}`,
        contactId: vehicleData.contactId,
        plateNumber: vehicleData.plateNumber || '',
        vehicleType: vehicleData.vehicleType || 'CAR',
        ownerName: vehicleData.ownerName || '',
        ownerIdNumber: (vehicleData.ownerIdNumber || '').toUpperCase().trim(),
        ownerBirthDate: vehicleData.ownerBirthDate || '',
        primaryDriver: vehicleData.primaryDriver || '',
        primaryDriverRelation: vehicleData.primaryDriverRelation || '本人',
        brand: vehicleData.brand || '',
        modelType: vehicleData.modelType || '',
        displacement: vehicleData.displacement || '',
        engineNumber: vehicleData.engineNumber || '',
        vinNumber: vehicleData.vinNumber || '',
        manufactureDate: vehicleData.manufactureDate || '',
        issueDate: vehicleData.issueDate || '',
        passengerCapacity: vehicleData.passengerCapacity ? Number(vehicleData.passengerCapacity) : 5,
        licenseImage: vehicleData.licenseImage || '',
        insuranceCompany: vehicleData.insuranceCompany || '',
        policyNumber: vehicleData.policyNumber || '',
        premiumTotal: vehicleData.premiumTotal !== undefined && vehicleData.premiumTotal !== '' ? Number(vehicleData.premiumTotal) : '',
        coverages: Array.isArray(vehicleData.coverages) ? vehicleData.coverages : [],
        notes: vehicleData.notes || '',
        insuranceExpiryDate: vehicleData.insuranceExpiryDate || ''
      };
      this.vehicles.unshift(newVehicle);
    }
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 刪除車輛
  deleteVehicle(vehicleId) {
    this.vehicles = this.vehicles.filter(v => v.id !== vehicleId);
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 格式化車籍資料為台灣產險一鍵速抄文字 (符合產險報價標準規格)
  formatVehicleQuoteText(vehicle) {
    if (!vehicle) return '';
    const typeLabel = vehicle.vehicleType === 'MOTORCYCLE' ? '機車' : (vehicle.vehicleType === 'HEAVY_MOTO' ? '大型重機' : (vehicle.vehicleType === 'TRUCK' ? '小貨車' : '自用小客車'));
    const rocBirth = formatRocBirthDate(vehicle.ownerBirthDate);
    const mfg = formatManufactureDate(vehicle.manufactureDate);
    const issue = formatIssueDate(vehicle.issueDate);

    const lines = [
      `【車籍產險報價速抄資料】`,
      `車牌號碼：${vehicle.plateNumber || '未填'}`,
      `車種分類：${typeLabel}`,
      `名義車主：${vehicle.ownerName || '未填'}`,
      `車主身分證：${vehicle.ownerIdNumber || '未填'}`,
      `車主生日(民國7碼)：${rocBirth.roc7 || '未填'}（西元：${rocBirth.ad || '未填'}）`,
      `主要駕駛人：${vehicle.primaryDriver || '未填'}（與車主關係：${vehicle.primaryDriverRelation || '本人'}）`,
      `廠牌型式：${vehicle.brand || ''} ${vehicle.modelType || ''}`.trim(),
      `排氣量：${vehicle.displacement || '未填'}`,
      `出廠年月(西元)：${mfg.adDigits || '未填'}（民國：${mfg.rocSlash || '未填'}）`,
      `發照日期(民國)：${issue.rocSlash || '未填'}（西元：${issue.ad || '未填'}）`,
      `引擎號碼：${vehicle.engineNumber || '未填'}`,
      `車身號碼(VIN)：${vehicle.vinNumber || '未填'}`,
      `乘載人數：${vehicle.passengerCapacity || 5} 人`,
      `目前保險到期日：${vehicle.insuranceExpiryDate || '未填'}`,
      `規劃備註需求：${vehicle.notes || '無特殊需求'}`
    ];

    if (vehicle.coverages && vehicle.coverages.length > 0) {
      lines.push('');
      lines.push(`【目前投保險種與保額明細】`);
      if (vehicle.insuranceCompany) lines.push(`承保公司：${vehicle.insuranceCompany}`);
      if (vehicle.policyNumber) lines.push(`保單/報價單號：${vehicle.policyNumber}`);
      if (vehicle.premiumTotal) lines.push(`保費總額：${vehicle.premiumTotal} 元`);
      vehicle.coverages.forEach((cov, idx) => {
        lines.push(`${idx + 1}. [代號 ${cov.code}] ${cov.name}：${cov.insuredAmount}${cov.deductible ? ' (自負額:' + cov.deductible + ')' : ''}${cov.premium ? ' 保費:' + cov.premium + '元' : ''}`);
      });
    }

    return lines.join('\n');
  }

  // 格式化專屬保險明細速抄文字 (回答客戶保了什麼、多少保額與金額)
  formatVehicleCoverageText(vehicle) {
    if (!vehicle) return '';
    const lines = [
      `【${vehicle.plateNumber || ''} ${vehicle.brand || ''} ${vehicle.modelType || ''} 車險投保明細】`,
      `名義車主：${vehicle.ownerName || '未填'}`,
      `主要駕駛人：${vehicle.primaryDriver || vehicle.ownerName || '未填'}`
    ];
    if (vehicle.insuranceCompany) lines.push(`承保公司：${vehicle.insuranceCompany}`);
    if (vehicle.policyNumber) lines.push(`保單/報價單號：${vehicle.policyNumber}`);
    if (vehicle.insuranceExpiryDate) lines.push(`保險期間至：${vehicle.insuranceExpiryDate}`);
    if (vehicle.premiumTotal) lines.push(`保費總計：${vehicle.premiumTotal} 元`);

    lines.push('投保項目與保額明細：');
    if (vehicle.coverages && vehicle.coverages.length > 0) {
      vehicle.coverages.forEach((cov, idx) => {
        lines.push(`${idx + 1}. 【代號 ${cov.code}】${cov.name}：${cov.insuredAmount}${cov.deductible ? '（自負額：' + cov.deductible + '）' : ''}${cov.premium ? ' 保費：' + cov.premium + '元' : ''}`);
      });
    } else {
      lines.push('（目前尚未登錄詳細險種代號明細）');
    }

    return lines.join('\n');
  }

  // 重新計算客戶的最後定聯日
  recalculateContactLastContactDate(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;

    let latest = '';
    Object.keys(this.touchpoints).forEach(k => {
      if (k.startsWith(`${contactId}_`)) {
        const tp = this.touchpoints[k];
        if (tp && tp.history && tp.history.length > 0) {
          tp.history.forEach(item => {
            if (item.date) {
              const isItemNewer = !latest || 
                (typeof compareDateStrings === 'function' ? compareDateStrings(item.date, latest) > 0 : item.date > latest);
              if (isItemNewer) {
                latest = (typeof normalizeStandardDate === 'function') ? (normalizeStandardDate(item.date) || item.date) : item.date;
              }
            }
          });
        }
      }
    });
    contact.lastContactDate = latest;
  }

  // 清空單一交匯儲存格的所有紀錄 (重設為＋)
  clearTouchpoint(contactId, topicId) {
    const key = `${contactId}_${topicId}`;
    if (this.touchpoints[key]) {
      delete this.touchpoints[key];
      this.recalculateContactLastContactDate(contactId);
      this.saveAll();
      this.autoSyncTrigger();
    }
  }

  // 刪除單一歷史紀錄項目
  deleteTouchpointHistoryItem(contactId, topicId, historyIndex) {
    const key = `${contactId}_${topicId}`;
    const tp = this.touchpoints[key];
    if (!tp || !tp.history || historyIndex < 0 || historyIndex >= tp.history.length) return;

    tp.history.splice(historyIndex, 1);
    if (tp.history.length === 0) {
      delete this.touchpoints[key];
    } else {
      tp.latestDate = tp.history[0].date;
      tp.status = tp.history[0].status || 'pitched';
      tp.remindClientTime = tp.history[0].remindClientTime || '';
      tp.appointmentTime = tp.history[0].appointmentTime || '';
    }
    this.recalculateContactLastContactDate(contactId);
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 更新單一歷史紀錄項目
  updateTouchpointHistoryItem(contactId, topicId, historyIndex, updatedData) {
    const key = `${contactId}_${topicId}`;
    const tp = this.touchpoints[key];
    if (!tp || !tp.history || historyIndex < 0 || historyIndex >= tp.history.length) return false;

    const item = tp.history[historyIndex];
    if (updatedData.date !== undefined) item.date = updatedData.date;
    if (updatedData.channel !== undefined) item.channel = updatedData.channel;
    if (updatedData.status !== undefined) item.status = updatedData.status;
    if (updatedData.summary !== undefined) item.summary = updatedData.summary;
    if (updatedData.nextAction !== undefined) item.nextAction = updatedData.nextAction;
    if (updatedData.transcript !== undefined) item.transcript = updatedData.transcript;
    if (updatedData.remindClientTime !== undefined) item.remindClientTime = updatedData.remindClientTime;
    if (updatedData.appointmentTime !== undefined) item.appointmentTime = updatedData.appointmentTime;

    // 若更新的是最新一筆 (index === 0)，同步更新交匯格頂層屬性
    if (historyIndex === 0) {
      if (item.date) tp.latestDate = item.date;
      if (item.status) tp.status = item.status;
      tp.remindClientTime = item.remindClientTime || '';
      tp.appointmentTime = item.appointmentTime || '';
    }

    this.recalculateContactLastContactDate(contactId);
    this.saveAll();
    this.autoSyncTrigger();
    return true;
  }

  // 新增議題
  addTopic(topicData) {
    const newTopic = {
      id: (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('t') : `t_${Date.now()}`,
      category: topicData.category,
      title: topicData.title,
      scope: topicData.scope || (topicData.category === '組織發展' ? 'RECRUIT' : 'INDIVIDUAL'),
      scriptTips: topicData.scriptTips || '',
      isActive: true,
      order: this.topics.length + 1
    };
    this.topics.push(newTopic);
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 切換議題啟閉
  toggleTopicActive(topicId) {
    const topic = this.topics.find(t => t.id === topicId);
    if (topic) {
      topic.isActive = !topic.isActive;
      this.saveAll();
      this.autoSyncTrigger();
    }
  }

  // 刪除議題 (專屬核心模組議題保護與同名重複清理機制)
  deleteTopic(topicId) {
    const target = this.topics.find(t => t.id === topicId);
    if (!target) return false;

    // 1. 若為「出國旅遊」專屬行程模組，才禁止刪除
    if (topicId === 't_travel' || target.title === '出國旅遊') {
      alert('【系統保護提示】「出國旅遊」為專屬核心模組議題，只能由系統專屬維護，禁止刪除！');
      return false;
    }

    // 2. 檢測是否有同名重複議題（例如使用者正在刪除多出來的「聊天」）
    const duplicateTopics = this.topics.filter(t => t.title === target.title);
    if (duplicateTopics.length > 1) {
      // 存在多個同名議題：完全允許刪除當前項，並將推進紀錄自動無損合併到保留項
      const keeper = duplicateTopics.find(t => t.id !== topicId);
      if (keeper) {
        Object.keys(this.touchpoints).forEach(k => {
          if (k.endsWith(`_${topicId}`)) {
            const contactId = k.slice(0, -(topicId.length + 1));
            const newKey = `${contactId}_${keeper.id}`;
            if (!this.touchpoints[newKey] || !this.touchpoints[newKey].history || this.touchpoints[newKey].history.length === 0) {
              this.touchpoints[newKey] = this.touchpoints[k];
            }
            delete this.touchpoints[k];
          }
        });
        if (!keeper.scriptTips && target.scriptTips) keeper.scriptTips = target.scriptTips;
        keeper.isSystem = true;
      }
    } else if (target.isSystem && target.title === '聊天') {
      // 只有單一個聊天議題時的保護提醒（不可張冠李戴說成出國旅遊！）
      alert('【系統保護提示】「聊天」為日常定聯核心議題，建議保留；若不需使用可切換為「停用」！');
      return false;
    }

    if (!this.deletedTopics) this.deletedTopics = [];
    if (!this.deletedTopics.includes(topicId)) {
      this.deletedTopics.push(topicId);
    }
    this.topics = this.topics.filter(t => t.id !== topicId);
    Object.keys(this.touchpoints).forEach(k => {
      if (k.endsWith(`_${topicId}`)) {
        delete this.touchpoints[k];
      }
    });

    // 級聯清理若鎖定於該議題的聚攏篩選 (避免矩陣過濾後全空白)
    if (this.topicFocusFilter && this.topicFocusFilter.topicId === topicId) {
      this.topicFocusFilter = { topicId: null };
    }

    // 級聯清理該議題關聯之待辦提醒 (避免幽靈提醒殘留)
    if (this.reminders && this.reminders.length > 0) {
      this.reminders = this.reminders.filter(r => r.topicId !== topicId);
      if (typeof this.updateRemindersBadge === 'function') this.updateRemindersBadge();
    }

    // 重新校正剩餘議題的順序
    this.normalizeTopicOrders();
    this.saveAll();
    this.autoSyncTrigger();
    return true;
  }

  // 調整議題排序（上移 / 下移）
  moveTopic(topicId, direction, categoryScope = 'ALL') {
    let targetList = [...this.topics];
    if (categoryScope && categoryScope !== 'ALL') {
      targetList = targetList.filter(t => t.category === categoryScope);
    }
    targetList.sort((a, b) => (a.order || 99) - (b.order || 99));

    const currentIndex = targetList.findIndex(t => t.id === topicId);
    if (currentIndex === -1) return false;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= targetList.length) return false;

    // 自清單中將項目移除並插入目標位置
    const [movedItem] = targetList.splice(currentIndex, 1);
    targetList.splice(swapIndex, 0, movedItem);

    // 若為全量清單，直接覆蓋
    if (!categoryScope || categoryScope === 'ALL') {
      this.topics = targetList;
    } else {
      // 保持非當前類別項目的相對順序，重新組合 this.topics
      const otherTopics = this.topics.filter(t => t.category !== categoryScope);
      this.topics = [...targetList, ...otherTopics];
    }

    // 全局重編連號 order
    this.topics.sort((a, b) => (a.order || 99) - (b.order || 99));
    this.topics.forEach((t, idx) => {
      t.order = idx + 1;
    });

    this.saveAll();
    this.autoSyncTrigger();
    return true;
  }

  // 拖曳重排全量議題
  reorderTopics(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
    orderedIds.forEach((id, idx) => {
      const topic = this.topics.find(t => t.id === id);
      if (topic) {
        topic.order = idx + 1;
      }
    });
    this.topics.sort((a, b) => (a.order || 99) - (b.order || 99));
    this.saveAll();
    this.autoSyncTrigger();
  }

  // 重置回預設
  resetToDefault() {
    this.deletedContacts = [];
    this.deletedTopics = [];
    this.contacts = [...DEFAULT_CONTACTS];
    this.topics = [...DEFAULT_TOPICS];
    this.touchpoints = { ...DEFAULT_TOUCHPOINTS };
    this.saveAll();
  }

  // ---------------------------------------------------------------------------
  // Google Sheets 雲端連動同步方法群
  // ---------------------------------------------------------------------------

  saveSyncSettings(settings) {
    this.syncSettings = { ...this.syncSettings, ...settings };
    localStorage.setItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(this.syncSettings));
    this.updateSyncUI();
    if (this.syncSettings.enabled && this.syncSettings.apiUrl) {
      this.pushToCloud(false);
    }
  }

  updateSyncUI(status = null) {
    const dot = document.getElementById('syncStatusDot');
    const textEl = document.getElementById('syncStatusText');
    const timeEl = document.getElementById('syncLastTimeText');
    const toggle = document.getElementById('syncEnableToggle');
    const urlInput = document.getElementById('syncApiUrlInput');

    if (toggle) toggle.checked = !!this.syncSettings.enabled;
    if (urlInput) urlInput.value = this.syncSettings.apiUrl || '';

    let curStatus = status;
    if (!curStatus) {
      if (!this.syncSettings.enabled || !this.syncSettings.apiUrl) {
        curStatus = 'offline';
      } else {
        curStatus = this.isSyncing ? 'syncing' : 'online';
      }
    }

    if (dot) {
      dot.className = `status-dot ${curStatus}`;
    }

    const headerSyncBtn = document.getElementById('btnOpenSyncModal');
    if (headerSyncBtn) {
      if (curStatus === 'syncing') {
        headerSyncBtn.title = '🟡 正在與 Google Sheets 背景同步中... 請稍候再重新整理';
      } else if (curStatus === 'online') {
        headerSyncBtn.title = '🟢 Google Sheets 雲端連線正常（點擊開啟設定）';
      } else if (curStatus === 'error') {
        headerSyncBtn.title = '🔴 Google Sheets 連線異常（點擊開啟設定）';
      } else {
        headerSyncBtn.title = '⚪ 本機離線模式（點擊開啟設定）';
      }
    }

    if (textEl) {
      if (curStatus === 'online') {
        textEl.textContent = '🟢 Google Sheets 雲端連線同步中';
        textEl.style.color = 'var(--accent-primary)';
      } else if (curStatus === 'syncing') {
        textEl.textContent = '🟡 正在與 Google Sheets 同步中...';
        textEl.style.color = 'var(--accent-amber)';
      } else if (curStatus === 'error') {
        textEl.textContent = '🔴 雲端連線異常，請檢查 API 網址';
        textEl.style.color = 'var(--accent-rose)';
      } else {
        textEl.textContent = '⚪ 本機離線模式 (未啟用雲端)';
        textEl.style.color = 'var(--text-secondary)';
      }
    }

    if (timeEl) {
      timeEl.textContent = this.syncSettings.lastSyncTime 
        ? `最後同步：${this.syncSettings.lastSyncTime}` 
        : '尚未進行雲端同步';
    }
  }

  updateSyncTitleStatus(status, detail = '') {
    this.syncTitleStatus = status;
    const titleEl = document.getElementById('appBrandTitle');
    if (!titleEl) return;

    // 清除舊有的同步 class
    titleEl.classList.remove('sync-pending', 'sync-syncing', 'sync-pull-success', 'sync-pull-error', 'sync-push-error');

    if (status === 'syncing') {
      titleEl.classList.add('sync-syncing');
      titleEl.title = `定聯 x 議題 x 案件｜紀錄管理系統 (雲端同步中... ${detail || ''}) - 點擊開啟設定`;
    } else if (status === 'pull-success') {
      titleEl.classList.add('sync-pull-success');
      const timeStr = this.syncSettings.lastSyncTime ? `最後同步：${this.syncSettings.lastSyncTime}` : '同步完成';
      titleEl.title = `定聯 x 議題 x 案件｜紀錄管理系統 (🟢 雲端同步完成 - ${timeStr}) - 點擊開啟設定`;
    } else if (status === 'pull-error') {
      titleEl.classList.add('sync-pull-error');
      titleEl.title = `定聯 x 議題 x 案件｜紀錄管理系統 (🔴 雲端拉取 Pull 失敗: ${detail || '請檢查網路連線或 API 網址'}) - 點擊開啟設定`;
    } else if (status === 'push-error') {
      titleEl.classList.add('sync-push-error');
      titleEl.title = `定聯 x 議題 x 案件｜紀錄管理系統 (🟠 雲端推送 Push 失敗: ${detail || '請檢查網路連線或 API 網址'}) - 點擊開啟設定`;
    } else {
      titleEl.classList.add('sync-pending');
      titleEl.title = '定聯 x 議題 x 案件｜紀錄管理系統 (尚未進行雲端同步) - 點擊開啟設定';
    }
  }

  async testCloudConnection(url) {
    if (!url) throw new Error('請輸入 Apps Script Web App 網址');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const pingUrl = url + (url.includes('?') ? '&' : '?') + 'type=ping&_t=' + Date.now();
      const resp = await fetch(pingUrl, { signal: controller.signal });
      const data = await resp.json();
      if (data.status !== 'success') {
        throw new Error(data.message || '連線測試回應異常');
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Google Apps Script 連線逾時（超過 12 秒），可能正在冷啟動，請稍後再試');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 增量無損單筆推送 (Append-Only / Upsert)
  async saveSingleTouchpointToCloud(contactId, topicId) {
    if (!this.syncSettings.enabled || !this.syncSettings.apiUrl) return;
    const key = this.getCellKey(contactId, topicId);
    const tp = this.touchpoints[key];
    if (!tp) return;

    try {
      const payload = {
        action: 'save_single_touchpoint',
        touchpoint: tp
      };
      fetch(this.syncSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(res => res.json()).then(data => {
        if (data && data.status === 'success') {
          const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.syncSettings.lastSyncTime = now;
          this.updateSyncUI('online');
          this.updateSyncTitleStatus('pull-success');
        } else {
          this.updateSyncTitleStatus('push-error', data?.message || '單筆推送異常');
        }
      }).catch(err => {
        console.warn('單筆增量推送異常，改由全量背景佇列同步接手:', err);
        this.updateSyncTitleStatus('push-error', '單筆連線失敗');
      });
    } catch (e) {
      console.warn('單筆增量連線失敗:', e);
      this.updateSyncTitleStatus('push-error', e.message);
    }
  }

  async pushToCloud(showToastMsg = true) {
    if (!this.syncSettings.enabled || !this.syncSettings.apiUrl) {
      if (showToastMsg) showToast('請先啟用 Google Sheets 同步並輸入 API 網址', 'error');
      return;
    }

    this.isSyncing = true;
    this.updateSyncUI('syncing');
    this.updateSyncTitleStatus('syncing', '正在推送資料至雲端...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const payload = {
        action: 'sync_all',
        contacts: this.contacts,
        topics: this.topics,
        touchpoints: this.touchpoints,
        workLogs: this.workLogs || [],
        reminders: this.reminders || [],
        studentSchedules: this.studentSchedules || {}
      };

      const resp = await fetch(this.syncSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await resp.json();

      if (data.status === 'success') {
        const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.syncSettings.lastSyncTime = now;
        localStorage.setItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(this.syncSettings));
        this.updateSyncUI('online');
        this.updateSyncTitleStatus('pull-success');
        // 同步推送固定訊息庫與工作日誌庫
        this.saveFixedMessagesToCloud();
        this.saveWorkLogsToCloud();
        if (showToastMsg) showToast('已成功推送到 Google Sheets 試算表！');
      } else {
        throw new Error(data.message || '同步寫入失敗');
      }
    } catch (err) {
      console.error('Google Sheets 推送失敗:', err);
      this.updateSyncUI('error');
      this.updateSyncTitleStatus('push-error', err.message);
      const msg = err.name === 'AbortError' ? '同步逾時（超過 15 秒），雲端連線較慢，本機資料已妥善儲存。' : err.message;
      if (showToastMsg) showToast(`同步失敗: ${msg}`, 'error');
    } finally {
      clearTimeout(timeoutId);
      this.isSyncing = false;
      // 若非 error 狀態，維持 online
      const dot = document.getElementById('syncStatusDot');
      if (dot && dot.classList.contains('syncing')) {
        this.updateSyncUI('online');
      }
    }
  }

  async pullFromCloud(showToastMsg = true) {
    if (!this.syncSettings.apiUrl) {
      if (showToastMsg) showToast('請先填入 Apps Script API 網址', 'error');
      return;
    }

    this.updateSyncUI('syncing');
    this.updateSyncTitleStatus('syncing', '正在自雲端拉取最新資料...');
    try {
      const fetchUrl = this.syncSettings.apiUrl + (this.syncSettings.apiUrl.includes('?') ? '&' : '?') + 'type=all&_t=' + Date.now();
      const resp = await fetch(fetchUrl);
      const data = await resp.json();

      if (data.status === 'success') {
        const cloudContacts = Array.isArray(data.contacts) ? data.contacts : [];
        const cloudTopics = Array.isArray(data.topics) ? data.topics : [];
        const cloudTouchpoints = (data.touchpoints && typeof data.touchpoints === 'object') ? data.touchpoints : {};

        // 安全防呆：若雲端為空（0筆），但本機已有資料，避免無預警洗掉本機現有名單與紀錄
        if (cloudContacts.length === 0 && this.contacts.length > 0) {
          console.warn('雲端試算表目前為空，為保護本機資料，跳過自動覆蓋。若欲初始化雲端請執行【推送到雲端 (Push)】。');
          this.updateSyncUI('online');
          this.updateSyncTitleStatus('pull-success');
          if (showToastMsg) showToast('雲端為空試算表，保留本機資料不覆蓋。請先點「推送到雲端」初始化。', 'warning');
          return;
        }

        // 過濾已被使用者刪除的客戶黑名單，禁止雲端拉取強行復活
        const deletedContactSet = new Set(this.deletedContacts || []);
        const validCloudContacts = cloudContacts.filter(cc => !deletedContactSet.has(cc.id) && !deletedContactSet.has(cc.name));

        // 智能保留與合併：本機或預設的 MBTI/DISC/clientType/isRecruit 絕不被未升級欄位之舊雲端試算表覆蓋沖刷
        const mergedContacts = validCloudContacts.map(cloudC => {
          const localC = (this.contacts || []).find(c => c.id === cloudC.id);
          const defC = DEFAULT_CONTACTS.find(d => d.id === cloudC.id);

          let mbti = '';
          if (cloudC.mbti !== undefined && String(cloudC.mbti).trim() !== '') {
            mbti = String(cloudC.mbti).trim();
          } else {
            // 雲端尚未升級或未填寫，保留本機現有值或系統預設值
            mbti = (localC && localC.mbti) ? String(localC.mbti).trim() : (defC ? defC.mbti : '');
          }

          let disc = '';
          if (cloudC.disc !== undefined && String(cloudC.disc).trim() !== '') {
            disc = String(cloudC.disc).trim();
          } else {
            // 雲端尚未升級或未填寫，保留本機現有值或系統預設值
            disc = (localC && localC.disc) ? String(localC.disc).trim() : (defC ? defC.disc : '');
          }

          const isRecruit = cloudC.isRecruit !== undefined
            ? (cloudC.isRecruit === true || cloudC.isRecruit === 'true')
            : (localC && localC.isRecruit !== undefined ? !!localC.isRecruit : false);

          const isFocused = cloudC.isFocused !== undefined
            ? (cloudC.isFocused === true || cloudC.isFocused === 'true' || cloudC.isFocused === 'TRUE')
            : (localC && localC.isFocused !== undefined ? !!localC.isFocused : false);

          const isControlled = cloudC.isControlled !== undefined
            ? (cloudC.isControlled === true || cloudC.isControlled === 'true' || cloudC.isControlled === 'TRUE')
            : (localC && localC.isControlled !== undefined ? !!localC.isControlled : false);

          const isCorporate = cloudC.isCorporate !== undefined
            ? (cloudC.isCorporate === true || cloudC.isCorporate === 'true')
            : (localC && localC.isCorporate !== undefined ? !!localC.isCorporate : (
              (defC && defC.isCorporate !== undefined) ? !!defC.isCorporate : (
                cloudC.clientType === 'CORPORATE' || (cloudC.category && ((typeof CORPORATE_CATEGORY_REGEX !== 'undefined') ? CORPORATE_CATEGORY_REGEX.test(cloudC.category) : /企業|董座|董事長|總經理|法人|企業主/.test(cloudC.category)))
              )
            ));

          const isIndividual = cloudC.isIndividual !== undefined
            ? (cloudC.isIndividual === true || cloudC.isIndividual === 'true')
            : (localC && localC.isIndividual !== undefined ? !!localC.isIndividual : (
              (defC && defC.isIndividual !== undefined) ? !!defC.isIndividual : (
                cloudC.clientType !== 'CORPORATE' || !isCorporate
              )
            ));

          const clientType = cloudC.clientType || (localC ? localC.clientType : (defC ? defC.clientType : (
            isCorporate ? 'CORPORATE' : 'INDIVIDUAL'
          )));

          const createdAt = cloudC.createdAt || (localC ? localC.createdAt : (typeof extractDateFromContact === 'function' ? extractDateFromContact(cloudC) : ''));
          const lastUpdated = cloudC.lastUpdated || (localC ? localC.lastUpdated : createdAt);

          return {
            ...cloudC,
            mbti,
            disc,
            isRecruit,
            isFocused,
            isControlled,
            isCorporate,
            isIndividual,
            clientType,
            createdAt,
            lastUpdated
          };
        });

        // 額外防呆：保留本機新增但尚未被雲端收錄的聯絡人，並確保新名單排在最前列 (頂部)
        const localOnlyContacts = (this.contacts || []).filter(lc => !cloudContacts.some(cc => cc.id === lc.id) && !deletedContactSet.has(lc.id) && !deletedContactSet.has(lc.name));

        this.contacts = [...localOnlyContacts, ...mergedContacts];
        if (this.contacts.length === 0 && this.deletedContacts.length === 0) {
          this.contacts = [...DEFAULT_CONTACTS];
        }
        this.contacts.forEach(c => {
          if (!c.clientType) {
            if (c.category && ((typeof CORPORATE_CATEGORY_REGEX !== 'undefined') ? CORPORATE_CATEGORY_REGEX.test(c.category) : /企業|董座|董事長|總經理|法人|企業主/.test(c.category))) {
              c.clientType = 'CORPORATE';
            } else {
              c.clientType = 'INDIVIDUAL';
            }
          }
          if (c.isCorporate === undefined) {
            c.isCorporate = (c.clientType === 'CORPORATE');
          }
          if (c.isIndividual === undefined) {
            c.isIndividual = (c.clientType !== 'CORPORATE' || !c.isCorporate);
          }
          if (c.isRecruit === undefined) {
            c.isRecruit = false;
          }
          if (c.isControlled === undefined) {
            c.isControlled = false;
          }
          if (c.name === '游長霖' || c.id === 'c_001') {
            if (!c.mbti) c.mbti = 'INTJ';
            if (!c.disc) c.disc = 'SC';
          }
        });
        // 智能保留與合併議題：保留本機 21 項子議題與舊標題平滑升級，絕不被尚未同步至雲端的舊 9 項試算表覆蓋沖刷
        if (cloudTopics.length > 0) {
          const oldTitleToNew = {
            '身心停藥與防癌一次金': { title: '癌症一次金', category: '風險管控', order: 2 },
            '自費達文西與標靶醫療缺口': { title: '實支實付', category: '風險管控', order: 5 },
            '分紅保單與穩健確定金流': { title: '月配息', category: '投資理財', order: 12 },
            '遺贈稅免稅額跨代移轉': { title: '預留稅源', category: '稅務傳承', order: 18 },
            '養生村保證金與長照缺口': { title: '財務檢視與規劃', category: '投資理財', order: 11 },
            '意定監護與安養信託雙軌防呆': { title: '意定監護', category: '稅務傳承', order: 15 },
            '勞退自提6%節稅與複利效益': { title: '海外所得免稅額', category: '投資理財', order: 13 },
            '汽機車超額責任與財損防護': { title: '車險', category: '風險管控', order: 1 }
          };

          let mergedTopics = cloudTopics.map(ct => {
            const localT = (this.topics || []).find(t => t.id === ct.id);
            const defT = DEFAULT_TOPICS.find(d => d.id === ct.id);

            let title = ct.title;
            let category = ct.category;
            let order = ct.order || (localT ? localT.order : (defT ? defT.order : 99));

            if (oldTitleToNew[title]) {
              const up = oldTitleToNew[title];
              title = up.title;
              category = up.category;
              order = up.order;
            }

            if (category === '組織增員') {
              category = '組織發展';
            }

            let scope = ct.scope || (localT ? localT.scope : (defT ? defT.scope : undefined));
            if (!scope) {
              if (category === '組織發展' || category === '組織增員') {
                scope = 'RECRUIT';
              } else if (['企業險', '團險', '留才金牌與員工年金', '關鍵人物保險 Keyman', '企業稅務與CFC反避稅', '股東互保與退夥協議', '二代接班與股權信託'].includes(title)) {
                scope = 'CORPORATE';
              } else {
                scope = 'INDIVIDUAL';
              }
            }

            return {
              ...ct,
              title,
              category,
              order,
              scope
            };
          });

          // 保留本機或預設中存在、但雲端尚未擁有的子議題（排除已被使用者刪除者）
          const deletedSet = new Set(this.deletedTopics || []);
          const existingIds = new Set(mergedTopics.map(t => t.id));
          (this.topics || []).forEach(lt => {
            if (!existingIds.has(lt.id) && !deletedSet.has(lt.id)) {
              mergedTopics.push(lt);
              existingIds.add(lt.id);
            }
          });
          DEFAULT_TOPICS.forEach(dt => {
            if (!existingIds.has(dt.id) && !deletedSet.has(dt.id)) {
              mergedTopics.push({ ...dt });
              existingIds.add(dt.id);
            }
          });

          // 最終確保整體清單不含黑名單
          mergedTopics = mergedTopics.filter(t => !deletedSet.has(t.id));

          this.topics = this.normalizeTopicOrders(mergedTopics);
        }
        // 合併雲端與本機交匯紀錄：以歷史紀錄聯集 (Deep History Merge) 雙向去重，絕對不覆蓋或抹煞任何自訂溝通重點
        const mergedTouchpoints = { ...(this.touchpoints || {}) };
        for (const [key, cloudTp] of Object.entries(cloudTouchpoints || {})) {
          if (!cloudTp) continue;
          const localTp = mergedTouchpoints[key];
          if (!localTp) {
            mergedTouchpoints[key] = cloudTp;
          } else {
            // 雙向合併 history
            const historyMap = new Map();
            // 先收錄雲端
            (cloudTp.history || []).forEach(h => {
              const hKey = h.id || `${h.date}_${h.channel}_${h.summary}`;
              historyMap.set(hKey, { ...h });
            });
            // 再收錄本機（若本機有更新更完整的欄位，覆蓋或保留）
            (localTp.history || []).forEach(h => {
              const hKey = h.id || `${h.date}_${h.channel}_${h.summary}`;
              if (historyMap.has(hKey)) {
                historyMap.set(hKey, { ...historyMap.get(hKey), ...h });
              } else {
                historyMap.set(hKey, { ...h });
              }
            });

            // 依日期與ID由新到舊排序
            const mergedHistory = Array.from(historyMap.values()).sort((a, b) => {
              const dateDiff = (b.date || '').localeCompare(a.date || '');
              if (dateDiff !== 0) return dateDiff;
              return (b.id || '').localeCompare(a.id || '');
            });

            const latestH = mergedHistory[0] || {};
            mergedTouchpoints[key] = {
              ...cloudTp,
              ...localTp,
              latestDate: latestH.date || localTp.latestDate || cloudTp.latestDate,
              status: latestH.status || localTp.status || cloudTp.status || 'planned',
              remindClientTime: localTp.remindClientTime || cloudTp.remindClientTime || latestH.remindClientTime || '',
              appointmentTime: localTp.appointmentTime || cloudTp.appointmentTime || latestH.appointmentTime || '',
              history: mergedHistory
            };
          }
        }
        this.touchpoints = mergedTouchpoints;

        // 合併或載入固定訊息 (FixedMessages)
        const cloudFixedMessages = Array.isArray(data.fixed_messages) ? data.fixed_messages : [];
        if (cloudFixedMessages.length > 0) {
          this.fixedMessages = cloudFixedMessages;
          localStorage.setItem(STORAGE_KEYS.FIXED_MESSAGES, JSON.stringify(this.fixedMessages));
          if (typeof renderFixedMessagesList === 'function') {
            renderFixedMessagesList();
          }
        } else if (this.fixedMessages.length > 0) {
          // 雲端若尚未建立 FixedMessages 工作表或為空，但本地已有 10 筆資料，自動初始化推送到雲端
          this.saveFixedMessagesToCloud();
        }

        // 合併或載入文件列印 (DocPrints)
        const cloudDocPrints = Array.isArray(data.doc_prints) ? data.doc_prints : [];
        if (cloudDocPrints.length > 0) {
          this.docPrints = cloudDocPrints.map(cp => {
            // 若雲端回傳的是防止爆掉的保留標籤，或檔案過小，優先還原本地完整高清 Base64
            if (!cp.fileData || cp.fileData.startsWith('[LOCAL_FILE_PRESERVED') || cp.fileData.length < 1000) {
              const localExist = this.docPrints.find(x => x.id === cp.id || x.title === cp.title);
              if (localExist && localExist.fileData && localExist.fileData.length > 1000) {
                cp.fileData = localExist.fileData;
              } else {
                const defExist = (window.DEFAULT_DOC_PRINTS || []).find(x => x.id === cp.id || x.title === cp.title);
                if (defExist && defExist.fileData) {
                  cp.fileData = defExist.fileData;
                }
              }
            }
            return cp;
          });
          localStorage.setItem(STORAGE_KEYS.DOC_PRINTS, JSON.stringify(this.docPrints));
          if (typeof renderDocPrintsList === 'function') {
            renderDocPrintsList();
          }
        } else if (this.docPrints.length > 0) {
          // 雲端若尚未建立 DocPrints 工作表或為空，但本地已有資料，自動初始化推送到雲端
          this.saveDocPrintsToCloud();
        }

        // 合併或載入工作日誌 (WorkLogs)
        const cloudWorkLogs = Array.isArray(data.work_logs) ? data.work_logs : [];
        if (cloudWorkLogs.length > 0) {
          // 智慧合併：以日誌 ID 為基準，比對 updatedAt 決定保留較新者；若本機有尚未上傳的新日誌，予以保留
          const localMap = new Map((this.workLogs || []).map(l => [l.id, l]));
          cloudWorkLogs.forEach(cLog => {
            const lLog = localMap.get(cLog.id);
            if (!lLog) {
              localMap.set(cLog.id, cLog);
            } else {
              const cTime = Number(cLog.updatedAt) || 0;
              const lTime = Number(lLog.updatedAt) || 0;
              if (cTime >= lTime) {
                localMap.set(cLog.id, { ...lLog, ...cLog });
              }
            }
          });
          // 轉為陣列並按日期降序排列
          this.workLogs = Array.from(localMap.values()).sort((a, b) => {
            const dateCmp = (b.date || '').localeCompare(a.date || '');
            if (dateCmp !== 0) return dateCmp;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
          });
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(this.workLogs));
          if (typeof renderWorkLogList === 'function') {
            renderWorkLogList();
          }
        } else if ((this.workLogs || []).length > 0) {
          // 雲端若尚未建立 WorkLogs 工作表或為空，但本地已有日誌，自動初始化推送到雲端
          this.saveWorkLogsToCloud();
        }

        // 合併或載入備忘提醒 (Reminders)
        const cloudReminders = Array.isArray(data.reminders) ? data.reminders : [];
        if (cloudReminders.length > 0) {
          const localMap = new Map((this.reminders || []).map(r => [r.id, r]));
          cloudReminders.forEach(cRem => {
            const lRem = localMap.get(cRem.id);
            if (!lRem) {
              localMap.set(cRem.id, cRem);
            } else {
              const cTime = Number(cRem.updatedAt) || 0;
              const lTime = Number(lRem.updatedAt) || 0;
              if (cTime >= lTime) {
                localMap.set(cRem.id, { ...lRem, ...cRem });
              }
            }
          });
          this.reminders = Array.from(localMap.values()).sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return (a.dueTime || '').localeCompare(b.dueTime || '');
          });
          localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(this.reminders));
          this.updateRemindersBadge();
          if (typeof renderRemindersModalList === 'function') {
            renderRemindersModalList();
          }
        }

        // 合併或載入學生/準增員課表作息資料庫 (Student Schedules)
        const cloudSchedules = (data.studentSchedules && typeof data.studentSchedules === 'object') ? data.studentSchedules : null;
        if (cloudSchedules && Object.keys(cloudSchedules).length > 0) {
          if (!this.studentSchedules) this.studentSchedules = {};
          Object.keys(cloudSchedules).forEach(cid => {
            const cSched = cloudSchedules[cid];
            const lSched = this.studentSchedules[cid];
            if (!lSched) {
              this.studentSchedules[cid] = cSched;
              if (cSched.imageUrl && typeof ScheduleDB !== 'undefined') {
                ScheduleDB.saveImage(cid, cSched.imageUrl);
              }
            } else {
              // 關鍵防呆保護：若雲端回傳的圖片為空、被截斷或為標籤，絕對不覆蓋本機已有之高解析度圖片！
              const preserveLocalImg = lSched.imageUrl && (!cSched.imageUrl || cSched.imageUrl.length < 100);
              const cTime = Number(cSched.updatedAt) || 0;
              const lTime = Number(lSched.updatedAt) || 0;
              if (cTime >= lTime) {
                const finalImg = preserveLocalImg ? lSched.imageUrl : (cSched.imageUrl || lSched.imageUrl);
                this.studentSchedules[cid] = {
                  ...lSched,
                  ...cSched,
                  imageUrl: finalImg
                };
                if (finalImg && typeof ScheduleDB !== 'undefined') {
                  ScheduleDB.saveImage(cid, finalImg);
                }
              } else if (preserveLocalImg) {
                this.studentSchedules[cid].imageUrl = lSched.imageUrl;
              }
            }
          });
          try {
            localStorage.setItem(STORAGE_KEYS.STUDENT_SCHEDULES, JSON.stringify(this.studentSchedules));
          } catch (e) {
            console.warn('雲端合併後 LocalStorage 儲存課表受限:', e);
          }
        }

        const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.syncSettings.lastSyncTime = now;
        this.saveAll();
        localStorage.setItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(this.syncSettings));
        this.updateSyncUI('online');
        this.updateSyncTitleStatus('pull-success');
        renderMatrix();
        if (showToastMsg) showToast('已自 Google Sheets 成功拉取最新資料！');
      } else {
        throw new Error(data.message || '讀取試算表失敗');
      }
    } catch (err) {
      console.error('Google Sheets 拉取失敗:', err);
      this.updateSyncUI('error');
      const msg = err.name === 'AbortError' ? '拉取逾時（超過 15 秒），雲端連線較慢。' : err.message;
      this.updateSyncTitleStatus('pull-error', msg);
      if (showToastMsg) showToast(`拉取失敗: ${msg}`, 'error');
    } finally {
      this.isSyncing = false;
      const dot = document.getElementById('syncStatusDot');
      if (dot && dot.classList.contains('syncing')) {
        this.updateSyncUI('online');
      }
    }
  }

  // 雙向智能同步：先 pull 雲端最新進度進行智慧無損合併，隨後立即 push 將最新合併成果回傳雲端
  async twoWaySync(showToastMsg = true) {
    if (!this.syncSettings.enabled || !this.syncSettings.apiUrl) {
      if (showToastMsg) showToast('請先啟用 Google Sheets 同步並輸入 API 網址', 'error');
      return;
    }
    this.updateSyncUI('syncing');
    this.updateSyncTitleStatus('syncing', '正在進行雙向雲端同步...');
    try {
      if (showToastMsg) showToast('正在進行雙向雲端同步：拉取最新雲端進度...', 'info');
      await this.pullFromCloud(false);
      await this.pushToCloud(false);
      this.updateSyncUI('online');
      this.updateSyncTitleStatus('pull-success');
      if (showToastMsg) showToast('🎉 雙向同步完成！本機與 Google Sheets 資料已 100% 互通最新！');
    } catch (err) {
      console.error('雙向同步失敗:', err);
      this.updateSyncUI('error');
      if (this.syncTitleStatus !== 'pull-error' && this.syncTitleStatus !== 'push-error') {
        this.updateSyncTitleStatus('pull-error', err.message);
      }
      if (showToastMsg) showToast(`雙向同步失敗: ${err.message}`, 'error');
    }
  }

  autoSyncTrigger() {
    if (this.syncSettings.enabled && this.syncSettings.apiUrl) {
      if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = setTimeout(async () => {
        try {
          await this.pushToCloud(false);
        } catch (e) {
          console.warn('背景自動推送遭遇異常，3秒後自動重試一次:', e);
          setTimeout(() => {
            if (this.syncSettings.enabled && this.syncSettings.apiUrl && !this.isSyncing) {
              this.pushToCloud(false);
            }
          }, 3000);
        }
      }, 600);
    }
  }
}

const state = new AppState();
if (typeof window !== 'undefined') {
  window.state = state;
}

// =============================================================================
// 前置作業一與二：全系統飛行黑盒子與一鍵體檢診斷接口
// =============================================================================
if (typeof window !== 'undefined') {
  // 前置作業二：環形例外緩存器 (Ring Buffer Logger，最多保留最新 20 筆未捕獲錯誤)
  window.__RECENT_ERRORS__ = [];
  const MAX_ERRORS = 20;

  window.addEventListener('error', (event) => {
    try {
      window.__RECENT_ERRORS__.unshift({
        type: 'UNCAUGHT_ERROR',
        message: event.message || String(event),
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        time: new Date().toLocaleTimeString('zh-TW', { hour12: false })
      });
      if (window.__RECENT_ERRORS__.length > MAX_ERRORS) {
        window.__RECENT_ERRORS__.pop();
      }
    } catch (_) {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      window.__RECENT_ERRORS__.unshift({
        type: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || String(event.reason || 'Promise rejected'),
        stack: event.reason?.stack || '',
        time: new Date().toLocaleTimeString('zh-TW', { hour12: false })
      });
      if (window.__RECENT_ERRORS__.length > MAX_ERRORS) {
        window.__RECENT_ERRORS__.pop();
      }
    } catch (_) {}
  });

  // 前置作業一：一鍵全系統體檢診斷函式 (window.__DIAGNOSE__)
  window.__DIAGNOSE__ = async function() {
    const report = {
      timestamp: new Date().toISOString(),
      health: 'HEALTHY',
      issuesFound: [],
      storage: {
        localStorage: {
          totalBytes: 0,
          totalKB: 0,
          quotaPercentage: '0%',
          itemCount: 0,
          keySizes: {}
        },
        indexedDB: {
          supported: !!window.indexedDB,
          status: 'PENDING',
          scheduleImageCount: 0,
          storedContactIds: []
        }
      },
      stateSnapshot: {
        contactsCount: 0,
        topicsCount: 0,
        touchpointsCount: 0,
        workLogsCount: 0,
        remindersCount: 0,
        studentSchedulesCount: 0,
        todayPulseCount: 0
      },
      cloudSync: {
        enabled: false,
        apiUrlConfigured: false,
        isSyncing: false,
        lastSyncTime: null
      },
      recentErrors: window.__RECENT_ERRORS__ || []
    };

    // 1. 計算 LocalStorage 用量與分佈 (以 5MB = 5,242,880 位元組為標準配額)
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        const size = (k.length + v.length) * 2;
        totalBytes += size;
        report.storage.localStorage.keySizes[k] = `${(size / 1024).toFixed(1)} KB`;
      }
      report.storage.localStorage.totalBytes = totalBytes;
      report.storage.localStorage.totalKB = Number((totalBytes / 1024).toFixed(1));
      const pct = Number(((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(1));
      report.storage.localStorage.quotaPercentage = `${pct}%`;
      report.storage.localStorage.itemCount = localStorage.length;
      if (pct > 80) {
        report.health = 'WARNING';
        report.issuesFound.push(`LocalStorage 使用量達 ${pct}%，接近瀏覽器 5MB 配額上限！`);
      }
    } catch (e) {
      report.health = 'WARNING';
      report.issuesFound.push(`讀取 LocalStorage 配額異常: ${e.message}`);
    }

    // 2. 檢測 IndexedDB 狀態
    if (typeof ScheduleDB !== 'undefined') {
      try {
        const images = await ScheduleDB.getAllImages();
        const keys = Object.keys(images || {});
        report.storage.indexedDB.status = 'READY';
        report.storage.indexedDB.scheduleImageCount = keys.length;
        report.storage.indexedDB.storedContactIds = keys;
      } catch (e) {
        report.storage.indexedDB.status = 'ERROR';
        report.issuesFound.push(`IndexedDB 讀取失敗: ${e.message}`);
      }
    } else {
      report.storage.indexedDB.status = 'NOT_FOUND';
    }

    // 3. 檢測 AppState 狀態快照
    if (typeof state !== 'undefined') {
      report.stateSnapshot.contactsCount = (state.contacts || []).length;
      report.stateSnapshot.topicsCount = (state.topics || []).length;
      report.stateSnapshot.touchpointsCount = Object.keys(state.touchpoints || {}).length;
      report.stateSnapshot.workLogsCount = (state.workLogs || []).length;
      report.stateSnapshot.remindersCount = (state.reminders || []).length;
      report.stateSnapshot.studentSchedulesCount = Object.keys(state.studentSchedules || {}).length;

      if (typeof state.getActivityStats === 'function') {
        const act = state.getActivityStats();
        report.stateSnapshot.todayPulseCount = act?.today?.total || 0;
      }

      report.cloudSync.enabled = !!state.syncSettings?.enabled;
      report.cloudSync.apiUrlConfigured = !!state.syncSettings?.apiUrl;
      report.cloudSync.isSyncing = !!state.isSyncing;
      report.cloudSync.lastSyncTime = state.syncSettings?.lastSyncTime || null;

      // 檢查課表資料是否有破圖或遺失情況
      Object.keys(state.studentSchedules || {}).forEach(cid => {
        const sched = state.studentSchedules[cid];
        if (!sched.imageUrl || sched.imageUrl.length < 50) {
          report.health = 'WARNING';
          report.issuesFound.push(`客戶 [${cid}] 課表資料缺少有效 imageUrl！`);
        }
      });
    }

    if (report.recentErrors.length > 0) {
      report.health = 'WARNING';
      report.issuesFound.push(`偵測到 ${report.recentErrors.length} 筆近期未捕獲異常！`);
    }

    return report;
  };

  // 一鍵儲存空間最佳化診斷器
  window.__OPTIMIZE_STORAGE__ = async function() {
    console.log('🧹 開始執行 LocalStorage 配額深度清理與最佳化...');
    if (typeof state !== 'undefined' && typeof state.getSlimDocPrints === 'function') {
      try {
        localStorage.setItem(STORAGE_KEYS.DOC_PRINTS, JSON.stringify(state.getSlimDocPrints()));
        console.log('✔ crm_doc_prints 已成功瘦身為輕量中繼指針');
      } catch (e) {
        console.error('瘦身 crm_doc_prints 失敗:', e);
      }
    }
    return await window.__DIAGNOSE__();
  };
}

