var ALLOWED_EVENT_TYPES = {
  workout_completed: true,
  workout_generated: true,
  diet_generated: true,
  diet_feedback: true,
  body_metrics: true,
  weight_update: true,
  checkin: true,
  subjective_feedback: true
};

var MAX_STRING = 500;
var MAX_PAYLOAD_BYTES = 8192;

function truncateString(value) {
  var str = String(value);
  if (str.length <= MAX_STRING) return str;
  return str.slice(0, MAX_STRING);
}

function toFiniteNumber(value, min, max) {
  var n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

function normalizePayload(eventType, payload) {
  var data = payload && typeof payload === 'object' ? payload : {};

  if (eventType === 'checkin' || eventType === 'subjective_feedback') {
    return {
      sleep_hours: toFiniteNumber(data.sleep_hours, 0, 24),
      soreness_level: toFiniteNumber(data.soreness_level, 0, 10),
      fatigue_level: toFiniteNumber(data.fatigue_level, 0, 10),
      mood: data.mood ? truncateString(data.mood) : null,
      note: data.note ? truncateString(data.note) : null
    };
  }

  if (eventType === 'weight_update' || eventType === 'body_metrics') {
    return {
      weight_kg: toFiniteNumber(data.weight_kg != null ? data.weight_kg : data.weight, 20, 350),
      body_fat_pct: toFiniteNumber(data.body_fat_pct, 2, 70),
      waist_cm: toFiniteNumber(data.waist_cm, 30, 250),
      note: data.note ? truncateString(data.note) : null
    };
  }

  if (eventType === 'diet_generated' || eventType === 'diet_feedback') {
    return {
      adherence_score: toFiniteNumber(data.adherence_score, 0, 100),
      calories_target: toFiniteNumber(data.calories_target, 600, 10000),
      protein_g: toFiniteNumber(data.protein_g, 0, 500),
      carbs_g: toFiniteNumber(data.carbs_g, 0, 1200),
      fat_g: toFiniteNumber(data.fat_g, 0, 400),
      note: data.note ? truncateString(data.note) : null
    };
  }

  if (eventType === 'workout_completed' || eventType === 'workout_generated') {
    return {
      duration_minutes: toFiniteNumber(data.duration_minutes, 5, 480),
      volume_kg: toFiniteNumber(data.volume_kg, 0, 1000000),
      avg_rpe: toFiniteNumber(data.avg_rpe, 0, 10),
      session_quality: toFiniteNumber(data.session_quality, 0, 10),
      note: data.note ? truncateString(data.note) : null
    };
  }

  return {};
}

function compactObject(input) {
  var out = {};
  Object.keys(input || {}).forEach(function(key) {
    var value = input[key];
    if (value !== null && value !== undefined && value !== '') out[key] = value;
  });
  return out;
}

function validateMemoryEventInput(input) {
  var eventType = String(input.eventType || '').trim().toLowerCase();
  if (!ALLOWED_EVENT_TYPES[eventType]) {
    return {
      ok: false,
      status: 400,
      code: 'MEMORY_EVENT_TYPE_INVALID',
      message: 'eventType inválido para memória evolutiva.'
    };
  }

  var normalizedPayload = compactObject(normalizePayload(eventType, input.payload || {}));
  if (!Object.keys(normalizedPayload).length) {
    return {
      ok: false,
      status: 400,
      code: 'MEMORY_EVENT_PAYLOAD_INVALID',
      message: 'payload não contém dados válidos para este eventType.'
    };
  }

  var byteLength = Buffer.byteLength(JSON.stringify(normalizedPayload));
  if (byteLength > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'MEMORY_PAYLOAD_TOO_LARGE',
      message: 'payload excede o limite permitido para memória evolutiva.'
    };
  }

  return {
    ok: true,
    eventType: eventType,
    payload: normalizedPayload
  };
}

module.exports = {
  ALLOWED_EVENT_TYPES: ALLOWED_EVENT_TYPES,
  validateMemoryEventInput: validateMemoryEventInput
};
