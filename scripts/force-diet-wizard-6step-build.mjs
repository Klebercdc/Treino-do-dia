import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const overridePath = path.join(publicDir, 'src/ui/diet/diet-wizard-force-6step.js');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

const overrideCode = String.raw`/* Force KroniA Diet AI card to the 6-step wizard. */
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

  function textOf(el){ return String((el && (el.innerText || el.textContent)) || '').toLowerCase(); }
  function onclickOf(el){ return String((el && el.getAttribute && el.getAttribute('onclick')) || '').toLowerCase(); }
  function isManualText(t,o){ return t.indexOf('montar manualmente') !== -1 || t.indexOf('editar dieta') !== -1 || t.indexOf('manual') !== -1 || o.indexOf('startmanualdiet') !== -1; }
  function isAiText(t,o){ return !isManualText(t,o) && (t.indexOf('dieta com ia') !== -1 || t.indexOf('regenerar plano') !== -1 || t.indexOf('plano alimentar inteligente') !== -1 || t.indexOf('gerar dieta') !== -1 || t.indexOf('criar dieta') !== -1 || o.indexOf('startaidiet') !== -1 || o.indexOf('regenerate') !== -1 || o.indexOf('regenerar') !== -1); }

  function bind(el, reason){
    if (!el || el.dataset.kroniaAiDietBound === '1') return;
    var t = textOf(el), o = onclickOf(el);
    if (isManualText(t,o)) return;
    el.dataset.kroniaAiDietBound = '1';
    el.disabled = false;
    el.removeAttribute('disabled');
    el.setAttribute('aria-disabled','false');
    el.style.pointerEvents = 'auto';
    el.style.opacity = '';
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      return openSixStepDietWizard({ redirectedFrom: reason || 'ai_card' });
    }, true);
    el.onclick = function(ev){
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      return openSixStepDietWizard({ redirectedFrom: reason || 'ai_card_onclick' });
    };
  }

  function findClickableAncestor(el){
    var cur = el;
    for (var i = 0; cur && cur !== document.body && i < 6; i++, cur = cur.parentElement) {
      if (cur.tagName === 'BUTTON' || cur.tagName === 'A' || cur.getAttribute('role') === 'button' || onclickOf(cur) || /card|btn|button|choice|diet/i.test(cur.className || '')) return cur;
    }
    return el;
  }

  function enableAiDietCard(){
    var all = Array.prototype.slice.call(document.querySelectorAll('body *'));
    all.forEach(function(el){
      var t = textOf(el), o = onclickOf(el);
      if (!isAiText(t,o)) return;
      var target = findClickableAncestor(el);
      bind(target, 'ai_text_or_card_match');
      // se texto e botão estiverem em filhos separados, sobe até o card que contém ambos
      var parent = el.parentElement;
      for (var i=0; parent && parent !== document.body && i<5; i++, parent = parent.parentElement) {
        var pt = textOf(parent);
        if (pt.indexOf('dieta com ia') !== -1 && pt.indexOf('montar manualmente') === -1) bind(parent, 'whole_diet_ai_card');
      }
    });
  }

  function install(){
    window.openKroniaDietWizard6Step = openSixStepDietWizard;
    window.startAIDiet = function(){ return openSixStepDietWizard({ redirectedFrom: 'startAIDiet' }); };
    window.openDietWizard = function(){ return openSixStepDietWizard({ redirectedFrom: 'openDietWizard' }); };
    window.openDietDataWizard = function(){ return openSixStepDietWizard({ redirectedFrom: 'openDietDataWizard' }); };
    enableAiDietCard();
  }

  function addStyles(){
    if (document.getElementById('forceDietWizard6StepStyle')) return;
    var style = document.createElement('style');
    style.id = 'forceDietWizard6StepStyle';
    style.textContent = [
      '#nutritionFlowScreen{display:none!important;visibility:hidden!important;pointer-events:none!important;}',
      '.diet-wizard-screen{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;background:#07090f!important;}',
      '.diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box!important;min-width:0!important;}',
      '[data-kronia-ai-diet-bound="1"]{pointer-events:auto!important;opacity:1!important;filter:none!important;cursor:pointer!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function globalCapture(){
    document.addEventListener('click', function(ev){
      var el = ev.target;
      for (var i=0; el && el !== document.body && i<8; i++, el = el.parentElement) {
        var t = textOf(el), o = onclickOf(el);
        if (isAiText(t,o)) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
          return openSixStepDietWizard({ redirectedFrom: 'global_capture_ai_card' });
        }
      }
    }, true);
  }

  addStyles();
  install();
  globalCapture();
  document.addEventListener('DOMContentLoaded', function(){ addStyles(); install(); });
  window.addEventListener('load', function(){ addStyles(); install(); });
  if (window.MutationObserver) {
    new MutationObserver(function(){ install(); }).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  }
  setInterval(install, 200);
})();
`;

await mkdir(path.dirname(overridePath), { recursive: true });
await writeFile(overridePath, overrideCode, 'utf8');

let html = await readFile(indexPath, 'utf8');
const tag = '<script src="src/ui/diet/diet-wizard-force-6step.js?v=20260427h"></script>';
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

console.log('AI diet card bound with MutationObserver; manual preserved.');
