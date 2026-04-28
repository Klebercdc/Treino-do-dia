/* KroniA Diet Wizard Standalone
 * Zero dependências. Exporta window.openDietProfileWizard.
 * Usado como fonte de verdade para abertura do fluxo de dieta no mobile/PWA.
 */
(function () {
  var SCREEN_ID = 'dietProfileWizardScreen';
  var STATE_KEY = 'kronia_diet_wizard_state_v3_standalone';
  var steps = [
    { key: 'body', badge: 'Perfil', title: 'Composição corporal', sub: 'Dados essenciais para calcular metabolismo e necessidade energética.' },
    { key: 'goal', badge: 'Objetivo', title: 'Meta alimentar', sub: 'Defina o foco da dieta e a estratégia calórica.' },
    { key: 'health', badge: 'Saúde', title: 'Contexto clínico', sub: 'Patologias, exames e cuidados de segurança.' },
    { key: 'food', badge: 'Alimentos', title: 'Preferências', sub: 'Adapte a dieta ao que você consegue seguir.' },
    { key: 'training', badge: 'Treino', title: 'Gasto real', sub: 'Musculação, cardio, CrossFit e rotina entram no cálculo.' },
    { key: 'metabolism', badge: 'Metabolismo', title: 'Resposta do corpo', sub: 'Ajustes por fome, sono, estresse e adesão.' }
  ];

  function $(id) { return document.getElementById(id); }
  function num(v) { var n = Number(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : null; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function readState(userId, forceNew) {
    if (!forceNew) {
      try {
        var saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
        if (saved && saved.userId === (userId || null)) return saved;
      } catch (_) {}
    }
    return { userId: userId || null, current: 0, data: {}, startedAt: new Date().toISOString() };
  }

  function saveState(state) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function chip(group, value, label, multi) {
    return '<button type="button" class="kdw-chip" data-group="' + esc(group) + '" data-value="' + esc(value) + '" data-multi="' + (multi ? '1' : '0') + '">' + esc(label) + '</button>';
  }

  function field(label, name, type, placeholder) {
    return '<label class="kdw-label">' + label + '</label><input class="kdw-input" id="kdw_' + name + '" name="' + name + '" type="' + (type || 'text') + '" inputmode="' + (type === 'number' ? 'decimal' : 'text') + '" placeholder="' + esc(placeholder || '') + '">';
  }

  function select(label, name, opts) {
    return '<label class="kdw-label">' + label + '</label><select class="kdw-input" id="kdw_' + name + '" name="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }

  function renderStepHtml(state) {
    var s = steps[state.current];
    var k = s.key;
    if (k === 'body') {
      return '<div class="kdw-grid2">' +
        '<div>' + select('Sexo', 'sex', [['masculino','Masculino'],['feminino','Feminino']]) + '</div>' +
        '<div>' + field('Idade', 'age', 'number', '30') + '</div>' +
        '<div>' + field('Peso atual (kg)', 'weight_kg', 'number', '75') + '</div>' +
        '<div>' + field('Altura (cm)', 'height_cm', 'number', '175') + '</div>' +
        '</div>' +
        '<div class="kdw-card mini"><div class="kdw-section-title">Composição opcional</div>' +
        '<div class="kdw-grid2"><div>' + field('% gordura/BCM', 'body_fat_percent', 'number', '18') + '</div><div>' + field('Massa magra (kg)', 'lean_mass_kg', 'number', '60') + '</div></div></div>';
    }
    if (k === 'goal') {
      return '<div class="kdw-section-title">Objetivo principal</div><div class="kdw-chips">' +
        chip('objective','emagrecimento','Emagrecimento') + chip('objective','hipertrofia','Hipertrofia') + chip('objective','recomposicao','Recomposição') + chip('objective','performance','Performance') +
        '</div><div class="kdw-grid2"><div>' + select('Refeições por dia','meals',[['3','3'],['4','4'],['5','5'],['6','6']]) + '</div><div>' + field('Meta kcal manual', 'target_kcal', 'number', 'Opcional') + '</div></div>';
    }
    if (k === 'health') {
      return '<div class="kdw-section-title">Condições clínicas</div><div class="kdw-chips">' +
        chip('pathologies','hipertensao','Hipertensão', true) + chip('pathologies','diabetes','Diabetes', true) + chip('pathologies','renal','Renal', true) + chip('pathologies','gastrite','Gastrite', true) + chip('pathologies','nenhuma','Nenhuma', true) +
        '</div>' + field('Observações clínicas / exames', 'clinical_notes', 'text', 'Ex: ferritina baixa, TSH alterado, restrição médica...');
    }
    if (k === 'food') {
      return '<div class="kdw-section-title">Preferências e restrições</div><div class="kdw-chips">' +
        chip('food_pattern','tradicional','Tradicional') + chip('food_pattern','lowcarb','Low carb') + chip('food_pattern','vegetariano','Vegetariano') + chip('food_pattern','simples','Simples e barato') +
        '</div>' + field('Alimentos que gosta', 'likes', 'text', 'Arroz, feijão, frango, ovos...') + field('Alimentos que evita', 'dislikes', 'text', 'Leite, peixe, lactose...');
    }
    if (k === 'training') {
      return '<div class="kdw-section-title">Modalidades selecionáveis</div><div class="kdw-chips">' +
        chip('modalities','musculacao','Musculação', true) + chip('modalities','cardio','Cardio', true) + chip('modalities','crossfit','CrossFit', true) + chip('modalities','caminhada','Caminhada', true) + chip('modalities','nenhum','Não treino', true) +
        '</div><div class="kdw-grid2"><div>' + select('Frequência semanal','training_days',[['0','0'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7']]) + '</div><div>' + select('Intensidade','intensity',[['leve','Leve'],['moderada','Moderada'],['intensa','Intensa']]) + '</div></div>';
    }
    return '<div class="kdw-section-title">Resposta do corpo</div><div class="kdw-chips">' +
      chip('appetite','baixa','Pouca fome') + chip('appetite','normal','Fome normal') + chip('appetite','alta','Muita fome') +
      '</div><div class="kdw-grid2"><div>' + select('Sono','sleep',[['ruim','Ruim'],['medio','Médio'],['bom','Bom']]) + '</div><div>' + select('Estresse','stress',[['baixo','Baixo'],['medio','Médio'],['alto','Alto']]) + '</div></div><div class="kdw-chips">' + chip('adherence','baixa','Baixa adesão') + chip('adherence','media','Adesão média') + chip('adherence','alta','Alta adesão') + '</div>';
  }

  function installStyles() {
    if ($('kdwStyles')) return;
    var st = document.createElement('style');
    st.id = 'kdwStyles';
    st.textContent = '.kdw-screen,.kdw-screen *{box-sizing:border-box}.kdw-screen{position:fixed;inset:0;z-index:14000;background:#07090f;color:#fff;font-family:Inter,DM Sans,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}.kdw-head{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090f}.kdw-top{display:flex;gap:12px;align-items:center}.kdw-back{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px}.kdw-badge{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#22c55e}.kdw-title{font-size:24px;font-weight:950;letter-spacing:-.05em;line-height:1.05}.kdw-sub{font-size:13px;color:rgba(255,255,255,.62);line-height:1.45;margin-top:4px}.kdw-bar{height:4px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:14px;overflow:hidden}.kdw-fill{height:100%;background:linear-gradient(90deg,#16a34a,#22c55e,#a3e635);border-radius:999px;transition:width .25s}.kdw-body{flex:1;overflow:auto;padding:18px 16px 118px;-webkit-overflow-scrolling:touch}.kdw-card{border:1px solid rgba(34,197,94,.20);background:linear-gradient(180deg,rgba(34,197,94,.10),rgba(255,255,255,.035));border-radius:24px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.35)}.kdw-card.mini{margin-top:14px;border-radius:18px;padding:14px}.kdw-section-title{font-size:14px;font-weight:900;color:#fff;margin:2px 0 10px}.kdw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kdw-label{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65);margin:12px 0 6px}.kdw-input{width:100%;height:48px;border-radius:14px;border:1px solid rgba(255,255,255,.11);background:#101722;color:#fff;padding:0 12px;font-size:16px;outline:none}.kdw-chips{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 12px}.kdw-chip{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:11px 13px;font-weight:800;font-size:13px}.kdw-chip.active{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.55);color:#4ade80}.kdw-foot{position:fixed;left:0;right:0;bottom:0;z-index:14001;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,9,15,0),#07090f 22%,#07090f)}.kdw-next{width:100%;height:56px;border:0;border-radius:18px;background:#22c55e;color:#06110a;font-weight:950;font-size:16px;box-shadow:0 0 28px rgba(34,197,94,.28)}.kdw-secondary{width:100%;height:46px;margin-top:10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-weight:850}@media(max-width:360px){.kdw-grid2{grid-template-columns:1fr}.kdw-title{font-size:21px}}';
    document.head.appendChild(st);
  }

  function bindChips(root, state) {
    root.querySelectorAll('.kdw-chip').forEach(function (btn) {
      btn.onclick = function () {
        var group = btn.dataset.group;
        var multi = btn.dataset.multi === '1';
        if (!multi) root.querySelectorAll('.kdw-chip[data-group="' + group + '"]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.toggle('active');
      };
    });
  }

  function collectStep(state) {
    var data = {};
    var screen = $(SCREEN_ID);
    if (!screen) return data;
    screen.querySelectorAll('input,select').forEach(function (el) { data[el.name] = el.type === 'number' ? num(el.value) : el.value; });
    var groups = {};
    screen.querySelectorAll('.kdw-chip.active').forEach(function (b) {
      var g = b.dataset.group, v = b.dataset.value;
      if (b.dataset.multi === '1') { if (!groups[g]) groups[g] = []; groups[g].push(v); }
      else groups[g] = v;
    });
    Object.keys(groups).forEach(function (k) { data[k] = groups[k]; });
    return data;
  }

  function validate(state, data) {
    var key = steps[state.current].key;
    if (key === 'body') {
      if (!data.age || data.age < 14) return 'Informe uma idade válida.';
      if (!data.weight_kg || data.weight_kg < 35) return 'Informe o peso.';
      if (!data.height_cm || data.height_cm < 100) return 'Informe a altura.';
    }
    if (key === 'goal' && !data.objective) return 'Selecione o objetivo.';
    return null;
  }

  async function submit(state) {
    var payload = Object.assign({}, state.data.body || {}, state.data.goal || {}, state.data.health || {}, state.data.food || {}, state.data.training || {}, state.data.metabolism || {}, {
      dietWizardFlow: state,
      source: 'diet_wizard_standalone',
      objetivo: state.data.goal && state.data.goal.objective,
      objective: state.data.goal && state.data.goal.objective,
      sexo: state.data.body && state.data.body.sex,
      idade: state.data.body && state.data.body.age,
      peso: state.data.body && state.data.body.weight_kg,
      altura: state.data.body && state.data.body.height_cm,
      refeicoesPorDia: state.data.goal && state.data.goal.meals,
      patologias: state.data.health && state.data.health.pathologies,
      modalidades: state.data.training && state.data.training.modalities
    });

    closeDietProfileWizard();
    try {
      if (typeof window.openNutritionFlowFull === 'function') return window.openNutritionFlowFull({ autoGenerate: true, source: 'diet_wizard_standalone', dietWizardPayload: payload });
      var res = await fetch('/api/kronia/diet/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      var json = await res.json().catch(function () { return null; });
      try { localStorage.setItem('kronia_last_generated_diet', JSON.stringify(json || payload)); } catch (_) {}
      if (typeof window.navTo === 'function') window.navTo('dieta');
      if (typeof window.renderDietFromPlan === 'function') return window.renderDietFromPlan(json);
      if (typeof window.showToast === 'function') window.showToast('Dieta enviada para geração.', 'success', 3000);
    } catch (err) {
      console.error('[diet-standalone] submit error', err);
      if (typeof window.showToast === 'function') window.showToast('Erro ao gerar dieta. Tente novamente.', 'error', 4000);
    }
  }

  function render(state) {
    installStyles();
    var old = $(SCREEN_ID); if (old) old.remove();
    var s = steps[state.current];
    var percent = Math.round(((state.current + 1) / steps.length) * 100);
    var screen = document.createElement('div');
    screen.id = SCREEN_ID;
    screen.className = 'kdw-screen';
    screen.innerHTML = '<div class="kdw-head"><div class="kdw-top"><button class="kdw-back" id="kdwBack">‹</button><div style="min-width:0;flex:1"><div class="kdw-badge">' + esc(s.badge) + ' · ' + (state.current + 1) + '/' + steps.length + '</div><div class="kdw-title">' + esc(s.title) + '</div><div class="kdw-sub">' + esc(s.sub) + '</div></div></div><div class="kdw-bar"><div class="kdw-fill" style="width:' + percent + '%"></div></div></div><div class="kdw-body"><div class="kdw-card">' + renderStepHtml(state) + '</div></div><div class="kdw-foot"><button class="kdw-next" id="kdwNext">' + (state.current === steps.length - 1 ? 'Gerar dieta premium' : 'Continuar') + '</button><button class="kdw-secondary" id="kdwClose">Fechar</button></div>';
    document.body.appendChild(screen);
    document.body.classList.add('diet-wizard-active');
    bindChips(screen, state);

    $('kdwBack').onclick = function () { if (state.current > 0) { state.current -= 1; saveState(state); render(state); } else closeDietProfileWizard(); };
    $('kdwClose').onclick = closeDietProfileWizard;
    $('kdwNext').onclick = function () {
      var data = collectStep(state);
      var err = validate(state, data);
      if (err) { if (typeof window.showToast === 'function') window.showToast(err, 'warning', 3000); else alert(err); return; }
      state.data[steps[state.current].key] = data;
      if (state.current < steps.length - 1) { state.current += 1; saveState(state); render(state); return; }
      state.completedAt = new Date().toISOString();
      saveState(state);
      submit(state);
    };
  }

  function openDietProfileWizard(userId, opts) {
    var state = readState(userId, opts && opts.forceNew);
    render(state);
    return true;
  }

  function closeDietProfileWizard() {
    var screen = $(SCREEN_ID);
    if (screen) screen.remove();
    document.body.classList.remove('diet-wizard-active');
  }

  window.openDietProfileWizard = openDietProfileWizard;
  window.closeDietProfileWizard = closeDietProfileWizard;
  window.__kroniaDietWizardStandaloneLoaded = true;
})();
