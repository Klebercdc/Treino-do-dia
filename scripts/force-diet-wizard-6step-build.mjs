import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const overridePath = path.join(publicDir, 'src/ui/diet/diet-wizard-force-6step.js');
const indexPath = path.join(publicDir, 'index.html');

const overrideCode = String.raw`/* Force KroniA Diet entry to the new 6-step wizard without breaking manual/generate actions. */
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

  function shouldRedirectNutritionFlow(args){
    var source = args && args.source;
    if (!source) return true;
    source = String(source);
    if (source.indexOf('diet_wizard_6step') !== -1) return false;
    if (source.indexOf('diet_wizard_6step_fallback') !== -1) return false;
    if (source.indexOf('manual') !== -1) return false;
    return true;
  }

  function install(){
    window.openKroniaDietWizard6Step = openSixStepDietWizard;

    // Bloqueia apenas o questionário antigo de 4 etapas.
    // Preserva openNutritionFlowFull porque ele gera a dieta após o wizard.
    if (typeof window.openNutritionFlow === 'function' && !window.openNutritionFlowLegacyDisabled) {
      window.openNutritionFlowLegacyDisabled = window.openNutritionFlow;
    }
    if (window.openNutritionFlowLegacyDisabled) {
      window.openNutritionFlow = function(args){
        if (shouldRedirectNutritionFlow(args)) return openSixStepDietWizard({ redirectedFrom: 'openNutritionFlow' });
        return window.openNutritionFlowLegacyDisabled.apply(this, arguments);
      };
    }

    // Entrada de IA sempre abre o wizard novo, mesmo se a função for carregada depois.
    if (typeof window.startAIDiet === 'function' && !window.startAIDietLegacyDisabled) {
      window.startAIDietLegacyDisabled = window.startAIDiet;
    }
    window.startAIDiet = function(){
      return openSixStepDietWizard({ redirectedFrom: 'startAIDiet' });
    };

    // Dieta manual fica preservada. Não sobrescrever startManualDiet.
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

  function captureAiGenerateClicks(){
    document.addEventListener('click', function(ev){
      var el = ev.target;
      while (el && el !== document.body) {
        var text = (el.innerText || el.textContent || '').toLowerCase();
        var onclick = String(el.getAttribute && el.getAttribute('onclick') || '').toLowerCase();
        var looksLikeAiDiet =
          onclick.indexOf('startaidiet') !== -1 ||
          onclick.indexOf('opennutritionflow') !== -1 ||
          text.indexOf('gerar dieta') !== -1 ||
          text.indexOf('dieta com ia') !== -1 ||
          text.indexOf('criar dieta') !== -1;
        var isManual = text.indexOf('manual') !== -1 || onclick.indexOf('startmanualdiet') !== -1;
        if (looksLikeAiDiet && !isManual) {
          ev.preventDefault();
          ev.stopPropagation();
          openSixStepDietWizard({ redirectedFrom: 'click_capture_ai_diet' });
          return false;
        }
        el = el.parentElement;
      }
    }, true);
  }

  addStyles();
  install();
  captureAiGenerateClicks();
  document.addEventListener('DOMContentLoaded', function(){ addStyles(); install(); });
  window.addEventListener('load', function(){ addStyles(); install(); });
  setInterval(install, 800);
})();
`;

await mkdir(path.dirname(overridePath), { recursive: true });
await writeFile(overridePath, overrideCode, 'utf8');

let html = await readFile(indexPath, 'utf8');
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427c"></script>';
if (!html.includes('diet-wizard-force-6step.js')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
  await writeFile(indexPath, html, 'utf8');
}

console.log('Forced 6-step diet wizard enabled; old 4-step questionnaire blocked; AI generate/manual preserved.');
