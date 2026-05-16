/* KroniA Diet Plan Renderer — exibe dieta salva/gerada sem depender da tela antiga */
(function(){
  var SCREEN_ID = 'kroniaDietPlanVisualScreen';
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function n(v){ return Math.round(Number(v)||0); }
  function readPlan(){ try { return JSON.parse(localStorage.getItem(LAST_PLAN_KEY) || 'null'); } catch(_) { return null; } }
  function toast(msg,type){ if(typeof window.showToast==='function') window.showToast(msg,type||'info',3000); }

  function ensureStyles(){
    if($('kdpStyles')) return;
    var s = document.createElement('style');
    s.id = 'kdpStyles';
    s.textContent = 'body.diet-plan-visual-active> :not(#kroniaDietPlanVisualScreen):not(script):not(style){visibility:hidden!important;pointer-events:none!important}body.diet-plan-visual-active #dietDataScreen,body.diet-plan-visual-active #dietChoiceScreen,body.diet-plan-visual-active #dietResultScreen,body.diet-plan-visual-active #dietGeneratedScreen{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}.kdp-screen,.kdp-screen *{box-sizing:border-box}.kdp-screen{position:fixed;inset:0;z-index:17000;background:#07090f;color:#fff;font-family:Inter,DM Sans,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}.kdp-head{padding:calc(14px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,#080b10,#07090f)}.kdp-top{display:flex;align-items:center;gap:12px}.kdp-close{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}.kdp-badge{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#22c55e}.kdp-title{font-size:25px;font-weight:950;letter-spacing:-.05em;line-height:1.05}.kdp-sub{font-size:13px;color:rgba(255,255,255,.62);line-height:1.45;margin-top:4px}.kdp-body{flex:1;overflow:auto;padding:16px 16px 130px;-webkit-overflow-scrolling:touch}.kdp-hero{border:1px solid rgba(34,197,94,.22);background:radial-gradient(circle at top right,rgba(34,197,94,.18),transparent 36%),linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.035));border-radius:26px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.38)}.kdp-kcal{font-size:38px;font-weight:950;letter-spacing:-.07em;color:#fff;line-height:1}.kdp-kcal span{font-size:14px;color:rgba(255,255,255,.58);letter-spacing:0}.kdp-macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.kdp-macro{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);border-radius:16px;padding:11px;text-align:center}.kdp-macro strong{display:block;font-size:18px}.kdp-macro span{font-size:10px;color:rgba(255,255,255,.55);font-weight:900;text-transform:uppercase}.kdp-section{font-size:18px;font-weight:950;margin:18px 2px 10px}.kdp-meal{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:20px;padding:14px;margin-bottom:12px}.kdp-meal-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.kdp-meal-name{font-size:17px;font-weight:950}.kdp-meal-meta{font-size:12px;color:rgba(255,255,255,.55);margin-top:3px}.kdp-meal-kcal{color:#4ade80;font-weight:950;white-space:nowrap}.kdp-food{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);font-size:13px}.kdp-food:first-of-type{margin-top:10px}.kdp-food strong{color:#fff;white-space:nowrap}.kdp-food small{color:rgba(255,255,255,.48)}.kdp-note{border:1px solid rgba(34,197,94,.25);background:rgba(34,197,94,.08);border-radius:18px;padding:13px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.45;margin-top:12px}.kdp-foot{position:fixed;left:0;right:0;bottom:0;z-index:17001;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,9,15,0),#07090f 28%,#07090f)}.kdp-primary{width:100%;height:56px;border:0;border-radius:18px;background:#22c55e;color:#06110a;font-weight:950;font-size:16px;box-shadow:0 0 28px rgba(34,197,94,.28)}.kdp-secondary{width:100%;height:46px;margin-top:9px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-weight:850}@media(max-width:360px){.kdp-macros{grid-template-columns:1fr}.kdp-title{font-size:22px}}';
    document.head.appendChild(s);
  }

  function normalizePlan(plan){
    if(!plan || typeof plan !== 'object') return null;
    if(!Array.isArray(plan.meals) && Array.isArray(plan.refeicoes)) plan.meals = plan.refeicoes;
    if(!Array.isArray(plan.meals)) plan.meals = [];
    if(!plan.totals){
      var totals = plan.meals.reduce(function(a,m){ a.kcal+=Number(m.kcal||m.calories||0); a.protein+=Number(m.protein||0); a.carbs+=Number(m.carbs||0); a.fat+=Number(m.fat||0); return a; }, {kcal:0,protein:0,carbs:0,fat:0});
      plan.totals = totals;
    }
    if(!plan.target) plan.target = { kcal: plan.totals.kcal || 2100 };
    return plan;
  }

  function renderMeal(m){
    var items = Array.isArray(m.items) ? m.items : (Array.isArray(m.foods) ? m.foods : []);
    return '<div class="kdp-meal"><div class="kdp-meal-top"><div><div class="kdp-meal-name">'+esc(m.name || m.nome || 'Refeição')+'</div><div class="kdp-meal-meta">'+esc(m.time || m.horario || '')+' · P '+n(m.protein)+'g · C '+n(m.carbs)+'g · G '+n(m.fat)+'g</div></div><div class="kdp-meal-kcal">'+n(m.kcal || m.calories)+' kcal</div></div>'+items.map(function(i){return '<div class="kdp-food"><span>'+esc(i.name || i.nome || i.alimento || 'Alimento')+'<br><small>'+esc(i.qty || i.quantidade || i.portion || '')+'</small></span><strong>'+n(i.kcal || i.calories)+' kcal</strong></div>';}).join('')+'</div>';
  }

  function renderDietFromPlan(plan){
    plan = normalizePlan(plan || readPlan());
    if(!plan){ toast('Nenhuma dieta gerada encontrada. Gere uma nova dieta.', 'warning'); return false; }
    try { localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(plan)); } catch(_) {}
    ensureStyles();
    ['dietProfileWizardScreen','dietDataScreen','dietChoiceScreen','dietResultScreen','dietGeneratedScreen'].forEach(function(id){
      var el = $(id);
      if(!el) return;
      if(id === 'dietProfileWizardScreen') el.remove();
      else {
        el.classList.remove('show','active','open');
        el.style.display = 'none';
        el.hidden = true;
        el.style.pointerEvents = 'none';
        el.setAttribute('aria-hidden','true');
      }
    });
    document.body.classList.remove('diet-wizard-active','kdw-active','nutrition-flow-active','overlay-open');
    var old = $(SCREEN_ID); if(old) old.remove();
    var screen = document.createElement('div');
    screen.id = SCREEN_ID;
    screen.className = 'kdp-screen';
    var warnings = Array.isArray(plan.warnings) ? plan.warnings : [];
    screen.innerHTML = '<div class="kdp-head"><div class="kdp-top"><button class="kdp-close" id="kdpClose">×</button><div style="flex:1;min-width:0"><div class="kdp-badge">Dieta gerada</div><div class="kdp-title">'+esc(plan.title || 'Plano alimentar KroniA')+'</div><div class="kdp-sub">Plano salvo e renderizado pelo KroniA, sem depender da tela antiga.</div></div></div></div><div class="kdp-body"><div class="kdp-hero"><div class="kdp-sub">Meta diária</div><div class="kdp-kcal">'+n((plan.target&&plan.target.kcal) || (plan.totals&&plan.totals.kcal))+' <span>kcal</span></div><div class="kdp-macros"><div class="kdp-macro"><strong>'+n(plan.totals&&plan.totals.protein)+'g</strong><span>Proteína</span></div><div class="kdp-macro"><strong>'+n(plan.totals&&plan.totals.carbs)+'g</strong><span>Carbo</span></div><div class="kdp-macro"><strong>'+n(plan.totals&&plan.totals.fat)+'g</strong><span>Gordura</span></div></div></div><div class="kdp-section">Refeições de hoje</div>'+plan.meals.map(renderMeal).join('')+(warnings.length?'<div class="kdp-note">'+warnings.map(esc).join('<br><br>')+'</div>':'')+'</div><div class="kdp-foot"><button class="kdp-primary" id="kdpNewDiet">Gerar nova dieta</button><button class="kdp-secondary" id="kdpBackDiet">Voltar para Dieta</button></div>';
    document.body.appendChild(screen);
    document.body.classList.add('diet-plan-visual-active');
    $('kdpClose').onclick = closeDietPlanVisual;
    $('kdpBackDiet').onclick = closeDietPlanVisual;
    $('kdpNewDiet').onclick = function(){
      window.__kroniaDietGenerationCompleted = false;
      closeDietPlanVisual();
      try { localStorage.removeItem(LAST_PLAN_KEY); } catch(_) {}
      if (typeof window.startAIDiet === 'function') { window.startAIDiet(); }
      else if(window.KroniaDiet && typeof window.KroniaDiet.createPlan==='function') { window.KroniaDiet.createPlan(); }
      else if(typeof window.createDietPlan==='function') { window.createDietPlan(); }
    };
    return true;
  }

  function closeDietPlanVisual(){
    var el = $(SCREEN_ID); if(el) el.remove();
    document.body.classList.remove('diet-plan-visual-active');
  }

  window.renderDietFromPlan = renderDietFromPlan;
  window.renderDietPlan = renderDietFromPlan;
  window.openLastGeneratedDiet = function(){ return renderDietFromPlan(readPlan()); };
  window.closeDietPlanVisual = closeDietPlanVisual;

  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || typeof t.closest !== 'function') return;
    var btn = t.closest('[data-action="view-generated-diet"],#viewGeneratedDietBtn,.view-generated-diet');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    renderDietFromPlan(readPlan());
  }, true);
})();
