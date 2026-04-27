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

  function enableAiDietButtons(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a,.btn,.diet-choice-card,.diet-card,[onclick]'));
    nodes.forEach(function(el){
      var text = (el.innerText || el.textContent || '').toLowerCase();
      var onclick = String((el.getAttribute && el.getAttribute('onclick')) || '').toLowerCase();
      var isManual = text.indexOf('manual') !== -1 || onclick.indexOf('startmanualdiet') !== -1;
      var isAi = !isManual && (
        text.indexOf('gerar dieta') !== -1 ||
        text.indexOf('dieta com ia') !== -1 ||
        text.indexOf('criar dieta') !== -1 ||
        text.indexOf('inteligência artificial') !== -1 ||
        onclick.indexOf('startaidiet') !== -1 ||
        onclick.indexOf('opennutritionflow') !== -1 ||
        onclick.indexOf('opendietprofilewizard') !== -1
      );
      if (!isAi) return;
      el.disabled = false;
      el.removeAttribute('disabled');
      el.setAttribute('aria-disabled','false');
      el.style.pointerEvents = 'auto';
      el.style.opacity = '';
      el.onclick = function(ev){
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        return openSixStepDietWizard({ redirectedFrom: 'ai_button_direct_handler' });
      };
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
        var isManual = text.indexOf('manual') !== -1 || onclick.indexOf('startmanualdiet') !== -1;
        var looksLikeAiDiet = !isManual && (
          onclick.indexOf('startaidiet') !== -1 ||
          onclick.indexOf('opennutritionflow') !== -1 ||
          onclick.indexOf('opendietprofilewizard') !== -1 ||
          text.indexOf('gerar dieta') !== -1 ||
          text.indexOf('dieta com ia') !== -1 ||
          text.indexOf('criar dieta') !== -1 ||
          text.indexOf('inteligência artificial') !== -1
        );
        if (looksLikeAiDiet) {
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
  setInterval(install, 500);
})();
`;

await mkdir(path.dirname(overridePath), { recursive: true });
await writeFile(overridePath, overrideCode, 'utf8');

let html = await readFile(indexPath, 'utf8');
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427e"></script>';
if (!html.includes('diet-wizard-force-6step.js')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
}

// Patch direct inline handlers in the generated HTML. This is safer than relying only on runtime capture.
html = html
  .replace(/onclick="startAIDiet\(\)"/g, 'onclick="openKroniaDietWizard6Step()"')
  .replace(/onclick='startAIDiet\(\)'/g, "onclick='openKroniaDietWizard6Step()'")
  .replace(/onclick="openNutritionFlow\((?!\{source:\\'manual)[^\"]*\)"/g, 'onclick="openKroniaDietWizard6Step()"');
await writeFile(indexPath, html, 'utf8');

// Patch generated app.js when old entrypoint exists as plain code.
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

console.log('Forced 6-step diet wizard enabled; generated index/app entrypoints patched; manual preserved.');
