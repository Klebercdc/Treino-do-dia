# Roteiro: diet_prescription_renderer.js + nutritionService.js fino

## Status atual
| Arquivo | Situação |
|---|---|
| `diet_context_clinical.js` | ✅ Standalone — sem dep. em nutritionService |
| `diet_strategy_engine.js` | ✅ Standalone — importa só de clinical |
| `diet_prescription_renderer.js` | ❌ Thin wrapper inútil (27 linhas, delega tudo ao nutritionService) |
| `nutritionService.js` | ❌ Monolito (1037 linhas, contém tudo) |

---

## Tarefa 1 — diet_prescription_renderer.js (standalone)

### Imports necessários
```js
var premiumCatalog  = require('../../lib/nutrition/premiumCatalog');
var clinical        = require('./diet_context_clinical');   // hasClinicalFlag, hasCriticalLabFlag,
                                                            // shouldAvoidFoodForClinical, getClinicalPenalty
var strategyEngine  = require('./diet_strategy_engine');    // calculateNutrition
```

### Helpers locais a copiar do nutritionService
- `round(value, decimals)`
- `normalizeFreeText(input)`
- `textIncludesAny(text, items)`

### Constantes a copiar do nutritionService
- `MEAL_TEMPLATES` (linhas 27–54 do nutritionService) — objeto com chaves 3, 4, 5, 6
- `FOOD_LIBRARY` (linhas 56–112) — objeto com grupos de alimentos
- Linha extra: `FOOD_LIBRARY = premiumCatalog.buildPremiumFoodLibrary();` (linha 114)

### Funções a copiar do nutritionService (ordem correta)
1. `isRestricted(food, restrictions, dislikes)`
2. `isVeganProfile(profile)`
3. `isVegetarianProfile(profile)`
4. `isPlantProtein(food)`
5. `isProteinList(listName)`
6. `cloneScaledMealItem(item, factor)`
7. `selectDistinctFood(listName, profile, index, excludedNames)`  ← usa `chooseFood` (declarar depois)
8. `selectAdjustableItemIndex(items, macroKey, options)`
9. `rebalanceMealItems(items, target, options)`                   ← usa `sumMeal` e `cloneScaledMealItem`
10. `chooseFood(listName, profile, fallbackIndex)`                ← usa clinical.getClinicalPenalty, clinical.shouldAvoidFoodForClinical
11. `cloneFoodItem(food, factor)`
12. `sumMeal(items)`
13. `buildSubstitutions(item, profile)`
14. `buildMealItems(template, profile, macros, index)`           ← usa `clinical.shouldAvoidFoodForClinical`
15. `getMealTemplates(profile)`
16. `distributeMacrosAcrossMeals(profile, macros)`
17. `buildInitialNutritionPlan(profile, calc)`
18. `recalculatePlanTotals(plan)`
19. `capPlanCalories(plan, maxCalories)`
20. `buildNutritionPrescription(strategy)`                       ← usa clinical.hasClinicalFlag, clinical.hasCriticalLabFlag, premiumCatalog
21. `generateNutritionPlan(profileInput)`                        ← chama strategyEngine.calculateNutrition + buildNutritionPrescription

### Wrappers públicos a manter (já existem, só repontam)
```js
function renderPrescription(strategy) {
  return buildNutritionPrescription(strategy);
}
function generatePlan(profileInput) {
  return generateNutritionPlan(profileInput);
}
```

### Exports do renderer
```js
module.exports = {
  FOOD_LIBRARY,
  MEAL_TEMPLATES,
  buildNutritionPrescription,
  generateNutritionPlan,
  renderPrescription,
  generatePlan,
};
```

---

## Tarefa 2 — nutritionService.js (orquestrador fino)

### Substituir todo o conteúdo por
```js
'use strict';

var premiumCatalog  = require('./premiumCatalog');
var clinical        = require('../../core/nutrition/diet_context_clinical');
var strategyEngine  = require('../../core/nutrition/diet_strategy_engine');
var renderer        = require('../../core/nutrition/diet_prescription_renderer');

module.exports = {
  // ── constantes ──────────────────────────────────────────
  ACTIVITY_FACTORS:        strategyEngine.ACTIVITY_FACTORS,
  FOOD_LIBRARY:            renderer.FOOD_LIBRARY,
  CANONICAL_FOODS:         premiumCatalog.CANONICAL_FOODS,
  RECIPE_CATALOG:          premiumCatalog.RECIPE_CATALOG,

  // ── profile / context ───────────────────────────────────
  buildNutritionProfile:        strategyEngine.buildNutritionProfile,
  buildUnifiedNutritionContext:  strategyEngine.buildUnifiedNutritionContext,

  // ── strategy ────────────────────────────────────────────
  buildNutritionStrategy:  strategyEngine.buildNutritionStrategy,
  calculateNutrition:      strategyEngine.calculateNutrition,

  // ── prescription ────────────────────────────────────────
  buildNutritionPrescription: renderer.buildNutritionPrescription,
  generateNutritionPlan:      renderer.generateNutritionPlan,

  // ── clinical ────────────────────────────────────────────
  resolveDietMode:         clinical.resolveDietMode,
  applyClinicalRules:      clinical.applyClinicalRules,
  applyMedicalAdjustments: clinical.applyMedicalAdjustments,
  buildLabContext:         clinical.buildLabContext,

  // ── util ────────────────────────────────────────────────
  round: clinical.round,
};
```

### Verificar após reescrita
- [ ] `require('../../lib/nutrition/nutritionService')` em outros arquivos continua funcionando
- [ ] Todos os exports existentes estão mapeados (checar `_diet.js`, `dietService.js`, `diet_context_clinical.js` antiga)
- [ ] Rodar `node -e "require('./src/lib/nutrition/nutritionService')"` sem erro
- [ ] Rodar suite de testes: `npx jest tests/unit/diet-service.test.js --no-coverage`

---

## Ordem de execução
1. Escrever `diet_prescription_renderer.js` completo
2. Escrever `nutritionService.js` fino
3. Smoke-test: `node -e "const s=require('./src/lib/nutrition/nutritionService'); console.log(Object.keys(s))"`
4. Rodar testes unitários
5. Commit + push
