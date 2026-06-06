/* KRONIA Labs forced opener
 * Garante que qualquer clique em botão/link/card de Exames abra o modal,
 * mesmo se o HTML antigo não chamar openLabsUploadScreen diretamente.
 */
(function(){
  'use strict';
  function isLabsTarget(el){
    while(el && el !== document.body){
      var txt = String(el.innerText || el.textContent || '').trim().toLowerCase();
      var aria = String(el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-action') || el.id || el.className) || '').toLowerCase();
      if ((txt === 'exames' || txt.indexOf('exames') >= 0 || aria.indexOf('exames') >= 0 || aria.indexOf('labs') >= 0) && /button|a|div|section|span/i.test(el.tagName || '')) return true;
      el = el.parentElement;
    }
    return false;
  }
  function openLabs(ev){
    var target = ev && ev.target;
    if (!target || !isLabsTarget(target)) return;
    try {
      if (typeof window.openLabsUploadScreen === 'function') {
        ev.preventDefault();
        ev.stopPropagation();
        window.openLabsUploadScreen('forced-click-listener');
      }
    } catch(e) { try { console.error('[LabsForceLoader]', e); } catch(_) {} }
  }
  document.addEventListener('click', openLabs, true);
  document.addEventListener('touchend', openLabs, true);
})();
