export type ExerciseIntent =
  | 'exercise_search'
  | 'exercise_replace'
  | 'exercise_variations'
  | 'exercise_by_muscle'
  | 'exercise_by_equipment'
  | 'other';

export type ExerciseSource = 'internal' | 'exercisedb' | 'hybrid';

export interface AppResult<T> {
  status: 'success' | 'error';
  data: T | null;
  errors: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
  meta: Record<string, unknown>;
}

export interface DetectedExerciseContext {
  originalMessage: string;
  normalizedMessage: string;
  intent: ExerciseIntent;
  confidence: number;
  language: 'pt' | 'en';
  objective?: string;
  level?: string;
  mentionedExercise?: string;
  targetMuscle?: string;
  equipment?: string;
  homeContext: boolean;
}

export interface ExerciseEntity {
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

export interface ExerciseMediaCacheEntity {
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

export interface ExerciseResponsePayload {
  id: string;
  slug: string;
  source: ExerciseSource;
  sourceId: string | null;
  names: {
    pt: string;
    en: string;
  };
  muscles: {
    target: string | null;
    secondary: string[];
    bodyPart: string | null;
  };
  equipment: string | null;
  category: string | null;
  instructions: string[];
  media: {
    primary: string;
    fallback: string;
    provider: string;
    thumbnailUrl: string | null;
    score: number;
  };
  variations: Array<{ id: string; slug: string; name_pt: string; name_en: string; equipment: string | null }>;
  metadata: {
    intent: ExerciseIntent;
    normalizedQuery: string;
    cacheHit: boolean;
    externalFetch: boolean;
    responseTimeMs: number;
  };
}

export interface ExerciseDbItem {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  secondaryMuscles: string[];
  equipment: string;
  gifUrl?: string;
  instructions?: string[];
  [key: string]: unknown;
}

export interface PexelsVideoFile {
  id: number;
  quality: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideoItem {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  video_files: PexelsVideoFile[];
  user?: { name?: string };
}

export interface ExerciseSearchInput {
  userId: string;
  message: string;
  locale?: 'pt' | 'en';
  context?: {
    currentExerciseId?: string;
    currentExerciseName?: string;
    availableEquipment?: string[];
    goal?: string;
  };
}

export interface ExerciseDetailsInput {
  userId: string;
  exerciseId?: string;
  slug?: string;
  normalizedLookupKey?: string;
  exerciseName?: string;
  locale?: 'pt' | 'en';
  context?: {
    currentExerciseName?: string;
    goal?: string;
  };
}

export interface NormalizedExerciseDetails {
  id: string;
  slug: string;
  names: { pt: string; en: string };
  media: {
    primary: string | null;
    thumbnailUrl: string | null;
    type: 'video' | 'gif' | 'image' | 'none';
    provider: string;
  };
  instructions: string[];
  target_muscle: string | null;
  secondary_muscles: string[];
  body_part: string | null;
  equipment: string | null;
  variations: Array<{ id: string; slug: string; names: { pt: string; en: string } }>;
  source: ExerciseSource;
  common_errors?: string[];
  breathing_tip?: string | null;
  range_of_motion?: string | null;
  metadata: {
    cacheHit: boolean;
    externalFetch: boolean;
    responseTimeMs: number;
    normalizedLookupKey: string;
    completenessScore?: number;
    confidenceScore?: number;
  };
}
