/* ═══════════════════════════════════════════════════
TRANSFORMS PATCH — aplica Transform Kernel no app.js
sem precisar modificar o app.js diretamente.

BRIDGE: chama /api/kronia/intent em paralelo com a
resposta do KRONOS para que os Transforms usem a
intenção classificada pelo IntentAgent (semântica),
não por palavras-chave.
═══════════════════════════════════════════════════ */

/**
 * Classifica a intenção da mensagem via IntentAgent (servidor).
 * Retorna a intent string ou "chat" como fallback seguro.
 */
async function _classifyIntentRemote(message, history) {
  try {
    const session = await _sb.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return "chat";

    const resp = await fetch(location.origin + "/api/kronia/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify({ message, history: history || [] }),
    });

    if (!resp.ok) return "chat";
    const data = await resp.json();
    return data.intent || "chat";
  } catch {
    return "chat";
  }
}

/* Detecta se uma resposta de texto contém estrutura de treino */
function _orientRespostaTemTreino(texto) {
  if (!texto || texto.length < 80) return false;
  var sinais = 0;
  if (/\d+\s*x\s*\d+|\d+\s*séries|\d+\s*repetições/i.test(texto)) sinais++;
  if (/supino|agachamento|rosca|remada|desenvolvimento|terra|pulldown|leg press/i.test(texto)) sinais++;
  if (/treino\s+[a-c]|treino\s+\d|dia\s+\d|exercício\s+\d/i.test(texto)) sinais++;
  if (/\b(séries|reps|repetições)\b/i.test(texto) && /\b(kg|carga|peso)\b/i.test(texto)) sinais++;
  return sinais >= 2;
}

/* Mostra botão de importar treino gerado pelo KRONOS para a tela */
function _mostrarBotaoImportarTreino(container, bubbleEl) {
  var oldWrap = container.querySelector('.transform-wrap');
  if (oldWrap) oldWrap.remove();

  var wrap = document.createElement('div');
  wrap.className = 'ai-msg assistant transform-wrap';

  var btn = document.createElement('button');
  btn.className = 'transform-btn';
  btn.style.cssText = 'display:block;width:100%;padding:12px 16px;' +
    'background:rgba(249,115,22,0.12);border:1.5px solid var(--accent);' +
    'border-radius:12px;color:var(--accent);font-family:var(--font);' +
    'font-size:0.88rem;font-weight:700;cursor:pointer;text-align:left;' +
    'transition:all .15s;animation:fadeInUp .3s ease;';

  try { btn.innerHTML = _ico('dumbbell', 14) + ' Importar treino para a tela'; }
  catch(e) { btn.textContent = 'Importar treino para a tela'; }

  btn.addEventListener('touchstart', function() {
    btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
  }, { passive: true });
  btn.addEventListener('touchend', function() {
    setTimeout(function() {
      btn.style.background = 'rgba(249,115,22,0.12)'; btn.style.color = 'var(--accent)';
    }, 150);
  }, { passive: true });

  btn.onclick = function() {
    try {
      var textoTreino = bubbleEl ? bubbleEl.textContent : '';
      window._lastWorkoutReply = textoTreino;
      if (typeof applyAIWorkoutFromText === 'function') applyAIWorkoutFromText();
      try { closeOrientacao(); } catch(e) {}
      try { navTo('treino'); } catch(e) {}
      wrap.remove();
    } catch(e) { console.warn('[ImportTreino]', e); }
  };

  wrap.appendChild(btn);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

(function() {
function aplicarPatch() {
if (typeof sendOrientExpert === 'function') {
const _origOrient = sendOrientExpert;
window.sendOrientExpert = async function() {
  const input = document.getElementById('orientExpertInput');
  const txt = input ? input.value.trim() : '';
  var _defResult = [];
  try { if (typeof runDefensiveTransforms === 'function') _defResult = runDefensiveTransforms(txt); } catch(e) {}
  if (_defResult === 'block') return;
  var _blockedIds = Array.isArray(_defResult) ? _defResult : [];

  const intentPromise = _classifyIntentRemote(txt, typeof _orientExpertHistory !== 'undefined' ? _orientExpertHistory : []);

  await _origOrient.apply(this, arguments);

  const serverIntent = await intentPromise.catch(() => "chat");

  setTimeout(() => {
    try {
      const msgs = document.getElementById('orientExpertMessages');
      if (msgs && txt) {
        const bubbles = msgs.querySelectorAll('.ai-bubble');
        const last = bubbles[bubbles.length - 1];
        const botText = last ? last.textContent : '';
        const temExercicios = _orientRespostaTemTreino(botText);
        if (temExercicios) {
          _mostrarBotaoImportarTreino(msgs, last);
        } else {
          runTransforms(txt, botText, 'orientExpertMessages', _blockedIds, serverIntent);
        }
      }
    } catch(e) {}
  }, 400);
};
}

if (typeof sendAI === 'function') {
  const _origAI = sendAI;
  window.sendAI = async function(overrideText, isGerarTreino) {
    const input = document.getElementById('aiInput');
    const txt = overrideText || (input ? input.value.trim() : '');
    var _defResult = [];
    try { if (typeof runDefensiveTransforms === 'function') _defResult = runDefensiveTransforms(txt); } catch(e) {}
    if (_defResult === 'block') return;
    var _blockedIds = Array.isArray(_defResult) ? _defResult : [];

    const intentPromise = _classifyIntentRemote(txt, typeof _aiHistory !== 'undefined' ? _aiHistory : []);

    await _origAI.apply(this, arguments);

    const serverIntent = await intentPromise.catch(() => "chat");

    setTimeout(() => {
      try {
        const msgs = document.getElementById('aiMessages');
        if (msgs && txt) {
          const bubbles = msgs.querySelectorAll('.ai-bubble');
          const last = bubbles[bubbles.length - 1];
          const botText = last ? last.textContent : '';
          runTransforms(txt, botText, 'aiMessages', _blockedIds, serverIntent);
        }
      } catch(e) {}
    }, 300);
  };
}

}

if (document.readyState === 'complete') {
aplicarPatch();
} else {
window.addEventListener('load', aplicarPatch);
}
})();

/* ═══════════════════════════════════════════════════
STARTUP — inicia o cérebro vivo do app
═══════════════════════════════════════════════════ */
(function initKronosPulse() {
  var attempts = 0;
  function tryInit() {
    var scanOk  = typeof teSilentScan    === 'function';
    var pulseOk = typeof startKronosPulse === 'function';
    if (scanOk && pulseOk) {
      try { teSilentScan(); }    catch(e) {}
      try { startKronosPulse(); } catch(e) {}
      return;
    }
    if (++attempts < 20) setTimeout(tryInit, 500);
  }
  if (document.readyState === 'complete') {
    tryInit();
  } else {
    window.addEventListener('load', tryInit);
  }
})();

/* ═══════════════════════════════════════════════════
HOOKS POR TELA — antecipação contextual
═══════════════════════════════════════════════════ */
window.addEventListener('load', function() {
  setTimeout(function() {
    if (typeof openHome === 'function') {
      const _origHome = openHome;
      window.openHome = function() {
        _origHome.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof renderPulseInsight === 'function') renderPulseInsight(); } catch(e) {}
        }, 80);
      };
    }

    if (typeof navTo === 'function') {
      const _origNavTo = navTo;
      window.navTo = function(tab) {
        _origNavTo.apply(this, arguments);
        if (tab === 'treino') {
          setTimeout(function() {
            try { if (typeof pulseOnOpenTreino === 'function') pulseOnOpenTreino(); } catch(e) {}
          }, 250);
        }
        if (tab === 'inicio') {
          setTimeout(function() {
            try { if (typeof renderPulseInsight === 'function') renderPulseInsight(); } catch(e) {}
          }, 80);
        }
      };
    }

    if (typeof openDieta === 'function') {
      const _origDieta = openDieta;
      window.openDieta = function() {
        _origDieta.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof pulseOnOpenDieta === 'function') pulseOnOpenDieta(); } catch(e) {}
        }, 200);
      };
    }

    if (typeof verHistorico === 'function') {
      const _origHist = verHistorico;
      window.verHistorico = function() {
        _origHist.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof pulseOnOpenHistorico === 'function') pulseOnOpenHistorico(); } catch(e) {}
        }, 300);
      };
    }

    if (typeof openPerfil === 'function') {
      const _origPerfil = openPerfil;
      window.openPerfil = function() {
        _origPerfil.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof pulseOnOpenPerfil === 'function') pulseOnOpenPerfil(); } catch(e) {}
        }, 300);
      };
    }

  }, 1200);
});

/* ═══════════════════════════════════════════════════
PATCH 2: obFinish — pede login após onboarding
═══════════════════════════════════════════════════ */
window.addEventListener('load', function() {
setTimeout(function() {
if (typeof obFinish === 'function') {
window.obFinish = function() {
localStorage.setItem("titan_onboarded","1");
document.getElementById("onboarding").classList.remove("show");
_sb.auth.getSession().then(function(res) {
const session = res.data.session;
if (session && session.user) {
try { navTo('inicio'); openHome(); } catch(e) {}
} else {
document.getElementById('splashScreen').style.display = 'none';
document.getElementById('loginScreen').style.display = 'flex';
}
}).catch(function() {
document.getElementById('loginScreen').style.display = 'flex';
});
};
}
}, 1000);
});

/* ═══════════════════════════════════════════════════
DIET ANAMNESE BOOTSTRAP — carregado com certeza após app.js
Garante que a anamnese abra mesmo se o controller externo não tiver sido importado.
═══════════════════════════════════════════════════ */
(function kroniaDietAnamneseBootstrap() {
  var VERSION = '20260523-diet-bootstrap';
  var WIZARD_SRC = '/src/ui/diet/diet-wizard-standalone.js?v=' + VERSION;
  var CONTROLLER_SRC = '/src/ui/diet/diet-entry-controller.js?v=' + VERSION;
  var wizardLoading = null;
  var controllerLoading = null;

  function loadScript(src, id) {
    return new Promise(function(resolve) {
      var old = document.getElementById(id);
      if (old) old.remove();
      var s = document.createElement('script');
      s.id = id;
      s.src = src + '&t=' + Date.now();
      s.async = false;
      s.onload = function() { resolve(true); };
      s.onerror = function() { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function ensureWizard() {
    if (typeof window.openDietProfileWizard === 'function' && !window.openDietProfileWizard.__kroniaDietEntryWrapper) {
      return Promise.resolve(true);
    }
    if (typeof window.openDietWizardStandalone === 'function' && !window.openDietWizardStandalone.__kroniaDietEntryWrapper) {
      return Promise.resolve(true);
    }
    if (!wizardLoading) wizardLoading = loadScript(WIZARD_SRC, 'kronia-diet-wizard-force');
    return wizardLoading;
  }

  function ensureController() {
    if (window.KroniaDiet && typeof window.KroniaDiet.generate === 'function') return Promise.resolve(true);
    if (!controllerLoading) controllerLoading = loadScript(CONTROLLER_SRC, 'kronia-diet-controller-force');
    return controllerLoading;
  }

  function hideDietBlockers() {
    ['nutritionFlowScreen','dietChoiceScreen','dietEmergencyWizardScreen','customModal','bottomSheet','modalBackdrop','configSheet'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show','active','open');
      el.style.pointerEvents = 'none';
      if (id !== 'bottomSheet' && id !== 'modalBackdrop') {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      }
    });
  }

  async function openAnamneseForced(context) {
    try {
      hideDietBlockers();
      try { if (typeof navTo === 'function') navTo('dieta'); } catch(e) {}
      await ensureWizard();
      var fn = (typeof window.openDietProfileWizard === 'function' && !window.openDietProfileWizard.__kroniaDietEntryWrapper)
        ? window.openDietProfileWizard
        : (typeof window.openDietWizardStandalone === 'function' ? window.openDietWizardStandalone : null);
      if (!fn) {
        try { if (typeof showToast === 'function') showToast('Não consegui carregar a anamnese. Atualize o app.', 'error', 4000); } catch(e) {}
        return false;
      }
      return fn(Object.assign({ source: 'forced_diet_anamnese_bootstrap', forceAnamnese: true }, context || {}));
    } catch (err) {
      console.warn('[KRONIA_DIET_BOOTSTRAP]', err);
      return false;
    }
  }

  function isDietGenerateTarget(target) {
    return target && target.closest && target.closest([
      '#regenerateDietPlanBtn','#dietRegeneratePlanBtn','#createDietPlanBtn','#dietCreatePlanBtn',
      '#generateDietPlanBtn','#dietGeneratePlanBtn','#btnGenerateDiet','#btnCreateDiet',
      '[data-action="regenerate-diet"]','[data-action="generate-diet"]','[data-action="create-diet"]',
      '[data-diet-action="regenerate"]','[data-diet-action="generate"]','[data-diet-action="create"]',
      '.regenerate-diet-plan','.diet-regenerate-plan','.generate-diet-plan','.diet-generate-plan','.create-diet-plan'
    ].join(','));
  }

  function installDietHooks() {
    /* Se o controller oficial já está carregado com open() real, não sobrescreve. */
    var ctrl = window.KroniaDiet;
    var controllerReady = ctrl && typeof ctrl.open === 'function' && !ctrl.open.__kroniaDietEntryWrapper;
    if (controllerReady) {
      ensureController();
      return;
    }

    ensureController();

    var forceWrapper = function(context) { return openAnamneseForced(context || {}); };
    forceWrapper.__kroniaForcedAnamnese = true;

    if (!window.startAIDiet || window.startAIDiet.__kroniaForcedAnamnese) window.startAIDiet = forceWrapper;
    if (!window.createAnotherDiet || window.createAnotherDiet.__kroniaForcedAnamnese) window.createAnotherDiet = forceWrapper;
    if (!window.createDietPlan || window.createDietPlan.__kroniaForcedAnamnese) window.createDietPlan = forceWrapper;
    if (!window.generateDietPlan || window.generateDietPlan.__kroniaForcedAnamnese) window.generateDietPlan = forceWrapper;
    if (!window.regenerateDiet || window.regenerateDiet.__kroniaForcedAnamnese) window.regenerateDiet = forceWrapper;
    if (!window.regenerateDietPlan || window.regenerateDietPlan.__kroniaForcedAnamnese) window.regenerateDietPlan = forceWrapper;
    if (!window.regeneratePlan || window.regeneratePlan.__kroniaForcedAnamnese) window.regeneratePlan = forceWrapper;

    window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
      generate: forceWrapper,
      ai: forceWrapper,
      createPlan: forceWrapper,
      regenerate: forceWrapper,
      forceAnamnese: forceWrapper
    });

    document.addEventListener('click', function(ev) {
      var btn = isDietGenerateTarget(ev.target);
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      openAnamneseForced({
        source: 'forced_generate_click',
        id: btn.id || '',
        action: btn.getAttribute('data-action') || btn.getAttribute('data-diet-action') || ''
      });
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDietHooks, { once: true });
  } else {
    installDietHooks();
  }
})();
