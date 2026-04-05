import { NextRequest, NextResponse } from "next/server"
import { requireBearerAuth } from "../../_shared/requireBearerAuth"
import { checkRateLimit } from "../../../../lib/utils/serverRateLimit"
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin"
import { getRequestId } from "../../_shared/requestId"

const workoutRouteContract = require("../../../../server/apihelpers/_workoutRouteContract")
const workoutRouteHandler = require("../../../../server/apihelpers/_workoutRouteHandler")
const workoutSupabaseContext = require("../../../../server/apihelpers/_workoutSupabaseContext")

async function getEffectivePlan(userId: string): Promise<string> {
  try {
    const admin = createAdminSupabaseClient()
    const { data } = await admin
      .from("user_plans")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle()

    return workoutRouteContract.mapPlanForGate(data?.plan ?? "free")
  } catch (error) {
    console.error("[workout-route] failed to resolve effective plan", error)
    return "FREE"
  }
}

async function buildWorkoutErrorFromAuthFailure(authFailure: Response, requestId: string) {
  const status = authFailure.status || 401
  const payload = await authFailure.clone().json().catch(() => null)
  const errorCode = typeof payload?.error === "string" ? payload.error : "UNAUTHORIZED"
  const message =
    typeof payload?.message === "string" && payload.message
      ? payload.message
      : "Falha de autenticação ao gerar treino."

  const state =
    status === 401
      ? "unauthorized"
      : errorCode.toLowerCase() === "server_misconfigured"
        ? "server_misconfigured"
        : "provider_unavailable"

  return NextResponse.json(
    workoutRouteContract.buildWorkoutRouteErrorEnvelope(
      {
        state,
        error: errorCode.toUpperCase(),
        message,
      },
      { requestId },
    ),
    { status },
  )
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)

  try {
    const auth = await requireBearerAuth(req)
    if (!auth.ok) return buildWorkoutErrorFromAuthFailure(auth.response as Response, requestId)

    const userId = auth.user.id
    const rl = await checkRateLimit(userId, { max: 10, windowMs: 60000, category: "ai_heavy_operation" })
    if (!rl.allowed) {
      return NextResponse.json(
        workoutRouteContract.buildWorkoutRouteErrorEnvelope(
          {
            state: "rate_limited_temporary",
            error: "RATE_LIMITED_TEMPORARY",
            message: "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.",
          },
          { requestId, userId },
        ),
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await req.json().catch(() => null)
    const effectivePlan = await getEffectivePlan(userId)
    let enrichedBody = body
    try {
      const admin = createAdminSupabaseClient()
      const supabaseContext = await workoutSupabaseContext.loadWorkoutSupabaseContext(admin, userId)
      enrichedBody = workoutSupabaseContext.enrichWorkoutRequestBody(body, supabaseContext)
    } catch (error) {
      console.error("[workout-route] failed to enrich payload from supabase", error)
    }
    const result = await workoutRouteHandler.processWorkoutRouteRequest({
      body: enrichedBody,
      requestId,
      userId,
      effectivePlan,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json(
      workoutRouteContract.buildWorkoutRouteErrorEnvelope(
        {
          state: "provider_unavailable",
          error: "WORKOUT_ROUTE_INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Não foi possível gerar o treino agora.",
        },
        { requestId },
      ),
      { status: 500 },
    )
  }
}
