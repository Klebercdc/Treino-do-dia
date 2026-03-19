/* ═══════════════════════════════════════════════════
TRANSFORMS PATCH — aplica Transform Kernel no app.js
sem precisar modificar o app.js diretamente
═══════════════════════════════════════════════════ */
(function() {
function aplicarPatch() {
// Patch 1: sendOrientExpert
if (typeof sendOrientExpert === ‘function’) {
const _origOrient = sendOrientExpert;
window.sendOrientExpert = async function() {
const input = document.getElementById(‘orientExpertInput’);
const txt = input ? input.value.trim() : ‘’;
await _origOrient.apply(this, arguments);
// Após resposta, roda Transform
setTimeout(() => {
try {
const msgs = document.getElementById(‘orientExpertMessages’);
if (msgs && txt) {
const bubbles = msgs.querySelectorAll(’.ai-bubble’);
const last = bubbles[bubbles.length - 1];
const botText = last ? last.textContent : ‘’;
runTransforms(txt, botText, ‘orientExpertMessages’);
}
} catch(e) {}
}, 300);
};
}

```
// Patch 2: sendAI
if (typeof sendAI === 'function') {
  const _origAI = sendAI;
  window.sendAI = async function(overrideText, isGerarTreino) {
    const input = document.getElementById('aiInput');
    const txt = overrideText || (input ? input.value.trim() : '');
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
```

}

// Aguarda app.js carregar completamente
if (document.readyState === ‘complete’) {
aplicarPatch();
} else {
window.addEventListener(‘load’, aplicarPatch);
}
})();

/* ═══════════════════════════════════════════════════
PATCH 2: obFinish — pede login após onboarding
═══════════════════════════════════════════════════ */
window.addEventListener(‘load’, function() {
// Aguarda app.js carregar
setTimeout(function() {
if (typeof obFinish === ‘function’) {
window.obFinish = function() {
localStorage.setItem(“titan_onboarded”,“1”);
document.getElementById(“onboarding”).classList.remove(“show”);
// Verifica se já está logado
_sb.auth.getSession().then(function(res) {
const session = res.data.session;
if (session && session.user) {
setTimeout(function() {
if (typeof openInstrucoes === ‘function’) openInstrucoes();
}, 500);
} else {
// Não logado — mostra login
document.getElementById(‘splashScreen’).style.display = ‘none’;
document.getElementById(‘loginScreen’).style.display = ‘flex’;
}
}).catch(function() {
document.getElementById(‘loginScreen’).style.display = ‘flex’;
});
};
}
}, 1000);
});