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
    'radial-gradient(ellipse at 30% 20%, rgba(255,107,0,0.18) 0%, transparent 60%)',
    'radial-gradient(ellipse at 70% 10%, rgba(99,102,241,0.15) 0%, transparent 60%)',
    'radial-gradient(ellipse at 20% 80%, rgba(16,185,129,0.12) 0%, transparent 60%)',
    'radial-gradient(ellipse at 50% 30%, rgba(255,107,0,0.25) 0%, transparent 60%)',
  ];

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
    if (!btn) return;
    var isLast = ffObCurrent === FF_OB_TOTAL - 1;
    btn.classList.toggle('ff-cta-final', isLast);
    btn.innerHTML = isLast
      ? 'Escolher meu plano <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'
      : 'Próximo <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
  }

  window.ffObGoTo = function (idx) {
    if (idx < 0 || idx >= FF_OB_TOTAL) return;
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
    if (ffObCurrent < FF_OB_TOTAL - 1) {
      window.ffObGoTo(ffObCurrent + 1);
    } else {
      window.ffObFinish();
    }
  };

  window.ffObFinish = function () {
    var ob = document.getElementById('onboarding');
    if (ob) { ob.style.display = 'none'; ob.classList.remove('show'); }
    document.body.classList.remove('overlay-open');
    localStorage.setItem('kronia_onboarded', '1');
    /* Mostra a tela de planos antes de entrar no app */
    if (typeof openPlanModal === 'function') {
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
      closePricingScreen();
      return;
    }
    // PRO e ULTRA redirecionam para o checkout
    closePricingScreen();
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
