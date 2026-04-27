/* Etapa 4 — Alimentação */

function renderDietStepFood(data) {
  data = data || {};
  var padroes = [
    { value: 'omnivoro',      label: 'Onívoro'      },
    { value: 'vegetariano',   label: 'Vegetariano'  },
    { value: 'vegano',        label: 'Vegano'       },
    { value: 'low_carb',      label: 'Low carb'     },
    { value: 'cetogenico',    label: 'Cetogênico'   },
    { value: 'mediterraneo',  label: 'Mediterrâneo' },
    { value: 'outro',         label: 'Outro'        },
  ];
  var restricoes = ['Lactose', 'Glúten', 'Frutos do mar', 'Amendoim', 'Ovos', 'Soja', 'Outra'];
  var suplementos = [
    'Whey protein', 'Creatina', 'BCAA', 'Cafeína', 'Multivitamínico',
    'Ômega-3', 'Pré-treino', 'Nenhum', 'Outro'
  ];
  var selRestr = data.restricoesAlimentares || [];
  var selSupl  = data.suplementos || [];

  return [
    '<div class="dw-step-title">Alimentação</div>',
    '<p class="dw-step-desc">Conte-nos seu padrão alimentar e preferências.</p>',

    '<div class="dw-card">',
      '<label class="dw-label">Padrão alimentar</label>',
      '<div class="dw-chips-wrap">',
        padroes.map(function(p) {
          return '<button type="button" class="dw-chip-single' + (data.padraoAlimentar === p.value ? ' active' : '') + '" data-group="padraoAlimentar" data-value="' + p.value + '">' + p.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Preferências alimentares (opcional)</label>',
      '<textarea class="dw-textarea" name="preferenciasAlimentares" placeholder="Ex: gosto de frango, ovo, arroz...">' + (data.preferenciasAlimentares || '') + '</textarea>',
      '<label class="dw-label" style="margin-top:12px">Alimentos que evita (opcional)</label>',
      '<textarea class="dw-textarea" name="alimentosQueEvita" placeholder="Ex: não gosto de peixe, evito leite...">' + (data.alimentosQueEvita || '') + '</textarea>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Restrições alimentares</label>',
      '<div class="dw-chips-wrap">',
        restricoes.map(function(r) {
          return '<button type="button" class="dw-chip' + (selRestr.indexOf(r) !== -1 ? ' active' : '') + '" data-group="restricoesAlimentares" data-multi="true" data-value="' + r + '">' + r + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Suplementos em uso</label>',
      '<div class="dw-chips-wrap">',
        suplementos.map(function(s) {
          return '<button type="button" class="dw-chip' + (selSupl.indexOf(s) !== -1 ? ' active' : '') + '" data-group="suplementos" data-multi="true" data-value="' + s + '">' + s + '</button>';
        }).join(''),
      '</div>',
    '</div>',
  ].join('');
}
