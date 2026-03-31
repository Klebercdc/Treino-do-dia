export type AliasSeed = { alias_key: string; canonical_lookup_key: string; alias: string; locale?: string; language?: string; alias_type?: string };

function normalizeAliasKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const BASE_ALIASES: Array<[string, string]> = [
  ['supino_reto', 'barbell_bench_press'],
  ['supino_reto_barra', 'barbell_bench_press'],
  ['supino_com_barra', 'barbell_bench_press'],
  ['supino_reto_com_barra', 'barbell_bench_press'],
  ['supino_com_halteres', 'dumbbell_bench_press'],
  ['supino_inclinado', 'incline_dumbbell_press'],
  ['supino_inclinado_halteres', 'incline_dumbbell_press'],
  ['supino_inclinado_com_halteres', 'incline_dumbbell_press'],
  ['agachamento', 'squat'],
  ['agachamento_livre', 'squat'],
  ['leg_press', 'leg_press'],
  ['leg_press_45', 'leg_press'],
  ['levantamento_terra', 'deadlift'],
  ['stiff', 'romanian_deadlift'],
  ['desenvolvimento', 'shoulder_press'],
  ['desenvolvimento_militar', 'military_press'],
  ['puxada_frontal', 'lat_pulldown'],
  ['puxada_frente', 'lat_pulldown'],
  ['barra_fixa', 'pull_up'],
  ['barra_fixa_pronada', 'pull_up'],
  ['barra_fixa_supinada', 'pull_up'],
  ['rosca_direta', 'barbell_curl'],
  ['rosca_direta_barra', 'barbell_curl'],
  ['rosca_martelo', 'hammer_curl'],
  ['triceps_pulley', 'triceps_pushdown'],
  ['triceps_corda', 'triceps_pushdown'],
  ['elevacao_lateral', 'lateral_raise'],
  ['elevacao_pelvica', 'hip_thrust'],
  ['elevacao_pelvica_com_barra', 'barbell_hip_thrust'],
  ['ponte_de_gluteo', 'glute_bridge'],
  ['remada_curvada', 'bent_over_row'],
  ['remada_curvada_com_barra', 'bent_over_row'],
  ['remada_baixa', 'seated_row'],
  ['crucifixo', 'dumbbell_fly'],
  ['passada', 'lunge'],
  ['avanco', 'lunge'],
  ['panturrilha_em_pe', 'calf_raise'],
  ['abdominal_crunch', 'crunch'],
];

export const CURATED_PT_ALIASES: AliasSeed[] = BASE_ALIASES.map(([alias_key, canonical_lookup_key]) => {
  const normalized = normalizeAliasKey(alias_key);
  return {
    alias_key: normalized,
    canonical_lookup_key,
    alias: normalized.replace(/_/g, ' '),
    locale: 'pt_BR',
    language: 'pt',
    alias_type: 'synonym',
  };
});
