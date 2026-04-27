/* Tela final do wizard — resumo antes de gerar dieta */

function renderDietSummary(state) {
  var body     = state.data.bodyComposition || {};
  var goal     = state.data.goal            || {};
  var health   = state.data.healthExams     || {};
  var food     = state.data.food            || {};
  var training = state.data.training        || {};
  var metab    = state.data.metabolism      || {};

  var stepsOk = (state.completedSteps || []).indexOf(1) !== -1 && (state.completedSteps || []).indexOf(2) !== -1;
  var hasAlerts = !!(
    (health.patologias && health.patologias.length) ||
    (metab.usoHormonios && metab.usoHormonios !== 'nao' && metab.usoHormonios !== 'Não')
  );

  function sourceLabel(src) {
    if (src === 'bcm') return 'BCM/BIA';
    if (src === 'pcm') return 'Medidas manuais';
    return 'Peso e altura';
  }

  function row(label, val) {
    if (!val) return '';
    return '<div class="dw-summary-row"><span class="dw-summary-key">' + label + '</span><span class="dw-summary-val">' + val + '</span></div>';
  }

  var modalStr = (training.modalidades || []).map(function(m) {
    return typeof m === 'object' ? (m.tipo || '') : m;
  }).join(', ');

  return [
    '<div class="dw-step-title">Resumo do seu perfil</div>',
    '<p class="dw-step-desc">Revise e depois toque no botão fixo abaixo para gerar sua dieta personalizada.</p>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Corpo</div>',
      row('Sexo',    body.sex),
      row('Idade',   body.age   ? body.age + ' anos'  : null),
      row('Peso',    body.weight_kg ? body.weight_kg + ' kg' : null),
      row('Altura',  body.height_cm ? body.height_cm + ' cm' : null),
      row('Dados corporais', sourceLabel(body.bcmMode === 'bcm' ? 'bcm' : body.bcmMode === 'pcm' ? 'pcm' : 'fallback')),
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(1)">Editar</button>',
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Objetivo</div>',
      row('Objetivo',    goal.objective),
      row('Prioridade',  goal.prioridade),
      row('Refeições',   goal.refeicoesPorDia ? goal.refeicoesPorDia + '/dia' : null),
      row('Meta calórica manual', goal.metaCaloricaManual ? goal.metaCaloricaManual + ' kcal' : null),
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(2)">Editar</button>',
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Saúde</div>',
      row('Condições', (health.patologias || []).join(', ') || 'Nenhuma informada'),
      '<div class="dw-alert-legal">O KroniA não substitui avaliação de profissional habilitado.</div>',
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(3)">Editar</button>',
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Alimentação</div>',
      row('Padrão', food.padraoAlimentar),
      row('Restrições', (food.restricoesAlimentares || []).join(', ') || null),
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(4)">Editar</button>',
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Treino</div>',
      row('Status', training.statusTreino),
      row('Modalidades', modalStr || null),
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(5)">Editar</button>',
    '</div>',

    '<div class="dw-card">',
      '<div class="dw-summary-card-title">Metabolismo</div>',
      row('Sono',    metab.sono),
      row('Adesão',  metab.adesao),
      row('Estresse', metab.estresse),
      '<button type="button" class="dw-btn-link" onclick="dietWizardEditStep(6)">Editar</button>',
    '</div>',

    hasAlerts
      ? '<div class="dw-alert-hormonal">Condição de saúde ou hormônio identificado. Recomendamos acompanhamento profissional especializado.</div>'
      : '',

    !stepsOk
      ? '<p class="dw-info-text" style="text-align:center;margin-top:8px">Complete as etapas 1 e 2 para continuar.</p>'
      : '',
  ].join('');
}
