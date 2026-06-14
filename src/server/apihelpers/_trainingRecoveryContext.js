'use strict';

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  var parsed = Number(String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function daysSince(dateValue) {
  if (!dateValue) return 999;
  var time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.floor((Date.now() - time) / 86400000);
}

function rpeFactor(rpe) {
  var n = toNumber(rpe);
  if (n === null) return 0.6;
  return Math.max(0.3, Math.min(1, n / 10));
}

function classifyLoad(effectiveSetsLast7Days, avgRpe) {
  var sets = Number(effectiveSetsLast7Days || 0);
  var rpe = Number(avgRpe || 0);
  if (sets >= 22 || (sets >= 18 && rpe >= 8.5)) return 'VERY_HIGH';
  if (sets >= 14 || (sets >= 10 && rpe >= 8)) return 'HIGH';
  if (sets >= 6) return 'MODERATE';
  return 'LOW';
}

function buildRecoveryNotes(ctx) {
  var notes = [];
  if (!ctx) return notes;
  if (ctx.loadState === 'VERY_HIGH') notes.push('Carga de treino muito alta: priorizar recuperação, hidratação e distribuição de carboidratos.');
  else if (ctx.loadState === 'HIGH') notes.push('Carga de treino alta: dieta deve sustentar performance sem exagerar no déficit.');
  else if (ctx.loadState === 'LOW' && ctx.daysSinceLastWorkout < 10) notes.push('Carga recente baixa: manter aporte suficiente, mas sem superestimar gasto de treino.');

  if (ctx.fatigue && Number(ctx.fatigue.score) >= 7) notes.push('Fadiga elevada: evitar corte calórico agressivo e reforçar recuperação.');
  else if (ctx.fatigue && Number(ctx.fatigue.score) >= 5) notes.push('Fadiga moderada: ajustar carboidratos em torno do treino e monitorar resposta.');

  if (ctx.recentPRCount >= 1) notes.push('PR recente detectado: considerar suporte nutricional para adaptação e recuperação muscular.');
  if (ctx.recentPRCount >= 3) notes.push('Múltiplos PRs recentes: corpo respondendo bem ao estímulo; dieta deve sustentar sobrecarga progressiva.');
  if (ctx.daysSinceLastWorkout >= 10 && ctx.totalTrainingDays >= 4) notes.push('Inatividade recente: reduzir estimativa de gasto por treino até retorno consistente.');
  if (ctx.needsDeload) notes.push('Sinal de deload: priorizar recuperação e evitar volume alimentar voltado a alta performance no curto prazo.');
  return notes;
}

function summarizeTrainingSignals(input) {
  var sets = Array.isArray(input.sets) ? input.sets : [];
  var prs = Array.isArray(input.prs) ? input.prs : [];
  var adaptations = Array.isArray(input.adaptations) ? input.adaptations : [];
  var history = Array.isArray(input.history) ? input.history : [];
  var fatigueRows = Array.isArray(input.fatigueRows) ? input.fatigueRows : [];
  var since7 = input.since7;
  var lastWorkoutDate = input.lastWorkoutDate || null;
  var totalTrainingDays = Number(input.totalTrainingDays || 0);

  var sets7 = sets.filter(function(row) {
    var d = row && row.workouts ? row.workouts.date : row.workout_date || row.date;
    return d && d >= since7;
  });
  var effectiveSets7 = sets7.reduce(function(sum, row) { return sum + rpeFactor(row && row.rpe); }, 0);
  var avgRpe = sets.length ? sets.reduce(function(sum, row) { return sum + (toNumber(row && row.rpe) || 0); }, 0) / sets.length : 0;
  var loadState = classifyLoad(effectiveSets7, avgRpe);
  var latestFatigue = fatigueRows.length ? fatigueRows[0] : null;
  var fatigueScore = latestFatigue ? toNumber(latestFatigue.score) : null;
  var recentPRs = prs.map(function(pr) {
    return {
      exerciseId: pr.exercise_id || null,
      weightKg: toNumber(pr.weight_kg),
      reps: toNumber(pr.reps),
      oneRmKg: toNumber(pr.one_rm_kg),
      recordedAt: pr.recorded_at || pr.created_at || null,
      source: pr.source || null,
    };
  });
  var readinessScore = fatigueScore !== null
    ? Math.max(0, Math.min(10, 10 - fatigueScore))
    : loadState === 'VERY_HIGH' ? 3 : loadState === 'HIGH' ? 5 : loadState === 'MODERATE' ? 7 : 6;
  var recoveryStatus = readinessScore <= 3 || loadState === 'VERY_HIGH' ? 'baixa' : readinessScore <= 5 || loadState === 'HIGH' ? 'moderada' : 'alta';
  var needsDeload = loadState === 'VERY_HIGH' || (fatigueScore !== null && fatigueScore >= 8);
  var strengthTrend = recentPRs.length >= 3 ? 'subindo' : recentPRs.length ? 'melhorando' : null;
  var priority = needsDeload ? 'recuperacao' : recentPRs.length ? 'performance_adaptacao' : loadState === 'LOW' ? 'manutencao_sem_superestimar_gasto' : 'sustentar_treino';

  var context = {
    source: 'kronia_training_recovery',
    loadState: loadState,
    avgRpe: Math.round(avgRpe * 10) / 10,
    effectiveSetsLast7Days: Math.round(effectiveSets7 * 10) / 10,
    totalSetsLast7Days: sets7.length,
    totalSetsLast14Days: sets.length,
    lastWorkoutDate: lastWorkoutDate,
    daysSinceLastWorkout: daysSince(lastWorkoutDate),
    totalTrainingDays: totalTrainingDays,
    fatigue: latestFatigue ? { score: fatigueScore, notas: latestFatigue.notas || null, createdAt: latestFatigue.created_at || null, isRecent: latestFatigue.created_at ? daysSince(latestFatigue.created_at) <= 1 : false } : null,
    recoveryScore: Math.round(readinessScore * 10) / 10,
    recoveryStatus: recoveryStatus,
    readiness: { score: Math.round(readinessScore * 10) / 10, level: recoveryStatus, reasons: [] },
    recentPRCount: recentPRs.length,
    recentPRs: recentPRs,
    adaptations: adaptations.map(function(item) { return { type: item.adaptation_type || item.type || null, loadState: item.load_state || item.loadState || null, reasoning: item.reasoning || null, status: item.status || null, createdAt: item.created_at || null }; }),
    workoutHistoryCount: history.length,
    strengthTrend: strengthTrend,
    prioridadeMetabolica: priority,
    needsDeload: needsDeload,
    needsRecoveryFuel: recoveryStatus !== 'alta' || loadState === 'HIGH' || loadState === 'VERY_HIGH',
    needsProteinDistribution: recentPRs.length > 0 || loadState === 'HIGH' || loadState === 'VERY_HIGH',
    carbohydrateStrategy: needsDeload ? 'moderado_para_recuperacao' : recentPRs.length ? 'periodizado_em_torno_do_treino' : 'ajustado_ao_gasto_real',
    updatedAt: new Date().toISOString(),
  };
  context.readiness.reasons = buildRecoveryNotes(context);
  context.trainingNotes = context.readiness.reasons;
  return context;
}

async function safeQuery(fn, fallback) {
  try { return await fn(); } catch (_) { return fallback; }
}

async function loadTrainingRecoveryContext(adminClient, userId) {
  if (!adminClient || !userId) return null;
  var since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var since30Iso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  var responses = await Promise.all([
    safeQuery(function() { return adminClient.from('fadiga_scores').select('score, notas, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3); }, { data: [] }),
    safeQuery(function() { return adminClient.from('workout_logs').select('workout_id, exercise_id, weight_kg, reps, rpe, workouts!inner(user_id, date)').eq('workouts.user_id', userId).gte('workouts.date', since14).order('workouts.date', { ascending: false }); }, { data: [] }),
    safeQuery(function() { return adminClient.from('workouts').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(); }, { data: null }),
    safeQuery(function() { return adminClient.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', userId); }, { count: 0 }),
    safeQuery(function() { return adminClient.from('personal_records').select('exercise_id, weight_kg, reps, one_rm_kg, recorded_at, source').eq('user_id', userId).gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).order('recorded_at', { ascending: false }).limit(10); }, { data: [] }),
    safeQuery(function() { return adminClient.from('adaptation_events').select('adaptation_type, load_state, reasoning, status, created_at, metadata').eq('user_id', userId).in('status', ['pending', 'accepted']).gte('created_at', since30Iso).order('created_at', { ascending: false }).limit(5); }, { data: [] }),
    safeQuery(function() { return adminClient.from('workout_history').select('session_data, trained_at').eq('user_id', userId).order('trained_at', { ascending: false }).limit(10); }, { data: [] }),
  ]);

  var fatigueRows = Array.isArray(responses[0].data) ? responses[0].data : [];
  var logs = Array.isArray(responses[1].data) ? responses[1].data : [];
  var lastWorkoutDate = responses[2].data && responses[2].data.date ? responses[2].data.date : null;
  var totalTrainingDays = responses[3].count || 0;
  var prs = Array.isArray(responses[4].data) ? responses[4].data : [];
  var adaptations = Array.isArray(responses[5].data) ? responses[5].data : [];
  var history = Array.isArray(responses[6].data) ? responses[6].data : [];

  if (!fatigueRows.length && !logs.length && !prs.length && !adaptations.length && !history.length && !lastWorkoutDate) return null;
  return summarizeTrainingSignals({ sets: logs, prs: prs, adaptations: adaptations, history: history, fatigueRows: fatigueRows, since7: since7, lastWorkoutDate: lastWorkoutDate, totalTrainingDays: totalTrainingDays });
}

module.exports = {
  loadTrainingRecoveryContext: loadTrainingRecoveryContext,
  summarizeTrainingSignals: summarizeTrainingSignals,
};