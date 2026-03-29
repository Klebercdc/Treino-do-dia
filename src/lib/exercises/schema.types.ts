export interface ExerciseRow {
  id: string;
  slug: string;
  source: string;
  source_id: string | null;
  name_pt: string;
  name_en: string;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  category: string | null;
  instructions: string[];
  gif_url: string | null;
  image_url: string | null;
  search_terms: string[];
  difficulty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExerciseAliasRow {
  id: string;
  exercise_id: string;
  alias: string;
  language: 'pt' | 'en';
  alias_type: 'name' | 'synonym' | 'typo' | 'machine';
  created_at: string;
  updated_at: string;
}

export interface ExerciseMediaCacheRow {
  id: string;
  exercise_id: string;
  provider: 'pexels' | 'internal' | 'exercisedb';
  provider_media_id: string | null;
  media_type: 'video' | 'gif' | 'image';
  video_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  search_query: string | null;
  verified_score: number;
  approved: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExerciseSearchLogRow {
  id: string;
  user_id: string | null;
  query_original: string;
  normalized_query: string | null;
  detected_intent: string | null;
  matched_exercise_id: string | null;
  media_provider: string | null;
  cache_hit: boolean;
  response_time_ms: number | null;
  success: boolean;
  details: Record<string, unknown>;
  created_at: string;
}
