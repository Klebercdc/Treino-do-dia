export type IntentType =
  | 'diet_current'
  | 'progress'
  | 'conceptual'
  | 'supplementation'
  | 'general';

export interface UserProfile {
  id: string;
  full_name: string | null;
  objective: string | null;
  dietary_pattern: string | null;
  allergies: string[];
  intolerances: string[];
  activity_level: string | null;
}

export interface NutritionContextData {
  profile: UserProfile | null;
  goals: Record<string, unknown> | null;
  activePlan: {
    plan: Record<string, unknown> | null;
    items: Record<string, unknown>[];
  };
  recentMeals: Record<string, unknown>[];
  hydration: Record<string, unknown>[];
  bodyMetrics: Record<string, unknown>[];
  supplements: Record<string, unknown>[];
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface SemanticChunk {
  id: string;
  content: string;
  category: string | null;
  subcategory: string | null;
  tags: string[];
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface HybridContext {
  intent: IntentType;
  structured: NutritionContextData;
  semanticChunks: SemanticChunk[];
  contextSummary: string;
}
