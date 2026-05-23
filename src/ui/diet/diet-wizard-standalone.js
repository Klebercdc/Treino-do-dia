/* KroniA Diet Wizard Standalone — Anamnese nutricional premium
 * Objetivo: impedir dieta genérica/fallback por falta de dados críticos.
 * Este wizard coleta o mínimo clínico-operacional necessário para alimentar o motor de dieta.
 */
(function(root) {
  'use strict';

  var SCREEN_ID = 'dietProfileWizardScreen';
  var PROFILE_KEY = 'kronia_diet_anamnese_profile';

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

  function readSavedProfile() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function toNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    var parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function splitList(value) {
    if (Array.isArray(value)) return value.map(String).map(function(item) { return item.trim(); }).filter(Boolean);
    if (typeof value !== 'string') return [];
    return value.split(/[,;\n]+/).map(function(item) { return item.trim(); }).filter(Boolean);
  }

  function setValue(screen, id, value) {
    var el = screen.querySelector('#' + id);
    if (!el || value === undefined || value === null) return;
    el.value = Array.isArray(value) ? value.join(', ') : String(value);
  }

  function showError(screen, message) {
    var error = screen.querySelector('#kdwError');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    }
    safeToast(message, 'warning', 3500);
  }

  function validateProfile(profile) {
    var missing = [];
    if (!profile.objetivo) missing.push('objetivo');
    if (!profile.sexo) missing.push('sexo');
    if (!profile.idade || profile.idade < 10 || profile.idade > 100) missing.push('idade válida');
    if (!profile.peso || profile.peso < 25 || profile.peso > 350) missing.push('peso válido');
    if (!profile.altura || profile.altura < 100 || profile.altura > 230) missing.push('altura válida');
    if (!profile.nivelAtividade) missing.push('nível de atividade');
    if (!profile.refeicoesPorDia || profile.refeicoesPorDia < 2 || profile.refeicoesPorDia > 8) missing.push('refeições por dia');
    return missing;
  }

  function buildAnamneseForm(options) {
    cleanupLegacyOverlay();

    var doc = root.document;
    if (!doc || !doc.body) return false;

    var saved = readSavedProfile();
    var screen = doc.createElement('div');
    screen.id = SCREEN_ID;
    screen.className = 'kdw-anamnese-screen kdw-screen show';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');

    screen.innerHTML = [
      '<div class="kdw-backdrop"></div>',
      '<section class="kdw-card app-scroll">',
        '<button type="button" class="kdw-close" aria-label="Fechar">\xd7</button>',
        '<p class="kdw-kicker">Anamnese nutricional premium</p>',
        '<h2>Personalizar dieta com IA</h2>',
        '<p class="kdw-text">Preencha os dados essenciais para o KRONIA gerar uma dieta realmente personalizada, sem cair em plano genérico.</p>',
        '<div id="kdwError" class="kdw-error" style="display:none"></div>',

        '<div class="kdw-grid">',
          '<label>Objetivo',
            '<select id="kdwGoal">',
              '<option value="emagrecimento">Emagrecimento</option>',
              '<option value="hipertrofia">Hipertrofia</option>',
              '<option value="manutencao">Manutenção</option>',
              '<option value="saude">Saúde e rotina</option>',
            '</select>',
          '</label>',
          '<label>Sexo',
            '<select id="kdwSexo">',
              '<option value="masculino">Masculino</option>',
              '<option value="feminino">Feminino</option>',
            '</select>',
          '</label>',
          '<label>Idade',
            '<input id="kdwIdade" inputmode="numeric" type="number" min="10" max="100" placeholder="Ex: 35" />',
          '</label>',
          '<label>Peso atual (kg)',
            '<input id="kdwPeso" inputmode="decimal" type="number" min="25" max="350" step="0.1" placeholder="Ex: 82" />',
          '</label>',
          '<label>Altura (cm)',
            '<input id="kdwAltura" inputmode="numeric" type="number" min="100" max="230" placeholder="Ex: 178" />',
          '</label>',
          '<label>Refeições/dia',
            '<select id="kdwRefeicoes">',
              '<option value="3">3 refeições</option>',
              '<option value="4" selected>4 refeições</option>',
              '<option value="5">5 refeições</option>',
              '<option value="6">6 refeições</option>',
            '</select>',
          '</label>',
          '<label>Nível de atividade',
            '<select id="kdwAtividade">',
              '<option value="sedentario">Sedentário</option>',
              '<option value="leve">Leve</option>',
              '<option value="moderado" selected>Moderado</option>',
              '<option value="intenso">Intenso</option>',
              '<option value="muito_intenso">Muito intenso</option>',
            '</select>',
          '</label>',
          '<label>Padrão alimentar',
            '<select id="kdwPadrao">',
              '<option value="onivoro">Onívoro</option>',
              '<option value="low_carb">Low carb</option>',
              '<option value="vegetariano">Vegetariano</option>',
              '<option value="flexivel">Flexível</option>',
            '</select>',
          '</label>',
        '</div>',

        '<label>Preferências alimentares',
          '<textarea id="kdwPreferencias" rows="3" placeholder="Ex: frango, ovos, arroz, feijão, banana, iogurte..."></textarea>',
        '</label>',
        '<label>Alimentos que evita ou não gosta',
          '<textarea id="kdwEvitar" rows="3" placeholder="Ex: peixe, leite, brócolis, alimentos muito caros..."></textarea>',
        '</label>',
        '<label>Restrições, patologias ou alertas clínicos',
          '<textarea id="kdwRestricoes" rows="3" placeholder="Ex: diabetes, hipertensão, doença renal, intolerância à lactose, alergias..."></textarea>',
        '</label>',
        '<label>Rotina e observações',
          '<textarea id="kdwNotes" rows="4" placeholder="Ex: horário de trabalho, treino à noite, pouco tempo para cozinhar, marmita..."></textarea>',
        '</label>',
        '<p class="kdw-alert">A dieta gerada é apoio educacional e não substitui nutricionista, especialmente em doença renal, diabetes, gestação, câncer ou outras condições clínicas.</p>',
        '<button type="button" id="kdwSubmit" class="kdw-submit">Gerar dieta personalizada</button>',
      '</section>'
    ].join('');

    if (!doc.getElementById('kdwAnamneseStyle')) {
      var style = doc.createElement('style');
      style.id = 'kdwAnamneseStyle';
      style.textContent = [
        '.kdw-anamnese-screen{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;font-family:inherit}',
        '.kdw-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.76);backdrop-filter:blur(12px)}',
        '.kdw-card{position:relative;width:100%;max-width:560px;max-height:min(92vh,860px);overflow:auto;background:linear-gradient(180deg,#0f172a,#020617);color:#fff;border:1px solid rgba(34,197,94,.35);border-radius:28px 28px 0 0;padding:24px;box-shadow:0 -20px 70px rgba(0,0,0,.55),0 0 36px rgba(34,197,94,.14);-webkit-overflow-scrolling:touch}',
        '.kdw-close{position:absolute;right:18px;top:14px;background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:999px;width:36px;height:36px;font-size:24px;cursor:pointer}',
        '.kdw-kicker{text-transform:uppercase;letter-spacing:.12em;color:#22c55e;font-weight:900;font-size:12px;margin:0 0 8px}',
        '.kdw-card h2{font-size:28px;margin:0 42px 10px 0;line-height:1.05}',
        '.kdw-text{color:#a1a1aa;margin:0 0 18px;font-size:15px;line-height:1.45}',
        '.kdw-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
        '.kdw-card label{display:block;color:#e5e7eb;font-weight:800;margin:12px 0 8px;font-size:13px}',
        '.kdw-card select,.kdw-card textarea,.kdw-card input{width:100%;box-sizing:border-box;margin-top:8px;background:#020617;color:#fff;border:1px solid rgba(148,163,184,.35);border-radius:16px;padding:13px;font:inherit;outline:none}',
        '.kdw-card textarea{resize:vertical;min-height:76px}',
        '.kdw-card select:focus,.kdw-card textarea:focus,.kdw-card input:focus{border-color:rgba(34,197,94,.75);box-shadow:0 0 0 3px rgba(34,197,94,.12)}',
        '.kdw-submit{width:100%;margin-top:18px;border:0;border-radius:18px;padding:16px;background:#22c55e;color:#03130a;font-weight:950;font-size:16px;cursor:pointer;box-shadow:0 0 28px rgba(34,197,94,.35)}',
        '.kdw-error{margin:0 0 14px;padding:12px;border-radius:14px;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35);color:#fecaca;font-size:13px;font-weight:700}',
        '.kdw-alert{margin:14px 0 0;color:#fde68a;background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.25);border-radius:14px;padding:12px;font-size:12px;line-height:1.45}',
        '@media(max-width:430px){.kdw-card{padding:22px 18px}.kdw-grid{grid-template-columns:1fr}.kdw-card h2{font-size:25px}}'
      ].join('');
      doc.head.appendChild(style);
    }

    doc.body.appendChild(screen);
    doc.body.classList.add('diet-wizard-active', 'overlay-open');

    setValue(screen, 'kdwGoal', saved.objetivo || saved.goal);
    setValue(screen, 'kdwSexo', saved.sexo);
    setValue(screen, 'kdwIdade', saved.idade);
    setValue(screen, 'kdwPeso', saved.peso);
    setValue(screen, 'kdwAltura', saved.altura);
    setValue(screen, 'kdwRefeicoes', saved.refeicoesPorDia);
    setValue(screen, 'kdwAtividade', saved.nivelAtividade);
    setValue(screen, 'kdwPadrao', saved.padraoAlimentar);
    setValue(screen, 'kdwPreferencias', saved.preferencias || saved.preferenciasAlimentares);
    setValue(screen, 'kdwEvitar', saved.alimentosEvitar || saved.alimentosQueEvita);
    setValue(screen, 'kdwRestricoes', saved.restricoes || saved.restricoesAlimentares || saved.patologias);
    setValue(screen, 'kdwNotes', saved.observacoes || saved.notes || saved.rotina);

    function close() { cleanupLegacyOverlay(); }

    screen.querySelector('.kdw-close').addEventListener('click', close);
    screen.querySelector('.kdw-backdrop').addEventListener('click', close);

    screen.querySelector('#kdwSubmit').addEventListener('click', function() {
      var objetivo = screen.querySelector('#kdwGoal').value;
      var sexo = screen.querySelector('#kdwSexo').value;
      var idade = toNumber(screen.querySelector('#kdwIdade').value);
      var peso = toNumber(screen.querySelector('#kdwPeso').value);
      var altura = toNumber(screen.querySelector('#kdwAltura').value);
      var refeicoesPorDia = toNumber(screen.querySelector('#kdwRefeicoes').value);
      var nivelAtividade = screen.querySelector('#kdwAtividade').value;
      var padraoAlimentar = screen.querySelector('#kdwPadrao').value;
      var preferencias = splitList(screen.querySelector('#kdwPreferencias').value);
      var alimentosEvitar = splitList(screen.querySelector('#kdwEvitar').value);
      var restricoes = splitList(screen.querySelector('#kdwRestricoes').value);
      var observacoes = screen.querySelector('#kdwNotes').value || '';

      var profileData = {
        goal: objetivo,
        objetivo: objetivo,
        sexo: sexo,
        idade: idade,
        peso: peso,
        altura: altura,
        refeicoesPorDia: refeicoesPorDia,
        nivelAtividade: nivelAtividade,
        rotina: nivelAtividade,
        padraoAlimentar: padraoAlimentar,
        preferencias: preferencias,
        preferenciasAlimentares: preferencias,
        alimentosEvitar: alimentosEvitar,
        alimentosQueEvita: alimentosEvitar,
        restricoes: restricoes,
        restricoesAlimentares: restricoes,
        patologias: restricoes,
        observacoes: observacoes,
        notes: observacoes,
        profile: {
          objetivo: objetivo,
          sexo: sexo,
          idade: idade,
          peso: peso,
          altura: altura,
          refeicoesPorDia: refeicoesPorDia,
          nivelAtividade: nivelAtividade,
          padraoAlimentar: padraoAlimentar,
          preferencias: preferencias,
          alimentosEvitar: alimentosEvitar,
          restricoes: restricoes,
          observacoes: observacoes
        },
        dietWizardPayload: {
          objetivo: objetivo,
          sexo: sexo,
          idade: idade,
          peso: peso,
          altura: altura,
          refeicoesPorDia: refeicoesPorDia,
          nivelAtividade: nivelAtividade,
          rotina: nivelAtividade,
          padraoAlimentar: padraoAlimentar,
          preferenciasAlimentares: preferencias,
          alimentosQueEvita: alimentosEvitar,
          restricoesAlimentares: restricoes,
          patologias: restricoes,
          observacoes: observacoes
        },
        source: 'standalone_anamnese_premium',
        personalizationReady: true,
        updatedAt: new Date().toISOString()
      };

      var missing = validateProfile(profileData);
      if (missing.length) {
        showError(screen, 'Complete antes de gerar: ' + missing.join(', ') + '.');
        return false;
      }

      try {
        root.localStorage && root.localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
        root.localStorage && root.localStorage.setItem('kronia_nutrition_profile_v1', JSON.stringify(profileData));
      } catch (_) {}

      close();

      if (options && typeof options.onComplete === 'function') return options.onComplete(profileData);
      if (options && typeof options.onFinish === 'function') return options.onFinish(profileData);
      if (options && typeof options.onSubmit === 'function') return options.onSubmit(profileData);

      safeToast('Anamnese premium salva. Agora gere sua dieta personalizada.', 'success', 3000);
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
