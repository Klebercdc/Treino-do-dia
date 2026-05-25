'use strict';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function flattenFoods(history) {
  var foods = [];
  (history || []).forEach(function(plan) {
    (plan.refeicoes || []).forEach(function(meal) {
      (meal.itens || []).forEach(function(item) {
        foods.push(normalize(item.nome || item.name));
      });
    });
  });
  return foods;
}

function detectRepeatedFoods(history) {
  var counts = {};
  flattenFoods(history).forEach(function(food) {
    counts[food] = (counts[food] || 0) + 1;
  });
  return Object.keys(counts).filter(function(food) { return counts[food] >= 3; });
}

function detectRepeatedMeals(history) {
  var counts = {};
  (history || []).forEach(function(plan) {
    (plan.refeicoes || []).forEach(function(meal) {
      var key = normalize(meal.nome || meal.tipo || 'meal');
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.keys(counts).filter(function(key) { return counts[key] >= 3; });
}

function scoreMealNovelty(meal, history) {
  var repeatedFoods = detectRepeatedFoods(history);
  var score = 100;
  (meal.itens || []).forEach(function(item) {
    var key = normalize(item.nome || item.name);
    if (repeatedFoods.indexOf(key) >= 0) score -= 10;
  });
  return Math.max(0, score);
}

function diversifyMeal(meal, catalog) {
  if (!meal || !catalog) return meal;
  return Object.assign({}, meal, {
    adaptiveDiversity: {
      diversified: false,
      noveltyScore: 85
    }
  });
}

function diversifyPlan(plan, history) {
  if (!plan) return plan;
  return Object.assign({}, plan, {
    refeicoes: (plan.refeicoes || []).map(function(meal) {
      return Object.assign({}, meal, {
        diversityScore: scoreMealNovelty(meal, history)
      });
    }),
    diversitySummary: {
      repeatedFoods: detectRepeatedFoods(history),
      repeatedMeals: detectRepeatedMeals(history)
    }
  });
}

function calculateMealDiversity(plan, history) {
  var meals = (plan && plan.refeicoes) || [];
  if (!meals.length) return 100;
  var total = meals.reduce(function(sum, meal) {
    return sum + scoreMealNovelty(meal, history);
  }, 0);
  return Math.round(total / meals.length);
}

module.exports = {
  calculateMealDiversity: calculateMealDiversity,
  detectRepeatedMeals: detectRepeatedMeals,
  detectRepeatedFoods: detectRepeatedFoods,
  diversifyMeal: diversifyMeal,
  diversifyPlan: diversifyPlan,
  scoreMealNovelty: scoreMealNovelty
};
