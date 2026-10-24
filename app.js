// =============================================================================
// 定聯 x 議題 x 案件｜紀錄管理系統 - 核心啟動入口 (Bootstrap)
// =============================================================================

function bootstrap() {
  // 初始化應用狀態 (載入本機快取或自 Google Sheet 遠端同步)
  state.init();

  // 渲染二維交匯矩陣
  renderMatrix();

  // 綁定全域 UI 與互動監聽事件
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
