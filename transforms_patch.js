/* ═══════════════════════════════════════════════════
TRANSFORMS PATCH — aplica Transform Kernel no app.js
sem precisar modificar o app.js diretamente
═══════════════════════════════════════════════════ */
(function() {
function aplicarPatch() {
// Patch 1: sendOrientExpert
if (typeof sendOrientExpert === 'function') {
const _origOrient = sendOrientExpert;
window.sendOrientExpert = async function() {
const input = document.getElementById('orientExpertInput');
const txt = input ? input.value.trim() : '';
// Defensive transforms antes de enviar
try { if (typeof runDefensiveTransforms === 'function') runDefensiveTransforms(txt); } catch(e) {}
await _origOrient.apply(this, arguments);
// Após resposta, roda Transform Kernel
setTimeout(() => {
try {
const msgs = document.getElementById('orientExpertMessages');
if (msgs && txt) {
const bubbles = msgs.querySelectorAll('.ai-bubble');
const last = bubbles[bubbles.length - 1];
const botText = last ? last.textContent : '';
runTransforms(txt, botText, 'orientExpertMessages');
}
} catch(e) {}
}, 300);
};
}

// Patch 2: sendAI
if (typeof sendAI === 'function') {
  const _origAI = sendAI;
  window.sendAI = async function(overrideText, isGerarTreino) {
    const input = document.getElementById('aiInput');
    const txt = overrideText || (input ? input.value.trim() : '');
    // Defensive transforms antes de enviar
    try { if (typeof runDefensiveTransforms === 'function') runDefensiveTransforms(txt); } catch(e) {}
    await _origAI.apply(this, arguments);
    setTimeout(() => {
      try {
        const msgs = document.getElementById('aiMessages');
        if (msgs && txt) {
          const bubbles = msgs.querySelectorAll('.ai-bubble');
          const last = bubbles[bubbles.length - 1];
          const botText = last ? last.textContent : '';
          runTransforms(txt, botText, 'aiMessages');
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