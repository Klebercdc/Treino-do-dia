import type { SupabaseClient } from '@supabase/supabase-js';
import type { DetectedExerciseContext, ExerciseEntity, ExerciseMediaCacheEntity } from './types';
import { sanitizeMediaUrl } from './media-utils';

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

type IdentityInput = { exerciseId?: string | null; slug?: string | null; normalizedLookupKey?: string | null; exerciseName?: string | null };

export class ExerciseRepository {
  private normalizedLookupKeyAvailable: boolean | null = null;
  private columnAvailability = new Map<string, boolean>();

  constructor(private readonly db: SupabaseClient) {}

  private isMissingColumnError(error: any, column: string): boolean {
    return !!(error && typeof error.message === 'string' && error.message.includes(column) && /does not exist|schema cache|column/i.test(error.message));
  }

  private async canUseNormalizedLookupKey(): Promise<boolean> {
    if (typeof this.normalizedLookupKeyAvailable === 'boolean') return this.normalizedLookupKeyAvailable;
    const { error } = await this.db.from('exercises').select('normalized_lookup_key').limit(0);
    this.normalizedLookupKeyAvailable = !this.isMissingColumnError(error, 'normalized_lookup_key');
    return this.normalizedLookupKeyAvailable;
  }

  private async canUseColumn(column: string): Promise<boolean> {
    if (this.columnAvailability.has(column)) return Boolean(this.columnAvailability.get(column));
    const { error } = await this.db.from('exercises').select(column).limit(0);
    const available = !this.isMissingColumnError(error, column);
    this.columnAvailability.set(column, available);
    return available;
  }

  async findById(exerciseId: string): Promise<ExerciseEntity | null> {
    const id = String(exerciseId || '').trim();
    if (!id) return null;
    const { data, error } = await this.db.from('exercises').select('*').eq('id', id).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? this.mapExercise(data) : null;
  }

  async findBySlug(slug: string): Promise<ExerciseEntity | null> {
    const normalizedSlug = this.normalizeLookup(String(slug || '')).replace(/\s+/g, '-');
    if (!normalizedSlug) return null;
    const { data, error } = await this.db.from('exercises').select('*').eq('slug', normalizedSlug).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? this.mapExercise(data) : null;
  }

  async findByLookupKey(normalizedLookupKey: string): Promise<ExerciseEntity | null> {
    const key = this.normalizeLookup(String(normalizedLookupKey || ''));
    if (!key) return null;
    if (await this.canUseNormalizedLookupKey()) {
      const { data, error } = await this.db.from('exercises').select('*').eq('normalized_lookup_key', key).eq('is_active', true).maybeSingle();
      if (error && !this.isMissingColumnError(error, 'normalized_lookup_key')) throw error;
      if (data) return this.mapExercise(data);
    }

    const candidates = await this.searchCandidates(key, 8);
    const exact = candidates.find((candidate) => {
      const normalizedSlug = this.normalizeLookup(candidate.slug || '').replace(/_+/g, '_');
      const normalizedNamePt = this.normalizeLookup(candidate.name_pt || '');
      const normalizedNameEn = this.normalizeLookup(candidate.name_en || '');
      const searchTerms = (candidate.search_terms || []).map((item) => this.normalizeLookup(item || ''));
      return normalizedSlug === key || normalizedNamePt === key || normalizedNameEn === key || searchTerms.includes(key);
    });
    return exact || null;
  }

  async findExerciseByName(exerciseName: string): Promise<ExerciseEntity | null> {
    const lookup = String(exerciseName || '').trim();
    if (!lookup) return null;

    const candidates = await this.searchCandidates(lookup, 8);
    if (!candidates.length) return null;

    const ranked = candidates
      .map((candidate) => ({ candidate, score: this.computeConfidenceScore(candidate, { exerciseName: lookup }) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 0.66 ? ranked[0].candidate : null;
  }

  async findExerciseByIdentity(input: IdentityInput): Promise<{ exercise: ExerciseEntity | null; confidenceScore: number }> {
    const exerciseId = String(input.exerciseId || '').trim();
    if (exerciseId) {
      const { data, error } = await this.db.from('exercises').select('*').eq('id', exerciseId).eq('is_active', true).maybeSingle();
      if (error) throw error;
      if (data) return { exercise: this.mapExercise(data), confidenceScore: 1 };
    }

    const normalizedKey = this.normalizeLookup(String(input.normalizedLookupKey || ''));
    if (normalizedKey) {
      if (await this.canUseNormalizedLookupKey()) {
        const { data, error } = await this.db.from('exercises').select('*').eq('normalized_lookup_key', normalizedKey).eq('is_active', true).maybeSingle();
        if (error && !this.isMissingColumnError(error, 'normalized_lookup_key')) throw error;
        if (data) return { exercise: this.mapExercise(data), confidenceScore: 0.995 };
      }
    }

    const normalizedSlug = this.normalizeLookup(String(input.slug || ''));
    if (normalizedSlug) {
      const { data, error } = await this.db.from('exercises').select('*').eq('slug', normalizedSlug.replace(/\s+/g, '-')).eq('is_active', true).maybeSingle();
      if (error) throw error;
      if (data) return { exercise: this.mapExercise(data), confidenceScore: 0.97 };
    }

    const aliasCandidates = [normalizedKey, this.normalizeLookup(input.exerciseName || ''), normalizedSlug].filter(Boolean);
    const aliasMatch = await this.findByAliases(aliasCandidates, input);
    if (aliasMatch?.exercise) {
      console.info('[kronia_exercise] exercise_alias_match_used', { lookup: aliasCandidates[0], matched: aliasMatch.exercise.normalized_lookup_key || aliasMatch.exercise.slug, confidence: aliasMatch.confidenceScore });
      if (aliasMatch.confidenceScore >= 0.9) return aliasMatch;
    }

    const lookup = normalizedKey || this.normalizeLookup(String(input.exerciseName || '')) || normalizedSlug;
    if (!lookup) return { exercise: null, confidenceScore: 0 };

    const candidates = await this.searchCandidates(lookup, 12);
    if (!candidates.length) return { exercise: null, confidenceScore: 0 };

    const ranked = candidates
      .map((candidate) => ({ candidate, score: this.computeConfidenceScore(candidate, input) }))
      .sort((a, b) => b.score - a.score);

    const winner = ranked[0];
    if (!winner || winner.score < 0.66) return { exercise: null, confidenceScore: Number((winner?.score || 0).toFixed(4)) };
    return { exercise: winner.candidate, confidenceScore: Number(winner.score.toFixed(4)) };
  }

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
    const sanitizedGifUrl = sanitizeMediaUrl(input.gif_url);
    const sanitizedMediaUrl = sanitizeMediaUrl(input.media_url);
    const sanitizedImageUrl = sanitizeMediaUrl(input.image_url);
    const sanitizedThumbnailUrl = sanitizeMediaUrl(input.media_thumbnail_url) ?? sanitizedImageUrl ?? sanitizedGifUrl;
    const payload = {
      slug: input.slug,
      source: input.source ?? 'internal',
      source_id: input.source_id ?? null,
      name: input.name_en ?? input.name_pt,
      name_pt: input.name_pt,
      name_en: input.name_en,
      body_part: input.body_part ?? null,
      target_muscle: input.target_muscle ?? null,
      secondary_muscles: input.secondary_muscles ?? [],
      equipment: input.equipment ?? null,
      category: input.category ?? null,
      instructions: input.instructions ?? [],
      gif_url: sanitizedGifUrl,
      video_url: sanitizedMediaUrl,
      media_url: sanitizedMediaUrl,
      media_thumbnail_url: sanitizedThumbnailUrl,
      thumbnail_url: sanitizedThumbnailUrl,
      media_type: sanitizedMediaUrl ? (input.media_type ?? null) : (sanitizedGifUrl ? 'gif' : (sanitizedImageUrl ? 'image' : null)),
      media_provider: sanitizedMediaUrl ? (input.media_provider ?? null) : (sanitizedGifUrl ? 'ExerciseDB' : input.media_provider ?? null),
      common_errors: input.common_errors ?? [],
      breathing_tip: input.breathing_tip ?? null,
      range_of_motion: input.range_of_motion ?? null,
      completeness_score: Number(input.completeness_score ?? 0),
      media_confidence_score: Number(input.media_confidence_score ?? 0),
      content_source: input.content_source ?? null,
      last_enriched_at: input.last_enriched_at ?? null,
      quality_flags: input.quality_flags ?? [],
      image_url: sanitizedImageUrl,
      search_terms: input.search_terms ?? [],
      difficulty: input.difficulty ?? null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };
    const sanitizedPayload = await this.buildExerciseWritePayload(payload);

    const { data, error } = await this.db
      .from('exercises')
      .upsert(sanitizedPayload, { onConflict: 'slug' })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapExercise(data);
  }

  async updateExerciseEnrichmentById(id: string, patch: Partial<ExerciseEntity>): Promise<ExerciseEntity> {
    const payload = {
      name: patch.name_en ?? patch.name_pt ?? null,
      name_pt: patch.name_pt ?? null,
      name_en: patch.name_en ?? null,
      target_muscle: patch.target_muscle ?? null,
      secondary_muscles: patch.secondary_muscles ?? [],
      instructions: patch.instructions ?? [],
      common_errors: patch.common_errors ?? [],
      breathing_tip: patch.breathing_tip ?? null,
      range_of_motion: patch.range_of_motion ?? null,
      gif_url: sanitizeMediaUrl(patch.gif_url),
      video_url: sanitizeMediaUrl(patch.media_url),
      media_url: sanitizeMediaUrl(patch.media_url),
      media_thumbnail_url: sanitizeMediaUrl(patch.media_thumbnail_url),
      thumbnail_url: sanitizeMediaUrl(patch.media_thumbnail_url),
      media_type: patch.media_type ?? null,
      media_provider: patch.media_provider ?? null,
      completeness_score: Number(patch.completeness_score ?? 0),
      media_confidence_score: Number(patch.media_confidence_score ?? 0),
      quality_flags: patch.quality_flags ?? [],
      content_source: patch.content_source ?? null,
      last_enriched_at: patch.last_enriched_at ?? null,
      updated_at: new Date().toISOString(),
    };
    const sanitizedPayload = await this.buildExerciseWritePayload(payload);

    const { data, error } = await this.db.from('exercises').update(sanitizedPayload).eq('id', id).select('*').single();
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
    const aliasKey = this.normalizeLookup(alias).replace(/\s+/g, '_');
    let canonicalLookupKey: string | null = null;
    if (await this.canUseNormalizedLookupKey()) {
      const { data: exercise, error } = await this.db.from('exercises').select('normalized_lookup_key').eq('id', exerciseId).maybeSingle();
      if (error && !this.isMissingColumnError(error, 'normalized_lookup_key')) throw error;
      canonicalLookupKey = exercise?.normalized_lookup_key ?? null;
    }

    if (!canonicalLookupKey) {
      const { data: fallbackExercise, error: fallbackError } = await this.db.from('exercises').select('slug,name_en,name_pt').eq('id', exerciseId).maybeSingle();
      if (fallbackError) throw fallbackError;
      canonicalLookupKey = this.normalizeLookup(fallbackExercise?.slug || fallbackExercise?.name_en || fallbackExercise?.name_pt || alias);
    }

    const { error } = await this.db.from('exercise_aliases').upsert({
      exercise_id: exerciseId,
      alias,
      alias_key: aliasKey,
      canonical_lookup_key: canonicalLookupKey,
      locale: language === 'pt' ? 'pt_BR' : 'en_US',
      language,
      alias_type: aliasType,
    }, { onConflict: 'alias_key' });
    if (error) throw error;
  }

  async logSearch(entry: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.from('exercise_search_logs').insert(entry);
    if (error) throw error;
  }

  async getCatalogAdminSummary() {
    const selectFields = await this.canUseNormalizedLookupKey()
      ? 'id,media_type,media_url,gif_url,instructions,common_errors,breathing_tip,range_of_motion,target_muscle,normalized_lookup_key,completeness_score,media_confidence_score,quality_flags'
      : 'id,media_type,media_url,gif_url,instructions,common_errors,breathing_tip,range_of_motion,target_muscle,slug,name_en,name_pt,completeness_score,media_confidence_score,quality_flags';
    const query = this.db
      .from('exercises')
      .select(selectFields as any)
      .eq('is_active', true);
    const { data, error } = await (query as any);
    if (error) throw error;
    const rows = Array.isArray(data) ? data as any[] : [];
    const summary = {
      total: rows.length,
      withVideo: 0,
      withGif: 0,
      textOnly: 0,
      withInstructions: 0,
      withCommonErrors: 0,
      withBreathingTip: 0,
      lowCompleteness: 0,
      lowMediaConfidence: 0,
      lowContentValue: 0,
      low_content_value_count: 0,
      low_completeness_count: 0,
      low_media_confidence_count: 0,
      known_exercises_without_instructions: 0,
      known_exercises_without_common_errors: 0,
      with_instructions_count: 0,
      with_common_errors_count: 0,
      with_breathing_tip_count: 0,
    };

    for (const row of rows) {
      const mediaType = String(row.media_type || '').toLowerCase();
      const hasGif = mediaType === 'gif' || (!!row.gif_url && mediaType !== 'video');
      const hasVideo = mediaType === 'video' && !!row.media_url;
      summary.withVideo += hasVideo ? 1 : 0;
      summary.withGif += hasGif ? 1 : 0;
      summary.textOnly += !hasVideo && !hasGif ? 1 : 0;
      summary.withInstructions += jsonArray(row.instructions).length ? 1 : 0;
      summary.withCommonErrors += jsonArray(row.common_errors).length ? 1 : 0;
      summary.withBreathingTip += row.breathing_tip ? 1 : 0;
      const isKnown = Boolean(row.normalized_lookup_key || row.target_muscle);
      if (isKnown && !jsonArray(row.instructions).length) summary.known_exercises_without_instructions += 1;
      if (isKnown && !jsonArray(row.common_errors).length) summary.known_exercises_without_common_errors += 1;
      summary.lowCompleteness += Number(row.completeness_score ?? 0) < 55 ? 1 : 0;
      summary.lowMediaConfidence += Number(row.media_confidence_score ?? 0) < 0.5 ? 1 : 0;
      const flags = jsonArray(row.quality_flags);
      if (flags.includes('low_content_value') || Number(row.completeness_score ?? 0) < 55) summary.lowContentValue += 1;
    }

    summary.low_content_value_count = summary.lowContentValue;
    summary.low_completeness_count = summary.lowCompleteness;
    summary.low_media_confidence_count = summary.lowMediaConfidence;
    summary.with_instructions_count = summary.withInstructions;
    summary.with_common_errors_count = summary.withCommonErrors;
    summary.with_breathing_tip_count = summary.withBreathingTip;
    return summary;
  }

  private async findByAliases(aliasCandidates: string[], input: IdentityInput): Promise<{ exercise: ExerciseEntity | null; confidenceScore: number } | null> {
    if (!aliasCandidates.length) return null;
    try {
      const { data: aliasRowsByKey, error: keyError } = await this.db
        .from('exercise_aliases')
        .select('exercise_id,alias,alias_key,canonical_lookup_key')
        .in('alias_key', aliasCandidates)
        .limit(30);
      const { data: aliasRowsByAlias, error: aliasError } = await this.db
        .from('exercise_aliases')
        .select('exercise_id,alias,alias_key,canonical_lookup_key')
        .in('alias', aliasCandidates)
        .limit(30);
      const aliasRows = [...(aliasRowsByKey ?? []), ...(aliasRowsByAlias ?? [])];
      if (keyError || aliasError || !aliasRows.length) return null;
      const exerciseIds = Array.from(new Set(aliasRows.map((row: any) => row.exercise_id).filter(Boolean)));
      if (!exerciseIds.length) return null;

      const { data: exercises, error: exercisesError } = await this.db.from('exercises').select('*').in('id', exerciseIds).eq('is_active', true).limit(12);
      if (exercisesError || !exercises?.length) return null;

      const ranked = exercises
        .map((row: any) => this.mapExercise(row))
        .map((candidate) => ({ candidate, score: this.computeConfidenceScore(candidate, input, aliasCandidates) }))
        .sort((a, b) => b.score - a.score);

      return { exercise: ranked[0]?.candidate ?? null, confidenceScore: Number(Math.min(1, ranked[0]?.score ?? 0).toFixed(4)) };
    } catch {
      return null;
    }
  }

  private async searchCandidates(lookup: string, limit: number): Promise<ExerciseEntity[]> {
    const safeLike = lookup.replace(/[%_]/g, ' ').trim();
    const useNormalizedLookupKey = await this.canUseNormalizedLookupKey();
    const orFilter = useNormalizedLookupKey
      ? `normalized_lookup_key.ilike.%${safeLike}%,slug.ilike.%${safeLike}%,name_en.ilike.%${safeLike}%,name_pt.ilike.%${safeLike}%`
      : `slug.ilike.%${safeLike}%,name_en.ilike.%${safeLike}%,name_pt.ilike.%${safeLike}%`;

    const { data, error } = await this.db
      .from('exercises')
      .select('*')
      .eq('is_active', true)
      .or(orFilter)
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((item) => this.mapExercise(item));
  }

  private mapExercise(raw: any): ExerciseEntity {
    const gifUrl = sanitizeMediaUrl(raw.gif_url);
    const imageUrl = sanitizeMediaUrl(raw.image_url);
    const mediaUrl = sanitizeMediaUrl(raw.media_url) ?? (String(raw.media_type || '').toLowerCase() === 'gif' ? gifUrl : null);
    const mediaThumbnailUrl = sanitizeMediaUrl(raw.media_thumbnail_url ?? raw.thumbnail_url) ?? imageUrl ?? gifUrl;
    const mediaType = mediaUrl
      ? (String(raw.media_type || '').toLowerCase() === 'gif' ? 'gif' : (String(raw.media_type || '').toLowerCase() === 'image' ? 'image' : 'video'))
      : (gifUrl ? 'gif' : (imageUrl ? 'image' : null));
    return {
      id: raw.id,
      slug: raw.slug,
      normalized_lookup_key: raw.normalized_lookup_key ?? null,
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
      gif_url: gifUrl,
      media_url: mediaUrl,
      media_thumbnail_url: mediaThumbnailUrl,
      media_type: mediaType,
      media_provider: raw.media_provider ?? (gifUrl ? 'ExerciseDB' : null),
      completeness_score: Number(raw.completeness_score ?? 0),
      media_confidence_score: Number(raw.media_confidence_score ?? 0),
      content_source: raw.content_source ?? null,
      last_enriched_at: raw.last_enriched_at ?? null,
      quality_flags: jsonArray(raw.quality_flags),
      youtube_fallback_url: raw.youtube_fallback_url ?? null,
      common_errors: jsonArray(raw.common_errors),
      breathing_tip: raw.breathing_tip ?? null,
      range_of_motion: raw.range_of_motion ?? null,
      image_url: imageUrl,
      search_terms: jsonArray(raw.search_terms),
      difficulty: raw.difficulty ?? raw.level,
      is_active: raw.is_active ?? true,
      created_at: raw.created_at,
      updated_at: raw.updated_at ?? raw.created_at,
    };
  }

  private async buildExerciseWritePayload(payload: Record<string, unknown>) {
    const entries = await Promise.all(Object.entries(payload).map(async ([key, value]) => {
      if (key === 'slug' || key === 'source' || key === 'source_id' || key === 'name' || key === 'name_pt' || key === 'name_en' || key === 'body_part' || key === 'target_muscle' || key === 'secondary_muscles' || key === 'equipment' || key === 'category' || key === 'instructions' || key === 'gif_url' || key === 'video_url' || key === 'media_url' || key === 'thumbnail_url' || key === 'media_type' || key === 'media_provider' || key === 'image_url' || key === 'search_terms' || key === 'difficulty' || key === 'is_active' || key === 'updated_at') {
        return [key, value];
      }
      const allowed = await this.canUseColumn(key);
      return allowed ? [key, value] : null;
    }));
    return Object.fromEntries(entries.filter(Boolean) as Array<[string, unknown]>);
  }

  private mapMedia(raw: any): ExerciseMediaCacheEntity {
    return {
      id: raw.id,
      exercise_id: raw.exercise_id,
      provider: raw.provider,
      provider_media_id: raw.provider_media_id,
      media_type: raw.media_type,
      video_url: sanitizeMediaUrl(raw.video_url),
      thumbnail_url: sanitizeMediaUrl(raw.thumbnail_url),
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

  private normalizeLookup(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/[-\s]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private tokenize(value: string): string[] {
    return this.normalizeLookup(value).split('_').filter(Boolean);
  }

  private computeConfidenceScore(item: ExerciseEntity, input: IdentityInput, aliasCandidates: string[] = []): number {
    if (input.exerciseId && item.id === input.exerciseId) return 1;

    const lookupRaw = this.normalizeLookup(String(input.normalizedLookupKey || input.exerciseName || input.slug || ''));
    if (!lookupRaw) return 0;

    const normalizedLookupKey = this.normalizeLookup(item.normalized_lookup_key || '');
    const slug = this.normalizeLookup(item.slug || '');
    const namePt = this.normalizeLookup(item.name_pt || '');
    const nameEn = this.normalizeLookup(item.name_en || '');
    const searchTerms = (item.search_terms || []).map((term) => this.normalizeLookup(term || ''));
    const aliasExact = aliasCandidates.includes(lookupRaw) && aliasCandidates.some((a) => a && [normalizedLookupKey, slug, namePt, nameEn].concat(searchTerms).includes(a));

    if (normalizedLookupKey && normalizedLookupKey === lookupRaw) return 0.995;
    if (aliasExact) return 0.985;
    if (slug && slug === lookupRaw) return 0.97;
    if (namePt && namePt === lookupRaw) return 0.955;
    if (nameEn && nameEn === lookupRaw) return 0.945;
    if (searchTerms.includes(lookupRaw)) return 0.94;

    const queryTokens = new Set(this.tokenize(lookupRaw));
    const ptTokens = new Set(this.tokenize(`${namePt}_${normalizedLookupKey}_${searchTerms.join('_')}`));
    const enTokens = new Set(this.tokenize(`${nameEn}_${slug}_${searchTerms.join('_')}`));
    const ptOverlap = queryTokens.size ? Array.from(queryTokens).filter((token) => ptTokens.has(token)).length / queryTokens.size : 0;
    const enOverlap = queryTokens.size ? Array.from(queryTokens).filter((token) => enTokens.has(token)).length / queryTokens.size : 0;

    const weighted = (ptOverlap * 0.7) + (enOverlap * 0.45);
    const rawScore = 0.22 + weighted;
    const capped = Math.min(0.9, rawScore);
    return Number(Math.max(0, capped).toFixed(4));
  }
}
