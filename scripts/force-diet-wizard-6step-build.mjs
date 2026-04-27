import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const overridePath = path.join(publicDir, 'src/ui/diet/diet-wizard-force-6step.js');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

const overrideCode = String.raw`/* Safe KroniA Diet wizard helper. Keeps cards/manual flows free. */
(function(){
  function getUserId(){
    try { return (window.currentUser && (window.currentUser.id || window.currentUser.uid)) || (window.authUser && window.authUser.id) || null; } catch(_) { return null; }
  }

  function hideOldQuestionnaireOnly(){
    var old = document.getElementById('nutritionFlowScreen');
    if (!old) return;
    old.classList.remove('show');
    old.style.display = 'none';
    old.setAttribute('aria-hidden','true');
  }

  function openSixStepDietWizard(opts){
    hideOldQuestionnaireOnly();
    if (typeof window.openDietProfileWizard === 'function') {
      window.openDietProfileWizard(getUserId(), Object.assign({ forceNew: true, source: 'forced_6step' }, opts || {}));
      return true;
    }
    console.warn('[diet] Novo wizard de 6 etapas ainda não carregou.');
    return false;
  }

  function addStyles(){
    if (document.getElementById('forceDietWizard6StepStyle')) return;
    var style = document.createElement('style');
    style.id = 'forceDietWizard6StepStyle';
    style.textContent = [
      '.diet-wizard-screen{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;background:#07090f!important;}',
      '.diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box!important;min-width:0!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function install(){
    window.openKroniaDietWizard6Step = openSixStepDietWizard;
    // Não intercepta cards genericamente. Isso evita bloquear manual, PDF, voltar e resumo.
    if (typeof window.startAIDiet === 'function' && !window.startAIDietLegacyDisabled) {
      window.startAIDietLegacyDisabled = window.startAIDiet;
    }
    window.startAIDiet = function(){ return openSixStepDietWizard({ redirectedFrom: 'startAIDiet_safe' }); };
  }

  addStyles();
  install();
  document.addEventListener('DOMContentLoaded', function(){ addStyles(); install(); });
  window.addEventListener('load', function(){ addStyles(); install(); });
})();
`;

await mkdir(path.dirname(overridePath), { recursive: true });
await writeFile(overridePath, overrideCode, 'utf8');

let html = await readFile(indexPath, 'utf8');
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427safe"></script>';
if (!html.includes('diet-wizard-force-6step.js')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
}
await writeFile(indexPath, html, 'utf8');

try {
  let app = await readFile(appPath, 'utf8');
  if (app.includes('function startAIDiet()') && !app.includes('startAIDietForcedToSixStep')) {
    app = app.replace('function startAIDiet()', 'function startAIDietForcedToSixStep(){return window.openKroniaDietWizard6Step ? window.openKroniaDietWizard6Step({redirectedFrom:"patched_app_startAIDiet"}) : null;}\nfunction startAIDiet()');
    app = app.replace(/function startAIDiet\(\)\s*\{/, 'function startAIDiet() { return startAIDietForcedToSixStep(); ');
    await writeFile(appPath, app, 'utf8');
  }
} catch (err) {
  console.warn('app.js direct patch skipped:', err.message);
}

console.log('Safe 6-step diet wizard helper installed; aggressive card binding removed.');
