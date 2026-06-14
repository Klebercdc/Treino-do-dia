/* KroniA Diet Wizard Standalone — Nutrition Onboarding V3
 * Wizard premium de 6 passos com lógica clínica, aderência e estratégia nutricional.
 */
(function(root) {
  'use strict';

  var SCREEN_ID = 'dietProfileWizardScreen';
  var PROFILE_KEY = 'kronia_diet_anamnese_profile';
  var PROFILE_KEY_V1 = 'kronia_nutrition_profile_v1';
  var DRAFT_KEY = 'kronia_nutrition_onboarding_v3_draft';

  var state = {
    step: 0,
    data: {},
    options: {}
  };

  var steps = [
    { key: 'identity', title: 'Identidade e objetivo', subtitle: 'Dados essenciais para estimar metabolismo e direção da dieta.' },
    { key: 'training', title: 'Treino e gasto', subtitle: 'Rotina, atividade e treino para calcular gasto real.' },
    { key: 'clinical', title: 'Perfil clínico', subtitle: 'Alertas que mudam a estratégia nutricional com segurança.' },
    { key: 'behavior', title: 'Comportamento alimentar', subtitle: 'A dieta precisa caber na sua vida para funcionar.' },
    { key: 'strategy', title: 'Estratégia nutricional', subtitle: 'Preferências, estilo de dieta e praticidade.' },
    { key: 'summary', title: 'Resumo inteligente', subtitle: 'Revise a estratégia antes de gerar o plano.' }
  ];

  function safeToast(message, type, duration) {
    try {
      if (typeof root.showToast === 'function') root.showToast(message, type || 'info', duration || 3000);
    } catch (_) {}
  }

  function cleanupLegacyOverlay() {
    var screen = root.document && root.document.getElementById(SCREEN_ID);
    if (screen && screen.parentNode) screen.parentNode.removeChild(screen);

    try {
      ['kronia_diet_wizard_state_v1', 'kronia_diet_wizard_state_v2', 'kronia_diet_wizard_state_v6_standalone'].forEach(function(k) {
        root.localStorage && root.localStorage.removeItem(k);
      });
    } catch (_) {}

    if (root.document && root.document.body) {
      root.document.body.classList.remove('diet-wizard-active', 'kdw-active', 'nutrition-flow-active', 'overlay-open');
    }
  }

  function readJson(key) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveDraft() {
    try {
      root.localStorage && root.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: state.step, data: state.data, updatedAt: new Date().toISOString() }));
    } catch (_) {}
  }

  function numberValue(value) {
    if (value === undefined || value === null || value === '') return null;
    var parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function listValue(value) {
    if (Array.isArray(value)) return value.map(String).map(function(v) { return v.trim(); }).filter(Boolean);
    return String(value || '').split(/[,;\n]+/).map(function(v) { return v.trim(); }).filter(Boolean);
  }

  function setData(key, value) {
    state.data[key] = value;
    saveDraft();
    updateLiveSummary();
  }

  function getData(key, fallback) {
    var value = state.data[key];
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  function mifflin() {
    var sexo = getData('sexo', 'masculino');
    var peso = numberValue(getData('peso')) || 0;
    var altura = numberValue(getData('altura')) || 0;
    var idade = numberValue(getData('idade')) || 0;
    if (!peso || !altura || !idade) return null;
    return Math.round((10 * peso) + (6.25 * altura) - (5 * idade) + (sexo === 'feminino' ? -161 : 5));
  }

  function activityFactor() {
    var level = getData('nivelAtividade', 'moderado');
    return ({ sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725, atleta: 1.9 })[level] || 1.55;
  }

  function tdee() {
    var bmr = mifflin();
    if (!bmr) return null;
    var steps = numberValue(getData('passosDia')) || 0;
    var extra = steps >= 10000 ? 120 : steps >= 7000 ? 70 : 0;
    return Math.round((bmr * activityFactor()) + extra);
  }

  function targetCalories() {
    var total = tdee();
    if (!total) return null;
    var goal = getData('objetivo', 'hipertrofia');
    var delta = goal === 'emagrecimento' ? -450 : goal === 'recomposicao' ? -150 : goal === 'hipertrofia' ? 280 : 0;
    return Math.max(1200, Math.round(total + delta));
  }

  function macroPreview() {
    var kcal = targetCalories();
    var peso = numberValue(getData('peso')) || 75;
    if (!kcal) return null;
    var goal = getData('objetivo', 'hipertrofia');
    var renal = listValue(getData('condicoes')).some(function(v) { return /renal|hemod/i.test(v); });
    var proteinKg = renal ? 1.0 : goal === 'hipertrofia' ? 2.0 : 1.8;
    var protein = Math.round(peso * proteinKg);
    var fat = Math.round((kcal * 0.25) / 9);
    var carbs = Math.max(60, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal: kcal, protein: protein, carbs: carbs, fat: fat };
  }

  function adherenceScore() {
    var score = 80;
    if (getData('cozinha', 'sim') === 'nao') score -= 10;
    if (getData('fomeNoturna', 'nao') === 'sim') score -= 10;
    if (getData('compulsao', 'nao') === 'sim') score -= 15;
    if (getData('orcamento', 'medio') === 'baixo') score -= 5;
    return Math.max(35, Math.min(95, score));
  }

  function selectedStrategy() {
    var condicoes = listValue(getData('condicoes')).join(' ').toLowerCase();
    var goal = getData('objetivo', 'hipertrofia');
    var style = getData('estrategia', 'auto');
    if (/renal|hemod/.test(condicoes)) return 'Renal adaptada';
    if (/diabetes|glicemia/.test(condicoes)) return 'Controle glicêmico';
    if (style !== 'auto') return style;
    if (goal === 'hipertrofia') return 'High protein clean bulk';
    if (goal === 'emagrecimento') return 'Cutting flexível';
    if (goal === 'recomposicao') return 'Recomposição high protein';
    return 'Manutenção inteligente';
  }

  function createInput(id, label, type, placeholder, value) {
    return '<label>' + label + '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="' + (placeholder || '') + '" value="' + escapeHtml(value || '') + '"></label>';
  }

  function createSelect(id, label, options, value) {
    return '<label>' + label + '<select id="' + id + '">' + options.map(function(opt) {
      var val = Array.isArray(opt) ? opt[0] : opt;
      var txt = Array.isArray(opt) ? opt[1] : opt;
      return '<option value="' + escapeHtml(val) + '"' + (String(value || '') === String(val) ? ' selected' : '') + '>' + escapeHtml(txt) + '</option>';
    }).join('') + '</select></label>';
  }

  function createTextarea(id, label, placeholder, value) {
    return '<label>' + label + '<textarea id="' + id + '" rows="3" placeholder="' + escapeHtml(placeholder || '') + '">' + escapeHtml(value || '') + '</textarea></label>';
  }

  function escapeHtml(v) {
    return String(v || '').replace(/[&<>"']/g, function(c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function stepHtml() {
    var d = state.data;
    if (state.step === 0) {
      return '<div class="kdw-grid">' +
        createInput('nome', 'Nome', 'text', 'Kleber', getData('nome', '')) +
        createSelect('sexo', 'Sexo', [['masculino','Masculino'],['feminino','Feminino']], getData('sexo','masculino')) +
        createInput('idade', 'Idade', 'number', '30', getData('idade','')) +
        createInput('peso', 'Peso atual (kg)', 'number', '80', getData('peso','')) +
        createInput('altura', 'Altura (cm)', 'number', '175', getData('altura','')) +
        createInput('pesoMeta', 'Peso meta (kg)', 'number', '85', getData('pesoMeta','')) +
        createSelect('objetivo', 'Objetivo principal', [['hipertrofia','Hipertrofia'],['emagrecimento','Emagrecimento'],['recomposicao','Recomposição corporal'],['performance','Performance'],['saude','Saúde/metabólico']], getData('objetivo','hipertrofia')) +
        createSelect('prazo', 'Prazo desejado', [['sem_pressa','Sem pressa'],['8_12_sem','8–12 semanas'],['3_6_meses','3–6 meses'],['longo_prazo','Longo prazo']], getData('prazo','3_6_meses')) +
      '</div><div class="kdw-insight" id="kdwLiveSummary"></div>';
    }

    if (state.step === 1) {
      return '<div class="kdw-grid">' +
        createSelect('nivelAtividade', 'Nível de atividade', [['sedentario','Sedentário'],['leve','Leve'],['moderado','Moderado'],['intenso','Intenso'],['atleta','Atleta']], getData('nivelAtividade','moderado')) +
        createInput('passosDia', 'Passos/dia', 'number', '7000', getData('passosDia','')) +
        createSelect('freqTreino', 'Treinos/semana', [['0','0'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6']], getData('freqTreino','4')) +
        createSelect('duracaoTreino', 'Duração treino', [['30','30 min'],['45','45 min'],['60','60 min'],['90','90 min+']], getData('duracaoTreino','60')) +
        createSelect('cardio', 'Cardio', [['nao','Não faço'],['1_2','1–2x/sem'],['3_4','3–4x/sem'],['5mais','5x+']], getData('cardio','nao')) +
        createSelect('energia', 'Energia diária', [['baixa','Baixa'],['media','Média'],['alta','Alta']], getData('energia','media')) +
      '</div>' + createTextarea('profissaoRotina', 'Profissão/rotina', 'Ex: trabalho sentado, turnos, plantões, rotina corrida...', getData('profissaoRotina','')) +
      '<div class="kdw-insight" id="kdwLiveSummary"></div>';
    }

    if (state.step === 2) {
      return '<p class="kdw-help">Marque condições importantes. Se houver doença renal, diabetes, gestação, câncer ou uso de medicações críticas, o app deve agir com alerta profissional.</p>' +
        createTextarea('condicoes', 'Condições clínicas', 'Ex: hipertensão, diabetes, doença renal, gastrite, dislipidemia...', getData('condicoes','')) +
        '<div class="kdw-grid">' +
          createSelect('trt', 'TRT/hormônios', [['nao','Não'],['sim','Sim'],['avaliando','Avaliando']], getData('trt','nao')) +
          createSelect('medicamentos', 'Usa medicações?', [['nao','Não'],['sim','Sim']], getData('medicamentos','nao')) +
          createSelect('retencao', 'Retenção hídrica', [['nao','Não'],['leve','Leve'],['moderada','Moderada'],['alta','Alta']], getData('retencao','nao')) +
          createSelect('exames', 'Exames recentes?', [['nao','Não'],['sim','Sim'],['alterados','Sim, alterados']], getData('exames','nao')) +
        '</div>' +
        createTextarea('dadosClinicos', 'Dados clínicos/exames', 'Ex: creatinina, HbA1c, colesterol, TGO/TGP, potássio, fósforo...', getData('dadosClinicos',''));
    }

    if (state.step === 3) {
      return '<div class="kdw-grid">' +
        createSelect('fomeNoturna', 'Fome noturna', [['nao','Não'],['sim','Sim']], getData('fomeNoturna','nao')) +
        createSelect('compulsao', 'Compulsão/beliscar', [['nao','Não'],['leve','Leve'],['sim','Sim']], getData('compulsao','nao')) +
        createSelect('cozinha', 'Você cozinha?', [['sim','Sim'],['as_vezes','Às vezes'],['nao','Não']], getData('cozinha','sim')) +
        createSelect('delivery', 'Come fora/delivery', [['raro','Raro'],['2_3x','2–3x/sem'],['frequente','Frequente']], getData('delivery','2_3x')) +
        createSelect('orcamento', 'Orçamento', [['baixo','Econômico'],['medio','Médio'],['alto','Flexível']], getData('orcamento','medio')) +
        createSelect('dificuldade', 'Maior dificuldade', [['tempo','Tempo'],['fome','Fome'],['ansiedade','Ansiedade'],['organizacao','Organização'],['sabor','Sabor']], getData('dificuldade','organizacao')) +
      '</div><div class="kdw-insight">Score de aderência estimado: <strong>' + adherenceScore() + '%</strong></div>';
    }

    if (state.step === 4) {
      return '<div class="kdw-grid">' +
        createSelect('refeicoesPorDia', 'Refeições/dia', [['3','3'],['4','4'],['5','5'],['6','6']], getData('refeicoesPorDia','4')) +
        createSelect('estrategia', 'Estratégia preferida', [['auto','IA escolhe'],['High protein','High protein'],['Low carb','Low carb'],['Mediterrânea','Mediterrânea'],['Clean bulk','Clean bulk'],['Cutting agressivo','Cutting agressivo'],['Marmitas simples','Marmitas simples']], getData('estrategia','auto')) +
        createSelect('estiloRefeicao', 'Estilo', [['simples','Simples'],['rapida','Rápida'],['marmita','Marmita'],['gourmet','Gourmet'],['economica','Econômica']], getData('estiloRefeicao','simples')) +
        createSelect('padraoAlimentar', 'Padrão alimentar', [['onivoro','Onívoro'],['vegetariano','Vegetariano'],['low_carb','Low carb'],['flexivel','Flexível']], getData('padraoAlimentar','onivoro')) +
      '</div>' +
      createTextarea('preferencias', 'Alimentos favoritos', 'Ex: frango, ovos, arroz, feijão, banana, iogurte...', getData('preferencias','')) +
      createTextarea('alimentosEvitar', 'Alimentos que evita', 'Ex: peixe, leite, brócolis, alimentos caros...', getData('alimentosEvitar',''));
    }

    var macros = macroPreview() || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return '<div class="kdw-summary-card">' +
      '<div><span>Metabolismo basal</span><strong>' + (mifflin() || '--') + ' kcal</strong></div>' +
      '<div><span>Gasto total estimado</span><strong>' + (tdee() || '--') + ' kcal</strong></div>' +
      '<div><span>Meta calórica</span><strong>' + macros.kcal + ' kcal</strong></div>' +
      '<div><span>Proteína</span><strong>' + macros.protein + ' g</strong></div>' +
      '<div><span>Carboidratos</span><strong>' + macros.carbs + ' g</strong></div>' +
      '<div><span>Gorduras</span><strong>' + macros.fat + ' g</strong></div>' +
      '<div><span>Estratégia</span><strong>' + selectedStrategy() + '</strong></div>' +
      '<div><span>Aderência</span><strong>' + adherenceScore() + '%</strong></div>' +
    '</div><p class="kdw-alert">A dieta é apoio educacional. Condições clínicas como doença renal, diabetes, gestação, câncer ou uso de insulina exigem acompanhamento profissional.</p>';
  }

  function injectStyles(doc) {
    if (doc.getElementById('kdwAnamneseStyle')) return;
    var style = doc.createElement('style');
    style.id = 'kdwAnamneseStyle';
    style.textContent = [
      '.kdw-anamnese-screen{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;font-family:inherit;background:rgba(0,0,0,.78);backdrop-filter:blur(10px)}',
      '.kdw-card{position:relative;width:100%;max-width:560px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#08111f,#020617);color:#fff;border:1px solid rgba(34,197,94,.38);border-radius:30px 30px 0 0;padding:22px;box-shadow:0 -20px 70px rgba(0,0,0,.55),0 0 36px rgba(34,197,94,.14);-webkit-overflow-scrolling:touch}',
      '.kdw-close{position:absolute;right:16px;top:14px;background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:999px;width:38px;height:38px;font-size:24px;cursor:pointer}',
      '.kdw-kicker{text-transform:uppercase;letter-spacing:.13em;color:#22c55e;font-weight:950;font-size:11px;margin:0 46px 8px 0}',
      '.kdw-card h2{font-size:28px;margin:0 46px 8px 0;line-height:1.05}',
      '.kdw-text{color:#a1a1aa;margin:0 0 14px;font-size:14px;line-height:1.45}',
      '.kdw-progress{height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:14px 0 16px}',
      '.kdw-progress span{display:block;height:100%;background:#22c55e;border-radius:999px;box-shadow:0 0 22px rgba(34,197,94,.55);transition:width .25s ease}',
      '.kdw-step-label{display:flex;justify-content:space-between;color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:10px}',
      '.kdw-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.kdw-card label{display:block;color:#e5e7eb;font-weight:850;margin:12px 0 8px;font-size:13px}',
      '.kdw-card select,.kdw-card textarea,.kdw-card input{width:100%;box-sizing:border-box;margin-top:7px;background:#0f172a;color:#fff;border:1px solid rgba(148,163,184,.38);border-radius:16px;padding:13px;font:inherit;outline:none}',
      '.kdw-card textarea{resize:vertical;min-height:76px}',
      '.kdw-card select:focus,.kdw-card textarea:focus,.kdw-card input:focus{border-color:rgba(34,197,94,.8);box-shadow:0 0 0 3px rgba(34,197,94,.12)}',
      '.kdw-footer{display:flex;gap:10px;margin-top:18px}',
      '.kdw-btn{flex:1;border:0;border-radius:18px;padding:15px;font-weight:950;font-size:15px;cursor:pointer}',
      '.kdw-back{background:rgba(255,255,255,.08);color:#fff}',
      '.kdw-next{background:#22c55e;color:#03130a;box-shadow:0 0 28px rgba(34,197,94,.35)}',
      '.kdw-insight{margin:14px 0 0;padding:13px;border-radius:16px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.22);color:#bbf7d0;font-size:13px;line-height:1.45}',
      '.kdw-help{margin:0 0 10px;color:#a1a1aa;font-size:13px;line-height:1.5}',
      '.kdw-alert{margin:14px 0 0;color:#fde68a;background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.25);border-radius:14px;padding:12px;font-size:12px;line-height:1.45}',
      '.kdw-summary-card{display:grid;gap:10px}',
      '.kdw-summary-card div{display:flex;justify-content:space-between;gap:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:13px}',
      '.kdw-summary-card span{color:#94a3b8;font-size:13px}.kdw-summary-card strong{color:#fff;font-size:14px;text-align:right}',
      '@media(max-width:430px){.kdw-card{padding:22px 18px}.kdw-grid{grid-template-columns:1fr}.kdw-card h2{font-size:25px}.kdw-footer{background:linear-gradient(180deg,rgba(2,6,23,0),#020617 30%);padding-top:14px;padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)}}'
    ].join('');
    doc.head.appendChild(style);
  }

  function bindStepInputs(screen) {
    screen.querySelectorAll('input,select,textarea').forEach(function(el) {
      el.addEventListener('input', function() {
        var value = el.value;
        if (['idade','peso','altura','pesoMeta','passosDia'].indexOf(el.id) >= 0) value = numberValue(value);
        setData(el.id, value);
      });
      el.addEventListener('change', function() {
        setData(el.id, el.value);
      });
    });
  }

  function collectCurrentStep(screen) {
    screen.querySelectorAll('input,select,textarea').forEach(function(el) {
      var value = el.value;
      if (['idade','peso','altura','pesoMeta','passosDia'].indexOf(el.id) >= 0) value = numberValue(value);
      setData(el.id, value);
    });
  }

  function validateStep() {
    if (state.step === 0) {
      var missing = [];
      if (!getData('sexo')) missing.push('sexo');
      if (!numberValue(getData('idade'))) missing.push('idade');
      if (!numberValue(getData('peso'))) missing.push('peso');
      if (!numberValue(getData('altura'))) missing.push('altura');
      if (!getData('objetivo')) missing.push('objetivo');
      if (missing.length) return 'Complete: ' + missing.join(', ') + '.';
    }
    return null;
  }

  function normalizePayload() {
    var d = state.data;
    var macros = macroPreview() || {};
    var payload = Object.assign({}, d, {
      goal: d.objetivo,
      objetivo: d.objetivo,
      sexo: d.sexo,
      idade: numberValue(d.idade),
      peso: numberValue(d.peso),
      altura: numberValue(d.altura),
      refeicoesPorDia: numberValue(d.refeicoesPorDia) || 4,
      nivelAtividade: d.nivelAtividade || 'moderado',
      rotina: d.nivelAtividade || 'moderado',
      preferencias: listValue(d.preferencias),
      preferenciasAlimentares: listValue(d.preferencias),
      alimentosEvitar: listValue(d.alimentosEvitar),
      alimentosQueEvita: listValue(d.alimentosEvitar),
      restricoes: listValue(d.condicoes).concat(listValue(d.restricoes)),
      restricoesAlimentares: listValue(d.condicoes).concat(listValue(d.restricoes)),
      patologias: listValue(d.condicoes),
      observacoes: [d.profissaoRotina, d.dadosClinicos, d.dificuldade].filter(Boolean).join(' | '),
      nutritionGoals: macros,
      metabolicPreview: { bmr: mifflin(), tdee: tdee(), targetCalories: targetCalories(), macros: macros },
      adherence: { score: adherenceScore(), cozinha: d.cozinha, fomeNoturna: d.fomeNoturna, compulsao: d.compulsao, orcamento: d.orcamento },
      clinicalData: { conditions: listValue(d.condicoes), trt: d.trt, medicamentos: d.medicamentos, exames: d.exames, dadosClinicos: d.dadosClinicos },
      strategy: selectedStrategy(),
      source: 'nutrition_onboarding_v3_6_steps',
      personalizationReady: true,
      updatedAt: new Date().toISOString()
    });
    payload.profile = Object.assign({}, payload);
    payload.dietWizardPayload = Object.assign({}, payload);
    return payload;
  }

  function finish(screen) {
    var payload = normalizePayload();
    try {
      root.localStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
      root.localStorage.setItem(PROFILE_KEY_V1, JSON.stringify(payload));
      root.localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}

    cleanupLegacyOverlay();
    var options = state.options || {};
    if (typeof options.onComplete === 'function') return options.onComplete(payload);
    if (typeof options.onFinish === 'function') return options.onFinish(payload);
    if (typeof options.onSubmit === 'function') return options.onSubmit(payload);
    safeToast('Anamnese concluída. Gerando sua dieta personalizada...', 'success', 3000);
    return true;
  }

  function updateLiveSummary() {
    var el = root.document && root.document.getElementById('kdwLiveSummary');
    if (!el) return;
    var bmr = mifflin();
    var total = tdee();
    var macros = macroPreview();
    if (!bmr) {
      el.innerHTML = 'Preencha idade, peso e altura para estimar metabolismo.';
      return;
    }
    el.innerHTML = 'Metabolismo basal: <strong>' + bmr + ' kcal</strong><br>Gasto total estimado: <strong>' + total + ' kcal</strong>' + (macros ? '<br>Meta inicial: <strong>' + macros.kcal + ' kcal</strong>' : '');
  }

  function render(screen) {
    var step = steps[state.step];
    var pct = Math.round(((state.step + 1) / steps.length) * 100);
    screen.querySelector('.kdw-body').innerHTML = stepHtml();
    screen.querySelector('.kdw-title').textContent = step.title;
    screen.querySelector('.kdw-text').textContent = step.subtitle;
    screen.querySelector('.kdw-progress span').style.width = pct + '%';
    screen.querySelector('.kdw-step-current').textContent = 'Passo ' + (state.step + 1) + ' de ' + steps.length;
    screen.querySelector('.kdw-step-key').textContent = step.key.toUpperCase();
    screen.querySelector('.kdw-back').style.visibility = state.step === 0 ? 'hidden' : 'visible';
    screen.querySelector('.kdw-next').textContent = state.step === steps.length - 1 ? 'Gerar plano com IA' : 'Continuar';
    bindStepInputs(screen);
    updateLiveSummary();
  }

  function buildWizard(options) {
    cleanupLegacyOverlay();
    var doc = root.document;
    if (!doc || !doc.body) return false;

    state.options = options || {};
    var saved = readJson(DRAFT_KEY) || readJson(PROFILE_KEY) || {};
    state.step = Math.max(0, Math.min(steps.length - 1, saved.step || 0));
    state.data = Object.assign({ sexo: 'masculino', objetivo: 'hipertrofia', nivelAtividade: 'moderado', freqTreino: '4', refeicoesPorDia: '4', estrategia: 'auto', cozinha: 'sim', orcamento: 'medio' }, saved.data || saved || {});

    injectStyles(doc);

    var screen = doc.createElement('div');
    screen.id = SCREEN_ID;
    screen.className = 'kdw-anamnese-screen kdw-screen show';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.innerHTML = [
      '<section class="kdw-card app-scroll">',
        '<button type="button" class="kdw-close" aria-label="Fechar">\xd7</button>',
        '<p class="kdw-kicker">KroniA Nutrition Engine V3</p>',
        '<h2 class="kdw-title"></h2>',
        '<p class="kdw-text"></p>',
        '<div class="kdw-step-label"><span class="kdw-step-current"></span><span class="kdw-step-key"></span></div>',
        '<div class="kdw-progress"><span></span></div>',
        '<div class="kdw-body"></div>',
        '<div class="kdw-footer"><button type="button" class="kdw-btn kdw-back">Voltar</button><button type="button" class="kdw-btn kdw-next">Continuar</button></div>',
      '</section>'
    ].join('');

    doc.body.appendChild(screen);
    doc.body.classList.add('diet-wizard-active', 'overlay-open');

    screen.querySelector('.kdw-close').addEventListener('click', cleanupLegacyOverlay);
    screen.addEventListener('click', function(e) { if (e.target === screen) cleanupLegacyOverlay(); });
    screen.querySelector('.kdw-back').addEventListener('click', function() {
      collectCurrentStep(screen);
      state.step = Math.max(0, state.step - 1);
      saveDraft();
      render(screen);
    });
    screen.querySelector('.kdw-next').addEventListener('click', function() {
      collectCurrentStep(screen);
      var error = validateStep();
      if (error) return safeToast(error, 'warning', 3500);
      if (state.step >= steps.length - 1) return finish(screen);
      state.step += 1;
      saveDraft();
      render(screen);
    });

    render(screen);
    return true;
  }

  function openDietWizardStandalone(options) {
    return buildWizard(options || {});
  }

  root.openDietWizardStandalone = openDietWizardStandalone;
  root.openDietProfileWizard = openDietWizardStandalone;
  root.openNutritionWizard = openDietWizardStandalone;
  root.openDietWizard = openDietWizardStandalone;
  root.openDietGenerationWizard = openDietWizardStandalone;
  root.openDietSetupWizard = openDietWizardStandalone;
  root.closeDietProfileWizard = cleanupLegacyOverlay;
  root.__kroniaDietWizardStandaloneLoaded = true;
})(window);
