/**
 * =============================================================================
 * 極輕量零依賴 BDD 規格驅動開發測試引擎 (Lightweight BDD Specification Engine)
 * =============================================================================
 * 遵循標準 Gherkin 語意：Feature -> Scenario -> Given -> When -> Then -> And
 * 支援終端彩色階層化輸出，並可自動產出 Markdown 與 HTML 活體規格文件 (Living Spec Doc)
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

class BDDContext {
  constructor() {
    this.features = [];
    this.currentFeature = null;
    this.currentScenario = null;
    this.stats = {
      features: 0,
      scenarios: 0,
      steps: 0,
      passedSteps: 0,
      failedSteps: 0,
      startTime: Date.now()
    };
  }

  feature(title, description, fn) {
    const f = {
      title,
      description: typeof description === 'string' ? description : '',
      scenarios: [],
      passed: true
    };
    this.features.push(f);
    this.currentFeature = f;
    this.stats.features++;

    const runFn = typeof description === 'function' ? description : fn;
    if (runFn) runFn();
    this.currentFeature = null;
  }

  scenario(title, fn) {
    if (!this.currentFeature) {
      throw new Error(`Scenario "${title}" must be declared inside a Feature`);
    }
    const s = {
      title,
      steps: [],
      passed: true,
      error: null
    };
    this.currentFeature.scenarios.push(s);
    this.currentScenario = s;
    this.stats.scenarios++;

    if (fn) {
      try {
        fn();
      } catch (err) {
        s.passed = false;
        s.error = err;
        this.currentFeature.passed = false;
      }
    }
    this.currentScenario = null;
  }

  _step(type, description, fn) {
    if (!this.currentScenario) {
      throw new Error(`Step "${type} ${description}" must be declared inside a Scenario`);
    }
    this.stats.steps++;
    const step = {
      type,
      description,
      passed: true,
      error: null
    };
    this.currentScenario.steps.push(step);

    try {
      if (fn) fn();
      this.stats.passedSteps++;
    } catch (err) {
      step.passed = false;
      step.error = err;
      this.currentScenario.passed = false;
      if (this.currentFeature) this.currentFeature.passed = false;
      this.stats.failedSteps++;
      // 印出失敗細節
      console.error(`    ${colors.red}✘ [${type}] ${description}${colors.reset}`);
      console.error(`      ${colors.gray}Error: ${err.message}${colors.reset}`);
    }
  }

  given(desc, fn) { this._step('Given', desc, fn); }
  when(desc, fn) { this._step('When', desc, fn); }
  then(desc, fn) { this._step('Then', desc, fn); }
  and(desc, fn) { this._step('And', desc, fn); }

  printConsoleReport() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta} 🥒 BDD 活體規格驗收報告 (Living Specification Report) ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

    this.features.forEach((feat, fIdx) => {
      const fIcon = feat.passed ? `${colors.green}✔${colors.reset}` : `${colors.red}✘${colors.reset}`;
      console.log(`${fIcon} ${colors.bold}${colors.blue}Feature [${fIdx + 1}]: ${feat.title}${colors.reset}`);
      if (feat.description) {
        console.log(`  ${colors.dim}As an advisor / user, I want ${feat.description}${colors.reset}`);
      }

      feat.scenarios.forEach((sc, sIdx) => {
        const sIcon = sc.passed ? `${colors.green}✔${colors.reset}` : `${colors.red}✘${colors.reset}`;
        console.log(`  ${sIcon} ${colors.cyan}Scenario: ${sc.title}${colors.reset}`);
        sc.steps.forEach(st => {
          const stIcon = st.passed ? `${colors.green}✔${colors.reset}` : `${colors.red}✘${colors.reset}`;
          const typeColor = st.type === 'Given' ? colors.yellow : (st.type === 'When' ? colors.magenta : colors.green);
          console.log(`    ${stIcon} ${typeColor}${st.type}${colors.reset} ${st.description}`);
        });
      });
      console.log('');
    });

    console.log(`${colors.bold}${colors.cyan}------------------------------------------------------${colors.reset}`);
    if (this.stats.failedSteps === 0) {
      console.log(`${colors.bold}${colors.green}🎉 BDD 規格全部驗收通過！${colors.reset}`);
      console.log(`Features:  ${colors.bold}${this.stats.features}${colors.reset} 組`);
      console.log(`Scenarios: ${colors.bold}${this.stats.scenarios}${colors.reset} 個商業情境`);
      console.log(`Steps:     ${colors.bold}${this.stats.passedSteps}${colors.reset} 個 Given/When/Then 驗收步驟 100% PASS (耗時 ${duration}s)`);
    } else {
      console.log(`${colors.bold}${colors.red}❌ BDD 驗收失敗！通過 ${this.stats.passedSteps} 個步驟，失敗 ${this.stats.failedSteps} 個 (耗時 ${duration}s)${colors.reset}`);
    }
    console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);
    return this.stats.failedSteps === 0;
  }

  generateMarkdownReport(outputPath) {
    const lines = [];
    lines.push('# BDD 業務活體規格驗收總攬 (Living Specification Document)');
    lines.push('');
    lines.push(`> 產生時間：${new Date().toLocaleString('zh-TW')}  `);
    lines.push(`> 驗收狀態：**${this.stats.failedSteps === 0 ? '✅ 100% 全部通過' : '❌ 有未通過項目'}**  `);
    lines.push(`> 總體規模：**${this.stats.features} 大業務 Feature** ｜ **${this.stats.scenarios} 個情境 Scenario** ｜ **${this.stats.steps} 個 Gherkin 驗收步驟**`);
    lines.push('');
    lines.push('---');
    lines.push('');

    this.features.forEach((feat, fIdx) => {
      lines.push(`## Feature ${fIdx + 1}: ${feat.title}`);
      if (feat.description) {
        lines.push(`> **業務價值**：${feat.description}`);
      }
      lines.push('');

      feat.scenarios.forEach((sc, sIdx) => {
        lines.push(`### 情境 ${sIdx + 1}：${sc.title}`);
        lines.push('```gherkin');
        sc.steps.forEach(st => {
          lines.push(`${st.type} ${st.description}`);
        });
        lines.push('```');
        lines.push(`*驗收狀態：${sc.passed ? '🟢 通過 (PASS)' : '🔴 失敗 (FAIL)'}*`);
        lines.push('');
      });
      lines.push('---');
      lines.push('');
    });

    if (outputPath) {
      fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
      console.log(`[BDD] Markdown 活體規格文件已成功匯出至：${outputPath}`);
    }
    return lines.join('\n');
  }
}

// 實例化全域單例
const bdd = new BDDContext();

function Feature(title, description, fn) { return bdd.feature(title, description, fn); }
function Scenario(title, fn) { return bdd.scenario(title, fn); }
function Given(desc, fn) { return bdd.given(desc, fn); }
function When(desc, fn) { return bdd.when(desc, fn); }
function Then(desc, fn) { return bdd.then(desc, fn); }
function And(desc, fn) { return bdd.and(desc, fn); }

module.exports = {
  bdd,
  Feature,
  Scenario,
  Given,
  When,
  Then,
  And
};
