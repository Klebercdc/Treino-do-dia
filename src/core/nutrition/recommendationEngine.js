'use strict';

function recommendMealSubstitutions(meal) {
  if (!meal) return [];

  var recommendations = [];

  (meal.itens || []).forEach(function(item) {
    var name = String(item.nome || item.name || '').toLowerCase();

    if (/iogurte proteico/.test(name)) {
      recommendations.push('Alternar ocasionalmente entre iogurte proteico, skyr e kefir para maior variedade alimentar.');
    }

    if (/frango/.test(name)) {
      recommendations.push('Variar proteínas entre frango, peixe e ovos pode melhorar aderência e diversidade nutricional.');
    }
  });

  return recommendations;
}

function recommendBetterTiming(plan) {
  return {
    recommendation: 'Distribuir proteína de forma equilibrada ao longo do dia melhora síntese proteica e saciedade.'
  };
}

function recommendHydrationAdjustments(profile) {
  return {
    hydration: profile && profile.training ? 'Aumentar hidratação em dias de treino intenso.' : 'Manter hidratação consistente ao longo do dia.'
  };
}

function recommendSatietyAdjustments(plan) {
  return {
    satiety: 'Adicionar fibras e proteína nas primeiras refeições pode melhorar controle de fome.'
  };
}

function recommendProteinDistribution(plan) {
  return {
    proteinDistribution: 'Distribuição proteica equilibrada detectada.'
  };
}

function recommendBehavioralAdjustments(profile) {
  return {
    behavior: profile && profile.workShift === 'night'
      ? 'Planejar refeições práticas para plantão noturno pode melhorar aderência.'
      : 'Estratégia alimentar alinhada à rotina atual.'
  };
}

module.exports = {
  recommendMealSubstitutions: recommendMealSubstitutions,
  recommendBetterTiming: recommendBetterTiming,
  recommendHydrationAdjustments: recommendHydrationAdjustments,
  recommendSatietyAdjustments: recommendSatietyAdjustments,
  recommendProteinDistribution: recommendProteinDistribution,
  recommendBehavioralAdjustments: recommendBehavioralAdjustments
};
