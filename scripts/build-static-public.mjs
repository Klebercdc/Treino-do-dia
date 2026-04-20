import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public');

const staticFiles = [
  'index.html',
  'styles.css',
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
  'manifest.json',
  'sw.js',
  'Kronia.png',
  'splash.png',
  'layout.png',
  'src/client/access-scope.js',
  'src/core/intelligence/kronia-intelligence.js',
  'src/core/intelligence/adminBridge.js',
  'src/application/kronia-application.js'
];

await rm(outputDir, { recursive: true, force: true });

for (const file of staticFiles) {
  const from = path.join(root, file);
  const to = path.join(outputDir, file);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
}

console.log(`Static output ready: public (${staticFiles.length} files)`);
