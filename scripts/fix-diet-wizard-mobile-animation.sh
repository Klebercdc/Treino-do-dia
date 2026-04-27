#!/usr/bin/env bash
set -euo pipefail

FILE="src/ui/diet/diet-wizard.js"

echo "🔎 Verificando arquivo: $FILE"
test -f "$FILE"

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"

node <<'NODE'
const fs = require('fs');
const file = 'src/ui/diet/diet-wizard.js';
let code = fs.readFileSync(file, 'utf8');

function replaceLine(find, replace) {
  if (!code.includes(find)) throw new Error('Trecho não encontrado: ' + find.slice(0, 90));
  code = code.replace(find, replace);
}

// Mantém 6 etapas. Corrige apenas layout/abertura/animação.
replaceLine(
  "'.diet-wizard-screen{position:fixed;inset:0;background:#07090f;color:#fff;overflow:hidden;display:none;}',",
  "'.diet-wizard-screen{position:fixed;inset:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;background:#07090f;color:#fff;overflow:hidden;display:none;contain:layout paint size;overscroll-behavior:none;}',"
);

replaceLine(
  "'.diet-wizard-screen.show{display:block;}',",
  "'.diet-wizard-screen.show{display:block;animation:dwScreenIn .26s cubic-bezier(.22,1,.36,1);}',"
);

replaceLine(
  "'.diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box;}',",
  "'.diet-wizard-screen,.diet-wizard-screen *{box-sizing:border-box;min-width:0;}',"
);

replaceLine(
  "'.dw-wizard-inner{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;}',",
  "'.dw-wizard-inner{width:100%;max-width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;background:radial-gradient(circle at 50% -15%,rgba(34,197,94,.13),transparent 36%),#07090f;}',"
);

replaceLine(
  "'.dw-header-wrap{display:block;padding:14px 16px 12px;background:#07090f;border-bottom:1px solid rgba(255,255,255,.05);}',",
  "'.dw-header-wrap{display:block;flex-shrink:0;width:100%;max-width:100%;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;background:rgba(7,9,15,.94);border-bottom:1px solid rgba(255,255,255,.06);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);overflow:hidden;}',"
);

replaceLine(
  "'.dw-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;width:100%;}',",
  "'.dw-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;width:100%;max-width:100%;}',"
);

replaceLine(
  "'.dw-body{flex:1;min-height:0;padding:20px 16px 120px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;}',",
  "'.dw-body{flex:1;min-height:0;width:100%;max-width:100%;padding:20px 16px calc(116px + env(safe-area-inset-bottom));overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;animation:dwStepIn .24s cubic-bezier(.22,1,.36,1);}',"
);

replaceLine(
  "'.dw-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:16px;margin-bottom:12px;}',",
  "'.dw-body *{max-width:100%;}',\n        '.dw-body>*{animation:dwCardIn .32s cubic-bezier(.22,1,.36,1) both;}',\n        '.dw-card{width:100%;max-width:100%;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.075);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 10px 30px rgba(0,0,0,.16);}',"
);

replaceLine(
  "'.dw-row{display:flex;gap:10px;}',",
  "'.dw-row{display:flex;gap:10px;width:100%;max-width:100%;}',"
);

replaceLine(
  "'.dw-chips-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;}',",
  "'.dw-chips-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;width:100%;max-width:100%;overflow:hidden;}',"
);

replaceLine(
  "'.dw-btn-primary{width:100%;height:56px;border-radius:16px;border:none;background:linear-gradient(135deg,#16a34a,#22c55e 50%,#a3e635);font-size:1rem;font-weight:800;color:#031a0b;letter-spacing:-.2px;box-shadow:0 6px 24px rgba(34,197,94,.3),0 2px 8px rgba(34,197,94,.15);cursor:pointer;}'",
  "'.dw-btn-primary{width:100%;height:56px;border-radius:16px;border:none;background:linear-gradient(135deg,#16a34a,#22c55e 50%,#a3e635);font-size:1rem;font-weight:800;color:#031a0b;letter-spacing:-.2px;box-shadow:0 6px 24px rgba(34,197,94,.3),0 2px 8px rgba(34,197,94,.15);cursor:pointer;}',\n        '@keyframes dwScreenIn{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}',\n        '@keyframes dwStepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}',\n        '@keyframes dwCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',\n        '@media(max-width:380px){.dw-row{flex-wrap:wrap}.dw-col{flex-basis:100%}.dw-header-wrap{padding-left:14px;padding-right:14px}.dw-body{padding-left:14px;padding-right:14px}.dw-step-name{font-size:1.02rem}}',\n        '@media(prefers-reduced-motion:reduce){.diet-wizard-screen.show,.dw-body,.dw-body>*{animation:none!important;transition:none!important}}'"
);

fs.writeFileSync(file, code);
NODE

node -c "$FILE"
echo "✅ Correção aplicada em $FILE"
