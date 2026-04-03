var plans = require('./_plans');

function safeNowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  var n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
}

function estimateOneRm(weight, reps) {
  var w = Number(weight);
  var r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
  return w * (1 + r / 30);
}

function supabase(method, path, body) {
  return new Promise(function(resolve, reject) {
    plans.supabaseRequest(method, path, body, function(err, data) {
      if (err) return reject(new Error(String(err)));
      resolve(data);
    });
  });
}

function mapBlocksForEvent(eventType) {
  var t = String(eventType || '').toLowerCase();
  if (t === 'workout_completed' || t === 'workout_generated') {
    return ['performance_trend', 'adherence_state', 'recovery_state', 'fatigue_state', 'training_tolerance_state', 'objective_alignment_state', 'coaching_summary'];
  }
  if (t === 'diet_generated' || t === 'diet_feedback') {
    return ['nutrition_state', 'objective_alignment_state', 'body_composition_state', 'coaching_summary'];
  }
  if (t === 'body_metrics' || t === 'weight_update') {
    return ['body_composition_state', 'objective_alignment_state', 'coaching_summary'];
  }
  if (t === 'checkin' || t === 'subjective_feedback') {
    return ['recovery_state', 'fatigue_state', 'adherence_state', 'training_tolerance_state', 'coaching_summary'];
  }
  return ['coaching_summary'];
}

async function appendUserMemoryEvent(params) {
  var userId = params.userId;
  var eventType = params.eventType;
  var payload = params.payload || {};
  var requestId = params.requestId || null;
  var source = params.source || 'api';
  var occurredAt = params.occurredAt || safeNowIso();
  var eventKey = params.eventKey || (userId + ':' + eventType + ':' + (payload.eventHash || requestId || Date.now()));

  var row = {
    user_id: userId,
    event_key: eventKey,
    event_type: eventType,
    event_source: source,
    payload: payload,
    occurred_at: occurredAt,
    request_id: requestId,
    component: params.component || 'chat_api'
  };

  var inserted = false;
  var eventId = null;
  try {
    var created = await supabase('POST', 'user_memory_events', row);
    inserted = !!(created && created[0]);
    eventId = created && created[0] ? created[0].id : null;
  } catch (error) {
    if (String(error.message || '').indexOf('duplicate key value') >= 0) {
      inserted = false;
    } else {
      throw error;
    }
  }

  return { inserted: inserted, eventId: eventId, eventKey: eventKey };
}

async function loadMemoryData(userId) {
  var workouts = await supabase(
    'GET',
    'workouts?user_id=eq.' + userId + '&select=id,date,duration_minutes,created_at&order=date.desc&limit=42',
    null
  ).catch(function() { return []; });

  var workoutIds = (workouts || []).map(function(w) { return w.id; }).filter(Boolean);
  var logs = [];
  if (workoutIds.length) {
    logs = await supabase(
      'GET',
      'workout_logs?workout_id=in.(' + workoutIds.join(',') + ')&select=workout_id,weight_kg,reps,rpe,exercise_id,created_at&limit=5000',
      null
    ).catch(function() { return []; });
  }

  var profile = await supabase('GET', 'profiles?id=eq.' + userId + '&select=id,objective,current_weight_kg,activity_level,updated_at&limit=1', null)
    .then(function(rows) { return rows && rows[0] ? rows[0] : null; })
    .catch(function() { return null; });

  var nutritionGoal = await supabase('GET', 'nutrition_goals?user_id=eq.' + userId + '&select=calories_target,protein_g,carbs_g,fat_g,updated_at&order=updated_at.desc&limit=1', null)
    .then(function(rows) { return rows && rows[0] ? rows[0] : null; })
    .catch(function() { return null; });

  var events = await supabase('GET', 'user_memory_events?user_id=eq.' + userId + '&select=id,event_type,payload,occurred_at,created_at&order=occurred_at.desc&limit=120', null)
    .catch(function() { return []; });

  return { workouts: workouts || [], logs: logs || [], profile: profile, nutritionGoal: nutritionGoal, events: events || [] };
}

function derivePerformanceTrend(data) {
  var workouts = data.workouts || [];
  var logs = data.logs || [];
  var byWorkout = Object.create(null);
  logs.forEach(function(log) {
    if (!byWorkout[log.workout_id]) byWorkout[log.workout_id] = [];
    byWorkout[log.workout_id].push(log);
  });

  var recent = workouts.slice(0, 10);
  var previous = workouts.slice(10, 20);

  function summarize(batch) {
    var totalVolume = 0;
    var totalRpe = 0;
    var rpeCount = 0;
    var topRm = 0;
    batch.forEach(function(w) {
      (byWorkout[w.id] || []).forEach(function(l) {
        totalVolume += (Number(l.weight_kg) || 0) * (Number(l.reps) || 0);
        var rpe = Number(l.rpe);
        if (Number.isFinite(rpe) && rpe > 0) {
          totalRpe += rpe;
          rpeCount += 1;
        }
        topRm = Math.max(topRm, estimateOneRm(l.weight_kg, l.reps));
      });
    });
    return {
      volume: totalVolume,
      avgRpe: rpeCount ? (totalRpe / rpeCount) : null,
      topRm: topRm
    };
  }

  var a = summarize(recent);
  var b = summarize(previous);
  var deltaVolume = b.volume > 0 ? ((a.volume - b.volume) / b.volume) : 0;
  var deltaRm = b.topRm > 0 ? ((a.topRm - b.topRm) / b.topRm) : 0;
  var status = 'stable';
  if (deltaRm > 0.03 || deltaVolume > 0.08) status = 'improving';
  if (deltaRm < -0.03 || deltaVolume < -0.1) status = 'declining';

  return {
    status: status,
    score: clamp(50 + (deltaRm * 300) + (deltaVolume * 120), 0, 100),
    confidence: recent.length >= 6 ? 0.86 : recent.length >= 3 ? 0.62 : 0.34,
    explanation: status === 'improving'
      ? 'Performance e/ou volume em trajetória de alta nas sessões recentes.'
      : (status === 'declining' ? 'Queda de performance/volume detectada no período recente.' : 'Sem tendência forte de melhora ou queda.'),
    sourceSignals: {
      workoutsRecent: recent.length,
      volumeRecent: Math.round(a.volume),
      volumePrevious: Math.round(b.volume),
      topRmRecent: Math.round(a.topRm),
      topRmPrevious: Math.round(b.topRm),
      avgRpeRecent: a.avgRpe ? Number(a.avgRpe.toFixed(2)) : null
    },
    updatedAt: safeNowIso()
  };
}

function deriveAdherenceState(data) {
  var workouts = data.workouts || [];
  var now = Date.now();
  var recent = workouts.filter(function(w) {
    return new Date(w.date || w.created_at).getTime() >= now - (14 * 24 * 60 * 60 * 1000);
  });
  var weekly = recent.length / 2;
  var score = clamp((weekly / 4) * 100, 0, 100);
  var status = weekly >= 3 ? 'high' : weekly >= 1.5 ? 'moderate' : 'low';

  return {
    status: status,
    score: Number(score.toFixed(1)),
    confidence: recent.length >= 4 ? 0.82 : 0.55,
    explanation: 'Aderência estimada pela frequência de sessões registradas nas últimas 2 semanas.',
    sourceSignals: { sessionsLast14d: recent.length, weeklyFrequencyEstimate: Number(weekly.toFixed(2)) },
    updatedAt: safeNowIso()
  };
}

function deriveRecoveryAndFatigue(data) {
  var events = data.events || [];
  var checkins = events.filter(function(e) { return e.event_type === 'checkin' || e.event_type === 'subjective_feedback'; }).slice(0, 20);
  var sleepHours = checkins.map(function(c) { return Number(c.payload && c.payload.sleep_hours); }).filter(function(n) { return Number.isFinite(n) && n > 0; });
  var soreness = checkins.map(function(c) { return Number(c.payload && c.payload.soreness_level); }).filter(function(n) { return Number.isFinite(n) && n >= 0; });
  var fatigue = checkins.map(function(c) { return Number(c.payload && c.payload.fatigue_level); }).filter(function(n) { return Number.isFinite(n) && n >= 0; });

  var avgSleep = avg(sleepHours);
  var avgSoreness = avg(soreness);
  var avgFatigue = avg(fatigue);

  var recoveryStatus = 'adequate';
  if ((avgSleep != null && avgSleep < 6.2) || (avgSoreness != null && avgSoreness > 7)) recoveryStatus = 'compromised';
  if ((avgSleep != null && avgSleep < 5.3) || (avgFatigue != null && avgFatigue > 8)) recoveryStatus = 'critical';

  var fatigueStatus = 'managed';
  if ((avgFatigue != null && avgFatigue > 6.5) || (avgSoreness != null && avgSoreness > 6.5)) fatigueStatus = 'elevated';
  if ((avgFatigue != null && avgFatigue > 8) || (avgSoreness != null && avgSoreness > 8)) fatigueStatus = 'critical';

  return {
    recovery_state: {
      status: recoveryStatus,
      score: clamp(100 - ((avgFatigue || 5) * 10) - ((7 - (avgSleep || 7)) * 8), 0, 100),
      confidence: checkins.length >= 4 ? 0.78 : 0.45,
      explanation: 'Recuperação inferida por sono e feedback subjetivo recente.',
      sourceSignals: { avgSleepHours: avgSleep, avgSoreness: avgSoreness, checkins: checkins.length },
      updatedAt: safeNowIso()
    },
    fatigue_state: {
      status: fatigueStatus,
      score: clamp((avgFatigue || 5) * 12, 0, 100),
      confidence: checkins.length >= 4 ? 0.76 : 0.4,
      explanation: 'Estado de fadiga inferido por auto-relato e dores pós-sessão.',
      sourceSignals: { avgFatigue: avgFatigue, avgSoreness: avgSoreness, checkins: checkins.length },
      updatedAt: safeNowIso()
    }
  };
}

function deriveBodyCompositionState(data) {
  var profile = data.profile || {};
  var events = data.events || [];
  var bodyEvents = events.filter(function(e) { return e.event_type === 'weight_update' || e.event_type === 'body_metrics'; }).slice(0, 12);
  var weightSeries = bodyEvents
    .map(function(e) { return Number(e.payload && (e.payload.weight_kg != null ? e.payload.weight_kg : e.payload.weight)); })
    .filter(function(n) { return Number.isFinite(n) && n > 0; });

  if (!weightSeries.length && Number(profile.current_weight_kg) > 0) {
    weightSeries = [Number(profile.current_weight_kg)];
  }

  var first = weightSeries.length ? weightSeries[weightSeries.length - 1] : null;
  var last = weightSeries.length ? weightSeries[0] : null;
  var delta = first && last ? (last - first) : 0;
  var status = 'stable';
  if (Math.abs(delta) > 1.2) status = delta < 0 ? 'reducing' : 'increasing';

  return {
    status: status,
    score: clamp(70 - Math.abs(delta * 10), 0, 100),
    confidence: weightSeries.length >= 4 ? 0.8 : 0.42,
    explanation: weightSeries.length ? 'Composição corporal inferida por tendência de peso e métricas registradas.' : 'Sem dados corporais recentes; estado estimado com baixa confiança.',
    sourceSignals: { samples: weightSeries.length, latestWeightKg: last, deltaKg: Number((delta || 0).toFixed(2)) },
    updatedAt: safeNowIso()
  };
}

function deriveNutritionState(data) {
  var nutritionGoal = data.nutritionGoal;
  var events = data.events || [];
  var dietEvents = events.filter(function(e) { return e.event_type === 'diet_generated' || e.event_type === 'diet_feedback'; }).slice(0, 20);
  var adherenceEntries = dietEvents
    .map(function(e) { return Number(e.payload && e.payload.adherence_score); })
    .filter(function(n) { return Number.isFinite(n); });

  var adherence = adherenceEntries.length ? avg(adherenceEntries) : null;
  var status = adherence == null ? 'unknown' : (adherence >= 75 ? 'consistent' : adherence >= 50 ? 'irregular' : 'low');

  return {
    status: status,
    score: adherence == null ? 45 : clamp(adherence, 0, 100),
    confidence: adherenceEntries.length >= 3 ? 0.72 : 0.38,
    explanation: nutritionGoal ? 'Estado nutricional combinado entre metas atuais e feedback de aderência.' : 'Sem meta nutricional formal recente; inferência baseada em eventos de dieta.',
    sourceSignals: {
      hasActiveGoal: !!nutritionGoal,
      adherenceSamples: adherenceEntries.length,
      adherenceAvg: adherence == null ? null : Number(adherence.toFixed(1))
    },
    updatedAt: safeNowIso()
  };
}

function deriveTrainingToleranceState(perf, recovery, fatigue, adherence) {
  var status = 'adequate';
  if (fatigue.status === 'elevated' || recovery.status === 'compromised') status = 'watch';
  if (fatigue.status === 'critical' || recovery.status === 'critical') status = 'overreaching_risk';

  return {
    status: status,
    score: clamp((Number(perf.score || 50) * 0.35) + (Number(adherence.score || 50) * 0.25) + (Number(recovery.score || 50) * 0.2) + (100 - Number(fatigue.score || 50)) * 0.2, 0, 100),
    confidence: 0.69,
    explanation: 'Tolerância de treino derivada de performance, adesão, recuperação e fadiga.',
    sourceSignals: {
      performanceStatus: perf.status,
      recoveryStatus: recovery.status,
      fatigueStatus: fatigue.status,
      adherenceStatus: adherence.status
    },
    updatedAt: safeNowIso()
  };
}

function deriveObjectiveAlignmentState(data, perf, nutrition, bodyComp) {
  var objective = String((data.profile && data.profile.objective) || 'manutencao').toLowerCase();
  var status = 'partial';
  var reason = 'Sinais mistos entre objetivo e execução atual.';

  if (/emagrec|cut/.test(objective)) {
    if (bodyComp.status === 'reducing' && nutrition.status !== 'low') { status = 'aligned'; reason = 'Peso/composição e dieta compatíveis com cutting.'; }
    if (bodyComp.status === 'increasing' && nutrition.status === 'low') { status = 'misaligned'; reason = 'Sinais corporais e adesão indicam desalinhamento com cutting.'; }
  } else if (/hipertrof|massa|bulking/.test(objective)) {
    if (perf.status === 'improving' && nutrition.status !== 'low') { status = 'aligned'; reason = 'Performance e alimentação coerentes com ganho de massa.'; }
    if (perf.status === 'declining' && nutrition.status === 'low') { status = 'misaligned'; reason = 'Queda de performance com baixa aderência nutricional para hipertrofia.'; }
  } else if (/recompos/.test(objective)) {
    if (perf.status !== 'declining' && bodyComp.status !== 'increasing') { status = 'aligned'; reason = 'Recomposição com sinais estáveis de performance e composição.'; }
  }

  return {
    status: status,
    score: status === 'aligned' ? 82 : status === 'partial' ? 58 : 34,
    confidence: 0.63,
    explanation: reason,
    sourceSignals: { objective: objective, performanceStatus: perf.status, nutritionStatus: nutrition.status, bodyStatus: bodyComp.status },
    updatedAt: safeNowIso()
  };
}

function buildCoachingSummary(blocks) {
  var perf = blocks.performance_trend;
  var adherence = blocks.adherence_state;
  var recovery = blocks.recovery_state;
  var fatigue = blocks.fatigue_state;
  var nutrition = blocks.nutrition_state;
  var objective = blocks.objective_alignment_state;

  var direction = perf.status === 'improving' ? 'melhorou' : (perf.status === 'declining' ? 'piorou' : 'estabilizou');
  var text = 'Nas últimas semanas você ' + direction + ' em performance; adesão está ' + adherence.status + ', recuperação ' + recovery.status + ' e fadiga ' + fatigue.status + '.';
  if (nutrition.status !== 'unknown') text += ' Consistência nutricional: ' + nutrition.status + '.';
  text += ' Alinhamento com objetivo: ' + objective.status + '.';
  return {
    status: direction === 'melhorou' ? 'improving' : (direction === 'piorou' ? 'declining' : 'stable'),
    score: clamp((Number(perf.score || 50) + Number(adherence.score || 50) + Number(objective.score || 50)) / 3, 0, 100),
    confidence: 0.71,
    explanation: text,
    sourceSignals: {
      performance: perf.status,
      adherence: adherence.status,
      recovery: recovery.status,
      fatigue: fatigue.status,
      objective: objective.status
    },
    updatedAt: safeNowIso(),
    executiveText: text
  };
}

async function recomputeUserMemoryBlocks(params) {
  var userId = params.userId;
  var blocksToUpdate = Array.isArray(params.blocks) && params.blocks.length ? params.blocks : null;
  var requestId = params.requestId || null;
  var component = params.component || 'chat_api';
  var started = Date.now();

  var current = await supabase('GET', 'user_memory_state?user_id=eq.' + userId + '&select=*', null)
    .then(function(rows) { return rows && rows[0] ? rows[0] : null; })
    .catch(function() { return null; });
  var prevState = current && current.derived_state && typeof current.derived_state === 'object' ? current.derived_state : {};

  var loaded = await loadMemoryData(userId);
  var nextState = Object.assign({}, prevState);

  function should(key) {
    return !blocksToUpdate || blocksToUpdate.indexOf(key) >= 0;
  }

  var perf = should('performance_trend') ? derivePerformanceTrend(loaded) : (nextState.performance_trend || derivePerformanceTrend(loaded));
  var adherence = should('adherence_state') ? deriveAdherenceState(loaded) : (nextState.adherence_state || deriveAdherenceState(loaded));
  var rf = deriveRecoveryAndFatigue(loaded);
  var recovery = should('recovery_state') ? rf.recovery_state : (nextState.recovery_state || rf.recovery_state);
  var fatigue = should('fatigue_state') ? rf.fatigue_state : (nextState.fatigue_state || rf.fatigue_state);
  var body = should('body_composition_state') ? deriveBodyCompositionState(loaded) : (nextState.body_composition_state || deriveBodyCompositionState(loaded));
  var nutrition = should('nutrition_state') ? deriveNutritionState(loaded) : (nextState.nutrition_state || deriveNutritionState(loaded));
  var tolerance = should('training_tolerance_state') ? deriveTrainingToleranceState(perf, recovery, fatigue, adherence) : (nextState.training_tolerance_state || deriveTrainingToleranceState(perf, recovery, fatigue, adherence));
  var alignment = should('objective_alignment_state') ? deriveObjectiveAlignmentState(loaded, perf, nutrition, body) : (nextState.objective_alignment_state || deriveObjectiveAlignmentState(loaded, perf, nutrition, body));

  nextState.performance_trend = perf;
  nextState.adherence_state = adherence;
  nextState.recovery_state = recovery;
  nextState.fatigue_state = fatigue;
  nextState.body_composition_state = body;
  nextState.nutrition_state = nutrition;
  nextState.training_tolerance_state = tolerance;
  nextState.objective_alignment_state = alignment;
  nextState.coaching_summary = buildCoachingSummary(nextState);

  var upsertPayload = {
    user_id: userId,
    derived_state: nextState,
    coaching_summary: nextState.coaching_summary.executiveText,
    version: Number(current && current.version ? current.version : 0) + 1,
    last_event_at: safeNowIso(),
    updated_at: safeNowIso()
  };

  await supabase('POST', 'user_memory_state', upsertPayload).catch(async function() {
    await supabase('PATCH', 'user_memory_state?user_id=eq.' + userId, {
      derived_state: nextState,
      coaching_summary: nextState.coaching_summary.executiveText,
      version: upsertPayload.version,
      last_event_at: upsertPayload.last_event_at,
      updated_at: upsertPayload.updated_at
    });
  });

  var recalculated = blocksToUpdate || Object.keys(nextState);
  await supabase('POST', 'user_memory_audit_logs', {
    user_id: userId,
    request_id: requestId,
    component: component,
    event_type: 'memory_recompute',
    blocks_recalculated: recalculated,
    previous_state: prevState,
    next_state: nextState,
    duration_ms: Date.now() - started,
    status: 'success'
  }).catch(function() { return null; });

  return { snapshot: nextState, recalculatedBlocks: recalculated, durationMs: Date.now() - started };
}

async function getUserMemorySnapshot(userId) {
  var row = await supabase('GET', 'user_memory_state?user_id=eq.' + userId + '&select=user_id,version,derived_state,coaching_summary,updated_at,last_event_at&limit=1', null)
    .then(function(rows) { return rows && rows[0] ? rows[0] : null; })
    .catch(function() { return null; });
  return row;
}

async function getCoachingSummary(userId) {
  var row = await getUserMemorySnapshot(userId);
  if (!row || !row.derived_state) return null;
  var summary = row.derived_state.coaching_summary || null;
  return {
    text: summary && summary.executiveText ? summary.executiveText : row.coaching_summary,
    status: summary && summary.status ? summary.status : 'stable',
    score: summary && summary.score != null ? summary.score : 50,
    confidence: summary && summary.confidence != null ? summary.confidence : 0.3,
    updatedAt: row.updated_at,
    blocks: row.derived_state
  };
}

async function getProgressAnalysis(userId) {
  var summary = await getCoachingSummary(userId);
  if (!summary) {
    return {
      status: 'insufficient_data',
      verdict: 'stabilizou',
      explanation: 'Ainda não há dados suficientes para análise longitudinal completa.',
      confidence: 0.2
    };
  }

  var verdict = summary.status === 'improving' ? 'melhorou' : (summary.status === 'declining' ? 'piorou' : 'estabilizou');
  return {
    status: summary.status,
    verdict: verdict,
    explanation: summary.text,
    confidence: summary.confidence,
    score: summary.score,
    updatedAt: summary.updatedAt,
    blocks: summary.blocks
  };
}

function captureEventAndRecompute(params) {
  return appendUserMemoryEvent(params)
    .then(function(result) {
      var blocks = mapBlocksForEvent(params.eventType);
      return recomputeUserMemoryBlocks({
        userId: params.userId,
        blocks: blocks,
        requestId: params.requestId || null,
        component: params.component || 'chat_api'
      }).then(function(recomputed) {
        return { event: result, recomputed: recomputed };
      });
    });
}

module.exports = {
  appendUserMemoryEvent: appendUserMemoryEvent,
  recomputeUserMemoryBlocks: recomputeUserMemoryBlocks,
  getUserMemorySnapshot: getUserMemorySnapshot,
  getCoachingSummary: getCoachingSummary,
  getProgressAnalysis: getProgressAnalysis,
  captureEventAndRecompute: captureEventAndRecompute,
  mapBlocksForEvent: mapBlocksForEvent
};
