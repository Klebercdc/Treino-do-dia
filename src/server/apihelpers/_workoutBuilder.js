'use strict';

function toEvidenceReferences(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function(item) {
      if (!item || typeof item !== 'object') return null;
      var title = item.title || item.topic || item.name || null;
      var source = item.source || item.journal || item.provider || null;
      var href = item.url || item.href || null;
      if (!title && !source && !href) return null;
      return {
        title: title ? String(title) : null,
        source: source ? String(source) : null,
        href: href ? String(href) : null,
        level: item.level || item.evidence_level || null,
      };
    })
    .filter(Boolean);
}

function normalizeReferencedWorkoutPlan(value) {
  if (!value || typeof value !== 'object') return null;
  var treinos = Array.isArray(value.treinos) ? value.treinos : [];
  var normalizedTreinos = treinos.map(function(treino, treinoIndex) {
    var exercicios = Array.isArray(treino && treino.exercicios) ? treino.exercicios : [];
    var normalizedExercises = exercicios.map(function(exercicio) {
      if (!exercicio || typeof exercicio !== 'object') return null;
      var nome = exercicio.nome || exercicio.name || exercicio.display_name || null;
      if (!nome) return null;
      return {
        nome: String(nome),
        series: Number(exercicio.series || exercicio.sets || 0) || 3,
        reps: String(exercicio.reps || exercicio.repeticoes || '8-12'),
        descanso: exercicio.descanso ? String(exercicio.descanso) : undefined,
        source_ref: exercicio.source_ref || exercicio.reference_id || null,
      };
    }).filter(Boolean);
    if (!normalizedExercises.length) return null;
    return {
      nome: String((treino && treino.nome) || ('Treino ' + String.fromCharCode(65 + treinoIndex))),
      grupo: String((treino && treino.grupo) || ''),
      exercicios: normalizedExercises,
    };
  }).filter(Boolean);

  if (!normalizedTreinos.length) return null;
  return {
    treinos: normalizedTreinos,
    orientacoes: value.orientacoes && typeof value.orientacoes === 'object' ? value.orientacoes : {},
  };
}

var EXERCISES_BY_ENV = {
  academia: {
    peito: ['Supino reto com barra', 'Supino inclinado com halteres', 'Crucifixo com halteres'],
    costas: ['Puxada alta', 'Remada curvada', 'Remada baixa'],
    pernas: ['Agachamento livre', 'Leg press', 'Mesa flexora'],
    ombros: ['Desenvolvimento com halteres', 'Elevacao lateral', 'Crucifixo inverso'],
    biceps: ['Rosca direta', 'Rosca martelo'],
    triceps: ['Triceps pulley', 'Triceps testa'],
    gluteos: ['Hip thrust', 'Agachamento bulgaro'],
    abdomen: ['Prancha', 'Elevacao de pernas']
  },
  casa_halteres: {
    peito: ['Supino com halteres', 'Flexao de bracos', 'Crucifixo com halteres'],
    costas: ['Remada unilateral com halter', 'Pullover com halter', 'Superman'],
    pernas: ['Agachamento com halteres', 'Avanco com halteres', 'Stiff com halteres'],
    ombros: ['Desenvolvimento com halteres', 'Elevacao lateral', 'Elevacao frontal'],
    biceps: ['Rosca alternada', 'Rosca martelo'],
    triceps: ['Triceps coice', 'Triceps frances com halter'],
    gluteos: ['Elevacao pelvica', 'Avanco'],
    abdomen: ['Prancha', 'Abdominal bicicleta']
  },
  casa_sem_equipamento: {
    peito: ['Flexao de bracos', 'Flexao inclinada', 'Flexao diamante'],
    costas: ['Superman', 'Remada invertida na mesa'],
    pernas: ['Agachamento livre', 'Avanco', 'Agachamento bulgaro'],
    ombros: ['Flexao pike', 'Prancha com toque no ombro'],
    biceps: ['Rosca isometrica com toalha'],
    triceps: ['Mergulho em cadeira', 'Flexao diamante'],
    gluteos: ['Elevacao pelvica', 'Donkey kick'],
    abdomen: ['Prancha', 'Mountain climber']
  }
};

var SPLITS = {
  1: [{ nome: 'Treino A', grupos: ['peito', 'costas', 'pernas', 'ombros', 'abdomen'] }],
  2: [
    { nome: 'Treino A', grupos: ['peito', 'costas', 'ombros'] },
    { nome: 'Treino B', grupos: ['pernas', 'gluteos', 'abdomen', 'biceps', 'triceps'] }
  ],
  3: [
    { nome: 'Treino A', grupos: ['peito', 'ombros', 'triceps'] },
    { nome: 'Treino B', grupos: ['costas', 'biceps', 'abdomen'] },
    { nome: 'Treino C', grupos: ['pernas', 'gluteos', 'abdomen'] }
  ],
  4: [
    { nome: 'Treino A', grupos: ['peito', 'triceps'] },
    { nome: 'Treino B', grupos: ['costas', 'biceps'] },
    { nome: 'Treino C', grupos: ['pernas', 'gluteos'] },
    { nome: 'Treino D', grupos: ['ombros', 'abdomen'] }
  ],
  5: [
    { nome: 'Treino A', grupos: ['peito'] },
    { nome: 'Treino B', grupos: ['costas'] },
    { nome: 'Treino C', grupos: ['pernas', 'gluteos'] },
    { nome: 'Treino D', grupos: ['ombros'] },
    { nome: 'Treino E', grupos: ['biceps', 'triceps', 'abdomen'] }
  ],
  6: [
    { nome: 'Treino A', grupos: ['peito', 'triceps'] },
    { nome: 'Treino B', grupos: ['costas', 'biceps'] },
    { nome: 'Treino C', grupos: ['pernas', 'gluteos'] },
    { nome: 'Treino D', grupos: ['ombros', 'abdomen'] },
    { nome: 'Treino E', grupos: ['peito', 'costas'] },
    { nome: 'Treino F', grupos: ['pernas', 'abdomen'] }
  ]
};

function normalizeGoal(raw) {
  var text = String(raw || '').toLowerCase();
  if (/forca/.test(text)) return 'forca';
  if (/defin|condicion|resisten/.test(text)) return 'definicao';
  return 'hipertrofia';
}

function normalizeLevel(raw) {
  var text = String(raw || '').toLowerCase();
  if (/inic/.test(text)) return 'iniciante';
  if (/avan/.test(text)) return 'avancado';
  return 'intermediario';
}

function normalizeDays(raw) {
  var parsed = Number.parseInt(String(raw || '').replace(/\D+/g, ''), 10);
  if (!Number.isInteger(parsed)) return 3;
  return Math.max(1, Math.min(6, parsed));
}

function normalizeEnvironment(raw) {
  var text = String(raw || '').toLowerCase();
  if (/sem equipamento|sem equip|bodyweight|ao ar livre/.test(text)) return 'casa_sem_equipamento';
  if (/halter|casa/.test(text)) return 'casa_halteres';
  return 'academia';
}

function buildPrescription(goal, level) {
  if (goal === 'forca') {
    if (level === 'iniciante') return { series: 3, reps: '5-8' };
    if (level === 'avancado') return { series: 5, reps: '3-5' };
    return { series: 4, reps: '4-6' };
  }
  if (goal === 'definicao') {
    return { series: 3, reps: '12-15' };
  }
  if (level === 'iniciante') return { series: 3, reps: '10-12' };
  if (level === 'avancado') return { series: 5, reps: '6-10' };
  return { series: 4, reps: '8-12' };
}

function isRestricted(exerciseName, limitations) {
  var text = String(limitations || '').toLowerCase();
  var name = String(exerciseName || '').toLowerCase();
  if (!text || text === 'nao' || text === 'não' || text === 'nenhuma') return false;
  if (/joelho/.test(text) && /agachamento|avanco|leg press/.test(name)) return true;
  if (/ombro|cervical/.test(text) && /desenvolvimento|elevacao frontal/.test(name)) return true;
  if (/coluna|lombar|hernia/.test(text) && /agachamento livre|remada curvada|stiff/.test(name)) return true;
  if (/cotovelo/.test(text) && /triceps testa|rosca direta/.test(name)) return true;
  return false;
}

function pickExercises(groups, environment, prescription, limitations) {
  var catalog = EXERCISES_BY_ENV[environment] || EXERCISES_BY_ENV.academia;
  var maxPerGroup = environment === 'academia' ? 2 : 1;
  var exercises = [];

  groups.forEach(function(group) {
    var pool = (catalog[group] || EXERCISES_BY_ENV.academia[group] || []).filter(function(name) {
      return !isRestricted(name, limitations);
    });
    pool.slice(0, maxPerGroup).forEach(function(name) {
      exercises.push({
        nome: name,
        series: prescription.series,
        reps: prescription.reps
      });
    });
  });

  return exercises.slice(0, environment === 'academia' ? 6 : 5);
}

/**
 * Gera treino a partir do catálogo interno quando não há template referenciado.
 * Retorna estrutura com failSafe:false e flow_state:'catalog_generated'.
 */
function buildStandaloneWorkout(input, goal, level, days, environment) {
  var prescription = buildPrescription(goal, level);
  var split = SPLITS[days] || SPLITS[3];
  var limitations = input.limitacoes || '';

  var treinos = split.map(function(day) {
    return {
      nome: day.nome,
      grupo: day.grupos.join('/'),
      exercicios: pickExercises(day.grupos, environment, prescription, limitations),
    };
  }).filter(function(t) { return t.exercicios.length > 0; });

  return {
    failSafe: false,
    flow_state: 'catalog_generated',
    treinos: treinos,
    references: [],
    orientacoes: {
      objetivo: goal,
      nivel: level,
      frequencia: days + 'x por semana',
      sessoes: String(input.tempo || '60 min'),
      ambiente: environment,
      observacao: 'Plano gerado a partir do catálogo de exercícios. Para prescrição referenciada, configure um template em workout_templates.',
    },
  };
}

function buildWorkoutPlan(collected) {
  var input = collected || {};
  var scientificConstraints = input.scientificConstraints && typeof input.scientificConstraints === 'object'
    ? input.scientificConstraints
    : {};
  var evidenceReferences = toEvidenceReferences(scientificConstraints.evidenceReferences);
  var referencedPlan = normalizeReferencedWorkoutPlan(
    scientificConstraints.referencedPlan || scientificConstraints.referencedWorkout || scientificConstraints.workoutPlan
  );

  // Path 1: template referenciado disponível — usa como fonte primária
  if (evidenceReferences.length && referencedPlan) {
    var goal = normalizeGoal(input.objetivo);
    var level = normalizeLevel(input.nivel);
    var days = normalizeDays(input.dias);
    var environment = normalizeEnvironment(input.equipamentos);
    var prescription = buildPrescription(goal, level);

    return {
      failSafe: false,
      flow_state: 'referenced_ready',
      treinos: referencedPlan.treinos.map(function(day) {
        return {
          nome: day.nome,
          grupo: day.grupo,
          exercicios: day.exercicios.map(function(exercicio) {
            return {
              nome: exercicio.nome,
              series: exercicio.series || prescription.series,
              reps: exercicio.reps || prescription.reps,
              descanso: exercicio.descanso || undefined,
              source_ref: exercicio.source_ref || null,
            };
          }),
        };
      }),
      references: evidenceReferences,
      orientacoes: {
        objetivo: goal,
        nivel: level,
        frequencia: days + 'x por semana',
        sessoes: String(input.tempo || '60 min'),
        ambiente: environment,
        observacao: environment === 'academia'
          ? 'Plano montado a partir de prescrição estruturada explicitamente referenciada.'
          : 'Plano adaptado ao equipamento informado a partir de prescrição estruturada explicitamente referenciada.'
      }
    };
  }

  // Path 2: sem template — tenta gerar a partir do catálogo interno
  var templateMetadata = scientificConstraints.templateMetadata && typeof scientificConstraints.templateMetadata === 'object'
    ? scientificConstraints.templateMetadata
    : {};
  var templateValidationError = typeof templateMetadata.validationError === 'string'
    ? templateMetadata.validationError
    : (!referencedPlan ? 'WORKOUT_TEMPLATE_MISSING' : null);

  var goal2 = normalizeGoal(input.objetivo);
  var level2 = normalizeLevel(input.nivel);
  var days2 = normalizeDays(input.dias);
  var environment2 = normalizeEnvironment(input.equipamentos);

  // Precisa de dados mínimos para gerar qualquer plano
  if (!input.objetivo && !input.nivel && !input.dias) {
    return {
      failSafe: true,
      flow_state: 'referenced_prescription_required',
      treinos: [],
      orientacoes: {
        objetivo: goal2,
        nivel: level2,
        frequencia: days2 + 'x por semana',
        sessoes: String(input.tempo || '60 min'),
        observacao: 'Treino não gerado: dados insuficientes (objetivo, nível e dias são necessários).',
      },
      references: [],
      templateMetadata: {
        templateId: templateMetadata.templateId || null,
        templateName: templateMetadata.templateName || null,
        validationError: templateValidationError,
      },
      observacoes: [
        'Dados insuficientes para gerar o treino.',
        'Informe objetivo, nível e frequência semanal.',
      ],
    };
  }

  // Gera a partir do catálogo com log de auditoria
  console.info('[workout-builder] template ausente (' + (templateValidationError || 'sem templates') +
    '), gerando a partir do catálogo interno. objetivo=' + goal2 +
    ' nivel=' + level2 + ' dias=' + days2 + ' ambiente=' + environment2);

  return buildStandaloneWorkout(input, goal2, level2, days2, environment2);
}

module.exports = {
  buildWorkoutPlan: buildWorkoutPlan,
  normalizeGoal: normalizeGoal,
  normalizeLevel: normalizeLevel,
  normalizeDays: normalizeDays,
  normalizeEnvironment: normalizeEnvironment
};
