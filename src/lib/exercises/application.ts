import type { SupabaseClient } from '@supabase/supabase-js';
import { detectIntentFromMessage } from './intent';
import { cleanText, normalizeEquipment, normalizeExerciseName, normalizeMuscle } from './normalizer';
import { ExerciseDbClient } from './exercisedbClient';
import { ExerciseRepository } from './repository';
import { PexelsClient, scorePexelsVideo } from './pexelsClient';
import type { AppResult, DetectedExerciseContext, ExerciseDbItem, ExerciseDetailsInput, ExerciseEntity, ExerciseResponsePayload, ExerciseSearchInput, NormalizedExerciseDetails } from './types';

const PLACEHOLDER_MEDIA_URL = 'https://images.pexels.com/photos/4164761/pexels-photo-4164761.jpeg';

function ok<T>(data: T, meta: Record<string, unknown>): AppResult<T> {
  return { status: 'success', data, errors: [], meta };
}

function fail<T>(code: string, message: string, meta: Record<string, unknown>, details?: Record<string, unknown>): AppResult<T> {
  return { status: 'error', data: null, errors: [{ code, message, details }], meta };
}

export class KroniaExerciseApplication {
  private readonly repository: ExerciseRepository;
  private readonly exerciseDbClient: ExerciseDbClient | null;
  private readonly pexelsClient: PexelsClient | null;

  constructor(db: SupabaseClient) {
    this.repository = new ExerciseRepository(db);
    this.exerciseDbClient = process.env.EXERCISEDB_API_KEY ? new ExerciseDbClient(process.env.EXERCISEDB_API_KEY) : null;
    this.pexelsClient = process.env.PEXELS_API_KEY ? new PexelsClient(process.env.PEXELS_API_KEY) : null;
  }

  detectIntentFromMessage(message: string): DetectedExerciseContext {
    return detectIntentFromMessage(message);
  }

  normalizeExerciseQuery(context: DetectedExerciseContext): DetectedExerciseContext {
    return {
      ...context,
      normalizedMessage: cleanText(context.originalMessage),
      targetMuscle: normalizeMuscle(context.targetMuscle),
      equipment: normalizeEquipment(context.equipment),
      mentionedExercise: normalizeExerciseName(context.mentionedExercise),
    };
  }

  async findExerciseInDatabase(context: DetectedExerciseContext): Promise<ExerciseEntity | null> {
    return this.repository.findExercise(context);
  }

  async fetchExerciseFromExternalSource(context: DetectedExerciseContext): Promise<ExerciseEntity | null> {
    if (!this.exerciseDbClient) return null;

    const rows = await this.exerciseDbClient.search({
      name: context.mentionedExercise,
      muscle: context.targetMuscle,
      equipment: context.equipment,
    });

    if (!rows.length) return null;
    const normalized = this.mapExternalExercise(rows[0]);
    return this.saveExerciseToDatabase(normalized);
  }

  async enrichWithMedia(exercise: ExerciseEntity, context: DetectedExerciseContext): Promise<{ primary: string; fallback: string; provider: string; thumbnailUrl: string | null; score: number; cacheHit: boolean; mediaType: 'video' | 'gif' | 'image' | 'none' }> {
    const cached = await this.repository.getApprovedMediaCache(exercise.id);
    if (cached?.video_url || cached?.thumbnail_url) {
      return {
        primary: cached.video_url ?? cached.thumbnail_url ?? exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
        fallback: exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
        provider: cached.provider,
        thumbnailUrl: cached.thumbnail_url,
        score: cached.verified_score,
        cacheHit: true,
        mediaType: cached.media_type ?? 'image',
      };
    }

    const query = this.buildMediaQuery(exercise, context);

    if (this.pexelsClient) {
      const videos = await this.pexelsClient.searchVideos(query);
      const scored = videos
        .map((video) => ({ video, score: scorePexelsVideo(video, { query, muscle: exercise.target_muscle ?? undefined, equipment: exercise.equipment ?? undefined }) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (best && best.score >= 0.64) {
        const preferredFile = best.video.video_files.find((file) => file.quality === 'sd') ?? best.video.video_files[0];
        await this.saveMediaCache({
          exercise_id: exercise.id,
          provider: 'pexels',
          provider_media_id: String(best.video.id),
          media_type: 'video',
          video_url: preferredFile?.link ?? null,
          thumbnail_url: best.video.image,
          width: preferredFile?.width ?? best.video.width,
          height: preferredFile?.height ?? best.video.height,
          duration: best.video.duration,
          search_query: query,
          verified_score: best.score,
          approved: true,
          metadata: { pexelsUrl: best.video.url, selectedBy: 'kronia_exercise_media_ranker_v1' },
        });

        return {
          primary: preferredFile?.link ?? best.video.image,
          fallback: exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
          provider: 'pexels',
          thumbnailUrl: best.video.image,
          score: best.score,
          cacheHit: false,
          mediaType: 'video',
        };
      }
    }

    const baseMedia = exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL;
    return {
      primary: baseMedia,
      fallback: exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
      provider: exercise.gif_url ? 'exercisedb' : 'internal',
      thumbnailUrl: exercise.image_url,
      score: 0.4,
      cacheHit: false,
      mediaType: exercise.gif_url ? 'gif' : 'image',
    };
  }

  async saveExerciseToDatabase(exercise: Partial<ExerciseEntity> & { slug: string; name_en: string; name_pt: string }): Promise<ExerciseEntity> {
    const saved = await this.repository.upsertExercise(exercise);
    await this.repository.saveAlias(saved.id, saved.name_pt, 'pt', 'name');
    await this.repository.saveAlias(saved.id, saved.name_en, 'en', 'name');
    return saved;
  }

  async saveMediaCache(input: Parameters<ExerciseRepository['saveMediaCache']>[0]) {
    return this.repository.saveMediaCache(input);
  }

  buildExerciseResponse(params: {
    exercise: ExerciseEntity;
    media: { primary: string; fallback: string; provider: string; thumbnailUrl: string | null; score: number; cacheHit: boolean; mediaType: 'video' | 'gif' | 'image' | 'none' };
    context: DetectedExerciseContext;
    variations: ExerciseEntity[];
    responseTimeMs: number;
    externalFetch: boolean;
  }): ExerciseResponsePayload {
    const { exercise, media, context, variations, responseTimeMs, externalFetch } = params;

    return {
      id: exercise.id,
      slug: exercise.slug,
      source: externalFetch ? 'hybrid' : (exercise.source === 'exercisedb' ? 'exercisedb' : 'internal'),
      sourceId: exercise.source_id,
      names: { pt: exercise.name_pt, en: exercise.name_en },
      muscles: {
        target: exercise.target_muscle,
        secondary: exercise.secondary_muscles,
        bodyPart: exercise.body_part,
      },
      equipment: exercise.equipment,
      category: exercise.category,
      instructions: exercise.instructions,
      media: {
        primary: media.primary,
        fallback: media.fallback,
        provider: media.provider,
        thumbnailUrl: media.thumbnailUrl,
        score: media.score,
      },
      variations: variations.map((item) => ({
        id: item.id,
        slug: item.slug,
        name_pt: item.name_pt,
        name_en: item.name_en,
        equipment: item.equipment,
      })),
      metadata: {
        intent: context.intent,
        normalizedQuery: context.normalizedMessage,
        cacheHit: media.cacheHit,
        externalFetch,
        responseTimeMs,
      },
    };
  }

  async searchExercisesByContext(input: ExerciseSearchInput): Promise<AppResult<ExerciseResponsePayload>> {
    const start = Date.now();
    const context = this.normalizeExerciseQuery(this.detectIntentFromMessage(input.message));

    if (context.intent === 'other') {
      return fail('INTENT_NOT_EXERCISE', 'Mensagem não pertence ao fluxo de descoberta de exercícios.', {
        intent: context.intent,
        confidence: context.confidence,
      });
    }

    let exercise = await this.findExerciseInDatabase(context);
    let externalFetch = false;

    if (!exercise) {
      exercise = await this.fetchExerciseFromExternalSource(context);
      externalFetch = Boolean(exercise);
    }

    if (!exercise) {
      const responseTimeMs = Date.now() - start;
      await this.safeLogSearch({
        user_id: input.userId,
        query_original: input.message,
        normalized_query: context.normalizedMessage,
        detected_intent: context.intent,
        matched_exercise_id: null,
        media_provider: null,
        cache_hit: false,
        response_time_ms: responseTimeMs,
        success: false,
        details: { reason: 'exercise_not_found' },
      });

      return fail('EXERCISE_NOT_FOUND', 'Nenhum exercício encontrado para o contexto informado.', {
        responseTimeMs,
      });
    }

    const media = await this.enrichWithMedia(exercise, context);
    const variations = await this.repository.findVariations(exercise, 4);
    const responseTimeMs = Date.now() - start;
    const payload = this.buildExerciseResponse({ exercise, media, context, variations, responseTimeMs, externalFetch });

    await this.safeLogSearch({
      user_id: input.userId,
      query_original: input.message,
      normalized_query: context.normalizedMessage,
      detected_intent: context.intent,
      matched_exercise_id: exercise.id,
      media_provider: media.provider,
      cache_hit: media.cacheHit,
      response_time_ms: responseTimeMs,
      success: true,
      details: {
        externalFetch,
        confidence: context.confidence,
      },
    });

    return ok(payload, {
      intent: context.intent,
      confidence: context.confidence,
      responseTimeMs,
      externalFetch,
    });
  }

  normalizeExerciseLookupKey(name: string): string {
    return cleanText(name).replace(/\s+/g, '-').trim();
  }

  normalizeExerciseDetails(params: {
    exercise: ExerciseEntity;
    media: { primary: string; provider: string; thumbnailUrl: string | null; cacheHit: boolean; mediaType: 'video' | 'gif' | 'image' | 'none' };
    variations: ExerciseEntity[];
    responseTimeMs: number;
    externalFetch: boolean;
    lookupKey: string;
  }): NormalizedExerciseDetails {
    const { exercise, media, variations, responseTimeMs, externalFetch, lookupKey } = params;
    return {
      id: exercise.id,
      slug: exercise.slug,
      names: { pt: exercise.name_pt, en: exercise.name_en },
      media: {
        primary: media.primary ?? null,
        thumbnailUrl: media.thumbnailUrl,
        type: media.mediaType,
        provider: media.provider,
      },
      instructions: exercise.instructions,
      target_muscle: exercise.target_muscle,
      secondary_muscles: exercise.secondary_muscles,
      body_part: exercise.body_part,
      equipment: exercise.equipment,
      variations: variations.map((item) => ({
        id: item.id,
        slug: item.slug,
        names: { pt: item.name_pt, en: item.name_en },
      })),
      source: externalFetch ? 'hybrid' : (exercise.source === 'exercisedb' ? 'exercisedb' : 'internal'),
      common_errors: [],
      breathing_tip: null,
      range_of_motion: null,
      metadata: {
        cacheHit: media.cacheHit,
        externalFetch,
        responseTimeMs,
        normalizedLookupKey: lookupKey,
      },
    };
  }

  async getExerciseDetailsByName(input: ExerciseDetailsInput): Promise<AppResult<NormalizedExerciseDetails>> {
    const start = Date.now();
    const lookupName = String(input.exerciseName || '').trim();
    if (!lookupName) {
      return fail('VALIDATION_ERROR', 'exerciseName is required', {});
    }

    const lookupKey = this.normalizeExerciseLookupKey(lookupName);
    const context = this.normalizeExerciseQuery(this.detectIntentFromMessage(lookupName));
    context.mentionedExercise = normalizeExerciseName(lookupName);

    let exercise = await this.repository.findExerciseByName(lookupName);
    let externalFetch = false;

    if (!exercise) {
      exercise = await this.fetchExerciseFromExternalSource(context);
      externalFetch = Boolean(exercise);
    }

    if (!exercise) {
      return fail('EXERCISE_NOT_FOUND', 'Nenhum exercício encontrado para o nome informado.', {
        normalizedLookupKey: lookupKey,
        responseTimeMs: Date.now() - start,
      });
    }

    const media = await this.enrichWithMedia(exercise, context);
    const variations = await this.repository.findVariations(exercise, 4);
    const responseTimeMs = Date.now() - start;
    const payload = this.normalizeExerciseDetails({ exercise, media, variations, responseTimeMs, externalFetch, lookupKey });

    return ok(payload, {
      normalizedLookupKey: lookupKey,
      responseTimeMs,
      externalFetch,
    });
  }

  private async safeLogSearch(entry: Record<string, unknown>) {
    try {
      await this.repository.logSearch(entry);
    } catch (error) {
      console.error('[exercise_search_logs] failed:', error instanceof Error ? error.message : error);
    }
  }

  private mapExternalExercise(item: ExerciseDbItem): Partial<ExerciseEntity> & { slug: string; name_en: string; name_pt: string } {
    const nameEn = String(item.name ?? '').trim();
    const slug = cleanText(nameEn).replace(/\s+/g, '-');

    return {
      slug,
      source: 'exercisedb',
      source_id: item.id,
      name_en: nameEn,
      name_pt: nameEn,
      body_part: String(item.bodyPart ?? '').toLowerCase() || null,
      target_muscle: normalizeMuscle(String(item.target ?? '').toLowerCase()) ?? null,
      secondary_muscles: Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles.map((s) => cleanText(String(s))) : [],
      equipment: normalizeEquipment(String(item.equipment ?? '').toLowerCase()) ?? null,
      category: 'strength',
      instructions: Array.isArray(item.instructions) ? item.instructions.map((v) => String(v)) : [],
      gif_url: typeof item.gifUrl === 'string' ? item.gifUrl : null,
      image_url: null,
      search_terms: [nameEn, String(item.target ?? ''), String(item.equipment ?? '')]
        .map((v) => cleanText(v))
        .filter(Boolean),
      difficulty: null,
      is_active: true,
    };
  }

  private buildMediaQuery(exercise: ExerciseEntity, context: DetectedExerciseContext): string {
    const parts = [
      exercise.equipment,
      exercise.target_muscle,
      exercise.name_en,
      context.homeContext ? 'home workout' : 'gym workout',
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    return Array.from(new Set(parts)).join(' ');
  }
}
