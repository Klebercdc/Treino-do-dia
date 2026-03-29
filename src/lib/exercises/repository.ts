import type { SupabaseClient } from '@supabase/supabase-js';
import type { DetectedExerciseContext, ExerciseEntity, ExerciseMediaCacheEntity } from './types';

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export class ExerciseRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findExercise(context: DetectedExerciseContext): Promise<ExerciseEntity | null> {
    let query = this.db.from('exercises').select('*').eq('is_active', true).limit(1);

    if (context.mentionedExercise) {
      query = query.or(`slug.ilike.%${context.mentionedExercise}%,name_en.ilike.%${context.mentionedExercise}%,name_pt.ilike.%${context.mentionedExercise}%`);
    } else if (context.targetMuscle) {
      query = query.eq('target_muscle', context.targetMuscle);
    }

    if (context.equipment) query = query.eq('equipment', context.equipment);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? this.mapExercise(data) : null;
  }

  async findVariations(exercise: ExerciseEntity, limit = 4): Promise<ExerciseEntity[]> {
    const { data, error } = await this.db
      .from('exercises')
      .select('*')
      .eq('is_active', true)
      .eq('target_muscle', exercise.target_muscle)
      .neq('id', exercise.id)
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((item) => this.mapExercise(item));
  }

  async upsertExercise(input: Partial<ExerciseEntity> & { slug: string; name_en: string; name_pt: string }): Promise<ExerciseEntity> {
    const payload = {
      slug: input.slug,
      source: input.source ?? 'internal',
      source_id: input.source_id ?? null,
      name_pt: input.name_pt,
      name_en: input.name_en,
      body_part: input.body_part ?? null,
      target_muscle: input.target_muscle ?? null,
      secondary_muscles: input.secondary_muscles ?? [],
      equipment: input.equipment ?? null,
      category: input.category ?? null,
      instructions: input.instructions ?? [],
      gif_url: input.gif_url ?? null,
      image_url: input.image_url ?? null,
      search_terms: input.search_terms ?? [],
      difficulty: input.difficulty ?? null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from('exercises')
      .upsert(payload, { onConflict: 'slug' })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapExercise(data);
  }

  async getApprovedMediaCache(exerciseId: string): Promise<ExerciseMediaCacheEntity | null> {
    const { data, error } = await this.db
      .from('exercise_media_cache')
      .select('*')
      .eq('exercise_id', exerciseId)
      .eq('approved', true)
      .order('verified_score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapMedia(data) : null;
  }

  async saveMediaCache(input: Omit<ExerciseMediaCacheEntity, 'id' | 'created_at' | 'updated_at'>): Promise<ExerciseMediaCacheEntity> {
    const { data, error } = await this.db
      .from('exercise_media_cache')
      .upsert(input, { onConflict: 'provider,provider_media_id' })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapMedia(data);
  }

  async saveAlias(exerciseId: string, alias: string, language: string, aliasType: string): Promise<void> {
    const { error } = await this.db.from('exercise_aliases').upsert({
      exercise_id: exerciseId,
      alias,
      language,
      alias_type: aliasType,
    }, { onConflict: 'exercise_id,alias,language' });
    if (error) throw error;
  }

  async logSearch(entry: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.from('exercise_search_logs').insert(entry);
    if (error) throw error;
  }

  private mapExercise(raw: any): ExerciseEntity {
    return {
      id: raw.id,
      slug: raw.slug,
      source: raw.source,
      source_id: raw.source_id,
      name_pt: raw.name_pt ?? raw.name,
      name_en: raw.name_en ?? raw.name,
      body_part: raw.body_part,
      target_muscle: raw.target_muscle ?? raw.muscle_group,
      secondary_muscles: jsonArray(raw.secondary_muscles),
      equipment: raw.equipment,
      category: raw.category,
      instructions: jsonArray(raw.instructions),
      gif_url: raw.gif_url,
      image_url: raw.image_url,
      search_terms: jsonArray(raw.search_terms),
      difficulty: raw.difficulty ?? raw.level,
      is_active: raw.is_active ?? true,
      created_at: raw.created_at,
      updated_at: raw.updated_at ?? raw.created_at,
    };
  }

  private mapMedia(raw: any): ExerciseMediaCacheEntity {
    return {
      id: raw.id,
      exercise_id: raw.exercise_id,
      provider: raw.provider,
      provider_media_id: raw.provider_media_id,
      media_type: raw.media_type,
      video_url: raw.video_url,
      thumbnail_url: raw.thumbnail_url,
      width: raw.width,
      height: raw.height,
      duration: raw.duration,
      search_query: raw.search_query,
      verified_score: Number(raw.verified_score ?? 0),
      approved: Boolean(raw.approved),
      metadata: (raw.metadata ?? {}) as Record<string, unknown>,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }
}
