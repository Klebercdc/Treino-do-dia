import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');
const wizardPath = path.join(publicDir, 'src/ui/diet/diet-wizard.js');

let html = await readFile(indexPath, 'utf8');
const controllerTag = '<script src="src/ui/diet/diet-entry-controller.js?v=20260427-final2"></script>';

if (!html.includes('diet-entry-controller.js')) {
  html = html.replace('</body>', `  ${controllerTag}\n</body>`);
}

html = html
  .replace(/onclick="startAIDiet\(\)"/g, 'onclick="KroniaDiet.ai()"')
  .replace(/onclick='startAIDiet\(\)'/g, "onclick='KroniaDiet.ai()'")
  .replace(/onclick="openKroniaDietWizard6Step\(\)"/g, 'onclick="KroniaDiet.ai()"')
  .replace(/onclick='openKroniaDietWizard6Step\(\)'/g, "onclick='KroniaDiet.ai()'")
  .replace(/onclick="startManualDiet\(\)"/g, 'onclick="KroniaDiet.manual()"')
  .replace(/onclick='startManualDiet\(\)'/g, "onclick='KroniaDiet.manual()'");

await writeFile(indexPath, html, 'utf8');

try {
  let app = await readFile(appPath, 'utf8');

  if (app.includes('function startAIDiet()') && !app.includes('KroniaDiet.ai')) {
    app = app.replace(/function startAIDiet\(\)\s*\{/, 'function startAIDiet() { if (window.KroniaDiet && window.KroniaDiet.ai) return window.KroniaDiet.ai(); ');
  }

  app = app.replace(/function\s+regenerateDiet\s*\(\)\s*\{/g, 'function regenerateDiet() { if (window.KroniaDiet && window.KroniaDiet.createPlan) return window.KroniaDiet.createPlan(); ');
  app = app.replace(/function\s+regenerateDietPlan\s*\(\)\s*\{/g, 'function regenerateDietPlan() { if (window.KroniaDiet && window.KroniaDiet.createPlan) return window.KroniaDiet.createPlan(); ');
  app = app.replace(/function\s+regeneratePlan\s*\(\)\s*\{/g, 'function regeneratePlan() { if (window.KroniaDiet && window.KroniaDiet.createPlan) return window.KroniaDiet.createPlan(); ');
  app = app.replace(/function\s+createDietPlan\s*\(\)\s*\{/g, 'function createDietPlan() { if (window.KroniaDiet && window.KroniaDiet.createPlan) return window.KroniaDiet.createPlan(); ');

  await writeFile(appPath, app, 'utf8');
} catch (err) {
  console.warn('Diet entry direct app patch skipped:', err.message);
}

try {
  let wizard = await readFile(wizardPath, 'utf8');

  // O wizard de 6 etapas NÃO pode cair no questionário antigo de 4 etapas.
  wizard = wizard.replace(
    "console.error('[diet-wizard] Falha ao abrir wizard; usando fluxo legado.', err);\n      _openLegacyDietFlow('diet_wizard_open_fallback');",
    "console.error('[diet-wizard] Falha ao abrir wizard novo.', err);\n      if (typeof showToast === 'function') showToast('Não foi possível abrir o criador de dieta. Atualize e tente novamente.', 'error', 4200);\n      return false;"
  );

  // Fallback visual de componente também não deve abrir o fluxo antigo.
  wizard = wizard.replace(
    "<button type=\"button\" class=\"dw-btn-primary\" onclick=\"openNutritionFlow({source:\\'diet_wizard_component_fallback\\',returnTab:\\'dieta\\'})\">Abrir criação de dieta</button>",
    "<button type=\"button\" class=\"dw-btn-primary\" onclick=\"KroniaDiet && KroniaDiet.createPlan ? KroniaDiet.createPlan() : location.reload()\">Tentar novamente</button>"
  );

  await writeFile(wizardPath, wizard, 'utf8');
} catch (err) {
  console.warn('Diet wizard no-legacy patch skipped:', err.message);
}

console.log('Clean KroniaDiet controller loaded; old 4-step fallback disabled for 6-step wizard.');
