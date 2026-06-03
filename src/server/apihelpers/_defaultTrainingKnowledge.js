'use strict';

module.exports = {
  protocols: [
    { id: 'full_body',       name: 'Full Body',      bestFor: ['iniciante', '2-3 dias'],       description: 'Corpo inteiro com frequência alta e volume moderado.' },
    { id: 'upper_lower',     name: 'Upper/Lower',    bestFor: ['intermediario', '4 dias'],      description: 'Divisão superiores/inferiores.' },
    { id: 'push_pull_legs',  name: 'Push/Pull/Legs', bestFor: ['avancado', '5-6 dias'],         description: 'Divisão por padrões de movimento.' },
    { id: 'abc',             name: 'ABC',            bestFor: ['intermediario', '3-6 dias'],    description: 'Divisão clássica por grupos musculares.' },
    { id: 'abcd',            name: 'ABCD',           bestFor: ['avancado', '4-5 dias'],         description: 'Maior especialização por grupo muscular.' },
  ],
  volumeRules: {
    iniciante:     { weeklySetsPerMuscle: '6-10',  intensity: 'RPE 6-8' },
    intermediario: { weeklySetsPerMuscle: '10-16', intensity: 'RPE 7-9' },
    avancado:      { weeklySetsPerMuscle: '12-20', intensity: 'RPE 7-9' },
  },
  progression: {
    default:      'Progressão dupla: aumentar reps dentro da faixa antes de aumentar carga.',
    conservative: 'Progressão lenta com foco em técnica, sem falha frequente.',
    hypertrophy:  'Progressão por reps, carga e volume semanal controlado.',
  },
  safety: {
    fatigueHigh: 'Evitar falha, reduzir volume e aumentar descanso.',
    deficitDiet: 'Evitar excesso de volume e falha frequente em déficit calórico.',
    pain:        'Substituir exercícios que provoquem dor.',
  },
  protocolSelector: function(dias, nivel) {
    if (dias <= 3) return 'full_body';
    if (dias === 4) return 'upper_lower';
    if (dias === 5) return nivel === 'avancado' ? 'push_pull_legs' : 'abc';
    return nivel === 'avancado' ? 'push_pull_legs' : 'abcd';
  },
};
