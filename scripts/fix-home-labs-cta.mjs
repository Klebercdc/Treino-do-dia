/**
 * fix-home-labs-cta.mjs
 *
 * Verifica que os artefatos do fix já existem (criados pelo commit) e
 * reporta o status. Pode ser re-executado a qualquer momento para
 * validar a integridade dos arquivos.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const EXPECTED = [
  { file: path.join(root, 'src/ui/labs/home-labs-cta-bridge.js'), label: 'bridge JS' },
  { file: path.join(root, 'index.html'),                           label: 'index.html' },
  { file: path.join(root, 'package.json'),                         label: 'package.json' },
];

const EXPECTED_IN_INDEX = 'src/ui/labs/home-labs-cta-bridge.js';

let ok = true;

for (const { file, label } of EXPECTED) {
  if (!fs.existsSync(file)) {
    console.error(`❌ ${label} não encontrado: ${file}`);
    ok = false;
  } else {
    console.log(`✅ ${label} existe`);
  }
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!indexHtml.includes(EXPECTED_IN_INDEX)) {
  console.error('❌ index.html não contém o script tag da bridge.');
  ok = false;
} else {
  console.log('✅ index.html contém o script tag da bridge');
}

if (ok) {
  console.log('\n✅ Todos os artefatos do fix estão presentes.');
} else {
  console.error('\n❌ Alguns artefatos estão faltando. Verifique o commit.');
  process.exit(1);
}
