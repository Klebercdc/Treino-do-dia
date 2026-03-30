#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FRONTEND_FILES = [
  'app.js',
  'auth.js',
  'plans.js',
  'transforms_dashboard.js',
  'transforms_dashboard_acwr.js',
  'transforms_engine.js',
  'krona-setup.js'
].map((f) => path.join(ROOT, f));

const ALLOWLIST = [
  /window\.KroniaAccessScope\.applyScopedQuery/,
  /window\.KroniaAccessScope\.ensureAdminAwareQuery/,
  /purpose:\s*'fatigue_analysis'/,
  /purpose:\s*'diet_sheet'/,
  /purpose:\s*'diet_sheet_profile'/,
  /purpose:\s*'transforms_dashboard'/,
  /purpose:\s*'transforms_dashboard_acwr'/,
  /auth\.js/ // own-user sync in auth pipeline
];

const OWNERSHIP_PATTERNS = [
  /\.eq\(['"]user_id['"]\s*,/g,
  /\.eq\(['"]owner_id['"]\s*,/g,
  /\.eq\(['"]profile_id['"]\s*,/g,
  /\.eq\(['"]created_by['"]\s*,/g,
  /\.match\(\{[^\}]*user_id[^\}]*\}\)/g
];

function shouldIgnore(filePath, line) {
  if (line.includes('admin-scope-audit:allow')) return true;
  return ALLOWLIST.some((rule) => rule.test(line) || rule.test(filePath));
}

const findings = [];

for (const filePath of FRONTEND_FILES) {
  if (!fs.existsSync(filePath)) continue;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const pattern of OWNERSHIP_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line) && !shouldIgnore(filePath, line)) {
        findings.push({
          file: path.relative(ROOT, filePath),
          line: idx + 1,
          text: line.trim()
        });
      }
    }
  });
}

if (findings.length) {
  console.error('[admin-scope-audit] ownership filters fora da camada central:');
  findings.forEach((item) => {
    console.error(`- ${item.file}:${item.line} :: ${item.text}`);
  });
  process.exit(1);
}

console.log('[admin-scope-audit] OK: nenhum filtro residual crítico detectado.');
