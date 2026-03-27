/* ═══════════════════════════════════════════════════
TRANSFORMS PATCH — aplica Transform Kernel no app.js
sem precisar modificar o app.js diretamente
═══════════════════════════════════════════════════ */

/* Detecta se uma resposta de texto contém estrutura de treino */
function _orientRespostaTemTreino(texto) {
  if (!texto || texto.length < 80) return false;
  // Precisa de ao menos 2 sinais distintos de treino estruturado
  var sinais = 0;
  if (/\d+\s*x\s*\d+|\d+\s*séries|\d+\s*repetições/i.test(texto)) sinais++;
  if (/supino|agachamento|rosca|remada|desenvolvimento|terra|pulldown|leg press/i.test(texto)) sinais++;
  if (/treino\s+[a-c]|treino\s+\d|dia\s+\d|exercício\s+\d/i.test(texto)) sinais++;
  if (/\b(séries|reps|repetições)\b/i.test(texto) && /\b(kg|carga|peso)\b/i.test(texto)) sinais++;
  return sinais >= 2;
}

/* Mostra botão de importar treino gerado pelo KRONOS para a tela */
function _mostrarBotaoImportarTreino(container, bubbleEl) {
  // Remove wrap anterior se houver
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
// Patch 1: sendOrientExpert
if (typeof sendOrientExpert === 'function') {
const _origOrient = sendOrientExpert;
window.sendOrientExpert = async function() {
const input = document.getElementById('orientExpertInput');
const txt = input ? input.value.trim() : '';
// Defensive transforms: retorna IDs bloqueados ou 'block' para barrar envio
var _defResult = [];
try { if (typeof runDefensiveTransforms === 'function') _defResult = runDefensiveTransforms(txt); } catch(e) {}
if (_defResult === 'block') return; // rate_guard bloqueou
var _blockedIds = Array.isArray(_defResult) ? _defResult : [];
await _origOrient.apply(this, arguments);
// Após resposta, roda Transform Kernel + verifica se gerou treino
setTimeout(() => {
try {
const msgs = document.getElementById('orientExpertMessages');
if (msgs && txt) {
const bubbles = msgs.querySelectorAll('.ai-bubble');
const last = bubbles[bubbles.length - 1];
const botText = last ? last.textContent : '';
// Detecta se a resposta contém exercícios → mostra botão de importar
const temExercicios = _orientRespostaTemTreino(botText);
if (temExercicios) {
_mostrarBotaoImportarTreino(msgs, last);
} else {
runTransforms(txt, botText, 'orientExpertMessages', _blockedIds);
}
}
} catch(e) {}
}, 400);
};
}

// Patch 2: sendAI
if (typeof sendAI === 'function') {
  const _origAI = sendAI;
  window.sendAI = async function(overrideText, isGerarTreino) {
    const input = document.getElementById('aiInput');
    const txt = overrideText || (input ? input.value.trim() : '');
    // Defensive transforms: retorna IDs bloqueados ou 'block' para barrar envio
    var _defResult = [];
    try { if (typeof runDefensiveTransforms === 'function') _defResult = runDefensiveTransforms(txt); } catch(e) {}
    if (_defResult === 'block') return;
    var _blockedIds = Array.isArray(_defResult) ? _defResult : [];
    await _origAI.apply(this, arguments);
    setTimeout(() => {
      try {
        const msgs = document.getElementById('aiMessages');
        if (msgs && txt) {
          // Pega o texto da resposta do bot de forma robusta:
          // Ignora bubbles de botão (curtas ou com "Aplicar"/"Importar")
          // e pega a última bubble substantiva do assistant
          const allBubbles = msgs.querySelectorAll('.ai-msg.assistant:not(.transform-wrap) .ai-bubble:not(.thinking)');
          let botText = '';
          for (let i = allBubbles.length - 1; i >= 0; i--) {
            const t = (allBubbles[i].textContent || '').trim();
            if (t.length > 40 && !/^(Aplicar|Importar|Ver Plan)/i.test(t)) {
              botText = t;
              break;
            }
          }
          runTransforms(txt, botText, 'aiMessages', _blockedIds);
        }
      } catch(e) {}
    }, 300);
  };
}

}

// Aguarda app.js carregar completamente
if (document.readyState === 'complete') {
aplicarPatch();
} else {
window.addEventListener('load', aplicarPatch);
}
})();

/* ═══════════════════════════════════════════════════
STARTUP — inicia o cérebro vivo do app
═══════════════════════════════════════════════════ */
// Startup robusto: tenta até as funções existirem (máx 10s)
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
    if (++attempts < 20) setTimeout(tryInit, 500); // tenta a cada 500ms por até 10s
  }
  if (document.readyState === 'complete') {
    tryInit();
  } else {
    window.addEventListener('load', tryInit);
  }
})();

/* ═══════════════════════════════════════════════════
HOOKS POR TELA — antecipação contextual
Patcheia funções de abertura de tela para injetar
inteligência antes do usuário precisar perguntar
═══════════════════════════════════════════════════ */
window.addEventListener('load', function() {
  setTimeout(function() {

    // Hook: openHome → renderiza insight vivo
    if (typeof openHome === 'function') {
      const _origHome = openHome;
      window.openHome = function() {
        _origHome.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof renderPulseInsight === 'function') renderPulseInsight(); } catch(e) {}
        }, 80);
      };
    }

    // Hook: navTo('treino') — readiness toast
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

    // Hook: openDieta → injeta contexto de macro
    if (typeof openDieta === 'function') {
      const _origDieta = openDieta;
      window.openDieta = function() {
        _origDieta.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof pulseOnOpenDieta === 'function') pulseOnOpenDieta(); } catch(e) {}
        }, 200);
      };
    }

    // Hook: verHistorico → tendência de volume
    if (typeof verHistorico === 'function') {
      const _origHist = verHistorico;
      window.verHistorico = function() {
        _origHist.apply(this, arguments);
        setTimeout(function() {
          try { if (typeof pulseOnOpenHistorico === 'function') pulseOnOpenHistorico(); } catch(e) {}
        }, 300);
      };
    }

    // Hook: openPerfil → insight de consistência
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
// Aguarda app.js carregar
setTimeout(function() {
if (typeof obFinish === 'function') {
window.obFinish = function() {
localStorage.setItem("titan_onboarded","1");
document.getElementById("onboarding").classList.remove("show");
// Verifica se já está logado
_sb.auth.getSession().then(function(res) {
const session = res.data.session;
if (session && session.user) {
// Navega para a home corretamente
try { navTo('inicio'); openHome(); } catch(e) {}
} else {
// Não logado — mostra login
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