#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw);
    const toolName = payload.tool_name;
    const filePath = payload.tool_input?.file_path;

    if (!filePath || !['Edit', 'Write'].includes(toolName)) return;

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const registryPath = path.join(projectDir, '.claude', 'prd-registry.json');
    if (!fs.existsSync(registryPath)) return;

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const rel = path.relative(projectDir, filePath);

    const matches = [];
    for (const [prdFile, patterns] of Object.entries(registry)) {
      if (prdFile.startsWith('_')) continue;
      for (const pattern of patterns) {
        if (rel === pattern || rel.startsWith(pattern)) {
          matches.push(prdFile);
          break;
        }
      }
    }

    if (matches.length > 0) {
      console.log('\n[PRD SYNC] Arquivo estrutural alterado: "' + rel + '"');
      console.log('[PRD SYNC] PRDs potencialmente desatualizados:');
      matches.forEach(p => console.log('  → ' + p));
      console.log('[PRD SYNC] Consulte a Seção 14.2 do PRD para saber quais seções revisar.\n');
    }
  } catch (_) {
    // nunca bloquear desenvolvimento por falha no hook
  }
});
