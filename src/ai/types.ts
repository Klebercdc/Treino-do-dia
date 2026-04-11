import type { HealthPerformanceProfile, LabLongitudinalContext } from "../core/labs/labTypes"

export type AssistantIntent =
  | "chat"
  | "treino"
  | "dieta"
  | "suplementacao"
  | "mobilidade"
  | "ajuste"
  | "duvida"
  | "continuidade"
  | "configuracao"
  | "acao_direta"

export type AssistantAction =
  | "responder_chat"
  | "abrir_config_treino"
  | "abrir_tela_treino_com_payload"
  | "abrir_config_dieta"
  | "gerar_pdf_dieta"
  | "responder_suplementacao"
  | "responder_mobilidade"
  | "perguntar_clarificacao"
  | "nenhuma"

export type ResponseDepth = "curta" | "normal" | "detalhada"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface UserProfile {
  id?: string
  nome?: string
  objetivo?: string
  nivel?: string
  idade?: number
  sexo?: string
  pesoKg?: number
  alturaCm?: number
  restricoes?: string[]
  preferencias?: string[]
  lesoes?: string[]
  rotina?: string
  observacoes?: string
}

export interface RetrievedContextItem {
  id: string
  title?: string
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

export interface MemoryItem {
  id?: string
  userId: string
  memoryType: "perfil" | "preferencia" | "restricao" | "lesao" | "objetivo" | "rotina" | "resumo" | "feedback"
  content: string
  importance?: number
  createdAt?: string
  updatedAt?: string
}

export interface WorkoutExercise {
  nome: string
  series?: string
  repeticoes?: string
  carga?: string
  descanso?: string
  observacoes?: string
}

export interface WorkoutPayload {
  titulo?: string
  objetivo?: string
  nivel?: string
  frequencia?: string
  observacoesGerais?: string
  exercicios: WorkoutExercise[]
}

export interface DietMeal {
  refeicao: string
  horario?: string
  alimentos: string[]
  observacoes?: string
}

export interface DietPayload {
  titulo?: string
  objetivo?: string
  calorias?: string
  observacoesGerais?: string
  refeicoes: DietMeal[]
}

export interface SupplementItem {
  nome: string
  dose?: string
  horario?: string
  observacoes?: string
}

export interface SupplementPayload {
  objetivo?: string
  itens: SupplementItem[]
}

export interface MobilitySession {
  nome: string
  duracao?: string
  exercicios: string[]
  observacoes?: string
}

export interface MobilityPayload {
  objetivo?: string
  sessoes: MobilitySession[]
}

export interface AssistantStructuredResponse {
  intent: AssistantIntent
  action: AssistantAction
  depth: ResponseDepth
  shouldCreateButton: boolean
  buttonType?: "treino" | "dieta" | "suplemento" | null
  message: string
  workoutPayload?: WorkoutPayload | null
  dietPayload?: DietPayload | null
  supplementPayload?: SupplementPayload | null
  mobilityPayload?: MobilityPayload | null
}

export interface AIRequestInput {
  userId?: string
  userMessage: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
  labHealthProfile?: HealthPerformanceProfile | null
  labLongitudinalContext?: LabLongitudinalContext | null
  retrievedContext?: RetrievedContextItem[]
  memoryItems?: MemoryItem[]
  sourceOfTruthMode?: "rag_required" | "rag_preferred"
}

export interface AIModelClient {
  generate(input: {
    systemPrompt: string
    messages: ChatMessage[]
    temperature?: number
    maxTokens?: number
  }): Promise<string>
}

export interface ChunkedDocument {
  chunkIndex: number
  content: string
  metadata?: Record<string, unknown>
}
