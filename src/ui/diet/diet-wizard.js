/* KroniA Diet Wizard Compatibility — fallback V3 funcional de 6 passos */
(function(root) {
  'use strict';

  var SCREEN_ID = 'dietProfileWizardScreen';
  var PROFILE_KEY = 'kronia_diet_anamnese_profile';
  var NUTRITION_KEY = 'kronia_nutrition_profile_v1';
  var step = 0;
  var data = {};
  var optionsRef = {};

  var STEPS = [
    ['Identidade e objetivo', 'Dados corporais e meta principal.'],
    ['Treino e gasto', 'Rotina, atividade e gasto energético.'],
    ['Perfil clínico', 'Condições que mudam a estratégia.'],
    ['Comportamento alimentar', 'Aderência, fome e rotina.'],
    ['Estratégia nutricional', 'Preferências, refeições e estilo.'],
    ['Resumo inteligente', 'Revise antes de gerar o plano.']
  ];

  function $(id) { return root.document && root.document.getElementById(id); }
  function n(v) { var x = Number(String(v || '').replace(',', '.')); return Number.isFinite(x) ? x : 0; }
  function list(v) { return String(v || '').split(/[,;\n]+/).map(function(x){return x.trim();}).filter(Boolean); }
  function esc(v) { return String(v || '').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function cleanupLegacyOverlay() {
    ['dietProfileWizardScreen', 'kroniaForcedDietAnamnese'].forEach(function(id) {
      var el = $(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (root.document && root.document.body) {
      root.document.body.classList.remove('diet-wizard-active', 'kdw-active', 'nutrition-flow-active', 'overlay-open');
    }
  }

  function bmr() {
    if (!n(data.peso) || !n(data.altura) || !n(data.idade)) return 0;
    return Math.round((10 * n(data.peso)) + (6.25 * n(data.altura)) - (5 * n(data.idade)) + (data.sexo === 'feminino' ? -161 : 5));
  }

  function tdee() {
    var base = bmr();
    if (!base) return 0;
    var factor = ({ sedentario:1.2, leve:1.375, moderado:1.55, intenso:1.725, atleta:1.9 })[data.nivelAtividade || 'moderado'] || 1.55;
    return Math.round(base * factor + (n(data.passosDia) >= 8000 ? 80 : 0));
  }

  function targetKcal() {
    var total = tdee();
    if (!total) return 0;
    var goal = data.objetivo || 'hipertrofia';
    var delta = goal === 'emagrecimento' ? -450 : goal === 'recomposicao' ? -150 : goal === 'hipertrofia' ? 280 : 0;
    return Math.max(1200, Math.round(total + delta));
  }

  function macros() {
    var kcal = targetKcal();
    if (!kcal) return { kcal: 0, p: 0, c: 0, g: 0 };
    var renal = /renal|hemod/i.test(String(data.condicoes || ''));
    var protein = Math.round((n(data.peso) || 75) * (renal ? 1.0 : 1.9));
    var fat = Math.round((kcal * 0.25) / 9);
    var carb = Math.max(60, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal: kcal, p: protein, c: carb, g: fat };
  }

  function strategy() {
    var cond = String(data.condicoes || '').toLowerCase();
    if (/renal|hemod/.test(cond)) return 'Renal adaptada';
    if (/diabetes|glicemia/.test(cond)) return 'Controle glicêmico';
    if (data.estrategia && data.estrategia !== 'auto') return data.estrategia;
    if (data.objetivo === 'emagrecimento') return 'Cutting flexível';
    if (data.objetivo === 'recomposicao') return 'Recomposição high protein';
    return 'High protein clean bulk';
  }

  function field(id, label, type, ph) {
    return '<label>' + label + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(data[id] || '') + '" placeholder="' + esc(ph || '') + '"></label>';
  }

  function select(id, label, opts, def) {
    var val = data[id] || def || (opts[0] && opts[0][0]);
    return '<label>' + label + '<select id="' + id + '">' + opts.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }

  function area(id, label, ph) {
    return '<label class="wide">' + label + '<textarea id="' + id + '" rows="3" placeholder="' + esc(ph || '') + '">' + esc(data[id] || '') + '</textarea></label>';
  }

  function bodyHtml() {
    if (step === 0) return '<div class="kdw-grid">' +
      field('nome','Nome','text','Kleber') +
      select('sexo','Sexo', [['masculino','Masculino'],['feminino','Feminino']], 'masculino') +
      field('idade','Idade','number','30') + field('peso','Peso atual kg','number','80') +
      field('altura','Altura cm','number','175') + field('pesoMeta','Peso meta kg','number','85') +
      select('objetivo','Objetivo', [['hipertrofia','Hipertrofia'],['emagrecimento','Emagrecimento'],['recomposicao','Recomposição'],['performance','Performance'],['saude','Saúde']], 'hipertrofia') +
      select('prazo','Prazo', [['sem_pressa','Sem pressa'],['8_12','8–12 semanas'],['3_6','3–6 meses']], '3_6') +
      '</div><div class="kdw-insight">Metabolismo estimado: <strong>' + (bmr() || '--') + ' kcal</strong></div>';

    if (step === 1) return '<div class="kdw-grid">' +
      select('nivelAtividade','Atividade', [['sedentario','Sedentário'],['leve','Leve'],['moderado','Moderado'],['intenso','Intenso'],['atleta','Atleta']], 'moderado') +
      field('passosDia','Passos/dia','number','7000') +
      select('freqTreino','Treinos/semana', [['0','0'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6']], '4') +
      select('duracaoTreino','Duração', [['30','30 min'],['45','45 min'],['60','60 min'],['90','90 min+']], '60') +
      select('cardio','Cardio', [['nao','Não'],['1_2','1–2x'],['3_4','3–4x'],['5mais','5x+']], 'nao') +
      select('energia','Energia', [['baixa','Baixa'],['media','Média'],['alta','Alta']], 'media') +
      area('profissaoRotina','Rotina/profissão','Trabalho sentado, plantões, horários...') + '</div>';

    if (step === 2) return '<p class="kdw-help">Informe condições relevantes. O KRONIA usa isso para alertas e ajustes.</p><div class="kdw-grid">' +
      area('condicoes','Condições clínicas','Hipertensão, diabetes, doença renal, gastrite...') +
      select('trt','TRT/hormônios', [['nao','Não'],['sim','Sim'],['avaliando','Avaliando']], 'nao') +
      select('medicamentos','Medicações', [['nao','Não'],['sim','Sim']], 'nao') +
      select('retencao','Retenção', [['nao','Não'],['leve','Leve'],['moderada','Moderada'],['alta','Alta']], 'nao') +
      select('exames','Exames recentes', [['nao','Não'],['sim','Sim'],['alterados','Alterados']], 'nao') +
      area('dadosClinicos','Exames/dados clínicos','Creatinina, HbA1c, colesterol, potássio...') + '</div>';

    if (step === 3) return '<div class="kdw-grid">' +
      select('fomeNoturna','Fome noturna', [['nao','Não'],['sim','Sim']], 'nao') +
      select('compulsao','Compulsão/beliscar', [['nao','Não'],['leve','Leve'],['sim','Sim']], 'nao') +
      select('cozinha','Você cozinha?', [['sim','Sim'],['as_vezes','Às vezes'],['nao','Não']], 'sim') +
      select('delivery','Delivery/come fora', [['raro','Raro'],['2_3','2–3x/sem'],['frequente','Frequente']], '2_3') +
      select('orcamento','Orçamento', [['baixo','Econômico'],['medio','Médio'],['alto','Flexível']], 'medio') +
      select('dificuldade','Maior dificuldade', [['tempo','Tempo'],['fome','Fome'],['ansiedade','Ansiedade'],['organizacao','Organização'],['sabor','Sabor']], 'organizacao') + '</div>';

    if (step === 4) return '<div class="kdw-grid">' +
      select('refeicoesPorDia','Refeições/dia', [['3','3'],['4','4'],['5','5'],['6','6']], '4') +
      select('estrategia','Estratégia', [['auto','IA escolhe'],['High protein','High protein'],['Low carb','Low carb'],['Mediterrânea','Mediterrânea'],['Clean bulk','Clean bulk'],['Marmitas simples','Marmitas simples']], 'auto') +
      select('estiloRefeicao','Estilo', [['simples','Simples'],['rapida','Rápida'],['marmita','Marmita'],['gourmet','Gourmet'],['economica','Econômica']], 'simples') +
      select('padraoAlimentar','Padrão', [['onivoro','Onívoro'],['vegetariano','Vegetariano'],['low_carb','Low carb'],['flexivel','Flexível']], 'onivoro') +
      area('preferencias','Alimentos favoritos','Frango, ovos, arroz, feijão...') +
      area('alimentosEvitar','Alimentos que evita','Peixe, leite, alimentos caros...') + '</div>';

    var m = macros();
    return '<div class="kdw-summary">' +
      '<div><span>Metabolismo basal</span><b>' + (bmr() || '--') + ' kcal</b></div>' +
      '<div><span>Gasto total</span><b>' + (tdee() || '--') + ' kcal</b></div>' +
      '<div><span>Meta calórica</span><b>' + m.kcal + ' kcal</b></div>' +
      '<div><span>Proteína</span><b>' + m.p + ' g</b></div>' +
      '<div><span>Carboidratos</span><b>' + m.c + ' g</b></div>' +
      '<div><span>Gorduras</span><b>' + m.g + ' g</b></div>' +
      '<div><span>Estratégia</span><b>' + esc(strategy()) + '</b></div>' +
      '</div><p class="kdw-alert">A dieta é apoio educacional e não substitui nutricionista, especialmente em doença renal, diabetes, gestação, câncer ou uso de insulina.</p>';
  }

  function injectStyle() {
    if ($('kdwCompatV3Style')) return;
    var st = root.document.createElement('style');
    st.id = 'kdwCompatV3Style';
    st.textContent = '.kdw-screen{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.82);display:flex;align-items:flex-end;justify-content:center}.kdw-card{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#020617;color:#fff;border:1px solid rgba(34,197,94,.38);border-radius:30px 30px 0 0;padding:22px;box-shadow:0 -20px 70px rgba(0,0,0,.55)}.kdw-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:24px}.kdw-card{position:relative}.kdw-kicker{color:#22c55e;text-transform:uppercase;letter-spacing:.13em;font-weight:900;font-size:11px}.kdw-card h2{font-size:27px;margin:8px 46px 6px 0}.kdw-text{color:#a1a1aa;margin:0 0 12px}.kdw-bar{height:6px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin:12px 0}.kdw-bar span{display:block;height:100%;background:#22c55e}.kdw-meta{display:flex;justify-content:space-between;color:#94a3b8;font-size:12px;font-weight:800}.kdw-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.kdw-grid .wide{grid-column:1/-1}.kdw-card label{display:block;font-size:13px;font-weight:800;color:#e5e7eb;margin-top:10px}.kdw-card input,.kdw-card select,.kdw-card textarea{width:100%;box-sizing:border-box;margin-top:6px;background:#0f172a;color:#fff;border:1px solid rgba(148,163,184,.38);border-radius:15px;padding:13px;font:inherit}.kdw-footer{display:flex;gap:10px;margin-top:16px}.kdw-btn{flex:1;border:0;border-radius:17px;padding:15px;font-weight:900}.kdw-back{background:rgba(255,255,255,.08);color:#fff}.kdw-next{background:#22c55e;color:#03130a}.kdw-insight,.kdw-alert{margin-top:14px;padding:12px;border-radius:14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.22);color:#bbf7d0}.kdw-alert{background:rgba(245,158,11,.09);border-color:rgba(245,158,11,.25);color:#fde68a;font-size:12px}.kdw-help{color:#a1a1aa;font-size:13px}.kdw-summary{display:grid;gap:10px}.kdw-summary div{display:flex;justify-content:space-between;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:13px}.kdw-summary span{color:#94a3b8}@media(max-width:430px){.kdw-grid{grid-template-columns:1fr}.kdw-card{padding:22px 18px}.kdw-footer{position:sticky;bottom:calc(env(safe-area-inset-bottom, 0px) + 16px);background:#020617;padding-top:12px}}';
    root.document.head.appendChild(st);
  }

  function collect() {
    var screen = $(SCREEN_ID);
    if (!screen) return;
    screen.querySelectorAll('input,select,textarea').forEach(function(el){ data[el.id] = el.value; });
  }

  function render() {
    var screen = $(SCREEN_ID);
    if (!screen) return;
    var pct = Math.round(((step + 1) / STEPS.length) * 100);
    screen.querySelector('.kdw-title').textContent = STEPS[step][0];
    screen.querySelector('.kdw-text').textContent = STEPS[step][1];
    screen.querySelector('.kdw-current').textContent = 'Passo ' + (step + 1) + ' de 6';
    screen.querySelector('.kdw-bar span').style.width = pct + '%';
    screen.querySelector('.kdw-body').innerHTML = bodyHtml();
    screen.querySelector('.kdw-back').style.visibility = step === 0 ? 'hidden' : 'visible';
    screen.querySelector('.kdw-next').textContent = step === 5 ? 'Gerar plano com IA' : 'Continuar';
  }

  function finish() {
    var m = macros();
    var payload = Object.assign({}, data, {
      goal: data.objetivo,
      objetivo: data.objetivo,
      idade: n(data.idade), peso: n(data.peso), altura: n(data.altura),
      refeicoesPorDia: n(data.refeicoesPorDia) || 4,
      nivelAtividade: data.nivelAtividade || 'moderado', rotina: data.nivelAtividade || 'moderado',
      preferencias: list(data.preferencias), preferenciasAlimentares: list(data.preferencias),
      alimentosEvitar: list(data.alimentosEvitar), alimentosQueEvita: list(data.alimentosEvitar),
      restricoes: list(data.condicoes), restricoesAlimentares: list(data.condicoes), patologias: list(data.condicoes),
      metabolicPreview: { bmr: bmr(), tdee: tdee(), targetCalories: targetKcal(), macros: m },
      nutritionGoals: { kcal: m.kcal, protein: m.p, carbs: m.c, fat: m.g },
      strategy: strategy(), source: 'diet_wizard_compat_v3_6_steps', personalizationReady: true, updatedAt: new Date().toISOString()
    });
    payload.profile = Object.assign({}, payload);
    payload.dietWizardPayload = Object.assign({}, payload);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(payload)); localStorage.setItem(NUTRITION_KEY, JSON.stringify(payload)); } catch(e) {}
    cleanupLegacyOverlay();
    if (typeof optionsRef.onComplete === 'function') return optionsRef.onComplete(payload);
    if (typeof optionsRef.onFinish === 'function') return optionsRef.onFinish(payload);
    if (typeof optionsRef.onSubmit === 'function') return optionsRef.onSubmit(payload);
    return true;
  }

  function openDietProfileWizard(options) {
    cleanupLegacyOverlay();
    optionsRef = options || {};
    step = 0;
    data = { sexo:'masculino', objetivo:'hipertrofia', nivelAtividade:'moderado', freqTreino:'4', refeicoesPorDia:'4', estrategia:'auto' };
    injectStyle();
    var s = root.document.createElement('div');
    s.id = SCREEN_ID;
    s.className = 'kdw-screen';
    s.innerHTML = '<section class="kdw-card app-scroll"><button class="kdw-close" type="button">×</button><p class="kdw-kicker">KroniA Nutrition Engine V3</p><h2 class="kdw-title"></h2><p class="kdw-text"></p><div class="kdw-meta"><span class="kdw-current"></span><span>PREMIUM</span></div><div class="kdw-bar"><span></span></div><div class="kdw-body"></div><div class="kdw-footer"><button class="kdw-btn kdw-back" type="button">Voltar</button><button class="kdw-btn kdw-next" type="button">Continuar</button></div></section>';
    root.document.body.appendChild(s);
    root.document.body.classList.add('diet-wizard-active', 'overlay-open');
    s.querySelector('.kdw-close').onclick = cleanupLegacyOverlay;
    s.querySelector('.kdw-back').onclick = function(){ collect(); step = Math.max(0, step - 1); render(); };
    s.querySelector('.kdw-next').onclick = function(){ collect(); if (step === 0 && (!n(data.idade) || !n(data.peso) || !n(data.altura))) { try { root.showToast('Preencha idade, peso e altura.', 'warning', 3000); } catch(e) {} return; } if (step >= 5) return finish(); step += 1; render(); };
    render();
    return true;
  }

  root.openDietProfileWizard = openDietProfileWizard;
  root.openDietWizardStandalone = openDietProfileWizard;
  root.openNutritionWizard = openDietProfileWizard;
  root.openDietWizard = openDietProfileWizard;
  root.openDietGenerationWizard = openDietProfileWizard;
  root.openDietSetupWizard = openDietProfileWizard;
  root.closeDietProfileWizard = cleanupLegacyOverlay;
  root.__kroniaDietWizardCompatibilityLoaded = true;
})(window);
