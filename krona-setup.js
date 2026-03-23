/* ═══════════════════════════════════════════════════
   KRONA SETUP — Fluxo de configuração de perfil pós-login
   Splash → Login → [KronaSetup] → FeatureTour → Plans → App
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _ksStep = 0;
  var _ksTotal = 3;
  var _ksGoal = null;

  /* ── Abrir / fechar ── */
  window.openKronaSetup = function () {
    var el = document.getElementById('kronaSetup');
    if (!el) return;
    el.style.display = 'flex';
    document.body.classList.add('overlay-open');
    var footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = 'none';
    _ksGoal = null;
    _ksStep = 0;
    ksGoTo(0);
    // Pré-preenche nome se já existe
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('kronia_config') || '{}'); } catch (e) {}
    var nomeEl = document.getElementById('ksNomeInput');
    if (nomeEl && cfg.nome) nomeEl.value = cfg.nome;
  };

  function ksClose() {
    var el = document.getElementById('kronaSetup');
    if (el) el.style.display = 'none';
    document.body.classList.remove('overlay-open');
    var footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = '';
  }

  /* ── Navegação entre steps ── */
  function ksGoTo(idx) {
    var steps = document.querySelectorAll('.ks-step');
    steps.forEach(function (s, i) {
      s.classList.remove('ks-step-active', 'ks-step-exit');
      if (i < idx) s.classList.add('ks-step-exit');
      else if (i === idx) s.classList.add('ks-step-active');
    });
    _ksStep = idx;

    // Barra de progresso
    var bar = document.getElementById('ksProgressBar');
    if (bar) bar.style.width = (((idx + 1) / _ksTotal) * 100) + '%';
    var lbl = document.getElementById('ksStepLabel');
    if (lbl) lbl.textContent = 'PASSO ' + (idx + 1) + ' DE ' + _ksTotal;

    // Texto do botão
    var ctaLbl = document.getElementById('ksCtaLabel');
    if (ctaLbl) ctaLbl.textContent = idx === _ksTotal - 1 ? 'Vamos começar' : 'Continuar';

    ksValidate();
  }

  window.ksNext = function () {
    if (_ksStep < _ksTotal - 1) {
      ksGoTo(_ksStep + 1);
    } else {
      ksFinish();
    }
  };

  /* ── Validação por step ── */
  window.ksValidate = function () {
    var valid = false;
    if (_ksStep === 0) {
      var nome = document.getElementById('ksNomeInput');
      valid = nome && nome.value.trim().length >= 2;
    } else if (_ksStep === 1) {
      valid = true; // dados físicos são opcionais
    } else if (_ksStep === 2) {
      valid = _ksGoal !== null;
    }
    var cta = document.getElementById('ksCta');
    if (cta) {
      cta.disabled = !valid;
      cta.style.opacity = valid ? '1' : '0.38';
    }
  };

  window.ksSelectGoal = function (el) {
    document.querySelectorAll('.ks-goal-chip').forEach(function (c) {
      c.classList.remove('selected');
    });
    el.classList.add('selected');
    _ksGoal = el.dataset.goal;
    ksValidate();
  };

  /* ── Finalizar e salvar ── */
  function ksFinish() {
    var nome   = (document.getElementById('ksNomeInput')?.value   || '').trim();
    var peso   = document.getElementById('ksPesoInput')?.value    || '';
    var altura = document.getElementById('ksAlturaInput')?.value  || '';
    var idade  = document.getElementById('ksIdadeInput')?.value   || '';

    // Salva no config
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('kronia_config') || '{}'); } catch (e) {}
    if (nome)   cfg.nome   = nome;
    if (peso)   cfg.peso   = peso;
    if (altura) cfg.altura = altura;
    if (idade)  cfg.idade  = idade;
    if (_ksGoal) cfg.objetivo = _ksGoal;
    localStorage.setItem('kronia_config', JSON.stringify(cfg));
    localStorage.setItem('kronia_profile_setup_done', '1');

    // Atualiza UI do perfil se disponível
    if (typeof updatePerfilScreen === 'function') updatePerfilScreen();

    ksClose();

    // Próximo passo: feature tour (se ainda não viu)
    if (!localStorage.getItem('kronia_onboarded')) {
      var ob = document.getElementById('onboarding');
      if (ob) {
        ob.classList.add('show');
        document.body.classList.add('overlay-open');
        var footer = document.querySelector('.footer-actions');
        if (footer) footer.style.display = 'none';
        if (typeof ffObGoTo === 'function') ffObGoTo(0);
      }
    } else {
      // Já viu o tour → vai direto ao app
      if (typeof navTo === 'function') navTo('inicio');
      if (typeof openHome === 'function') openHome();
    }
  }

})();
