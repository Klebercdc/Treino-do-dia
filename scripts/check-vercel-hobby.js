#!/usr/bin/env node
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const apiDir = join(process.cwd(), 'api');
const files = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
const helpers = files.filter((f) => f.startsWith('_'));
const maxSafe = 10;

console.log('API functions:', files.length);
console.log(files.sort().join('\n'));

if (helpers.length > 0) {
  console.error('\n❌ Helpers ainda dentro de api/:', helpers.join(', '));
  process.exit(1);
}

if (files.length > maxSafe) {
  console.error(`\n❌ Functions (${files.length}) acima da margem segura (${maxSafe}) para Vercel Hobby.`);
  process.exit(1);
}

console.log('\n✅ Estrutura compatível com margem segura da Vercel Hobby.');
