import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

// 1. REMOVE COMPLETAMENTE O FLUXO ANTIGO DO HTML
let html = await readFile(indexPath, 'utf8');

// remove bloco inteiro do nutritionFlowScreen
html = html.replace(/<[^>]*id="nutritionFlowScreen"[\s\S]*?<\/[^>]+>/g, '');

// injeta controller
if (!html.includes('diet-entry-controller.js')) {
  html = html.replace('</body>', '<script src="src/ui/diet/diet-entry-controller.js"></script>\n</body>');
}

await writeFile(indexPath, html, 'utf8');

// 2. BLOQUEIA FUNÇÃO ANTIGA
try {
  let app = await readFile(appPath, 'utf8');

  // impede abertura do fluxo antigo
  app = app.replace(/function\s+openNutritionFlow\s*\(/g,
    'function openNutritionFlow(){ return window.KroniaDiet && window.KroniaDiet.createPlan ? window.KroniaDiet.createPlan() : null; }\nfunction openNutritionFlow_blocked__('
  );

  await writeFile(appPath, app, 'utf8');
} catch (e) {
  console.warn('skip patch openNutritionFlow', e.message);
}

console.log('Legacy 4-step diet flow removed completely.');
