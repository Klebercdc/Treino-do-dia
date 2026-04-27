import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

let html = await readFile(indexPath, 'utf8');
const controllerTag = '<script src="src/ui/diet/diet-entry-controller.js?v=20260427-final"></script>';

if (!html.includes('diet-entry-controller.js')) {
  html = html.replace('</body>', `  ${controllerTag}\n</body>`);
}

// Substituições explícitas e seguras. Não usa captura global de cards.
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

  // Preserva o corpo original apenas como fallback, mas normaliza a entrada de IA.
  if (app.includes('function startAIDiet()') && !app.includes('KroniaDiet.ai')) {
    app = app.replace(/function startAIDiet\(\)\s*\{/, 'function startAIDiet() { if (window.KroniaDiet && window.KroniaDiet.ai) return window.KroniaDiet.ai(); ');
  }

  // Regenerar plano deve passar pelo controlador quando a função existir no app.
  app = app.replace(/function\s+regenerateDiet\s*\(\)\s*\{/g, 'function regenerateDiet() { if (window.KroniaDiet && window.KroniaDiet.regenerate) return window.KroniaDiet.regenerate(); ');
  app = app.replace(/function\s+regenerateDietPlan\s*\(\)\s*\{/g, 'function regenerateDietPlan() { if (window.KroniaDiet && window.KroniaDiet.regenerate) return window.KroniaDiet.regenerate(); ');
  app = app.replace(/function\s+regeneratePlan\s*\(\)\s*\{/g, 'function regeneratePlan() { if (window.KroniaDiet && window.KroniaDiet.regenerate) return window.KroniaDiet.regenerate(); ');

  await writeFile(appPath, app, 'utf8');
} catch (err) {
  console.warn('Diet entry direct app patch skipped:', err.message);
}

console.log('Clean KroniaDiet entry controller loaded; aggressive card overrides removed.');
