// =============================================================================
// 5. 事件監聽與互動綁定 (Event Handlers)
// =============================================================================
function setupEventListeners() {
  // 1. 矩陣儲存格點擊 (交匯單元格 & 名單編輯 & 快速新增議題)
  const matrixTable = document.getElementById('matrixTable');
  if (matrixTable) {
    matrixTable.addEventListener('click', (e) => {
      // 恢復全部議題按鈕點擊 (✕ 恢復) - 優先判定避免被 corner-cell 空白區域攔截
      const clearFocusBtn = e.target.closest('#btnClearTopicFocus');
      if (clearFocusBtn) {
        e.stopPropagation();
        state.resetContactTopicFilter();
        renderMatrix();
        showToast('已恢復顯示全部客戶與議題', 'info');
        return;
      }

      // 快速新增議題按鈕點擊 (+ 議題) - 透過事件委派確保動態重繪後依然生效
      const quickAddTopicBtn = e.target.closest('#btnQuickAddTopic');
      if (quickAddTopicBtn) {
        e.stopPropagation();
        openTopicManagerDrawer();
        return;
      }

      // 快速新增名單按鈕點擊 (+ 名單)
      const quickAddContactBtn = e.target.closest('#btnQuickAddContact');
      if (quickAddContactBtn) {
        e.stopPropagation();
        openContactModal(null);
        return;
      }

      // 快速新增準增員按鈕點擊 (準增員空狀態引導按鈕)
      const emptyAddRecruitBtn = e.target.closest('#btnEmptyAddRecruit');
      if (emptyAddRecruitBtn) {
        e.stopPropagation();
        openContactModal(null);
        return;
      }

      // 點擊螢光藍分隔線徽章按鈕：切換隱藏/展開今天已更新名單
      const toggleHideBtn = e.target.closest('#btnToggleHideUpdated, [data-action="toggle-hide-updated"]');
      if (toggleHideBtn) {
        e.stopPropagation();
        const isHidden = state.toggleHideUpdatedContacts();
        renderMatrix();
        showToast(isHidden ? '已隱藏今天已更新名單' : '已展開今天已更新名單', 'info');
        return;
      }

      // 點擊左上角角格 (.corner-cell) - 分流處理點擊特定客群膠囊按鈕 vs 點擊儲存格其餘空白處啟動切換
      const cornerTypeBtn = e.target.closest('.corner-type-btn');
      const cornerCell = e.target.closest('th.corner-cell');
      if (cornerTypeBtn) {
        e.stopPropagation();
        const targetType = cornerTypeBtn.getAttribute('data-type');
        state.setClientType(targetType);
        document.querySelectorAll('#topicCategoryTabs .filter-tab').forEach(t => t.classList.remove('active'));
        renderMatrix();
        let toastMsg = '已切換至【個人客戶】名單';
        if (targetType === 'CORPORATE') toastMsg = '已切換至【企業客戶】名單';
        if (targetType === 'RECRUIT') toastMsg = '已切換至【準增員】名單';
        showToast(toastMsg, 'info');
        return;
      } else if (cornerCell && !e.target.closest('.corner-action-btn')) {
        // 點擊儲存格空白區域（排除右側 + 議題 / + 名單 / ✕ 恢復按鈕）：啟動循環切換客群名單
        e.stopPropagation();
        const currentType = state.toggleClientType();
        document.querySelectorAll('#topicCategoryTabs .filter-tab').forEach(t => t.classList.remove('active'));
        renderMatrix();
        let toastMsg = '已切換至【個人客戶】名單';
        if (currentType === 'CORPORATE') toastMsg = '已切換至【企業客戶】名單';
        if (currentType === 'RECRUIT') toastMsg = '已切換至【準增員】名單';
        showToast(toastMsg, 'info');
        return;
      }

      // 點擊交匯儲存格
      const cell = e.target.closest('td.matrix-cell');
      if (cell) {
        const contactId = cell.getAttribute('data-contact-id');
        const topicId = cell.getAttribute('data-topic-id');
        if (contactId && topicId) {
          openQuickLogDrawer(contactId, topicId);
        }
        return;
      }

      // 點擊名單姓名列 (嚴格區分：點星星切換關注、點姓名開啟客戶維護、其餘空間一律啟動篩選)
      const contactHeader = e.target.closest('th.contact-cell');
      if (contactHeader) {
        const contactId = contactHeader.getAttribute('data-contact-id');
        if (contactId) {
          // 判定 1-1：點擊到「🎓 課表徽章按鈕」
          const schedBtn = e.target.closest('[data-action="view-schedule"]') || e.target.closest('.badge-student-schedule');
          if (schedBtn) {
            e.stopPropagation();
            if (typeof openScheduleLightbox === 'function') {
              openScheduleLightbox(contactId);
            }
            return;
          }

          // 判定 1：點擊到「⭐ 關注星號按鈕」
          const starBtn = e.target.closest('.btn-star-focus');
          if (starBtn) {
            e.stopPropagation();
            const isNowFocused = state.toggleContactFocus(contactId);
            const contact = state.contacts.find(c => c.id === contactId);
            const contactName = contact ? contact.name : '此客戶';
            renderMatrix();
            showToast(isNowFocused ? `已將【${contactName}】設為 ⭐ 關注名單` : `已取消【${contactName}】的關注標記`, 'info');
            return;
          }

          // 判定 2：點擊到「客戶姓名文字」才開啟維護介面
          const isNameClick = !!e.target.closest('.contact-name-text');
          if (isNameClick) {
            openContactModal(contactId);
          } else {
            // 其餘任何空間（燈號、特質徽章、空白空間）：啟動/切換該客戶的議題篩選聚攏 (有記錄 ➔ 未開 ➔ 全部)
            // 防呆條件：若該客戶尚未設定/開展任何議題紀錄，則保持全部、不觸發篩選無反應
            const toggled = state.toggleContactTopicFilter(contactId);
            const contact = state.contacts.find(c => c.id === contactId);
            const contactName = contact ? contact.name : '此客戶';
            if (!toggled) {
              showToast(`【${contactName}】目前尚無議題紀錄，維持顯示全部議題`, 'info');
            } else {
              const activeFocus = state.contactTopicFilter;
              if (activeFocus && activeFocus.mode === 'TOUCHED') {
                showToast(`已鎖定【${contactName}】推進議題，並自動帶出同議題有推進之客戶`, 'success');
              } else if (activeFocus && activeFocus.mode === 'UNTOUCHED') {
                showToast(`顯示【${contactName}】尚未開展之議題`, 'info');
              } else {
                showToast('已恢復顯示全部客戶與議題', 'info');
              }
            }
            renderMatrix();
          }
        }
        return;
      }

      // 點擊議題標頭事件分流：
      // 1. 僅在點擊「議題名稱文字/按鈕」時開啟議題維護視窗
      // 2. 點擊「其餘任何空間」（卡片背景、空白區域、頂部標籤、th 儲存格）均為針對此議題的客戶篩選
      const topicHeader = e.target.closest('th.topic-col');
      if (topicHeader) {
        const topicId = topicHeader.getAttribute('data-topic-id');
        if (topicId) {
          // 判定 1：只有點擊到「議題名稱文字按鈕」才開啟議題維護
          const editBtn = e.target.closest('button[data-action="edit-topic"], .topic-title-edit-btn');
          if (editBtn) {
            e.stopPropagation();
            openTopicEditModal(topicId);
            return;
          }

          // 判定 2：點擊卡片其餘任何空間，一律執行此議題的客戶篩選
          e.stopPropagation();
          const isActivated = state.toggleTopicFocusFilter(topicId);
          const targetTopic = state.topics.find(t => t.id === topicId);
          const topicName = targetTopic ? targetTopic.title : '該議題';
          renderMatrix();
          if (isActivated) {
            showToast(`已篩選推進過【${topicName}】之客戶名單（再次點擊空白處恢復全部）`, 'info');
          } else {
            showToast('已恢復顯示全部客戶與議題', 'info');
          }
          return;
        }
      }
    });

    // 1-2. 成人 ADHD 友善：十字光標防跳行導引 (Crosshair Focus)
    matrixTable.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('td.matrix-cell');
      const contactCell = e.target.closest('th.contact-cell');

      if (cell) {
        const colIdx = cell.cellIndex;
        const row = cell.parentElement;

        // 清除舊高亮
        matrixTable.querySelectorAll('.crosshair-row').forEach(r => r.classList.remove('crosshair-row'));
        matrixTable.querySelectorAll('.crosshair-col').forEach(c => c.classList.remove('crosshair-col'));

        // 加入新十字高亮 (行與列)
        row.classList.add('crosshair-row');
        matrixTable.querySelectorAll(`tbody tr td:nth-child(${colIdx + 1}), thead tr th:nth-child(${colIdx + 1})`).forEach(c => {
          c.classList.add('crosshair-col');
        });
      } else if (contactCell) {
        const row = contactCell.parentElement;
        matrixTable.querySelectorAll('.crosshair-row').forEach(r => r.classList.remove('crosshair-row'));
        matrixTable.querySelectorAll('.crosshair-col').forEach(c => c.classList.remove('crosshair-col'));
        row.classList.add('crosshair-row');
      }
    });

    matrixTable.addEventListener('mouseleave', () => {
      matrixTable.querySelectorAll('.crosshair-row').forEach(r => r.classList.remove('crosshair-row'));
      matrixTable.querySelectorAll('.crosshair-col').forEach(c => c.classList.remove('crosshair-col'));
    });
  }

  // 1-3. 水平捲動邊界提示 (Scrolled Visual Shadow)
  const matrixContainer = document.getElementById('matrixContainer');
  if (matrixContainer) {
    matrixContainer.addEventListener('scroll', () => {
      if (matrixContainer.scrollLeft > 10) {
        matrixContainer.classList.add('is-scrolled');
      } else {
        matrixContainer.classList.remove('is-scrolled');
      }
    }, { passive: true });

    // 1-4. Cmd + 滾輪橫向滾動 (Cmd + Wheel Horizontal Scroll)
    matrixContainer.addEventListener('wheel', (e) => {
      // 判斷是否按住 Cmd (Mac: metaKey) 或 Ctrl (Windows: ctrlKey)
      if (e.metaKey || e.ctrlKey) {
        // 阻止瀏覽器預設的整頁縮放 (Zoom) 行為
        e.preventDefault();

        // 將垂直滾輪量轉化為橫向平移（依使用者偏好反向映射）
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        matrixContainer.scrollLeft -= delta;
      }
    }, { passive: false });
  }

  // 2. 抽屜關閉與遮罩點擊
  const closeLogDrawerBtn = document.getElementById('closeLogDrawerBtn');
  const closeTopicDrawerBtn = document.getElementById('closeTopicDrawerBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');

  if (closeLogDrawerBtn) closeLogDrawerBtn.addEventListener('click', closeDrawers);
  if (closeTopicDrawerBtn) closeTopicDrawerBtn.addEventListener('click', closeDrawers);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawers);
  const btnDrawerBackToStatusList = document.getElementById('btnDrawerBackToStatusList');
  if (btnDrawerBackToStatusList) btnDrawerBackToStatusList.addEventListener('click', closeDrawers);

  // 3. 鍵盤 ESC 快速關閉
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawers();
      closeModals();
    }
  });

  // 4. 狀態單選標籤切換
  document.querySelectorAll('.status-radio-label').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.status-radio-label').forEach(l => l.classList.remove('checked'));
      label.classList.add('checked');
      const radio = label.querySelector('input');
      if (radio) {
        radio.checked = true;
        // 若切換為「約定」狀態，自動引導聚焦並高亮「🤝 約定見面／交付時間」輸入框
        if (radio.value === 'appointment') {
          const apptInput = document.getElementById('logAppointmentTimeInput');
          if (apptInput) {
            apptInput.classList.add('schedule-input-highlight');
            apptInput.focus();
            setTimeout(() => apptInput.classList.remove('schedule-input-highlight'), 1800);
          }
        }
      }
    });
  });

  // 4-0. 約定見面/交付時間輸入變更時，自動聯動切換推進狀態為「約定」
  const logApptTimeInput = document.getElementById('logAppointmentTimeInput');
  if (logApptTimeInput) {
    logApptTimeInput.addEventListener('change', () => {
      if (logApptTimeInput.value) {
        setDrawerStatusRadio('appointment');
        const summaryInput = document.getElementById('logSummaryInput');
        if (summaryInput && !summaryInput.value.trim()) {
          const formatted = logApptTimeInput.value.replace('T', ' ');
          summaryInput.placeholder = `已設定約定時間：${formatted}（可在此補充會面地點或細節）`;
        }
      }
    });
  }

  // 4-1. 常用回饋一鍵標籤 (點選自動帶入溝通重點，並自動切換狀態)
  const feedbackChips = document.querySelectorAll('#feedbackQuickChips .quick-chip');
  feedbackChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const text = chip.getAttribute('data-text');
      const status = chip.getAttribute('data-status');
      const summaryInput = document.getElementById('logSummaryInput');
      if (summaryInput) {
        if (!summaryInput.value.trim()) {
          summaryInput.value = text;
        } else {
          summaryInput.value += `；${text}`;
        }
      }
      if (status) {
        setDrawerStatusRadio(status);
      }
    });
  });

  // 4-2. 常用下一步一鍵標籤
  const actionChips = document.querySelectorAll('#actionQuickChips .quick-chip');
  actionChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const text = chip.getAttribute('data-text');
      const nextActionInput = document.getElementById('logNextActionInput');
      if (nextActionInput) {
        nextActionInput.value = text;
      }
    });
  });

  // 5. 快速定聯微紀錄表單送出
  const quickLogForm = document.getElementById('quickLogForm');
  if (quickLogForm) {
    quickLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const { contactId, topicId } = state.activeCell;
      if (!contactId || !topicId) return;

      const date = document.getElementById('logDateInput').value;
      const channel = document.getElementById('logChannelSelect').value;
      const statusRadio = document.querySelector('input[name="touchStatus"]:checked');
      const status = statusRadio ? statusRadio.value : 'in_progress';
      const summary = document.getElementById('logSummaryInput').value.trim();
      const nextAction = document.getElementById('logNextActionInput').value.trim();
      const transcriptInput = document.getElementById('logTranscriptInput');
      const transcript = transcriptInput ? transcriptInput.value.trim() : '';
      const remindClientTime = document.getElementById('logRemindClientTimeInput')?.value || '';
      const appointmentTime = document.getElementById('logAppointmentTimeInput')?.value || '';

      const isRejected = (status === 'rejected');

      // 提取出國旅遊專屬資料 (若為出國旅遊議題)
      let travelData = undefined;
      const currentTopic = state.topics.find(t => t.id === topicId);
      const isTravelTopic = (topicId === 't_travel' || (currentTopic && currentTopic.title === '出國旅遊'));
      if (isTravelTopic) {
        const dest = document.getElementById('travelDestinationInput')?.value.trim() || '';
        const dep = document.getElementById('travelDepartureInput')?.value || '';
        const ret = document.getElementById('travelReturnInput')?.value || '';
        const cardState = document.getElementById('taskPillCard')?.getAttribute('data-state') || 'none';
        const insuranceState = document.getElementById('taskPillInsurance')?.getAttribute('data-state') || 'none';
        const rightsState = document.getElementById('taskPillRights')?.getAttribute('data-state') || 'none';
        const returnState = document.getElementById('taskPillReturn')?.getAttribute('data-state') || 'none';

        travelData = {
          destination: dest,
          departureTime: dep,
          returnTime: ret,
          cardState,
          hasCard: cardState === 'done',
          insuranceState,
          insuranceReminded: insuranceState === 'done',
          rightsState,
          rightsNotified: rightsState === 'done',
          returnState,
          returnedReminded: returnState === 'done'
        };
      }

      // 智慧生成摘要預設值（優先依據使用者設定之約定/提醒時間或狀態，絕不重複抓取舊歷史）
      let autoSummary = '';
      if (appointmentTime) {
        autoSummary = `🤝 約定會面／交付時間：${appointmentTime.replace('T', ' ')}`;
      } else if (remindClientTime) {
        autoSummary = `🔔 提醒對方：${remindClientTime.replace('T', ' ')}`;
      } else if (status === 'appointment') {
        autoSummary = '🤝 約定推進會談與後續事項';
      } else if (status) {
        const sm = getStatusMeta(status);
        autoSummary = `推進狀態更新為【${sm ? sm.label : status}】`;
      } else {
        autoSummary = '例行議題定聯關懷';
      }

      const fallbackSummary = isRejected 
        ? '客戶明確婉拒本議題' 
        : (isTravelTopic && travelData?.destination 
            ? `✈️ 掌握前往【${travelData.destination}】旅遊動態` 
            : autoSummary);

      state.saveTouchpointLog(contactId, topicId, {
        date,
        channel,
        status,
        summary: summary || fallbackSummary,
        nextAction,
        transcript,
        travel: travelData,
        remindClientTime,
        appointmentTime
      });

      // 1. 若有選定下一個連動議題，一併自動建立其「預計提出」紀錄（即使當前議題為婉拒亦穩定連動保存）
      let savedNextTitle = '';
      if (state.pendingNextTopicId) {
        const nextTopic = state.topics.find(t => t.id === state.pendingNextTopicId);
        const currentTopic = state.topics.find(t => t.id === topicId);
        const currentTitle = currentTopic ? currentTopic.title : '當前議題';
        const todayDate = date || getLocalTodayDateString();

        state.saveTouchpointLog(contactId, state.pendingNextTopicId, {
          date: todayDate,
          channel: '預計提出',
          status: 'planned',
          summary: isRejected 
            ? `【婉拒轉向】婉拒【${currentTitle}】後，轉向設定此議題為下一個切入焦點。`
            : `【議題連動】完成【${currentTitle}】交流後，連動設定接續提出此議題。`,
          nextAction: nextAction || '準備相關切入素材與破冰時機',
          transcript: ''
        });

        savedNextTitle = nextTopic ? nextTopic.title : '';
        state.pendingNextTopicId = null;
        syncDrawerStrategyHeroButton();
      }

      renderMatrix();
      
      // 2. 若推進狀態為拒絕：
      // - 若剛剛已在抽屜選定下一個議題，則直接完成閉環，無需再次跳窗！
      // - 若尚未選定任何下一個議題，才彈出戰略看板引導顧問挑選
      if (isRejected) {
        closeDrawers();
        if (savedNextTitle) {
          showToast(`已記錄婉拒，並已成功連動將【${savedNextTitle}】設為下一個預計提出！`, 'warning');
        } else {
          showToast('已記錄婉拒狀態，為您啟動戰略看板！', 'warning');
          openNextTopicStrategyModal(contactId, topicId);
        }
        return;
      }

      // 3. 若此維護是從「推進狀況彙總清單」開啟，存檔後自動返回推進清單
      if (statusListModalState.returnAfterDrawerClose) {
        statusListModalState.lastUpdatedCell = { contactId, topicId };
        showToast(savedNextTitle 
          ? `微紀錄已保存，連動【${savedNextTitle}】，已返回推進清單！` 
          : '定聯微紀錄已成功保存！已返回推進清單', 'success');
        closeDrawers();
        return;
      }

      if (savedNextTitle) {
        showToast(`微紀錄已保存，並已連動將【${savedNextTitle}】設為下一個預計提出！`, 'success');
      } else {
        showToast('定聯微紀錄已成功保存！');
      }

      // 更新抽屜時間軸與大按鈕狀態（保留使用者輸入文字，杜絕清空驚嚇）
      const tp = state.getTouchpoint(contactId, topicId);
      renderTimelineHistory(tp);
      syncDrawerStrategyHeroButton();
    });

    // 5-0. 抽屜時程排定與提醒：一鍵清除日期時間按鈕
    document.querySelectorAll('.btn-clear-schedule-time').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('data-target');
        if (targetId) {
          const input = document.getElementById(targetId);
          if (input) input.value = '';
        }
      });
    });
  }

  // 5-A. 點擊抽屜大按鈕：開啟大畫面全地圖議題戰略看板
  const btnOpenStrategyDrawer = document.getElementById('btnOpenStrategyMapDrawer');
  if (btnOpenStrategyDrawer) {
    btnOpenStrategyDrawer.addEventListener('click', () => {
      const { contactId, topicId } = state.activeCell || {};
      if (contactId) {
        openNextTopicStrategyModal(contactId, null, true);
      } else {
        showToast('請先選擇客戶格位', 'warning');
      }
    });
  }

  // 5-B. 清除選取的下一個推進議題
  const btnClearNextTopic = document.getElementById('btnClearNextPlannedTopic');
  if (btnClearNextTopic) {
    btnClearNextTopic.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.pendingNextTopicId = null;
      syncDrawerStrategyHeroButton();
      const nextActionInput = document.getElementById('logNextActionInput');
      if (nextActionInput && nextActionInput.value.startsWith('預計提出【')) {
        nextActionInput.value = '';
      }
      showToast('已取消選取下一個推進議題');
    });
  }

  // 5-C. 出國旅遊專屬動態追蹤卡事件監聽
  const quickDestContainer = document.getElementById('travelQuickDestinations');
  if (quickDestContainer) {
    quickDestContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.travel-chip-btn');
      if (!btn) return;
      const dest = btn.getAttribute('data-dest');
      const input = document.getElementById('travelDestinationInput');
      if (input) {
        input.value = dest;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateTravelSmartBanner();
      }
    });
  }

  // 旅遊起訖時間變更自動連動智能診斷條
  const depInput = document.getElementById('travelDepartureInput');
  const retInput = document.getElementById('travelReturnInput');
  const destInput = document.getElementById('travelDestinationInput');
  if (depInput) depInput.addEventListener('change', updateTravelSmartBanner);
  if (retInput) retInput.addEventListener('change', updateTravelSmartBanner);
  if (destInput) destInput.addEventListener('input', updateTravelSmartBanner);

  // 四大業務任務檢核晶片狀態輪替切換 (none ➔ progress ➔ done ➔ none)
  const tasksGrid = document.getElementById('travelTasksGrid');
  if (tasksGrid) {
    const taskStateCycles = {
      card: {
        sequence: ['none', 'progress', 'done'],
        labels: { none: '未申辦', progress: '已通知申辦', done: '已持旅平卡' }
      },
      insurance: {
        sequence: ['none', 'progress', 'done'],
        labels: { none: '未提醒', progress: '已傳送試算', done: '已完成投保' }
      },
      rights: {
        sequence: ['none', 'progress', 'done'],
        labels: { none: '未告知', progress: '已告知注意事項', done: '已備妥急難條款' }
      },
      return: {
        sequence: ['none', 'progress', 'done'],
        labels: { none: '旅程籌劃中', progress: '待回國關懷', done: '已完成接風致意' }
      }
    };

    tasksGrid.addEventListener('click', (e) => {
      const pill = e.target.closest('.travel-task-pill');
      if (!pill) return;
      const taskType = pill.getAttribute('data-task');
      const conf = taskStateCycles[taskType];
      if (!conf) return;

      const currentState = pill.getAttribute('data-state') || 'none';
      const curIdx = conf.sequence.indexOf(currentState);
      const nextIdx = (curIdx + 1) % conf.sequence.length;
      const nextState = conf.sequence[nextIdx];

      pill.setAttribute('data-state', nextState);
      const textEl = pill.querySelector('.task-status-text');
      if (textEl) {
        textEl.textContent = conf.labels[nextState];
      }
    });
  }

  // 出國旅遊快捷備忘話術一鍵填入
  const btnPreTravel = document.getElementById('btnAutoTextPreTravel');
  const btnPostTravel = document.getElementById('btnAutoTextPostTravel');
  if (btnPreTravel) {
    btnPreTravel.addEventListener('click', () => {
      const dest = document.getElementById('travelDestinationInput')?.value.trim() || '國外';
      const summaryBox = document.getElementById('logSummaryInput');
      const nextActionBox = document.getElementById('logNextActionInput');
      if (summaryBox) {
        summaryBox.value = `得知朋友近期將前往【${dest}】旅遊。已向其說明可透過旅平卡進行快速預約投保，並預計提醒包含海外突發急難救助與醫療額度。`;
      }
      if (nextActionBox) {
        nextActionBox.value = `出發前 3 天提醒完成旅平險開通，並傳送海外就醫須知與急難專線權益。`;
      }
      showToast('已填入出發前叮嚀備忘話術');
    });
  }

  if (btnPostTravel) {
    btnPostTravel.addEventListener('click', () => {
      const dest = document.getElementById('travelDestinationInput')?.value.trim() || '國外';
      const summaryBox = document.getElementById('logSummaryInput');
      const nextActionBox = document.getElementById('logNextActionInput');
      if (summaryBox) {
        summaryBox.value = `朋友已順利自【${dest}】返國。主動進行溫馨接風關懷，詢問旅程一切是否平安順利，關心有無班機延誤或需協助之處。`;
      }
      if (nextActionBox) {
        nextActionBox.value = `相約咖啡隨聊分享旅途趣事，自然維繫長期信任關係。`;
      }
      showToast('已填入回國暖心關懷話術');
    });
  }

  // 5-1. 時間軸單筆歷史紀錄刪除委託
  const timelineListEl = document.getElementById('logTimelineList');
  if (timelineListEl) {
    timelineListEl.addEventListener('click', (e) => {
      // 處理單筆微紀錄編輯
      const editBtn = e.target.closest('[data-action="edit-history-item"]');
      if (editBtn) {
        const index = parseInt(editBtn.dataset.index, 10);
        if (!isNaN(index)) {
          openEditTimelineModal(index);
        }
        return;
      }

      // 處理單筆微紀錄刪除
      const delBtn = e.target.closest('[data-action="delete-history-item"]');
      if (!delBtn) return;
      const index = parseInt(delBtn.dataset.index, 10);
      if (isNaN(index)) return;

      if (!state.activeCell) return;
      const { contactId, topicId } = state.activeCell;
      const key = `${contactId}_${topicId}`;
      const tp = state.touchpoints[key];
      if (!tp || !tp.history || !tp.history[index]) return;

      const targetItem = tp.history[index];
      if (confirm(`確定要刪除 ${targetItem.date} 的這筆互動紀錄嗎？`)) {
        state.deleteTouchpointHistoryItem(contactId, topicId, index);
        renderTimelineHistory(state.touchpoints[key]);
        renderMatrix();
        showToast('已刪除該筆互動紀錄', 'warning');
      }
    });
  }

  // 5-1-B. 單筆定聯歷史紀錄編輯表單提交
  const editTimelineForm = document.getElementById('editTimelineForm');
  if (editTimelineForm) {
    editTimelineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.activeCell) return;
      const { contactId, topicId } = state.activeCell;
      const key = `${contactId}_${topicId}`;
      const tp = state.touchpoints[key];
      if (!tp || !tp.history) return;

      const index = parseInt(document.getElementById('editTimelineHistoryIndex').value, 10);
      if (isNaN(index) || !tp.history[index]) return;

      const updatedDate = document.getElementById('editTimelineDate').value;
      const updatedChannel = document.getElementById('editTimelineChannel').value;
      const updatedStatus = document.getElementById('editTimelineStatus').value;
      const updatedSummary = document.getElementById('editTimelineSummary').value.trim();
      const updatedNextAction = document.getElementById('editTimelineNextAction').value.trim();
      const updatedRemindTime = document.getElementById('editTimelineRemindClientTime').value;
      const updatedAppointmentTime = document.getElementById('editTimelineAppointmentTime').value;
      const updatedTranscript = document.getElementById('editTimelineTranscript')?.value.trim() || '';

      const success = state.updateTouchpointHistoryItem(contactId, topicId, index, {
        date: updatedDate,
        channel: updatedChannel,
        status: updatedStatus,
        summary: updatedSummary,
        nextAction: updatedNextAction,
        remindClientTime: updatedRemindTime,
        appointmentTime: updatedAppointmentTime,
        transcript: updatedTranscript
      });

      if (success) {
        closeModals();
        renderTimelineHistory(state.touchpoints[key]);
        renderMatrix();
        // 若編輯的是最新一筆，也同步抽屜左側的時程輸入欄位
        if (index === 0) {
          const remindInput = document.getElementById('logRemindClientTimeInput');
          const apptInput = document.getElementById('logAppointmentTimeInput');
          if (remindInput) remindInput.value = updatedRemindTime;
          if (apptInput) apptInput.value = updatedAppointmentTime;
        }
        showToast('定聯微紀錄已成功更新！');
      } else {
        showToast('更新失敗，請稍後再試', 'error');
      }
    });
  }

  // 關閉 editTimelineModal 按鈕
  document.getElementById('closeEditTimelineModalBtn')?.addEventListener('click', closeModals);
  document.getElementById('cancelEditTimelineBtn')?.addEventListener('click', closeModals);

  // 5-2. 清空單一交匯儲存格的所有紀錄 (重設為＋)
  const btnClearCell = document.getElementById('btnClearCellTouchpoint');
  if (btnClearCell) {
    btnClearCell.addEventListener('click', () => {
      if (!state.activeCell) return;
      const { contactId, topicId } = state.activeCell;
      const contact = state.contacts.find(c => c.id === contactId);
      const topic = state.topics.find(t => t.id === topicId);
      const clientName = contact ? contact.name : '此客戶';
      const topicName = topic ? topic.title : '此議題';

      if (confirm(`確定要清空【${clientName}】在【${topicName}】的所有定聯紀錄嗎？\n該儲存格將重設回未互動的「＋」狀態。`)) {
        state.clearTouchpoint(contactId, topicId);
        closeDrawers();
        renderMatrix();
        showToast(`已清空【${clientName}】在【${topicName}】的紀錄`, 'warning');
      }
    });
  }

  // 6. 一鍵複製說帖小抄
  const btnCopyScript = document.getElementById('btnCopyScript');
  if (btnCopyScript) {
    btnCopyScript.addEventListener('click', () => {
      const scriptText = document.getElementById('logTopicScript').textContent;
      navigator.clipboard.writeText(scriptText).then(() => {
        showToast('已複製 UMBC 說帖到剪貼簿！');
      }).catch(() => {
        showToast('複製失敗，請手動選取', 'error');
      });
    });
  }

  // 7. 即時搜尋與對象範疇切換 (兩選項直接呈現由左至右、點擊單選靠左隱藏其餘、ESC 雙階還原)
  const searchInput = document.getElementById('contactSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchScopeGroup = document.getElementById('searchScopeGroup');

  const scopePlaceholders = {
    'TOPIC': '搜尋議題標題、UMBC 說帖關鍵字...',
    'CONTACT': '搜尋客戶姓名、客群分類、標籤...',
    'ALL': '搜尋議題、說帖、客戶、標籤...'
  };

  const defaultPlaceholder = '搜尋議題、說帖、客戶、標籤...';

  // 清除選項選擇，跳回來兩個選項由左至右呈現
  function resetScopeSelection() {
    if (!searchScopeGroup) return;
    searchScopeGroup.classList.remove('has-selection');
    searchScopeGroup.querySelectorAll('.scope-pill-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    state.filters.searchScope = 'ALL';
    if (searchInput) {
      searchInput.placeholder = defaultPlaceholder;
      setTimeout(() => {
        searchInput.focus();
      }, 20);
    }
    renderMatrix();
  }

  // 點擊並選定特定範疇：留下被點擊選項靠左，隱藏其餘選項
  function setScopeSelection(selectedScope, shouldFocus = true) {
    if (!searchScopeGroup) return;
    const targetBtn = searchScopeGroup.querySelector(`.scope-pill-btn[data-scope="${selectedScope}"]`);
    if (!targetBtn) return;

    searchScopeGroup.classList.add('has-selection');
    searchScopeGroup.querySelectorAll('.scope-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn === targetBtn);
    });

    state.filters.searchScope = selectedScope;
    if (searchInput) {
      searchInput.placeholder = scopePlaceholders[selectedScope] || defaultPlaceholder;
      if (shouldFocus) {
        setTimeout(() => {
          searchInput.focus();
          if (searchInput.select) searchInput.select();
        }, 30);
      }
    }
    renderMatrix();
  }

  if (searchScopeGroup) {
    searchScopeGroup.addEventListener('click', (e) => {
      const pillBtn = e.target.closest('.scope-pill-btn');
      if (!pillBtn) return;

      const scope = pillBtn.getAttribute('data-scope');
      // 若該選項已選中且處於單選靠左狀態，再次點擊還原為三個選項
      if (pillBtn.classList.contains('active') && searchScopeGroup.classList.contains('has-selection')) {
        resetScopeSelection();
      } else {
        setScopeSelection(scope);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.filters.search = val;
      if (searchClearBtn) {
        searchClearBtn.style.display = val ? 'block' : 'none';
      }

      // 【即時篩選：打字時預設優先針對名單客戶】
      if (val.trim().length > 0) {
        // 若當前並非使用者手動切換至 TOPIC 模式，預設自動維持/切入 CONTACT 名單模式
        if (state.filters.searchScope !== 'TOPIC') {
          setScopeSelection('CONTACT', false);
        } else {
          renderMatrix();
        }
      } else {
        // 清空時自動雙階重置為雙膠囊呈現
        resetScopeSelection();
      }
    });

    // 鍵盤互動：
    // 1. Enter 鍵（防選字衝突）：單按在【名單 ⇄ 議題】之間極速流轉切換
    // 2. ESC 鍵：雙階還原
    searchInput.addEventListener('keydown', (e) => {
      // 處理 Enter 鍵二次切換
      if (e.key === 'Enter') {
        if (e.isComposing) return; // 嚴格防呆：注音/拼音中文選字中不觸發切換
        e.preventDefault();
        e.stopPropagation();

        // 單按 Enter：在【名單 ⇄ 議題】之間極速流轉切換
        if (state.filters.searchScope === 'TOPIC') {
          setScopeSelection('CONTACT', false);
          showToast('👤 已切換為【依名單搜尋】（再按 Enter 切換為議題）', 'info');
        } else {
          setScopeSelection('TOPIC', false);
          showToast('🎯 已切換為【依議題搜尋】（再按 Enter 切換為名單）', 'info');
        }
        return;
      }

      // 核心 ESC 鍵雙階交互：
      // 1. 若欄位有字元 -> 清除搜尋文字
      // 2. 若欄位無字元 -> 清除選項的選擇，跳回來兩個選項
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        if (searchInput.value.length > 0) {
          searchInput.value = '';
          state.filters.search = '';
          if (searchClearBtn) searchClearBtn.style.display = 'none';
          resetScopeSelection();
        } else {
          resetScopeSelection();
        }
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        state.filters.search = '';
        searchClearBtn.style.display = 'none';
        renderMatrix();
        searchInput.focus();
      }
    });
  }

  // 全域 ESC 輔助：若焦點在搜尋框外且非彈窗互動，按 ESC 同樣觸發雙階還原
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const openModal = document.querySelector('.modal-backdrop.open, .drawer-container.open, .side-drawer.open');
      if (openModal) return; // 優先讓開啟中的 Modal 關閉

      if (document.activeElement === searchInput) {
        return; // 已由 searchInput 的 keydown 監聽器處理
      }

      if (searchInput && (searchInput.value.length > 0 || (searchScopeGroup && searchScopeGroup.classList.contains('has-selection')))) {
        e.preventDefault();
        if (searchInput.value.length > 0) {
          searchInput.value = '';
          state.filters.search = '';
          if (searchClearBtn) searchClearBtn.style.display = 'none';
          renderMatrix();
          searchInput.focus();
        } else {
          resetScopeSelection();
        }
      }
    }
  });

  // 議題管理抽屜即時搜尋
  const tmSearchInput = document.getElementById('topicManagerSearchInput');
  if (tmSearchInput) {
    tmSearchInput.addEventListener('input', (e) => {
      state.filters.topicManagerSearch = e.target.value;
      renderTopicManagerList();
    });
  }

  // 7-1. 客群維度切換分頁 (個人客戶 / 企業客戶 / 準增員)
  const clientTypeFilterGroup = document.getElementById('clientTypeFilterGroup');
  if (clientTypeFilterGroup) {
    clientTypeFilterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.client-type-btn');
      if (btn) {
        const type = btn.getAttribute('data-type');
        if (type) {
          state.setClientType(type);
          document.querySelectorAll('#topicCategoryTabs .filter-tab').forEach(t => t.classList.remove('active'));
          renderMatrix();
          let toastMsg = '已切換至【個人客戶】名單與對應議題';
          if (type === 'CORPORATE') toastMsg = '已切換至【企業客戶】名單與對應議題';
          if (type === 'RECRUIT') toastMsg = '已切換至【準增員】組織發展名單與議題';
          showToast(toastMsg, 'info');
        }
      }
    });
  }

  // 8. 議題類別 Tab 篩選 (預設全部議題，支援點選篩選與再次點擊取消還原全部議題)
  const topicTabs = document.getElementById('topicCategoryTabs');
  if (topicTabs) {
    topicTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (tab) {
        const cat = tab.getAttribute('data-category');
        const isAlreadyActive = tab.classList.contains('active');
        topicTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));

        if (cat === 'ALL' || isAlreadyActive) {
          // 再次點擊已選中的標籤，取消篩選並還原至全部議題
          state.filters.topicCategory = 'ALL';
        } else {
          // 選取新分類
          tab.classList.add('active');
          state.filters.topicCategory = cat;
        }
        renderMatrix();
      }
    });
  }

  // 9. 名單定聯健康度溫層篩選
  const agingGroup = document.getElementById('agingFilterGroup');
  if (agingGroup) {
    let lastAllClickTime = 0;

    // 切換 Demo 去識別化模式處理函式
    const handleToggleDemoMasked = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isMasked = state.toggleDemoMasked();
      renderMatrix();
      if (isMasked) {
        showToast('🎭 已啟動【Demo 去識別化模式】（游Ｏ霖、陳Ｏ）', 'success');
      } else {
        showToast('👁️ 已關閉【Demo 去識別化模式】（恢復完整客戶姓名）', 'info');
      }
    };

    agingGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.aging-chip');
      if (chip) {
        const agingVal = chip.getAttribute('data-aging');

        // 偵測「全名單」按鈕在 420ms 內連續快點兩下 (相容觸控平板與滑鼠)
        if (agingVal === 'ALL') {
          const now = Date.now();
          if (now - lastAllClickTime > 0 && now - lastAllClickTime < 420) {
            lastAllClickTime = 0;
            handleToggleDemoMasked(e);
            return;
          }
          lastAllClickTime = now;
        } else {
          lastAllClickTime = 0;
        }

        agingGroup.querySelectorAll('.aging-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filters.aging = agingVal;
        renderMatrix();
      }
    });

    // 桌機原生雙擊事件 (dblclick) 雙重保險支援
    const btnFilterAll = document.getElementById('btnFilterAll');
    if (btnFilterAll) {
      btnFilterAll.addEventListener('dblclick', (e) => {
        handleToggleDemoMasked(e);
      });
    }
  }

  // 9-1. 推進狀況下拉選單篩選 (雙軸智能聚攏與聚光燈)
  const touchpointStatusFilterEl = document.getElementById('touchpointStatusFilter');
  if (touchpointStatusFilterEl) {
    touchpointStatusFilterEl.addEventListener('change', (e) => {
      state.filters.touchpointStatus = e.target.value;
      renderMatrix();
    });
  }

  // 10. 頂部按鈕：議題庫維護、備份、主題 (新增名單已改由交匯格之 + 名單 按鈕承接)
  document.getElementById('btnOpenNewContact')?.addEventListener('click', () => openContactModal(null));
  document.getElementById('btnOpenTopicManager')?.addEventListener('click', openTopicManagerDrawer);
  document.getElementById('btnQuickAddTopic')?.addEventListener('click', openTopicManagerDrawer);
  // 10-1. 頂部系統設定下拉選單 (合併「備份 / 匯出」與「深色模式」)
  const settingsDropdown = document.getElementById('systemSettingsDropdown');
  const btnToggleSettings = document.getElementById('btnToggleSettingsMenu');

  btnToggleSettings?.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown?.classList.toggle('open');
  });

  document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
    settingsDropdown?.classList.remove('open');
    state.setTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // 點擊頁面其他地方自動收合設定下拉選單
  document.addEventListener('click', (e) => {
    if (settingsDropdown && !settingsDropdown.contains(e.target)) {
      settingsDropdown.classList.remove('open');
    }
  });

  // 10-2. 工具清單地圖 Modal
  const toolsMapModal = document.getElementById('toolsMapModal');
  document.getElementById('btnOpenToolsModal')?.addEventListener('click', () => {
    if (typeof renderToolsMap === 'function') renderToolsMap();
    if (toolsMapModal) toolsMapModal.classList.add('open');
  });
  document.getElementById('closeToolsMapModalBtn')?.addEventListener('click', closeModals);
  document.getElementById('cancelToolsMapModalBtn')?.addEventListener('click', closeModals);

  // 10-3. 常用固定訊息庫 Modal 事件綁定
  document.getElementById('closeFixedMessagesModalBtn')?.addEventListener('click', closeFixedMessagesModal);
  document.getElementById('btnAddFixedMsgTop')?.addEventListener('click', () => openFixedMsgEditor());
  document.getElementById('btn-edit-fixed-msg')?.addEventListener('click', () => {
    if (typeof openFixedMsgEditor === 'function' && typeof currentFixedMsgId !== 'undefined') {
      openFixedMsgEditor(currentFixedMsgId);
    }
  });
  document.getElementById('btn-delete-fixed-msg')?.addEventListener('click', (e) => {
    if (typeof deleteFixedMsgItem === 'function' && typeof currentFixedMsgId !== 'undefined') {
      deleteFixedMsgItem(currentFixedMsgId, e);
    }
  });
  document.getElementById('fixed-msg-detail-text')?.addEventListener('click', copyCurrentFixedMsgText);
  document.getElementById('btn-cancel-fixed-msg')?.addEventListener('click', closeFixedMsgEditor);
  document.getElementById('btn-save-fixed-msg')?.addEventListener('click', saveFixedMsgItem);

  // 10-4. 文件列印庫 Modal 事件綁定
  document.getElementById('closeDocPrintsModalBtn')?.addEventListener('click', closeDocPrintsModal);
  document.getElementById('btnAddDocPrintTop')?.addEventListener('click', () => openDocPrintEditor());
  document.getElementById('btn-print-doc')?.addEventListener('click', () => {
    if (typeof openDocInNewWindow === 'function') openDocInNewWindow();
  });
  document.getElementById('btn-edit-doc-print')?.addEventListener('click', () => {
    if (typeof openDocPrintEditor === 'function' && typeof currentDocPrintId !== 'undefined') {
      openDocPrintEditor(currentDocPrintId);
    }
  });
  document.getElementById('btn-delete-doc-print')?.addEventListener('click', (e) => {
    if (typeof deleteDocPrintItem === 'function' && typeof currentDocPrintId !== 'undefined') {
      deleteDocPrintItem(currentDocPrintId, e);
    }
  });
  document.getElementById('btn-cancel-doc-print')?.addEventListener('click', closeDocPrintEditor);
  document.getElementById('btn-save-doc-print')?.addEventListener('click', saveDocPrintItem);

  // 11. 備份與匯出入 Modal
  const backupModal = document.getElementById('backupModal');
  document.getElementById('btnOpenBackupModal')?.addEventListener('click', () => {
    settingsDropdown?.classList.remove('open');
    if (backupModal) backupModal.classList.add('open');
  });
  document.getElementById('closeBackupModalBtn')?.addEventListener('click', closeModals);

  // 11-1. 雲端同步設定 Modal
  const syncModal = document.getElementById('syncModal');
  const syncTestResult = document.getElementById('syncTestResult');

  document.getElementById('btnOpenSyncModal')?.addEventListener('click', () => {
    settingsDropdown?.classList.remove('open');
    state.updateSyncUI();
    if (syncTestResult) syncTestResult.style.display = 'none';
    if (syncModal) syncModal.classList.add('open');
  });

  // 點擊大標題直接開啟雲端同步設定視窗 (快速檢驗同步狀態或手動重試)
  document.getElementById('appBrandTitle')?.addEventListener('click', () => {
    document.getElementById('btnOpenSyncModal')?.click();
  });

  document.getElementById('closeSyncModalBtn')?.addEventListener('click', closeModals);
  document.getElementById('cancelSyncModalBtn')?.addEventListener('click', closeModals);

  // 測試連線
  document.getElementById('btnTestSync')?.addEventListener('click', async () => {
    const url = document.getElementById('syncApiUrlInput').value.trim();
    if (!url) {
      alert('請先輸入 Apps Script Web App 網址');
      return;
    }
    const testBtn = document.getElementById('btnTestSync');
    testBtn.disabled = true;
    testBtn.textContent = '連線中...';

    try {
      const res = await state.testCloudConnection(url);
      if (syncTestResult) {
        syncTestResult.style.display = 'block';
        syncTestResult.className = 'success';
        syncTestResult.innerHTML = `🟢 <strong>連線成功！</strong><br>試算表：${res.spreadsheetName || '已連通'}<br><span style="font-size:0.75rem; color:var(--text-muted);">伺服器時間：${res.timestamp}</span>`;
      }
      showToast('Google Sheets 連線測試成功！');
    } catch (err) {
      if (syncTestResult) {
        syncTestResult.style.display = 'block';
        syncTestResult.className = 'error';
        syncTestResult.innerHTML = `🔴 <strong>連線失敗：</strong> ${err.message}<br><span style="font-size:0.75rem;">請確認已部署為「網頁應用程式」且存取權限為「任何人」。</span>`;
      }
      showToast('連線失敗，請檢查網址', 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '測試連線';
    }
  });

  // 儲存雲端同步設定
  document.getElementById('saveSyncSettingsBtn')?.addEventListener('click', () => {
    const enabled = document.getElementById('syncEnableToggle').checked;
    const apiUrl = document.getElementById('syncApiUrlInput').value.trim();

    state.saveSyncSettings({ enabled, apiUrl });
    closeModals();
    showToast('雲端同步設定已儲存！');
  });

  // 雙向智能同步 (先拉取最新 ➔ 自動合併 ➔ 推送上傳)
  document.getElementById('btnTwoWaySync')?.addEventListener('click', () => {
    state.twoWaySync(true);
  });

  // 立即推送到雲端
  document.getElementById('btnPushToCloud')?.addEventListener('click', () => {
    state.pushToCloud(true);
  });

  // 自雲端拉取
  document.getElementById('btnPullFromCloud')?.addEventListener('click', () => {
    state.pullFromCloud(true);
  });

  // 匯出 JSON
  document.getElementById('btnExportJSON')?.addEventListener('click', () => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      contacts: state.contacts,
      topics: state.topics,
      touchpoints: state.touchpoints
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `定聯與議題系統備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('備份檔案已成功下載！');
  });

  // 匯入 JSON
  const importFileInput = document.getElementById('importFileInput');
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported.contacts && imported.topics && imported.touchpoints) {
            state.contacts = imported.contacts;
            // 補齊舊備份之 MBTI / DISC 屬性
            state.contacts.forEach(c => {
              const def = DEFAULT_CONTACTS.find(d => d.id === c.id);
              if (def) {
                if (!c.mbti) c.mbti = def.mbti || '';
                if (!c.disc) c.disc = def.disc || '';
              } else {
                if (c.mbti === undefined) c.mbti = '';
                if (c.disc === undefined) c.disc = '';
              }
            });
            state.topics = imported.topics;
            state.touchpoints = imported.touchpoints;
            state.saveAll();
            renderMatrix();
            closeModals();
            showToast('備份資料已成功匯入還原！');
          } else {
            alert('檔案格式不相符，缺少必要的資料結構。');
          }
        } catch (err) {
          alert('JSON 解析失敗，請確認檔案內容正確。');
        }
      };
      reader.readAsText(file);
    });
  }

  // 重設為初始測試資料
  document.getElementById('btnResetToDefault')?.addEventListener('click', () => {
    if (confirm('確定要清除現有紀錄並重設為初始測試資料嗎？')) {
      state.resetToDefault();
      renderMatrix();
      closeModals();
      showToast('已重設為初始系統示範資料！');
    }
  });

  // 12. 客戶名單 Modal 提交
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('editContactId').value;
      const name = document.getElementById('contactNameInput').value.trim();
      const nickname = (document.getElementById('contactNicknameInput')?.value || '').trim();
      const category = document.getElementById('contactCategoryInput').value.trim();
      const phone = document.getElementById('contactPhoneInput').value.trim();
      const mbti = document.getElementById('contactMbtiInput').value.trim();
      const discPrimary = (document.getElementById('contactDiscPrimaryInput')?.value || '').trim();
      const discSecondary = (document.getElementById('contactDiscSecondaryInput')?.value || '').trim();

      // 組合 DISC 核心性格標籤 (主要 + 輔助)
      let disc = '';
      if (discPrimary && discSecondary && discSecondary !== discPrimary) {
        if (discPrimary === '變色龍' || discSecondary === '變色龍') {
          disc = `${discPrimary}/${discSecondary}`;
        } else {
          disc = `${discPrimary}${discSecondary}`; // 例如：SC, CD, DI
        }
      } else if (discPrimary) {
        disc = discPrimary; // 例如：S, 變色龍
      } else if (discSecondary) {
        disc = discSecondary;
      }

      const rawTags = document.getElementById('contactTagsInput').value;
      const tags = rawTags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const notes = document.getElementById('contactNotesInput').value.trim();

      const isFocused = document.getElementById('btnToggleFocus')?.getAttribute('data-checked') === 'true';
      const isControlled = document.getElementById('btnToggleControlled')?.getAttribute('data-checked') === 'true';
      const isVegetarian = document.getElementById('btnToggleVegetarian')?.getAttribute('data-checked') === 'true';
      const isInd = document.getElementById('btnToggleTypeIndividual')?.getAttribute('data-checked') === 'true';
      const isCorp = document.getElementById('btnToggleTypeCorporate')?.getAttribute('data-checked') === 'true';
      const isRec = document.getElementById('btnToggleTypeRecruit')?.getAttribute('data-checked') === 'true';

      let finalInd = isInd;
      let finalCorp = isCorp;
      let finalRec = isRec;
      // 防呆：若使用者三個都沒有勾選，預設至少勾選個人
      if (!finalInd && !finalCorp && !finalRec) {
        finalInd = true;
      }

      // 相容舊版單一字串 clientType
      let clientType = 'INDIVIDUAL';
      if (finalCorp && !finalInd) clientType = 'CORPORATE';
      else if (finalRec && !finalInd && !finalCorp) clientType = 'RECRUIT';
      else if (finalInd) clientType = 'INDIVIDUAL';
      else clientType = finalCorp ? 'CORPORATE' : 'INDIVIDUAL';

      state.saveContact({
        id,
        name,
        nickname,
        category,
        clientType,
        isIndividual: finalInd,
        isCorporate: finalCorp,
        isRecruit: finalRec,
        phone,
        mbti,
        disc,
        discPrimary,
        discSecondary,
        tags,
        notes,
        isFocused,
        isControlled,
        isVegetarian
      });

      // 同步儲存學生/準增員課表學期、空堂與暫存圖片
      const targetContactId = id || state.contacts.find(c => c.name === name)?.id;
      const schedSemester = document.getElementById('scheduleSemesterInput')?.value.trim() || '115學年度 第1學期';
      const schedFreeTime = document.getElementById('scheduleFreeTimeInput')?.value.trim() || '';
      const dropZone = document.getElementById('scheduleDropPasteZone');
      const pendingImg = dropZone ? dropZone.dataset.pendingImageData : null;

      if (targetContactId) {
        if (pendingImg) {
          state.saveStudentSchedule(targetContactId, {
            imageUrl: pendingImg,
            fileName: dropZone.dataset.pendingFileName || '課表截圖.jpg',
            fileSize: Number(dropZone.dataset.pendingFileSize) || 0,
            semester: schedSemester,
            freeTimeNotes: schedFreeTime
          });
          dropZone.removeAttribute('data-pending-image-data');
          dropZone.removeAttribute('data-pending-file-name');
          dropZone.removeAttribute('data-pending-file-size');
        } else if (schedSemester || schedFreeTime) {
          const curSched = state.getStudentSchedule(targetContactId);
          if (curSched || schedFreeTime) {
            state.saveStudentSchedule(targetContactId, {
              semester: schedSemester,
              freeTimeNotes: schedFreeTime
            }, false);
          }
        }
      }

      // 新舊名單維護之全域防呆保證：自動展開收折、對齊客群維度與解除遮蔽篩選，杜絕「名單被過濾隱藏」的假死盲點
      // 1. 自動展開今日已更新名單（防呆杜絕收折狀態下剛維護/新增的名單在橘線上方隱形）
      if (state.hideUpdatedContacts) {
        state.hideUpdatedContacts = false;
      }

      // 2. 若該客戶在當前維度不可見（例如維護時將個人改為企業），自動切換客群維度，確保剛編輯的名單在眼前
      const matchesCurrentDimension = (state.clientType === 'CORPORATE' && finalCorp) ||
                                      (state.clientType === 'RECRUIT' && finalRec) ||
                                      (state.clientType === 'INDIVIDUAL' && finalInd);
      if (!matchesCurrentDimension) {
        if (finalCorp && !finalInd) {
          state.setClientType('CORPORATE');
        } else if (finalRec && !finalInd && !finalCorp) {
          state.setClientType('RECRUIT');
        } else if (finalInd) {
          state.setClientType('INDIVIDUAL');
        }
      }

      if (!id) {
        // 3. 新增名單時：若當前處於溫層篩選 (如 FOCUS/AGING_30/RECENT_7)，新名單因無紀錄會被隱蔽，自動平滑回退至「全名單」
        if (state.filters.aging !== 'ALL') {
          state.filters.aging = 'ALL';
          document.querySelectorAll('.aging-chip').forEach(c => c.classList.remove('active'));
          document.getElementById('btnFilterAll')?.classList.add('active');
        }

        // 4. 新增名單時：若當前處於推進狀態篩選或單一議題/客戶聚攏，自動解除聚攏，確保新名單立即可見
        if (state.filters.touchpointStatus && state.filters.touchpointStatus !== 'ALL') {
          state.filters.touchpointStatus = 'ALL';
        }
        if (state.topicFocusFilter && state.topicFocusFilter.topicId) {
          state.topicFocusFilter = { topicId: null };
        }
        if (state.contactTopicFilter && state.contactTopicFilter.contactId) {
          state.contactTopicFilter = { contactId: null, mode: 'ALL' };
        }
      }

      initialContactFormData = null;
      closeModals();
      renderMatrix();
      showToast(id ? '客戶資料已更新！' : `新名單【${name}】已成功加入！`, 'success');

      // 新名單建立成功後，自動平滑滾動至該列並閃爍綠色光芒，提供強烈正向視覺反饋
      if (!id && targetContactId) {
        setTimeout(() => {
          const targetCell = document.querySelector(`th[data-contact-id="${targetContactId}"]`);
          const targetRow = targetCell ? targetCell.closest('tr') : null;
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.classList.add('new-contact-highlight');
            setTimeout(() => targetRow.classList.remove('new-contact-highlight'), 3000);
          }
        }, 120);
      }

      if (statusListModalState.returnAfterContactModalClose) {
        statusListModalState.returnAfterContactModalClose = false;
        openStatusListModal(null, true);
      }
    });
  }

  // 12-0-1. 客戶關注按鈕勾選切換
  const btnToggleFocusModal = document.getElementById('btnToggleFocus');
  if (btnToggleFocusModal) {
    btnToggleFocusModal.addEventListener('click', () => {
      const currentChecked = btnToggleFocusModal.getAttribute('data-checked') === 'true';
      const nextChecked = !currentChecked;
      btnToggleFocusModal.setAttribute('data-checked', nextChecked ? 'true' : 'false');
      const starIcon = btnToggleFocusModal.querySelector('.focus-toggle-icon');
      if (starIcon) starIcon.textContent = nextChecked ? '⭐' : '☆';
    });
  }

  // 12-0-2. 客戶列管按鈕勾選切換
  const btnToggleControlledModal = document.getElementById('btnToggleControlled');
  if (btnToggleControlledModal) {
    btnToggleControlledModal.addEventListener('click', () => {
      const currentChecked = btnToggleControlledModal.getAttribute('data-checked') === 'true';
      btnToggleControlledModal.setAttribute('data-checked', currentChecked ? 'false' : 'true');
    });
  }

  // 12-0. 客戶吃素按鈕勾選切換
  const btnToggleVeg = document.getElementById('btnToggleVegetarian');
  if (btnToggleVeg) {
    btnToggleVeg.addEventListener('click', () => {
      const currentChecked = btnToggleVeg.getAttribute('data-checked') === 'true';
      btnToggleVeg.setAttribute('data-checked', currentChecked ? 'false' : 'true');
    });
  }

  // 12-0-1. 客戶類型 3 選項勾選事件綁定
  ['btnToggleTypeIndividual', 'btnToggleTypeCorporate', 'btnToggleTypeRecruit'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        const isChecked = btn.getAttribute('data-checked') === 'true';
        btn.setAttribute('data-checked', isChecked ? 'false' : 'true');
      });
    }
  });

  // 取消按鈕 (－) 與右上角關閉按鈕 (×) 皆調用安全關閉防呆
  document.getElementById('closeContactModalBtn')?.addEventListener('click', safeCloseContactModal);
  document.getElementById('cancelContactModalBtn')?.addEventListener('click', safeCloseContactModal);

  // 12-1. 刪除客戶名單按鈕 (✕) - 包含強力防呆提示
  const btnDeleteContact = document.getElementById('btnDeleteCurrentContact');
  if (btnDeleteContact) {
    btnDeleteContact.addEventListener('click', () => {
      const idInput = document.getElementById('editContactId');
      const contactId = idInput ? idInput.value : null;
      if (!contactId) return;
      const contact = state.contacts.find(c => c.id === contactId);
      const name = contact ? contact.name : '此客戶';
      if (confirm(`【防呆確認】確定要永久刪除客戶【${name}】嗎？\n\n⚠️ 此操作將同時清除該客戶在所有議題下的定聯記錄，且無法復原！`)) {
        state.deleteContact(contactId);
        initialContactFormData = null;
        closeModals();
        renderMatrix();
        showToast(`已刪除客戶【${name}】`, 'warning');
      }
    });
  }

  // 12-2. 彈窗畫面外部 (Backdrop 遮罩) 點擊關閉，同時具備防呆提示
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        if (backdrop.id === 'contactModal') {
          safeCloseContactModal();
        } else {
          closeModals();
        }
      }
    });
  });

  // 12-3. MBTI 4維度二選一 (4x2 矩陣) 點選
  const mbtiDimGrid = document.getElementById('mbtiDimGrid');
  if (mbtiDimGrid) {
    mbtiDimGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.mbti-dim-btn');
      if (!btn) return;
      const dim = parseInt(btn.getAttribute('data-dim'), 10);
      const clickedVal = btn.getAttribute('data-val');

      // 取得當前 4 個維度值
      const currentMbti = (document.getElementById('contactMbtiInput')?.value || '').toUpperCase();
      let dims = [
        currentMbti.includes('E') ? 'E' : (currentMbti.includes('I') ? 'I' : ''),
        currentMbti.includes('S') ? 'S' : (currentMbti.includes('N') ? 'N' : ''),
        currentMbti.includes('T') ? 'T' : (currentMbti.includes('F') ? 'F' : ''),
        currentMbti.includes('J') ? 'J' : (currentMbti.includes('P') ? 'P' : '')
      ];

      // 若點擊已選中的維度按鈕，則反選取消該維度
      if (dims[dim] === clickedVal) {
        dims[dim] = '';
      } else {
        dims[dim] = clickedVal;
      }

      // 組合新 MBTI 字串
      const newMbti = dims.join('');
      updateMbtiChipUI(newMbti);
    });
  }

  // 清除 MBTI 按鈕
  document.getElementById('btnClearMbtiBtn')?.addEventListener('click', () => {
    updateMbtiChipUI('');
  });

  // 12-4. DISC 雙軌秒選晶片點選 (主要 + 輔助)
  const discPrimaryChips = document.getElementById('discPrimaryChips');
  if (discPrimaryChips) {
    discPrimaryChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.disc-chip');
      if (!chip) return;
      const val = chip.getAttribute('data-val') || '';
      const currentSecondary = document.getElementById('contactDiscSecondaryInput')?.value || '';
      updateDiscChipUI(val, currentSecondary);
    });
  }

  const discSecondaryChips = document.getElementById('discSecondaryChips');
  if (discSecondaryChips) {
    discSecondaryChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.disc-chip');
      if (!chip) return;
      const val = chip.getAttribute('data-val') || '';
      const currentPrimary = document.getElementById('contactDiscPrimaryInput')?.value || '';
      updateDiscChipUI(currentPrimary, val);
    });
  }

  // 13. 新增議題 Form
  const newTopicForm = document.getElementById('newTopicForm');
  if (newTopicForm) {
    newTopicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const category = document.getElementById('newTopicCategory').value;
      const title = document.getElementById('newTopicTitle').value.trim();
      const scriptTips = document.getElementById('newTopicTips').value.trim();

      state.addTopic({ category, title, scriptTips });
      newTopicForm.reset();
      renderTopicManagerList();
      renderMatrix();
      showToast('新議題已加入議題庫！');
    });
  }

  // 14. 議題維護清單與排序按鈕 (分類篩選 / 上移 / 下移 / 啟閉 / 刪除)
  const tmCatGroup = document.getElementById('tmCategoryFilterGroup');
  if (tmCatGroup) {
    tmCatGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.drawer-cat-chip');
      if (!chip) return;
      const cat = chip.getAttribute('data-cat');
      state.filters.topicManagerCategory = cat;
      renderTopicManagerList();
    });
  }

  const topicManagerList = document.getElementById('topicManagerList');
  if (topicManagerList) {
    topicManagerList.addEventListener('click', (e) => {
      // 點擊子議題個別維護按鈕
      const editBtn = e.target.closest('.btn-edit-topic');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        if (id) {
          openTopicEditModal(id);
        }
        return;
      }

      // 順序調整：上移一位
      const moveUpBtn = e.target.closest('.btn-move-up');
      if (moveUpBtn) {
        const id = moveUpBtn.getAttribute('data-id');
        if (state.moveTopic(id, 'up', state.filters.topicManagerCategory)) {
          renderTopicManagerList();
          renderMatrix();
          showToast('已上移子議題順序！');
        }
        return;
      }

      // 順序調整：下移一位
      const moveDownBtn = e.target.closest('.btn-move-down');
      if (moveDownBtn) {
        const id = moveDownBtn.getAttribute('data-id');
        if (state.moveTopic(id, 'down', state.filters.topicManagerCategory)) {
          renderTopicManagerList();
          renderMatrix();
          showToast('已下移子議題順序！');
        }
        return;
      }

      // 狀態切換：停用 / 啟用
      const toggleBtn = e.target.closest('.btn-toggle-topic');
      if (toggleBtn) {
        const id = toggleBtn.getAttribute('data-id');
        state.toggleTopicActive(id);
        renderTopicManagerList();
        renderMatrix();
        showToast('議題狀態已切換');
        return;
      }

      // 刪除子議題
      const deleteBtn = e.target.closest('.btn-delete-topic');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (confirm('確定要刪除此子議題嗎？相關的交匯紀錄也會一併清除。')) {
          const success = state.deleteTopic(id);
          if (success !== false) {
            renderTopicManagerList();
            renderMatrix();
            showToast('子議題已成功刪除');
          }
        }
      }
    });
  }

  // 15. 單一子議題專屬維護表單 (儲存變更 / 刪除)
  const topicEditForm = document.getElementById('topicEditForm');
  if (topicEditForm) {
    topicEditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const topicId = document.getElementById('editTopicId').value;
      const topic = state.topics.find(t => t.id === topicId);
      if (!topic) return;

      const newCategory = document.getElementById('editTopicCategory').value;
      const newTitle = document.getElementById('editTopicTitle').value.trim();
      const newOrder = parseInt(document.getElementById('editTopicOrder').value, 10) || 99;
      const newStatus = document.getElementById('editTopicStatus').value === 'ACTIVE';
      const newTips = document.getElementById('editTopicTips').value.trim();

      if (!newTitle) {
        alert('請輸入子議題名稱');
        return;
      }

      topic.category = newCategory;
      topic.title = newTitle;
      topic.isActive = newStatus;
      topic.scriptTips = newTips;

      // 智慧插入與排號：將當前議題從陣列抽出後，插入指定 newOrder 位置並全域重編序號
      state.topics = state.topics.filter(t => t.id !== topic.id);
      state.topics.sort((a, b) => (a.order || 99) - (b.order || 99));

      const targetIdx = Math.max(0, Math.min(newOrder - 1, state.topics.length));
      state.topics.splice(targetIdx, 0, topic);

      // 重新計算嚴格連號 1..N 的 order 數值
      state.topics.forEach((t, idx) => {
        t.order = idx + 1;
      });

      state.saveAll();

      renderMatrix();
      renderTopicManagerList();
      closeModals();
      showToast(`【${newTitle}】議題設定已成功更新！`);
    });
  }

  // 單一議題維護對話框內的刪除按鈕
  const btnDeleteCurrentTopic = document.getElementById('btnDeleteCurrentTopic');
  if (btnDeleteCurrentTopic) {
    btnDeleteCurrentTopic.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const topicId = document.getElementById('editTopicId').value;
      const topic = state.topics.find(t => t.id === topicId);
      if (!topic) return;

      const hasHistory = Object.values(state.touchpoints).some(tp => tp.topicId === topicId && tp.history && tp.history.length > 0);
      let confirmMsg = `確定要永久刪除子議題【${topic.title}】嗎？`;
      if (hasHistory) {
        confirmMsg = `警告：子議題【${topic.title}】已有客戶互動切入紀錄！刪除後相關矩陣交匯資料將同步隱藏，確定要刪除嗎？`;
      }

      if (confirm(confirmMsg)) {
        const success = state.deleteTopic(topicId);
        if (success !== false) {
          renderMatrix();
          renderTopicManagerList();
          closeModals();
          showToast(`已成功刪除子議題【${topic.title}】`, 'warning');
        }
      }
    });
  }

  // 關閉 topicEditModal
  document.getElementById('closeTopicEditModalBtn')?.addEventListener('click', closeModals);
  document.getElementById('cancelTopicEditModalBtn')?.addEventListener('click', closeModals);

  // 15. 議題戰略全地圖 Modal 相關事件 (關閉與設定下一個預計提出)
  document.getElementById('closeNextTopicModalBtn')?.addEventListener('click', closeModals);
  document.getElementById('cancelNextTopicModalBtn')?.addEventListener('click', closeModals);

  const nextTopicList = document.getElementById('nextTopicStrategyList');
  if (nextTopicList) {
    nextTopicList.addEventListener('click', (e) => {
      // 1. 處理大畫面看板點擊可推進議題卡片（一律立即建立預計提出紀錄，並雙向同步抽屜輸入框與矩陣）
      const pickBtn = e.target.closest('[data-action="pick-strategy-topic"]');
      if (pickBtn) {
        const targetContactId = pickBtn.getAttribute('data-contact-id');
        const targetTopicId = pickBtn.getAttribute('data-topic-id');
        if (targetContactId && targetTopicId) {
          setNextPlannedTopic(targetContactId, targetTopicId);
        }
        return;
      }

      // 2. 向下相容傳統按鈕
      const btn = e.target.closest('.btn-set-planned');
      if (btn) {
        const contactId = btn.getAttribute('data-contact-id');
        const topicId = btn.getAttribute('data-topic-id');
        if (contactId && topicId) {
          setNextPlannedTopic(contactId, topicId);
        }
      }
    });
  }

  // ===========================================================================
  // 16. 家庭車庫與車籍資料互動事件 (Family Fleet & Vehicle Insurance Events)
  // ===========================================================================
  
  // 16-1. 點擊「＋ 新增車輛」按鈕
  document.getElementById('btnAddNewVehicleToContact')?.addEventListener('click', () => {
    const contactId = document.getElementById('editContactId')?.value;
    if (!contactId) {
      showToast('請先儲存客戶基本資料後，再建立車輛資料', 'info');
      return;
    }
    openVehicleModal(contactId, null);
  });

  // 16-2. 車輛列表事件委派 (編輯、刪除、雙軌複製、行照燈箱)
  const vehicleList = document.getElementById('contactVehicleList');
  if (vehicleList) {
    vehicleList.addEventListener('click', (e) => {
      const contactId = document.getElementById('editContactId')?.value;

      // 0. 展開/收合詳細資料按鈕 (5大屬性折疊切換)
      const toggleDetailsBtn = e.target.closest('.btn-toggle-veh-details');
      if (toggleDetailsBtn) {
        e.stopPropagation();
        const vehId = toggleDetailsBtn.getAttribute('data-veh-id');
        const detailsPanel = document.getElementById(`veh-details-${vehId}`);
        if (detailsPanel) {
          const isHidden = detailsPanel.style.display === 'none' || detailsPanel.style.display === '';
          detailsPanel.style.display = isHidden ? 'block' : 'none';
          toggleDetailsBtn.innerHTML = isHidden ? '<span>▴ 收合詳細</span>' : '<span>▾ 展開詳細資料</span>';
          toggleDetailsBtn.classList.toggle('expanded', isHidden);
        }
        return;
      }

      // A. 單欄秒點即複製晶片 (Click-to-Copy Chip)
      const copyChip = e.target.closest('.copy-chip');
      if (copyChip) {
        e.stopPropagation();
        const copyVal = copyChip.getAttribute('data-copy-val');
        if (copyVal) {
          navigator.clipboard.writeText(copyVal).then(() => {
            copyChip.classList.add('copied');
            showToast(`已複製：${copyVal}`, 'success');
            setTimeout(() => copyChip.classList.remove('copied'), 1200);
          }).catch(err => {
            console.error('複製失敗:', err);
            showToast('複製失敗，請手動圈選', 'warning');
          });
        }
        return;
      }

      // B. 一鍵全單秒抄按鈕 (產險速抄)
      const copyQuoteBtn = e.target.closest('.btn-copy-vehicle-full-quote');
      if (copyQuoteBtn) {
        e.stopPropagation();
        const vehicleId = copyQuoteBtn.getAttribute('data-vehicle-id');
        const vehicle = state.getVehicle(vehicleId);
        if (vehicle) {
          const quoteText = state.formatVehicleQuoteText(vehicle);
          navigator.clipboard.writeText(quoteText).then(() => {
            showToast(`已複製【${vehicle.plateNumber}】全單車籍報價速抄！`, 'success');
          }).catch(err => {
            console.error('全單複製失敗:', err);
            showToast('複製失敗，請手動圈選', 'warning');
          });
        }
        return;
      }

      // B-2. 複製整份投保險種與保額明細 (客戶隨身速查神器)
      const copyCovBtn = e.target.closest('.btn-copy-coverage-breakdown');
      if (copyCovBtn) {
        e.stopPropagation();
        const vehicleId = copyCovBtn.getAttribute('data-vehicle-id');
        const vehicle = state.getVehicle(vehicleId);
        if (vehicle) {
          const covText = state.formatVehicleCoverageText(vehicle);
          navigator.clipboard.writeText(covText).then(() => {
            showToast(`已複製【${vehicle.plateNumber}】投保險種與保額明細！`, 'success');
          }).catch(err => {
            console.error('複製失敗:', err);
            showToast('複製失敗，請手動圈選', 'warning');
          });
        }
        return;
      }

      // B-3. 複製單筆險種與保額小按鈕 (.btn-copy-field-mini)
      const copyMiniBtn = e.target.closest('.btn-copy-field-mini');
      if (copyMiniBtn) {
        e.stopPropagation();
        const val = copyMiniBtn.getAttribute('data-copy-val');
        if (val) {
          navigator.clipboard.writeText(val).then(() => {
            copyMiniBtn.classList.add('copied');
            copyMiniBtn.textContent = '已複製';
            showToast(`已複製險種項目`, 'success');
            setTimeout(() => {
              copyMiniBtn.classList.remove('copied');
              copyMiniBtn.textContent = '複製';
            }, 1200);
          });
        }
        return;
      }

      // C. 點擊行照縮圖放大檢視 (Lightbox)
      const lightboxBtn = e.target.closest('.btn-view-license-lightbox');
      if (lightboxBtn) {
        e.stopPropagation();
        const imgSrc = lightboxBtn.getAttribute('data-img-src');
        const imgTitle = lightboxBtn.getAttribute('data-img-title') || '行照照片';
        if (imgSrc) {
          openLicenseLightbox(imgSrc, imgTitle);
        }
        return;
      }

      // D. 點擊編輯車籍按鈕
      const editBtn = e.target.closest('.btn-edit-vehicle');
      if (editBtn) {
        e.stopPropagation();
        const vehicleId = editBtn.getAttribute('data-vehicle-id');
        if (contactId && vehicleId) {
          openVehicleModal(contactId, vehicleId);
        }
        return;
      }

      // E. 點擊刪除車輛按鈕 (帶防呆)
      const delBtn = e.target.closest('.btn-delete-vehicle');
      if (delBtn) {
        e.stopPropagation();
        const vehicleId = delBtn.getAttribute('data-vehicle-id');
        const veh = state.getVehicle(vehicleId);
        const plate = veh ? veh.plateNumber : '此車輛';
        if (confirm(`【防呆確認】確定要刪除車輛【${plate}】嗎？\n\n此操作無法復原！`)) {
          state.deleteVehicle(vehicleId);
          renderContactGarage(contactId);
          showToast(`已刪除車輛【${plate}】`, 'warning');
        }
        return;
      }
    });
  }

  // 16-3. 車籍 Modal 表單提交 (新增 / 編輯車輛)
  const vehicleForm = document.getElementById('vehicleForm');
  if (vehicleForm) {
    vehicleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('editVehicleId')?.value;
      const contactId = document.getElementById('editVehicleContactId')?.value;
      if (!contactId) {
        showToast('無法關聯客戶，請重新開啟', 'warning');
        return;
      }

      const rawCoverages = document.getElementById('vehCoveragesInput')?.value.trim() || '';
      let parsedCoverages = [];
      if (rawCoverages) {
        const lines = rawCoverages.split('\n').map(l => l.trim()).filter(Boolean);
        parsedCoverages = lines.map(line => {
          const parts = line.split(/\s+/);
          return {
            code: parts[0] || '',
            name: parts[1] || '',
            insuredAmount: parts[2] || '',
            deductible: parts[3] || '無'
          };
        });
      }

      const vehicleData = {
        id: id || undefined,
        contactId,
        plateNumber: document.getElementById('vehPlateNumber')?.value.trim().toUpperCase() || '',
        vehicleType: document.getElementById('vehVehicleType')?.value || 'CAR',
        passengerCapacity: document.getElementById('vehPassengerCapacity')?.value || 5,
        ownerName: document.getElementById('vehOwnerName')?.value.trim() || '',
        ownerIdNumber: document.getElementById('vehOwnerIdNumber')?.value.trim().toUpperCase() || '',
        ownerBirthDate: document.getElementById('vehOwnerBirthDate')?.value || '',
        primaryDriver: document.getElementById('vehPrimaryDriver')?.value.trim() || '',
        primaryDriverRelation: document.getElementById('vehPrimaryDriverRelation')?.value || '本人',
        insuranceExpiryDate: document.getElementById('vehInsuranceExpiryDate')?.value || '',
        brand: document.getElementById('vehBrand')?.value.trim() || '',
        modelType: document.getElementById('vehModelType')?.value.trim() || '',
        displacement: document.getElementById('vehDisplacement')?.value.trim() || '',
        engineNumber: document.getElementById('vehEngineNumber')?.value.trim().toUpperCase() || '',
        vinNumber: document.getElementById('vehVinNumber')?.value.trim().toUpperCase() || '',
        manufactureDate: document.getElementById('vehManufactureDate')?.value.trim() || '',
        issueDate: document.getElementById('vehIssueDate')?.value.trim() || '',
        licenseImage: document.getElementById('vehLicenseImageInput')?.value.trim() || '',
        insuranceCompany: document.getElementById('vehInsuranceCompany')?.value.trim() || '',
        policyNumber: document.getElementById('vehPolicyNumber')?.value.trim() || '',
        premiumTotal: document.getElementById('vehPremiumTotal')?.value.trim() || '',
        coverages: parsedCoverages,
        notes: document.getElementById('vehNotesInput')?.value.trim() || ''
      };

      state.saveVehicle(vehicleData);
      document.getElementById('vehicleModal')?.classList.remove('open');
      renderContactGarage(contactId);
      showToast(id ? '車籍資料已更新！' : '新車輛已成功加入家庭車庫！');
    });
  }

  // 16-4. 車籍 Modal 內的單欄即點即複製小按鈕 (.btn-field-copy)
  document.querySelectorAll('#vehicleModal .btn-field-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target');
      const inputEl = document.getElementById(targetId);
      const val = inputEl ? inputEl.value.trim() : '';
      if (!val) {
        showToast('該欄位目前為空，無可複製內容', 'info');
        return;
      }
      navigator.clipboard.writeText(val).then(() => {
        btn.classList.add('copied');
        btn.textContent = '已複製';
        showToast(`已複製：${val}`, 'success');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = '複製';
        }, 1200);
      });
    });
  });

  // 16-5. 車籍 Modal 頂部全單秒抄按鈕
  document.getElementById('btnCopyVehicleModalFullQuote')?.addEventListener('click', () => {
    const tempVeh = {
      plateNumber: document.getElementById('vehPlateNumber')?.value.trim().toUpperCase() || '',
      vehicleType: document.getElementById('vehVehicleType')?.value || 'CAR',
      passengerCapacity: document.getElementById('vehPassengerCapacity')?.value || 5,
      ownerName: document.getElementById('vehOwnerName')?.value.trim() || '',
      ownerIdNumber: document.getElementById('vehOwnerIdNumber')?.value.trim().toUpperCase() || '',
      ownerBirthDate: document.getElementById('vehOwnerBirthDate')?.value || '',
      primaryDriver: document.getElementById('vehPrimaryDriver')?.value.trim() || '',
      primaryDriverRelation: document.getElementById('vehPrimaryDriverRelation')?.value || '本人',
      insuranceExpiryDate: document.getElementById('vehInsuranceExpiryDate')?.value || '',
      brand: document.getElementById('vehBrand')?.value.trim() || '',
      modelType: document.getElementById('vehModelType')?.value.trim() || '',
      displacement: document.getElementById('vehDisplacement')?.value.trim() || '',
      engineNumber: document.getElementById('vehEngineNumber')?.value.trim().toUpperCase() || '',
      vinNumber: document.getElementById('vehVinNumber')?.value.trim().toUpperCase() || '',
      manufactureDate: document.getElementById('vehManufactureDate')?.value.trim() || '',
      issueDate: document.getElementById('vehIssueDate')?.value.trim() || '',
      notes: document.getElementById('vehNotesInput')?.value.trim() || ''
    };
    const quoteText = state.formatVehicleQuoteText(tempVeh);
    navigator.clipboard.writeText(quoteText).then(() => {
      showToast('已複製全單產險報價速抄！', 'success');
    }).catch(err => {
      console.error('全單複製失敗:', err);
    });
  });

  // 16-6. 行照本機檔案上傳處理 (FileReader 轉 DataURL)
  document.getElementById('vehLicenseFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target.result;
        const imgInput = document.getElementById('vehLicenseImageInput');
        if (imgInput) imgInput.value = dataUrl;
        updateVehicleLicensePreview(dataUrl);
        showToast('行照照片已載入預覽', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // 16-7. 行照網址/路徑輸入即時連動預覽
  document.getElementById('vehLicenseImageInput')?.addEventListener('input', (e) => {
    updateVehicleLicensePreview(e.target.value.trim());
  });

  // 16-8. 點擊車籍 Modal 內的行照縮圖放大
  document.getElementById('vehLicensePreviewContainer')?.addEventListener('click', () => {
    const imgSrc = document.getElementById('vehLicensePreviewImg')?.getAttribute('src');
    if (imgSrc) {
      const plate = document.getElementById('vehPlateNumber')?.value || '';
      const owner = document.getElementById('vehOwnerName')?.value || '';
      openLicenseLightbox(imgSrc, `${owner} - ${plate} 行照原始圖`);
    } else {
      document.getElementById('vehLicenseFileInput')?.click();
    }
  });

  // 16-9. 車籍 Modal 關閉與刪除按鈕
  document.getElementById('closeVehicleModalBtn')?.addEventListener('click', () => {
    document.getElementById('vehicleModal')?.classList.remove('open');
  });
  document.getElementById('cancelVehicleModalBtn')?.addEventListener('click', () => {
    document.getElementById('vehicleModal')?.classList.remove('open');
  });

  document.getElementById('btnDeleteCurrentVehicle')?.addEventListener('click', () => {
    const vehicleId = document.getElementById('editVehicleId')?.value;
    const contactId = document.getElementById('editVehicleContactId')?.value;
    if (!vehicleId) return;
    const veh = state.getVehicle(vehicleId);
    const plate = veh ? veh.plateNumber : '此車輛';
    if (confirm(`【防呆確認】確定要刪除車輛【${plate}】嗎？`)) {
      state.deleteVehicle(vehicleId);
      document.getElementById('vehicleModal')?.classList.remove('open');
      renderContactGarage(contactId);
      showToast(`已刪除車輛【${plate}】`, 'warning');
    }
  });

  // 16-10. 行照燈箱關閉
  document.getElementById('closeLightboxBtn')?.addEventListener('click', closeLicenseLightbox);
  document.getElementById('licenseLightboxModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'licenseLightboxModal') {
      closeLicenseLightbox();
    }
  });

  // 17. 雲端同步中防誤觸重新整理／關閉視窗保護 (beforeunload)
  window.addEventListener('beforeunload', (e) => {
    if (state.isSyncing) {
      const warningMessage = '系統目前正在將最新資料背景同步至 Google Sheets，若現在重新整理或離開頁面，可能導致雲端試算表未及時寫入。確定要離開嗎？';
      e.preventDefault();
      e.returnValue = warningMessage;
      return warningMessage;
    }
  });

  // 18. 推進狀況篩選清單 Modal 事件與按鈕綁定 (Status List Modal Trigger)
  if (typeof initStatusListModalEvents === 'function') {
    initStatusListModalEvents();
  }

  // 頂部主操作列的「📊 推進清單」按鈕
  document.getElementById('btnOpenStatusListModal')?.addEventListener('click', () => {
    const filterSelect = document.getElementById('touchpointStatusFilter');
    const curVal = filterSelect ? filterSelect.value : 'all';
    openStatusListModal(curVal || 'all');
  });

  // 推進狀況下拉選單旁的「📋 清單」快速按鈕
  document.getElementById('btnQuickStatusList')?.addEventListener('click', () => {
    const filterSelect = document.getElementById('touchpointStatusFilter');
    const curVal = filterSelect ? filterSelect.value : 'all';
    openStatusListModal(curVal || 'all');
  });

  // 19. 成就感微步戰報彈窗 (Weekly Pulse Modal Events)
  const pulseHud = document.getElementById('pulseStatsHud');
  const btnTodayPulse = document.getElementById('btnOpenWeeklyPulseModal');
  const btnWeekPulse = document.querySelector('.pulse-hud-card.week-pulse');

  const triggerWeeklyPulse = (e) => {
    if (e) e.stopPropagation();
    if (typeof openWeeklyPulseModal === 'function') {
      openWeeklyPulseModal();
    }
  };

  pulseHud?.addEventListener('click', triggerWeeklyPulse);
  btnTodayPulse?.addEventListener('click', triggerWeeklyPulse);
  btnWeekPulse?.addEventListener('click', triggerWeeklyPulse);

  document.getElementById('closeWeeklyPulseModalBtn')?.addEventListener('click', () => {
    if (typeof closeWeeklyPulseModal === 'function') {
      closeWeeklyPulseModal();
    }
  });

  document.getElementById('btnCloseWeeklyPulseBtnBottom')?.addEventListener('click', () => {
    if (typeof closeWeeklyPulseModal === 'function') {
      closeWeeklyPulseModal();
    }
  });

  // 20. 工作日誌速記管理彈窗 (Work Log Modal Events)
  document.getElementById('btnOpenWorkLogModal')?.addEventListener('click', () => {
    if (typeof openWorkLogModal === 'function') {
      openWorkLogModal();
    }
  });

  document.getElementById('closeWorkLogModalBtn')?.addEventListener('click', () => {
    if (typeof closeWorkLogModal === 'function') {
      closeWorkLogModal();
    }
  });

  document.getElementById('workLogModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'workLogModal') {
      if (typeof closeWorkLogModal === 'function') {
        closeWorkLogModal();
      }
    }
  });

  document.getElementById('btnCreateNewWorkLog')?.addEventListener('click', () => {
    if (typeof resetWorkLogEditor === 'function') {
      resetWorkLogEditor();
    }
  });

  document.getElementById('btnResetWorkLogForm')?.addEventListener('click', () => {
    if (typeof resetWorkLogEditor === 'function') {
      resetWorkLogEditor();
    }
  });

  document.getElementById('btnSetWorkLogToday')?.addEventListener('click', () => {
    const dateInput = document.getElementById('workLogDate');
    if (dateInput && typeof getLocalTodayDateString === 'function') {
      dateInput.value = getLocalTodayDateString();
    }
  });

  document.getElementById('btnSaveWorkLog')?.addEventListener('click', () => {
    if (typeof saveWorkLogFromEditor === 'function') {
      saveWorkLogFromEditor();
    }
  });

  document.getElementById('btnDeleteCurrentWorkLog')?.addEventListener('click', () => {
    if (typeof deleteCurrentWorkLog === 'function') {
      deleteCurrentWorkLog();
    }
  });

  // 搜尋過濾事件
  document.getElementById('workLogSearchInput')?.addEventListener('input', (e) => {
    if (typeof renderWorkLogList === 'function') {
      renderWorkLogList(e.target.value);
    }
  });

  // 字數統計動態監聽
  document.getElementById('workLogContent')?.addEventListener('input', (e) => {
    const charCountEl = document.getElementById('workLogCharCount');
    if (charCountEl) {
      charCountEl.textContent = `${(e.target.value || '').length} 字`;
    }
  });

    // 快捷鍵支援：在工作日誌彈窗開啟時按 Cmd/Ctrl + S 快速儲存
  document.getElementById('workLogModal')?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (typeof saveWorkLogFromEditor === 'function') {
        saveWorkLogFromEditor();
      }
    }
  });

  // 17. 備忘提醒模組事件綁定
  initRemindersEvents();
}

// =============================================================================
// 🔔 備忘提醒模組事件監聽 (Reminders Module Events)
// =============================================================================
function initRemindersEvents() {
  // A. 新增該議題備忘提醒按鈕
  document.getElementById('btnSaveTopicReminder')?.addEventListener('click', () => {
    const active = state.activeCell;
    if (!active || !active.contactId || !active.topicId) {
      showToast('請先選擇客戶與議題', 'warning');
      return;
    }
    const contentInput = document.getElementById('newReminderContent');
    let content = contentInput ? contentInput.value.trim() : '';
    const dueTime = dueTimeInput ? dueTimeInput.value : '';

    // 若使用者已輸入時程，但未填寫備忘內容，自動帶入智慧預設，防呆杜絕阻斷操作
    if (!content && dueTime) {
      const contact = state.contacts.find(c => c.id === active.contactId);
      const topic = state.topics.find(t => t.id === active.topicId);
      const contactName = contact ? contact.name : '客戶';
      const topicTitle = topic ? topic.title : '此議題';
      content = `📌 與【${contactName}】推進【${topicTitle}】`;
    }

    if (!content && !dueTime) {
      showToast('請填寫要做的事情或設定提醒時程', 'warning');
      if (contentInput) contentInput.focus();
      return;
    }

    state.saveReminder({
      contactId: active.contactId,
      topicId: active.topicId,
      content,
      dueTime
    });

    if (contentInput) contentInput.value = '';
    if (dueTimeInput) dueTimeInput.value = '';

    renderTopicRemindersUI(active.contactId, active.topicId);
    showToast('已新增備忘提醒！');
  });

  // B. 抽屜左側備忘待辦卡片互動（事件委託：切換完成、刪除）
  document.getElementById('topicRemindersList')?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-reminder"]');
    if (toggleBtn) {
      e.stopPropagation();
      const id = toggleBtn.getAttribute('data-id');
      if (id) {
        state.toggleReminderStatus(id);
        const active = state.activeCell;
        if (active && active.contactId && active.topicId) {
          renderTopicRemindersUI(active.contactId, active.topicId);
        }
      }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete-reminder"]');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      if (id && confirm('確定要刪除這筆備忘提醒嗎？')) {
        state.deleteReminder(id);
        const active = state.activeCell;
        if (active && active.contactId && active.topicId) {
          renderTopicRemindersUI(active.contactId, active.topicId);
        }
        showToast('🗑️ 已刪除備忘提醒');
      }
      return;
    }
  });

  // C. 頂部 Header【🔔 備忘提醒】按鈕
  document.getElementById('btnOpenRemindersModal')?.addEventListener('click', () => {
    openRemindersModal();
  });

  // D. 全域備忘提醒 Modal 篩選切換
  document.getElementById('remindersModalFilterChips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.type-filter-chip');
    if (chip) {
      const filter = chip.getAttribute('data-filter') || 'ALL';
      setRemindersModalFilter(filter);
    }
  });

  // E. 全域備忘提醒搜尋過濾
  const remSearchInput = document.getElementById('remindersSearchInput');
  if (remSearchInput) {
    remSearchInput.addEventListener('input', (e) => {
      remindersModalSearch = e.target.value;
      renderRemindersModalList();
    });
  }

  document.getElementById('remindersSearchClearBtn')?.addEventListener('click', () => {
    if (remSearchInput) {
      remSearchInput.value = '';
      remindersModalSearch = '';
      renderRemindersModalList();
    }
  });

  // F. 全域備忘提醒表格互動（切換完成、刪除、點擊跳轉抽屜）
  document.getElementById('remindersTableContainer')?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-reminder"]');
    if (toggleBtn) {
      e.stopPropagation();
      const id = toggleBtn.getAttribute('data-id');
      if (id) {
        state.toggleReminderStatus(id);
        renderRemindersModalList();
        const active = state.activeCell;
        if (active && active.contactId && active.topicId) {
          renderTopicRemindersUI(active.contactId, active.topicId);
        }
      }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete-reminder"]');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      if (id && confirm('確定要刪除這筆備忘提醒嗎？')) {
        state.deleteReminder(id);
        renderRemindersModalList();
        const active = state.activeCell;
        if (active && active.contactId && active.topicId) {
          renderTopicRemindersUI(active.contactId, active.topicId);
        }
        showToast('🗑️ 已刪除備忘提醒');
      }
      return;
    }

    const openTopicBtn = e.target.closest('[data-action="open-topic-from-reminder"]');
    if (openTopicBtn) {
      e.stopPropagation();
      const contactId = openTopicBtn.getAttribute('data-contact-id');
      const topicId = openTopicBtn.getAttribute('data-topic-id');
      if (contactId && topicId) {
        closeRemindersModal();
        openQuickLogDrawer(contactId, topicId);
      }
      return;
    }
  });

  // 17. 學生/準增員課表作息互動事件
  initStudentScheduleEvents();
}

// =============================================================================
// 學生/準增員課表作息互動事件 (Student Schedule Event Listeners)
// =============================================================================

// 圖片高保真 Canvas 壓縮至 Base64 (防止 LocalStorage 爆掉，限制寬度在 1200px 內，保留最高可讀性)
function compressImageToDataURL(file, maxWidth = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('請提供圖片檔案 (PNG, JPG, WebP)'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          dataUrl,
          fileName: file.name || '課表截圖.jpg',
          sizeBytes: Math.round(dataUrl.length * 0.75),
          width: w,
          height: h
        });
      };
      img.onerror = () => reject(new Error('圖片解析失敗'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
}

function initStudentScheduleEvents() {
  const fileInput = document.getElementById('recruitScheduleFileInput');
  const btnUpload = document.getElementById('btnUploadScheduleModal');
  const btnClear = document.getElementById('btnClearScheduleModal');
  const dropZone = document.getElementById('scheduleDropPasteZone');
  const previewCard = document.getElementById('schedulePreviewCard');
  const quickChips = document.getElementById('quickFreeChips');

  // 1. 上傳按鈕觸發檔案選擇
  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => {
      fileInput.click();
    });
  }

  // 處理上傳/貼上的檔案核心邏輯
  const processScheduleImageFile = async (file) => {
    const contactId = document.getElementById('editContactId')?.value;
    if (!file) return;

    try {
      if (typeof showToast === 'function') showToast('正在最佳化並載入課表圖片...', 'info');
      const compressed = await compressImageToDataURL(file);
      
      const semester = document.getElementById('scheduleSemesterInput')?.value.trim() || '115學年度 第1學期';
      const freeNotes = document.getElementById('scheduleFreeTimeInput')?.value.trim() || '';

      if (contactId) {
        state.saveStudentSchedule(contactId, {
          imageUrl: compressed.dataUrl,
          fileName: compressed.fileName,
          fileSize: compressed.sizeBytes,
          semester,
          freeTimeNotes: freeNotes
        }, true);
        renderContactScheduleSection(contactId);
        renderMatrix();
        showToast(`🎉 已成功上傳【${compressed.fileName}】！今日微步足跡 +1 🚀`);
      } else {
        // 新增尚未建立 ID 的客戶時，在畫面上暫存預覽
        const previewContainer = document.getElementById('schedulePreviewContainer');
        const previewImg = document.getElementById('recruitSchedulePreviewImg') || document.getElementById('schedulePreviewImage');
        const emptyGuide = document.getElementById('scheduleEmptyGuide');
        const badge = document.getElementById('recruitScheduleStatusBadge');
        const metaTitle = document.getElementById('scheduleMetaTitle');
        const metaNotes = document.getElementById('scheduleMetaNotes');
        const metaUpdated = document.getElementById('scheduleMetaUpdated');
        if (previewImg) previewImg.src = compressed.dataUrl;
        if (metaTitle) metaTitle.textContent = `${semester || '115-1 (大三上)'} 課表`;
        if (metaNotes) metaNotes.textContent = freeNotes || '暫無空堂速記';
        if (metaUpdated) metaUpdated.textContent = `檔案：${compressed.fileName} · 最後更新：暫存中`;
        if (previewContainer) previewContainer.style.display = 'flex';
        if (emptyGuide) emptyGuide.style.display = 'none';
        if (badge) {
          badge.textContent = '暫存課表 (儲存客戶後生效)';
          badge.style.background = 'rgba(245, 158, 11, 0.12)';
          badge.style.color = '#f59e0b';
        }
        // 暫存於 DOM dataset
        if (dropZone) {
          dropZone.dataset.pendingImageData = compressed.dataUrl;
          dropZone.dataset.pendingFileName = compressed.fileName;
          dropZone.dataset.pendingFileSize = compressed.sizeBytes;
        }
        showToast('課表已暫存，請點擊「儲存客戶檔案」！');
      }
    } catch (err) {
      console.error('課表圖片處理失敗:', err);
      showToast(`上傳失敗: ${err.message}`, 'error');
    }
  };

  // 2. 檔案 input 變更
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processScheduleImageFile(file);
        fileInput.value = '';
      }
    });
  }

  // 3. 拖曳檔案進 Drop Zone
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      if (file && file.type.startsWith('image/')) {
        processScheduleImageFile(file);
      } else {
        showToast('請拖放圖片檔案 (JPG, PNG, WebP)', 'error');
      }
    });

    // 點擊 dropZone 亦可觸發選擇檔案
    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      if (fileInput) fileInput.click();
    });
  }

  // 4. 剪貼簿直接 Cmd+V 貼上課表截圖 (全域監聽 + Modal 防呆)
  document.addEventListener('paste', (e) => {
    const contactModal = document.getElementById('contactModal');
    const isContactModalOpen = contactModal && contactModal.classList.contains('open');
    if (!isContactModalOpen) return;

    // 若使用者正在一般文字輸入框輸入，不攔截純文字
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          processScheduleImageFile(blob);
          return;
        }
      }
    }
  });

  // 5. 空堂快速選取標籤點擊
  if (quickChips) {
    quickChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (!chip) return;
      const val = chip.getAttribute('data-val') || chip.textContent.trim();
      const freeTimeInput = document.getElementById('scheduleFreeTimeInput');
      if (freeTimeInput) {
        const cur = freeTimeInput.value.trim();
        if (cur) {
          if (!cur.includes(val)) {
            freeTimeInput.value = `${cur}、${val}`;
          }
        } else {
          freeTimeInput.value = val;
        }
        freeTimeInput.focus();
      }
    });
  }

  // 6. 清除課表
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const contactId = document.getElementById('editContactId')?.value;
      if (!contactId) return;
      if (confirm('確定要清除此客戶的課表作息資料嗎？')) {
        state.deleteStudentSchedule(contactId);
        renderContactScheduleSection(contactId);
        renderMatrix();
        showToast('已清除課表作息資料');
      }
    });
  }

  // 7. 點擊預覽圖縮圖開啟全螢幕 Lightbox
  const btnZoomPreview = document.getElementById('btnZoomSchedulePreview');
  if (btnZoomPreview) {
    btnZoomPreview.addEventListener('click', (e) => {
      e.stopPropagation();
      const contactId = document.getElementById('editContactId')?.value;
      if (contactId && typeof openScheduleLightbox === 'function') {
        openScheduleLightbox(contactId);
      }
    });
  }

  // 7-1. 替換圖片按鈕
  const btnReplaceImg = document.getElementById('btnReplaceScheduleImg');
  if (btnReplaceImg && fileInput) {
    btnReplaceImg.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  // 7-2. 下載原圖按鈕
  const btnDownloadImg = document.getElementById('btnDownloadScheduleImg');
  if (btnDownloadImg) {
    btnDownloadImg.addEventListener('click', (e) => {
      e.stopPropagation();
      const contactId = document.getElementById('editContactId')?.value;
      if (!contactId) return;
      const sched = state.getStudentSchedule(contactId);
      if (sched && sched.imageUrl) {
        const contact = state.contacts.find(c => c.id === contactId);
        const name = contact ? contact.name : '客戶';
        const a = document.createElement('a');
        a.href = sched.imageUrl;
        a.download = `${name}_課表_${sched.semester || '作息'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('課表圖片下載中...');
      }
    });
  }

  // 7-3. 學期與空堂輸入即時更新卡片標題與速記
  const semesterInputEl = document.getElementById('scheduleSemesterInput');
  if (semesterInputEl) {
    semesterInputEl.addEventListener('input', (e) => {
      const metaTitle = document.getElementById('scheduleMetaTitle');
      if (metaTitle) {
        metaTitle.textContent = `${e.target.value.trim() || '115-1'} 課表`;
      }
    });
  }

  const freeTimeInputEl = document.getElementById('scheduleFreeTimeInput');
  if (freeTimeInputEl) {
    freeTimeInputEl.addEventListener('input', (e) => {
      const metaNotes = document.getElementById('scheduleMetaNotes');
      if (metaNotes) {
        metaNotes.textContent = e.target.value.trim() || '暫無空堂速記';
      }
    });
  }

  if (previewCard) {
    previewCard.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const contactId = document.getElementById('editContactId')?.value;
      if (contactId && typeof openScheduleLightbox === 'function') {
        openScheduleLightbox(contactId);
      }
    });
  }

  // 8. 矩陣表格中「🎓 課表」徽章點擊事件 (事件委派)
  const matrixTable = document.getElementById('matrixTable');
  if (matrixTable) {
    matrixTable.addEventListener('click', (e) => {
      const badge = e.target.closest('[data-action="view-schedule"]');
      if (!badge) return;
      e.stopPropagation();
      e.preventDefault();
      const contactId = badge.getAttribute('data-contact-id');
      if (contactId && typeof openScheduleLightbox === 'function') {
        openScheduleLightbox(contactId);
      }
    });
  }

  // 9. 推進抽屜頂部快捷鈕「🎓 查看課表」
  const btnDrawerSchedule = document.getElementById('btnDrawerScheduleQuickBtn');
  if (btnDrawerSchedule) {
    btnDrawerSchedule.addEventListener('click', (e) => {
      e.stopPropagation();
      const contactId = btnDrawerSchedule.getAttribute('data-contact-id') || (state.activeCell && state.activeCell.contactId);
      if (contactId && typeof openScheduleLightbox === 'function') {
        openScheduleLightbox(contactId);
      }
    });
  }

  // 10. Lightbox 控制項綁定
  const btnCloseLightbox = document.getElementById('closeScheduleLightboxBtn');
  if (btnCloseLightbox) {
    btnCloseLightbox.addEventListener('click', closeScheduleLightbox);
  }

  const btnZoomIn = document.getElementById('btnZoomIn');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => zoomScheduleLightbox(0.25));
  }

  const btnZoomOut = document.getElementById('btnZoomOut');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => zoomScheduleLightbox(-0.25));
  }

  const btnResetZoom = document.getElementById('btnZoomReset');
  if (btnResetZoom) {
    btnResetZoom.addEventListener('click', resetScheduleLightboxZoom);
  }

  // 背景點擊關閉 Lightbox
  const lightboxModal = document.getElementById('scheduleLightboxModal');
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.classList.contains('lightbox-backdrop-close')) {
        closeScheduleLightbox();
      }
    });
  }

  // ESC 鍵關閉 Lightbox
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = document.getElementById('scheduleLightboxModal');
      if (lb && lb.classList.contains('open')) {
        closeScheduleLightbox();
      }
    }
  });
}



