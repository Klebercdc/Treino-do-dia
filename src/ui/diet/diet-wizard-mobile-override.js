/* KroniA Diet Wizard mobile override — 6 etapas
 * Corrige layout iPhone e adiciona animações sem alterar motor/API/payload.
 */
(function(){
  function injectDietWizardMobileOverride(){
    if (document.getElementById('dietWizardMobileOverrideStyle')) return;
    var style = document.createElement('style');
    style.id = 'dietWizardMobileOverrideStyle';
    style.textContent = `
      body.diet-wizard-active{overflow:hidden!important;touch-action:none;}
      .diet-wizard-screen{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;contain:layout paint size;overscroll-behavior:none;background:#07090f!important;}
      .diet-wizard-screen.show{animation:dwScreenIn .26s cubic-bezier(.22,1,.36,1);}
      .diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box!important;min-width:0!important;}
      .dw-wizard-inner{width:100%!important;max-width:100%!important;height:100%!important;overflow:hidden!important;background:radial-gradient(circle at 50% -15%,rgba(34,197,94,.13),transparent 36%),#07090f!important;}
      .dw-header-wrap{flex-shrink:0!important;width:100%!important;max-width:100%!important;padding:calc(12px + env(safe-area-inset-top)) 16px 12px!important;background:rgba(7,9,15,.94)!important;border-bottom:1px solid rgba(255,255,255,.06)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);overflow:hidden!important;}
      .dw-top{width:100%!important;max-width:100%!important;}
      .dw-title{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
      .dw-step-name{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      .dw-body{width:100%!important;max-width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;touch-action:pan-y;padding-bottom:calc(116px + env(safe-area-inset-bottom))!important;animation:dwStepIn .24s cubic-bezier(.22,1,.36,1);}
      .dw-body *{max-width:100%!important;}
      .dw-body>*{animation:dwCardIn .32s cubic-bezier(.22,1,.36,1) both;}
      .dw-card{width:100%!important;max-width:100%!important;overflow:hidden!important;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.025))!important;box-shadow:0 10px 30px rgba(0,0,0,.16)!important;}
      .dw-row{width:100%!important;max-width:100%!important;}
      .dw-chips-row{width:100%!important;max-width:100%!important;overflow:hidden!important;}
      .dw-chip,.dw-chip-single,.dw-pattern-opt,.dw-bcm-toggle{max-width:100%!important;overflow:hidden!important;transform:translateZ(0);transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease!important;}
      .dw-chip:active,.dw-chip-single:active,.dw-pattern-opt:active,.dw-bcm-toggle:active,.dw-back:active,.dw-btn-primary:active{transform:scale(.98);}
      .dw-chip.active,.dw-chip-single.active,.dw-pattern-opt.active,.dw-bcm-toggle.active{box-shadow:0 0 0 1px rgba(34,197,94,.1),0 10px 24px rgba(34,197,94,.08)!important;}
      .diet-wizard-footer{width:100%!important;max-width:100%!important;}
      @keyframes dwScreenIn{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes dwStepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
      @keyframes dwCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:380px){.dw-row{flex-wrap:wrap!important}.dw-col{flex-basis:100%!important}.dw-header-wrap{padding-left:14px!important;padding-right:14px!important}.dw-body{padding-left:14px!important;padding-right:14px!important}.dw-step-name{font-size:1.02rem!important}}
      @media(prefers-reduced-motion:reduce){.diet-wizard-screen.show,.dw-body,.dw-body>*{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  injectDietWizardMobileOverride();
  document.addEventListener('DOMContentLoaded', injectDietWizardMobileOverride);

  var originalOpen = window.openDietProfileWizard;
  if (typeof originalOpen === 'function') {
    window.openDietProfileWizard = function(){
      injectDietWizardMobileOverride();
      var result = originalOpen.apply(this, arguments);
      requestAnimationFrame(function(){
        injectDietWizardMobileOverride();
        var body = document.getElementById('dietWizardStepContainer');
        if (body) body.scrollTop = 0;
      });
      return result;
    };
  } else {
    Object.defineProperty(window, 'openDietProfileWizard', {
      configurable: true,
      set: function(fn){
        if (typeof fn !== 'function') return;
        Object.defineProperty(window, 'openDietProfileWizard', {
          configurable: true,
          writable: true,
          value: function(){
            injectDietWizardMobileOverride();
            var result = fn.apply(this, arguments);
            requestAnimationFrame(function(){
              injectDietWizardMobileOverride();
              var body = document.getElementById('dietWizardStepContainer');
              if (body) body.scrollTop = 0;
            });
            return result;
          }
        });
      },
      get: function(){ return undefined; }
    });
  }
})();
