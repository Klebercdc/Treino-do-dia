import type { SupabaseClient } from '@supabase/supabase-js';
import type { NutritionContextData, UserProfile } from '../ai/types';

export async function fetchNutritionContext(
  db: SupabaseClient,
  userId: string,
  conversationId?: string,
): Promise<NutritionContextData> {
  const [
    profile,
    goals,
    activePlan,
    recentMeals,
    hydration,
    bodyMetrics,
    supplements,
    conversationHistory,
  ] = await Promise.all([
    getProfile(db, userId),
    getLatestNutritionGoals(db, userId),
    getActiveMealPlanWithItems(db, userId),
    getRecentFoodLogs(db, userId, 8),
    getRecentHydration(db, userId, 8),
    getRecentBodyMetrics(db, userId, 8),
    getActiveSupplements(db, userId),
    conversationId ? getRecentConversationMessages(db, userId, conversationId, 8) : Promise.resolve([]),
  ]);

  return {
    profile,
    goals,
    activePlan,
    recentMeals,
    hydration,
    bodyMetrics,
    supplements,
    conversationHistory,
  };
}

export async function getProfile(db: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as UserProfile | null) ?? null;
}

export async function getLatestNutritionGoals(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getActiveMealPlanWithItems(db: SupabaseClient, userId: string) {
  const { data: planData, error: planError } = await db.rpc('get_active_meal_plan', { p_user_id: userId }).maybeSingle();
  if (planError) throw planError;

  const plan = (planData ?? null) as Record<string, unknown> | null;

  if (!plan) return { plan: null, items: [] };

  const { data: items, error: itemError } = await db
    .from('meal_plan_items')
    .select('*')
    .eq('meal_plan_id', String(plan.id))
    .order('sort_order', { ascending: true });

  if (itemError) throw itemError;
  return { plan, items: items ?? [] };
}

export async function getRecentFoodLogs(db: SupabaseClient, userId: string, limit = 8) {
  const { data, error } = await db
    .from('user_food_logs')
    .select('*')
    .eq('user_id', userId)
    .order('consumed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getRecentHydration(db: SupabaseClient, userId: string, limit = 8) {
  const { data, error } = await db
    .from('hydration_logs')
    .select('*')
    .eq('user_id', userId)
    .order('consumed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getRecentBodyMetrics(db: SupabaseClient, userId: string, limit = 5) {
  const { data, error } = await db.rpc('get_latest_body_metrics', { p_user_id: userId, p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

export async function getActiveSupplements(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('supplement_protocols')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentConversationMessages(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
  limit = 8,
) {
  const { data, error } = await db
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse().map((row) => ({ role: row.role, content: row.content }));
}
