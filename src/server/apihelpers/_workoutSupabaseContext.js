function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstString() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (typeof value !== 'string') continue;
    var trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function normalizeEvidenceReferences(value) {
  return asArray(value).map(function(item) {
    if (!item || typeof item !== 'object') return null;
    var source = asObject(item);
    var title = firstString(source.title, source.name, source.topic);
    var href = firstString(source.href, source.url);
    var provider = firstString(source.source, source.provider, source.journal);
    if (!title && !href && !provider) return null;
    return {
      title: title || null,
      href: href || null,
      source: provider || null,
      level: firstString(source.level, source.evidence_level) || null,
    };
  }).filter(Boolean);
}

function normalizeExercise(exercise) {
  var source = asObject(exercise);
  var nome = firstString(source.nome, source.name, source.display_name);
  if (!nome) return null;
  return {
    nome: nome,
    series: Number(source.series || source.sets || 0) || 3,
    reps: firstString(source.reps, source.repeticoes) || '8-12',
    descanso: firstString(source.descanso, source.rest) || undefined,
    source_ref: firstString(source.source_ref, source.reference_id, source.referenceId) || null,
  };
}

function normalizeTreino(value, index) {
  var source = asObject(value);
  var exercicios = asArray(source.exercicios || source.exercises).map(normalizeExercise).filter(Boolean);
  if (!exercicios.length) return null;
  return {
    nome: firstString(source.nome, source.name) || ('Treino ' + String.fromCharCode(65 + index)),
    grupo: firstString(source.grupo, source.group) || '',
    exercicios: exercicios,
  };
}

function normalizeReferencedPlan(candidate) {
  var source = asObject(candidate);
  var treinos = asArray(source.treinos || source.workouts || source.sessions).map(normalizeTreino).filter(Boolean);
  if (!treinos.length) return null;
  return { treinos: treinos };
}

function extractTemplateCandidates(rawTemplates) {
  if (Array.isArray(rawTemplates)) return rawTemplates;
  var root = asObject(rawTemplates);
  if (Array.isArray(root.templates)) return root.templates;
  if (root.treinos || root.workouts || root.sessions) return [root];
  return [];
}

function resolveWorkoutTemplatePayload(rawTemplates) {
  var candidates = extractTemplateCandidates(rawTemplates);
  var invalidDetected = false;
  for (var i = 0; i < candidates.length; i += 1) {
    var candidate = asObject(candidates[i]);
    var referencedPlan = normalizeReferencedPlan(candidate);
    if (!referencedPlan) {
      invalidDetected = true;
      continue;
    }
    var evidenceReferences = normalizeEvidenceReferences(
      candidate.evidenceReferences || candidate.references || candidate.scientificReferences
    );
    return {
      referencedPlan: referencedPlan,
      evidenceReferences: evidenceReferences,
      metadata: {
        templateId: firstString(candidate.id, candidate.template_id) || null,
        templateName: firstString(candidate.name, candidate.nome) || null,
        validationError: null,
      },
    };
  }
  return {
    referencedPlan: null,
    evidenceReferences: [],
    metadata: {
      templateId: null,
      templateName: null,
      validationError: invalidDetected ? 'INVALID_WORKOUT_TEMPLATE_SHAPE' : 'WORKOUT_TEMPLATE_MISSING',
    },
  };
}

function enrichWorkoutPayload(basePayload, context) {
  var payload = basePayload && typeof basePayload === 'object' ? Object.assign({}, basePayload) : {};
  var existingConstraints = asObject(payload.scientificConstraints);
  var templateData = resolveWorkoutTemplatePayload(context && context.workoutTemplates);

  payload.scientificConstraints = Object.assign({}, existingConstraints, {
    referencedPlan: existingConstraints.referencedPlan || templateData.referencedPlan || null,
    evidenceReferences: asArray(existingConstraints.evidenceReferences).length
      ? existingConstraints.evidenceReferences
      : templateData.evidenceReferences,
    templateMetadata: existingConstraints.templateMetadata || templateData.metadata,
  });

  payload.context = Object.assign({}, asObject(payload.context), {
    workoutTemplateMetadata: templateData.metadata,
  });

  return payload;
}

function enrichWorkoutRequestBody(body, context) {
  var safeBody = body && typeof body === 'object' ? Object.assign({}, body) : {};
  safeBody.payload = enrichWorkoutPayload(safeBody.payload, context);
  return safeBody;
}

async function loadWorkoutSupabaseContext(adminClient, userId) {
  if (!adminClient || !userId) {
    return {
      workoutTemplates: [],
    };
  }

  try {
    var result = await adminClient
      .from('workout_templates')
      .select('id,templates,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      workoutTemplates: result && result.data ? result.data.templates || [] : [],
    };
  } catch (_) {
    return {
      workoutTemplates: [],
    };
  }
}

module.exports = {
  resolveWorkoutTemplatePayload: resolveWorkoutTemplatePayload,
  enrichWorkoutPayload: enrichWorkoutPayload,
  enrichWorkoutRequestBody: enrichWorkoutRequestBody,
  loadWorkoutSupabaseContext: loadWorkoutSupabaseContext,
};
