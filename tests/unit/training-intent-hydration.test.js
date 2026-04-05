const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function createChip(dataVal) {
  return {
    dataset: { val: dataVal },
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); },
    },
  };
}

test('hydrateTrainingFromConversationIntent hydrates chips from canonical payload', () => {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function sanitizeCtaObject\(value\) \{[\s\S]*?\n\}/, 'sanitizeCtaObject'),
    extract(code, /function sanitizeConversationIntentPayload\(intentType, payload\) \{[\s\S]*?\n\}/, 'sanitizeConversationIntentPayload'),
    extract(code, /function hydrateTrainingFromConversationIntent\(payload\) \{[\s\S]*?\n\}/, 'hydrateTrainingFromConversationIntent'),
  ].join('\n\n');

  const objChip = createChip('hipertrofia');
  const levelChip = createChip('intermediario');
  const freqChip = createChip('4');
  const equipChip = createChip('hotel');
  const joelhoChip = createChip('joelho');
  const nenhumaChip = createChip('nenhuma');
  nenhumaChip.classList.add('active');
  const freqInput = { value: '' };

  const context = {
    Number,
    String,
    Object,
    Array,
    document: {
      querySelector(selector) {
        if (selector === '#objChips [data-val="hipertrofia"]') return objChip;
        if (selector === '#nivelChips [data-val="intermediario"]') return levelChip;
        if (selector === '#freqChips [data-val="4"]') return freqChip;
        if (selector === '#equipChips [data-val="hotel"]') return equipChip;
        if (selector === '.config-chip-restric[data-val="joelho"]') return joelhoChip;
        if (selector === '.config-chip-restric[data-val="nenhuma"]') return nenhumaChip;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.config-chip-restric') return [nenhumaChip, joelhoChip];
        if (selector === '.config-chip-restric.active') {
          return [nenhumaChip, joelhoChip].filter((chip) => chip.classList.contains('active'));
        }
        return [];
      },
      getElementById(id) {
        if (id === 'freq') return freqInput;
        return null;
      },
    },
    selectObj(chip) { chip.classList.add('active'); },
    selectNivel(chip) { chip.classList.add('active'); },
    selectFreq(chip) { chip.classList.add('active'); },
    selectEquip(chip) { chip.classList.add('active'); },
  };

  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'training-intent-hydration.js' });

  const result = context.hydrateTrainingFromConversationIntent({
    objective: 'Hipertrofia',
    level: 'Intermediário',
    days_per_week: 4,
    environment: 'Academia de hotel',
    restrictions: ['lesão no joelho'],
  });

  assert.equal(result.days_per_week, 4);
  assert.equal(freqInput.value, '4');
  assert.equal(objChip.classList.contains('active'), true);
  assert.equal(levelChip.classList.contains('active'), true);
  assert.equal(freqChip.classList.contains('active'), true);
  assert.equal(equipChip.classList.contains('active'), true);
  assert.equal(joelhoChip.classList.contains('active'), true);
  assert.equal(nenhumaChip.classList.contains('active'), false);
});
