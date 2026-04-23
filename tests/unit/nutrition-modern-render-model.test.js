const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = extract(
    code,
    /function extractModernNutritionRenderModel\(payload\) \{[\s\S]*?\n\}\n\nasync function generateDietWithModernEngine/,
    'extractModernNutritionRenderModel'
  ).replace(/\n\nasync function generateDietWithModernEngine[\s\S]*$/, '');

  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'nutrition-modern-render-model-snippet.js' });
  return context;
}

test('modern nutrition response is adapted to legacy diet render contract', () => {
  const { extractModernNutritionRenderModel } = loadRuntime();

  const model = extractModernNutritionRenderModel({
    ok: true,
    data: {
      calculation: {
        tmb: 1700,
        get: 2635,
        targetCalories: 2500,
        macros: { protein: 160, carbs: 280, fat: 70 },
        objective: 'hipertrofia',
      },
      plan: {
        objetivo: 'hipertrofia',
        resumoDiario: {
          calorias: 2480,
          proteinas: 158,
          carboidratos: 276,
          gorduras: 68,
        },
        refeicoes: [{
          nome: 'Almoço',
          horario: '12:30',
          subtotal: {
            calorias: 720,
            proteinas: 48,
            carboidratos: 92,
            gorduras: 18,
          },
          itens: [{
            nome: 'Frango grelhado',
            porcao: '140 g',
            calorias: 230,
            proteinas: 43,
            carboidratos: 0,
            gorduras: 5,
          }],
        }],
      },
      clinicalNotes: ['Plano ajustado com base no seu exame recente.'],
    },
  });

  assert.equal(model.meta.calorias, 2480);
  assert.equal(model.caloriasMeta, 2480);
  assert.equal(model.macrosMeta.protein, 158);
  assert.equal(model.resumoDiario.carboidratos, 276);
  assert.equal(model.refeicoes[0].subtotal.kcal, 720);
  assert.equal(model.refeicoes[0].subtotal.prot, 48);
  assert.equal(model.refeicoes[0].alimentos[0].nome, 'Frango grelhado');
  assert.equal(model.refeicoes[0].alimentos[0].qtde, '140 g');
  assert.equal(model.refeicoes[0].alimentos[0].kcal, 230);
  assert.deepEqual(Array.from(model.observacoes), ['Plano ajustado com base no seu exame recente.']);
});

test('kronos chat diet_result response is adapted to diet render contract', () => {
  const { extractModernNutritionRenderModel } = loadRuntime();

  const model = extractModernNutritionRenderModel({
    success: true,
    type: 'diet_result',
    message: 'Dieta montada.',
    data: {
      content: [{
        type: 'diet_result',
        text: 'Dieta montada.',
        data: {
          meta: {
            calorias: 2500,
            proteina: 170,
            carbo: 280,
            gordura: 70,
          },
          hidratacao: { litros: 3 },
          refeicoes: [{
            nome: 'Almoço',
            horario: '12:30',
            itens: [{
              nome: 'Frango grelhado',
              gramas: 150,
              calorias: 248,
              proteina: 46,
              carbo: 0,
              gordura: 6,
            }],
          }],
          observacoes: ['Plano gerado pelo KRONOS central.'],
        },
      }],
    },
  });

  assert.equal(model.text, 'Plano alimentar gerado pelo KRONOS central.');
  assert.equal(model.meta.calorias, 2500);
  assert.equal(model.meta.proteina, 170);
  assert.equal(model.refeicoes[0].subtotal.kcal, 248);
  assert.equal(model.refeicoes[0].subtotal.prot, 46);
  assert.equal(model.refeicoes[0].alimentos[0].qtde, '150 g');
  assert.equal(model.refeicoes[0].alimentos[0].gord, 6);
});

test('modern nutrition response accepts visualPrescription without depending on legacy refeicoes', () => {
  const { extractModernNutritionRenderModel } = loadRuntime();

  const model = extractModernNutritionRenderModel({
    success: true,
    type: 'diet_primary',
    data: {
      content: [{
        type: 'diet_primary',
        data: {
          visualPrescription: {
            summary: { kcal_total: 2795, proteina: 158, carbo: 332, gordura: 91 },
            meals: [{
              name: 'Café da manhã',
              time: '07:00',
              kcal_estimada: 700,
              items: ['Ovos - 3 unidades (150 g)', 'Pão francês - 1 unidade (50 g)'],
            }],
          },
        },
      }],
    },
  });

  assert.equal(model.meta.calorias, 2795);
  assert.equal(model.visualPrescription.summary.proteina, 158);
  assert.equal(model.refeicoes[0].nome, 'Café da manhã');
  assert.equal(model.refeicoes[0].subtotal.kcal, 700);
  assert.equal(model.refeicoes[0].alimentos[0].nome, 'Ovos');
});
