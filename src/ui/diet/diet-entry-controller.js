(function(){
  var ASSET = 'src/ui/diet/diet-wizard-standalone.js';

  function loadStandalone(){
    return new Promise(function(resolve){
      if (window.__kroniaDietWizardStandaloneLoaded) return resolve(true);
      var s=document.createElement('script');
      s.src='/' + ASSET + '?v=' + Date.now();
      s.onload=function(){ resolve(true); };
      s.onerror=function(){ resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function open(){
    if (typeof window.openDietProfileWizard === 'function') return window.openDietProfileWizard(null,{forceNew:true});
    var ok = await loadStandalone();
    if (ok && typeof window.openDietProfileWizard === 'function'){
      return window.openDietProfileWizard(null,{forceNew:true});
    }
    alert('Erro ao abrir dieta.');
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest('#regenerateDietPlanBtn, .regenerate-diet-plan, [data-action="regenerate-diet"]');
    if(!btn) return;
    e.preventDefault();
    open();
  }, true);
})();
