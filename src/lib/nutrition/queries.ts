import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AiMessage,
  BodyMetric,
  HydrationLog,
  MealPlan,
  MealPlanItem,
  NutritionGoal,
  SupplementProtocol,
  UserFoodLog,
  UserNutritionProfile,
} from '../ai/types';

export async function getProfile(db: SupabaseClient, userId: string): Promise<UserNutritionProfile | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as UserNutritionProfile | null;
}

export async function getActiveGoals(db: SupabaseClient, userId: string): Promise<NutritionGoal | null> {
  const { data, error } = await db
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as NutritionGoal | null;
}

export async function getActivePlan(db: SupabaseClient, userId: string): Promise<MealPlan | null> {
  const { data, error } = await db
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as MealPlan | null;
}

export async function getPlanItems(db: SupabaseClient, mealPlanId: string): Promise<MealPlanItem[]> {
  const { data, error } = await db.from('meal_plan_items').select('*').eq('meal_plan_id', mealPlanId).order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MealPlanItem[];
}

export async function getRecentFoodLogs(db: SupabaseClient, userId: string, limit = 20): Promise<UserFoodLog[]> {
  const { data, error } = await db.rpc('get_recent_food_logs', { p_user_id: userId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as UserFoodLog[];
}

export async function getRecentHydration(db: SupabaseClient, userId: string, limit = 20): Promise<HydrationLog[]> {
  const { data, error } = await db.rpc('get_recent_hydration_logs', { p_user_id: userId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as HydrationLog[];
}

export async function getLatestBodyMetrics(db: SupabaseClient, userId: string): Promise<BodyMetric[]> {
  const { data, error } = await db.rpc('get_latest_body_metrics', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as BodyMetric[];
}

export async function getActiveSupplements(db: SupabaseClient, userId: string): Promise<SupplementProtocol[]> {
  const { data, error } = await db
    .from('supplement_protocols')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplementProtocol[];
}

export async function getRecentConversationMessages(db: SupabaseClient, conversationId: string, limit = 12): Promise<AiMessage[]> {
  const { data, error } = await db
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as AiMessage[]).reverse();
}
