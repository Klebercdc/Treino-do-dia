function normalizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/[_\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const REMOVABLE_SUFFIXES = [
  'maquina',
  'cabo',
  'smith',
  'livre',
  'aberta',
  'fechada',
  'unilateral',
  'alternada',
  'barra',
  'halteres',
  'halter',
  'graus',
  'grau',
  '30',
  '45',
  '30_graus',
  '45_graus',
];

function stripNoisySuffixes(normalized: string): string {
  const tokens = normalized.split('_').filter(Boolean);
  const preserved = new Set(['supino', 'inclinado', 'reto', 'rosca', 'martelo', 'direta', 'triceps', 'puxada', 'frontal']);
  const cleaned = tokens.filter((token) => {
    if (preserved.has(token)) return true;
    if (/^\d+$/.test(token)) return false;
    return !REMOVABLE_SUFFIXES.includes(token);
  });
  return cleaned.join('_');
}

function hasAny(tokens: string[], checks: string[]): boolean {
  return checks.some((check) => tokens.includes(check));
}

export function resolveFallbackKey(key: string): string {
  const rawNormalized = normalizeKey(key);
  const normalized = stripNoisySuffixes(rawNormalized);
  if (!normalized) return '';

  const rawTokens = rawNormalized.split('_').filter(Boolean);
  const tokens = normalized.split('_').filter(Boolean);
  const joined = `_${tokens.join('_')}_`;
  const rawJoined = `_${rawTokens.join('_')}_`;

  if (hasAny(tokens, ['supino']) && hasAny(tokens, ['inclinado'])) {
    if (hasAny(tokens, ['halteres', 'halter', 'dumbbell'])) return 'incline_dumbbell_press';
    return 'incline_bench_press';
  }

  if (hasAny(tokens, ['supino']) && hasAny(tokens, ['reto'])) return 'barbell_bench_press';

  if (hasAny(tokens, ['supino']) && hasAny(tokens, ['halteres', 'halter', 'dumbbell'])) {
    return hasAny(tokens, ['inclinado']) ? 'incline_dumbbell_press' : 'dumbbell_bench_press';
  }

  if (hasAny(tokens, ['agachamento'])) return 'squat';

  if (hasAny(tokens, ['puxada']) || joined.includes('_puxada_frontal_') || joined.includes('_puxada_frente_')) {
    return 'lat_pulldown';
  }

  if (joined.includes('_rosca_direta_')) return 'barbell_curl';
  if (joined.includes('_rosca_martelo_')) return 'hammer_curl';

  if (hasAny(tokens, ['elevacao']) && hasAny(tokens, ['lateral'])) return 'lateral_raise';
  if (hasAny(rawTokens, ['ombro']) && hasAny(rawTokens, ['cabo'])) return 'lateral_raise';

  if (joined.includes('_elevacao_pelvica_') || rawJoined.includes('_hip_thrust_') || rawJoined.includes('_ponte_de_gluteo_')) {
    return hasAny(rawTokens, ['barra', 'barbell']) ? 'barbell_hip_thrust' : 'glute_bridge';
  }

  if (hasAny(tokens, ['stiff'])) return 'romanian_deadlift';
  if (hasAny(tokens, ['terra'])) return 'deadlift';
  if (joined.includes('_remada_curvada_')) return 'bent_over_row';
  if (joined.includes('_triceps_pulley_') || joined.includes('_triceps_corda_')) return 'triceps_pushdown';

  return normalized;
}
