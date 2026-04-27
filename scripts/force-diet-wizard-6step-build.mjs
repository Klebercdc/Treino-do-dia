import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const overridePath = path.join(publicDir, 'src/ui/diet/diet-wizard-force-6step.js');
const indexPath = path.join(publicDir, 'index.html');

const overrideCode = String.raw`/* Force KroniA Diet to the new 6-step wizard. */
(function(){
  function getUserId(){
    try { return (window.currentUser && (window.currentUser.id || window.currentUser.uid)) || (window.authUser && window.authUser.id) || null; } catch(_) { return null; }
  }

  function hideOldDietFlow(){
    ['nutritionFlowScreen','dietChoiceScreen'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
    });
  }

  function openSixStepDietWizard(opts){
    hideOldDietFlow();
    if (typeof window.openDietProfileWizard === 'function') {
      window.openDietProfileWizard(getUserId(), Object.assign({ forceNew: true, source: 'forced_6step' }, opts || {}));
      return true;
    }
    console.warn('[diet] Novo wizard de 6 etapas ainda não carregou.');
    return false;
  }

  function install(){
    window.openKroniaDietWizard6Step = openSixStepDietWizard;

    ['openNutritionFlow','openNutritionFlowFull'].forEach(function(name){
      var original = window[name];
      window[name + 'LegacyDisabled'] = original;
      window[name] = function(){
        return openSixStepDietWizard({ redirectedFrom: name });
      };
    });

    ['startAIDiet','startManualDiet','openDietWizard','openDietDataWizard'].forEach(function(name){
      if (typeof window[name] === 'function') window[name + 'LegacyDisabled'] = window[name];
      window[name] = function(){
        return openSixStepDietWizard({ redirectedFrom: name });
      };
    });
  }

  function addStyles(){
    if (document.getElementById('forceDietWizard6StepStyle')) return;
    var style = document.createElement('style');
    style.id = 'forceDietWizard6StepStyle';
    style.textContent = [
      '#nutritionFlowScreen{display:none!important;visibility:hidden!important;pointer-events:none!important;}',
      '.diet-wizard-screen{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;background:#07090f!important;}',
      '.diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box!important;min-width:0!important;}',
      '.dw-body{overflow-x:hidden!important;max-width:100%!important;animation:dwStepIn .24s cubic-bezier(.22,1,.36,1);}',
      '.dw-body *{max-width:100%!important;}',
      '.dw-card{max-width:100%!important;overflow:hidden!important;}',
      '.dw-row{max-width:100%!important;}',
      '.dw-chips-row{max-width:100%!important;overflow:hidden!important;}',
      '@keyframes dwStepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}'
    ].join('\n');
    document.head.appendChild(style);
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
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427"></script>';
if (!html.includes('diet-wizard-force-6step.js')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
  await writeFile(indexPath, html, 'utf8');
}

console.log('Forced 6-step diet wizard enabled; old 4-step nutrition flow blocked.');
