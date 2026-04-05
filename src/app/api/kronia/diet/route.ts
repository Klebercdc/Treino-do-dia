import { NextRequest, NextResponse } from "next/server"
import { requireBearerAuth } from "../../_shared/requireBearerAuth"
import { checkRateLimit } from "../../../../lib/utils/serverRateLimit"
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin"
import { getRequestId } from "../../_shared/requestId"

const dietRouteContract = require("../../../../server/apihelpers/_dietRouteContract")
const dietRouteHandler = require("../../../../server/apihelpers/_dietRouteHandler")
const dietSupabaseContext = require("../../../../server/apihelpers/_dietSupabaseContext")

async function getEffectivePlan(userId: string): Promise<string> {
  try {
    const admin = createAdminSupabaseClient()
    const { data } = await admin
      .from("user_plans")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle()

    return dietRouteContract.mapPlanForGate(data?.plan ?? "free")
  } catch (error) {
    console.error("[diet-route] failed to resolve effective plan", error)
    return "FREE"
  }
}

async function buildDietErrorFromAuthFailure(authFailure: Response, requestId: string) {
  const status = authFailure.status || 401
  const payload = await authFailure.clone().json().catch(() => null)
  const errorCode = typeof payload?.error === "string" ? payload.error : "UNAUTHORIZED"
  const message =
    typeof payload?.message === "string" && payload.message
      ? payload.message
      : "Falha de autenticação ao gerar dieta."

  const state =
    status === 401
      ? "unauthorized"
      : errorCode.toLowerCase() === "server_misconfigured"
        ? "server_misconfigured"
        : "provider_unavailable"

  return NextResponse.json(
    dietRouteContract.buildDietRouteErrorEnvelope(
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
    if (!auth.ok) return buildDietErrorFromAuthFailure(auth.response as Response, requestId)

    const userId = auth.user.id
    const rl = await checkRateLimit(userId, { max: 10, windowMs: 60000, category: "ai_heavy_operation" })
    if (!rl.allowed) {
      return NextResponse.json(
        dietRouteContract.buildDietRouteErrorEnvelope(
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
      const supabaseContext = await dietSupabaseContext.loadDietSupabaseContext(admin, userId)
      enrichedBody = dietSupabaseContext.enrichDietRequestBody(body, supabaseContext)
    } catch (error) {
      console.error("[diet-route] failed to enrich payload from supabase", error)
    }
    const result = await dietRouteHandler.processDietRouteRequest({
      body: enrichedBody,
      requestId,
      userId,
      effectivePlan,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json(
      dietRouteContract.buildDietRouteErrorEnvelope(
        {
          state: "provider_unavailable",
          error: "DIET_ROUTE_INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Não foi possível gerar a dieta agora.",
        },
        { requestId },
      ),
      { status: 500 },
    )
  }
}
