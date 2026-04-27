import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const overridePath = path.join(publicDir, 'src/ui/diet/diet-wizard-force-6step.js');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

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

  function textOf(el){ return String((el && (el.innerText || el.textContent)) || '').toLowerCase(); }
  function onclickOf(el){ return String((el && el.getAttribute && el.getAttribute('onclick')) || '').toLowerCase(); }
  function isManualEl(el){ var t=textOf(el), o=onclickOf(el); return t.indexOf('manual') !== -1 || t.indexOf('editar dieta') !== -1 || o.indexOf('startmanualdiet') !== -1; }
  function isAiEl(el){
    if (!el || isManualEl(el)) return false;
    var t=textOf(el), o=onclickOf(el);
    return t.indexOf('regenerar plano') !== -1 || t.indexOf('dieta com ia') !== -1 || t.indexOf('plano alimentar inteligente') !== -1 || t.indexOf('gerar dieta') !== -1 || t.indexOf('criar dieta') !== -1 || t.indexOf('inteligência artificial') !== -1 || o.indexOf('startaidiet') !== -1 || o.indexOf('opennutritionflow') !== -1 || o.indexOf('regenerate') !== -1 || o.indexOf('regenerar') !== -1;
  }

  function bindAiElement(el){
    if (!el || el.dataset.kroniaAiDietBound === '1') return;
    if (isManualEl(el)) return;
    el.dataset.kroniaAiDietBound = '1';
    el.disabled = false;
    el.removeAttribute('disabled');
    el.setAttribute('aria-disabled','false');
    el.style.pointerEvents = 'auto';
    el.style.opacity = '';
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      openSixStepDietWizard({ redirectedFrom: 'regenerate_ai_plan_card' });
      return false;
    }, true);
    el.onclick = function(ev){
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      return openSixStepDietWizard({ redirectedFrom: 'regenerate_ai_plan_onclick' });
    };
  }

  function enableAiDietButtons(){
    var selector = 'button,[role="button"],a,.btn,.diet-choice-card,.diet-card,.choice-card,.action-card,.ai-card,[onclick],[class*="diet"],[class*="nutrition"]';
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    nodes.forEach(function(el){
      if (isAiEl(el)) {
        bindAiElement(el);
        var parent = el.parentElement;
        for (var i=0; parent && i<3; i++, parent = parent.parentElement) {
          if (parent && !isManualEl(parent)) bindAiElement(parent);
        }
      }
    });
  }

  function install(){
    window.openKroniaDietWizard6Step = openSixStepDietWizard;

    if (typeof window.openNutritionFlow === 'function' && !window.openNutritionFlowLegacyDisabled) window.openNutritionFlowLegacyDisabled = window.openNutritionFlow;
    if (window.openNutritionFlowLegacyDisabled) {
      window.openNutritionFlow = function(args){
        if (shouldRedirectNutritionFlow(args)) return openSixStepDietWizard({ redirectedFrom: 'openNutritionFlow' });
        return window.openNutritionFlowLegacyDisabled.apply(this, arguments);
      };
    }

    if (typeof window.startAIDiet === 'function' && !window.startAIDietLegacyDisabled) window.startAIDietLegacyDisabled = window.startAIDiet;
    window.startAIDiet = function(){ return openSixStepDietWizard({ redirectedFrom: 'startAIDiet' }); };
    window.openDietWizard = function(){ return openSixStepDietWizard({ redirectedFrom: 'openDietWizard' }); };
    window.openDietDataWizard = function(){ return openSixStepDietWizard({ redirectedFrom: 'openDietDataWizard' }); };

    enableAiDietButtons();
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
      '[data-kronia-ai-diet-bound="1"]{pointer-events:auto!important;opacity:1!important;filter:none!important;cursor:pointer!important;}',
      '@keyframes dwStepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function captureAiGenerateClicks(){
    document.addEventListener('click', function(ev){
      var el = ev.target;
      while (el && el !== document.body) {
        if (isAiEl(el)) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
          openSixStepDietWizard({ redirectedFrom: 'capture_regenerate_ai_plan' });
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
  setInterval(install, 250);
})();
`;

await mkdir(path.dirname(overridePath), { recursive: true });
await writeFile(overridePath, overrideCode, 'utf8');

let html = await readFile(indexPath, 'utf8');
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427g"></script>';
if (!html.includes('diet-wizard-force-6step.js')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
}

html = html
  .replace(/onclick="startAIDiet\(\)"/g, 'onclick="openKroniaDietWizard6Step()"')
  .replace(/onclick='startAIDiet\(\)'/g, "onclick='openKroniaDietWizard6Step()'")
  .replace(/onclick="openNutritionFlow\((?!\{source:\\'manual)[^\"]*\)"/g, 'onclick="openKroniaDietWizard6Step()"');
await writeFile(indexPath, html, 'utf8');

try {
  let app = await readFile(appPath, 'utf8');
  const marker = 'function startAIDiet()';
  if (app.includes(marker) && !app.includes('startAIDietForcedToSixStep')) {
    app = app.replace(marker, 'function startAIDietForcedToSixStep(){return window.openKroniaDietWizard6Step ? window.openKroniaDietWizard6Step({redirectedFrom:"patched_app_startAIDiet"}) : null;}\nfunction startAIDiet()');
    app = app.replace(/function startAIDiet\(\)\s*\{/, 'function startAIDiet() { return startAIDietForcedToSixStep(); /* old body disabled */ ');
    await writeFile(appPath, app, 'utf8');
  }
} catch (err) {
  console.warn('app.js direct patch skipped:', err.message);
}

console.log('Forced 6-step diet wizard enabled; Regenerar plano card bound; manual preserved.');
