/**
 * =============================================================================
 * 一鍵安全發布與版本更新流水線 (One-Click Safe Release Pipeline)
 * =============================================================================
 * 用途：告一個段落時，自動完成「全端體檢 -> 雙軌測試 -> 敏感檔案攔截 -> 版本號刷新 -> Git Commit & Push」
 * 執行方式：npm run release "本次修改重點摘要"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function logStep(step, message) {
  console.log(`\n${colors.bold}${colors.cyan}[步驟 ${step}] ${message}${colors.reset}`);
}

function runCommand(cmd, desc) {
  try {
    console.log(`  執行: ${cmd}`);
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`${colors.red}❌ 失敗：${desc}${colors.reset}`);
    process.exit(1);
  }
}

// 取得使用者傳入的 Commit 訊息
const commitMsg = process.argv.slice(2).join(' ').trim() || 'chore: 定聯系統例行版本安全更新與同步';

console.log(`${colors.bold}${colors.green}🚀 啟動定聯與議題系統自動化發布流水線...${colors.reset}`);

// -----------------------------------------------------------------------------
// 1. 全端語法靜態門禁
// -----------------------------------------------------------------------------
logStep('1/5', '執行全端 JavaScript 語法檢查...');
runCommand('node --check js/constants.js && node --check js/state.js && node --check js/renderer.js && node --check js/modals.js && node --check js/events.js', 'JavaScript 語法檢查失敗');

// -----------------------------------------------------------------------------
// 2. 雙軌回歸與 BDD 規格驗收
// -----------------------------------------------------------------------------
logStep('2/5', '執行雙軌測試 (231 項底層防呆 + BDD 活體規格)...');
runCommand('node test-suite.js && node bdd-runner.js', '測試驗收未通過，終止發布');

// -----------------------------------------------------------------------------
// 3. 資安守門員：檢測暫存區是否有敏感檔案
// -----------------------------------------------------------------------------
logStep('3/5', '資安門禁：檢查是否有敏感個資或金鑰...');
const statusOutput = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' });
const FORBIDDEN_PATTERNS = [
  /\.env/,
  /\.gsheet/,
  /語音逐字稿/,
  /licenses/,
  /KYC.*\.md/,
  /\.clasp\.json/
];

const lines = statusOutput.split('\n').filter(Boolean);
for (const line of lines) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(line)) {
      console.error(`${colors.bold}${colors.red}🚨 嚴重資安警報！偵測到敏感檔案企圖進入版本庫：${line}${colors.reset}`);
      console.error(`${colors.yellow}請檢查 .gitignore，已強制終止發布程序！${colors.reset}`);
      process.exit(1);
    }
  }
}
console.log(`  ${colors.green}✔ 資安檢查通過：0 個敏感檔案${colors.reset}`);

// -----------------------------------------------------------------------------
// 4. 自動刷新 index.html 快取版本標籤 (Cache Busting)
// -----------------------------------------------------------------------------
logStep('4/5', '刷新 index.html 版本號以避免瀏覽器舊快取...');
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const versionTag = `v${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

if (fs.existsSync(INDEX_HTML_PATH)) {
  let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  html = html.replace(/\?v=[a-zA-Z0-9_]+/g, `?v=${versionTag}`);
  fs.writeFileSync(INDEX_HTML_PATH, html, 'utf8');
  console.log(`  ${colors.green}✔ 快取版本已升級至：${versionTag}${colors.reset}`);
}

// -----------------------------------------------------------------------------
// 5. Git 提交與推送到遠端 GitHub (觸發 GitHub Pages 更新)
// -----------------------------------------------------------------------------
logStep('5/5', '執行 Git Commit 並推送到 GitHub...');
runCommand('git add .', 'Git add 失敗');

try {
  // 檢查是否有變更需要提交
  const hasDiff = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' }).trim().length > 0;
  if (hasDiff) {
    runCommand(`git commit -m "${commitMsg} (${versionTag})"`, 'Git commit 失敗');
  } else {
    console.log('  目前無任何檔案變更，跳過 Commit。');
  }

  // 嘗試推送到遠端 (若已設定 remote origin)
  const remotes = execSync('git remote', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  if (remotes.includes('origin')) {
    console.log('  正在推送至 GitHub 遠端 (main 分支)...');
    runCommand('git push -u origin main', 'Git push 失敗，請檢查網路連線或遠端權限');
    console.log(`\n${colors.bold}${colors.green}🎉 發布完成！GitHub Pages 將在約 30 秒後完成全球部署。${colors.reset}\n`);
  } else {
    console.log(`\n${colors.yellow}ℹ️ 本地 Commit 已完成！但尚未設定遠端 GitHub 倉庫 (git remote add origin ...)。${colors.reset}`);
    console.log(`${colors.yellow}建立 GitHub 倉庫後，只要執行：git remote add origin <您的Repo網址> 即可一鍵推送。${colors.reset}\n`);
  }
} catch (e) {
  console.error('發布過程發生異常:', e.message);
}
