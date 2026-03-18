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
