/* Etapa 5 — Treino */

function renderDietStepTraining(data) {
  data = data || {};
  var statusOpts = [
    { value: 'nao_treino',          label: 'Não treino'               },
    { value: 'ja_treinei_parei',    label: 'Já treinei e parei'       },
    { value: 'voltando_agora',      label: 'Estou voltando agora'     },
    { value: 'treino_regularmente', label: 'Treino regularmente'      },
    { value: 'atleta_alta_perf',    label: 'Atleta / alta performance' },
  ];
  var perfilOpts = [
    { value: 'sedentario',        label: 'Sedentário'         },
    { value: 'iniciante',         label: 'Iniciante'          },
    { value: 'intermediario',     label: 'Intermediário'      },
    { value: 'avancado',          label: 'Avançado'           },
    { value: 'atleta_competidor', label: 'Atleta / competidor' },
  ];
  var intensOpts = [
    { value: 'leve',         label: 'Leve'         },
    { value: 'moderado',     label: 'Moderado'     },
    { value: 'intenso',      label: 'Intenso'      },
    { value: 'muito_intenso', label: 'Muito intenso' },
  ];
  var modalidades = [
    'musculacao', 'crossfit', 'cardio', 'corrida',
    'caminhada', 'bike', 'funcional', 'esporte', 'outro'
  ];
  var modalLabels = {
    musculacao: 'Musculação', crossfit: 'CrossFit', cardio: 'Cardio',
    corrida: 'Corrida', caminhada: 'Caminhada', bike: 'Bike',
    funcional: 'Funcional', esporte: 'Esporte', outro: 'Outro'
  };
  var rotinaOpts = [
    { value: 'trabalho_sentado',      label: 'Trabalho sentado'      },
    { value: 'trabalho_em_pe',        label: 'Trabalho em pé'        },
    { value: 'trabalho_fisico_leve',  label: 'Trabalho físico leve'  },
    { value: 'trabalho_fisico_pesado', label: 'Trabalho físico pesado' },
  ];
  var selModal = (data.modalidades || []).map(function(m) { return typeof m === 'object' ? m.tipo : m; });

  return [
    '<div class="dw-step-title">Treino</div>',
    '<p class="dw-info-text">Quanto melhor entendermos seu treino, mais precisa será sua dieta.</p>',

    '<div class="dw-card">',
      '<label class="dw-label">Status do treino</label>',
      '<div class="dw-chips-col">',
        statusOpts.map(function(o) {
          return '<button type="button" class="dw-chip-single' + (data.statusTreino === o.value ? ' active' : '') + '" data-group="statusTreino" data-value="' + o.value + '">' + o.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Perfil do treino</label>',
      '<div class="dw-chips-row">',
        perfilOpts.map(function(o) {
          return '<button type="button" class="dw-chip-single' + (data.perfilTreino === o.value ? ' active' : '') + '" data-group="perfilTreino" data-value="' + o.value + '">' + o.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Intensidade geral</label>',
      '<div class="dw-chips-row">',
        intensOpts.map(function(o) {
          return '<button type="button" class="dw-chip-single' + (data.intensidadeGeral === o.value ? ' active' : '') + '" data-group="intensidadeGeral" data-value="' + o.value + '">' + o.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Modalidades (selecione todas que pratica)</label>',
      '<div class="dw-chips-wrap">',
        modalidades.map(function(m) {
          return '<button type="button" class="dw-chip' + (selModal.indexOf(m) !== -1 ? ' active' : '') + '" data-group="modalidades" data-multi="true" data-value="' + m + '">' + modalLabels[m] + '</button>';
        }).join(''),
      '</div>',
      '<div class="dw-modalidades-expand"></div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Rotina fora do treino</label>',
      '<div class="dw-chips-col">',
        rotinaOpts.map(function(o) {
          return '<button type="button" class="dw-chip-single' + (data.rotinaForaTreino === o.value ? ' active' : '') + '" data-group="rotinaForaTreino" data-value="' + o.value + '">' + o.label + '</button>';
        }).join(''),
      '</div>',
    '</div>',

    '<div class="dw-card">',
      '<label class="dw-label">Nível de fadiga (0 = nenhuma, 10 = extrema)</label>',
      '<input class="dw-input" type="number" name="fadiga" min="0" max="10" placeholder="0 a 10" value="' + (data.fadiga != null ? data.fadiga : '') + '">',

      '<label class="dw-label" style="margin-top:12px">Dor muscular frequente?</label>',
      '<div class="dw-chips-row">',
        '<button type="button" class="dw-chip-single' + (data.dorMuscular === 'sim' ? ' active' : '') + '" data-group="dorMuscular" data-value="sim">Sim</button>',
        '<button type="button" class="dw-chip-single' + (data.dorMuscular === 'nao' ? ' active' : '') + '" data-group="dorMuscular" data-value="nao">Não</button>',
      '</div>',

      '<label class="dw-label" style="margin-top:12px">Queda de rendimento?</label>',
      '<div class="dw-chips-row">',
        '<button type="button" class="dw-chip-single' + (data.quedaRendimento === 'sim' ? ' active' : '') + '" data-group="quedaRendimento" data-value="sim">Sim</button>',
        '<button type="button" class="dw-chip-single' + (data.quedaRendimento === 'nao' ? ' active' : '') + '" data-group="quedaRendimento" data-value="nao">Não</button>',
      '</div>',
    '</div>',
  ].join('');
}
