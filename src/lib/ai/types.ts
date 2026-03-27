export type RetrievalIntent =
  | 'current_diet'
  | 'progress_analysis'
  | 'supplementation'
  | 'general_nutrition_question'
  | 'meal_adjustment'
  | 'hydration'
  | 'body_composition'
  | 'fallback';

export interface UserNutritionProfile {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  activity_level: string | null;
  objective: string | null;
  dietary_pattern: string | null;
  allergies: string[];
  intolerances: string[];
  disliked_foods: string[];
  liked_foods: string[];
  clinical_notes: string | null;
}

export interface NutritionGoal { id: string; user_id: string; active: boolean; calories_target: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; water_ml: number | null; meal_strategy: string | null; }
export interface MealPlan { id: string; user_id: string; title: string; description: string | null; status: string | null; valid_from: string | null; valid_to: string | null; active: boolean; }
export interface MealPlanItem { id: string; meal_plan_id: string; meal_name: string | null; time_hint: string | null; food_name: string | null; quantity: string | null; unit: string | null; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; notes: string | null; sort_order: number; }
export interface UserFoodLog { id: string; user_id: string; consumed_at: string; meal_type: string | null; food_name: string | null; quantity: string | null; estimated_calories: number | null; estimated_protein_g: number | null; estimated_carbs_g: number | null; estimated_fat_g: number | null; source: string | null; notes: string | null; }
export interface HydrationLog { id: string; user_id: string; consumed_at: string; water_ml: number; }
export interface BodyMetric { id: string; user_id: string; measured_at: string; weight_kg: number | null; body_fat_percent: number | null; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null; arm_cm: number | null; thigh_cm: number | null; notes: string | null; }
export interface SupplementProtocol { id: string; user_id: string; supplement_name: string; dosage: string | null; timing: string | null; purpose: string | null; notes: string | null; active: boolean; }
export interface AiConversation { id: string; user_id: string; title: string | null; }
export interface AiMessage { id: string; conversation_id: string; user_id: string; role: 'system' | 'user' | 'assistant' | 'tool'; content: string; metadata: Record<string, unknown>; created_at: string; }
export interface AiContextLog { id: string; user_id: string; conversation_id: string | null; query_text: string; intent: RetrievalIntent | null; response_text: string | null; created_at: string; }
export interface KnowledgeChunk { id: string; source_id: string; document_id: string; content: string; category: string | null; subcategory: string | null; tags: string[]; metadata: Record<string, unknown>; similarity: number; }

export interface BuiltContext {
  intent: RetrievalIntent;
  profile: UserNutritionProfile | null;
  goals: NutritionGoal | null;
  activePlan: MealPlan | null;
  planItems: MealPlanItem[];
  foodLogs: UserFoodLog[];
  hydrationLogs: HydrationLog[];
  bodyMetrics: BodyMetric[];
  supplements: SupplementProtocol[];
  recentMessages: Pick<AiMessage, 'role' | 'content' | 'created_at'>[];
  knowledgeChunks: KnowledgeChunk[];
  contextSummary: string;
}

export interface ChatRequest { conversationId?: string; userMessage: string; }
export interface ChatResponse { message: string; intent: RetrievalIntent; conversationId: string; contextSummary: string; metadata: Record<string, unknown>; }

export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';
export interface CheckResult { name: string; status: CheckStatus; summary: string; details?: Record<string, unknown>; error?: string; suggestion?: string; fix_sql?: string; }

export interface RuntimeContext {
  env: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
    aiApiKey?: string;
    aiChatModel?: string;
    aiEmbeddingModel?: string;
  };
}
