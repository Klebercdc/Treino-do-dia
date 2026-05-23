import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const indexPath = path.join(publicDir, 'index.html');

let html = await readFile(indexPath, 'utf8');

// Remove qualquer bootstrap legado injetado previamente.
html = html.replace(/<script id="kronia-diet-anamnese-force-inline">[\s\S]*?<\/script>\n?/g, '');
html = html.replace(/<script id="kronia-diet-wizard-v3-bootstrap">[\s\S]*?<\/script>\n?/g, '');
html = html.replace(/<script id="kronia-diet-v3-direct-bootstrap">[\s\S]*?<\/script>\n?/g, '');

// Remove scripts de dieta existentes para garantir a ordem correta.
html = html.replace(/<script[^>]+src="[^"]*diet-wizard-standalone\.js[^"]*"[^>]*><\/script>\n?/g, '');
html = html.replace(/<script[^>]+src="[^"]*diet-entry-controller\.js[^"]*"[^>]*><\/script>\n?/g, '');
html = html.replace(/<script[^>]+src="[^"]*disable-legacy-diet\.js[^"]*"[^>]*><\/script>\n?/g, '');
html = html.replace(/<script[^>]+src="[^"]*kronia-diet-runtime\.js[^"]*"[^>]*><\/script>\n?/g, '');

// Injeta os scripts de dieta antes do fechamento do body na ordem correta:
// 1. wizard (implementação) → 2. controller (roteador) → 3. guard (legado) → 4. runtime (bootstrap único)
const BUILD_VERSION = '20260523-rebuild-v1';
const dietScripts = [
  `<script src="src/ui/diet/diet-wizard-standalone.js?v=${BUILD_VERSION}"></script>`,
  `<script src="src/ui/diet/diet-entry-controller.js?v=${BUILD_VERSION}"></script>`,
  `<script src="src/ui/diet/disable-legacy-diet.js?v=${BUILD_VERSION}"></script>`,
  `<script src="src/ui/diet/kronia-diet-runtime.js?v=${BUILD_VERSION}"></script>`
].join('\n');

html = html.replace('</body>', dietScripts + '\n</body>');

await writeFile(indexPath, html, 'utf8');

console.log('Diet runtime scripts injected into public build in correct order.');
