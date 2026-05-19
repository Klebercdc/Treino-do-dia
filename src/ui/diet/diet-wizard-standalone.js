/* KroniA Diet Wizard Standalone — Anamnese nutricional */
(function(root) {
  'use strict';

  var SCREEN_ID = 'dietProfileWizardScreen';

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

  function buildAnamneseForm(options) {
    cleanupLegacyOverlay();

    var doc = root.document;
    if (!doc || !doc.body) return false;

    var screen = doc.createElement('div');
    screen.id = SCREEN_ID;
    screen.className = 'kdw-anamnese-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');

    screen.innerHTML = [
      '<div class="kdw-backdrop"></div>',
      '<section class="kdw-card">',
        '<button type="button" class="kdw-close" aria-label="Fechar">\xd7</button>',
        '<p class="kdw-kicker">Anamnese nutricional</p>',
        '<h2>Personalizar dieta com IA</h2>',
        '<p class="kdw-text">Confirme seus dados antes de gerar um novo plano alimentar.</p>',
        '<label>Objetivo',
          '<select id="kdwGoal">',
            '<option value="emagrecimento">Emagrecimento</option>',
            '<option value="hipertrofia">Hipertrofia</option>',
            '<option value="manutencao">Manuten\xe7\xe3o</option>',
            '<option value="saude">Sa\xfade e rotina</option>',
          '</select>',
        '</label>',
        '<label>Restri\xe7\xf5es ou observa\xe7\xf5es',
          '<textarea id="kdwNotes" rows="4" placeholder="Ex: intoler\xe2ncias, prefer\xeancias, rotina, alimentos que evita..."></textarea>',
        '</label>',
        '<button type="button" id="kdwSubmit" class="kdw-submit">Gerar dieta personalizada</button>',
      '</section>'
    ].join('');

    if (!doc.getElementById('kdwAnamneseStyle')) {
      var style = doc.createElement('style');
      style.id = 'kdwAnamneseStyle';
      style.textContent = [
        '.kdw-anamnese-screen{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;font-family:inherit}',
        '.kdw-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(10px)}',
        '.kdw-card{position:relative;width:100%;max-width:520px;background:#0f172a;color:#fff;border:1px solid rgba(34,197,94,.35);border-radius:28px 28px 0 0;padding:24px;box-shadow:0 -20px 70px rgba(0,0,0,.45)}',
        '.kdw-close{position:absolute;right:18px;top:14px;background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:999px;width:36px;height:36px;font-size:24px;cursor:pointer}',
        '.kdw-kicker{text-transform:uppercase;letter-spacing:.12em;color:#22c55e;font-weight:800;font-size:12px;margin:0 0 8px}',
        '.kdw-card h2{font-size:28px;margin:0 0 10px}',
        '.kdw-text{color:#a1a1aa;margin:0 0 18px;font-size:15px}',
        '.kdw-card label{display:block;color:#e5e7eb;font-weight:700;margin:14px 0 8px}',
        '.kdw-card select,.kdw-card textarea{width:100%;box-sizing:border-box;margin-top:8px;background:#020617;color:#fff;border:1px solid rgba(148,163,184,.35);border-radius:16px;padding:14px;font:inherit;outline:none}',
        '.kdw-submit{width:100%;margin-top:18px;border:0;border-radius:18px;padding:16px;background:#22c55e;color:#03130a;font-weight:900;font-size:16px;cursor:pointer;box-shadow:0 0 28px rgba(34,197,94,.35)}'
      ].join('');
      doc.head.appendChild(style);
    }

    doc.body.appendChild(screen);
    doc.body.classList.add('diet-wizard-active', 'overlay-open');

    function close() { cleanupLegacyOverlay(); }

    screen.querySelector('.kdw-close').addEventListener('click', close);
    screen.querySelector('.kdw-backdrop').addEventListener('click', close);

    screen.querySelector('#kdwSubmit').addEventListener('click', function() {
      var profileData = {
        goal: screen.querySelector('#kdwGoal').value,
        notes: screen.querySelector('#kdwNotes').value || '',
        source: 'standalone_anamnese',
        updatedAt: new Date().toISOString()
      };

      try {
        root.localStorage && root.localStorage.setItem('kronia_diet_anamnese_profile', JSON.stringify(profileData));
      } catch (_) {}

      close();

      if (options && typeof options.onComplete === 'function') return options.onComplete(profileData);
      if (options && typeof options.onFinish === 'function') return options.onFinish(profileData);
      if (options && typeof options.onSubmit === 'function') return options.onSubmit(profileData);

      safeToast('Anamnese salva. Agora gere sua dieta personalizada.', 'success', 3000);
      return true;
    });

    return true;
  }

  function openDietWizardStandalone(options) {
    cleanupLegacyOverlay();
    return buildAnamneseForm(options || {});
  }

  root.openDietWizardStandalone = openDietWizardStandalone;
  root.openDietProfileWizard = openDietWizardStandalone;
  root.closeDietProfileWizard = cleanupLegacyOverlay;
  root.__kroniaDietWizardStandaloneLoaded = true;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', cleanupLegacyOverlay, { once: true });
    } else {
      cleanupLegacyOverlay();
    }
  }
})(window);
