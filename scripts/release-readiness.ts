import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type GoalName = 'hipertrofia' | 'emagrecimento' | 'recomposicao' | 'forca' | 'manutencao';

const GOALS: GoalName[] = ['hipertrofia', 'emagrecimento', 'recomposicao', 'forca', 'manutencao'];

const GOAL_KEYWORDS: Record<GoalName, string[]> = {
  hipertrofia: ['hypertrophy', 'protein'],
  emagrecimento: ['fat loss', 'protein'],
  recomposicao: ['fat loss', 'hypertrophy', 'protein'],
  forca: ['strength', 'protein', 'hypertrophy'],
  manutencao: ['maintenance', 'energy balance', 'protein'],
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function textOf(row: any): string {
  return [row?.topic]
    .concat(Array.isArray(row?.keywords) ? row.keywords : [])
    .join(' ')
    .toLowerCase();
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing');

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [exercises, articles, evidence, topics] = await Promise.all([
    db.from('exercises').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('scientific_articles').select('*', { count: 'exact', head: true }),
    db.from('scientific_evidence').select('*', { count: 'exact', head: true }),
    db.from('scientific_topics').select('id,topic,keywords,status'),
  ]);

  const topicRows = (topics.data || []).filter((row: any) => !row?.status || String(row.status).toLowerCase() === 'active');

  const coverage = [];
  for (const goal of GOALS) {
    const matchedTopics = topicRows.filter((row: any) =>
      GOAL_KEYWORDS[goal].some((keyword) => textOf(row).includes(String(keyword).toLowerCase()))
    );
    const topicIds = matchedTopics.map((row: any) => row.id);
    const evidenceRows = topicIds.length
      ? await db.from('scientific_evidence').select('article_id,topic:scientific_topics(topic)').in('topic_id', topicIds).eq('needs_review', false).limit(20)
      : { data: [], error: null };
    const count = Array.isArray(evidenceRows.data) ? evidenceRows.data.length : 0;
    coverage.push({
      goal,
      evidenceCount: count,
      ready: count >= 3,
      topics: matchedTopics.map((row: any) => row.topic),
      error: evidenceRows.error?.message || null,
    });
  }

  const readyGoals = coverage.filter((item) => item.ready).length;
  const score = Math.round(
    Math.min(
      100,
      (Number(exercises.count || 0) >= 1000 ? 30 : 0) +
      (Number(articles.count || 0) >= 20 ? 20 : 0) +
      (Number(evidence.count || 0) >= 20 ? 20 : 0) +
      (readyGoals / GOALS.length) * 30,
    ),
  );

  const verdict = score >= 90 ? 'launch_ready_high' : score >= 75 ? 'launch_ready_controlled' : 'launch_risk_high';

  console.log(JSON.stringify({
    verdict,
    score,
    catalog: {
      exercisesActive: exercises.count ?? null,
    },
    scientific: {
      articles: articles.count ?? null,
      evidence: evidence.count ?? null,
      topics: Array.isArray(topicRows) ? topicRows.length : null,
    },
    coverage,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});