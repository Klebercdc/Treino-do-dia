/**
 * KRONIA — Edge Function: check-inactivity
 * =========================================
 * Roda diariamente (via Supabase Cron) às 09:00 UTC.
 * Identifica usuários sem treino há 3+ dias e dispara
 * uma Web Push Notification de reengajamento.
 *
 * Deploy:
 *   supabase functions deploy check-inactivity
 *
 * Variáveis de ambiente necessárias (Supabase Dashboard → Secrets):
 *   SUPABASE_URL            → URL do projeto
 *   SUPABASE_SERVICE_ROLE_KEY → Service Role Key
 *   VAPID_PUBLIC_KEY        → Chave pública VAPID
 *   VAPID_PRIVATE_KEY       → Chave privada VAPID
 *   VAPID_SUBJECT           → mailto:seu@email.com
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

// ── Configuração ─────────────────────────────────────────────
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC      = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE     = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kronia.app";
const INACTIVITY_DAYS   = 3;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Tipos ────────────────────────────────────────────────────
interface PushSubscription {
  id: string;
  user_id: string;
  subscription_json: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

interface InactiveUser {
  user_id: string;
  ultimo_treino: string | null;
}

// ── Payload da notificação ───────────────────────────────────
const PUSH_PAYLOAD = JSON.stringify({
  title:  "KRONIA: Hora de treinar? 🏋️",
  body:   "Sua fadiga está dissipada. Não deixe seu progresso esfriar!",
  icon:   "/Kronia.png",
  badge:  "/Kronia.png",
  tag:    "kronia-reengajamento",
  url:    "/",
  renotify: true,
});

// ── Busca usuários inativos ───────────────────────────────────
async function fetchInactiveUsers(): Promise<InactiveUser[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() - INACTIVITY_DAYS);
  const isoLimite = limite.toISOString().split("T")[0];

  // Busca distintos user_id que NÃO têm treino nos últimos N dias
  const { data: ativos, error: errAtivos } = await sb
    .from("workouts")
    .select("user_id")
    .gte("date", isoLimite);

  if (errAtivos) throw new Error(`Busca ativos: ${errAtivos.message}`);

  const userIdsAtivos = new Set((ativos ?? []).map((r: { user_id: string }) => r.user_id));

  // Busca todos com push subscription
  const { data: subs, error: errSubs } = await sb
    .from("push_subscriptions")
    .select("user_id");

  if (errSubs) throw new Error(`Busca subs: ${errSubs.message}`);

  // Filtra os que não treinaram
  const inativos: InactiveUser[] = (subs ?? [])
    .filter((s: { user_id: string }) => !userIdsAtivos.has(s.user_id))
    .map((s: { user_id: string }) => ({ user_id: s.user_id, ultimo_treino: null }));

  return inativos;
}

// ── Busca subscriptions de um usuário ───────────────────────
async function fetchSubscriptions(userId: string): Promise<PushSubscription[]> {
  const { data, error } = await sb
    .from("push_subscriptions")
    .select("id, user_id, subscription_json")
    .eq("user_id", userId);

  if (error) throw new Error(`Subs do usuário ${userId}: ${error.message}`);
  return (data ?? []) as PushSubscription[];
}

// ── Dispara notificação ──────────────────────────────────────
async function sendPush(sub: PushSubscription): Promise<"ok" | "expired" | "error"> {
  try {
    await webpush.sendNotification(sub.subscription_json, PUSH_PAYLOAD);
    return "ok";
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    // 410 Gone ou 404 → subscription expirada, remove do banco
    if (status === 410 || status === 404) {
      await sb.from("push_subscriptions").delete().eq("id", sub.id);
      return "expired";
    }
    console.error(`Push falhou para ${sub.id}:`, err);
    return "error";
  }
}

// ── Handler principal ────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Aceita GET (ping de cron) e POST
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const resultado = {
    executado_em:    new Date().toISOString(),
    usuarios_inativos: 0,
    notificacoes_ok:   0,
    notificacoes_expiradas: 0,
    notificacoes_erro: 0,
  };

  try {
    const inativos = await fetchInactiveUsers();
    resultado.usuarios_inativos = inativos.length;
    console.log(`Usuários inativos há ${INACTIVITY_DAYS}+ dias: ${inativos.length}`);

    for (const { user_id } of inativos) {
      const subs = await fetchSubscriptions(user_id);
      for (const sub of subs) {
        const status = await sendPush(sub);
        if (status === "ok")      resultado.notificacoes_ok++;
        if (status === "expired") resultado.notificacoes_expiradas++;
        if (status === "error")   resultado.notificacoes_erro++;
      }
    }
  } catch (err: unknown) {
    console.error("Erro na Edge Function:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log("Resultado:", resultado);
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
