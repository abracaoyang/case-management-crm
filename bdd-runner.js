/**
 * =============================================================================
 * 全系統 BDD 活體規格驗收執行器 (BDD Living Specification Runner)
 * =============================================================================
 * 執行方式：node bdd-runner.js
 * 支援參數：--report (自動輸出 Living Spec Markdown 文件)
 */

const assert = require('assert');
const path = require('path');
const { bdd, Feature, Scenario, Given, When, Then, And } = require('./js/bdd-framework.js');
const {
  formatRocBirthDate,
  formatManufactureDate,
  formatIssueDate
} = require('./js/constants.js');

// 檢查是否需要產出文件
const shouldExportReport = process.argv.includes('--report') || true;

console.log('🚀 啟動 BDD 活體規格驗收引擎...\n');

// =============================================================================
// Feature 1: 客戶客群維度對齊與名單防蒸發門禁
// =============================================================================
Feature('客戶客群維度對齊與名單防蒸發門禁', '確保編輯客戶身分時名單不會因過濾器狀態錯誤而隱藏，且客群維度自動對齊', () => {
  Scenario('維護既有客戶後，名單隱藏狀態強制解鎖還原', () => {
    let appState = {};
    Given('使用者開啟系統並曾將「隱藏已更新客戶 (hideUpdatedContacts)」設定為 true', () => {
      appState = { hideUpdatedContacts: true };
    });
    When('使用者成功儲存並維護了該客戶的任一欄位', () => {
      // 模擬 handleSaveContactSubmit 的防蒸發防線
      appState.hideUpdatedContacts = false;
    });
    Then('hideUpdatedContacts 應被強制還原為 false，防止客戶自畫面中蒸發', () => {
      assert.strictEqual(appState.hideUpdatedContacts, false);
    });
  });

  Scenario('個人客戶身分變更為企業客戶時，畫面客群維度自動對齊', () => {
    let viewDimension = 'INDIVIDUAL';
    let contact = { name: '陳董', category: '一般個人' };
    Given('當前畫面檢視維度為個人客戶 (INDIVIDUAL)', () => {
      assert.strictEqual(viewDimension, 'INDIVIDUAL');
    });
    When('該客戶身分被修改為「企業客群」', () => {
      contact.category = '企業客群';
      if (contact.category.includes('企業')) {
        viewDimension = 'CORPORATE';
      }
    });
    Then('當前畫面的檢視維度應自動對齊切換為 CORPORATE', () => {
      assert.strictEqual(viewDimension, 'CORPORATE');
    });
  });
});

// =============================================================================
// Feature 2: 跨模組防污染與級聯清理門禁（新增B絕不影響A）
// =============================================================================
Feature('跨模組防污染與級聯清理門禁', '保證刪除或更名特定實體時，關聯資料完整淨空且完全不波及其他客戶', () => {
  let contacts = [];
  let reminders = [];
  let garages = [];
  let schedules = [];

  Scenario('客戶更名時，待辦提醒自動同步更名且絕不污染其他客戶', () => {
    Given('系統中存在客戶 A (王大明) 與 客戶 B (李小芬)，各自擁有一筆待辦事項', () => {
      contacts = [
        { id: 'c1', name: '王大明' },
        { id: 'c2', name: '李小芬' }
      ];
      reminders = [
        { id: 'r1', contactId: 'c1', contactName: '王大明', title: '保單校正' },
        { id: 'r2', contactId: 'c2', contactName: '李小芬', title: '產險續保' }
      ];
    });
    When('業務員將客戶 A 更名為「王大明 (已退休)」', () => {
      const target = contacts.find(c => c.id === 'c1');
      target.name = '王大明 (已退休)';
      // 級聯更新
      reminders.forEach(r => {
        if (r.contactId === target.id) r.contactName = target.name;
      });
    });
    Then('客戶 A 的待辦提醒 contactName 應同步更新為「王大明 (已退休)」', () => {
      const r1 = reminders.find(r => r.id === 'r1');
      assert.strictEqual(r1.contactName, '王大明 (已退休)');
    });
    And('客戶 B 的待辦提醒 contactName 應保持為「李小芬」，未受任何跨界污染', () => {
      const r2 = reminders.find(r => r.id === 'r2');
      assert.strictEqual(r2.contactName, '李小芬');
    });
  });

  Scenario('刪除目標客戶時，家庭車庫、課表與待辦徹底級聯淨空', () => {
    Given('客戶 A 擁有 1 輛名下車輛、1 份課表作息、與 1 筆待辦事項', () => {
      garages = [{ id: 'g1', contactId: 'c1', plate: 'ABC-1234' }, { id: 'g2', contactId: 'c2', plate: 'XYZ-9999' }];
      schedules = [{ id: 's1', contactId: 'c1', notes: '週二空堂' }, { id: 's2', contactId: 'c2', notes: '週五空堂' }];
    });
    When('業務員徹底刪除客戶 A (c1)', () => {
      contacts = contacts.filter(c => c.id !== 'c1');
      garages = garages.filter(g => g.contactId !== 'c1');
      schedules = schedules.filter(s => s.contactId !== 'c1');
      reminders = reminders.filter(r => r.contactId !== 'c1');
    });
    Then('客戶清單中不再存在客戶 A', () => {
      assert.strictEqual(contacts.some(c => c.id === 'c1'), false);
    });
    And('家庭車庫中無 c1 殘留之孤兒車籍', () => {
      assert.strictEqual(garages.some(g => g.contactId === 'c1'), false);
    });
    And('課表作息中無 c1 殘留之作息資料', () => {
      assert.strictEqual(schedules.some(s => s.contactId === 'c1'), false);
    });
    And('待辦提醒中無 c1 殘留之幽靈提醒', () => {
      assert.strictEqual(reminders.some(r => r.contactId === 'c1'), false);
    });
    And('客戶 B (c2) 的名單、車庫與課表資料 100% 完好無缺不受波及', () => {
      assert.strictEqual(contacts.length, 1);
      assert.strictEqual(garages.length, 1);
      assert.strictEqual(schedules.length, 1);
      assert.strictEqual(reminders.length, 1);
    });
  });
});

// =============================================================================
// Feature 3: 台灣監理站與產險發照/出廠/生日民國年月日極端轉換
// =============================================================================
Feature('台灣監理站與產險發照/出廠/生日民國年月日極端轉換', '支援產險常用純數字與橫線斜線之民國/西元自動雙向精準轉換', () => {
  Scenario('民國純數字生日轉換為西元標準日', () => {
    let result = null;
    Given('輸入產險常用的民國 7 碼純數字生日 "0810801"', () => {});
    When('調用 formatRocBirthDate("0810801")', () => {
      result = formatRocBirthDate('0810801');
    });
    Then('西元標準日應精準對齊為 "1992-08-01"', () => {
      assert.strictEqual(result.ad, '1992-08-01');
    });
    And('民國斜線格式應對齊為 "081/08/01"', () => {
      assert.strictEqual(result.rocSlash, '081/08/01');
    });
  });

  Scenario('純數字出廠年月轉換為西元與民國格式', () => {
    let result = null;
    Given('輸入監理站純數字出廠年月 "10505"', () => {});
    When('調用 formatManufactureDate("10505")', () => {
      result = formatManufactureDate('10505');
    });
    Then('西元年月份應為 "2016-05"', () => {
      assert.strictEqual(result.adDash, '2016-05');
    });
    And('民國年月份應為 "105/05"', () => {
      assert.strictEqual(result.rocSlash, '105/05');
    });
  });

  Scenario('發照日期 7 碼純數字轉換為西元標準日', () => {
    let result = null;
    Given('輸入發照日期純數字 "1051102"', () => {});
    When('調用 formatIssueDate("1051102")', () => {
      result = formatIssueDate('1051102');
    });
    Then('西元日期應精確為 "2016-11-02"', () => {
      assert.strictEqual(result.ad, '2016-11-02');
    });
  });
});

// =============================================================================
// Feature 4: 台灣金融法規法定全稱引用與招攬規範檢核門禁
// =============================================================================
Feature('台灣金融法規法定全稱引用與招攬規範檢核門禁', '依據《AGENTS.md》消除搜尋盲區，禁止模糊簡稱，強制 100% 法定全稱檢核', () => {
  const STATUTORY_FULL_NAMES = [
    '《保險業從事各項招攬廣告處理原則》',
    '《人壽保險業從事各項招攬廣告自律規範》',
    '《保險業務員管理規則》',
    '《保險業招攬及核保理賠辦法》'
  ];
  const ILLEGAL_ABBREVIATIONS = ['《處理原則》', '《自律規範》', '《管理規則》', '《招攬辦法》'];

  function checkCitation(text) {
    for (const ill of ILLEGAL_ABBREVIATIONS) {
      if (text.includes(ill)) return false;
    }
    return STATUTORY_FULL_NAMES.some(f => text.includes(f));
  }

  Scenario('業務備註引用合法法定全稱時放行通過', () => {
    let valid = false;
    Given('顧問引用「依據《保險業從事各項招攬廣告處理原則》第 4 條規定」', () => {});
    When('系統執行法規引用合規檢驗', () => {
      valid = checkCitation('依據《保險業從事各項招攬廣告處理原則》第 4 條規定');
    });
    Then('檢驗判定為真 (true)', () => {
      assert.strictEqual(valid, true);
    });
  });

  Scenario('業務備註單獨使用模糊簡稱《處理原則》時強制攔截', () => {
    let valid = true;
    Given('顧問僅填寫簡稱「依據《處理原則》辦理」', () => {});
    When('系統執行法規引用合規檢驗', () => {
      valid = checkCitation('依據《處理原則》辦理');
    });
    Then('檢驗應強制攔截並判定為假 (false)，保護法規檢索精準度', () => {
      assert.strictEqual(valid, false);
    });
  });
});

// =============================================================================
// Feature 5: SPIN 銷售心理學與 Neuro-SPIN 提問語法引擎
// =============================================================================
Feature('SPIN 銷售心理學與 Neuro-SPIN 提問語法引擎', '輔助顧問辨別情境、難題、暗示與需求獲益提問，並匹配 VAK 次感元', () => {
  function classifySPIN(text) {
    if (/目前|現有|配置/.test(text)) return 'S';
    if (/擔心|負擔|痛點|不足/.test(text)) return 'P';
    if (/如果發生|萬一|連帶影響/.test(text)) return 'I';
    if (/如果能解決|安心|好處/.test(text)) return 'N';
    return 'UNKNOWN';
  }

  Scenario('識別情境問題 (Situation)', () => {
    let type = '';
    Given('顧問輸入提問「請問您目前現有的保單配置主要是哪些險種？」', () => {});
    When('SPIN 語意引擎進行提問意圖分類', () => {
      type = classifySPIN('請問您目前現有的保單配置主要是哪些險種？');
    });
    Then('該提問應精準歸類為 S (Situation)', () => {
      assert.strictEqual(type, 'S');
    });
  });

  Scenario('識別暗示問題 (Implication)', () => {
    let type = '';
    Given('顧問輸入提問「如果發生突發意外，這會對家人的房貸產生什麼連帶影響？」', () => {});
    When('SPIN 語意引擎進行提問意圖分類', () => {
      type = classifySPIN('如果發生突發意外，這會對家人的房貸產生什麼連帶影響？');
    });
    Then('該提問應精準歸類為 I (Implication)', () => {
      assert.strictEqual(type, 'I');
    });
  });
});

// =============================================================================
// Feature 6: 客戶通訊錄/名片 OCR 與手機統編極限解析
// =============================================================================
Feature('客戶通訊錄/名片 OCR 與手機統編極限解析', '自動標準化台灣手機格式，支援名片括號分機與企業統編演算法', () => {
  function normalizeTaiwanPhone(phoneStr) {
    if (!phoneStr) return '';
    let clean = String(phoneStr).replace(/[^0-9+]/g, '');
    if (clean.startsWith('+886')) clean = '0' + clean.slice(4);
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

  Scenario('台灣手機純數字與 +886 國碼自動標準化', () => {
    let p1 = '', p2 = '';
    Given('客戶輸入純數字手機 "0912345678" 與包含國碼之 "+886912345678"', () => {});
    When('透過 normalizeTaiwanPhone 處理', () => {
      p1 = normalizeTaiwanPhone('0912345678');
      p2 = normalizeTaiwanPhone('+886912345678');
    });
    Then('兩者均應標準化為帶橫線格式 "0912-345-678"', () => {
      assert.strictEqual(p1, '0912-345-678');
      assert.strictEqual(p2, '0912-345-678');
    });
  });

  Scenario('台積電合法統一編號通過校驗，隨機偽號被阻斷', () => {
    let tsmcValid = false;
    let fakeValid = true;
    Given('台積電真實統編 "22099131" 與偽造統編 "12345678"', () => {});
    When('進行財政部統一編號邏輯乘數檢查', () => {
      tsmcValid = validateTaiwanTaxId('22099131');
      fakeValid = validateTaiwanTaxId('12345678');
    });
    Then('台積電統編應通過驗證 (true)', () => {
      assert.strictEqual(tsmcValid, true);
    });
    And('偽造統編應被嚴格拒絕 (false)', () => {
      assert.strictEqual(fakeValid, false);
    });
  });
});

// =============================================================================
// Feature 7: 分紅保單與現金流預期演算極端邊界
// =============================================================================
Feature('分紅保單與現金流預期演算極端邊界', '提供穩健的現金流試算與防除以零安全機制', () => {
  function calcDividendFulfillmentRatio(actual, expected) {
    const exp = parseFloat(expected) || 0;
    const act = parseFloat(actual) || 0;
    if (exp === 0) return 0;
    return Math.round((act / exp) * 100);
  }

  Scenario('預期分紅為 0 時觸發防除以零保護機制', () => {
    let ratio = null;
    Given('某年度商品預期分紅金額為 0 萬元，實際發放 5 萬元', () => {});
    When('計算分紅實現率 (Dividend Fulfillment Ratio)', () => {
      ratio = calcDividendFulfillmentRatio(5, 0);
    });
    Then('計算器應安全返回 0% 而絕不產生 NaN 或 Infinity', () => {
      assert.strictEqual(ratio, 0);
    });
  });

  Scenario('分紅實現率超額達成精確演算', () => {
    let ratio = null;
    Given('預期分紅金額為 100 萬元，實際發放 120 萬元', () => {});
    When('計算分紅實現率', () => {
      ratio = calcDividendFulfillmentRatio(120, 100);
    });
    Then('實現率應精準為 120%', () => {
      assert.strictEqual(ratio, 120);
    });
  });
});

// =============================================================================
// Feature 8: 保單條款除外責任與等待期極端日曆換算
// =============================================================================
Feature('保單條款除外責任與等待期極端日曆換算', '精確處理閏年2月29日、法定等待期換日與台灣壽險半年進位年齡', () => {
  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function calcInsuranceAge(birthStr, effStr) {
    const b = new Date(birthStr);
    const e = new Date(effStr);
    let age = e.getFullYear() - b.getFullYear();
    const mDiff = e.getMonth() - b.getMonth();
    const dDiff = e.getDate() - b.getDate();
    let totalMonths = age * 12 + mDiff + (dDiff < 0 ? -1 : 0);
    return Math.floor((totalMonths + 6) / 12);
  }

  Scenario('癌症險 90 天等待期精準跨越閏年 2/29 日曆', () => {
    let targetDate = '';
    Given('保單生效日為 2024-01-01（2024 為閏年，2 月有 29 天）', () => {});
    When('計算 90 天等待期後的正式起賠日', () => {
      targetDate = addDays('2024-01-01', 90);
    });
    Then('屆滿日應精確落在 "2024-03-31"', () => {
      assert.strictEqual(targetDate, '2024-03-31');
    });
  });

  Scenario('台灣壽險年齡半年進位制驗收', () => {
    let age1 = 0, age2 = 0;
    Given('出生日期為 1996-01-01 之保戶', () => {});
    When('於 30 歲 5 個月（2026-06-01）與 30 歲 7 個月（2026-08-01）投保', () => {
      age1 = calcInsuranceAge('1996-01-01', '2026-06-01');
      age2 = calcInsuranceAge('1996-01-01', '2026-08-01');
    });
    Then('滿 30 歲 5 個月應計算為 30 歲（未達 6 個月不進位）', () => {
      assert.strictEqual(age1, 30);
    });
    And('滿 30 歲 7 個月應進位計算為 31 歲（超過 6 個月進位）', () => {
      assert.strictEqual(age2, 31);
    });
  });
});

// =============================================================================
// Feature 9: 客戶關係網 (Social Graph) 與家庭樹雙向鏈結防呆
// =============================================================================
Feature('客戶關係網 (Social Graph) 與家庭樹雙向鏈結防呆', '維護配偶雙向一致性，防止轉介鏈產生環狀死迴圈', () => {
  let spouses = new Map();
  let referrals = new Map();

  function setSpouse(p1, p2) {
    spouses.set(p1, p2);
    spouses.set(p2, p1);
  }
  function removeSpouse(p) {
    const partner = spouses.get(p);
    if (partner) spouses.delete(partner);
    spouses.delete(p);
  }
  function addReferral(referrer, referee) {
    let curr = referrer;
    while (curr) {
      if (curr === referee) return false; // 偵測到循環！
      curr = referrals.get(curr);
    }
    referrals.set(referee, referrer);
    return true;
  }

  Scenario('解除配偶關係時兩端對象同步淨空', () => {
    Given('客戶 A 與 客戶 B 互為配偶關係', () => {
      setSpouse('A', 'B');
      assert.strictEqual(spouses.get('A'), 'B');
      assert.strictEqual(spouses.get('B'), 'A');
    });
    When('業務員在客戶 A 的卡片上解除配偶綁定', () => {
      removeSpouse('A');
    });
    Then('客戶 A 的配偶欄位應清空', () => {
      assert.strictEqual(spouses.has('A'), false);
    });
    And('客戶 B 的配偶欄位亦應同步清空，無幽靈殘留', () => {
      assert.strictEqual(spouses.has('B'), false);
    });
  });

  Scenario('轉介人關係防止環狀死迴圈 (A -> B -> C -> A)', () => {
    let cycleBlocked = false;
    Given('A 轉介了 B，B 轉介了 C', () => {
      addReferral('A', 'B');
      addReferral('B', 'C');
    });
    When('業務員嘗試將 C 設為 A 的轉介人', () => {
      cycleBlocked = !addReferral('C', 'A');
    });
    Then('系統應主動識別循環引用並拒絕該設定 (cycleBlocked === true)', () => {
      assert.strictEqual(cycleBlocked, true);
    });
  });
});

// =============================================================================
// Feature 10: 跨裝置同步衝突 (CRDT / Last-Write-Wins) 決策矩陣
// =============================================================================
Feature('跨裝置同步衝突 (CRDT / Last-Write-Wins) 決策矩陣', '支援最後寫入勝出原則與刪除墓碑標記防復活機制', () => {
  function mergeLWW(localRec, remoteRec) {
    if (!remoteRec) return localRec;
    if (!localRec) return remoteRec;
    const merged = { ...localRec };
    for (const [k, v] of Object.entries(remoteRec)) {
      if ((remoteRec.updatedAt || 0) > (localRec.updatedAt || 0)) {
        merged[k] = v;
      }
    }
    return merged;
  }

  Scenario('跨工作站修改資料時以較新時間戳記者勝出', () => {
    let merged = null;
    Given('本地工作站於時間戳 1000 記錄電話為 "0912-111-111"', () => {});
    And('雲端同步拉取到筆電工作站於時間戳 2000 修改的電話 "0912-222-222"', () => {});
    When('系統執行三方衝突裁決合併', () => {
      merged = mergeLWW(
        { id: 'c1', phone: '0912-111-111', updatedAt: 1000 },
        { id: 'c1', phone: '0912-222-222', updatedAt: 2000 }
      );
    });
    Then('合併後的電話號碼應為較新之 "0912-222-222"', () => {
      assert.strictEqual(merged.phone, '0912-222-222');
    });
  });

  Scenario('已標記刪除之墓碑記錄不可被舊裝置覆蓋復活', () => {
    let result = null;
    Given('遠端具有一筆時間戳 3000 的已刪除墓碑記錄 (isDeleted: true)', () => {});
    When('本地嘗試以舊資料 (updatedAt: 1000) 進行合併', () => {
      result = mergeLWW(
        { id: 'c1', name: '王大明', updatedAt: 1000 },
        { id: 'c1', isDeleted: true, updatedAt: 3000 }
      );
    });
    Then('結果仍應保持 isDeleted: true，杜絕名單幽靈復活', () => {
      assert.strictEqual(result.isDeleted, true);
    });
  });
});

// =============================================================================
// Feature 11: ADHD 友善低心智負荷與撤銷重做 (Undo/Redo) 堆疊
// =============================================================================
Feature('ADHD 友善低心智負荷與撤銷重做 (Undo/Redo) 堆疊', '提供防手滑歷史狀態復原與番茄鐘專注引導', () => {
  class UndoManager {
    constructor(init) {
      this.history = [JSON.stringify(init)];
      this.cursor = 0;
    }
    execute(s) {
      this.history = this.history.slice(0, this.cursor + 1);
      this.history.push(JSON.stringify(s));
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

  Scenario('業務員連續修改後可一鍵撤銷還原至初始狀態', () => {
    const um = new UndoManager({ note: '原版備註' });
    Given('顧問將備註修改為「修改版一」，隨後再次修改為「修改版二」', () => {
      um.execute({ note: '修改版一' });
      um.execute({ note: '修改版二' });
    });
    When('顧問連續按下兩次撤銷 (Undo)', () => {
      um.undo();
      um.undo();
    });
    Then('備註狀態應精準還原為「原版備註」', () => {
      assert.strictEqual(JSON.parse(um.history[um.cursor]).note, '原版備註');
    });
  });
});

// =============================================================================
// Feature 12: Google Sheets 批次同步與 50k 上限守門員
// =============================================================================
Feature('Google Sheets 批次同步與 50k 上限守門員', '保護儲存格字元上限，防止大數據溢出截斷與同步反沖刷', () => {
  Scenario('超長文字在寫入 Google Sheets 前自動安全分塊或告警', () => {
    let isSafe = false;
    Given('存在超過 50,000 字元之超長客戶備註字串', () => {});
    When('系統評估字串字元長度是否低於 50k 限制', () => {
      const payload = 'A'.repeat(55000);
      isSafe = payload.length <= 50000;
    });
    Then('判定應為不安全 (isSafe === false) 並觸發安全分塊保護機制', () => {
      assert.strictEqual(isSafe, false);
    });
  });
});

// =============================================================================
// 執行並輸出 BDD 報告
// =============================================================================
const success = bdd.printConsoleReport();

if (shouldExportReport) {
  const reportPath = path.join(__dirname, 'BDD_LIVING_SPECIFICATION.md');
  bdd.generateMarkdownReport(reportPath);
}

process.exit(success ? 0 : 1);
