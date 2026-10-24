// =============================================================================
// 3. UI 渲染引擎 (Render Engine)
// =============================================================================

// 計算距今天數（精確日曆天，消除時分秒與時區偏差，相容 -、/、.、時間碼與 ISO 格式）
function getDaysDiff(dateString) {
  if (!dateString) return 999;
  const str = String(dateString).trim();
  // 1. 嘗試從字串中萃取 YYYY, MM, DD
  let m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) {
    // 嘗試時間碼格式 c_YYYYMMDD_...
    const mCode = str.match(/^c_(\d{4})(\d{2})(\d{2})/);
    if (mCode) {
      m = [null, mCode[1], mCode[2], mCode[3]];
    }
  }
  if (!m) return 999;

  const targetYear = parseInt(m[1], 10);
  const targetMonth = parseInt(m[2], 10) - 1;
  const targetDay = parseInt(m[3], 10);
  const target = new Date(targetYear, targetMonth, targetDay);
  if (isNaN(target.getTime())) return 999;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = today.getTime() - target.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// 格式化日期標籤 (MM/DD，相容 -、/、. 與各類日期字串)
function formatDateBadge(dateString) {
  if (!dateString) return '';
  const norm = (typeof normalizeStandardDate === 'function') ? normalizeStandardDate(dateString) : '';
  if (norm) {
    const parts = norm.split('-');
    if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  }
  const m = String(dateString).trim().match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    return `${String(m[2]).padStart(2, '0')}/${String(m[3]).padStart(2, '0')}`;
  }
  return dateString;
}

// 狀態文字轉換 (純淨專業排印：預計、拋出、洽談、籌劃、考慮、完成、暫緩、婉拒)
function getStatusMeta(statusKey) {
  switch (statusKey) {
    case 'planned':
      return { label: '預計', className: 'planned' };
    case 'interaction':
      return { label: '互動', className: 'interaction' };
    case 'pitched':
      return { label: '拋出', className: 'pitched' };
    case 'agreed':
      return { label: '同意', className: 'agreed' };
    case 'appointment':
    case 'appointed':
    case 'scheduled':
    case '約定':
      return { label: '約定', className: 'appointment' };
    case 'in_progress':
    case 'discussing':
      return { label: '洽談', className: 'in_progress' };
    case 'preparing':
      return { label: '籌劃', className: 'preparing' };
    case 'considering':
      return { label: '考慮', className: 'considering' };
    case 'closed':
    case 'completed':
      return { label: '完成', className: 'closed' };
    case 'paused':
      return { label: '暫緩', className: 'paused' };
    case 'rejected':
      return { label: '婉拒', className: 'rejected' };
    case 'referral':
      return { label: '轉介', className: 'referral' };
    default:
      return { label: '未切入', className: '' };
  }
}

// 議題類別徽章樣式類別
function getCategoryBadgeClass(category) {
  switch (category) {
    case '身份接觸':
      return 'identity';
    case '風險管控':
    case '醫療防癌':
      return 'risk';
    case '投資理財':
    case '退休養老':
      return 'invest';
    case '稅務傳承':
    case '傳承稅務':
      return 'tax';
    case '生活議題':
    case '生活理財':
      return 'life';
    case '組織增員':
    case '組織發展':
      return 'recruit';
    default:
      return 'risk';
  }
}

// 格式化 DISC 標籤文字 (例如：SC型, S型, 變色龍型)
function formatDiscBadge(disc) {
  if (!disc) return '';
  const d = String(disc).trim();
  if (!d) return '';
  if (d.endsWith('型')) return d;
  return `${d}型`;
}

// 格式化 DISC 詳細說明 Title (例如：主要 S 穩健型、輔助 C 分析型)
function getDiscTitle(disc) {
  if (!disc) return '';
  const d = String(disc).trim().replace(/型$/, '');
  const traitNames = {
    'D': 'D 支配型 (目標/效率)',
    'I': 'I 影響型 (熱情/共鳴)',
    'S': 'S 穩健型 (耐心/安全)',
    'C': 'C 分析型 (數據/細節)',
    '變色龍': '變色龍 (彈性/整合適應)'
  };
  
  if (d === '變色龍') {
    return 'DISC: 變色龍型（彈性多變、高度整合適應）';
  }
  if (d.includes('/')) {
    const parts = d.split('/');
    const pName = traitNames[parts[0]] || parts[0];
    const sName = traitNames[parts[1]] || parts[1];
    return `DISC: 主要【${pName}】、輔助【${sName}】`;
  }
  if (d.length === 2 && traitNames[d[0]] && traitNames[d[1]]) {
    return `DISC: 主要【${traitNames[d[0]]}】、輔助【${traitNames[d[1]]}】`;
  }
  if (traitNames[d]) {
    return `DISC: 【${traitNames[d]}】`;
  }
  return `DISC: ${formatDiscBadge(d)}`;
}

// 渲染頂部成就感微步足跡 HUD (Today's Pulse & Weekly Progress)
function renderPulseStatsHud() {
  if (!state || typeof state.getActivityStats !== 'function') return;
  const stats = state.getActivityStats();

  const totalEl = document.getElementById('hudTodayTotal');
  const newEl = document.getElementById('hudTodayNewContact');
  const progEl = document.getElementById('hudTodayProgress');
  const weekEl = document.getElementById('hudWeekTotal');

  if (totalEl) totalEl.textContent = stats.today.total;
  if (newEl) newEl.textContent = stats.today.newContactsCount;
  if (progEl) progEl.textContent = stats.today.progressCount;
  if (weekEl) weekEl.textContent = stats.week.total;

  // 彈跳微動效 (當數值大於 0 時給予活潑感)
  const todayCard = document.getElementById('btnOpenWeeklyPulseModal');
  if (todayCard) {
    if (stats.today.total > 0) {
      todayCard.classList.add('has-pulse');
    } else {
      todayCard.classList.remove('has-pulse');
    }
  }
}

// 渲染二維交匯矩陣 (Matrix Table)
function renderMatrix() {
  const thead = document.getElementById('matrixThead');
  const tbody = document.getElementById('matrixTbody');
  if (!thead || !tbody) return;

  // 即時連動更新頂部成就感足跡 HUD
  renderPulseStatsHud();

  // 自動檢核客戶名下車輛是否有 2 個月內即將到期之車險，自動轉換「車險」議題為「預計」
  if (state && typeof state.checkVehicleInsuranceAlerts === 'function') {
    state.checkVehicleInsuranceAlerts();
  }

  const query = (state.filters.search || '').trim().toLowerCase();
  const scope = state.filters.searchScope || 'ALL';

  // 輔助檢驗函數
  const matchTopicFn = (t) => {
    const matchTitle = t.title && t.title.toLowerCase().includes(query);
    const matchTips = t.scriptTips && t.scriptTips.toLowerCase().includes(query);
    const matchCat = t.category && t.category.toLowerCase().includes(query);
    return matchTitle || matchTips || matchCat;
  };

  const matchContactFn = (c) => {
    const displayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(c.name) : (c.name || '');
    const matchName = (c.name && c.name.toLowerCase().includes(query)) || (displayName && displayName.toLowerCase().includes(query));
    const matchNickname = c.nickname && c.nickname.toLowerCase().includes(query);
    const matchCat = c.category && c.category.toLowerCase().includes(query);
    const matchMbti = c.mbti && c.mbti.toLowerCase().includes(query);
    const matchDisc = c.disc && (
      c.disc.toLowerCase().includes(query) ||
      formatDiscBadge(c.disc).toLowerCase().includes(query) ||
      getDiscTitle(c.disc).toLowerCase().includes(query)
    );
    const matchTags = c.tags && c.tags.some(t => t.toLowerCase().includes(query));
    const matchNotes = c.notes && c.notes.toLowerCase().includes(query);
    return matchName || matchNickname || matchCat || matchMbti || matchDisc || matchTags || matchNotes;
  };

  // 事先檢驗本次搜尋關鍵字是否命中客戶或議題
  const hasContactMatches = query ? state.contacts.some(matchContactFn) : false;
  const hasTopicMatches = query ? state.topics.some(t => t.isActive && matchTopicFn(t)) : false;

  const isCorporateMode = state.clientType === 'CORPORATE';
  const isRecruitMode = state.clientType === 'RECRUIT';

  // 同步更新頂部客群篩選按鈕狀態
  const clientTypeBtns = document.querySelectorAll('#clientTypeFilterGroup .client-type-btn');
  clientTypeBtns.forEach(btn => {
    if (btn.getAttribute('data-type') === state.clientType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 同步更新頂部議題分類 Tab 按鈕狀態 (無 'ALL' 按鈕，若為 'ALL' 則全部不為 active)
  const topicTabs = document.getElementById('topicCategoryTabs');
  if (topicTabs) {
    const curTopicCat = state.filters.topicCategory || 'ALL';
    topicTabs.querySelectorAll('.filter-tab').forEach(tab => {
      const cat = tab.getAttribute('data-category');
      if (curTopicCat !== 'ALL' && (cat === curTopicCat || (curTopicCat.includes('組織') && cat.includes('組織')))) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // 1. 篩選議題 (X軸) - 所有啟用的議題皆呈現於矩陣，不依據客戶類別做議題遮蔽與分流
  let visibleTopics = state.topics.filter(t => t.isActive);

  // 若未啟用單一客戶焦點篩選，才套用頂部分類過濾
  const isFocusContactActive = !!(state.contactTopicFilter && state.contactTopicFilter.contactId && state.contactTopicFilter.mode !== 'ALL');
  if (!isFocusContactActive && state.filters.topicCategory && state.filters.topicCategory !== 'ALL') {
    visibleTopics = visibleTopics.filter(t => {
      if (state.filters.topicCategory === '組織發展' || state.filters.topicCategory === '組織增員') {
        return t.category === '組織發展' || t.category === '組織增員' || (t.category && (t.category.includes('組織') || t.category.includes('增員')));
      }
      return t.category === state.filters.topicCategory;
    });
  }

  if (query) {
    if (scope === 'TOPIC') {
      // 使用者明確指定僅搜尋議題
      visibleTopics = visibleTopics.filter(matchTopicFn);
    } else if (scope === 'ALL') {
      // 綜合全域搜尋 (智慧分流)：
      // 核心防呆：若搜尋關鍵字命中了客戶（例如搜尋「千」、「黃千芸」），
      // 使用者目的是定位客戶並維護該客戶「全方位的所有議題」，絕不可因說帖內文字詞而閹割議題欄位！
      // 僅在「未命中任何客戶」且「命中議題」時，才判定使用者是在搜尋特定議題
      if (!hasContactMatches && hasTopicMatches) {
        visibleTopics = visibleTopics.filter(matchTopicFn);
      } else if (!hasContactMatches && !hasTopicMatches) {
        visibleTopics = [];
      }
      // 若 hasContactMatches 為 true，保留 visibleTopics 完整呈現，確保所有議題皆可維護
    }
  }

  // --- 客戶專屬「議題聚攏篩選」 (TOUCHED 有記錄 vs UNTOUCHED 無記錄) ---
  const activeFocus = state.contactTopicFilter;
  const isFocusActive = !!(activeFocus && activeFocus.contactId && activeFocus.mode !== 'ALL');
  let focusContact = null;
  if (isFocusActive) {
    focusContact = state.contacts.find(c => c.id === activeFocus.contactId);
    visibleTopics = visibleTopics.filter(topic => {
      const tp = state.getTouchpoint(activeFocus.contactId, topic.id);
      const hasRecord = tp && tp.history && tp.history.length > 0;
      return activeFocus.mode === 'TOUCHED' ? hasRecord : !hasRecord;
    });
  }

  visibleTopics.sort((a, b) => a.order - b.order);

  // 2. 篩選客戶名單 (Y軸) - 依照個人客戶 vs 企業客戶 vs 準增員對應篩選（支援多重勾選全響應）
  const matchClientType = (c) => {
    if (isRecruitMode) {
      return (typeof isClientRecruit === 'function') ? isClientRecruit(c) : !!c.isRecruit;
    }
    if (isCorporateMode) {
      return (typeof isClientCorporate === 'function')
        ? isClientCorporate(c, state.touchpoints, state.topics)
        : (c.isCorporate !== undefined ? !!c.isCorporate : (c.clientType === 'CORPORATE' || (c.category && /企業|董座|董事長|總經理|法人|企業主/.test(c.category))));
    }
    // 個人客戶模式 (預設)
    return (typeof isClientIndividual === 'function')
      ? isClientIndividual(c)
      : (c.isIndividual !== undefined ? !!c.isIndividual : (c.clientType !== 'CORPORATE'));
  };

  let visibleContacts = state.contacts.filter(matchClientType);

  if (query) {
    // 【搜尋名單時：排除分群與溫層篩選，全名單搜尋呈現】
    if (scope === 'CONTACT') {
      visibleContacts = state.contacts.filter(matchContactFn);
    } else if (scope === 'ALL') {
      if (hasContactMatches) {
        // 命中客戶：顯示匹配之客戶（全名單跨客群搜尋呈現）
        visibleContacts = state.contacts.filter(matchContactFn);
      } else if (hasTopicMatches) {
        // 未命中客戶但命中了議題：保留符合客群之全名單，以供在該議題下對比各客戶推進進度
        visibleContacts = state.contacts.filter(matchClientType);
      } else {
        // 查無任何客戶亦無任何議題符合
        visibleContacts = [];
      }
    } else if (scope === 'TOPIC') {
      // 搜尋範疇若為 TOPIC，但議題查無匹配且客戶有匹配時，進行智慧寬容回退
      const hasTopicMatchesInVisible = visibleTopics.length > 0;
      if (!hasTopicMatchesInVisible) {
        if (hasContactMatches) {
          visibleContacts = state.contacts.filter(matchContactFn);
        } else {
          visibleContacts = [];
        }
      }
    }
  } else {
    // 【無搜尋時：依照當前溫層篩選】
    if (state.filters.aging === 'FOCUS') {
      visibleContacts = visibleContacts.filter(c => !!c.isFocused);
    } else if (state.filters.aging === 'AGING_30') {
      visibleContacts = visibleContacts.filter(c => getDaysDiff(c.lastContactDate) > 30);
    } else if (state.filters.aging === 'RECENT_7') {
      visibleContacts = visibleContacts.filter(c => getDaysDiff(c.lastContactDate) <= 7);
    }
  }

  // --- 議題專屬「名單聚攏篩選」 (點擊議題標頭空白處：僅顯示對此議題有推進紀錄之客戶) ---
  const activeTopicFocus = state.topicFocusFilter;
  const isTopicFocusActive = !!(activeTopicFocus && activeTopicFocus.topicId);
  let focusTopic = null;
  if (isTopicFocusActive) {
    focusTopic = state.topics.find(t => t.id === activeTopicFocus.topicId);
    if (focusTopic) {
      visibleTopics = visibleTopics.filter(t => t.id === activeTopicFocus.topicId);
    }
  }

  // --- 客戶第一欄點擊連動：篩選出該客戶議題，一併也顯示其他客戶針對這些議題有過推進的 ---
  if (isFocusActive && activeFocus.contactId && visibleTopics.length > 0) {
    const targetTopicIds = new Set(visibleTopics.map(t => t.id));
    visibleContacts = visibleContacts.filter(c => {
      // 聚焦之目標客戶本人強制保留
      if (c.id === activeFocus.contactId) return true;
      // 其他客戶：必須在當前篩選出的議題中至少有 1 筆推進紀錄
      return Array.from(targetTopicIds).some(topicId => {
        const tp = state.getTouchpoint(c.id, topicId);
        return tp && tp.history && tp.history.length > 0;
      });
    });

    // 將當前聚焦的目標客戶排在最上方第一列（置頂），其餘有推進之客戶依序排列
    visibleContacts.sort((a, b) => {
      if (a.id === activeFocus.contactId) return -1;
      if (b.id === activeFocus.contactId) return 1;
      return 0;
    });
  }

  // --- 議題標頭空白點擊過濾：只留下針對此議題有紀錄的客戶名單 ---
  if (isTopicFocusActive && activeTopicFocus.topicId) {
    visibleContacts = visibleContacts.filter(c => {
      const tp = state.getTouchpoint(c.id, activeTopicFocus.topicId);
      return tp && tp.history && tp.history.length > 0;
    });
  }

  // --- 推進狀況下拉選單篩選 (Status Filter - 雙軸智能聚攏) ---
  const isStatusFilterActive = !!(state.filters.touchpointStatus && state.filters.touchpointStatus !== 'ALL');
  const targetStatus = state.filters.touchpointStatus;
  const matchesStatus = (status) => {
    if (!status) return false;
    if (targetStatus === 'appointment') {
      return status === 'appointment' || status === 'appointed' || status === 'scheduled' || status === '約定';
    }
    if (targetStatus === 'in_progress') {
      return status === 'in_progress' || status === 'discussing';
    }
    if (targetStatus === 'completed' || targetStatus === 'closed') {
      return status === 'completed' || status === 'closed';
    }
    return status === targetStatus;
  };

  // 同步更新 DOM 上的狀態下拉選單 class (發光反饋)
  const statusFilterEl = document.getElementById('touchpointStatusFilter');
  if (statusFilterEl) {
    if (isStatusFilterActive) {
      statusFilterEl.classList.add('active-filter');
    } else {
      statusFilterEl.classList.remove('active-filter');
    }
    if (statusFilterEl.value !== (targetStatus || 'ALL')) {
      statusFilterEl.value = targetStatus || 'ALL';
    }
  }

  if (isStatusFilterActive) {
    // Y軸客戶過濾：只顯示在可見議題中至少擁有該推進狀態的客戶
    visibleContacts = visibleContacts.filter(c => {
      return visibleTopics.some(t => {
        const tp = state.getTouchpoint(c.id, t.id);
        return tp && matchesStatus(tp.status);
      });
    });

    // X軸議題過濾（雙軸聚攏）：收折無人符合該狀態的空白議題欄位
    visibleTopics = visibleTopics.filter(t => {
      return visibleContacts.some(c => {
        const tp = state.getTouchpoint(c.id, t.id);
        return tp && matchesStatus(tp.status);
      });
    });
  }

  // --- 名單排序與分群：今天更新在前、未更新在後，且關注名單在各自組別置頂 ---
  const localTodayStr = getLocalTodayDateString();
  
  const isContactUpdatedToday = (contact) => {
    if (!contact) return false;

    // 1. 若為今日新增客戶 (createdAt 吻合今日、或從 ID 時間碼 c_YYYYMMDD_... 提取為今日)
    if (contact.createdAt && (contact.createdAt === localTodayStr || getDaysDiff(contact.createdAt) === 0)) return true;
    if (typeof extractDateFromContact === 'function') {
      const cDate = extractDateFromContact(contact);
      if (cDate && (cDate === localTodayStr || getDaysDiff(cDate) === 0)) return true;
    }
    if (contact.id && getDaysDiff(contact.id) === 0) return true;

    // 2. 若客戶基本資料在今天有更新 (lastUpdated)
    if (contact.lastUpdated && (contact.lastUpdated === localTodayStr || getDaysDiff(contact.lastUpdated) === 0)) return true;

    // 3. 若最後定聯日為今天 (嚴格比對年月日或距今日曆天差為 0)
    if (contact.lastContactDate && (contact.lastContactDate === localTodayStr || getDaysDiff(contact.lastContactDate) === 0)) return true;

    // 4. 檢視其所有交匯紀錄是否在今天有推進紀錄
    return Object.keys(state.touchpoints).some(key => {
      if (key.startsWith(`${contact.id}_`)) {
        const tp = state.touchpoints[key];
        if (tp && tp.history && tp.history.length > 0) {
          return tp.history.some(h => h.date && (h.date === localTodayStr || getDaysDiff(h.date) === 0));
        }
      }
      return false;
    });
  };

  // 排序函式：列管者 (isControlled) 最優先置頂，其次為關注者 (isFocused)，若同權限則保持原名單順序
  const sortGroup = (list) => {
    return [...list].sort((a, b) => {
      const aCtrl = !!a.isControlled;
      const bCtrl = !!b.isControlled;
      if (aCtrl && !bCtrl) return -1;
      if (!aCtrl && bCtrl) return 1;

      const aFocused = !!a.isFocused;
      const bFocused = !!b.isFocused;
      if (aFocused && !bFocused) return -1;
      if (!aFocused && bFocused) return 1;
      return 0;
    });
  };

  let todayUpdatedContacts = [];
  let otherContacts = [];

  todayUpdatedContacts = sortGroup(visibleContacts.filter(c => isContactUpdatedToday(c)));
  otherContacts = sortGroup(visibleContacts.filter(c => !isContactUpdatedToday(c)));

  // 若當前有客戶焦點篩選 (activeFocus)，確保被鎖定的焦點客戶在所屬分組中絕對置頂於最首位
  if (isFocusActive && activeFocus.contactId) {
    const promoteFocusContact = (list) => {
      return [...list].sort((a, b) => {
        if (a.id === activeFocus.contactId) return -1;
        if (b.id === activeFocus.contactId) return 1;
        return 0;
      });
    };
    if (todayUpdatedContacts.some(c => c.id === activeFocus.contactId)) {
      todayUpdatedContacts = promoteFocusContact(todayUpdatedContacts);
    } else {
      otherContacts = promoteFocusContact(otherContacts);
    }
  }

  // --- 渲染 THEAD (Sticky 頂部欄) ---
  let theadHTML = `<tr>`;
  // 左上角交匯固定欄（左側顯示目前客群維度，點擊切換：個人 ➔ 企業 ➔ 準增員；右側垂直：+ 議題 與 + 名單 防呆防誤觸；若在聚焦狀態則提供 ✕ 恢復按鈕）
  let clientTypeLabel = '👤 個人客戶';
  let clientTypeBadgeClass = 'pill-individual';
  if (state.clientType === 'CORPORATE') {
    clientTypeLabel = '🏢 企業客戶';
    clientTypeBadgeClass = 'pill-corporate';
  } else if (state.clientType === 'RECRUIT') {
    clientTypeLabel = '🤝 準增員';
    clientTypeBadgeClass = 'pill-recruit';
  }

  const isAnyFocusActive = isFocusActive || isTopicFocusActive;
  const activeFocusContactName = focusContact ? (typeof getClientDisplayName === 'function' ? getClientDisplayName(focusContact.name) : focusContact.name) : '';
  const activeFocusName = isFocusActive && focusContact ? activeFocusContactName : (isTopicFocusActive && focusTopic ? focusTopic.title : '');

  theadHTML += `
    <th class="corner-cell" title="點擊該儲存格空白處：切換客群維度（個人 ➔ 企業 ➔ 準增員）">
      <div class="corner-cell-inner">
        <!-- 左側三行客群維度切換膠囊按鈕（一行一個，當前模式帶選中高亮外框） -->
        <div class="corner-client-type-group">
          <button type="button" class="corner-type-btn ${state.clientType === 'INDIVIDUAL' ? 'active' : ''}" data-type="INDIVIDUAL" title="切換至個人客戶名單">
            <span class="type-icon">👤</span>
            <span class="type-text">個人客戶</span>
          </button>
          <button type="button" class="corner-type-btn ${state.clientType === 'CORPORATE' ? 'active' : ''}" data-type="CORPORATE" title="切換至企業客戶名單">
            <span class="type-icon">🏢</span>
            <span class="type-text">企業客戶</span>
          </button>
          <button type="button" class="corner-type-btn ${state.clientType === 'RECRUIT' ? 'active' : ''}" data-type="RECRUIT" title="切換至準增員名單">
            <span class="type-icon">🤝</span>
            <span class="type-text">準增員</span>
          </button>
        </div>
        <!-- 右側垂直堆疊操作按鈕 (+ 議題 / + 名單 / ✕ 恢復) -->
        <div class="corner-actions-stack">
          ${isAnyFocusActive ? `
            <button class="corner-action-btn focus-reset-btn" id="btnClearTopicFocus" title="點擊取消聚焦【${escapeHTML(activeFocusName)}】，恢復顯示全部客戶與議題" style="background: rgba(225, 29, 72, 0.12); color: var(--accent-rose); border-color: rgba(225, 29, 72, 0.35); font-weight: 700;">
              <span>✕ 解除聚焦</span>
            </button>
          ` : `
            <button class="corner-action-btn" id="btnQuickAddTopic" title="快速新增議題">
              <span>+ 議題</span>
            </button>
          `}
          <button class="corner-action-btn" id="btnQuickAddContact" title="快速新增名單">
            <span>+ 名單</span>
          </button>
        </div>
      </div>
    </th>
  `;

  // 議題搜尋/聚攏無結果提示
  if (visibleTopics.length === 0) {
    let emptyMsg = `查無符合關鍵字「${escapeHTML(query)}」的議題`;
    let returnBtnHtml = '';
    if (isFocusActive && focusContact) {
      const displayFocusName = typeof getClientDisplayName === 'function' ? getClientDisplayName(focusContact.name) : focusContact.name;
      if (activeFocus.mode === 'TOUCHED') {
        emptyMsg = `【${escapeHTML(displayFocusName)}】目前尚無任何議題紀錄`;
      } else {
        emptyMsg = `【${escapeHTML(displayFocusName)}】所有議題皆已開展切入完畢！`;
      }
      returnBtnHtml = `
        <button class="btn btn-secondary" id="btnClearTopicFocus" style="margin-left: 12px; padding: 4px 12px; font-size: 0.8rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-highlight); color: var(--accent-primary); cursor: pointer;">
          ✕ 返回顯示全部議題
        </button>
      `;
    } else if (isTopicFocusActive && focusTopic) {
      emptyMsg = `【${escapeHTML(focusTopic.title)}】目前尚無任何客戶推進紀錄`;
      returnBtnHtml = `
        <button class="btn btn-secondary" id="btnClearTopicFocus" style="margin-left: 12px; padding: 4px 12px; font-size: 0.8rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-highlight); color: var(--accent-primary); cursor: pointer;">
          ✕ 返回顯示全部客戶
        </button>
      `;
    }
    theadHTML += `
      <th style="padding: 16px 20px; color: var(--text-muted); font-size: 0.82rem; font-weight: normal; text-align: left; height: 114px; min-height: 114px; box-sizing: border-box; vertical-align: middle;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${emptyMsg}</span>
          ${returnBtnHtml}
        </div>
      </th>
    `;
    theadHTML += `</tr>`;
    thead.innerHTML = theadHTML;

    tbody.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:center; padding: 48px 24px; color: var(--text-muted); font-size: 0.85rem;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <span>${emptyMsg}</span>
            ${returnBtnHtml}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // 議題欄位標頭 (區分為：點擊字開啟維護 vs 點擊其餘任何空白處篩選該議題之客戶名單)
  visibleTopics.forEach(topic => {
    const catClass = getCategoryBadgeClass(topic.category);
    const isThisTopicFocused = isTopicFocusActive && activeTopicFocus.topicId === topic.id;
    theadHTML += `
      <th class="topic-col ${isThisTopicFocused ? 'is-focused-topic' : ''}" data-topic-id="${topic.id}" title="點擊卡片空白處：篩選推進過【${escapeHTML(topic.title)}】的客戶名單">
        <div class="topic-header-card" data-topic-id="${topic.id}">
          <div class="topic-header-top-row">
            <span class="topic-header-category" style="background:var(--cat-${catClass}-bg); color:var(--cat-${catClass});">
              ${topic.category}
            </span>
            ${topic.scriptTips ? `<span class="topic-script-badge">說帖</span>` : ''}
          </div>
          <div class="topic-title-wrapper">
            <button type="button" class="topic-title-edit-btn" data-action="edit-topic" data-topic-id="${topic.id}" title="點擊文字開啟【${escapeHTML(topic.title)}】議題維護視窗">
              <span class="topic-header-title">${escapeHTML(topic.title)}</span>
              <span class="topic-edit-pen" aria-hidden="true">✎</span>
            </button>
          </div>
        </div>
      </th>
    `;
  });
  theadHTML += `</tr>`;
  thead.innerHTML = theadHTML;

  // --- 渲染 TBODY (Sticky 左名單欄 + 交匯儲存格) ---
  if (visibleContacts.length === 0) {
    const colSpan = visibleTopics.length + 1;
    let emptyContactContent = '';
    if (isRecruitMode) {
      emptyContactContent = `
        <div style="max-width: 480px; margin: 0 auto; line-height: 1.6;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">🤝</div>
          <div style="font-weight: 700; font-size: 0.96rem; color: var(--text-primary); margin-bottom: 6px;">目前尚無標記為【準增員】的名單</div>
          <div style="color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 14px;">
            在任一客戶的檔案編輯中，點亮 <span style="display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 4px; background: rgba(124, 58, 237, 0.12); color: #7c3aed; font-weight: 700; border: 1px solid rgba(124, 58, 237, 0.3);">🤝 準增</span> 按鈕即可正式啟動組織發展推進；亦可直接新增專屬準增員對象。
          </div>
          <button type="button" class="btn btn-primary" id="btnEmptyAddRecruit" style="background: linear-gradient(135deg, #7c3aed, #9333ea); border: none; padding: 7px 18px; font-weight: 700; border-radius: 6px; cursor: pointer; color: #fff;">
            + 新增準增員對象
          </button>
        </div>
      `;
    } else {
      emptyContactContent = `
        <div>無符合篩選條件的名單資料，請嘗試清除搜尋或點選左上角「+ 名單」。</div>
      `;
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" style="text-align:center; padding: 48px 24px; color: var(--text-muted); font-size: 0.88rem;">
          ${emptyContactContent}
        </td>
      </tr>
    `;
    return;
  }

  let tbodyHTML = '';

  // 單一名單 Row HTML 生成函式
  const renderContactRowHTML = (contact) => {
    let rowHTML = '';
    const days = getDaysDiff(contact.lastContactDate);
    let recencyText = '未聯';
    let recencyClass = 'urgent';

    if (contact.lastContactDate) {
      if (days === 0) {
        recencyText = '今天';
        recencyClass = '';
      } else if (days <= 7) {
        recencyText = `${days}天前`;
        recencyClass = '';
      } else if (days <= 30) {
        recencyText = `${days}天前`;
        recencyClass = '';
      } else {
        recencyText = `逾${days}天`;
        recencyClass = days > 60 ? 'urgent' : 'warning';
      }
    }

    const isControlledRow = !!contact.isControlled;
    const rowClass = isControlledRow ? 'controlled-client-row' : '';

    rowHTML += `<tr class="${rowClass}">`;
    // 左欄 Sticky 客戶資訊
    const isThisContactFocused = isFocusActive && activeFocus.contactId === contact.id;
    let focusClass = '';

    if (isThisContactFocused) {
      if (activeFocus.mode === 'TOUCHED') {
        focusClass = 'filter-active-touched';
      } else if (activeFocus.mode === 'UNTOUCHED') {
        focusClass = 'filter-active-untouched';
      }
    }

    // 計算該名單的有記錄數與未開數
    const totalActiveTopicsCount = state.topics.filter(t => t.isActive).length;
    const contactTouchedCount = state.topics.filter(t => {
      if (!t.isActive) return false;
      const tp = state.getTouchpoint(contact.id, t.id);
      return tp && tp.history && tp.history.length > 0;
    }).length;
    const contactUntouchedCount = totalActiveTopicsCount - contactTouchedCount;
    const progressPct = totalActiveTopicsCount > 0 ? Math.round((contactTouchedCount / totalActiveTopicsCount) * 100) : 0;

    // 沉睡客戶溫層燈號判斷
    let agingDotClass = 'aging-dot aging-warm';
    let agingDotTitle = `${days} 天前互動`;
    if (!contact.lastContactDate) {
      agingDotClass = 'aging-dot aging-warning';
      agingDotTitle = '尚未有定聯紀錄';
    } else if (days > 60) {
      agingDotClass = 'aging-dot aging-danger';
      agingDotTitle = `逾 ${days} 天未聯絡（急需保溫）`;
    } else if (days > 30) {
      agingDotClass = 'aging-dot aging-warning';
      agingDotTitle = `逾 ${days} 天未聯絡`;
    } else if (days <= 7) {
      agingDotClass = 'aging-dot active-recent';
      agingDotTitle = '7 天內曾互動';
    }

    rowHTML += `
      <th class="contact-cell ${focusClass}" data-contact-id="${contact.id}" title="點擊姓名：開啟客戶檔案維護&#10;點擊其餘空間：啟動議題篩選聚攏（有記錄 ${contactTouchedCount} ➔ 未開 ${contactUntouchedCount} ➔ 全部）">
        <div class="contact-card compact-card">
          <!-- 第一行：對位占位 + 燈號 + 姓名 + 準增標記 + 吃素標記 + 焦點/同議題推進標記 -->
          <div class="contact-name-row">
            <span class="contact-align-spacer"></span>
            <span class="${agingDotClass}" title="${agingDotTitle}"></span>
            <span class="contact-name-text text-clickable" data-action="edit-contact" title="點擊編輯客戶檔案">${escapeHTML(typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name)}</span>
            ${state.hasStudentSchedule(contact.id) ? `<button type="button" class="badge-student-schedule" data-action="view-schedule" data-contact-id="${contact.id}" title="點擊快速查閱【${escapeHTML(typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name)}】的課表與空堂作息">🎓 課表</button>` : ''}
            ${contact.isControlled ? `<span class="client-controlled-badge" title="🚨 重點列管客戶（優先置頂）">列管</span>` : ''}
            ${contact.isVegetarian ? `<span class="diet-veg-badge" title="飲食習慣：吃素">素</span>` : ''}
            ${isThisContactFocused ? `<span class="focus-client-badge" title="目前鎖定焦點客戶（置頂）">鎖定</span>` : (isFocusActive ? `<span class="co-touched-badge" title="針對此議題亦有推進紀錄之客戶">推進</span>` : '')}
          </div>
          <!-- 第二行：關注星號 (16px) + 燈號寬度占位 (11px) + 性格特質 (精確切齊姓氏) -->
          ${(() => {
            const expiringVehInfo = null;
            if (expiringVehInfo) {
              const diffText = expiringVehInfo.diffDays <= 0 ? '已到期' : `剩餘 ${expiringVehInfo.diffDays} 天`;
              const ownerDisplayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(expiringVehInfo.vehicle.ownerName || contact.name) : (expiringVehInfo.vehicle.ownerName || contact.name);
              return `
                <div class="vehicle-expiring-alert-box" title="【車險到期提醒】&#10;車台：${escapeHTML(expiringVehInfo.vehicle.plateNumber)} (${escapeHTML(expiringVehInfo.vehicle.brand || '')} ${escapeHTML(expiringVehInfo.vehicle.modelType || '')})&#10;車主：${escapeHTML(ownerDisplayName)}&#10;到期日：${escapeHTML(expiringVehInfo.vehicle.insuranceExpiryDate)} (${diffText})">
                  車險到期
                </div>
              `;
            }
            const hasMbti = !!contact.mbti;
            const hasDisc = !!contact.disc;
            let traitBadgesHtml = '';

            if (hasMbti) {
              traitBadgesHtml += `<span class="trait-badge mbti" title="MBTI: ${escapeHTML(contact.mbti)} (點擊切換篩選)">${escapeHTML(contact.mbti)}</span>`;
            }
            if (hasDisc) {
              traitBadgesHtml += `<span class="trait-badge disc" title="DISC: ${escapeHTML(formatDiscBadge(contact.disc))} (點擊切換篩選)">${escapeHTML(formatDiscBadge(contact.disc))}</span>`;
            }

            // 若兩者皆未設定，給予一組極淡的幽靈預留框保持兩行高齊平；只要有設定任何一項，絕不插入無效空框佔位！
            if (!hasMbti && !hasDisc) {
              traitBadgesHtml = `<span class="trait-badge mbti empty-ghost" title="性格偏好 (未設定)"><span class="ghost-text">未設定</span></span>`;
            }

            return `
              <div class="contact-traits-row">
                <button type="button" class="btn-star-focus ${contact.isFocused ? 'starred' : ''}" data-action="toggle-focus" data-contact-id="${contact.id}" title="${contact.isFocused ? '目前為【⭐ 關注名單】（點擊取消關注）' : '點擊設為【⭐ 關注名單】'}">
                  ${contact.isFocused ? '⭐' : '☆'}
                </button>
                <span class="dot-align-spacer"></span>
                ${traitBadgesHtml}
              </div>
            `;
          })()}
        </div>
      </th>
    `;

    // 議題交匯儲存格
    visibleTopics.forEach(topic => {
      const tp = state.getTouchpoint(contact.id, topic.id);
      let spotlightClass = '';
      if (isStatusFilterActive) {
        const isMatch = tp && matchesStatus(tp.status);
        spotlightClass = isMatch ? 'spotlight-target-cell' : 'spotlight-dimmed-cell';
      }

      if (tp && tp.history && tp.history.length > 0) {
        const latestItem = tp.history[0];
        const statusMeta = getStatusMeta(tp.status);

        // 出國旅遊專屬微型標籤 (呈現目的地與回國狀態)
        let travelPillHtml = '';
        if ((topic.id === 't_travel' || topic.title === '出國旅遊') && tp.travel && tp.travel.destination) {
          const retDate = tp.travel.returnTime ? new Date(tp.travel.returnTime) : null;
          const isJustReturned = retDate && (new Date() >= retDate);
          const alertClass = isJustReturned ? 'alert-return' : '';
          const pillText = isJustReturned ? `🛬 ${escapeHTML(tp.travel.destination)}已回國` : `✈️ ${escapeHTML(tp.travel.destination)}`;
          travelPillHtml = `<span class="travel-micro-pill ${alertClass}" title="目的地：${escapeHTML(tp.travel.destination)}">${pillText}</span>`;
        }

        const hasSchedule = !!(tp.remindClientTime || tp.appointmentTime);
        const scheduleIconHtml = hasSchedule ? `<span class="cell-schedule-badge" title="有排定時程提醒" style="font-size:0.65rem; line-height:1; opacity:0.85;">⏰</span>` : '';

        rowHTML += `
          <td class="matrix-cell ${spotlightClass}" data-contact-id="${contact.id}" data-topic-id="${topic.id}">
            <div class="cell-content">
              <span class="cell-date-badge">${formatDateBadge(tp.latestDate)}</span>
              <span class="status-pill ${statusMeta.className}">${statusMeta.label}</span>
              ${scheduleIconHtml}
              ${travelPillHtml}
            </div>
            <div class="cell-tooltip">
              <strong>${tp.latestDate} (${latestItem.channel || '互動'})</strong><br>
              ${tp.travel?.destination ? `✈️ 目的地：${escapeHTML(tp.travel.destination)}<br>` : ''}
              ${tp.remindClientTime ? `🔔 提醒對方：${escapeHTML(tp.remindClientTime.replace('T', ' '))}<br>` : ''}
              ${tp.appointmentTime ? `🤝 約定／交付：${escapeHTML(tp.appointmentTime.replace('T', ' '))}<br>` : ''}
              ${latestItem.summary || '點擊查看詳情'}
            </div>
          </td>
        `;
      } else {
        // 未切入儲存格
        rowHTML += `
          <td class="matrix-cell ${spotlightClass}" data-contact-id="${contact.id}" data-topic-id="${topic.id}">
            <div class="cell-content">
              <div class="cell-untouched">＋</div>
            </div>
            <div class="cell-tooltip">尚未切入此議題，點擊開啟微紀錄</div>
          </td>
        `;
      }
    });

    rowHTML += `</tr>`;
    return rowHTML;
  };

  // 1. 渲染今日有更新的名單（關注者置頂；若啟用隱藏已更新名單則跳過渲染）
  const isHideUpdatedActive = !!state.hideUpdatedContacts;
  if (!isHideUpdatedActive) {
    todayUpdatedContacts.forEach(contact => {
      tbodyHTML += renderContactRowHTML(contact);
    });
  }

  // 2. 螢光橘橫線分隔列（只要今天有已更新名單即呈現，膠囊顯示純數字按鈕，可點擊隱藏/顯示已更新名單）
  if (todayUpdatedContacts.length > 0) {
    tbodyHTML += `
      <tr class="today-divider-row" title="螢光橘分隔線：點擊按鈕可${isHideUpdatedActive ? '展開顯示' : '隱藏'}已更新名單">
        <th class="today-divider-cell">
          <div class="today-divider-line"></div>
          <button type="button" class="today-divider-badge ${isHideUpdatedActive ? 'collapsed' : ''}" id="btnToggleHideUpdated" data-action="toggle-hide-updated" title="點擊${isHideUpdatedActive ? '展開顯示' : '隱藏'}已更新名單 (${todayUpdatedContacts.length})">
            ${todayUpdatedContacts.length} - ${otherContacts.length}
          </button>
        </th>
        ${visibleTopics.map(() => `
          <td class="today-divider-cell">
            <div class="today-divider-line"></div>
          </td>
        `).join('')}
      </tr>
    `;
  }

  // 3. 渲染未更新名單（關注者置頂）
  otherContacts.forEach(contact => {
    tbodyHTML += renderContactRowHTML(contact);
  });

  tbody.innerHTML = tbodyHTML;

  // 更新頂部關注快篩按鈕的計數徽章
  const focusBadge = document.getElementById('focusCountBadge');
  if (focusBadge) {
    const focusCount = state.contacts.filter(c => {
      return matchClientType(c) && !!c.isFocused;
    }).length;
    focusBadge.textContent = `(${focusCount})`;
  }

  // 同步更新「全名單」按鈕的 Demo 去識別化指示外觀
  const btnFilterAll = document.getElementById('btnFilterAll');
  if (btnFilterAll) {
    if (state.isDemoMasked) {
      btnFilterAll.classList.add('is-demo-masked');
      btnFilterAll.title = '目前為【Demo 去識別化模式】\n💡 連續點擊兩下：切換回原始客戶姓名';
    } else {
      btnFilterAll.classList.remove('is-demo-masked');
      btnFilterAll.title = '點擊顯示全名單\n💡 連續點擊兩下：切換【Demo 去識別化模式】';
    }
  }
}

