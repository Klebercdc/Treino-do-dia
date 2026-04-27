/* Etapa 2 — Objetivo */

function renderDietStepGoal(data) {
  data = data || {};
  var objectives = [
    { value: 'emagrecimento', label: 'Emagrecimento' },
    { value: 'manutencao',    label: 'Manutenção'    },
    { value: 'hipertrofia',   label: 'Hipertrofia'   },
    { value: 'recomposicao',  label: 'Recomposição'  },
    { value: 'forca',         label: 'Força'         },
    { value: 'performance',   label: 'Performance'   },
  ];
  var prioridades = [
    { value: 'resultado_rapido', label: 'Resultado rápido' },
    { value: 'sustentavel',      label: 'Sustentável'      },
    { value: 'performance',      label: 'Performance'      },
    { value: 'estetica_maxima',  label: 'Estética máxima'  },
  ];
  var refeicoes = ['2','3','4','5','6+'];

  return [
    '<div class="dw-step-title">Qual é o seu objetivo?</div>',
    '<p class="dw-step-desc">Isso define a estratégia calórica e de macros.</p>',
    '<div class="dw-card">',
      '<label class="dw-label">Objetivo principal *</label>',
      '<div class="dw-chips-grid">',
        objectives.map(function(o) {
          return '<button type="button" class="dw-chip-single' + (data.objective === o.value ? ' active' : '') + '" data-group="objective" data-value="' + o.value + '">' + o.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',
    '<div class="dw-card">',
      '<label class="dw-label">Prioridade</label>',
      '<div class="dw-chips-row">',
        prioridades.map(function(p) {
          return '<button type="button" class="dw-chip-single' + (data.prioridade === p.value ? ' active' : '') + '" data-group="prioridade" data-value="' + p.value + '">' + p.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',
    '<div class="dw-card">',
      '<label class="dw-label">Refeições por dia</label>',
      '<div class="dw-chips-row">',
        refeicoes.map(function(r) {
          return '<button type="button" class="dw-chip-single' + (String(data.refeicoesPorDia) === r ? ' active' : '') + '" data-group="refeicoesPorDia" data-value="' + r + '">' + r + '</button>';
        }).join(''),
      '</div>',
    '</div>',
    '<div class="dw-card">',
      '<label class="dw-label">Meta calórica personalizada (opcional)</label>',
      '<input class="dw-input" type="number" name="metaCaloricaManual" placeholder="Ex: 2000 kcal" value="' + (data.metaCaloricaManual || '') + '">',
    '</div>',
  ].join('');
}
