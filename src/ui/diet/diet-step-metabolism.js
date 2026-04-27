/* Etapa 6 — Metabolismo */

function renderDietStepMetabolism(data) {
  data = data || {};

  function chips(group, opts, selected) {
    return '<div class="dw-chips-col">' +
      opts.map(function(o) {
        return '<button type="button" class="dw-chip-single' + (selected === o.value ? ' active' : '') + '" data-group="' + group + '" data-value="' + o.value + '">' + o.label + '</button>';
      }).join('') +
    '</div>';
  }

  var usoHormonios = data.usoHormonios || 'nao';
  var showHormonalAlert = usoHormonios && usoHormonios !== 'nao' && usoHormonios !== 'Não';

  return [
    '<div class="dw-step-title">Comportamento Metabólico</div>',
    '<p class="dw-info-text">Seu corpo não responde só a calorias. Rotina, sono, estresse e adesão mudam a estratégia.</p>',

    '<div class="dw-card">',
      '<label class="dw-label">Como seu peso responde?</label>',
      chips('respostaPeso', [
        { value: 'ganho_peso_facil',              label: 'Ganho peso fácil'             },
        { value: 'perco_peso_facil',              label: 'Perco peso fácil'             },
        { value: 'dificuldade_para_ganhar_massa', label: 'Dificuldade para ganhar massa' },
        { value: 'dificuldade_para_emagrecer',    label: 'Dificuldade para emagrecer'   },
      ], data.respostaPeso),
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Apetite</label>',
      '<div class="dw-chips-row">',
        ['Baixo','Normal','Alto'].map(function(v) {
          var val = v.toLowerCase();
          return '<button type="button" class="dw-chip-single' + (data.apetite === val ? ' active' : '') + '" data-group="apetite" data-value="' + val + '">' + v + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Histórico com dieta</label>',
      chips('historicoDieta', [
        { value: 'nunca_fiz_dieta',       label: 'Nunca fiz dieta'            },
        { value: 'ja_fiz_funcionou',      label: 'Já fiz e funcionou'         },
        { value: 'ja_fiz_nao_funcionou',  label: 'Já fiz e não funcionou'     },
        { value: 'ja_fiz_recuperei_peso', label: 'Já fiz e recuperei o peso'  },
      ], data.historicoDieta),
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Adesão a dietas</label>',
      chips('adesao', [
        { value: 'sigo_facil',         label: 'Sigo fácil'        },
        { value: 'sigo_mais_ou_menos', label: 'Sigo mais ou menos' },
        { value: 'tenho_dificuldade',  label: 'Tenho dificuldade'  },
      ], data.adesao),
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-row">',
        '<div class="dw-col">',
          '<label class="dw-label">Rotina</label>',
          '<div class="dw-chips-col">',
            [{ value: 'muito_corrida', label: 'Muito corrida' }, { value: 'moderada', label: 'Moderada' }, { value: 'tranquila', label: 'Tranquila' }].map(function(o) {
              return '<button type="button" class="dw-chip-single' + (data.rotina === o.value ? ' active' : '') + '" data-group="rotina" data-value="' + o.value + '">' + o.label + '</button>';
            }).join(''),
          '</div>',
        '</div>',
        '<div class="dw-col">',
          '<label class="dw-label">Sono</label>',
          '<div class="dw-chips-col">',
            [{ value: 'ruim', label: 'Ruim' }, { value: 'regular', label: 'Regular' }, { value: 'bom', label: 'Bom' }].map(function(o) {
              return '<button type="button" class="dw-chip-single' + (data.sono === o.value ? ' active' : '') + '" data-group="sono" data-value="' + o.value + '">' + o.label + '</button>';
            }).join(''),
          '</div>',
        '</div>',
        '<div class="dw-col">',
          '<label class="dw-label">Estresse</label>',
          '<div class="dw-chips-col">',
            [{ value: 'alto', label: 'Alto' }, { value: 'moderado', label: 'Moderado' }, { value: 'baixo', label: 'Baixo' }].map(function(o) {
              return '<button type="button" class="dw-chip-single' + (data.estresse === o.value ? ' active' : '') + '" data-group="estresse" data-value="' + o.value + '">' + o.label + '</button>';
            }).join(''),
          '</div>',
        '</div>',
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Uso de hormônios</label>',
      chips('usoHormonios', [
        { value: 'nao',               label: 'Não'                  },
        { value: 'testosterona_trt',  label: 'Testosterona / TRT'   },
        { value: 'outro',             label: 'Outro'                },
      ], usoHormonios),
    '</div>',

    showHormonalAlert
      ? '<div class="dw-alert-hormonal">Uso de hormônios identificado. O KroniA não prescreve conduta hormonal. Consulte médico habilitado.</div>'
      : '',
  ].join('');
}
