/* Diet Profile Wizard — 6 etapas — SPA vanilla */
/* Depende de: diet-wizard-state.js, diet-step-*.js, diet-summary.js */

(function(root) {
  var WIZARD_SCREEN_ID = 'dietProfileWizardScreen';
  var WIZARD_STATE_KEY = 'kronia_diet_wizard_state_v1';
  var TOTAL_STEPS_FALLBACK = 6;
  var STEP_META = {
    1: { badge: 'Perfil corporal', title: 'Composição corporal', subtitle: 'Base metabólica para calcular sua dieta com mais precisão.' },
    2: { badge: 'Objetivo', title: 'Meta alimentar', subtitle: 'Defina o foco principal da dieta e a estratégia calórica.' },
    3: { badge: 'Saúde', title: 'Contexto clínico', subtitle: 'Condições, exames e alertas para uma prescrição mais segura.' },
    4: { badge: 'Alimentos', title: 'Preferências', subtitle: 'Monte uma dieta que você realmente consiga seguir.' },
    5: { badge: 'Treino', title: 'Gasto real', subtitle: 'Musculação, cardio e rotina entram no cálculo final.' },
    6: { badge: 'Metabolismo', title: 'Resposta do corpo', subtitle: 'Ajustes por fome, sono, estresse e adesão.' },
    complete: { badge: 'Resumo', title: 'Perfil pronto', subtitle: 'Revise os dados e gere sua dieta personalizada.' }
  };

  function _q(id) { return document.getElementById(id); }

  function _safeCall(fn) {
    try { if (typeof fn === 'function') return fn(); } catch(err) { console.warn('[diet-wizard] safeCall', err); }
    return null;
  }

  function _fallbackCreateState(userId) {
    return {
      userId: userId || null,
      currentStep: 1,
      totalSteps: TOTAL_STEPS_FALLBACK,
      completedSteps: [],
      data: {},
      startedAt: new Date().toISOString(),
    };
  }

  function _createState(userId) {
    if (typeof root.createDietWizardState === 'function') return root.createDietWizardState(userId);
    if (typeof createDietWizardState === 'function') return createDietWizardState(userId);
    return _fallbackCreateState(userId);
  }

  function _isComplete(state) {
    if (typeof root.isDietWizardComplete === 'function') return root.isDietWizardComplete(state);
    if (typeof isDietWizardComplete === 'function') return isDietWizardComplete(state);
    return !!(state && state.completedSteps && state.completedSteps.length >= TOTAL_STEPS_FALLBACK);
  }

  function _progress(state) {
    if (typeof root.getDietWizardProgress === 'function') return root.getDietWizardProgress(state);
    if (typeof getDietWizardProgress === 'function') return getDietWizardProgress(state);
    var completed = state && state.completedSteps ? state.completedSteps.length : 0;
    return {
      current: state ? state.currentStep : 1,
      total: TOTAL_STEPS_FALLBACK,
      percent: Math.round((completed / TOTAL_STEPS_FALLBACK) * 100),
    };
  }

  function _advance(state, stepNumber, stepData) {
    if (typeof root.advanceDietWizardStep === 'function') return root.advanceDietWizardStep(state, stepNumber, stepData);
    if (typeof advanceDietWizardStep === 'function') return advanceDietWizardStep(state, stepNumber, stepData);
    var keyMap = { 1: 'bodyComposition', 2: 'goal', 3: 'healthExams', 4: 'food', 5: 'training', 6: 'metabolism' };
    var updated = Object.assign({}, state || _fallbackCreateState(null));
    updated.data = Object.assign({}, updated.data || {});
    updated.data[keyMap[stepNumber]] = stepData;
    var completed = (updated.completedSteps || []).slice();
    if (completed.indexOf(stepNumber) === -1) completed.push(stepNumber);
    updated.completedSteps = completed;
    if (stepNumber < TOTAL_STEPS_FALLBACK) updated.currentStep = stepNumber + 1;
    else updated.completedAt = new Date().toISOString();
    return updated;
  }

  function _hideKnownBlockingLayers() {
    [
      'dietChoiceScreen',
      'nutritionFlowScreen',
      'customModal',
      'configSheet',
      'timerSheet'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el || id === WIZARD_SCREEN_ID) return;
      el.classList.remove('show');
    });
  }

  function _openLegacyDietFlow(source) {
    closeDietProfileWizard();
    if (typeof root.openNutritionFlow === 'function') {
      root.openNutritionFlow({ source: source || 'diet_wizard_fallback', returnTab: 'dieta' });
      return true;
    }
    if (typeof openNutritionFlow === 'function') {
      openNutritionFlow({ source: source || 'diet_wizard_fallback', returnTab: 'dieta' });
      return true;
    }
    _safeCall(function(){ if (typeof navTo === 'function') navTo('dieta'); });
    _safeCall(function(){ if (typeof openDietDataScreen === 'function') openDietDataScreen(); });
    return false;
  }

  function _activateWizardLayer(screen) {
    _hideKnownBlockingLayers();
    if (!screen) return;
    screen.style.zIndex = '12000';
    screen.style.pointerEvents = 'auto';
    document.body.classList.add('diet-wizard-active');
    var footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = 'none';
  }

  function _deactivateWizardLayer() {
    document.body.classList.remove('diet-wizard-active');
    var footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = '';
  }

  function _metaForState(state) {
    if (_isComplete(state)) return STEP_META.complete;
    return STEP_META[(state && state.currentStep) || 1] || STEP_META[1];
  }

  function renderDietWizardProgress(state) {
    var prog = _progress(state);
    var meta = _metaForState(state);
    var bar = document.getElementById('dietWizardProgressBar');
    var label = document.getElementById('dietWizardProgressLabel');
    var badge = document.getElementById('dietWizardStepBadge');
    var title = document.getElementById('dietWizardHeaderTitle');
    var subtitle = document.getElementById('dietWizardHeaderSubtitle');
    var count = document.getElementById('dietWizardStepCount');
    if (bar) bar.style.width = prog.percent + '%';
    if (label) label.textContent = _isComplete(state) ? 'Perfil completo' : Math.max(1, Math.min(prog.total, prog.current)) + ' / ' + prog.total;
    if (badge) badge.textContent = meta.badge;
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    if (count) count.textContent = _isComplete(state) ? '100%' : prog.percent + '%';
  }

  function _safeRenderFallbackStep(step) {
    return [
      '<div class="dw-step-title">Criar dieta</div>',
      '<p class="dw-step-desc">Não consegui carregar todos os componentes do wizard novo. Você pode continuar pelo fluxo seguro.</p>',
      '<div class="dw-card">',
        '<div class="dw-summary-card-title">Fluxo alternativo</div>',
        '<p class="dw-info-text">Toque abaixo para abrir a criação de dieta sem travar a tela.</p>',
        '<button type="button" class="dw-btn-primary" onclick="openNutritionFlow({source:\'diet_wizard_component_fallback\',returnTab:\'dieta\'})">Abrir criação de dieta</button>',
      '</div>'
    ].join('');
  }

  function renderDietWizardStep(state) {
    var container = document.getElementById('dietWizardStepContainer');
    if (!container) return;
    container.innerHTML = '';

    try {
      if (_isComplete(state)) {
        if (typeof renderDietSummary !== 'function') throw new Error('renderDietSummary indisponível');
        container.innerHTML = renderDietSummary(state);
        renderDietWizardProgress(state);
        _syncFooterButton(true);
        return;
      }

      var step = state.currentStep;
      var html = '';
      if (step === 1) html = renderDietStepBody(state.data.bodyComposition || {});
      else if (step === 2) html = renderDietStepGoal(state.data.goal || {});
      else if (step === 3) html = renderDietStepHealth(state.data.healthExams || {});
      else if (step === 4) html = renderDietStepFood(state.data.food || {});
      else if (step === 5) html = renderDietStepTraining(state.data.training || {});
      else if (step === 6) html = renderDietStepMetabolism(state.data.metabolism || {});
      if (!html) throw new Error('html vazio etapa ' + step);
      container.innerHTML = html;
      renderDietWizardProgress(state);
      _syncFooterButton(false);
      _bindStepChips(container);
      _bindModalidadeExpand(container, state);
      try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(_) {}
    } catch(err) {
      console.error('[diet-wizard] Falha ao renderizar etapa', err);
      container.innerHTML = _safeRenderFallbackStep(state && state.currentStep);
      renderDietWizardProgress(state || _fallbackCreateState(null));
      _syncFooterButton(false);
    }
  }

  function _syncFooterButton(isComplete) {
    var btn = document.getElementById('dietWizardNextBtn');
    if (!btn) return;
    btn.textContent = isComplete ? 'Gerar dieta premium' : 'Continuar';
  }

  function _bindStepChips(container) {
    container.querySelectorAll('.dw-chip[data-group]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var group = chip.dataset.group;
        var multi = chip.dataset.multi === 'true';
        if (!multi) {
          container.querySelectorAll('.dw-chip[data-group="' + group + '"]').forEach(function(c) { c.classList.remove('active'); });
        }
        chip.classList.toggle('active');
      });
    });
    container.querySelectorAll('.dw-chip-single[data-group]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var group = chip.dataset.group;
        container.querySelectorAll('.dw-chip-single[data-group="' + group + '"]').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
      });
    });
    container.querySelectorAll('.dw-bcm-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.dw-bcm-toggle').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var showBcm = btn.dataset.show || '';
        container.querySelectorAll('[data-bcm-section]').forEach(function(sec) {
          sec.style.display = sec.dataset.bcmSection === showBcm ? '' : 'none';
        });
      });
    });
  }

  function _bindModalidadeExpand(container, state) {
    container.querySelectorAll('.dw-chip[data-group="modalidades"]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var tipo = chip.dataset.value;
        var cardId = 'dw-modal-card-' + tipo;
        var existing = container.querySelector('#' + cardId);
        var host = container.querySelector('.dw-modalidades-expand');
        if (!host) return;
        if (chip.classList.contains('active')) {
          if (!existing) {
            var card = document.createElement('div');
            card.id = cardId;
            card.className = 'dw-modal-sub-card';
            card.innerHTML = _modalidadeSubCard(tipo);
            host.appendChild(card);
            _bindStepChips(card);
          }
        } else {
          if (existing) existing.remove();
        }
      });
    });
  }

  function _modalidadeSubCard(tipo) {
    var label = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    return '<div class="dw-card" style="margin-top:8px">' +
      '<div class="dw-field-label">' + label + '</div>' +
      '<div class="dw-row">' +
        '<div class="dw-col">' +
          '<label class="dw-label">Dias/semana</label>' +
          '<select class="dw-select" name="modal_dias_' + tipo + '">' +
            [1,2,3,4,5,6,7].map(function(d){ return '<option value="' + d + '">' + d + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="dw-col">' +
          '<label class="dw-label">Duração (min)</label>' +
          '<select class="dw-select" name="modal_dur_' + tipo + '">' +
            ['30','45','60','75','90','120+'].map(function(d){ return '<option value="' + d + '">' + d + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<label class="dw-label">Intensidade</label>' +
      '<div class="dw-chips-row">' +
        ['leve','moderado','intenso'].map(function(i){
          return '<button type="button" class="dw-chip-single" data-group="modal_int_' + tipo + '" data-value="' + i + '">' + i.charAt(0).toUpperCase() + i.slice(1) + '</button>';
        }).join('') +
      '</div>' +
      '<label class="dw-label">Horário</label>' +
      '<div class="dw-chips-row">' +
        ['Manhã','Tarde','Noite'].map(function(h){
          return '<button type="button" class="dw-chip-single" data-group="modal_hor_' + tipo + '" data-value="' + h.toLowerCase() + '">' + h + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function _collectStepData(step) {
    var container = document.getElementById('dietWizardStepContainer');
    if (!container) return {};
    var data = {};

    function chip(group, multi) {
      var active = container.querySelectorAll('.dw-chip[data-group="' + group + '"].active, .dw-chip-single[data-group="' + group + '"].active');
      if (!active.length) return multi ? [] : null;
      var vals = Array.from(active).map(function(c) { return c.dataset.value || c.textContent.trim(); });
      return multi ? vals : vals[0];
    }

    function bcmMode() {
      var active = container.querySelector('.dw-bcm-toggle.active');
      if (!active) return 'skip';
      return active.dataset.show || 'skip';
    }

    function input(name) {
      var el = container.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : null;
    }

    if (step === 1) {
      data.sex = chip('sex');
      data.age = Number(input('age')) || null;
      data.weight_kg = Number(input('weight_kg')) || null;
      data.height_cm = Number(input('height_cm')) || null;
      var mode = bcmMode();
      data.bcmMode = mode;
      if (mode === 'bcm') {
        data.bcmData = {
          body_fat_percent: Number(input('body_fat_percent')) || null,
          lean_mass_kg: Number(input('lean_mass_kg')) || null,
          fat_mass_kg: Number(input('fat_mass_kg')) || null,
          water_percent: Number(input('water_percent')) || null,
          muscle_mass_kg: Number(input('muscle_mass_kg')) || null,
          basal_metabolic_rate: Number(input('basal_metabolic_rate')) || null,
          exam_date: input('exam_date'),
        };
      } else if (mode === 'pcm') {
        data.pcmManual = {
          waist_cm: Number(input('waist_cm')) || null,
          abdomen_cm: Number(input('abdomen_cm')) || null,
          hip_cm: Number(input('hip_cm')) || null,
          neck_cm: Number(input('neck_cm')) || null,
        };
      }
      data.gordura_corporal_manual = Number(input('gordura_corporal_manual')) || null;
      data.biotipo = chip('biotipo');
    } else if (step === 2) {
      data.objective = chip('objective');
      data.prioridade = chip('prioridade');
      data.refeicoesPorDia = chip('refeicoesPorDia') || input('refeicoesPorDia');
      data.metaCaloricaManual = Number(input('metaCaloricaManual')) || null;
    } else if (step === 3) {
      data.patologias = chip('patologias', true);
      data.observacoesClincias = input('observacoesClincias');
      data.restricoesClinicas = input('restricoesClinicas');
    } else if (step === 4) {
      data.padraoAlimentar = chip('padraoAlimentar');
      data.preferenciasAlimentares = input('preferenciasAlimentares');
      data.alimentosQueEvita = input('alimentosQueEvita');
      data.restricoesAlimentares = chip('restricoesAlimentares', true);
      data.suplementos = chip('suplementos', true);
    } else if (step === 5) {
      data.statusTreino = chip('statusTreino');
      data.perfilTreino = chip('perfilTreino');
      data.intensidadeGeral = chip('intensidadeGeral');
      var modalChips = container.querySelectorAll('.dw-chip[data-group="modalidades"].active');
      data.modalidades = Array.from(modalChips).map(function(c) {
        var tipo = c.dataset.value || c.textContent.trim().toLowerCase();
        var diasEl = container.querySelector('[name="modal_dias_' + tipo + '"]');
        var durEl  = container.querySelector('[name="modal_dur_' + tipo + '"]');
        return {
          tipo: tipo,
          diasSemana: diasEl ? Number(diasEl.value) : 3,
          duracaoMinutos: durEl ? (durEl.value === '120+' ? 120 : Number(durEl.value)) : 60,
          intensidade: (function(){
            var el = container.querySelector('[data-group="modal_int_' + tipo + '"].active');
            return el ? el.dataset.value : 'moderado';
          })(),
          horario: (function(){
            var el = container.querySelector('[data-group="modal_hor_' + tipo + '"].active');
            return el ? el.dataset.value : null;
          })(),
          objetivo: null,
        };
      });
      data.rotinaForaTreino = chip('rotinaForaTreino');
      data.fadiga = Number(input('fadiga')) || null;
      data.dorMuscular = chip('dorMuscular');
      data.quedaRendimento = chip('quedaRendimento');
    } else if (step === 6) {
      data.respostaPeso = chip('respostaPeso');
      data.apetite = chip('apetite');
      data.historicoDieta = chip('historicoDieta');
      data.adesao = chip('adesao');
      data.rotina = chip('rotina');
      data.sono = chip('sono');
      data.estresse = chip('estresse');
      data.usoHormonios = chip('usoHormonios');
    }

    return data;
  }

  function _validateStepData(step, data) {
    if (step === 1) {
      if (!data.sex) return 'Informe o sexo.';
      if (!data.age || data.age < 14) return 'Informe uma idade válida.';
      if (!data.weight_kg || data.weight_kg < 35) return 'Informe o peso em kg.';
      if (!data.height_cm || data.height_cm < 100) return 'Informe a altura em cm.';
      if (data.bcmMode === 'bcm' && (!data.bcmData || !data.bcmData.body_fat_percent)) return 'Informe o % de gordura do BCM.';
      if (data.bcmMode === 'pcm' && (!data.pcmManual || !data.pcmManual.waist_cm || !data.pcmManual.abdomen_cm)) return 'Informe cintura e abdômen.';
    }
    if (step === 2 && !data.objective) return 'Selecione o objetivo.';
    return null;
  }

  function openDietProfileWizard(userId, opts) {
    try {
      var options = opts || {};
      var screen = _q(WIZARD_SCREEN_ID);
      if (!screen) {
        screen = _createWizardScreen();
        document.body.appendChild(screen);
      }

      var savedState = null;
      try {
        var raw = localStorage.getItem(WIZARD_STATE_KEY);
        if (raw) savedState = JSON.parse(raw);
      } catch(_) {}

      var state;
      if (savedState && savedState.userId === userId && !options.forceNew) {
        state = savedState;
      } else {
        state = _createState(userId);
      }

      if (!state || !state.data) state = _fallbackCreateState(userId);
      window._dietWizardState = state;
      _activateWizardLayer(screen);
      screen.classList.add('show');
      renderDietWizardStep(state);
    } catch(err) {
      console.error('[diet-wizard] Falha ao abrir wizard; usando fluxo legado.', err);
      _openLegacyDietFlow('diet_wizard_open_fallback');
    }
  }

  function closeDietProfileWizard() {
    var screen = _q(WIZARD_SCREEN_ID);
    if (screen) screen.classList.remove('show');
    _deactivateWizardLayer();
  }

  function dietWizardNext() {
    var state = window._dietWizardState;
    if (!state) return;

    if (_isComplete(state)) {
      _submitDietWizard(state);
      return;
    }

    var stepData = _collectStepData(state.currentStep);
    var err = _validateStepData(state.currentStep, stepData);
    if (err) {
      if (typeof showToast === 'function') showToast(err, 'warning', 3600);
      else _safeCall(function(){ dlgAlert(err); });
      return;
    }

    state = _advance(state, state.currentStep, stepData);
    window._dietWizardState = state;
    try { localStorage.setItem(WIZARD_STATE_KEY, JSON.stringify(state)); } catch(_) {}
    renderDietWizardStep(state);
  }

  function dietWizardBack() {
    var state = window._dietWizardState;
    if (!state) return;
    if (_isComplete(state)) {
      state.completedSteps = state.completedSteps.filter(function(s) { return s < 6; });
      state.currentStep = 6;
      delete state.completedAt;
      window._dietWizardState = state;
      renderDietWizardStep(state);
      return;
    }
    if (state.currentStep <= 1) {
      closeDietProfileWizard();
      try { navTo('dieta'); openDietDataScreen(); } catch(_) {}
      return;
    }
    state.currentStep -= 1;
    window._dietWizardState = state;
    renderDietWizardStep(state);
  }

  function dietWizardEditStep(step) {
    var state = window._dietWizardState;
    if (!state) return;
    state.currentStep = step;
    delete state.completedAt;
    window._dietWizardState = state;
    renderDietWizardStep(state);
  }

  async function _submitDietWizard(state) {
    var btn = document.getElementById('dietWizardSubmitBtn') || document.getElementById('dietWizardNextBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando...'; }

    var body = state.data.bodyComposition || {};
    var goal = state.data.goal || {};
    var training = state.data.training || {};
    var metabolism = state.data.metabolism || {};

    var payload = {
      sexo: body.sex,
      sex: body.sex,
      idade: body.age,
      age: body.age,
      peso: body.weight_kg,
      weight_kg: body.weight_kg,
      altura: body.height_cm,
      height_cm: body.height_cm,
      objetivo: goal.objective,
      objective: goal.objective,
      refeicoesPorDia: goal.refeicoesPorDia,
      padraoAlimentar: (state.data.food || {}).padraoAlimentar,
      bcmData: body.bcmData || null,
      pcmManual: body.pcmManual || null,
      statusTreino: training.statusTreino,
      perfilTreino: training.perfilTreino,
      intensidadeGeral: training.intensidadeGeral,
      modalidades: training.modalidades || [],
      rotinaForaTreino: training.rotinaForaTreino,
      fadiga: training.fadiga,
      dorMuscular: training.dorMuscular,
      quedaRendimento: training.quedaRendimento,
      respostaPeso: metabolism.respostaPeso,
      apetite: metabolism.apetite,
      historicoDieta: metabolism.historicoDieta,
      adesao: metabolism.adesao,
      rotina: metabolism.rotina,
      sono: metabolism.sono,
      estresse: metabolism.estresse,
      usoHormonios: metabolism.usoHormonios,
      patologias: (state.data.healthExams || {}).patologias || [],
      restricoesAlimentares: (state.data.food || {}).restricoesAlimentares || [],
      suplementos: (state.data.food || {}).suplementos || [],
      dietWizardFlow: state,
    };

    try {
      closeDietProfileWizard();
      if (typeof root.openNutritionFlowFull === 'function') {
        await root.openNutritionFlowFull({ autoGenerate: true, source: 'diet_wizard_6step', dietWizardPayload: payload });
      } else if (typeof openNutritionFlowFull === 'function') {
        await openNutritionFlowFull({ autoGenerate: true, source: 'diet_wizard_6step', dietWizardPayload: payload });
      } else if (typeof root.openNutritionFlow === 'function') {
        root.openNutritionFlow({ source: 'diet_wizard_6step_fallback', returnTab: 'dieta', dietWizardPayload: payload });
      } else if (typeof openNutritionFlow === 'function') {
        openNutritionFlow({ source: 'diet_wizard_6step_fallback', returnTab: 'dieta', dietWizardPayload: payload });
      } else {
        try { navTo('dieta'); openDietDataScreen(); } catch(_) {}
      }
      try { localStorage.removeItem(WIZARD_STATE_KEY); } catch(_) {}
    } catch(err) {
      console.error('[diet-wizard] erro ao gerar dieta', err);
      if (typeof showToast === 'function') showToast('Erro ao gerar dieta. Tente novamente.', 'error', 4000);
      if (btn) { btn.disabled = false; btn.textContent = 'Gerar dieta premium'; }
      _activateWizardLayer(_q(WIZARD_SCREEN_ID));
      var screen = _q(WIZARD_SCREEN_ID);
      if (screen) screen.classList.add('show');
    }
  }

  function _createWizardScreen() {
    var div = document.createElement('div');
    div.id = WIZARD_SCREEN_ID;
    div.className = 'diet-wizard-screen diet-wizard-premium-screen';
    div.style.zIndex = '12000';
    div.style.pointerEvents = 'auto';
    div.innerHTML = [
      '<style>',
        '.diet-wizard-premium-screen{background:radial-gradient(circle at 50% -10%,rgba(34,197,94,.26),transparent 34%),radial-gradient(circle at 95% 15%,rgba(16,185,129,.16),transparent 30%),linear-gradient(180deg,#020617 0%,#050b12 44%,#020617 100%)!important;color:#fff;}',
        '.diet-wizard-premium-screen .diet-wizard-inner{min-height:100%;display:flex;flex-direction:column;background:transparent!important;}',
        '.diet-wizard-premium-screen .diet-wizard-header{position:sticky;top:0;z-index:5;padding:calc(env(safe-area-inset-top,0px) + 14px) 18px 14px;background:linear-gradient(180deg,rgba(2,6,23,.98),rgba(2,6,23,.84) 70%,rgba(2,6,23,0));backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(34,197,94,.08);}',
        '.dw-premium-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}',
        '.dw-premium-back{width:42px;height:42px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.35rem;box-shadow:0 12px 30px rgba(0,0,0,.28);}',
        '.dw-premium-brand{flex:1;min-width:0;}',
        '.dw-premium-kicker{font-size:.62rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#86efac;margin-bottom:4px;}',
        '.dw-premium-title{font-size:1.42rem;line-height:1.02;font-weight:900;letter-spacing:-.04em;color:#f8fafc;}',
        '.dw-premium-percent{width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(34,197,94,.24),rgba(16,185,129,.08));border:1px solid rgba(34,197,94,.32);box-shadow:0 0 26px rgba(34,197,94,.16),inset 0 1px 0 rgba(255,255,255,.08);font-size:.82rem;font-weight:900;color:#bbf7d0;}',
        '.dw-premium-hero{position:relative;overflow:hidden;border-radius:28px;padding:18px;background:linear-gradient(145deg,rgba(15,23,42,.92),rgba(6,78,59,.28));border:1px solid rgba(34,197,94,.18);box-shadow:0 20px 50px rgba(0,0,0,.36),0 0 34px rgba(34,197,94,.08);}',
        '.dw-premium-hero:before{content:"";position:absolute;inset:-1px;background:radial-gradient(circle at 85% 0%,rgba(74,222,128,.25),transparent 38%);pointer-events:none;}',
        '.dw-premium-badge{position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.24);color:#86efac;font-size:.66rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;}',
        '.dw-premium-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 14px #22c55e;}',
        '.dw-premium-step-title{position:relative;font-size:1.72rem;line-height:.98;font-weight:900;letter-spacing:-.055em;color:#fff;margin-bottom:8px;}',
        '.dw-premium-step-sub{position:relative;color:rgba(226,232,240,.72);font-size:.88rem;line-height:1.42;max-width:310px;}',
        '.dw-premium-progress-row{position:relative;margin-top:16px;display:flex;align-items:center;gap:10px;}',
        '.dw-premium-progress-track{height:9px;flex:1;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.06);}',
        '.dw-premium-progress-fill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#a3e635);box-shadow:0 0 22px rgba(34,197,94,.55);transition:width .35s ease;}',
        '.dw-premium-label{font-size:.72rem;font-weight:900;color:#d9f99d;min-width:38px;text-align:right;}',
        '.diet-wizard-premium-screen .diet-wizard-body{padding:18px 16px 120px;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
        '.diet-wizard-premium-screen .dw-card{background:linear-gradient(145deg,rgba(15,23,42,.9),rgba(15,23,42,.62))!important;border:1px solid rgba(148,163,184,.14)!important;border-radius:24px!important;box-shadow:0 12px 34px rgba(0,0,0,.22)!important;}',
        '.diet-wizard-premium-screen .dw-input,.diet-wizard-premium-screen .dw-select{background:rgba(2,6,23,.72)!important;border:1px solid rgba(148,163,184,.18)!important;border-radius:16px!important;color:#fff!important;}',
        '.diet-wizard-premium-screen .dw-chip,.diet-wizard-premium-screen .dw-chip-single,.diet-wizard-premium-screen .dw-bcm-toggle{border-radius:999px!important;border:1px solid rgba(148,163,184,.18)!important;background:rgba(255,255,255,.06)!important;color:#d1d5db!important;}',
        '.diet-wizard-premium-screen .dw-chip.active,.diet-wizard-premium-screen .dw-chip-single.active,.diet-wizard-premium-screen .dw-bcm-toggle.active{background:linear-gradient(135deg,rgba(34,197,94,.26),rgba(132,204,22,.13))!important;border-color:rgba(34,197,94,.5)!important;color:#ecfccb!important;box-shadow:0 0 20px rgba(34,197,94,.13)!important;}',
        '.diet-wizard-premium-screen .diet-wizard-footer{position:fixed;left:0;right:0;bottom:0;z-index:6;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,.94) 28%,#020617 100%);}',
        '.diet-wizard-premium-screen .dw-btn-primary{width:100%;min-height:56px;border:0;border-radius:22px;background:linear-gradient(135deg,#22c55e,#a3e635)!important;color:#02140a!important;font-weight:950!important;font-size:1rem!important;box-shadow:0 16px 40px rgba(34,197,94,.28),0 0 28px rgba(34,197,94,.18)!important;}',
        '.diet-wizard-premium-screen .dw-step-title{font-size:1.32rem!important;letter-spacing:-.03em!important;}',
        '.diet-wizard-premium-screen .dw-step-desc{color:rgba(226,232,240,.7)!important;}',
      '</style>',
      '<div class="diet-wizard-inner">',
        '<div class="diet-wizard-header">',
          '<div class="dw-premium-top">',
            '<button type="button" class="dw-premium-back" onclick="dietWizardBack()">&#8592;</button>',
            '<div class="dw-premium-brand">',
              '<div class="dw-premium-kicker">KRONIA DIETA</div>',
              '<div class="dw-premium-title">Plano alimentar inteligente</div>',
            '</div>',
            '<div id="dietWizardStepCount" class="dw-premium-percent">0%</div>',
          '</div>',
          '<div class="dw-premium-hero">',
            '<div id="dietWizardStepBadge" class="dw-premium-badge">Perfil corporal</div>',
            '<div id="dietWizardHeaderTitle" class="dw-premium-step-title">Composição corporal</div>',
            '<div id="dietWizardHeaderSubtitle" class="dw-premium-step-sub">Base metabólica para calcular sua dieta com mais precisão.</div>',
            '<div class="dw-premium-progress-row">',
              '<div class="dw-premium-progress-track">',
                '<div id="dietWizardProgressBar" class="dw-premium-progress-fill diet-wizard-progress-fill"></div>',
              '</div>',
              '<span id="dietWizardProgressLabel" class="dw-premium-label diet-wizard-progress-label">1 / 6</span>',
            '</div>',
          '</div>',
        '</div>',
        '<div id="dietWizardStepContainer" class="diet-wizard-body"></div>',
        '<div class="diet-wizard-footer">',
          '<button type="button" id="dietWizardNextBtn" class="dw-btn-primary" onclick="dietWizardNext()">Continuar</button>',
        '</div>',
      '</div>',
    ].join('');
    return div;
  }

  // Expose globals
  root.openDietProfileWizard = openDietProfileWizard;
  root.closeDietProfileWizard = closeDietProfileWizard;
  root.dietWizardNext = dietWizardNext;
  root.dietWizardBack = dietWizardBack;
  root.dietWizardEditStep = dietWizardEditStep;

})(typeof window !== 'undefined' ? window : this);
