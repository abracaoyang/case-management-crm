// =============================================================================
// 4. 抽屜與彈窗控制器 (Drawer & Modal Controllers)
// =============================================================================

// 開啟右側微紀錄抽屜 (Quick Log Drawer)
function openQuickLogDrawer(contactId, topicId, fromStatusList = false) {
  const contact = state.contacts.find(c => c.id === contactId);
  const topic = state.topics.find(t => t.id === topicId);
  if (!contact || !topic) return;

  state.activeCell = { contactId, topicId };

  if (fromStatusList) {
    statusListModalState.returnAfterDrawerClose = true;
  } else {
    statusListModalState.returnAfterDrawerClose = false;
  }

  // 同步抽屜頂部「← 返回推進清單」按鈕與儲存按鈕文字
  const btnBackToList = document.getElementById('btnDrawerBackToStatusList');
  const saveBtnText = document.getElementById('saveQuickLogBtnText');
  if (btnBackToList) {
    btnBackToList.style.display = statusListModalState.returnAfterDrawerClose ? 'inline-flex' : 'none';
  }
  if (saveBtnText) {
    saveBtnText.textContent = statusListModalState.returnAfterDrawerClose ? '💾 儲存並返回推進清單' : '儲存微紀錄';
  }

  // 填入頂部標題資訊
  const nameEl = document.getElementById('logClientName');
  const catEl = document.getElementById('logClientCategory');
  const traitsEl = document.getElementById('logClientTraits');
  const topicTitleEl = document.getElementById('logTopicTitle');
  const topicScriptEl = document.getElementById('logTopicScript');

  if (nameEl) nameEl.textContent = typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name;
  if (catEl) catEl.textContent = contact.category || '名單';
  if (traitsEl) {
    let traitHtml = '';
    if (contact.mbti) traitHtml += `<span class="trait-badge mbti" title="MBTI: ${contact.mbti}">${contact.mbti}</span>`;
    if (contact.disc) traitHtml += `<span class="trait-badge disc" title="${getDiscTitle(contact.disc)}">${escapeHTML(formatDiscBadge(contact.disc))}</span>`;
    traitsEl.innerHTML = traitHtml;
  }
  if (topicTitleEl) topicTitleEl.textContent = topic.title;
  if (topicScriptEl) topicScriptEl.textContent = topic.scriptTips || '此議題目前暫無專屬說帖，可至議題庫面板進行維護補齊。';

  // 課表快速查閱快捷鈕連動
  const btnDrawerSchedule = document.getElementById('btnDrawerScheduleQuickBtn');
  if (btnDrawerSchedule) {
    const hasSched = state && typeof state.hasStudentSchedule === 'function' && state.hasStudentSchedule(contact.id);
    const isRecruit = !!contact.isRecruit;
    if (hasSched || isRecruit) {
      btnDrawerSchedule.style.display = 'inline-flex';
      btnDrawerSchedule.setAttribute('data-contact-id', contact.id);
      if (hasSched) {
        btnDrawerSchedule.innerHTML = '🎓 查看課表';
        btnDrawerSchedule.title = `點擊查閱【${escapeHTML(contact.name)}】的課表與空堂作息`;
      } else {
        btnDrawerSchedule.innerHTML = '🎓 登錄課表';
        btnDrawerSchedule.title = `點擊為【${escapeHTML(contact.name)}】上傳或貼上課表`;
      }
    } else {
      btnDrawerSchedule.style.display = 'none';
    }
  }

  // 預設日期為今日本地日期 (YYYY-MM-DD)
  const today = getLocalTodayDateString();
  const dateInput = document.getElementById('logDateInput');
  if (dateInput) dateInput.value = today;

  // 自動自癒檢核：若有非組織增員類議題殘留課表誤植紀錄，自動清除並刷新
  if (typeof state.cleanupCorruptedScheduleTouchpoints === 'function') {
    state.cleanupCorruptedScheduleTouchpoints();
  }

  // 讀取既有狀態與紀錄
  const tp = state.getTouchpoint(contactId, topicId);
  const currentStatus = (tp && tp.status) ? tp.status : 'planned';
  setDrawerStatusRadio(currentStatus);

  // 取得最近一筆歷史紀錄
  const hasHistory = (tp && tp.history && tp.history.length > 0);
  const latestItem = hasHistory ? tp.history[0] : null;
  const latestCustom = hasHistory ? tp.history.find(h => h.summary && !h.summary.includes('例行議題定聯關懷') && !h.summary.includes('🎓 登錄學生作息課表')) : null;
  const bestRecord = latestCustom || latestItem;

  // 清空輸入欄位（保持全新微紀錄乾淨視圖，杜絕舊資料自動重複殘留）
  const summaryInput = document.getElementById('logSummaryInput');
  const nextActionInput = document.getElementById('logNextActionInput');
  const transcriptInput = document.getElementById('logTranscriptInput');
  const remindTimeInput = document.getElementById('logRemindClientTimeInput');
  const apptTimeInput = document.getElementById('logAppointmentTimeInput');
  const channelSelect = document.getElementById('logChannelSelect');

  if (summaryInput) {
    summaryInput.value = '';
    if (bestRecord && bestRecord.summary && !bestRecord.summary.includes('🎓 登錄學生作息課表')) {
      summaryInput.placeholder = `上次溝通重點：${bestRecord.summary}（請在此輸入本次新進展或約定細節）`;
    } else {
      summaryInput.placeholder = '請填寫本次定聯洽談要點、客戶真實想法與回饋... (選填)';
    }
  }

  if (nextActionInput) {
    nextActionInput.value = '';
    if (bestRecord && bestRecord.nextAction && !bestRecord.nextAction.includes('依據課表空堂時間安排面談邀約')) {
      nextActionInput.placeholder = `上次下一步：${bestRecord.nextAction}（點擊上方標籤或手動輸入）`;
    } else {
      nextActionInput.placeholder = '點擊上方標籤、下方全地圖清單，或手動自訂跟進動作';
    }
  }

  if (transcriptInput) {
    transcriptInput.value = '';
  }

  if (channelSelect && bestRecord && bestRecord.channel) {
    channelSelect.value = bestRecord.channel;
  }

  // 回填既有之時程設定 (若無則保持空白)
  if (remindTimeInput) remindTimeInput.value = (tp && tp.remindClientTime) ? tp.remindClientTime : '';
  if (apptTimeInput) apptTimeInput.value = (tp && tp.appointmentTime) ? tp.appointmentTime : '';

  // 渲染歷史時間軸
  renderTimelineHistory(tp);

  // 控制清空此格按鈕顯示狀態
  const btnClearCell = document.getElementById('btnClearCellTouchpoint');
  if (btnClearCell) {
    btnClearCell.style.display = (tp && tp.history && tp.history.length > 0) ? 'inline-flex' : 'none';
  }

  // 重設並同步抽屜內全地圖戰略看板大按鈕狀態
  state.pendingNextTopicId = null;
  syncDrawerStrategyHeroButton();

  // 同步出國旅遊專屬動態追蹤卡
  const isTravelTopic = (topicId === 't_travel' || (topic && topic.title === '出國旅遊'));
  if (isTravelTopic) {
    setupTravelDrawerUI(tp);
  } else {
    hideTravelDrawerUI();
  }

  // 渲染抽屜最左側該議題專屬備忘提醒清單並清空新增輸入框
  renderTopicRemindersUI(contactId, topicId);
  const remContentInput = document.getElementById('newReminderContent');
  const remDueInput = document.getElementById('newReminderDueTime');
  if (remContentInput) remContentInput.value = '';
  if (remDueInput) remDueInput.value = '';

  // 開啟抽屜與遮罩
  const drawer = document.getElementById('quickLogDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

// 設定抽屜狀態單選按鈕高亮
function setDrawerStatusRadio(statusValue) {
  const labels = document.querySelectorAll('.status-radio-label');
  labels.forEach(label => {
    const radio = label.querySelector('input');
    if (radio && radio.value === statusValue) {
      radio.checked = true;
      label.classList.add('checked');
    } else {
      label.classList.remove('checked');
    }
  });
}

// =============================================================================
// 出國旅遊專屬動態追蹤卡控制器 (Travel Tracking Module Controller)
// =============================================================================

function setTravelTaskPillState(pillId, textId, stateVal, textMap) {
  const pill = document.getElementById(pillId);
  const textEl = document.getElementById(textId);
  if (!pill) return;
  pill.setAttribute('data-state', stateVal || 'none');
  if (textEl && textMap && textMap[stateVal]) {
    textEl.textContent = textMap[stateVal];
  }
}

function updateTravelSmartBanner() {
  const depVal = document.getElementById('travelDepartureInput')?.value;
  const retVal = document.getElementById('travelReturnInput')?.value;
  const destVal = document.getElementById('travelDestinationInput')?.value.trim() || '國外';
  const banner = document.getElementById('travelSmartStatusBanner');
  const badge = document.getElementById('travelDurationBadge');

  if (!banner) return;

  if (!depVal && !retVal) {
    banner.style.display = 'none';
    if (badge) badge.style.display = 'none';
    return;
  }

  const now = new Date();
  const depDate = depVal ? new Date(depVal) : null;
  const retDate = retVal ? new Date(retVal) : null;

  // 計算旅程天數
  if (depDate && retDate && retDate >= depDate) {
    const diffMs = retDate.getTime() - depDate.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    if (badge) {
      badge.textContent = `共 ${days} 天旅程`;
      badge.style.display = 'inline-block';
    }
  } else {
    if (badge) badge.style.display = 'none';
  }

  banner.style.display = 'flex';

  // 1. 回國後 (現在時間 >= 回國時間)
  if (retDate && now >= retDate) {
    const passedDays = Math.floor((now.getTime() - retDate.getTime()) / (1000 * 60 * 60 * 24));
    banner.className = 'travel-smart-banner status-returned';
    if (passedDays === 0) {
      banner.innerHTML = `<span>🎉</span><span><strong>【今日回國】</strong> 客戶預計今日自【${escapeHTML(destVal)}】返國！建議主動發 LINE 溫馨接風關懷！</span>`;
    } else {
      banner.innerHTML = `<span>🛬</span><span><strong>【已回國 ${passedDays} 天】</strong> 自【${escapeHTML(destVal)}】平安歸國。可關心旅程體驗、是否有班機延誤等不便險需求。</span>`;
    }
    return;
  }

  // 2. 旅程進行中 (出發時間 <= 現在時間 < 回國時間)
  if (depDate && now >= depDate && retDate && now < retDate) {
    const leftDays = Math.ceil((retDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    banner.className = 'travel-smart-banner status-traveling';
    banner.innerHTML = `<span>✈️</span><span><strong>【旅程進行中】</strong> 目前正在【${escapeHTML(destVal)}】，預計 <strong>${leftDays} 天後</strong> 返國。</span>`;
    return;
  }

  // 3. 出發倒數中 (現在時間 < 出發時間)
  if (depDate && now < depDate) {
    const diffDays = Math.ceil((depDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) {
      banner.className = 'travel-smart-banner status-warning';
      banner.innerHTML = `<span>⚠️</span><span><strong>【即將出發！倒數 ${diffDays} 天】</strong> 請務必確認旅平險已完成投保與海外醫療權益告知！</span>`;
    } else {
      banner.className = 'travel-smart-banner status-countdown';
      banner.innerHTML = `<span>⏳</span><span><strong>【出發倒數 ${diffDays} 天】</strong> 最佳辦旅平卡時機，提供一鍵投保便利性。</span>`;
    }
    return;
  }

  banner.style.display = 'none';
}

function setupTravelDrawerUI(tp) {
  const section = document.getElementById('travelInfoSection');
  if (!section) return;
  section.style.display = 'flex';

  const travel = (tp && tp.travel) ? tp.travel : {};
  const destInput = document.getElementById('travelDestinationInput');
  const depInput = document.getElementById('travelDepartureInput');
  const retInput = document.getElementById('travelReturnInput');

  if (destInput) destInput.value = travel.destination || '';
  if (depInput) depInput.value = travel.departureTime || '';
  if (retInput) retInput.value = travel.returnTime || '';

  // 設定四大任務按鈕狀態
  setTravelTaskPillState('taskPillCard', 'taskStatusTextCard', travel.cardState || (travel.hasCard ? 'done' : 'none'), {
    none: '未申辦',
    progress: '已通知申辦',
    done: '已持旅平卡'
  });

  setTravelTaskPillState('taskPillInsurance', 'taskStatusTextInsurance', travel.insuranceState || (travel.insuranceReminded ? 'done' : 'none'), {
    none: '未提醒',
    progress: '已傳送試算',
    done: '已完成投保'
  });

  setTravelTaskPillState('taskPillRights', 'taskStatusTextRights', travel.rightsState || (travel.rightsNotified ? 'done' : 'none'), {
    none: '未告知',
    progress: '已告知注意事項',
    done: '已備妥急難條款'
  });

  setTravelTaskPillState('taskPillReturn', 'taskStatusTextReturn', travel.returnState || (travel.returnedReminded ? 'done' : 'none'), {
    none: '旅程籌劃中',
    progress: '待回國關懷',
    done: '已完成接風致意'
  });

  // 更新智能狀態提示條與天數
  updateTravelSmartBanner();

  // 專屬旅平投保確認訊息卡片 (旅平卡５一鍵複製)
  const confirmBox = document.getElementById('travelCustomConfirmBox');
  const confirmTextEl = document.getElementById('travelCustomConfirmText');
  const btnCopyConfirm = document.getElementById('btnCopyTravelCustomConfirm');

  let customMsg = travel.customizedConfirmMessage || '';
  if (!customMsg && tp && Array.isArray(tp.history)) {
    const foundItem = tp.history.find(h => (h.travel && h.travel.customizedConfirmMessage) || (h.note && h.note.includes('旅遊小管家')));
    if (foundItem) {
      customMsg = (foundItem.travel && foundItem.travel.customizedConfirmMessage) || foundItem.note;
    }
  }

  if (confirmBox && confirmTextEl) {
    if (customMsg) {
      confirmBox.style.display = 'block';
      confirmTextEl.textContent = customMsg;
      confirmTextEl.onclick = () => {
        navigator.clipboard.writeText(customMsg).then(() => {
          showToast('📋 已複製旅平投保確認訊息！可切換至 LINE 貼上');
        });
      };
      if (btnCopyConfirm) {
        btnCopyConfirm.onclick = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(customMsg).then(() => {
            showToast('📋 已複製旅平投保確認訊息！可切換至 LINE 貼上');
          });
        };
      }
    } else {
      confirmBox.style.display = 'none';
    }
  }
}

function hideTravelDrawerUI() {
  const section = document.getElementById('travelInfoSection');
  if (section) section.style.display = 'none';
}

// 關閉所有抽屜與遮罩
function closeDrawers() {
  const quickLogDrawer = document.getElementById('quickLogDrawer');
  const topicDrawer = document.getElementById('topicManagerDrawer');
  const backdrop = document.getElementById('drawerBackdrop');

  if (quickLogDrawer) quickLogDrawer.classList.remove('open');
  if (topicDrawer) topicDrawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');

  // 若此案件是從「推進狀況彙總清單」開啟，關閉抽屜後立即返回推進清單並保留篩選狀態
  if (statusListModalState.returnAfterDrawerClose) {
    statusListModalState.returnAfterDrawerClose = false;
    openStatusListModal(null, true);
  }
}

// 渲染該儲存格的歷史時間軸
function renderTimelineHistory(touchpoint) {
  const listEl = document.getElementById('logTimelineList');
  const btnClearCell = document.getElementById('btnClearCellTouchpoint');
  const countBadge = document.getElementById('timelineCountBadge');
  if (!listEl) return;

  const count = (touchpoint && touchpoint.history) ? touchpoint.history.length : 0;
  if (countBadge) {
    countBadge.textContent = count > 0 ? `共 ${count} 筆` : '尚無紀錄';
  }

  if (!touchpoint || !touchpoint.history || touchpoint.history.length === 0) {
    listEl.innerHTML = `
      <div style="font-size:0.82rem; color:var(--text-muted); padding:32px 12px; text-align:center; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:var(--radius-sm); line-height:1.6;">
        <div style="font-size:1.6rem; margin-bottom:8px;">📝</div>
        <strong style="color:var(--text-secondary); display:block; margin-bottom:4px;">尚無歷史微紀錄</strong>
        請於左側填寫推進狀況與溝通重點<br>點擊「儲存微紀錄」即可建立時間軸！
      </div>
    `;
    if (btnClearCell) btnClearCell.style.display = 'none';
    return;
  }

  if (btnClearCell) btnClearCell.style.display = 'inline-flex';

  let html = '';
  touchpoint.history.forEach((item, index) => {
    const itemStatus = item.status || (index === 0 ? touchpoint.status : 'in_progress');
    const statusMeta = getStatusMeta(itemStatus);

    html += `
      <div class="timeline-item">
        <div class="timeline-item-header">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="timeline-date">${item.date}</span>
            <span class="status-pill ${statusMeta.className}" style="font-size:0.65rem; padding:1px 6px;">${statusMeta.label}</span>
            <span class="timeline-channel">${item.channel || '交流'}</span>
          </div>
          <div class="timeline-item-actions">
            <button type="button" class="timeline-edit-btn" data-action="edit-history-item" data-index="${index}" title="編輯此筆定聯紀錄">✏️</button>
            <button type="button" class="timeline-del-btn" data-action="delete-history-item" data-index="${index}" title="刪除此筆記錄">🗑️</button>
          </div>
        </div>
        <div class="timeline-summary">${escapeHTML(item.summary || '無紀錄內容')}</div>
        ${(item.remindClientTime || item.appointmentTime) ? `
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin: 4px 0 6px 0; font-size:0.75rem;">
            ${item.remindClientTime ? `<span style="background: rgba(245, 158, 11, 0.12); color: #d97706; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.25);">🔔 提醒對方：${escapeHTML(item.remindClientTime.replace('T', ' '))}</span>` : ''}
            ${item.appointmentTime ? `<span style="background: rgba(59, 130, 246, 0.12); color: #2563eb; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(59, 130, 246, 0.25);">🤝 約定／交付：${escapeHTML(item.appointmentTime.replace('T', ' '))}</span>` : ''}
          </div>
        ` : ''}
        ${item.nextAction ? `
          <div class="timeline-next">
            <span>下一步：</span>
            <span>${escapeHTML(item.nextAction)}</span>
          </div>
        ` : ''}
        ${item.transcript ? `
          <details class="transcript-card">
            <summary style="cursor: pointer; color: var(--accent-indigo); font-weight: 600;">🎙️ 查看會談錄音逐字稿 / AI 摘要</summary>
            <div class="transcript-content">${escapeHTML(item.transcript)}</div>
          </details>
        ` : ''}
      </div>
    `;
  });
  listEl.innerHTML = html;
}

// 開啟單一定聯微紀錄編輯 Modal
function openEditTimelineModal(index) {
  if (!state.activeCell) return;
  const { contactId, topicId } = state.activeCell;
  const key = `${contactId}_${topicId}`;
  const tp = state.touchpoints[key];
  if (!tp || !tp.history || !tp.history[index]) return;

  const item = tp.history[index];
  const modal = document.getElementById('editTimelineModal');
  const indexInput = document.getElementById('editTimelineHistoryIndex');
  const dateInput = document.getElementById('editTimelineDate');
  const channelInput = document.getElementById('editTimelineChannel');
  const statusInput = document.getElementById('editTimelineStatus');
  const remindTimeInput = document.getElementById('editTimelineRemindClientTime');
  const apptTimeInput = document.getElementById('editTimelineAppointmentTime');
  const summaryInput = document.getElementById('editTimelineSummary');
  const nextActionInput = document.getElementById('editTimelineNextAction');
  const transcriptInput = document.getElementById('editTimelineTranscript');

  if (indexInput) indexInput.value = index;
  if (dateInput) dateInput.value = item.date || '';
  if (channelInput) channelInput.value = item.channel || 'LINE';
  if (statusInput) statusInput.value = item.status || tp.status || 'in_progress';
  if (remindTimeInput) remindTimeInput.value = item.remindClientTime || '';
  if (apptTimeInput) apptTimeInput.value = item.appointmentTime || '';
  if (summaryInput) summaryInput.value = item.summary || '';
  if (nextActionInput) nextActionInput.value = item.nextAction || '';
  if (transcriptInput) transcriptInput.value = item.transcript || '';

  if (modal) modal.classList.add('open');
}

// 關閉單一定聯微紀錄編輯 Modal
function closeEditTimelineModal() {
  const modal = document.getElementById('editTimelineModal');
  if (modal) modal.classList.remove('open');
}

// 開啟議題管理抽屜 (Topic Manager Drawer)
function openTopicManagerDrawer() {
  renderTopicManagerList();
  const drawer = document.getElementById('topicManagerDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

// 渲染議題與子議題排序管理清單
function renderTopicManagerList() {
  const container = document.getElementById('topicManagerList');
  if (!container) return;

  const tmQuery = (state.filters.topicManagerSearch || '').trim().toLowerCase();
  const currentCategory = state.filters.topicManagerCategory || 'ALL';

  // 1. 更新抽屜頂部分類篩選按鈕狀態與數量計數
  const catFilterGroup = document.getElementById('tmCategoryFilterGroup');
  if (catFilterGroup) {
    catFilterGroup.querySelectorAll('.drawer-cat-chip').forEach(btn => {
      const cat = btn.getAttribute('data-cat');
      const count = cat === 'ALL' ? state.topics.length : state.topics.filter(t => t.category === cat).length;
      btn.textContent = cat === 'ALL' ? `全部 (${count})` : `${cat} (${count})`;
      if (cat === currentCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 2. 篩選目前作用中的議題清單
  let listTopics = [...state.topics];
  if (currentCategory !== 'ALL') {
    listTopics = listTopics.filter(t => t.category === currentCategory);
  }
  if (tmQuery) {
    listTopics = listTopics.filter(t => 
      (t.title && t.title.toLowerCase().includes(tmQuery)) ||
      (t.scriptTips && t.scriptTips.toLowerCase().includes(tmQuery)) ||
      (t.category && t.category.toLowerCase().includes(tmQuery))
    );
  }

  listTopics.sort((a, b) => (a.order || 99) - (b.order || 99));

  // 更新總數 Badge
  const countBadge = document.getElementById('tmItemCountBadge');
  if (countBadge) {
    countBadge.textContent = `共 ${listTopics.length} 個子議題`;
  }

  if (listTopics.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 28px 12px; color: var(--text-muted); font-size: 0.85rem;">
        查無符合條件的子議題
      </div>
    `;
    return;
  }

  let html = '';
  listTopics.forEach((topic, index) => {
    const catClass = getCategoryBadgeClass(topic.category);
    const isFirst = index === 0;
    const isLast = index === listTopics.length - 1;

    html += `
      <div class="topic-item-card ${!topic.isActive ? 'disabled' : ''}" draggable="true" data-id="${topic.id}">
        <div class="topic-drag-handle" title="按住拖曳可手動排序">⠿</div>
        <div class="topic-info-main">
          <div class="topic-badge-row">
            <span class="topic-order-pill">#${topic.order}</span>
            <span class="topic-header-category" style="background:var(--cat-${catClass}-bg); color:var(--cat-${catClass}); padding: 1px 7px; border-radius: var(--radius-full); font-size: 0.68rem; font-weight: 700;">
              ${topic.category}
            </span>
            ${topic.isSystem ? '<span style="background: rgba(14, 165, 233, 0.15); color: #0284c7; padding: 1px 7px; border-radius: var(--radius-full); font-size: 0.68rem; font-weight: 700; border: 1px solid rgba(14, 165, 233, 0.3);">🔒 系統專屬</span>' : ''}
            ${!topic.isActive ? '<span style="font-size:0.68rem; color:var(--text-muted);">(已停用)</span>' : ''}
          </div>
          <h4 class="topic-item-title">${escapeHTML(topic.title)}</h4>
          <p class="topic-item-tips">${escapeHTML(topic.scriptTips || '暫無內建說帖')}</p>
        </div>
        <div class="topic-actions">
          <button class="btn btn-secondary btn-edit-topic" data-id="${topic.id}" style="padding:4px 8px; font-size:0.75rem;">
            維護
          </button>
          <button class="btn-order-move btn-move-up" data-id="${topic.id}" title="往上移一位"${isFirst ? ' disabled' : ''}>↑</button>
          <button class="btn-order-move btn-move-down" data-id="${topic.id}" title="往下移一位"${isLast ? ' disabled' : ''}>↓</button>
          <button class="btn btn-secondary btn-toggle-topic" data-id="${topic.id}" style="padding:4px 8px; font-size:0.75rem;">
            ${topic.isActive ? '停用' : '啟用'}
          </button>
          ${topic.isSystem ? `
            <span style="font-size:0.7rem; color:var(--text-muted); padding:4px 6px;" title="系統專屬議題，禁止刪除">🔒 鎖定</span>
          ` : `
            <button class="btn btn-secondary btn-delete-topic" data-id="${topic.id}" style="padding:4px 8px; font-size:0.75rem; color:var(--accent-rose);">
              刪除
            </button>
          `}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;

  // 掛載拖曳重排事件
  attachTopicDragAndDrop();
}

// 拖曳重排子議題事件監聽
function attachTopicDragAndDrop() {
  const container = document.getElementById('topicManagerList');
  if (!container) return;

  const cards = container.querySelectorAll('.topic-item-card');
  let draggedCard = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    });

    card.addEventListener('dragend', () => {
      draggedCard = null;
      cards.forEach(c => {
        c.classList.remove('dragging');
        c.classList.remove('drag-over');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedCard && draggedCard !== card) {
        cards.forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (!draggedCard || draggedCard === card) return;

      const draggedId = draggedCard.getAttribute('data-id');
      const targetId = card.getAttribute('data-id');

      // 取得目前作用中清單順序並重新排列
      const allCards = Array.from(container.querySelectorAll('.topic-item-card'));
      const orderedIds = allCards.map(c => c.getAttribute('data-id'));

      const fromIndex = orderedIds.indexOf(draggedId);
      const toIndex = orderedIds.indexOf(targetId);

      if (fromIndex !== -1 && toIndex !== -1) {
        orderedIds.splice(fromIndex, 1);
        orderedIds.splice(toIndex, 0, draggedId);

        state.reorderTopics(orderedIds);
        renderTopicManagerList();
        renderMatrix();
        showToast('子議題順序已更新！');
      }
    });
  });
}

// 開啟單一子議題專屬維護 Modal（僅維護該特定議題，杜絕新增其他議題干擾）
function openTopicEditModal(topicId) {
  const topic = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  const modal = document.getElementById('topicEditModal');
  const titleEl = document.getElementById('topicEditModalTitle');
  const idInput = document.getElementById('editTopicId');
  const catInput = document.getElementById('editTopicCategory');
  const titleInput = document.getElementById('editTopicTitle');
  const orderInput = document.getElementById('editTopicOrder');
  const statusInput = document.getElementById('editTopicStatus');
  const tipsInput = document.getElementById('editTopicTips');
  if (titleEl) titleEl.textContent = `維護子議題：【${topic.title}】`;
  if (idInput) idInput.value = topic.id;
  if (catInput) catInput.value = topic.category;
  if (titleInput) titleInput.value = topic.title;
  if (orderInput) orderInput.value = topic.order || 99;
  if (statusInput) statusInput.value = topic.isActive ? 'ACTIVE' : 'INACTIVE';
  if (tipsInput) tipsInput.value = topic.scriptTips || '';

  if (modal) modal.classList.add('open');
}

// =============================================================================
// 議題戰略全地圖（大畫面 6 欄看板表格清單：第一行分類，向下子議題按鈕）
// =============================================================================
function openNextTopicStrategyModal(contactId, rejectedTopicId = null, isFromDrawer = false) {
  const contact = state.contacts.find(c => c.id === contactId);
  if (!contact) return;
  const rejectedTopic = rejectedTopicId ? state.topics.find(t => t.id === rejectedTopicId) : null;

  // 儲存當前彈窗的上下文情境 (由抽屜大按鈕叫出，或由婉拒自動跳出)
  state.strategyModalContext = {
    contactId,
    rejectedTopicId,
    isFromDrawer
  };

  const modal = document.getElementById('nextTopicStrategyModal');
  const tagEl = document.getElementById('nextTopicModalClientTag');
  const listContainer = document.getElementById('nextTopicStrategyList');

  // 頂部標題極簡化，僅呈現客戶姓名，杜絕長篇說教廢話
  if (tagEl) {
    const displayCName = typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name;
    tagEl.textContent = `（客戶：${displayCName}）`;
  }

  // 取得所有啟用的議題，並依分類分組
  const activeTopics = state.topics.filter(t => t.isActive);
  const rawCategories = Array.from(new Set(activeTopics.map(t => t.category || '一般議題')));
  
  // 優先排序 6 大主軸
  const PREFERRED_ORDER = ['身份接觸', '身分接觸', '風險管控', '投資理財', '稅務傳承', '生活議題', '組織增員', '公教客群'];
  const categories = [...rawCategories].sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a);
    const ib = PREFERRED_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'zh-TW');
  });

  let html = '';
  categories.forEach(cat => {
    const topicsInCat = activeTopics.filter(t => (t.category || '一般議題') === cat);
    if (topicsInCat.length === 0) return;

    html += `
      <div class="strategy-board-col">
        <div class="strategy-board-col-header">
          <span class="strategy-col-title">
            <span>${escapeHTML(cat)}</span>
          </span>
          <span class="strategy-col-count">${topicsInCat.length}</span>
        </div>
        <div class="strategy-board-col-body">
    `;

    topicsInCat.forEach(topic => {
      const isCurrentActive = Boolean(state.activeCell && state.activeCell.topicId === topic.id);
      const isCurrentRejected = Boolean(rejectedTopicId && topic.id === rejectedTopicId);
      const tp = state.getTouchpoint(contactId, topic.id);
      const statusKey = tp && tp.status ? tp.status : 'untouched';
      const statusMeta = getStatusMeta(statusKey);
      const hasHistory = Boolean(tp && tp.history && tp.history.length > 0);
      const isSelected = (state.pendingNextTopicId === topic.id);

      // 判斷是否為「根據原本客戶狀況，已經有設定的（有顏色、變淡、不能再按）」
      const isLocked = isCurrentActive || isCurrentRejected || (statusKey !== 'untouched') || hasHistory;

      if (isLocked) {
        let statusStyleClass = `status-${statusKey}`;
        let statusLabel = statusMeta.label;
        if (isCurrentActive) {
          statusStyleClass = 'status-current-active';
          statusLabel = '本次記錄中';
        } else if (isCurrentRejected) {
          statusStyleClass = 'status-rejected';
          statusLabel = '本次已婉拒';
        }

        // 純粹按鈕：僅顯示議題名稱，其餘全靠進度色彩區分（變淡且鎖定禁按）
        html += `
          <button type="button" 
                  class="strategy-subtopic-btn is-locked ${statusStyleClass}" 
                  disabled 
                  title="${escapeHTML(topic.title)} (${statusLabel})">
            <span>${escapeHTML(topic.title)}</span>
          </button>
        `;
      } else {
        // 剩下的議題：純粹清單按鈕，高對比點選推進
        html += `
          <button type="button" 
                  class="strategy-subtopic-btn is-available ${isSelected ? 'is-selected' : ''}" 
                  data-action="pick-strategy-topic" 
                  data-contact-id="${contact.id}" 
                  data-topic-id="${topic.id}"
                  title="選定【${escapeHTML(topic.title)}】為下一個推進議題">
            <span>${escapeHTML(topic.title)}</span>
          </button>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;
  });

  if (listContainer) {
    listContainer.innerHTML = html;
  }

  if (modal) modal.classList.add('open');
}

// 同步更新抽屜內大按鈕 (btnOpenStrategyMapDrawer) 顯示狀態
function syncDrawerStrategyHeroButton(selectedTitle = null) {
  const heroBtn = document.getElementById('btnOpenStrategyMapDrawer');
  const noticeEl = document.getElementById('drawerSelectedNextTopicNotice');
  const badgeEl = document.getElementById('drawerSelectedNextTopicBadge');
  const clearBtn = document.getElementById('btnClearNextPlannedTopic');

  if (!heroBtn) return;

  if (state.pendingNextTopicId) {
    const topic = state.topics.find(t => t.id === state.pendingNextTopicId);
    const title = topic ? topic.title : (selectedTitle || '已選定議題');
    heroBtn.classList.add('has-selected');
    if (noticeEl) {
      noticeEl.innerHTML = `🎯 已選定推進：<strong style="color:#7c3aed; font-size:0.76rem;">【${escapeHTML(title)}】</strong>（點擊更換）`;
    }
    if (badgeEl) {
      badgeEl.style.display = 'inline-block';
      badgeEl.textContent = '已選定';
    }
    if (clearBtn) {
      clearBtn.style.display = 'inline-flex';
    }
  } else {
    heroBtn.classList.remove('has-selected');
    if (noticeEl) {
      noticeEl.textContent = '點擊開啟大畫面全景清單，挑選下一個推進議題';
      noticeEl.style.color = '';
    }
    if (badgeEl) {
      badgeEl.style.display = 'none';
    }
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
  }
}

// 快速將某個議題設為預計提出，並雙向連動矩陣畫布與抽屜輸入框
function setNextPlannedTopic(contactId, topicId) {
  const contact = state.contacts.find(c => c.id === contactId);
  const topic = state.topics.find(t => t.id === topicId);
  if (!contact || !topic) return;

  const today = getLocalTodayDateString();
  state.saveTouchpointLog(contactId, topicId, {
    date: today,
    channel: '預計提出',
    status: 'planned',
    summary: `【戰略全地圖連動】已排定此議題為下一個推進焦點。`,
    nextAction: '準備相關切入素材與破冰時機',
    transcript: ''
  });

  // 連動更新抽屜輸入框與大按鈕狀態（若抽屜處於開啟或對應狀態）
  state.pendingNextTopicId = topicId;
  syncDrawerStrategyHeroButton(topic.title);
  const nextActionInput = document.getElementById('logNextActionInput');
  if (nextActionInput) {
    const currentVal = nextActionInput.value.trim();
    if (currentVal && !currentVal.startsWith('預計提出【')) {
      nextActionInput.value = `預計提出【${topic.title}】（${currentVal}）`;
    } else {
      nextActionInput.value = `預計提出【${topic.title}】`;
    }
  }

  closeModals();
  renderMatrix();
  showToast(`已成功連動！已將【${topic.title}】設為 ${contact.name} 的下一個預計提出議題！`, 'success');
}

// 開啟客戶名單編輯/新增 Modal
function openContactModal(contactId = null) {
  const modal = document.getElementById('contactModal');
  const titleEl = document.getElementById('contactModalTitle');
  const idInput = document.getElementById('editContactId');
  const nameInput = document.getElementById('contactNameInput');
  const nicknameInput = document.getElementById('contactNicknameInput');
  const catInput = document.getElementById('contactCategoryInput');
  const phoneInput = document.getElementById('contactPhoneInput');
  const mbtiInput = document.getElementById('contactMbtiInput');
  const primaryInput = document.getElementById('contactDiscPrimaryInput');
  const secondaryInput = document.getElementById('contactDiscSecondaryInput');
  const tagsInput = document.getElementById('contactTagsInput');
  const notesInput = document.getElementById('contactNotesInput');

  const btnDelete = document.getElementById('btnDeleteCurrentContact');
  let contact = null;
  let pDisc = '';
  let sDisc = '';

  if (contactId) {
    contact = state.contacts.find(c => c.id === contactId);
    if (!contact) return;
    if (btnDelete) btnDelete.style.display = 'inline-flex';
    if (titleEl) titleEl.textContent = '編輯客戶名單';
    if (idInput) idInput.value = contact.id;
    if (nameInput) nameInput.value = contact.name;
    if (nicknameInput) nicknameInput.value = contact.nickname || '';
    if (catInput) catInput.value = contact.category || '';
    if (phoneInput) phoneInput.value = contact.phone || '';
    if (mbtiInput) mbtiInput.value = contact.mbti || '';

    if (contact.discPrimary || contact.discSecondary) {
      pDisc = contact.discPrimary || '';
      sDisc = contact.discSecondary || '';
    } else if (contact.disc) {
      const raw = String(contact.disc).trim().replace(/型$/, '');
      if (raw === '變色龍') {
        pDisc = '變色龍';
        sDisc = '';
      } else if (raw.includes('/')) {
        const parts = raw.split('/');
        pDisc = parts[0] || '';
        sDisc = parts[1] || '';
      } else if (raw.length === 2 && ['D','I','S','C'].includes(raw[0].toUpperCase()) && ['D','I','S','C'].includes(raw[1].toUpperCase())) {
        pDisc = raw[0].toUpperCase();
        sDisc = raw[1].toUpperCase();
      } else {
        pDisc = raw;
        sDisc = '';
      }
    }
    if (primaryInput) primaryInput.value = pDisc;
    if (secondaryInput) secondaryInput.value = sDisc;

    if (tagsInput) tagsInput.value = (contact.tags || []).join(', ');
    if (notesInput) notesInput.value = contact.notes || '';
  } else {
    if (btnDelete) btnDelete.style.display = 'none';
    if (titleEl) {
      if (state.clientType === 'CORPORATE') {
        titleEl.textContent = '新增企業客戶';
      } else if (state.clientType === 'RECRUIT') {
        titleEl.textContent = '新增準增員對象 (組織發展)';
      } else {
        titleEl.textContent = '新增客戶名單';
      }
    }
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (nicknameInput) nicknameInput.value = '';
    if (catInput) {
      if (state.clientType === 'CORPORATE') {
        catInput.value = '中小企業主';
      } else if (state.clientType === 'RECRUIT') {
        catInput.value = '事業合夥/準增員';
      } else {
        catInput.value = '';
      }
    }
    if (phoneInput) phoneInput.value = '';
    if (mbtiInput) mbtiInput.value = '';
    if (primaryInput) primaryInput.value = '';
    if (secondaryInput) secondaryInput.value = '';
    if (tagsInput) tagsInput.value = '';
    if (notesInput) notesInput.value = '';
  }

  // 關注按鈕狀態設定
  const btnFocus = document.getElementById('btnToggleFocus');
  if (btnFocus) {
    const isFoc = !!(contact && contact.isFocused);
    btnFocus.setAttribute('data-checked', isFoc ? 'true' : 'false');
    const starIcon = btnFocus.querySelector('.focus-toggle-icon');
    if (starIcon) starIcon.textContent = isFoc ? '⭐' : '☆';
  }

  // 列管按鈕狀態設定
  const btnControlled = document.getElementById('btnToggleControlled');
  if (btnControlled) {
    const isCtrl = !!(contact && contact.isControlled);
    btnControlled.setAttribute('data-checked', isCtrl ? 'true' : 'false');
  }

  // 吃素按鈕狀態設定
  const btnVeg = document.getElementById('btnToggleVegetarian');
  if (btnVeg) {
    const isVeg = !!(contact && contact.isVegetarian);
    btnVeg.setAttribute('data-checked', isVeg ? 'true' : 'false');
  }

  // 客戶類型歸屬勾選按鈕狀態設定 (個人、企業、準增員)
  const btnTypeInd = document.getElementById('btnToggleTypeIndividual');
  const btnTypeCorp = document.getElementById('btnToggleTypeCorporate');
  const btnTypeRec = document.getElementById('btnToggleTypeRecruit');

  if (contact) {
    const isCorp = (typeof isClientCorporate === 'function')
      ? isClientCorporate(contact, state.touchpoints, state.topics)
      : (contact.isCorporate !== undefined ? !!contact.isCorporate : (contact.clientType === 'CORPORATE' || (contact.category && /企業|董座|董事長|總經理|法人|企業主/.test(contact.category))));
    const isRec = (typeof isClientRecruit === 'function') ? isClientRecruit(contact) : !!contact.isRecruit;
    const isInd = (typeof isClientIndividual === 'function')
      ? isClientIndividual(contact)
      : (contact.isIndividual !== undefined ? !!contact.isIndividual : (contact.clientType !== 'CORPORATE'));

    if (btnTypeInd) btnTypeInd.setAttribute('data-checked', isInd ? 'true' : 'false');
    if (btnTypeCorp) btnTypeCorp.setAttribute('data-checked', isCorp ? 'true' : 'false');
    if (btnTypeRec) btnTypeRec.setAttribute('data-checked', isRec ? 'true' : 'false');
  } else {
    // 新增狀態預設值
    const curType = state.clientType || 'INDIVIDUAL';
    if (btnTypeInd) btnTypeInd.setAttribute('data-checked', curType === 'INDIVIDUAL' ? 'true' : 'false');
    if (btnTypeCorp) btnTypeCorp.setAttribute('data-checked', curType === 'CORPORATE' ? 'true' : 'false');
    if (btnTypeRec) btnTypeRec.setAttribute('data-checked', curType === 'RECRUIT' ? 'true' : 'false');
  }

  // 同步更新 MBTI 16 型晶片與 DISC 雙軌秒選晶片選取狀態
  const currentMbti = (contactId && contact) ? (contact.mbti || '') : '';
  updateMbtiChipUI(currentMbti);
  updateDiscChipUI(pDisc, sDisc);

  // 同步更新家庭車庫車籍資料清單
  renderContactGarage(contactId);

  // 同步更新學生/準增員課表作息資料區塊
  renderContactScheduleSection(contactId);

  // 記錄初始表單快照，用於關閉時防呆判斷是否有未儲存的修改
  initialContactFormData = getContactFormData();

  if (modal) {
    modal.classList.add('open');
    // 自動聚焦於姓名欄位，節省游標移動與點擊動作 (ADHD / 極致流暢操作)
    setTimeout(() => {
      if (nameInput) {
        nameInput.focus();
        if (contactId && nameInput.select) {
          nameInput.select();
        }
      }
    }, 60);
  }
}

// 更新 MBTI 4維度二選一 (4x2 矩陣) UI
function updateMbtiChipUI(val = '') {
  const mbtiInput = document.getElementById('contactMbtiInput');
  const upperVal = String(val || '').toUpperCase().trim();
  if (mbtiInput) mbtiInput.value = upperVal;

  const dimValues = {
    '0': upperVal.includes('E') ? 'E' : (upperVal.includes('I') ? 'I' : ''),
    '1': upperVal.includes('S') ? 'S' : (upperVal.includes('N') ? 'N' : ''),
    '2': upperVal.includes('T') ? 'T' : (upperVal.includes('F') ? 'F' : ''),
    '3': upperVal.includes('J') ? 'J' : (upperVal.includes('P') ? 'P' : '')
  };

  const buttons = document.querySelectorAll('#mbtiDimGrid .mbti-dim-btn');
  buttons.forEach(btn => {
    const dim = btn.getAttribute('data-dim');
    const bVal = btn.getAttribute('data-val');
    if (dimValues[dim] === bVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const selectedTag = document.getElementById('mbtiSelectedTag');
  if (selectedTag) {
    selectedTag.textContent = upperVal ? upperVal : '';
  }

  updateTraitPreviewUI();
}

// 更新 DISC 雙軌秒選晶片 UI (主要 + 輔助)
function updateDiscChipUI(pVal = '', sVal = '') {
  const pInput = document.getElementById('contactDiscPrimaryInput');
  const sInput = document.getElementById('contactDiscSecondaryInput');
  if (pInput) pInput.value = pVal;
  if (sInput) sInput.value = sVal;

  const pChips = document.querySelectorAll('#discPrimaryChips .disc-chip');
  pChips.forEach(chip => {
    const val = chip.getAttribute('data-val') || '';
    if (val === pVal) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  const sChips = document.querySelectorAll('#discSecondaryChips .disc-chip');
  sChips.forEach(chip => {
    const val = chip.getAttribute('data-val') || '';
    if (val === sVal) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  updateTraitPreviewUI();
}

// 即時連動更新首頁預覽徽章
function updateTraitPreviewUI() {
  const mbti = document.getElementById('contactMbtiInput')?.value.trim() || '';
  const pDisc = document.getElementById('contactDiscPrimaryInput')?.value.trim() || '';
  const sDisc = document.getElementById('contactDiscSecondaryInput')?.value.trim() || '';

  let discFormatted = '';
  if (pDisc && sDisc && sDisc !== pDisc) {
    if (pDisc === '變色龍' || sDisc === '變色龍') {
      discFormatted = `${pDisc}/${sDisc}`;
    } else {
      discFormatted = `${pDisc}${sDisc}型`;
    }
  } else if (pDisc) {
    discFormatted = pDisc === '變色龍' ? '變色龍' : `${pDisc}型`;
  } else if (sDisc) {
    discFormatted = sDisc === '變色龍' ? '變色龍' : `${sDisc}型`;
  }

  const container = document.getElementById('traitPreviewBadges');
  if (!container) return;

  if (!mbti && !discFormatted) {
    container.innerHTML = '<span class="preview-placeholder">（未設定特質）</span>';
  } else {
    let html = '';
    if (mbti) {
      html += `<span class="trait-badge mbti" style="font-size:0.76rem; padding:3px 7px;">${escapeHTML(mbti)}</span>`;
    }
    if (discFormatted) {
      html += `<span class="trait-badge disc" style="font-size:0.76rem; padding:3px 7px;">${escapeHTML(discFormatted)}</span>`;
    }
    container.innerHTML = html;
  }
}

// 取得客戶表單當前內容快照
function getContactFormData() {
  return {
    name: document.getElementById('contactNameInput')?.value.trim() || '',
    category: document.getElementById('contactCategoryInput')?.value.trim() || '',
    phone: document.getElementById('contactPhoneInput')?.value.trim() || '',
    mbti: document.getElementById('contactMbtiInput')?.value.trim() || '',
    discPrimary: document.getElementById('contactDiscPrimaryInput')?.value.trim() || '',
    discSecondary: document.getElementById('contactDiscSecondaryInput')?.value.trim() || '',
    tags: document.getElementById('contactTagsInput')?.value.trim() || '',
    notes: document.getElementById('contactNotesInput')?.value.trim() || '',
    isFocused: document.getElementById('btnToggleFocus')?.getAttribute('data-checked') === 'true',
    isControlled: document.getElementById('btnToggleControlled')?.getAttribute('data-checked') === 'true',
    isVegetarian: document.getElementById('btnToggleVegetarian')?.getAttribute('data-checked') === 'true',
    isIndividual: document.getElementById('btnToggleTypeIndividual')?.getAttribute('data-checked') === 'true',
    isCorporate: document.getElementById('btnToggleTypeCorporate')?.getAttribute('data-checked') === 'true',
    isRecruit: document.getElementById('btnToggleTypeRecruit')?.getAttribute('data-checked') === 'true',
    scheduleSemester: document.getElementById('scheduleSemesterInput')?.value.trim() || '',
    scheduleFreeTime: document.getElementById('scheduleFreeTimeInput')?.value.trim() || ''
  };
}

let initialContactFormData = null;

// 檢查客戶名單表單是否有未儲存修改
function isContactFormDirty() {
  if (!initialContactFormData) return false;
  const current = getContactFormData();
  return Object.keys(initialContactFormData).some(key => initialContactFormData[key] !== current[key]);
}

// 安全關閉客戶名單 Modal (含未儲存防呆)
function safeCloseContactModal() {
  if (isContactFormDirty()) {
    if (!confirm('【防呆提示】您有修改過客戶資料但尚未儲存！\n\n確定要放棄修改並關閉嗎？')) {
      return false;
    }
  }
  initialContactFormData = null;
  closeModals();
  if (statusListModalState.returnAfterContactModalClose) {
    statusListModalState.returnAfterContactModalClose = false;
    openStatusListModal(null, true);
  }
  return true;
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  // 防呆：徹底淨空課表暫存剪貼簿與上傳資料，杜絕跨客戶 DOM 狀態污染外洩 (DOM Bleed-over Prevention)
  const dropZone = document.getElementById('scheduleDropPasteZone');
  if (dropZone) {
    dropZone.removeAttribute('data-pending-image-data');
    dropZone.removeAttribute('data-pending-file-name');
    dropZone.removeAttribute('data-pending-file-size');
  }
}

// 吐司提示訊息 (Toast)
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2400);
}

// =============================================================================
// 家庭車庫與車籍資料渲染控制器 (Family Vehicle Garage Modal Controllers)
// =============================================================================

// 渲染特定客戶的家庭車庫清單
function renderContactGarage(contactId) {
  const container = document.getElementById('contactVehicleList');
  const countBadge = document.getElementById('contactGarageCountBadge');
  const btnAdd = document.getElementById('btnAddNewVehicleToContact');
  if (!container) return;

  if (!contactId) {
    if (countBadge) countBadge.textContent = '0 台';
    if (btnAdd) btnAdd.style.display = 'none';
    container.innerHTML = `
      <div class="vehicle-empty-state">
        <span style="font-size: 1.4rem; display: block; margin-bottom: 4px;">🚗</span>
        <span>建立新客戶基本資料並儲存後，即可為此家庭登錄車輛與行照！</span>
      </div>
    `;
    return;
  }

  if (btnAdd) btnAdd.style.display = 'inline-flex';
  const vehicles = state.getVehiclesByContactId(contactId);
  if (countBadge) countBadge.textContent = `${vehicles.length} 台`;

  if (vehicles.length === 0) {
    container.innerHTML = `
      <div class="vehicle-empty-state">
        <span style="font-size: 1.4rem; display: block; margin-bottom: 4px;">🚗</span>
        <span>此家庭車庫目前尚無車籍資料，點擊上方「＋ 新增車輛」開始建檔。</span>
      </div>
    `;
    return;
  }

  const contact = state.contacts.find(c => c.id === contactId);
  const contactName = contact ? contact.name : '';
  const today = new Date().toISOString().split('T')[0];
  let html = '';

  vehicles.forEach(veh => {
    // 檢查保險到期剩餘天數
    let expiryHtml = '';
    let expirySimpleTag = '';
    if (veh.insuranceExpiryDate) {
      const diffMs = new Date(veh.insuranceExpiryDate).getTime() - new Date(today).getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        expiryHtml = `<span class="vehicle-expiry-badge urgent">⚠️ 已逾期 (${escapeHTML(veh.insuranceExpiryDate)})</span>`;
        expirySimpleTag = `<span style="font-size:0.7rem; color:#b91c1c; font-weight:700;">(已逾期)</span>`;
      } else if (diffDays <= 30) {
        expiryHtml = `<span class="vehicle-expiry-badge urgent">🔔 剩 ${diffDays} 天 (${escapeHTML(veh.insuranceExpiryDate)})</span>`;
        expirySimpleTag = `<span style="font-size:0.7rem; color:#b91c1c; font-weight:700;">(剩${diffDays}天)</span>`;
      } else if (diffDays <= 60) {
        expiryHtml = `<span class="vehicle-expiry-badge" style="border-color:#d97706; color:#b45309;">⏳ 剩 ${diffDays} 天 (${escapeHTML(veh.insuranceExpiryDate)})</span>`;
        expirySimpleTag = `<span style="font-size:0.7rem; color:#b45309; font-weight:700;">(剩${diffDays}天)</span>`;
      } else {
        expiryHtml = `<span class="vehicle-expiry-badge">到期日：${escapeHTML(veh.insuranceExpiryDate)}</span>`;
      }
    }

    const isMoto = veh.vehicleType === 'MOTORCYCLE' || veh.vehicleType === 'HEAVY_MOTO';
    const typeLabel = veh.vehicleType === 'MOTORCYCLE' ? '普通機車' : (veh.vehicleType === 'HEAVY_MOTO' ? '大型重機' : (veh.vehicleType === 'TRUCK' ? '小貨車' : '自用汽車'));
    const cleanDisplacement = veh.displacement ? String(veh.displacement).replace(/[^0-9]/g, '') : '';

    // 產險報價規格日期換算 (民國/西元一鍵即抄)
    const birthMeta = typeof formatRocBirthDate === 'function' ? formatRocBirthDate(veh.ownerBirthDate) : { roc7: veh.ownerBirthDate, ad: veh.ownerBirthDate };
    const mfgMeta = typeof formatManufactureDate === 'function' ? formatManufactureDate(veh.manufactureDate) : { adDigits: veh.manufactureDate, rocSlash: veh.manufactureDate };
    const issueMeta = typeof formatIssueDate === 'function' ? formatIssueDate(veh.issueDate) : { rocSlash: veh.issueDate, ad: veh.issueDate };

    // 行照縮圖或預設圖示 (點擊可燈箱放大)
    let thumbHtml = '';
    if (veh.licenseImage) {
      thumbHtml = `
        <div class="license-thumb-card btn-view-license-lightbox" data-img-src="${escapeHTML(veh.licenseImage)}" data-img-title="${escapeHTML(veh.ownerName || contactName)} - ${escapeHTML(veh.plateNumber)} 行照" title="點擊放大檢視行照原圖">
          <img src="${escapeHTML(veh.licenseImage)}" alt="行照縮圖">
        </div>
      `;
    } else {
      thumbHtml = `
        <div class="license-thumb-card btn-edit-vehicle" data-vehicle-id="${veh.id}" title="尚未上傳行照照片，點擊編輯補齊">
          <span style="font-size: 1.1rem; opacity: 0.6;">📄</span>
        </div>
      `;
    }

    html += `
      <div class="vehicle-card" data-vehicle-id="${veh.id}">
        <!-- ★ 主要核心顯示區：車型、車主、車台、排氣、到期日 ★ -->
        <div class="vehicle-primary-summary">
          <div class="vehicle-5-props-grid">
            <!-- 1. 車型 -->
            <div class="veh-prop-item">
              <span class="veh-prop-label">車型</span>
              <span class="veh-prop-val strong-val" title="${escapeHTML(veh.brand || '')} ${escapeHTML(veh.modelType || '')}">${escapeHTML(veh.brand || '')} ${escapeHTML(veh.modelType || '')}</span>
            </div>
            <!-- 2. 車主 -->
            <div class="veh-prop-item">
              <span class="veh-prop-label">車主</span>
              <span class="veh-prop-val" title="${escapeHTML(veh.ownerName || contactName)}">${escapeHTML(veh.ownerName || contactName)}</span>
            </div>
            <!-- 3. 車台 (車台/車牌) -->
            <div class="veh-prop-item">
              <span class="veh-prop-label">車台</span>
              <span class="veh-prop-val plate-val" title="${escapeHTML(veh.plateNumber)} (${typeLabel})">${escapeHTML(veh.plateNumber)} <small style="font-size:0.7rem; font-weight:normal; color:var(--text-secondary);">(${typeLabel})</small></span>
            </div>
            <!-- 4. 排氣 -->
            <div class="veh-prop-item">
              <span class="veh-prop-label">排氣</span>
              <span class="veh-prop-val">${cleanDisplacement ? `${cleanDisplacement} cc` : '未載'}</span>
            </div>
            <!-- 5. 到期日 -->
            <div class="veh-prop-item">
              <span class="veh-prop-label">到期日</span>
              <span class="veh-prop-val expiry-val">${veh.insuranceExpiryDate ? escapeHTML(veh.insuranceExpiryDate) : '未設定'} ${expirySimpleTag}</span>
            </div>
          </div>

          <!-- 展開/收合詳細資料按鈕 -->
          <button type="button" class="btn-toggle-veh-details" data-veh-id="${veh.id}">
            <span>▾ 展開詳細資料</span>
          </button>
        </div>

        <!-- ★ 詳細資料折疊面板 (報價規格雙軌速抄、險種保額、行照、操作) ★ -->
        <div class="vehicle-card-details-panel" id="veh-details-${veh.id}" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 2px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="vehicle-type-badge ${isMoto ? 'motorcycle' : ''}">${typeLabel}</span>
              <span class="vehicle-driver-relation">主駕：${escapeHTML(veh.primaryDriver || veh.ownerName || contactName)} (${escapeHTML(veh.primaryDriverRelation || '本人')})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${expiryHtml}
              ${thumbHtml}
            </div>
          </div>

          <!-- 產險報價規格一鍵速抄晶片 (符合台灣各大產險投保規格) -->
          <div class="copy-chips-grid">
            <div class="copy-chip" data-copy-val="${escapeHTML(veh.plateNumber)}" title="點擊秒複製車牌號碼">
              <span class="copy-chip-label">車牌</span>
              <span class="copy-chip-val">${escapeHTML(veh.plateNumber)}</span>
              <span class="copy-chip-icon">📋</span>
            </div>
            <div class="copy-chip" data-copy-val="${escapeHTML(veh.ownerIdNumber)}" title="點擊秒複製車主身分證字號">
              <span class="copy-chip-label">車主ID</span>
              <span class="copy-chip-val">${escapeHTML(veh.ownerIdNumber)}</span>
              <span class="copy-chip-icon">📋</span>
            </div>
            ${birthMeta.roc7 ? `
              <div class="copy-chip chip-highlight" data-copy-val="${escapeHTML(birthMeta.roc7)}" title="點擊秒複製【民國7碼】出生年月日：${escapeHTML(birthMeta.roc7)} (產險投保必填規格)">
                <span class="copy-chip-label">出生(民國)</span>
                <span class="copy-chip-val">${escapeHTML(birthMeta.roc7)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${birthMeta.ad ? `
              <div class="copy-chip" data-copy-val="${escapeHTML(birthMeta.ad)}" title="點擊秒複製【西元】出生年月日：${escapeHTML(birthMeta.ad)}">
                <span class="copy-chip-label">出生(西元)</span>
                <span class="copy-chip-val">${escapeHTML(birthMeta.ad)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${mfgMeta.adDigits ? `
              <div class="copy-chip chip-highlight" data-copy-val="${escapeHTML(mfgMeta.adDigits)}" title="點擊秒複製【西元6碼】出廠年月：${escapeHTML(mfgMeta.adDigits)} (產險系統預設)">
                <span class="copy-chip-label">出廠(西元)</span>
                <span class="copy-chip-val">${escapeHTML(mfgMeta.adDigits)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${mfgMeta.rocSlash ? `
              <div class="copy-chip" data-copy-val="${escapeHTML(mfgMeta.rocSlash)}" title="點擊秒複製【民國】出廠年月：${escapeHTML(mfgMeta.rocSlash)}">
                <span class="copy-chip-label">出廠(民國)</span>
                <span class="copy-chip-val">${escapeHTML(mfgMeta.rocSlash)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${issueMeta.rocSlash ? `
              <div class="copy-chip chip-highlight" data-copy-val="${escapeHTML(issueMeta.rocSlash)}" title="點擊秒複製【民國】發照日期：${escapeHTML(issueMeta.rocSlash)} (監理站與產險原樣)">
                <span class="copy-chip-label">發照(民國)</span>
                <span class="copy-chip-val">${escapeHTML(issueMeta.rocSlash)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${issueMeta.ad ? `
              <div class="copy-chip" data-copy-val="${escapeHTML(issueMeta.ad)}" title="點擊秒複製【西元】發照日期：${escapeHTML(issueMeta.ad)}">
                <span class="copy-chip-label">發照(西元)</span>
                <span class="copy-chip-val">${escapeHTML(issueMeta.ad)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${cleanDisplacement ? `
              <div class="copy-chip chip-highlight" data-copy-val="${escapeHTML(cleanDisplacement)}" title="點擊秒複製【純數字】排氣量：${escapeHTML(cleanDisplacement)} (直接貼上不用手動刪除 cc)">
                <span class="copy-chip-label">排氣(數字)</span>
                <span class="copy-chip-val">${escapeHTML(cleanDisplacement)} cc</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${veh.vinNumber ? `
              <div class="copy-chip" data-copy-val="${escapeHTML(veh.vinNumber)}" title="點擊秒複製車身號碼 (VIN)">
                <span class="copy-chip-label">車身(VIN)</span>
                <span class="copy-chip-val">${escapeHTML(veh.vinNumber)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
            ${veh.engineNumber ? `
              <div class="copy-chip" data-copy-val="${escapeHTML(veh.engineNumber)}" title="點擊秒複製引擎號碼">
                <span class="copy-chip-label">引擎號碼</span>
                <span class="copy-chip-val">${escapeHTML(veh.engineNumber)}</span>
                <span class="copy-chip-icon">📋</span>
              </div>
            ` : ''}
          </div>

          <!-- 🛡️ 目前投保險種、代號與保額明細 (客戶隨身速查神器) -->
          ${veh.coverages && veh.coverages.length > 0 ? `
            <div class="vehicle-coverages-block">
              <div class="coverages-block-header">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="font-size: 0.85rem;">🛡️</span>
                  <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-main);">${escapeHTML(veh.insuranceCompany || '投保險種與保額明細')}</span>
                  ${veh.policyNumber ? `<span style="font-size: 0.72rem; color: var(--text-muted);">(${escapeHTML(veh.policyNumber)})</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${veh.premiumTotal ? `<span class="premium-total-tag">保費: ${escapeHTML(veh.premiumTotal)} 元</span>` : ''}
                  <button type="button" class="btn-copy-coverage-breakdown" data-vehicle-id="${veh.id}" title="複製整份投保險種代號與保額明細，秒回客戶！">
                    <span>📋 複製保險明細</span>
                  </button>
                </div>
              </div>
              <div class="coverage-items-table">
                ${veh.coverages.map(cov => `
                  <div class="coverage-item-row">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap;">
                      <span class="coverage-code-pill" title="險種代號">${escapeHTML(cov.code)}</span>
                      <span class="coverage-name-text">${escapeHTML(cov.name)}</span>
                      <span class="coverage-amount-text">${escapeHTML(cov.insuredAmount)}</span>
                      ${cov.deductible ? `<span class="coverage-deductible-tag">自負額:${escapeHTML(cov.deductible)}</span>` : ''}
                      ${cov.premium ? `<span style="font-size:0.7rem; color:var(--text-muted);">${escapeHTML(cov.premium)}元</span>` : ''}
                    </div>
                    <button type="button" class="btn-copy-field-mini" data-copy-val="【代號 ${escapeHTML(cov.code)} ${escapeHTML(cov.name)}】${escapeHTML(cov.insuredAmount)}${cov.deductible ? ' (自負額:' + escapeHTML(cov.deductible) + ')' : ''}" title="複製此險種項目與保額">
                      複製
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 卡片底部快捷操作 -->
          <div class="vehicle-card-actions">
            <button type="button" class="btn-copy-quote-full btn-copy-vehicle-full-quote" data-vehicle-id="${veh.id}" title="複製整包車籍格式化文字，方便到產險系統快速投保">
              <span>📋 一鍵全單秒抄 (產險速抄)</span>
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm btn-edit-vehicle" data-vehicle-id="${veh.id}" style="font-size: 0.74rem; padding: 3px 8px;">
                <span>✏️ 編輯車籍</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-delete-vehicle" data-vehicle-id="${veh.id}" style="font-size: 0.74rem; padding: 3px 8px; color: var(--accent-rose); border-color: rgba(179, 82, 82, 0.3);">
                <span>🗑️ 刪除</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 開啟車籍編輯與速抄彈窗
function openVehicleModal(contactId, vehicleId = null) {
  const modal = document.getElementById('vehicleModal');
  const titleEl = document.getElementById('vehicleModalTitle');
  const tagEl = document.getElementById('vehicleModalClientTag');
  const idInput = document.getElementById('editVehicleId');
  const contactIdInput = document.getElementById('editVehicleContactId');
  const btnDelete = document.getElementById('btnDeleteCurrentVehicle');

  const contact = state.contacts.find(c => c.id === contactId);
  const contactName = contact ? (typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name) : '';
  if (tagEl) tagEl.textContent = contactName ? `(${contactName} 家庭車庫)` : '';

  if (contactIdInput) contactIdInput.value = contactId;

  const plateInput = document.getElementById('vehPlateNumber');
  const typeSelect = document.getElementById('vehVehicleType');
  const capacityInput = document.getElementById('vehPassengerCapacity');
  const ownerNameInput = document.getElementById('vehOwnerName');
  const ownerIdInput = document.getElementById('vehOwnerIdNumber');
  const birthInput = document.getElementById('vehOwnerBirthDate');
  const driverInput = document.getElementById('vehPrimaryDriver');
  const relationSelect = document.getElementById('vehPrimaryDriverRelation');
  const expiryInput = document.getElementById('vehInsuranceExpiryDate');
  const brandInput = document.getElementById('vehBrand');
  const modelInput = document.getElementById('vehModelType');
  const dispInput = document.getElementById('vehDisplacement');
  const engineInput = document.getElementById('vehEngineNumber');
  const vinInput = document.getElementById('vehVinNumber');
  const mfgInput = document.getElementById('vehManufactureDate');
  const issueInput = document.getElementById('vehIssueDate');
  const imgInput = document.getElementById('vehLicenseImageInput');
  const fileInput = document.getElementById('vehLicenseFileInput');
  const notesInput = document.getElementById('vehNotesInput');
  const insCompanyInput = document.getElementById('vehInsuranceCompany');
  const policyNumInput = document.getElementById('vehPolicyNumber');
  const premiumTotalInput = document.getElementById('vehPremiumTotal');
  const coveragesInput = document.getElementById('vehCoveragesInput');

  if (fileInput) fileInput.value = '';

  if (vehicleId) {
    const veh = state.getVehicle(vehicleId);
    if (!veh) return;
    if (titleEl) titleEl.textContent = `🚗 編輯車籍檔案 - ${veh.plateNumber}`;
    if (idInput) idInput.value = veh.id;
    if (plateInput) plateInput.value = veh.plateNumber || '';
    if (typeSelect) typeSelect.value = veh.vehicleType || 'CAR';
    if (capacityInput) capacityInput.value = veh.passengerCapacity || 5;
    if (ownerNameInput) ownerNameInput.value = veh.ownerName || '';
    if (ownerIdInput) ownerIdInput.value = veh.ownerIdNumber || '';
    if (birthInput) birthInput.value = veh.ownerBirthDate || '';
    if (driverInput) driverInput.value = veh.primaryDriver || '';
    if (relationSelect) relationSelect.value = veh.primaryDriverRelation || '本人';
    if (expiryInput) expiryInput.value = veh.insuranceExpiryDate || '';
    if (brandInput) brandInput.value = veh.brand || '';
    if (modelInput) modelInput.value = veh.modelType || '';
    if (dispInput) dispInput.value = veh.displacement || '';
    if (engineInput) engineInput.value = veh.engineNumber || '';
    if (vinInput) vinInput.value = veh.vinNumber || '';
    if (mfgInput) mfgInput.value = veh.manufactureDate || '';
    if (issueInput) issueInput.value = veh.issueDate || '';
    if (imgInput) imgInput.value = veh.licenseImage || '';
    if (notesInput) notesInput.value = veh.notes || '';
    if (insCompanyInput) insCompanyInput.value = veh.insuranceCompany || '';
    if (policyNumInput) policyNumInput.value = veh.policyNumber || '';
    if (premiumTotalInput) premiumTotalInput.value = veh.premiumTotal !== undefined ? veh.premiumTotal : '';

    if (coveragesInput) {
      if (veh.coverages && veh.coverages.length > 0) {
        coveragesInput.value = veh.coverages.map(c => `${c.code} ${c.name} ${c.insuredAmount}${c.deductible ? ' ' + c.deductible : ''}`).join('\n');
      } else {
        coveragesInput.value = '';
      }
    }

    if (btnDelete) btnDelete.style.display = 'inline-flex';

    updateVehicleLicensePreview(veh.licenseImage);
  } else {
    if (titleEl) titleEl.textContent = `🚗 新增車輛至家庭車庫`;
    if (idInput) idInput.value = '';
    if (plateInput) plateInput.value = '';
    if (typeSelect) typeSelect.value = 'CAR';
    if (capacityInput) capacityInput.value = 5;
    if (ownerNameInput) ownerNameInput.value = contactName;
    if (ownerIdInput) ownerIdInput.value = '';
    if (birthInput) birthInput.value = '';
    if (driverInput) driverInput.value = contactName;
    if (relationSelect) relationSelect.value = '本人';
    if (expiryInput) expiryInput.value = '';
    if (brandInput) brandInput.value = '';
    if (modelInput) modelInput.value = '';
    if (dispInput) dispInput.value = '';
    if (engineInput) engineInput.value = '';
    if (vinInput) vinInput.value = '';
    if (mfgInput) mfgInput.value = '';
    if (issueInput) issueInput.value = '';
    if (imgInput) imgInput.value = '';
    if (notesInput) notesInput.value = '';
    if (insCompanyInput) insCompanyInput.value = '';
    if (policyNumInput) policyNumInput.value = '';
    if (premiumTotalInput) premiumTotalInput.value = '';
    if (coveragesInput) coveragesInput.value = '';
    if (btnDelete) btnDelete.style.display = 'none';

    updateVehicleLicensePreview('');
  }

  if (modal) modal.classList.add('open');
}

// 更新車籍 Modal 內的行照縮圖預覽狀態
function updateVehicleLicensePreview(imgSrc) {
  const previewImg = document.getElementById('vehLicensePreviewImg');
  const placeholder = document.getElementById('vehLicensePreviewPlaceholder');
  if (imgSrc) {
    if (previewImg) {
      previewImg.src = imgSrc;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// 行照大圖燈箱放大檢視 (Lightbox)
function openLicenseLightbox(imgSrc, title = '行照原始檔案預覽') {
  const modal = document.getElementById('licenseLightboxModal');
  const imgEl = document.getElementById('lightboxImg');
  const titleEl = document.getElementById('lightboxTitle');
  if (!modal || !imgEl) return;

  imgEl.src = imgSrc;
  if (titleEl) titleEl.textContent = `📄 ${title}`;
  modal.classList.add('open');
}

function closeLicenseLightbox() {
  const modal = document.getElementById('licenseLightboxModal');
  if (modal) modal.classList.remove('open');
}

// =============================================================================
// 實用工具清單地圖渲染控制器 (Tools Map Dashboard Controller)
// =============================================================================
function renderToolsMap() {
  const gridContainer = document.getElementById('toolsMapGrid');
  if (!gridContainer) return;

  const categories = (typeof DEFAULT_EXTERNAL_TOOLS !== 'undefined' && Array.isArray(DEFAULT_EXTERNAL_TOOLS)) 
    ? DEFAULT_EXTERNAL_TOOLS 
    : [];

  let html = '';

  categories.forEach((catGroup) => {
    const toolCount = catGroup.tools ? catGroup.tools.length : 0;
    html += `
      <div class="tools-map-col">
        <div class="tools-map-col-header">
          <span class="tools-map-col-title">${escapeHTML(catGroup.category)}</span>
          <span class="tools-map-col-count">${toolCount}</span>
        </div>
        <div class="tools-map-col-body">
    `;

    if (catGroup.tools && catGroup.tools.length > 0) {
      catGroup.tools.forEach((tool) => {
        if (tool.action === 'open_fixed_messages') {
          html += `
            <button type="button" class="tool-map-btn" onclick="openFixedMessagesFromTools()" title="${escapeHTML(tool.name)}">
              <span>${escapeHTML(tool.name)}</span>
            </button>
          `;
        } else if (tool.action === 'open_doc_prints') {
          html += `
            <button type="button" class="tool-map-btn" onclick="openDocPrintsFromTools()" title="${escapeHTML(tool.name)}">
              <span>${escapeHTML(tool.name)}</span>
            </button>
          `;
        } else {
          html += `
            <a class="tool-map-btn" href="${encodeURI(tool.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(tool.name)}">
              <span>${escapeHTML(tool.name)}</span>
            </a>
          `;
        }
      });
    } else {
      html += `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
          暫無工具
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  });

  gridContainer.innerHTML = html;
}

// 點擊工具清單地圖中的固定訊息庫按鈕
function openFixedMessagesFromTools() {
  const toolsMapModal = document.getElementById('toolsMapModal');
  if (toolsMapModal) toolsMapModal.classList.remove('open');
  openFixedMessagesModal();
}

// 點擊工具清單地圖中的文件列印按鈕
function openDocPrintsFromTools() {
  const toolsMapModal = document.getElementById('toolsMapModal');
  if (toolsMapModal) toolsMapModal.classList.remove('open');
  openDocPrintsModal();
}

// =============================================================================
// 12. 推進狀況彙總清單 (Status Progress Tracker Modal)
// =============================================================================
const statusListModalState = {
  status: 'ALL',
  clientType: 'ALL',
  keyword: '',
  returnAfterDrawerClose: false,
  returnAfterContactModalClose: false,
  lastUpdatedCell: null
};

const STATUS_LIST_DEFS = [
  { key: 'ALL', label: '全部', icon: '🌐' },
  { key: 'planned', label: '預計', icon: '⚪' },
  { key: 'interaction', label: '互動', icon: '🟡' },
  { key: 'pitched', label: '拋出', icon: '🔵' },
  { key: 'agreed', label: '同意', icon: '🟢' },
  { key: 'appointment', label: '約定', icon: '🗓️' },
  { key: 'in_progress', label: '洽談', icon: '🟠' },
  { key: 'preparing', label: '籌劃', icon: '🟣' },
  { key: 'considering', label: '考慮', icon: '💠' },
  { key: 'closed', label: '完成', icon: '✅' },
  { key: 'paused', label: '暫緩', icon: '⏸️' },
  { key: 'rejected', label: '婉拒', icon: '🔴' },
  { key: 'referral', label: '轉介', icon: '🤝' }
];

function openStatusListModal(targetStatus = null, preserveState = false) {
  const modal = document.getElementById('statusListModal');
  if (!modal) return;

  // 若外部有指定 targetStatus，則優先切換至該狀態
  if (targetStatus) {
    statusListModalState.status = targetStatus;
  } else if (!preserveState) {
    const currentSelectVal = document.getElementById('touchpointStatusFilter')?.value;
    statusListModalState.status = currentSelectVal || 'ALL';
    statusListModalState.clientType = state.clientType || 'ALL';
  }

  modal.classList.add('open');
  renderStatusList();

  // 若有剛儲存更新的案件，定位並施加柔和高亮呼吸動效
  if (statusListModalState.lastUpdatedCell) {
    const { contactId, topicId } = statusListModalState.lastUpdatedCell;
    const targetRow = document.querySelector(`.status-list-row[data-contact-id="${contactId}"][data-topic-id="${topicId}"]`);
    if (targetRow) {
      targetRow.classList.add('status-row-just-updated');
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => {
        targetRow.classList.remove('status-row-just-updated');
      }, 2300);
    }
    statusListModalState.lastUpdatedCell = null;
  }

  // 自動聚焦搜尋框 (若保留狀態且已在檢視中則不強奪焦點)
  const searchInput = document.getElementById('statusListSearchInput');
  if (searchInput) {
    searchInput.value = statusListModalState.keyword || '';
    if (!preserveState) {
      setTimeout(() => {
        searchInput.focus();
      }, 60);
    }
  }
}

function closeStatusListModal() {
  const modal = document.getElementById('statusListModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

function renderStatusList() {
  const container = document.getElementById('statusListContainer');
  const chipsScroll = document.getElementById('statusModalFilterChips');
  const totalBadge = document.getElementById('statusListTotalCountBadge');
  const summaryHint = document.getElementById('statusListSummaryHint');
  const clientTypeTabs = document.getElementById('statusListClientTypeTabs');

  if (!container) return;

  // 1. 取得所有有效的定聯儲存格資料（一人多議題各自獨立，精確呈現）
  const allTouchpointEntries = [];
  for (const [cellKey, tp] of Object.entries(state.touchpoints || {})) {
    if (!tp || !tp.contactId || !tp.topicId) continue;
    if (!tp.status || tp.status === 'untouched' || !tp.history || tp.history.length === 0) continue;

    const contact = state.contacts.find(c => c.id === tp.contactId);
    const topic = state.topics.find(t => t.id === tp.topicId);
    if (!contact || !topic) continue;

    allTouchpointEntries.push({
      cellKey,
      contact,
      topic,
      touchpoint: tp,
      statusKey: tp.status
    });
  }

  // 2. 計算各狀態的數量統計 (依目前選定的客群維度過濾後的統計)
  const statusCounts = {};
  STATUS_LIST_DEFS.forEach(d => { statusCounts[d.key] = 0; });

  allTouchpointEntries.forEach(item => {
    // 檢查客群維度
    if (statusListModalState.clientType !== 'ALL') {
      if (statusListModalState.clientType === 'RECRUIT' && !((typeof isClientRecruit === 'function') ? isClientRecruit(item.contact) : item.contact.isRecruit)) return;
      if (statusListModalState.clientType === 'CORPORATE') {
        const isCorp = (typeof isClientCorporate === 'function')
          ? isClientCorporate(item.contact, state.touchpoints, state.topics)
          : (item.contact.isCorporate !== undefined ? !!item.contact.isCorporate : (item.contact.clientType === 'CORPORATE' || (item.contact.category && /企業|董座|董事長|總經理|法人|企業主/.test(item.contact.category))));
        if (!isCorp) return;
      }
      if (statusListModalState.clientType === 'INDIVIDUAL') {
        const isInd = (typeof isClientIndividual === 'function')
          ? isClientIndividual(item.contact)
          : (item.contact.isIndividual !== undefined ? !!item.contact.isIndividual : (item.contact.clientType !== 'CORPORATE'));
        if (!isInd) return;
      }
    }

    statusCounts['ALL']++;
    const sk = item.statusKey;
    if (sk === 'closed' || sk === 'completed') {
      statusCounts['closed'] = (statusCounts['closed'] || 0) + 1;
    } else if (sk === 'in_progress' || sk === 'discussing') {
      statusCounts['in_progress'] = (statusCounts['in_progress'] || 0) + 1;
    } else if (sk === 'appointment' || sk === 'appointed' || sk === 'scheduled' || sk === '約定') {
      statusCounts['appointment'] = (statusCounts['appointment'] || 0) + 1;
    } else if (statusCounts[sk] !== undefined) {
      statusCounts[sk]++;
    }
  });

  // 3. 渲染狀態晶片列
  if (chipsScroll) {
    let chipsHtml = '';
    STATUS_LIST_DEFS.forEach(def => {
      const count = statusCounts[def.key] || 0;
      const isActive = statusListModalState.status === def.key;
      chipsHtml += `
        <button type="button" class="status-chip-btn ${isActive ? 'active' : ''}" data-status="${def.key}">
          <span>${def.icon} ${escapeHTML(def.label)}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    });
    chipsScroll.innerHTML = chipsHtml;
  }

  // 4. 同步客群篩選按鈕 active 樣式
  if (clientTypeTabs) {
    clientTypeTabs.querySelectorAll('.type-filter-chip').forEach(btn => {
      const bType = btn.getAttribute('data-type');
      btn.classList.toggle('active', bType === statusListModalState.clientType);
    });
  }

  // 5. 依當前條件進行過濾
  const keyword = (statusListModalState.keyword || '').trim().toLowerCase();
  const filteredList = allTouchpointEntries.filter(item => {
    // 狀態過濾
    if (statusListModalState.status !== 'ALL') {
      const target = statusListModalState.status;
      const sk = item.statusKey;
      const isMatch = (target === 'closed' && (sk === 'closed' || sk === 'completed')) ||
                      (target === 'in_progress' && (sk === 'in_progress' || sk === 'discussing')) ||
                      (target === 'appointment' && (sk === 'appointment' || sk === 'appointed' || sk === 'scheduled' || sk === '約定')) ||
                      sk === target;
      if (!isMatch) return false;
    }

    // 客群過濾
    if (statusListModalState.clientType !== 'ALL') {
      if (statusListModalState.clientType === 'RECRUIT' && !((typeof isClientRecruit === 'function') ? isClientRecruit(item.contact) : item.contact.isRecruit)) return false;
      if (statusListModalState.clientType === 'CORPORATE') {
        const isCorp = (typeof isClientCorporate === 'function')
          ? isClientCorporate(item.contact, state.touchpoints, state.topics)
          : (item.contact.isCorporate !== undefined ? !!item.contact.isCorporate : (item.contact.clientType === 'CORPORATE' || (item.contact.category && /企業|董座|董事長|總經理|法人|企業主/.test(item.contact.category))));
        if (!isCorp) return false;
      }
      if (statusListModalState.clientType === 'INDIVIDUAL') {
        const isInd = (typeof isClientIndividual === 'function')
          ? isClientIndividual(item.contact)
          : (item.contact.isIndividual !== undefined ? !!item.contact.isIndividual : (item.contact.clientType !== 'CORPORATE'));
        if (!isInd) return false;
      }
    }

    // 關鍵字過濾
    if (keyword) {
      const latestHistory = item.touchpoint.history[0] || {};
      const cDisplayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(item.contact.name) : (item.contact.name || '');
      const matchName = (item.contact.name && item.contact.name.toLowerCase().includes(keyword)) ||
                        (cDisplayName && cDisplayName.toLowerCase().includes(keyword));
      const matchNickname = item.contact.nickname && item.contact.nickname.toLowerCase().includes(keyword);
      const matchTopic = item.topic.title && item.topic.title.toLowerCase().includes(keyword);
      const matchSummary = latestHistory.summary && latestHistory.summary.toLowerCase().includes(keyword);
      const matchNextAction = latestHistory.nextAction && latestHistory.nextAction.toLowerCase().includes(keyword);
      const matchCategory = (item.topic.category && item.topic.category.toLowerCase().includes(keyword)) ||
                            (item.contact.category && item.contact.category.toLowerCase().includes(keyword));
      const matchTravel = item.touchpoint.travel && item.touchpoint.travel.destination && 
                          item.touchpoint.travel.destination.toLowerCase().includes(keyword);
      if (!matchName && !matchNickname && !matchTopic && !matchSummary && !matchNextAction && !matchCategory && !matchTravel) {
        return false;
      }
    }

    return true;
  });

  // 6. 排序：依據最新互動日期降序 (最新在最前)，日期相同則依客戶姓名與議題順序
  filteredList.sort((a, b) => {
    const dateA = a.touchpoint.latestDate || (a.touchpoint.history[0] ? a.touchpoint.history[0].date : '');
    const dateB = b.touchpoint.latestDate || (b.touchpoint.history[0] ? b.touchpoint.history[0].date : '');
    if (dateB !== dateA) {
      return (dateB || '').localeCompare(dateA || '');
    }
    if (a.contact.name !== b.contact.name) {
      return (a.contact.name || '').localeCompare(b.contact.name || '', 'zh-Hant');
    }
    return (a.topic.order || 99) - (b.topic.order || 99);
  });

  // 7. 更新計數
  if (totalBadge) totalBadge.textContent = `共 ${allTouchpointEntries.length} 筆紀錄`;
  if (summaryHint) summaryHint.textContent = `符合條件：${filteredList.length} 筆（一人多議題各自獨立成行）`;

  // 8. 渲染表格清單
  if (filteredList.length === 0) {
    container.innerHTML = `
      <div class="status-list-empty-state">
        <span style="font-size: 2rem;">🔍</span>
        <div style="font-size: 0.92rem; font-weight: 700; color: var(--text-secondary);">查無符合條件的推進紀錄</div>
        <p style="font-size: 0.78rem; margin: 0;">請嘗試切換上方狀態標籤、客群維度，或清除搜尋關鍵字。</p>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="status-list-table">
      <thead>
        <tr>
          <th style="width: 18%;">客戶姓名</th>
          <th style="width: 19%;">推進議題</th>
          <th style="width: 12%;">推進狀況</th>
          <th style="width: 15%;">最近互動</th>
          <th style="width: 26%;">最新訪談摘要與下一步</th>
          <th style="width: 10%; text-align: center;">操作</th>
        </tr>
      </thead>
      <tbody>
  `;

  filteredList.forEach(item => {
    const c = item.contact;
    const t = item.topic;
    const tp = item.touchpoint;
    const statusMeta = getStatusMeta(item.statusKey);
    const latestHistory = tp.history[0] || {};
    const latestDate = tp.latestDate || latestHistory.date || '無日期';
    const channel = latestHistory.channel || '互動';
    const summary = latestHistory.summary || '暫無摘要備忘';
    const nextAction = latestHistory.nextAction || '';

    // 客戶標籤徽章 (MBTI / DISC / 企業 / 準增)
    let traitChips = '';
    if (c.mbti) {
      traitChips += `<span class="trait-badge mbti" style="font-size:0.68rem; padding:1px 5px;">${escapeHTML(c.mbti)}</span>`;
    }
    if (c.disc) {
      traitChips += `<span class="trait-badge disc" style="font-size:0.68rem; padding:1px 5px;">${escapeHTML(formatDiscBadge(c.disc))}</span>`;
    }
    if (c.clientType === 'CORPORATE') {
      traitChips += `<span class="pill-corporate" style="font-size:0.68rem; padding:1px 5px;">🏢 企業</span>`;
    }
    if (c.isRecruit) {
      traitChips += `<span class="pill-recruit" style="font-size:0.68rem; padding:1px 5px;">🤝 準增</span>`;
    }

    const displayClientName = typeof getClientDisplayName === 'function' ? getClientDisplayName(c.name) : c.name;
    tableHtml += `
      <tr class="status-list-row" data-contact-id="${escapeHTML(c.id)}" data-topic-id="${escapeHTML(t.id)}">
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="status-row-client-name" data-action="edit-contact" data-contact-id="${escapeHTML(c.id)}" title="點擊檢視/編輯【${escapeHTML(displayClientName)}】客戶檔案">
              ${escapeHTML(displayClientName)}
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 3px; align-items: center;">
              ${traitChips}
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center;">
              <span class="status-row-topic-cat">${escapeHTML(t.category || '議題')}</span>
              <span class="status-row-topic-title">${escapeHTML(t.title)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="status-pill ${statusMeta.className}">${statusMeta.label}</span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span class="status-row-date-badge">${escapeHTML(latestDate)}</span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="status-row-channel-badge">${escapeHTML(channel)}</span>
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">${tp.history.length} 次</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div class="status-row-summary-text" title="${escapeHTML(summary)}">
              ${escapeHTML(summary)}
            </div>
            ${nextAction ? `
              <div>
                <span class="status-row-next-action" title="下一步行動：${escapeHTML(nextAction)}">
                  🎯 下一步：${escapeHTML(nextAction)}
                </span>
              </div>
            ` : ''}
          </div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="status-list-btn-action" data-action="open-touchpoint" data-contact-id="${escapeHTML(c.id)}" data-topic-id="${escapeHTML(t.id)}" title="開啟定聯時間軸與微紀錄抽屜">
            <span>📝 定聯</span>
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;
}

// 綁定推進狀況清單 Modal 內部事件
function initStatusListModalEvents() {
  const modal = document.getElementById('statusListModal');
  if (!modal) return;

  // 關閉按鈕
  document.getElementById('closeStatusListModalBtn')?.addEventListener('click', closeStatusListModal);
  document.getElementById('closeStatusListModalFooterBtn')?.addEventListener('click', closeStatusListModal);

  // 點擊背景遮罩關閉
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'statusListModal') {
      closeStatusListModal();
    }
  });

  // 狀態切換晶片點擊
  document.getElementById('statusModalFilterChips')?.addEventListener('click', (e) => {
    const chipBtn = e.target.closest('.status-chip-btn');
    if (chipBtn) {
      const statusKey = chipBtn.getAttribute('data-status');
      if (statusKey) {
        statusListModalState.status = statusKey;
        renderStatusList();
      }
    }
  });

  // 客群切換分頁點擊
  document.getElementById('statusListClientTypeTabs')?.addEventListener('click', (e) => {
    const typeChip = e.target.closest('.type-filter-chip');
    if (typeChip) {
      const typeKey = typeChip.getAttribute('data-type');
      if (typeKey) {
        statusListModalState.clientType = typeKey;
        renderStatusList();
      }
    }
  });

  // 即時搜尋輸入
  const searchInput = document.getElementById('statusListSearchInput');
  const searchClearBtn = document.getElementById('statusListSearchClearBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      statusListModalState.keyword = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = e.target.value ? 'block' : 'none';
      }
      renderStatusList();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        statusListModalState.keyword = '';
        searchClearBtn.style.display = 'none';
        renderStatusList();
        searchInput.focus();
      }
    });
  }

  // 表格行點擊與按鈕操作委派
  document.getElementById('statusListContainer')?.addEventListener('click', (e) => {
    // 點擊客戶姓名文字：開啟客戶檔案維護
    const nameBtn = e.target.closest('[data-action="edit-contact"]');
    if (nameBtn) {
      e.stopPropagation();
      const contactId = nameBtn.getAttribute('data-contact-id');
      if (contactId) {
        statusListModalState.returnAfterContactModalClose = true;
        closeStatusListModal();
        openContactModal(contactId);
      }
      return;
    }

    // 點擊定聯按鈕或整行：開啟右側定聯微紀錄抽屜 (帶入 fromStatusList: true 旗標)
    const row = e.target.closest('.status-list-row');
    if (row) {
      const contactId = row.getAttribute('data-contact-id');
      const topicId = row.getAttribute('data-topic-id');
      if (contactId && topicId) {
        statusListModalState.returnAfterDrawerClose = true;
        closeStatusListModal();
        openQuickLogDrawer(contactId, topicId, true);
      }
    }
  });
}

// =============================================================================
// 13. 常用固定訊息庫控制器 (Fixed Messages Modal Controller)
// =============================================================================
let currentFixedMsgId = null;

// 開啟固定訊息庫 Modal
function openFixedMessagesModal(targetId = null) {
  const modal = document.getElementById('fixedMessagesModal');
  if (!modal) return;
  
  // 關閉工具清單或其他彈窗
  const toolsMapModal = document.getElementById('toolsMapModal');
  if (toolsMapModal) toolsMapModal.classList.remove('open');

  modal.classList.add('open');
  renderFixedMessagesList(targetId);
}

// 關閉固定訊息庫 Modal
function closeFixedMessagesModal() {
  const modal = document.getElementById('fixedMessagesModal');
  if (modal) modal.classList.remove('open');
}

// 渲染左側固定訊息清單 (支援 HTML5 拖曳排序)
function renderFixedMessagesList(targetId = null) {
  const container = document.getElementById('fixed-msgs-list-container');
  const countBadge = document.getElementById('fixedMsgsCountBadge');
  if (!container) return;

  // 確保 state.fixedMessages 存在且至少有預設資料
  if (!state.fixedMessages || !Array.isArray(state.fixedMessages) || state.fixedMessages.length === 0) {
    state.fixedMessages = [...DEFAULT_FIXED_MESSAGES];
    state.saveFixedMessages();
  }

  const list = state.fixedMessages;
  if (countBadge) {
    countBadge.textContent = `${list.length} 筆`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 40px 10px; font-size: 0.78rem;">
        🎉 目前無任何固定訊息，請點選上方新增！
      </div>
    `;
    const emptyBox = document.getElementById('fixed-msg-detail-empty');
    if (emptyBox) emptyBox.style.display = 'flex';
    const detailBox = document.getElementById('fixed-msg-detail-content');
    if (detailBox) detailBox.style.display = 'none';
    const editorBox = document.getElementById('fixed-msg-editor');
    if (editorBox) editorBox.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  list.forEach((m, index) => {
    const isActive = currentFixedMsgId === m.id;
    const div = document.createElement('div');
    div.className = `fixed-msg-list-item ${isActive ? 'active' : ''}`;
    div.setAttribute('data-id', m.id);
    div.setAttribute('data-index', index);
    div.setAttribute('draggable', 'true');
    div.title = m.title || '無標題';
    
    div.innerHTML = `
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHTML(m.title || '無標題')}</span>
      <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 6px; cursor: grab;">⋮⋮</span>
    `;

    // 點擊事件：切換選取項目
    div.addEventListener('click', () => selectFixedMsgItem(m.id));

    // 拖曳排序事件 (Drag & Drop)
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      div.classList.add('dragging');
    });

    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      div.classList.add('drag-over');
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-over');
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging', 'drag-over');
    });

    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const fromIndexStr = e.dataTransfer.getData('text/plain');
      const fromIndex = parseInt(fromIndexStr, 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        const movedItem = state.fixedMessages.splice(fromIndex, 1)[0];
        state.fixedMessages.splice(toIndex, 0, movedItem);
        state.saveFixedMessages();
        renderFixedMessagesList(movedItem.id);
      }
    });

    container.appendChild(div);
  });

  // 預設選取項目：指定 targetId，若無則保留 currentFixedMsgId，否則選取第 1 筆
  if (targetId && list.some(x => x.id === targetId)) {
    selectFixedMsgItem(targetId);
  } else if (currentFixedMsgId && list.some(x => x.id === currentFixedMsgId)) {
    selectFixedMsgItem(currentFixedMsgId);
  } else if (list.length > 0) {
    selectFixedMsgItem(list[0].id);
  }
}

// 選取特定固定訊息並在右側詳細呈現
function selectFixedMsgItem(id) {
  currentFixedMsgId = id;

  // 更新側邊欄 active 高亮
  document.querySelectorAll('#fixed-msgs-list-container .fixed-msg-list-item').forEach(el => {
    if (el.getAttribute('data-id') === id) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  const m = (state.fixedMessages || []).find(x => x.id === id);
  if (!m) return;

  const emptyBox = document.getElementById('fixed-msg-detail-empty');
  if (emptyBox) emptyBox.style.display = 'none';

  const editorBox = document.getElementById('fixed-msg-editor');
  if (editorBox) editorBox.style.display = 'none';

  const detailBox = document.getElementById('fixed-msg-detail-content');
  if (detailBox) detailBox.style.display = 'flex';

  const titleElem = document.getElementById('fixed-msg-detail-title');
  if (titleElem) titleElem.textContent = m.title || '無標題';

  const textElem = document.getElementById('fixed-msg-detail-text');
  if (textElem) textElem.textContent = m.content || '';
}

// 一鍵複製當前選取的固定訊息內文
function copyCurrentFixedMsgText() {
  const textElem = document.getElementById('fixed-msg-detail-text');
  if (!textElem) return;
  const text = textElem.textContent || '';
  if (!text) {
    showToast('目前訊息內容為空', 'warning');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const m = (state.fixedMessages || []).find(x => x.id === currentFixedMsgId);
    const title = m ? m.title : '固定訊息';
    showToast(`📋 已成功複製「${title}」！可切換至 LINE 貼上`);
  }).catch(err => {
    // 降級處理
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('📋 已複製內容至剪貼簿！');
    } catch (e) {
      showToast('複製失敗，請手動選取反白複製', 'error');
    }
    document.body.removeChild(textarea);
  });
}

// 開啟固定訊息編輯器 (新增或編輯)
function openFixedMsgEditor(id = null) {
  const emptyBox = document.getElementById('fixed-msg-detail-empty');
  if (emptyBox) emptyBox.style.display = 'none';

  const detailBox = document.getElementById('fixed-msg-detail-content');
  if (detailBox) detailBox.style.display = 'none';

  const editorBox = document.getElementById('fixed-msg-editor');
  const titleInput = document.getElementById('fixed-msg-input-title');
  const contentInput = document.getElementById('fixed-msg-input-content');
  const idInput = document.getElementById('fixed-msg-edit-id');
  const editorTitle = document.getElementById('fixed-msg-editor-title');

  if (!editorBox) return;
  editorBox.style.display = 'flex';

  if (id) {
    const m = (state.fixedMessages || []).find(x => x.id === id);
    if (m) {
      if (idInput) idInput.value = m.id;
      if (titleInput) titleInput.value = m.title || '';
      if (contentInput) contentInput.value = m.content || '';
      if (editorTitle) editorTitle.textContent = '✏️ 編輯固定訊息';
    }
  } else {
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (editorTitle) editorTitle.textContent = '＋ 新增固定訊息項目';
  }

  if (titleInput) titleInput.focus();
}

// 關閉固定訊息編輯器
function closeFixedMsgEditor() {
  const editorBox = document.getElementById('fixed-msg-editor');
  if (editorBox) editorBox.style.display = 'none';

  if (currentFixedMsgId && state.fixedMessages.some(x => x.id === currentFixedMsgId)) {
    selectFixedMsgItem(currentFixedMsgId);
  } else if (state.fixedMessages && state.fixedMessages.length > 0) {
    selectFixedMsgItem(state.fixedMessages[0].id);
  } else {
    const emptyBox = document.getElementById('fixed-msg-detail-empty');
    if (emptyBox) emptyBox.style.display = 'flex';
  }
}

// 儲存固定訊息 (新增或更新)
function saveFixedMsgItem() {
  const idInput = document.getElementById('fixed-msg-edit-id');
  const titleInput = document.getElementById('fixed-msg-input-title');
  const contentInput = document.getElementById('fixed-msg-input-content');

  const id = idInput ? idInput.value.trim() : '';
  const title = titleInput ? titleInput.value.trim() : '';
  const content = contentInput ? contentInput.value.trim() : '';

  if (!title) {
    showToast('請填寫訊息標題 / 簡稱！', 'warning');
    if (titleInput) titleInput.focus();
    return;
  }

  if (!content) {
    showToast('請填寫固定訊息內文！', 'warning');
    if (contentInput) contentInput.focus();
    return;
  }

  if (!state.fixedMessages) state.fixedMessages = [];

  let savedId = id;
  if (id) {
    const m = state.fixedMessages.find(x => x.id === id);
    if (m) {
      m.title = title;
      m.content = content;
    } else {
      state.fixedMessages.push({ id, title, content });
    }
  } else {
    savedId = (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('fixed') : ('fixed_' + Date.now());
    state.fixedMessages.unshift({
      id: savedId,
      title: title,
      content: content
    });
  }

  state.saveFixedMessages();
  closeFixedMsgEditor();
  renderFixedMessagesList(savedId);
  showToast(id ? '✏️ 固定訊息已更新！' : '🎉 新固定訊息已建立！');
}

// 刪除特定固定訊息
function deleteFixedMsgItem(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('確定要刪除此筆固定訊息嗎？')) return;

  state.fixedMessages = (state.fixedMessages || []).filter(x => x.id !== id);
  if (currentFixedMsgId === id) {
    currentFixedMsgId = null;
  }

  state.saveFixedMessages();
  renderFixedMessagesList();
  showToast('🗑️ 固定訊息已刪除！');
}

// =============================================================================
// 15. 文件列印庫 (Doc Prints Modal) 模組
// =============================================================================
let currentDocPrintId = null;

// 開啟文件列印庫 Modal
function openDocPrintsModal(targetId = null) {
  const modal = document.getElementById('docPrintsModal');
  if (!modal) return;
  
  // 關閉外部工具清單
  const toolsMapModal = document.getElementById('toolsMapModal');
  if (toolsMapModal) toolsMapModal.classList.remove('open');

  modal.classList.add('open');
  renderDocPrintsList(targetId);
}

// 關閉文件列印庫 Modal
function closeDocPrintsModal() {
  const modal = document.getElementById('docPrintsModal');
  if (modal) modal.classList.remove('open');
}

// 渲染左側文件清單 (支援 HTML5 拖曳排序)
function renderDocPrintsList(targetId = null) {
  const container = document.getElementById('doc-prints-list-container');
  const countBadge = document.getElementById('docPrintsCountBadge');
  if (!container) return;

  // 確保 state.docPrints 存在
  if (!state.docPrints || !Array.isArray(state.docPrints) || state.docPrints.length === 0) {
    state.docPrints = [...DEFAULT_DOC_PRINTS];
    state.saveDocPrints();
  }

  const list = state.docPrints;
  if (countBadge) {
    countBadge.textContent = `${list.length} 筆`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 40px 10px; font-size: 0.78rem;">
        🎉 目前無任何文件，請點選上方新增上傳！
      </div>
    `;
    const emptyBox = document.getElementById('doc-print-detail-empty');
    if (emptyBox) emptyBox.style.display = 'flex';
    const detailBox = document.getElementById('doc-print-detail-content');
    if (detailBox) detailBox.style.display = 'none';
    const editorBox = document.getElementById('doc-print-editor');
    if (editorBox) editorBox.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  list.forEach((d, index) => {
    const isActive = currentDocPrintId === d.id;
    const div = document.createElement('div');
    div.className = `doc-print-list-item ${isActive ? 'active' : ''}`;
    div.setAttribute('data-id', d.id);
    div.setAttribute('data-index', index);
    div.setAttribute('draggable', 'true');
    div.title = d.title || '無標題文件';
    
    div.innerHTML = `
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHTML(d.title || '無標題文件')}</span>
      <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 6px; cursor: grab;">⋮⋮</span>
    `;

    // 點擊事件：切換選取項目
    div.addEventListener('click', () => selectDocPrintItem(d.id));

    // 拖曳排序事件 (Drag & Drop)
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      div.classList.add('dragging');
    });

    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      div.classList.add('drag-over');
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-over');
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging', 'drag-over');
    });

    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const fromIndexStr = e.dataTransfer.getData('text/plain');
      const fromIndex = parseInt(fromIndexStr, 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        const movedItem = state.docPrints.splice(fromIndex, 1)[0];
        state.docPrints.splice(toIndex, 0, movedItem);
        state.saveDocPrints();
        renderDocPrintsList(movedItem.id);
      }
    });

    container.appendChild(div);
  });

  // 預設選取項目
  if (targetId && list.some(x => x.id === targetId)) {
    selectDocPrintItem(targetId);
  } else if (currentDocPrintId && list.some(x => x.id === currentDocPrintId)) {
    selectDocPrintItem(currentDocPrintId);
  } else if (list.length > 0) {
    selectDocPrintItem(list[0].id);
  }
}

// 選取特定文件並在右側詳細呈現
function selectDocPrintItem(id) {
  currentDocPrintId = id;

  // 更新側邊欄 active 高亮
  document.querySelectorAll('#doc-prints-list-container .doc-print-list-item').forEach(el => {
    if (el.getAttribute('data-id') === id) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  const d = (state.docPrints || []).find(x => x.id === id);
  if (!d) return;

  const emptyBox = document.getElementById('doc-print-detail-empty');
  if (emptyBox) emptyBox.style.display = 'none';

  const editorBox = document.getElementById('doc-print-editor');
  if (editorBox) editorBox.style.display = 'none';

  const detailBox = document.getElementById('doc-print-detail-content');
  if (detailBox) detailBox.style.display = 'flex';

  const titleElem = document.getElementById('doc-print-detail-title');
  if (titleElem) titleElem.textContent = d.title || '無標題文件';

  const descElem = document.getElementById('doc-print-detail-desc');
  if (descElem) {
    descElem.textContent = d.desc ? '📌 備註說明：' + d.desc : '';
    descElem.style.display = d.desc ? 'block' : 'none';
  }

  // 預覽區渲染
  const previewBox = document.getElementById('doc-print-detail-preview');
  if (previewBox) {
    previewBox.innerHTML = '';
    if (d.fileData) {
      if (d.fileType && d.fileType.startsWith('image/')) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.maxWidth = '100%';
        wrapper.style.maxHeight = '100%';

        const img = document.createElement('img');
        img.src = d.fileData;
        img.style.maxWidth = '100%';
        img.style.maxHeight = 'calc(100% - 30px)';
        img.style.objectFit = 'contain';
        img.style.cursor = 'pointer';
        img.title = '點擊在新分頁開啟全圖 / 支援直接列印';
        img.onclick = () => openDocInNewWindow();

        const hint = document.createElement('div');
        hint.style.fontSize = '0.75rem';
        hint.style.color = '#38bdf8';
        hint.innerHTML = '💡 點擊圖片或上方「↗️ 獨立頁列印」即可滿版列印 / 另存 PDF';

        wrapper.appendChild(img);
        wrapper.appendChild(hint);
        previewBox.appendChild(wrapper);
      } else if (d.fileType === 'application/pdf' || d.fileType === 'text/html' || (d.fileData && (d.fileData.includes('application/pdf') || d.fileData.startsWith('data:text/html')))) {
        const iframe = document.createElement('iframe');
        iframe.src = d.fileData;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '6px';
        iframe.style.background = '#ffffff';
        previewBox.appendChild(iframe);
      } else {
        const pre = document.createElement('pre');
        pre.textContent = d.fileData;
        previewBox.appendChild(pre);
      }
    } else {
      previewBox.innerHTML = `<div style="color:var(--text-muted); font-size:0.82rem;">⚠️ 尚無文件檔案內容</div>`;
    }
  }
}

// 在新分頁開啟滿版列印頁面 (一鍵 Command+P / Ctrl+P 自動呼叫)
function openDocInNewWindow() {
  if (!currentDocPrintId) return;
  const d = (state.docPrints || []).find(x => x.id === currentDocPrintId);
  if (!d || !d.fileData) {
    showToast('未找到有效的文件內容！', 'warning');
    return;
  }

  if (d.fileType === 'application/pdf' || (d.fileData && d.fileData.includes('application/pdf'))) {
    // PDF 直接開啟全新分頁，支援瀏覽器內建高解析度列印與下載
    window.open(d.fileData, '_blank');
    showToast('已在獨立分頁開啟 PDF！可直接點擊右上方印表機圖示');
  } else if (d.fileType && d.fileType.startsWith('image/')) {
    // 圖片：開啟專屬滿版白底列印頁面
    const newWin = window.open('', '_blank');
    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHTML(d.title || '文件列印')}</title>
          <style>
            @page { size: auto; margin: 0; }
            body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; }
            img { max-width: 100%; height: auto; object-fit: contain; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <img src="${d.fileData}" />
          <script>
            window.onload = function() {
              setTimeout(function() { window.focus(); window.print(); }, 200);
            };
          </script>
        </body>
        </html>
      `);
      newWin.document.close();
    }
    showToast('已開啟滿版圖片列印頁面！');
  } else {
    // HTML / 純文字
    const newWin = window.open('', '_blank');
    if (newWin) {
      let content = d.fileData.startsWith('data:text/html')
        ? decodeURIComponent(d.fileData.split(',')[1] || '')
        : `<pre style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.6;">${escapeHTML(d.fileData)}</pre>`;
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHTML(d.title || '文件列印')}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; padding: 20px; color: #111; background: #fff; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              setTimeout(function() { window.focus(); window.print(); }, 200);
            };
          </script>
        </body>
        </html>
      `);
      newWin.document.close();
    }
    showToast('已開啟獨立列印頁面！');
  }
}

// 開啟文件編輯器 (新增或編輯)
function openDocPrintEditor(id = null) {
  const emptyBox = document.getElementById('doc-print-detail-empty');
  if (emptyBox) emptyBox.style.display = 'none';

  const detailBox = document.getElementById('doc-print-detail-content');
  if (detailBox) detailBox.style.display = 'none';

  const editorBox = document.getElementById('doc-print-editor');
  const titleInput = document.getElementById('doc-print-input-title');
  const descInput = document.getElementById('doc-print-input-desc');
  const fileInput = document.getElementById('doc-print-input-file');
  const fileHint = document.getElementById('doc-print-file-hint');
  const idInput = document.getElementById('doc-print-edit-id');
  const editorTitle = document.getElementById('doc-print-editor-title');

  if (!editorBox) return;
  editorBox.style.display = 'flex';
  if (fileInput) fileInput.value = '';

  if (id) {
    const d = (state.docPrints || []).find(x => x.id === id);
    if (d) {
      if (idInput) idInput.value = d.id;
      if (titleInput) titleInput.value = d.title || '';
      if (descInput) descInput.value = d.desc || '';
      if (editorTitle) editorTitle.textContent = '✏️ 編輯文件項目';
      if (fileHint) fileHint.style.display = 'block';
    }
  } else {
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (editorTitle) editorTitle.textContent = '＋ 上傳文件資源';
    if (fileHint) fileHint.style.display = 'none';
  }

  if (titleInput) titleInput.focus();
}

// 關閉文件編輯器
function closeDocPrintEditor() {
  const editorBox = document.getElementById('doc-print-editor');
  if (editorBox) editorBox.style.display = 'none';

  if (currentDocPrintId && state.docPrints.some(x => x.id === currentDocPrintId)) {
    selectDocPrintItem(currentDocPrintId);
  } else if (state.docPrints && state.docPrints.length > 0) {
    selectDocPrintItem(state.docPrints[0].id);
  } else {
    const emptyBox = document.getElementById('doc-print-detail-empty');
    if (emptyBox) emptyBox.style.display = 'flex';
  }
}

// 儲存文件項目 (新增或更新)
function saveDocPrintItem() {
  const idInput = document.getElementById('doc-print-edit-id');
  const titleInput = document.getElementById('doc-print-input-title');
  const descInput = document.getElementById('doc-print-input-desc');
  const fileInput = document.getElementById('doc-print-input-file');

  const id = idInput ? idInput.value.trim() : '';
  const title = titleInput ? titleInput.value.trim() : '';
  const desc = descInput ? descInput.value.trim() : '';
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (!title) {
    showToast('請填寫文件標題！', 'warning');
    if (titleInput) titleInput.focus();
    return;
  }

  if (!id && !file) {
    showToast('請選擇要上傳的文件檔案！', 'warning');
    return;
  }

  const finalizeSave = (fileData, fileType, fileName) => {
    if (!state.docPrints) state.docPrints = [];

    let savedId = id;
    if (id) {
      const d = state.docPrints.find(x => x.id === id);
      if (d) {
        d.title = title;
        d.desc = desc;
        if (fileData) {
          d.fileData = fileData;
          d.fileType = fileType;
          d.fileName = fileName;
        }
      }
    } else {
      savedId = (typeof generateTimeCodeId === 'function') ? generateTimeCodeId('doc') : ('doc_' + Date.now());
      state.docPrints.unshift({
        id: savedId,
        title: title,
        desc: desc,
        fileType: fileType || '',
        fileName: fileName || '',
        fileData: fileData || ''
      });
    }

    state.saveDocPrints();
    closeDocPrintEditor();
    renderDocPrintsList(savedId);
    showToast(id ? '✏️ 文件項目已更新！' : '🎉 新文件資源已成功上傳！');
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      finalizeSave(e.target.result, file.type, file.name);
    };
    reader.onerror = function() {
      showToast('檔案讀取失敗，請重新選取！', 'error');
    };
    reader.readAsDataURL(file);
  } else {
    finalizeSave(null, null, null);
  }
}

// 刪除特定文件項目
function deleteDocPrintItem(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('確定要刪除此文件項目嗎？')) return;

  state.docPrints = (state.docPrints || []).filter(x => x.id !== id);
  if (currentDocPrintId === id) {
    currentDocPrintId = null;
  }

  state.saveDocPrints();
  renderDocPrintsList();
  showToast('🗑️ 文件項目已被刪除！');
}

// =============================================================================
// 本週推進微步戰報彈窗 (Weekly Pulse Achievement Modal Controller)
// =============================================================================
function openWeeklyPulseModal() {
  const modal = document.getElementById('weeklyPulseModal');
  if (!modal) {
    console.error('[WeeklyPulse] 找不到 #weeklyPulseModal DOM 元素');
    return;
  }

  let stats = null;
  try {
    if (state && typeof state.getActivityStats === 'function') {
      stats = state.getActivityStats();
    }
  } catch (err) {
    console.warn('[WeeklyPulse] 統計計算發生警告，啟用保底資料', err);
  }

  // 兜底預設統計資料，確保介面 100% 正常渲染
  if (!stats) {
    stats = {
      today: { total: 0, newContactsCount: 0, progressCount: 0, newContacts: [], progressActions: [], activeClientsCount: 0 },
      week: { total: 0, newContactsCount: 0, progressCount: 0, newContacts: [], progressActions: [], days: [] }
    };
  }

  // 1. 回填數據
  const todayTotalEl = document.getElementById('pulseModalTodayTotal');
  const todayNewEl = document.getElementById('pulseModalTodayNew');
  const todayProgEl = document.getElementById('pulseModalTodayProgress');
  const weekTotalEl = document.getElementById('pulseModalWeekTotal');
  const weekNewEl = document.getElementById('pulseModalWeekNew');
  const weekProgEl = document.getElementById('pulseModalWeekProgress');
  const clientCountEl = document.getElementById('pulseActiveClientCount');

  if (todayTotalEl) todayTotalEl.textContent = stats.today.total;
  if (todayNewEl) todayNewEl.textContent = stats.today.newContactsCount;
  if (todayProgEl) todayProgEl.textContent = stats.today.progressCount;
  if (weekTotalEl) weekTotalEl.textContent = stats.week.total;
  if (weekNewEl) weekNewEl.textContent = stats.week.newContactsCount;
  if (weekProgEl) weekProgEl.textContent = stats.week.progressCount;
  if (clientCountEl) clientCountEl.textContent = `${stats.today.activeClientsCount} 位客戶`;

  // 2. 隨機多巴胺正向金句 (ADHD 友好自我肯定)
  const affirmations = [
    '每一次微小的紀錄，都在讓客戶關係實質向前推進！',
    '不用追求完美爆發，只要今天有留下足跡，就是巨大的勝利！',
    '看見自己的每一小步，信任與成交自然水到渠成。',
    '維持互動、更新狀態，你的專業與用心客戶都能感受到！',
    '行動累積底氣，今天又比昨天往前邁進了一步！'
  ];
  const affirmEl = document.getElementById('pulseAffirmationText');
  if (affirmEl) {
    affirmEl.textContent = affirmations[Math.floor(Math.random() * affirmations.length)];
  }

  // 3. 渲染本週動能節奏趨勢圖 (Weekly Spark Trend Bars)
  const sparkBarsContainer = document.getElementById('sparkBarsContainer');
  const activeDaysBadge = document.getElementById('trendActiveDaysBadge');
  const motivationText = document.getElementById('trendMotivationText');

  if (sparkBarsContainer && Array.isArray(stats.week.days)) {
    const daysData = stats.week.days;
    // 計算本週單日最高動作數（作為 100% 高度基準，最少以 5 為底避免除以 0）
    const maxVal = Math.max(...daysData.map(d => d.total), 4);
    let activeDaysCount = 0;

    let barsHtml = '';
    daysData.forEach(d => {
      if (d.total > 0) activeDaysCount++;
      const heightPct = d.total === 0 ? 6 : Math.max(14, Math.round((d.total / maxVal) * 100));
      const todayClass = d.isToday ? 'is-today' : '';
      const futureClass = d.isFuture ? 'is-future' : '';
      const hasActionClass = d.total > 0 ? 'has-action' : 'zero-action';

      barsHtml += `
        <div class="spark-bar-column ${todayClass} ${futureClass} ${hasActionClass}">
          <div class="spark-bar-val">${d.total > 0 ? d.total : (d.isFuture ? '-' : '0')}</div>
          <div class="spark-bar-track">
            <div class="spark-bar-fill" style="height: ${heightPct}%;"></div>
          </div>
          <div class="spark-bar-day">${d.dayName}</div>
          <div class="spark-bar-date">${d.shortDate}</div>
        </div>
      `;
    });
    sparkBarsContainer.innerHTML = barsHtml;

    if (activeDaysBadge) {
      activeDaysBadge.textContent = `本週活躍 ${activeDaysCount} / 7 天`;
    }

    if (motivationText) {
      if (stats.today.total >= 5) {
        motivationText.innerHTML = `🔥 <strong>今日火力全開！</strong> 已累積 <strong>${stats.today.total}</strong> 次推進，動能滿滿！`;
      } else if (stats.today.total > 0) {
        motivationText.innerHTML = `✨ <strong>微步已啟動！</strong> 今日已有 <strong>${stats.today.total}</strong> 次行動，每一步都算數！`;
      } else if (activeDaysCount >= 3) {
        motivationText.innerHTML = `🌿 本週已有 <strong>${activeDaysCount}</strong> 天累積足跡，隨時動手點亮今天！`;
      } else {
        motivationText.innerHTML = `🌱 只要今天動手留下 1 筆紀錄，立刻點亮今天的火花！`;
      }
    }
  }

  // 4. 渲染今日動態清單
  const listEl = document.getElementById('pulseTodayActivityList');
  if (listEl) {
    if (stats.today.progressActions.length === 0 && stats.today.newContacts.length === 0) {
      listEl.innerHTML = `
        <div class="pulse-empty-state">
          <span>🌱</span>
          <p>今日尚無新記錄，去點開任一交匯格或新增名單，立刻點亮今天的微步足跡吧！</p>
        </div>
      `;
    } else {
      let itemsHtml = '';
      
      // 新增名單項目
      stats.today.newContacts.forEach(c => {
        const cName = typeof getClientDisplayName === 'function' ? getClientDisplayName(c.name) : c.name;
        itemsHtml += `
          <div class="pulse-activity-item new-lead-item">
            <span class="activity-type-badge new-lead">👤 新增名單</span>
            <span class="activity-client-name">${escapeHTML(cName)}</span>
            <span class="activity-summary-text">建立全新客戶檔案</span>
          </div>
        `;
      });

      // 推進動態項目
      stats.today.progressActions.forEach(a => {
        const cName = typeof getClientDisplayName === 'function' ? getClientDisplayName(a.contactName) : a.contactName;
        itemsHtml += `
          <div class="pulse-activity-item progress-item">
            <span class="activity-type-badge progress">🚀 推進</span>
            <span class="activity-client-name">${escapeHTML(cName)}</span>
            <span class="activity-topic-pill">${escapeHTML(a.topicTitle)}</span>
            <span class="activity-summary-text">${escapeHTML(a.summary)}</span>
          </div>
        `;
      });

      listEl.innerHTML = itemsHtml;
    }
  }

  // 雙重保險確保彈窗可見度與層級
  modal.classList.add('open');
  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
}

function closeWeeklyPulseModal() {
  const modal = document.getElementById('weeklyPulseModal');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
  }
}

// 顯式掛載到 window，防止模組化隔離或快取導致外部調用失敗
window.openWeeklyPulseModal = openWeeklyPulseModal;
window.closeWeeklyPulseModal = closeWeeklyPulseModal;

// =============================================================================
// 14. 工作日誌速記管理控制器 (Work Log Modal Controller - Master-Detail)
// =============================================================================
let currentSelectedWorkLogId = null;

function openWorkLogModal(targetLogId = null) {
  const modal = document.getElementById('workLogModal');
  if (!modal) return;

  // 1. 渲染左側日誌歷史清單
  renderWorkLogList('');

  // 2. 決定右側編輯區內容
  const logs = (state && Array.isArray(state.workLogs)) ? state.workLogs : [];
  if (targetLogId) {
    loadWorkLogToEditor(targetLogId);
  } else if (logs.length > 0) {
    // 預設選中第一篇（最新）日誌
    loadWorkLogToEditor(logs[0].id);
  } else {
    // 無日誌時，直接進入新增狀態
    resetWorkLogEditor();
  }

  // 3. 雙重保險打開彈窗
  modal.classList.add('open');
  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
}

function closeWorkLogModal() {
  const modal = document.getElementById('workLogModal');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
  }
}

// 渲染左側歷史清單
function renderWorkLogList(keyword = '') {
  const container = document.getElementById('workLogListContainer');
  if (!container || !state) return;

  let logs = Array.isArray(state.workLogs) ? [...state.workLogs] : [];

  // 依日期倒序排列（最新日期在最上方）
  logs.sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  // 搜尋過濾
  const kw = (keyword || '').trim().toLowerCase();
  if (kw) {
    logs = logs.filter(l => 
      (l.subject && l.subject.toLowerCase().includes(kw)) ||
      (l.content && l.content.toLowerCase().includes(kw)) ||
      (l.date && l.date.includes(kw))
    );
  }

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 28px 12px; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
        <span style="font-size: 1.6rem; display: block; margin-bottom: 6px;">🌱</span>
        <p>${kw ? '查無符合條件的日誌' : '尚無工作日誌紀錄，點上方按鈕建立第一篇！'}</p>
      </div>
    `;
    return;
  }

  const todayStr = getLocalTodayDateString();
  let html = '';

  logs.forEach(log => {
    const isActive = log.id === currentSelectedWorkLogId ? 'active' : '';
    const isToday = log.date === todayStr;
    const snippet = (log.content || '').replace(/\s+/g, ' ').slice(0, 60);

    html += `
      <div class="work-log-item-card ${isActive}" data-log-id="${log.id}">
        <div class="work-log-item-top">
          <span class="work-log-item-date">${escapeHTML(log.date || '')}</span>
          ${isToday ? '<span class="work-log-today-badge">今日</span>' : ''}
        </div>
        <div class="work-log-item-subject" title="${escapeHTML(log.subject || '')}">
          ${escapeHTML(log.subject || '未命名工作日誌')}
        </div>
        <div class="work-log-item-snippet">
          ${snippet ? escapeHTML(snippet) : '<span style="font-style:italic;">(無內容)</span>'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 綁定卡片點擊事件
  container.querySelectorAll('.work-log-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const logId = card.getAttribute('data-log-id');
      loadWorkLogToEditor(logId);
    });
  });
}

// 載入日誌至右側編輯區
function loadWorkLogToEditor(logId) {
  if (!state || typeof state.getWorkLog !== 'function') return;
  const log = state.getWorkLog(logId);
  if (!log) return;

  currentSelectedWorkLogId = log.id;

  const idInput = document.getElementById('workLogEditId');
  const dateInput = document.getElementById('workLogDate');
  const subjectInput = document.getElementById('workLogSubject');
  const contentInput = document.getElementById('workLogContent');
  const badgeEl = document.getElementById('workLogEditorBadge');
  const timeHintEl = document.getElementById('workLogTimeHint');
  const btnDelete = document.getElementById('btnDeleteCurrentWorkLog');
  const charCountEl = document.getElementById('workLogCharCount');

  if (idInput) idInput.value = log.id;
  if (dateInput) dateInput.value = log.date || getLocalTodayDateString();
  if (subjectInput) subjectInput.value = log.subject || '';
  if (contentInput) {
    contentInput.value = log.content || '';
    if (charCountEl) charCountEl.textContent = `${(log.content || '').length} 字`;
  }

  if (badgeEl) {
    badgeEl.textContent = '✏️ 編輯日誌';
    badgeEl.style.color = 'var(--accent-primary)';
    badgeEl.style.background = 'rgba(78, 110, 88, 0.1)';
  }

  if (timeHintEl) {
    if (log.updatedAt) {
      const d = new Date(log.updatedAt);
      const timeStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      timeHintEl.textContent = `上次儲存：${timeStr}`;
    } else {
      timeHintEl.textContent = '';
    }
  }

  if (btnDelete) btnDelete.style.display = 'inline-flex';

  // 標記左側 active 樣式
  const container = document.getElementById('workLogListContainer');
  if (container) {
    container.querySelectorAll('.work-log-item-card').forEach(c => {
      if (c.getAttribute('data-log-id') === log.id) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }
}

// 清空編輯區進入「新增」模式
function resetWorkLogEditor() {
  currentSelectedWorkLogId = null;

  const idInput = document.getElementById('workLogEditId');
  const dateInput = document.getElementById('workLogDate');
  const subjectInput = document.getElementById('workLogSubject');
  const contentInput = document.getElementById('workLogContent');
  const badgeEl = document.getElementById('workLogEditorBadge');
  const timeHintEl = document.getElementById('workLogTimeHint');
  const btnDelete = document.getElementById('btnDeleteCurrentWorkLog');
  const charCountEl = document.getElementById('workLogCharCount');

  if (idInput) idInput.value = '';
  if (dateInput) dateInput.value = getLocalTodayDateString();
  if (subjectInput) {
    subjectInput.value = '';
    setTimeout(() => subjectInput.focus(), 60);
  }
  if (contentInput) contentInput.value = '';
  if (charCountEl) charCountEl.textContent = '0 字';

  if (badgeEl) {
    badgeEl.textContent = '✨ 新增日誌';
    badgeEl.style.color = '#ea580c';
    badgeEl.style.background = 'rgba(234, 88, 12, 0.1)';
  }

  if (timeHintEl) timeHintEl.textContent = '填寫後按「儲存日誌」立即保存';
  if (btnDelete) btnDelete.style.display = 'none';

  // 取消左側選中
  const container = document.getElementById('workLogListContainer');
  if (container) {
    container.querySelectorAll('.work-log-item-card').forEach(c => c.classList.remove('active'));
  }
}

// 儲存工作日誌
function saveWorkLogFromEditor() {
  if (!state) return;

  const idInput = document.getElementById('workLogEditId');
  const dateInput = document.getElementById('workLogDate');
  const subjectInput = document.getElementById('workLogSubject');
  const contentInput = document.getElementById('workLogContent');

  const logId = idInput ? idInput.value.trim() : '';
  const date = (dateInput && dateInput.value) ? dateInput.value : getLocalTodayDateString();
  let subject = subjectInput ? subjectInput.value.trim() : '';
  const content = contentInput ? contentInput.value : '';

  if (!subject) {
    subject = `${date} 工作要點記要`;
    if (subjectInput) subjectInput.value = subject;
  }

  let savedLog = null;
  if (logId) {
    savedLog = state.updateWorkLog(logId, { date, subject, content });
  } else {
    savedLog = state.addWorkLog({ date, subject, content });
  }

  if (savedLog) {
    currentSelectedWorkLogId = savedLog.id;
    if (idInput) idInput.value = savedLog.id;

    // 重新渲染清單並載入最新狀態
    const searchInput = document.getElementById('workLogSearchInput');
    renderWorkLogList(searchInput ? searchInput.value : '');
    loadWorkLogToEditor(savedLog.id);

    showToast('💾 工作日誌已成功儲存！');
  }
}

// 刪除當前編輯的日誌
function deleteCurrentWorkLog() {
  const idInput = document.getElementById('workLogEditId');
  const logId = idInput ? idInput.value.trim() : '';
  if (!logId || !state) return;

  const log = state.getWorkLog(logId);
  const logTitle = log ? log.subject : '此篇日誌';

  if (!confirm(`確定要刪除「${logTitle}」嗎？此操作不可復原。`)) {
    return;
  }

  state.deleteWorkLog(logId);
  resetWorkLogEditor();

  const searchInput = document.getElementById('workLogSearchInput');
  renderWorkLogList(searchInput ? searchInput.value : '');

  showToast('🗑️ 日誌已被刪除！');
}

// 顯式掛載到 window，支援全域防呆呼叫
window.openWorkLogModal = openWorkLogModal;
window.closeWorkLogModal = closeWorkLogModal;
window.resetWorkLogEditor = resetWorkLogEditor;
window.saveWorkLogFromEditor = saveWorkLogFromEditor;
window.deleteCurrentWorkLog = deleteCurrentWorkLog;

// =============================================================================
// 🔔 備忘提醒模組 UI 控制器 (Reminders Module UI Controller)
// =============================================================================

// 渲染抽屜最左側專屬備忘提醒清單
function renderTopicRemindersUI(contactId, topicId) {
  const container = document.getElementById('topicRemindersList');
  const countBadge = document.getElementById('topicRemindersCountBadge');
  if (!container || !state) return;

  const reminders = state.getRemindersByTopic(contactId, topicId);
  if (countBadge) {
    const pendingCount = reminders.filter(r => !r.isCompleted).length;
    countBadge.textContent = pendingCount;
  }

  if (reminders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 0.76rem;">
        <span style="font-size: 1.5rem; display: block; margin-bottom: 4px; opacity: 0.5;">📌</span>
        此議題尚無備忘提醒<br>請在上方輸入待辦與完成時程
      </div>
    `;
    return;
  }

  const nowIso = new Date().toISOString().slice(0, 16);
  const todayStr = getLocalTodayDateString();

  let html = '';
  reminders.forEach(rem => {
    const isCompleted = !!rem.isCompleted;
    let cardClass = isCompleted ? 'is-completed' : '';
    let badgeClass = 'badge-future';
    let badgeText = '📅 排程中';

    if (isCompleted) {
      badgeClass = 'badge-completed';
      badgeText = '✅ 已完成';
    } else if (rem.dueTime) {
      if (rem.dueTime < nowIso) {
        cardClass += ' is-overdue';
        badgeClass = 'badge-overdue';
        badgeText = '⚠️ 已逾期';
      } else if (rem.dueTime.startsWith(todayStr)) {
        cardClass += ' is-today';
        badgeClass = 'badge-today';
        badgeText = '🔥 今日到期';
      }
    }

    let timeDisplay = '';
    if (rem.dueTime) {
      const parts = rem.dueTime.split('T');
      timeDisplay = parts.length === 2 ? `${parts[0]} ${parts[1]}` : rem.dueTime;
    } else {
      timeDisplay = '未設時間';
    }

    html += `
      <div class="reminder-item-card ${cardClass}" data-reminder-id="${rem.id}">
        <div class="reminder-card-top">
          <button type="button" class="btn-toggle-reminder-check" data-action="toggle-reminder" data-id="${rem.id}" title="${isCompleted ? '標記為未完成' : '標記為已完成'}">
            ${isCompleted ? '✓' : ''}
          </button>
          <div class="reminder-card-content">${escapeHTML(rem.content)}</div>
          <button type="button" class="btn-delete-reminder" data-action="delete-reminder" data-id="${rem.id}" title="刪除此備忘">✕</button>
        </div>
        <div class="reminder-card-bottom">
          <span class="reminder-due-badge ${badgeClass}">${badgeText}</span>
          <span style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${escapeHTML(timeDisplay)}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

let remindersModalFilter = 'PENDING';
let remindersModalSearch = '';

function openRemindersModal() {
  const modal = document.getElementById('remindersModal');
  if (modal) {
    modal.classList.add('open');
    renderRemindersModalList();
  }
}

function closeRemindersModal() {
  const modal = document.getElementById('remindersModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

function setRemindersModalFilter(filter) {
  remindersModalFilter = filter;
  const chipContainer = document.getElementById('remindersModalFilterChips');
  if (chipContainer) {
    const chips = chipContainer.querySelectorAll('.type-filter-chip');
    chips.forEach(c => {
      if (c.getAttribute('data-filter') === filter) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }
  renderRemindersModalList();
}

function renderRemindersModalList() {
  const container = document.getElementById('remindersTableContainer');
  const totalBadge = document.getElementById('remindersModalTotalCountBadge');
  const summaryHint = document.getElementById('remindersListSummaryHint');
  if (!container || !state) return;

  const allList = state.reminders || [];
  const nowIso = new Date().toISOString().slice(0, 16);
  const todayStr = getLocalTodayDateString();

  const countPending = allList.filter(r => !r.isCompleted).length;
  const countToday = allList.filter(r => !r.isCompleted && r.dueTime && r.dueTime.startsWith(todayStr)).length;
  const countOverdue = allList.filter(r => !r.isCompleted && r.dueTime && r.dueTime < nowIso).length;
  const countCompleted = allList.filter(r => r.isCompleted).length;

  const elPending = document.getElementById('filterCountPending');
  const elToday = document.getElementById('filterCountToday');
  const elOverdue = document.getElementById('filterCountOverdue');
  const elCompleted = document.getElementById('filterCountCompleted');
  const elAll = document.getElementById('filterCountAll');

  if (elPending) elPending.textContent = `(${countPending})`;
  if (elToday) elToday.textContent = `(${countToday})`;
  if (elOverdue) elOverdue.textContent = `(${countOverdue})`;
  if (elCompleted) elCompleted.textContent = `(${countCompleted})`;
  if (elAll) elAll.textContent = `(${allList.length})`;

  if (totalBadge) totalBadge.textContent = `共 ${allList.length} 筆`;

  const filtered = state.getAllReminders(remindersModalFilter, remindersModalSearch);

  if (summaryHint) {
    summaryHint.textContent = `顯示 ${filtered.length} 筆待辦提醒（未完成 ${countPending} 筆）`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">🎉</span>
        <span style="font-weight: 700; font-size: 0.95rem;">目前沒有符合此篩選條件的備忘提醒！</span>
        <p style="font-size: 0.78rem; margin-top: 4px; color: var(--text-muted);">可點開任意客戶與議題，在最左側側欄設定提醒任務。</p>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="reminders-table">
      <thead>
        <tr>
          <th style="width: 50px; text-align: center;">狀態</th>
          <th style="width: 140px;">誰 (客戶)</th>
          <th style="width: 120px;">議題</th>
          <th>要做的事情 (待辦事項)</th>
          <th style="width: 160px;">什麼時候要完成</th>
          <th style="width: 110px; text-align: center;">完成操作</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(rem => {
    const isCompleted = !!rem.isCompleted;
    let badgeClass = 'badge-future';
    let badgeText = '📅 排程中';

    if (isCompleted) {
      badgeClass = 'badge-completed';
      badgeText = '已完成';
    } else if (rem.dueTime) {
      if (rem.dueTime < nowIso) {
        badgeClass = 'badge-overdue';
        badgeText = '⚠️ 已逾期';
      } else if (rem.dueTime.startsWith(todayStr)) {
        badgeClass = 'badge-today';
        badgeText = '🔥 今日到期';
      }
    }

    let timeDisplay = '';
    if (rem.dueTime) {
      const parts = rem.dueTime.split('T');
      timeDisplay = parts.length === 2 ? `${parts[0]} ${parts[1]}` : rem.dueTime;
    } else {
      timeDisplay = '未指定時間';
    }

    const clientDisplayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(rem.contactName) : rem.contactName;

    tableHtml += `
      <tr class="${isCompleted ? 'is-completed' : ''}" data-id="${rem.id}">
        <td style="text-align: center;">
          <button type="button" class="btn-toggle-reminder-check" data-action="toggle-reminder" data-id="${rem.id}" title="${isCompleted ? '標記為未完成' : '標記為已完成'}">
            ${isCompleted ? '✓' : ''}
          </button>
        </td>
        <td>
          <span class="reminders-client-name-cell" data-action="open-topic-from-reminder" data-contact-id="${rem.contactId}" data-topic-id="${rem.topicId}" title="點擊直接打開此客戶的此議題抽屜">
            👤 ${escapeHTML(clientDisplayName)}
          </span>
        </td>
        <td>
          <span class="reminders-topic-cell" data-action="open-topic-from-reminder" data-contact-id="${rem.contactId}" data-topic-id="${rem.topicId}" style="cursor: pointer;" title="點擊直接打開此客戶的此議題抽屜">
            ${escapeHTML(rem.topicTitle)}
          </span>
        </td>
        <td>
          <div class="reminders-task-desc">${escapeHTML(rem.content)}</div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="reminder-due-badge ${badgeClass}" style="width: fit-content;">${badgeText}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${escapeHTML(timeDisplay)}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <button type="button" class="btn-complete-pill ${isCompleted ? 'completed' : ''}" data-action="toggle-reminder" data-id="${rem.id}" title="${isCompleted ? '點擊標記為未完成' : '點擊完成此待辦'}">
              ${isCompleted ? '已完成' : '完成'}
            </button>
            <button type="button" class="btn-delete-reminder" data-action="delete-reminder" data-id="${rem.id}" title="刪除此備忘" style="opacity: 0.6;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;
}

if (typeof window !== 'undefined') {
  window.openRemindersModal = openRemindersModal;
  window.closeRemindersModal = closeRemindersModal;
  window.setRemindersModalFilter = setRemindersModalFilter;
  window.renderRemindersModalList = renderRemindersModalList;
  window.renderTopicRemindersUI = renderTopicRemindersUI;
  window.renderContactScheduleSection = renderContactScheduleSection;
  window.openScheduleLightbox = openScheduleLightbox;
  window.closeScheduleLightbox = closeScheduleLightbox;
  window.zoomScheduleLightbox = zoomScheduleLightbox;
  window.resetScheduleLightboxZoom = resetScheduleLightboxZoom;
}

// =============================================================================
// 學生/準增員課表與作息維護控制器 (Student Schedule Modal & Lightbox Controllers)
// =============================================================================

// 渲染客戶維護 Modal 內的 Section 5 課表作息區塊
function renderContactScheduleSection(contactId) {
  const section = document.getElementById('recruitScheduleModalSection');
  const badge = document.getElementById('recruitScheduleStatusBadge');
  const btnClear = document.getElementById('btnClearScheduleModal');
  const emptyGuide = document.getElementById('scheduleEmptyGuide');
  const previewContainer = document.getElementById('schedulePreviewContainer');
  const previewImg = document.getElementById('recruitSchedulePreviewImg') || document.getElementById('schedulePreviewImage');
  const metaTitle = document.getElementById('scheduleMetaTitle');
  const metaNotes = document.getElementById('scheduleMetaNotes');
  const metaUpdated = document.getElementById('scheduleMetaUpdated');
  const semesterInput = document.getElementById('scheduleSemesterInput');
  const freeTimeInput = document.getElementById('scheduleFreeTimeInput');

  if (!section) return;

  const schedule = (contactId && state && typeof state.getStudentSchedule === 'function') ? state.getStudentSchedule(contactId) : null;
  const hasSchedule = !!(schedule && (schedule.imageUrl || schedule.freeTimeNotes));

  if (hasSchedule) {
    if (badge) {
      badge.textContent = '已登錄課表';
      badge.style.background = 'rgba(16, 185, 129, 0.12)';
      badge.style.color = '#10b981';
      badge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }
    if (btnClear) btnClear.style.display = 'inline-flex';
    if (emptyGuide) emptyGuide.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'flex';
    if (previewImg && schedule.imageUrl) {
      previewImg.src = schedule.imageUrl;
    }
    if (metaTitle) {
      metaTitle.textContent = `${schedule.semester || '115-1 (大三上)'} 課表`;
    }
    if (metaNotes) {
      metaNotes.textContent = schedule.freeTimeNotes ? schedule.freeTimeNotes : '暫無空堂速記';
    }
    if (metaUpdated) {
      const updateStr = schedule.updatedAtStr ? new Date(schedule.updatedAtStr).toLocaleDateString('zh-TW') : (schedule.updatedAt || '近期');
      const fileInfo = schedule.fileName ? `檔案：${escapeHTML(schedule.fileName)} · ` : '';
      metaUpdated.textContent = `${fileInfo}最後更新：${updateStr}`;
    }
    if (semesterInput) semesterInput.value = schedule.semester || '115學年度 第1學期';
    if (freeTimeInput) freeTimeInput.value = schedule.freeTimeNotes || '';
  } else {
    if (badge) {
      badge.textContent = '尚未上傳課表';
      badge.style.background = 'rgba(100, 116, 139, 0.12)';
      badge.style.color = 'var(--text-secondary)';
      badge.style.border = '1px solid rgba(100, 116, 139, 0.25)';
    }
    if (btnClear) btnClear.style.display = 'none';
    if (emptyGuide) emptyGuide.style.display = 'flex';
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (metaTitle) metaTitle.textContent = '115-1 (大三上) 課表';
    if (metaNotes) metaNotes.textContent = '';
    if (metaUpdated) metaUpdated.textContent = '';
    if (semesterInput) semesterInput.value = '115學年度 第1學期';
    if (freeTimeInput) freeTimeInput.value = '';
    const dropZone = document.getElementById('scheduleDropPasteZone');
    if (dropZone) {
      dropZone.removeAttribute('data-pending-image-data');
      dropZone.removeAttribute('data-pending-file-name');
      dropZone.removeAttribute('data-pending-file-size');
    }
  }
}

// 燈箱縮放狀態
let scheduleLightboxZoom = {
  scale: 1,
  minScale: 0.5,
  maxScale: 3.5,
  step: 0.25
};

// 開啟課表全螢幕 Lightbox 檢視器
function openScheduleLightbox(contactId) {
  if (!contactId || !state) return;
  const contact = state.contacts.find(c => c.id === contactId);
  if (!contact) return;

  const schedule = (state.getStudentSchedule && state.getStudentSchedule(contactId)) || null;

  // 若該客戶尚未有課表資料，引導開啟客戶維護視窗進行上傳
  if (!schedule || (!schedule.imageUrl && !schedule.freeTimeNotes)) {
    if (confirm(`【${contact.name}】目前尚未登錄課表作息！\n\n是否立即開啟客戶檔案進行上傳或貼上課表？`)) {
      openContactModal(contactId);
      setTimeout(() => {
        const sec = document.getElementById('recruitScheduleModalSection');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    return;
  }

  const modal = document.getElementById('scheduleLightboxModal');
  const nameEl = document.getElementById('lightboxStudentName');
  const semesterEl = document.getElementById('lightboxSemesterBadge');
  const imgEl = document.getElementById('scheduleLightboxImg');
  const freeSummaryEl = document.getElementById('lightboxFreeTimeText');
  const btnDownload = document.getElementById('btnLightboxDownload');

  if (!modal) return;

  const displayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(contact.name) : contact.name;
  if (nameEl) nameEl.textContent = `學生每週作息課表 (${displayName})`;
  if (semesterEl) semesterEl.textContent = schedule.semester || '作息課表';
  if (imgEl) {
    imgEl.src = schedule.imageUrl || '';
    imgEl.alt = `${contact.name} 課表`;
  }

  if (freeSummaryEl) {
    if (schedule.freeTimeNotes && schedule.freeTimeNotes.trim()) {
      freeSummaryEl.textContent = schedule.freeTimeNotes.trim();
    } else {
      freeSummaryEl.textContent = '暫無特別備註空堂時段。可至客戶檔案中標記方便聯繫之時間。';
    }
  }

  // 重置縮放
  scheduleLightboxZoom.scale = 1;
  applyScheduleLightboxZoom();

  // 綁定下載按鈕
  if (btnDownload) {
    btnDownload.onclick = () => {
      if (!schedule.imageUrl) return;
      const a = document.createElement('a');
      a.href = schedule.imageUrl;
      a.download = `${contact.name}_課表_${schedule.semester || '作息'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (typeof showToast === 'function') showToast(`已下載【${displayName}】課表`);
    };
  }

  modal.classList.add('open');
}

// 關閉課表全螢幕 Lightbox
function closeScheduleLightbox() {
  const modal = document.getElementById('scheduleLightboxModal');
  if (modal) modal.classList.remove('open');
}

// 套用縮放
function applyScheduleLightboxZoom() {
  const imgEl = document.getElementById('scheduleLightboxImg');
  const zoomBtn = document.getElementById('btnZoomReset');
  if (imgEl) {
    imgEl.style.transform = `scale(${scheduleLightboxZoom.scale})`;
  }
  if (zoomBtn) {
    zoomBtn.textContent = `${Math.round(scheduleLightboxZoom.scale * 100)}%`;
  }
}

function zoomScheduleLightbox(delta) {
  scheduleLightboxZoom.scale = Math.max(
    scheduleLightboxZoom.minScale,
    Math.min(scheduleLightboxZoom.maxScale, scheduleLightboxZoom.scale + delta)
  );
  applyScheduleLightboxZoom();
}

function resetScheduleLightboxZoom() {
  scheduleLightboxZoom.scale = 1;
  applyScheduleLightboxZoom();
}




