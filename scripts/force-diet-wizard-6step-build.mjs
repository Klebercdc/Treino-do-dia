import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'index.html');
const appPath = path.join(publicDir, 'app.js');

let html = await readFile(indexPath, 'utf8');

// Remove o fluxo legado quando existir no HTML final.
html = html.replace(/<[^>]*id="nutritionFlowScreen"[\s\S]*?<\/[^>]+>/g, '');
html = html.replace(/<script id="kronia-diet-anamnese-force-inline">[\s\S]*?<\/script>/g, '');
html = html.replace(/<script id="kronia-diet-wizard-v3-bootstrap">[\s\S]*?<\/script>/g, '');

const dietRuntimeScripts = [
  '<script src="src/ui/diet/diet-wizard.js?v=20260523-v3-build"></script>',
  '<script src="src/ui/diet/diet-entry-controller.js?v=20260523-v3-build"></script>',
  `<script id="kronia-diet-v3-direct-bootstrap">
(function(){
  if(window.__kroniaDietV3DirectBootstrap)return;
  window.__kroniaDietV3DirectBootstrap=true;
  function openV3(ctx){
    try{if(typeof navTo==='function')navTo('dieta')}catch(e){}
    var fn=typeof window.openDietProfileWizard==='function'?window.openDietProfileWizard:null;
    if(!fn&&typeof window.openDietWizardStandalone==='function')fn=window.openDietWizardStandalone;
    if(fn)return fn(Object.assign({source:'direct_build_bootstrap'},ctx||{}));
    var s=document.createElement('script');
    s.src='src/ui/diet/diet-wizard.js?v=20260523-v3-build-force&t='+Date.now();
    s.onload=function(){var f=window.openDietProfileWizard||window.openDietWizardStandalone;if(f)f(Object.assign({source:'direct_build_bootstrap_after_load'},ctx||{}));};
    document.head.appendChild(s);
    return true;
  }
  window.KroniaDiet=Object.assign({},window.KroniaDiet||{},{forceAnamnese:openV3,generate:openV3,ai:openV3,regenerate:openV3,createPlan:openV3});
  ['startAIDiet','generateDietPlan','regenerateDiet','regenerateDietPlan','createDietPlan','createAnotherDiet'].forEach(function(n){window[n]=openV3;});
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest&&e.target.closest('button,a,div,section');
    if(!el)return;
    var txt=(el.innerText||el.textContent||'').toLowerCase();
    if(txt.includes('regenerar plano')||txt.includes('dieta com ia')||txt.includes('gerar dieta')||txt.includes('criar dieta')){
      e.preventDefault();e.stopPropagation();openV3({source:'direct_text_click'});
    }
  },true);
})();
</script>`
].join('\n');

// Garante ordem: wizard primeiro, depois controller/bootstrap, antes do fechamento do body.
html = html.replace(/<script[^>]+src="src\/ui\/diet\/diet-wizard\.js[^>]*><\/script>\n?/g, '');
html = html.replace(/<script[^>]+src="src\/ui\/diet\/diet-entry-controller\.js[^>]*><\/script>\n?/g, '');
html = html.replace(/<script id="kronia-diet-v3-direct-bootstrap">[\s\S]*?<\/script>\n?/g, '');
html = html.replace('</body>', dietRuntimeScripts + '\n</body>');

await writeFile(indexPath, html, 'utf8');

try {
  let app = await readFile(appPath, 'utf8');

  app = app.replace(/function\s+openNutritionFlow\s*\(/g,
    'function openNutritionFlow(){ return window.KroniaDiet && window.KroniaDiet.createPlan ? window.KroniaDiet.createPlan() : null; }\nfunction openNutritionFlow_blocked__('
  );

  // Ponte extra para qualquer fluxo legado que tente abrir dieta/anamnese direto.
  if (!app.includes('__kroniaDietV3AppBridge')) {
    app += `\n\n(function(){\n  if(window.__kroniaDietV3AppBridge)return;\n  window.__kroniaDietV3AppBridge=true;\n  function openV3(ctx){\n    var fn=window.openDietProfileWizard||window.openDietWizardStandalone;\n    if(fn)return fn(Object.assign({source:'app_bridge_v3'},ctx||{}));\n    return false;\n  }\n  window.openNutritionFlow=function(){return openV3({source:'openNutritionFlow_bridge'});};\n  window.startAIDiet=window.startAIDiet||openV3;\n  window.generateDietPlan=window.generateDietPlan||openV3;\n  window.regenerateDiet=window.regenerateDiet||openV3;\n  window.regenerateDietPlan=window.regenerateDietPlan||openV3;\n})();\n`;
  }

  await writeFile(appPath, app, 'utf8');
} catch (e) {
  console.warn('skip patch openNutritionFlow', e.message);
}

console.log('Diet Wizard V3 injected directly into public build output.');
