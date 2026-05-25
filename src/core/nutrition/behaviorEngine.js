'use strict';

function inferSatietyPattern(user) {
  var hunger = user && user.hungerLevel;
  if (hunger >= 8) return 'high_hunger';
  if (hunger >= 5) return 'moderate_hunger';
  return 'low_hunger';
}

function inferMealTimingPreference(user) {
  if (user && user.workShift === 'night') return 'night_shift';
  if (user && user.trainingTime === 'morning') return 'morning_training';
  if (user && user.trainingTime === 'night') return 'night_training';
  return 'standard';
}

function inferSnackBehavior(user) {
  if (user && user.snacksPerDay >= 4) return 'frequent_snacking';
  if (user && user.snacksPerDay >= 2) return 'moderate_snacking';
  return 'low_snacking';
}

function inferComfortFoodPatterns(user) {
  var cravings = user && user.cravings || [];
  if (cravings.includes('sweet')) return 'sweet_craving';
  if (cravings.includes('salty')) return 'salty_craving';
  return 'neutral';
}

function inferEatingBehavior(profile, history) {
  return {
    satiety: inferSatietyPattern(profile || {}),
    timing: inferMealTimingPreference(profile || {}),
    snacks: inferSnackBehavior(profile || {}),
    comfortFood: inferComfortFoodPatterns(profile || {}),
    repeatedMealSignals: (history || []).length > 5
  };
}

function buildBehaviorProfile(user) {
  return {
    eatingBehavior: inferEatingBehavior(user, []),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  inferEatingBehavior: inferEatingBehavior,
  inferSatietyPattern: inferSatietyPattern,
  inferMealTimingPreference: inferMealTimingPreference,
  inferSnackBehavior: inferSnackBehavior,
  inferComfortFoodPatterns: inferComfortFoodPatterns,
  buildBehaviorProfile: buildBehaviorProfile
};
