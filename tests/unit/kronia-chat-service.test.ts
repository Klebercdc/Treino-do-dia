import test from "node:test"
import assert from "node:assert/strict"

import type { ChatMessage } from "../../src/ai/types"

async function loadKroniaChatService() {
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-groq-key"
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co"
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role"
  return import("../../src/ai/chatService.js")
}

function createLabQueryResult(data: Record<string, unknown> | null) {
  return {
    select() { return this },
    eq() { return this },
    order() { return this },
    limit() { return this },
    maybeSingle: async () => ({ data, error: null }),
  }
}

test("KroniaChatService injeta labHealthProfile do último exame válido no input do KRONOS", async () => {
  const { KroniaChatService } = await loadKroniaChatService()
  const captured: Array<Record<string, unknown>> = []
  const service = new KroniaChatService(
    { search: async () => [] },
    undefined,
    undefined,
    {
      from(table: string) {
        assert.equal(table, "lab_reports")
        return createLabQueryResult({
          id: "lab-1",
          parsed: null,
          normalized_payload: null,
          ai_insights: {
            health_profile: {
              metabolic_health: { level: "attention", flags: ["pre_diabetes"], notes: ["Glicose elevada"] },
              lipid_health: { level: "ok", flags: [], notes: [] },
              liver_health: { level: "ok", flags: [], notes: [] },
              kidney_hydration: { level: "ok", flags: [], notes: [] },
              hematologic_status: { level: "ok", flags: [], notes: [] },
              thyroid_status: { level: "ok", flags: [], notes: [] },
              androgen_status: { level: "ok", flags: [], notes: [] },
              inflammation_status: { level: "ok", flags: [], notes: [] },
              micronutrient_status: { level: "ok", flags: [], notes: [] },
              training_readiness: { level: "attention", flags: ["recovery"], notes: ["Reduzir volume"] },
              recovery_risk: { level: "attention", flags: ["recovery"], notes: ["Sono e deload"] },
              dietary_attention_points: { level: "attention", flags: ["carbohydrate_control"], notes: ["Controlar carboidratos"] },
              safety_flags: { level: "ok", flags: [], notes: [] },
              scores: {
                metabolic_score: 62,
                recovery_score: 58,
                hematologic_score: 90,
                hormonal_score: 88,
                safety_score: 84,
                lipid_score: 91,
                liver_score: 94,
                kidney_score: 93,
              },
            },
            clinical_flags: ["pre_diabetes"],
            critical_flags: [],
          },
          confidence: 0.91,
          is_valid: true,
          clinical_flags: ["ignored_column_flag"],
          critical_flags: ["ignored_column_critical"],
          created_at: "2026-04-10T10:00:00.000Z",
          processed_at: "2026-04-10T10:05:00.000Z",
        })
      },
    } as never,
  )

  ;(service as unknown as { orchestrator: { run(args: Record<string, unknown>): Promise<unknown> } }).orchestrator = {
    async run(args: Record<string, unknown>) {
      captured.push(args)
      return {
        response: {
          intent: "chat",
          action: "responder_chat",
          depth: "curta",
          shouldCreateButton: false,
          buttonType: null,
          message: "ok",
          workoutPayload: null,
          dietPayload: null,
          supplementPayload: null,
          mobilityPayload: null,
        },
        appAction: { type: "chat" },
      }
    },
  }

  await service.run({
    userId: "user-1",
    userMessage: "analise meu exame",
    history: [] satisfies ChatMessage[],
    userProfile: null,
  })

  assert.equal(captured.length, 1)
  assert.equal((captured[0].labHealthProfile as { scores: { metabolic_score: number } }).scores.metabolic_score, 62)
})

test("KroniaChatService mantém chat estável sem exame válido", async () => {
  const { KroniaChatService } = await loadKroniaChatService()
  const captured: Array<Record<string, unknown>> = []
  const service = new KroniaChatService(
    { search: async () => [] },
    undefined,
    undefined,
    {
      from() {
        return createLabQueryResult(null)
      },
    } as never,
  )

  ;(service as unknown as { orchestrator: { run(args: Record<string, unknown>): Promise<unknown> } }).orchestrator = {
    async run(args: Record<string, unknown>) {
      captured.push(args)
      return {
        response: {
          intent: "chat",
          action: "responder_chat",
          depth: "curta",
          shouldCreateButton: false,
          buttonType: null,
          message: "ok",
          workoutPayload: null,
          dietPayload: null,
          supplementPayload: null,
          mobilityPayload: null,
        },
        appAction: { type: "chat" },
      }
    },
  }

  await service.run({
    userId: "user-2",
    userMessage: "oi",
    history: [] satisfies ChatMessage[],
    userProfile: null,
  })

  assert.equal(captured.length, 1)
  assert.equal(captured[0].labHealthProfile, null)
})
