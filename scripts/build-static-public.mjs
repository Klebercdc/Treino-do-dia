import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public');

const staticFiles = [
  'index.html',
  'login.html',
  'clear-sw.html',
  'styles.css',
  'styles/animations.css',
  'app.js',
  'auth.js',
  'icons.js',
  'transform_kernel.js',
  'transforms_patch.js',
  'machine_engine.js',
  'transforms_engine.js',
  'kronos_pulse.js',
  'fitflow-layout.js',
  'krona-setup.js',
  'transforms_dashboard_acwr.js',
  'plans.js',
  'sw.js',
  'manifest.json',
  'Kronia.png',
  'splash.png',
  'layout.png',
  'src/client/access-scope.js',
  'src/core/intelligence/kronia-intelligence.js',
  'src/core/intelligence/adminBridge.js',
  'src/application/kronia-application.js',
  'src/lib/nutrition/tacoDatabase.json',
  'src/ui/diet/kronia-diet-runtime.js',
  'src/ui/diet/diet-entry-controller.js',
  'src/ui/diet/diet-plan-renderer.js',
  'src/ui/diet/diet-labs-bridge.js',
  'src/ui/diet/diet-wizard-standalone.js',
  'src/ui/diet/diet-wizard-state.js',
  'src/ui/diet/diet-wizard.js',
  'src/ui/diet/diet-step-body.js',
  'src/ui/diet/diet-step-goal.js',
  'src/ui/diet/diet-step-health.js',
  'src/ui/diet/diet-step-food.js',
  'src/ui/diet/diet-step-training.js',
  'src/ui/diet/diet-step-metabolism.js',
  'src/ui/diet/diet-summary.js',
  'src/ui/diet/disable-legacy-diet.js',
  'src/ui/labs/home-labs-cta-bridge.js',
  'src/ui/labs/home-labs-reports-auth-fix.js',
];

await rm(outputDir, { recursive: true, force: true });

for (const file of staticFiles) {
  const from = path.join(root, file);
  const to = path.join(outputDir, file);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
}

// Copy assets/3d/ directory (3D PNG images)
const assets3dSrc = path.join(root, 'assets', '3d');
const assets3dDest = path.join(outputDir, 'assets', '3d');
await mkdir(assets3dDest, { recursive: true });
await cp(assets3dSrc, assets3dDest, { recursive: true });

console.log(`Static output ready: public (${staticFiles.length} files + assets/3d/)`);