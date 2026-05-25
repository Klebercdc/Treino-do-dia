'use strict';

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function emptyMemory(userId) {
  return {
    userId: userId || null,
    likedFoods: [],
    rejectedFoods: [],
    repeatedFoods: [],
    acceptedMeals: [],
    rejectedMeals: [],
    substitutions: [],
    adherencePatterns: [],
    digestionFlags: [],
    satietyPatterns: [],
    updatedAt: new Date().toISOString()
  };
}

function loadUserFoodMemory(userId, seed) {
  return Object.assign(emptyMemory(userId), seed || {});
}

function updateFoodMemory(memory, event) {
  var next = Object.assign(emptyMemory(memory && memory.userId), memory || {});
  var type = event && event.type;
  var food = event && (event.food || event.nome || event.name);
  var meal = event && event.meal;

  if ((type === 'food_liked' || type === 'liked') && food) next.likedFoods.push(food);
  if ((type === 'food_rejected' || type === 'rejected') && food) next.rejectedFoods.push(food);
  if (type === 'meal_accepted' && meal) next.acceptedMeals.push(meal);
  if (type === 'meal_rejected' && meal) next.rejectedMeals.push(meal);
  if (type === 'substitution') next.substitutions.push({ oldFood: event.oldFood, newFood: event.newFood, at: new Date().toISOString() });
  if (type === 'adherence_pattern') next.adherencePatterns.push(event.pattern || event.value || event);
  if (type === 'digestion_flag') next.digestionFlags.push(event.flag || event.value || event);
  if (type === 'satiety_pattern') next.satietyPatterns.push(event.pattern || event.value || event);

  next.updatedAt = new Date().toISOString();
  return next;
}

function listContainsFood(list, food) {
  var target = normalizeText(food && (food.nome || food.name || food));
  return (list || []).some(function(entry) {
    return normalizeText(entry && (entry.nome || entry.name || entry)) === target;
  });
}

function scoreFoodAffinity(food, memory) {
  var score = 50;
  if (!food) return score;
  if (listContainsFood(memory && memory.likedFoods, food)) score += 35;
  if (listContainsFood(memory && memory.rejectedFoods, food)) score -= 45;
  if (listContainsFood(memory && memory.repeatedFoods, food)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreFoodRejection(food, memory) {
  if (!food) return 0;
  var score = 0;
  if (listContainsFood(memory && memory.rejectedFoods, food)) score += 80;
  if (listContainsFood(memory && memory.digestionFlags, food)) score += 15;
  return Math.max(0, Math.min(100, score));
}

function registerMealAccepted(memory, meal) {
  return updateFoodMemory(memory, { type: 'meal_accepted', meal: meal });
}

function registerMealRejected(memory, meal) {
  return updateFoodMemory(memory, { type: 'meal_rejected', meal: meal });
}

function registerFoodSubstitution(memory, oldFood, newFood) {
  return updateFoodMemory(memory, { type: 'substitution', oldFood: oldFood, newFood: newFood });
}

function buildFoodPreferenceProfile(memory) {
  return {
    likedFoods: (memory && memory.likedFoods) || [],
    rejectedFoods: (memory && memory.rejectedFoods) || [],
    rejectionCount: ((memory && memory.rejectedFoods) || []).length,
    substitutionCount: ((memory && memory.substitutions) || []).length,
    hasLowAdherenceSignals: ((memory && memory.adherencePatterns) || []).length > 0,
    hasDigestionFlags: ((memory && memory.digestionFlags) || []).length > 0
  };
}

module.exports = {
  loadUserFoodMemory: loadUserFoodMemory,
  updateFoodMemory: updateFoodMemory,
  scoreFoodAffinity: scoreFoodAffinity,
  scoreFoodRejection: scoreFoodRejection,
  registerMealAccepted: registerMealAccepted,
  registerMealRejected: registerMealRejected,
  registerFoodSubstitution: registerFoodSubstitution,
  buildFoodPreferenceProfile: buildFoodPreferenceProfile
};
