import type { SupabaseClient } from '@supabase/supabase-js';
import { detectIntentFromMessage } from './intent';
import { cleanText, normalizeEquipment, normalizeExerciseName, normalizeMuscle } from './normalizer';
import { ExerciseDbClient } from './exercisedbClient';
import { ExerciseRepository } from './repository';
import { PexelsClient } from './pexelsClient';
import { applyCuratedExerciseContent, computeExerciseCompletenessScore, computeQualityFlags, getCuratedExerciseContent, mergeCuratedExerciseContent } from './catalog-curation';
import { resolveFallbackKey } from './fallback-map';
import { pickBestExerciseMedia } from './media-ranking';
import type { AppResult, DetectedExerciseContext, ExerciseDbItem, ExerciseDetailsInput, ExerciseEntity, ExerciseResponsePayload, ExerciseSearchInput, NormalizedExerciseDetails } from './types';

const PLACEHOLDER_MEDIA_URL = 'https://images.pexels.com/photos/4164761/pexels-photo-4164761.jpeg';


const MIN_KNOWN_INSTRUCTIONS = [
  'Execute o movimento com controle total',
  'Mantenha estabilidade corporal durante toda a execução',
  'Contraia o músculo alvo no ponto mais forte do movimento',
  'Retorne lentamente à posição inicial',
];

const MIN_KNOWN_COMMON_ERRORS = [
  'Usar impulso em vez de controle',
  'Reduzir demais a amplitude do movimento',
];

function resolveCuratedKeyCandidates(exercise: ExerciseEntity): string[] {
  const rawCandidates = [
    exercise.normalized_lookup_key,
    exercise.slug,
    exercise.name_pt,
    exercise.name_en,
    resolveFallbackKey(exercise.normalized_lookup_key || exercise.slug || exercise.name_pt || exercise.name_en || ''),
  ].filter(Boolean) as string[];

  return Array.from(new Set(rawCandidates.map((key) => String(key || '').trim()).filter(Boolean)));
}

function hasKnownResolution(exercise: ExerciseEntity, lookupResult: { confidenceScore: number }, lookupKey: string): boolean {
  if (lookupResult.confidenceScore >= 0.9) return true;
  const key = String(lookupKey || '').trim();
  if (!key) return false;
  const normalizedPool = [exercise.id, exercise.slug, exercise.normalized_lookup_key, exercise.name_pt, exercise.name_en]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);
  return normalizedPool.some((value) => value.includes(key.toLowerCase()) || key.toLowerCase().includes(value));
}

async function applyCuratedContentIfNeeded(exercise: ExerciseEntity, repository: ExerciseRepository, logger: Console, lookupResult: { confidenceScore: number }, lookupKey: string) {
  const beforeScore = Number(exercise.completeness_score || 0);

  let curated = null as ReturnType<typeof getCuratedExerciseContent>;
  for (const candidate of resolveCuratedKeyCandidates(exercise)) {
    curated = getCuratedExerciseContent(candidate);
    if (curated) break;
  }

  const merged = mergeCuratedExerciseContent(exercise, curated);
  const knownExercise = hasKnownResolution(exercise, lookupResult, lookupKey) || Boolean(curated);

  if (knownExercise && (!Array.isArray(merged.instructions) || !merged.instructions.length)) {
    merged.instructions = [...MIN_KNOWN_INSTRUCTIONS];
  }
  if (knownExercise && (!Array.isArray(merged.common_errors) || !merged.common_errors.length)) {
    merged.common_errors = [...MIN_KNOWN_COMMON_ERRORS];
  }

  const afterScore = computeExerciseCompletenessScore(merged);
  const flags = computeQualityFlags({ ...merged, completeness_score: afterScore });

  const changed =
    JSON.stringify(merged.instructions || []) !== JSON.stringify(exercise.instructions || []) ||
    JSON.stringify(merged.common_errors || []) !== JSON.stringify(exercise.common_errors || []) ||
    String(merged.breathing_tip || '') !== String(exercise.breathing_tip || '') ||
    String(merged.range_of_motion || '') !== String(exercise.range_of_motion || '') ||
    String(merged.target_muscle || '') !== String(exercise.target_muscle || '') ||
    JSON.stringify(merged.secondary_muscles || []) !== JSON.stringify(exercise.secondary_muscles || []) ||
    String(merged.name_pt || '') !== String(exercise.name_pt || '') ||
    afterScore > beforeScore;

  if (changed) {
    logger?.info?.('[kronia_exercise] exercise_curated_content_applied', {
      key: merged.normalized_lookup_key || merged.slug,
      beforeScore,
      afterScore,
      knownExercise,
    });

    await repository.updateExerciseEnrichmentById(merged.id, {
      name_pt: merged.name_pt || null,
      target_muscle: merged.target_muscle || null,
      secondary_muscles: merged.secondary_muscles || [],
      instructions: merged.instructions || [],
      common_errors: merged.common_errors || [],
      breathing_tip: merged.breathing_tip || null,
      range_of_motion: merged.range_of_motion || null,
      completeness_score: afterScore,
      quality_flags: flags,
      content_source: 'curated_layer',
      last_enriched_at: new Date().toISOString(),
    });

    logger?.info?.('[kronia_exercise] exercise_curated_content_persisted', {
      key: merged.normalized_lookup_key || merged.slug,
      afterScore,
      knownExercise,
    });
  }

  if (knownExercise && afterScore < 50) {
    logger?.info?.('[kronia_exercise] exercise_detail_low_value_detected', {
      lookupKey: merged.normalized_lookup_key || merged.slug,
      completeness: afterScore,
      flags,
    });
  }

  return {
    ...merged,
    completeness_score: afterScore,
    quality_flags: flags,
    content_source: changed ? 'curated_layer' : merged.content_source,
    last_enriched_at: changed ? new Date().toISOString() : merged.last_enriched_at,
  };
}


function ok<T>(data: T, meta: Record<string, unknown>): AppResult<T> {
  return { status: 'success', data, errors: [], meta };
}

function fail<T>(code: string, message: string, meta: Record<string, unknown>, details?: Record<string, unknown>): AppResult<T> {
  return { status: 'error', data: null, errors: [{ code, message, details }], meta };
}

export async function buildExerciseDetails(exercise: ExerciseEntity): Promise<NormalizedExerciseDetails> {
  return {
    id: exercise.id,
    slug: exercise.slug,
    names: {
      pt: exercise.name_pt,
      en: exercise.name_en,
    },
    media: {
      primary: exercise.media_url ?? exercise.gif_url ?? exercise.image_url ?? null,
      thumbnailUrl: exercise.media_thumbnail_url ?? exercise.image_url ?? null,
      type: exercise.media_type ?? (exercise.media_url ? 'video' : exercise.gif_url ? 'gif' : exercise.image_url ? 'image' : 'none'),
      provider: exercise.media_provider ?? (exercise.media_url ? 'catalog' : exercise.gif_url ? 'exercisedb' : 'internal'),
      confidenceScore: Number(exercise.media_confidence_score ?? 0),
    },
    instructions: Array.isArray(exercise.instructions) ? exercise.instructions : [],
    target_muscle: exercise.target_muscle ?? null,
    secondary_muscles: Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [],
    body_part: exercise.body_part ?? null,
    equipment: exercise.equipment ?? null,
    variations: [],
    source: exercise.source ?? 'internal',
    common_errors: Array.isArray(exercise.common_errors) ? exercise.common_errors : [],
    breathing_tip: exercise.breathing_tip ?? null,
    range_of_motion: exercise.range_of_motion ?? null,
    completeness_score: exercise.completeness_score ?? computeExerciseCompletenessScore(exercise),
    media_confidence_score: exercise.media_confidence_score ?? 0,
    content_source: exercise.content_source ?? null,
    last_enriched_at: exercise.last_enriched_at ?? null,
    quality_flags: exercise.quality_flags ?? computeQualityFlags(exercise),
    metadata: {
      cacheHit: true,
      externalFetch: false,
      responseTimeMs: 0,
      normalizedLookupKey: exercise.normalized_lookup_key ?? exercise.slug,
      completenessScore: exercise.completeness_score ?? computeExerciseCompletenessScore(exercise),
      confidenceScore: 1,
      knownResolution: true,
    },
  };
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
    if (exercise.media_url) {
      return {
        primary: exercise.media_url,
        fallback: exercise.media_thumbnail_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
        provider: exercise.media_provider ?? 'catalog',
        thumbnailUrl: exercise.media_thumbnail_url ?? null,
        score: Number(exercise.media_confidence_score ?? 0.9),
        cacheHit: true,
        mediaType: exercise.media_type ?? (exercise.media_url.includes('.gif') ? 'gif' : 'image'),
      };
    }

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
      const picked = pickBestExerciseMedia(exercise, videos, {
        media_url: exercise.media_url,
        media_type: exercise.media_type,
        media_confidence_score: exercise.media_confidence_score,
        gif_url: exercise.gif_url,
      });

      if (picked.media_type === 'video' && picked.media_url) {
        await this.saveExerciseToDatabase({
          ...exercise,
          slug: exercise.slug,
          name_en: exercise.name_en,
          name_pt: exercise.name_pt,
          media_url: picked.media_url,
          media_thumbnail_url: picked.media_thumbnail_url,
          media_type: 'video',
          media_provider: 'Pexels',
          media_confidence_score: picked.media_confidence_score,
        });

        return {
          primary: picked.media_url,
          fallback: exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
          provider: 'pexels',
          thumbnailUrl: picked.media_thumbnail_url,
          score: picked.media_confidence_score,
          cacheHit: false,
          mediaType: 'video',
        };
      }

      console.info('[kronia_exercise] exercise_media_confidence_low', {
        exercise: exercise.normalized_lookup_key,
        score: picked.media_confidence_score,
        reason: picked.reason,
      });
    }

    const baseMedia = exercise.gif_url ?? exercise.image_url ?? PLACEHOLDER_MEDIA_URL;
    return {
      primary: baseMedia,
      fallback: exercise.image_url ?? PLACEHOLDER_MEDIA_URL,
      provider: exercise.gif_url ? 'exercisedb' : 'internal',
      thumbnailUrl: exercise.image_url,
      score: Number(exercise.gif_url ? 0.42 : 0.2),
      cacheHit: false,
      mediaType: exercise.gif_url ? 'gif' : 'image',
    };
  }

  async saveExerciseToDatabase(exercise: Partial<ExerciseEntity> & { slug: string; name_en: string; name_pt: string }): Promise<ExerciseEntity> {
    const merged = applyCuratedExerciseContent(exercise);
    const completeScore = computeExerciseCompletenessScore(merged);
    const mediaScore = Number(merged.media_confidence_score ?? (merged.media_type === 'video' ? 0.78 : merged.gif_url ? 0.42 : 0.2));
    const qualityFlags = computeQualityFlags({ ...merged, media_confidence_score: mediaScore, completeness_score: completeScore });

    const saved = await this.repository.upsertExercise({
      ...merged,
      slug: String(exercise.slug || merged.slug || cleanText(exercise.name_en || exercise.name_pt || 'exercise')).replace(/\s+/g, '-'),
      name_en: String(exercise.name_en || merged.name_en || exercise.name_pt || 'Exercise'),
      name_pt: String(exercise.name_pt || merged.name_pt || exercise.name_en || 'Exercício'),
      completeness_score: completeScore,
      media_confidence_score: mediaScore,
      quality_flags: qualityFlags,
    });

    await this.repository.saveAlias(saved.id, saved.name_pt, 'pt', 'name');
    await this.repository.saveAlias(saved.id, saved.name_en, 'en', 'name');
    return saved;
  }

  async saveMediaCache(input: Parameters<ExerciseRepository['saveMediaCache']>[0]) {
    return this.repository.saveMediaCache(input);
  }

  async getCatalogAdminSummary() {
    const summary = await this.repository.getCatalogAdminSummary();
    console.info('[kronia_exercise] exercise_catalog_admin_summary_loaded', summary);
    return summary;
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
        confidenceScore: exercise.media_confidence_score,
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
    return cleanText(name).replace(/\s+/g, '_').trim();
  }

  normalizeExerciseDetails(params: {
    exercise: ExerciseEntity;
    media: { primary: string; provider: string; thumbnailUrl: string | null; cacheHit: boolean; mediaType: 'video' | 'gif' | 'image' | 'none' };
    variations: ExerciseEntity[];
    responseTimeMs: number;
    externalFetch: boolean;
    lookupKey: string;
    confidenceScore?: number;
  }): NormalizedExerciseDetails {
    const { exercise, media, variations, responseTimeMs, externalFetch, lookupKey, confidenceScore } = params;
    const safeInstructions = exercise.instructions?.length
      ? exercise.instructions
      : ['Mantenha execução controlada, postura neutra e ajuste a carga para técnica consistente.'];
    return {
      id: exercise.id,
      slug: exercise.slug,
      names: { pt: exercise.name_pt, en: exercise.name_en },
      media: {
        primary: media.primary ?? null,
        thumbnailUrl: media.thumbnailUrl,
        type: media.mediaType,
        provider: media.provider,
        confidenceScore: exercise.media_confidence_score,
      },
      instructions: safeInstructions,
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
      common_errors: exercise.common_errors ?? [],
      breathing_tip: exercise.breathing_tip ?? null,
      range_of_motion: exercise.range_of_motion ?? null,
      completeness_score: exercise.completeness_score ?? computeExerciseCompletenessScore(exercise),
      media_confidence_score: exercise.media_confidence_score ?? (media.mediaType === 'video' ? 0.8 : 0.4),
      content_source: exercise.content_source ?? null,
      last_enriched_at: exercise.last_enriched_at ?? null,
      quality_flags: exercise.quality_flags ?? computeQualityFlags(exercise),
      metadata: {
        cacheHit: media.cacheHit,
        externalFetch,
        responseTimeMs,
        normalizedLookupKey: lookupKey,
        completenessScore: exercise.completeness_score ?? computeExerciseCompletenessScore(exercise),
        confidenceScore: Number((confidenceScore ?? 0.85).toFixed(4)),
        knownResolution: Number((confidenceScore ?? 0)) >= 0.9,
      },
    };
  }

  async getExerciseDetailsByName(input: ExerciseDetailsInput): Promise<AppResult<NormalizedExerciseDetails>> {
    const start = Date.now();
    const lookupName = String(input.exerciseName || '').trim();
    const lookupSlug = String(input.slug || '').trim();
    const lookupId = String(input.exerciseId || '').trim();
    const lookupNormalizedKey = String(input.normalizedLookupKey || '').trim();
    if (!lookupName && !lookupSlug && !lookupId && !lookupNormalizedKey) {
      return fail('VALIDATION_ERROR', 'At least one identifier is required.', {});
    }

    const preferredName = lookupName || lookupSlug || lookupNormalizedKey || 'Exercício';
    const lookupKey = lookupNormalizedKey || this.normalizeExerciseLookupKey(preferredName);
    const context = this.normalizeExerciseQuery(this.detectIntentFromMessage(preferredName));
    context.mentionedExercise = normalizeExerciseName(preferredName);

    const lookupResult = await this.repository.findExerciseByIdentity({
      exerciseId: lookupId || null,
      slug: lookupSlug || null,
      normalizedLookupKey: lookupKey || null,
      exerciseName: lookupName || null,
    });
    let exercise = lookupResult.exercise;
    const externalFetch = false;

    if (!exercise) {
      return fail('EXERCISE_NOT_FOUND', 'Nenhum exercício encontrado para os identificadores informados.', {
        normalizedLookupKey: lookupKey,
        responseTimeMs: Date.now() - start,
      });
    }

    exercise = await applyCuratedContentIfNeeded(exercise, this.repository, console, lookupResult, lookupKey);

    const media = await this.enrichWithMedia(exercise, context);
    const variations = await this.repository.findVariations(exercise, 4);
    const responseTimeMs = Date.now() - start;
    const payload = this.normalizeExerciseDetails({
      exercise,
      media,
      variations,
      responseTimeMs,
      externalFetch,
      lookupKey,
      confidenceScore: lookupResult.confidenceScore,
    });

    return ok(payload, {
      normalizedLookupKey: lookupKey,
      responseTimeMs,
      externalFetch,
      confidenceScore: lookupResult.confidenceScore,
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
      normalized_lookup_key: cleanText(nameEn).replace(/\s+/g, '_'),
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
