/* ═══════════════════════════════════════════════════════
   FITFLOW LAYOUT — Onboarding Carousel + Pricing Screen
   Converte os componentes React do FitFlow-AI para vanilla JS
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Onboarding state ── */
  var ffObCurrent = 0;
  var FF_OB_TOTAL = 5;

  var FF_SLIDE_BGS = [
    'radial-gradient(ellipse at 30% 15%, rgba(255,107,0,0.28) 0%, transparent 55%)',
    'radial-gradient(ellipse at 70% 20%, rgba(255,107,0,0.2) 0%, transparent 60%)',
    'radial-gradient(ellipse at 20% 70%, rgba(255,107,0,0.18) 0%, transparent 55%)',
    'radial-gradient(ellipse at 60% 25%, rgba(255,107,0,0.25) 0%, transparent 55%)',
    'radial-gradient(ellipse at 40% 20%, rgba(255,107,0,0.22) 0%, transparent 60%)',
  ];

  function ffSafeGetStorage(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (_err) {
      return null;
    }
  }

  function ffGetOnboardingTotal() {
    var slides = document.querySelectorAll('.ff-slide');
    return slides.length || FF_OB_TOTAL;
  }

  function ffObUpdateDots() {
    var dots = document.querySelectorAll('.ff-dot');
    dots.forEach(function (d, i) {
      d.classList.toggle('ff-dot-active', i === ffObCurrent);
      d.style.width = i === ffObCurrent ? '24px' : '6px';
    });
  }

  function ffObUpdateBg() {
    var bg = document.getElementById('ff-ob-bg');
    if (bg) bg.style.background = FF_SLIDE_BGS[ffObCurrent] || '';
  }

  function ffObUpdateCta() {
    var btn = document.getElementById('ff-ob-cta');
    var hint = document.getElementById('ff-ob-hint');
    var footer = document.getElementById('ff-ob-footer');
    if (!btn) return;
    var total = ffGetOnboardingTotal();
    var isLast = ffObCurrent === total - 1;
    btn.classList.toggle('ff-cta-final', isLast);
    btn.style.display = isLast ? 'flex' : 'none';
    btn.style.pointerEvents = isLast ? 'auto' : 'none';
    if (footer) footer.classList.toggle('has-cta', isLast);
    if (hint) hint.style.display = isLast ? 'none' : 'block';
    if (isLast) {
      btn.innerHTML = 'Ativar o KRONOS agora <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
    }
  }

  window.ffObGoTo = function (idx) {
    var total = ffGetOnboardingTotal();
    if (idx < 0 || idx >= total) return;
    var slides = document.querySelectorAll('.ff-slide');
    slides.forEach(function (s) { s.classList.remove('ff-slide-active'); });
    var target = document.getElementById('ff-slide-' + idx);
    if (target) target.classList.add('ff-slide-active');
    ffObCurrent = idx;
    ffObUpdateDots();
    ffObUpdateBg();
    ffObUpdateCta();
  };

  window.ffObNext = function () {
    var total = ffGetOnboardingTotal();
    if (ffObCurrent < total - 1) {
      window.ffObGoTo(ffObCurrent + 1);
    } else {
      window.ffObFinish();
    }
  };

  window.ffObFinish = function () {
    var appLayer = window.KroniaApplication && window.KroniaApplication.application;
    var userId = ffSafeGetStorage('kronia_user_id') || 'anonymous';
    var hasPlan = !!ffSafeGetStorage('kronia_plan');
    var completion = appLayer
      ? appLayer.completeOnboarding({
          userId: userId,
          hasPlan: hasPlan
        })
      : { status: 'success', nextAction: { route: 'plans' } };

    if (completion.status === 'error') {
      if (typeof showToast === 'function') showToast('Erro ao concluir onboarding.', 'error');
      return;
    }

    var ob = document.getElementById('onboarding');
    if (ob) { ob.style.display = 'none'; ob.classList.remove('show'); }
    document.body.classList.remove('overlay-open');

    var nextRoute = completion && completion.nextAction ? completion.nextAction.route : 'plans';
    if (nextRoute === 'plans' && typeof openPlanModal === 'function') {
      openPlanModal();
    } else if (typeof navTo === 'function') {
      navTo('inicio');
      if (typeof openHome === 'function') openHome();
    }

    var footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = '';
  };

  /* Touch / swipe support */
  var ffObTouchX = null;
  function ffObSetupSwipe() {
    var slides = document.getElementById('ff-ob-slides');
    if (!slides) return;
    slides.addEventListener('touchstart', function (e) {
      ffObTouchX = e.touches[0].clientX;
    }, { passive: true });
    slides.addEventListener('touchend', function (e) {
      if (ffObTouchX === null) return;
      var dx = ffObTouchX - e.changedTouches[0].clientX;
      if (dx > 40) window.ffObNext();
      if (dx < -40 && ffObCurrent > 0) window.ffObGoTo(ffObCurrent - 1);
      ffObTouchX = null;
    }, { passive: true });
  }

  /* ── Pricing Screen ── */
  window.openPricingScreen = function () {
    var ps = document.getElementById('pricingScreen');
    if (ps) ps.style.display = 'flex';
  };

  window.closePricingScreen = function () {
    var ps = document.getElementById('pricingScreen');
    if (ps) ps.style.display = 'none';
  };

  window.selectPlan = function (planId) {
    if (planId === 'free') {
      window.closePricingScreen();
      return;
    }
    // PRO e ULTRA redirecionam para o checkout
    window.closePricingScreen();
    if (typeof assinarPro === 'function') {
      assinarPro();
    }
  };

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    ffObUpdateDots();
    ffObUpdateBg();
    ffObUpdateCta();
    ffObSetupSwipe();

    /* Garante display correto do loginScreen */
    var ls = document.getElementById('loginScreen');
    if (ls && !ls.classList.contains('show')) {
      /* deixa o app.js controlar a visibilidade */
    }
  });
})();
