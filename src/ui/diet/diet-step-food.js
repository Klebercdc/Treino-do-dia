/* Etapa 4 — Alimentação */

function renderDietStepFood(data) {
  data = data || {};
  var padroes = [
    { value: 'omnivoro',      label: 'Onívoro',       desc: 'Como de tudo — carne, frango, peixe, laticínios' },
    { value: 'vegetariano',   label: 'Vegetariano',   desc: 'Sem carne, mas como ovos e laticínios' },
    { value: 'vegano',        label: 'Vegano',        desc: 'Nada de origem animal' },
    { value: 'low_carb',      label: 'Low carb',      desc: 'Reduzo carboidratos (pão, arroz, massa)' },
    { value: 'cetogenico',    label: 'Cetogênico',    desc: 'Quase zero carbo, muita gordura boa' },
    { value: 'mediterraneo',  label: 'Mediterrâneo',  desc: 'Peixe, azeite, legumes, frutas, cereais integrais' },
    { value: 'outro',         label: 'Outro',         desc: 'Tenho meu próprio padrão' },
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
    '<p class="dw-step-desc">Como você costuma comer no dia a dia?</p>',

    '<div class="dw-card">',
      '<label class="dw-label">Como você se alimenta?</label>',
      '<div class="dw-pattern-list">',
        padroes.map(function(p) {
          var active = data.padraoAlimentar === p.value;
          return '<button type="button" class="dw-pattern-opt' + (active ? ' active' : '') + '" data-group="padraoAlimentar" data-value="' + p.value + '">'
            + '<span class="dw-pattern-label">' + p.label + '</span>'
            + '<span class="dw-pattern-desc">' + p.desc + '</span>'
            + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">O que você gosta de comer? (opcional)</label>',
      '<textarea class="dw-textarea" name="preferenciasAlimentares" placeholder="Ex: frango, ovo, arroz, banana...">' + (data.preferenciasAlimentares || '') + '</textarea>',
      '<label class="dw-label" style="margin-top:12px">O que você prefere evitar? (opcional)</label>',
      '<textarea class="dw-textarea" name="alimentosQueEvita" placeholder="Ex: peixe, leite, brócolis...">' + (data.alimentosQueEvita || '') + '</textarea>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Alguma restrição alimentar?</label>',
      '<div class="dw-chips-wrap">',
        restricoes.map(function(r) {
          return '<button type="button" class="dw-chip' + (selRestr.indexOf(r) !== -1 ? ' active' : '') + '" data-group="restricoesAlimentares" data-multi="true" data-value="' + r + '">' + r + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Suplementos que usa</label>',
      '<div class="dw-chips-wrap">',
        suplementos.map(function(s) {
          return '<button type="button" class="dw-chip' + (selSupl.indexOf(s) !== -1 ? ' active' : '') + '" data-group="suplementos" data-multi="true" data-value="' + s + '">' + s + '</button>';
        }).join(''),
      '</div>',
    '</div>',
  ].join('');
}
