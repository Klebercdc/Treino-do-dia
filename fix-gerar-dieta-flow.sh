#!/usr/bin/env bash
set -euo pipefail

echo "🔎 KRONIA — Correção direcionada: Gerar Dieta"

FILES=(
  "src/ui/diet/diet-entry-controller.js"
  "src/ui/diet/diet-wizard.js"
  "src/ui/diet/diet-wizard-standalone.js"
  "index.html"
  "sw.js"
)

TS="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="backup/fix-gerar-dieta-$TS"

echo "💾 Criando backup em $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
    echo "  ✅ backup: $f"
  else
    echo "  ⚠️ não encontrado: $f"
  fi
done

echo "🛠️ Aplicando correção..."

node <<'NODE'
const fs = require('fs');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ atualizado: ${file}`);
}

function patchIndexHtml() {
  const file = 'index.html';
  let html = read(file);

  const oldInline = `closeOrientacao();navTo('dieta');openDietDataScreen()`;
  const newInline = `closeOrientacao();(window.KroniaDiet&&typeof window.KroniaDiet.generate==='function'?window.KroniaDiet.generate({source:'kronos_shortcut'}):(typeof window.generateDietPlan==='function'?window.generateDietPlan({source:'kronos_shortcut'}):(navTo('dieta'),openDietDataScreen&&openDietDataScreen())))`;

  if (html.includes(oldInline)) {
    html = html.split(oldInline).join(newInline);
  }

  write(file, html);
}

function patchServiceWorker() {
  const file = 'sw.js';
  let sw = read(file);

  const stamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
  sw = sw.replace(
    /const CACHE = ['"][^'"]+['"];/,
    `const CACHE = 'kronia-diet-generate-fix-${stamp}';`
  );

  sw = sw.replace(
    /const BUILD_VERSION = ['"][^'"]+['"];/,
    `const BUILD_VERSION = '${stamp}-diet-generate-fix';`
  );

  write(file, sw);
}

function writeDietWizardShim() {
  const content = `/* KroniA Diet Wizard Compatibility
 * Este arquivo não deve mais bloquear a criação de dieta.
 * Ele apenas redireciona chamadas antigas para a entrada única:
 * window.KroniaDiet.generate()
 */
(function(root) {
  'use strict';

  function cleanupLegacyOverlay() {
    var screen = root.document && root.document.getElementById('dietProfileWizardScreen');
    if (screen && screen.parentNode) screen.parentNode.removeChild(screen);

    try {
      [
        'kronia_diet_wizard_state_v1',
        'kronia_diet_wizard_state_v2',
        'kronia_diet_wizard_state_v6_standalone'
      ].forEach(function(key) {
        root.localStorage && root.localStorage.removeItem(key);
      });
    } catch (_) {}

    if (root.document && root.document.body) {
      root.document.body.classList.remove(
        'diet-wizard-active',
        'kdw-active',
        'nutrition-flow-active',
        'overlay-open'
      );
    }
  }

  function openGenerateDietFlow(context) {
    cleanupLegacyOverlay();

    if (root.KroniaDiet && typeof root.KroniaDiet.generate === 'function') {
      return root.KroniaDiet.generate(Object.assign({
        source: 'diet_wizard_compat'
      }, context || {}));
    }

    if (typeof root.generateDietPlan === 'function' && root.generateDietPlan !== openGenerateDietFlow) {
      return root.generateDietPlan(Object.assign({
        source: 'diet_wizard_compat_generateDietPlan'
      }, context || {}));
    }

    if (root.KroniaDiet && typeof root.KroniaDiet.open === 'function') {
      return root.KroniaDiet.open({
        source: 'diet_wizard_compat_fallback_open',
        forceNew: true
      });
    }

    try {
      if (typeof root.navTo === 'function') root.navTo('dieta');
      if (typeof root.openDietDataScreen === 'function') {
        root.openDietDataScreen();
        return true;
      }
    } catch (_) {}

    if (typeof root.showToast === 'function') {
      root.showToast('Não consegui abrir a criação da dieta. Atualize o app e tente novamente.', 'error', 3500);
    }

    return false;
  }

  root.openDietProfileWizard = openGenerateDietFlow;
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
`;

  write('src/ui/diet/diet-wizard.js', content);
  write('src/ui/diet/diet-wizard-standalone.js', content);
}

function writeDietEntryController() {
  const content = `/* KroniA Diet Entry Controller
 * Correção: separa abrir dieta existente de gerar nova dieta.
 */
(function() {
  'use strict';

  var RENDERER_ASSET = 'src/ui/diet/diet-plan-renderer.js';
  var VERSION = '20260518-generate-diet-flow';
  var rendererPromise = null;
  var opening = false;
  var generating = false;
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';

  var LEGACY_WIZARD_SCREEN_ID = ['diet', 'Profile', 'Wizard', 'Screen'].join('');
  var LEGACY_WIZARD_STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  function safeToast(message, type, duration) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type || 'info', duration || 3000);
      }
    } catch (_) {}
  }

  function loadScriptOnce(src, marker, testFn) {
    if (typeof testFn === 'function' && testFn()) return Promise.resolve(true);

    return new Promise(function(resolve) {
      var existing = document.querySelector('script[data-kronia-loader="' + marker + '"]');
      if (existing) existing.remove();

      var s = document.createElement('script');
      s.src = '/' + src + '?v=' + VERSION + '&t=' + Date.now();
      s.async = false;
      s.defer = false;
      s.dataset.kroniaLoader = marker;

      s.onload = function() {
        resolve(typeof testFn === 'function' ? !!testFn() : true);
      };

      s.onerror = function() {
        resolve(false);
      };

      document.head.appendChild(s);
    });
  }

  function loadRenderer() {
    if (window.__kroniaDietPlanRendererLoaded || typeof window.renderDietFromPlan === 'function') {
      return Promise.resolve(true);
    }

    if (rendererPromise) return rendererPromise;

    rendererPromise = loadScriptOnce(RENDERER_ASSET, 'diet-renderer', function() {
      return typeof window.renderDietFromPlan === 'function';
    });

    return rendererPromise;
  }

  function purgeLegacyWizard() {
    LEGACY_WIZARD_STATE_KEYS.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    var oldWizard = document.getElementById(LEGACY_WIZARD_SCREEN_ID);
    if (oldWizard) oldWizard.remove();

    if (document.body) {
      document.body.classList.remove('diet-wizard-active', 'kdw-active', 'overlay-open');
    }
  }

  function hideLegacyScreens() {
    purgeLegacyWizard();

    [
      'nutritionFlowScreen',
      'dietChoiceScreen',
      'dietEmergencyWizardScreen',
      'customModal',
      'configSheet',
      'timerSheet'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;

      el.classList.remove('show', 'active', 'open');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });

    if (document.body) {
      document.body.classList.remove(
        'nutrition-flow-active',
        'diet-wizard-active',
        'kdw-active',
        'overlay-open'
      );
    }

    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') {
      window.KroniaUI.unblockScreens('diet-entry-hide-legacy');
    }
  }

  function hasLastGeneratedDiet() {
    try {
      return !!localStorage.getItem(LAST_PLAN_KEY);
    } catch (_) {
      return false;
    }
  }

  async function openPremiumDiet(context) {
    if (opening) return false;
    opening = true;

    try {
      hideLegacyScreens();
      await loadRenderer();

      if (hasLastGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
        var rendered = window.openLastGeneratedDiet();
        if (rendered !== false) return rendered;
      }

      if (typeof window.openDietDataScreen === 'function') {
        try {
          if (
            typeof window.readLocalActiveDietPlan === 'function' &&
            !window.readLocalActiveDietPlan() &&
            typeof window.buildFallbackActiveDietPlan === 'function' &&
            typeof window.setActiveDietPlan === 'function'
          ) {
            window.setActiveDietPlan(window.buildFallbackActiveDietPlan(), { render: false });
          }
        } catch (_) {}

        try {
          if (typeof window.navTo === 'function') window.navTo('dieta');
        } catch (_) {}

        window.openDietDataScreen();
        hideLegacyScreens();
        return true;
      }

      safeToast('Não consegui abrir a tela de dieta. Atualize a página e tente novamente.', 'error', 3500);
      return false;
    } finally {
      setTimeout(function() {
        opening = false;
      }, 250);
    }
  }

  function callFirstAvailable(functionNames, context) {
    for (var i = 0; i < functionNames.length; i++) {
      var name = functionNames[i];
      var fn = window[name];

      if (typeof fn !== 'function') continue;
      if (fn === openDietGenerationFlow) continue;
      if (fn.__kroniaDietEntryWrapper) continue;

      try {
        return {
          called: true,
          value: fn.call(window, context || {})
        };
      } catch (err) {
        console.warn('[KroniA Diet] Falha ao chamar ' + name, err);
      }
    }

    return { called: false, value: false };
  }

  async function openDietGenerationFlow(context) {
    if (generating) return false;
    generating = true;

    try {
      hideLegacyScreens();

      try {
        if (typeof window.navTo === 'function') window.navTo('dieta');
      } catch (_) {}

      await loadRenderer();

      /*
       * Ordem proposital:
       * 1. Primeiro tenta funções reais de geração, se existirem no app.
       * 2. Depois tenta fluxos visuais de criação/configuração.
       * 3. Só no final cai na tela premium existente como fallback.
       */
      var realGeneration = callFirstAvailable([
        'gerarDieta',
        'generateAIDiet',
        'generateDiet',
        'createAIDiet',
        'createDiet',
        'startNutritionGeneration',
        'startDietGeneration',
        'openDietGenerationWizard',
        'openNutritionWizard',
        'openDietWizard',
        'openDietSetupWizard',
        'openDietEmergencyWizard',
        'openNutritionFlowFull'
      ], Object.assign({ source: 'kronia_diet_generate' }, context || {}));

      if (realGeneration.called) {
        return realGeneration.value;
      }

      if (typeof window.preencherDietaDosPerfil === 'function') {
        try {
          window.preencherDietaDosPerfil();
        } catch (err) {
          console.warn('[KroniA Diet] preencherDietaDosPerfil falhou', err);
        }
      }

      /*
       * Fallback controlado:
       * se não existe motor exposto no runtime, abre a tela de dieta e mostra aviso claro,
       * em vez de parecer que o botão não funciona.
       */
      if (typeof window.openDietDataScreen === 'function') {
        window.openDietDataScreen();
        safeToast('Abrindo Dieta. Motor de geração não encontrado no runtime; verifique exports do motor/API.', 'warning', 4500);
        return true;
      }

      safeToast('Não encontrei o fluxo de geração de dieta no app.', 'error', 4000);
      return false;
    } finally {
      setTimeout(function() {
        generating = false;
      }, 350);
    }
  }

  function isGenerateDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;

    return target.closest([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '#generateDietPlanBtn',
      '#dietGeneratePlanBtn',
      '#btnGenerateDiet',
      '#btnCreateDiet',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan',
      '.create-diet-plan'
    ].join(','));
  }

  function isOpenDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;

    return target.closest([
      '#openDietPlanBtn',
      '#viewDietPlanBtn',
      '#dietViewPlanBtn',
      '[data-action="open-diet"]',
      '[data-action="view-diet"]',
      '[data-diet-action="open"]',
      '[data-diet-action="view"]',
      '.open-diet-plan',
      '.view-diet-plan'
    ].join(','));
  }

  function makeTouchable() {
    document.querySelectorAll([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '#generateDietPlanBtn',
      '#dietGeneratePlanBtn',
      '#btnGenerateDiet',
      '#btnCreateDiet',
      '#openDietPlanBtn',
      '#viewDietPlanBtn',
      '#dietViewPlanBtn',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-action="open-diet"]',
      '[data-action="view-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '[data-diet-action="open"]',
      '[data-diet-action="view"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan',
      '.create-diet-plan',
      '.open-diet-plan',
      '.view-diet-plan'
    ].join(',')).forEach(function(btn) {
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';

      if (!btn.style.position) btn.style.position = 'relative';
      if (!btn.style.zIndex) btn.style.zIndex = '80';

      btn.setAttribute('aria-disabled', 'false');
    });
  }

  document.addEventListener('click', function(e) {
    var generateBtn = isGenerateDietButton(e.target);

    if (generateBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDietGenerationFlow({
        source: 'diet_generate_button_click',
        id: generateBtn.id || '',
        action: generateBtn.getAttribute('data-action') || generateBtn.getAttribute('data-diet-action') || ''
      });
      return;
    }

    var openBtn = isOpenDietButton(e.target);

    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      openPremiumDiet({
        source: 'diet_open_button_click',
        id: openBtn.id || ''
      });
    }
  }, true);

  function markWrapper(fn) {
    try {
      fn.__kroniaDietEntryWrapper = true;
    } catch (_) {}
    return fn;
  }

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    open: openPremiumDiet,
    generate: openDietGenerationFlow,
    ai: openDietGenerationFlow,
    createPlan: openDietGenerationFlow,
    regenerate: openDietGenerationFlow,
    viewLastPlan: openPremiumDiet,
    bindButtons: makeTouchable,
    hideLegacyScreens: hideLegacyScreens,
    loadRenderer: loadRenderer
  });

  window.startAIDiet = markWrapper(openDietGenerationFlow);
  window.createDietPlan = markWrapper(openDietGenerationFlow);
  window.generateDietPlan = markWrapper(openDietGenerationFlow);
  window.regenerateDiet = markWrapper(openDietGenerationFlow);
  window.regenerateDietPlan = markWrapper(openDietGenerationFlow);
  window.regeneratePlan = markWrapper(openDietGenerationFlow);

  /*
   * Compatibilidade:
   * chamadas antigas de wizard agora abrem o fluxo de geração,
   * não mais a tela premium existente.
   */
  window.openDietProfileWizard = markWrapper(openDietGenerationFlow);

  /*
   * Chamadas antigas de nutrition flow só viram fallback para geração.
   * O callFirstAvailable ignora wrappers marcados para evitar recursão.
   */
  window.openNutritionFlow = markWrapper(function(context) {
    return openDietGenerationFlow(Object.assign({
      source: 'open_nutrition_flow_compat'
    }, context || {}));
  });

  window.openNutritionFlowFull = markWrapper(function(context) {
    return openDietGenerationFlow(Object.assign({
      source: 'open_nutrition_flow_full_compat'
    }, context || {}));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      makeTouchable();
      hideLegacyScreens();
      loadRenderer();
    }, { once: true });
  } else {
    makeTouchable();
    hideLegacyScreens();
    loadRenderer();
  }
})();
`;

  write('src/ui/diet/diet-entry-controller.js', content);
}

writeDietEntryController();
writeDietWizardShim();
patchIndexHtml();
patchServiceWorker();

console.log('✅ Correção JS aplicada.');
NODE

echo "🔍 Verificando sintaxe JS..."
node --check src/ui/diet/diet-entry-controller.js
node --check src/ui/diet/diet-wizard.js
node --check src/ui/diet/diet-wizard-standalone.js
node --check sw.js

echo "🧪 Rodando validações disponíveis..."
if [ -f package.json ]; then
  if npm run | grep -q "lint"; then
    npm run lint || echo "⚠️ lint falhou — revisar output acima"
  else
    echo "ℹ️ sem script lint"
  fi

  if npm run | grep -q "build"; then
    npm run build || echo "⚠️ build falhou — revisar output acima"
  else
    echo "ℹ️ sem script build"
  fi

  if npm run | grep -q "test"; then
    npm test || echo "⚠️ test falhou — revisar output acima"
  else
    echo "ℹ️ sem script test"
  fi
fi

echo "📌 Diff resumido:"
git diff -- src/ui/diet/diet-entry-controller.js src/ui/diet/diet-wizard.js src/ui/diet/diet-wizard-standalone.js index.html sw.js | sed -n '1,220p'

echo ""
echo "✅ Finalizado."
echo ""
echo "Agora teste no console do navegador:"
echo "typeof window.KroniaDiet.generate"
echo "typeof window.generateDietPlan"
echo "typeof window.openDietProfileWizard"
echo ""
echo "Se estiver tudo ok:"
echo "git add src/ui/diet/diet-entry-controller.js src/ui/diet/diet-wizard.js src/ui/diet/diet-wizard-standalone.js index.html sw.js backup/"
echo "git commit -m \"fix(diet): restore generate diet flow entrypoint\""
echo "git push"
