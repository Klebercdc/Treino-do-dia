/**
 * KRONIA — Edge Function: telegram-kronia-bot
 * ============================================
 * Webhook do Telegram. Recebe comandos e responde com dados
 * do projeto Kronia em tempo real.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN       = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ALLOWED_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY    = Deno.env.get("GROQ_API_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Envio de mensagem ─────────────────────────────────────────
async function send(chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[kronia-bot] sendMessage error:", JSON.stringify(err));

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
}

// ── /ajuda ────────────────────────────────────────────────────
function handleAjuda(): string {
  return [
    "*🏋️ KRONIA Bot — Comandos*",
    "",
    "/status — Status do sistema",
    "/usuarios — Total de usuários cadastrados",
    "/treinos\\_hoje — Treinos registrados hoje",
    "/scan — Scan defensivo da base de usuários",
    "/kronos [pergunta] — Fala com o KRONOS",
    "/ajuda — Esta mensagem",
  ].join("\n");
}

// ── /status ───────────────────────────────────────────────────
function handleStatus(): string {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `*✅ KRONIA Online*\n\n🕐 ${agora}\n🗄️ Banco conectado`;
}

// ── /usuarios ─────────────────────────────────────────────────
async function handleUsuarios(): Promise<string> {
  const { count, error } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (error) return `❌ Erro ao buscar usuários: ${error.message}`;
  return `*👥 Usuários cadastrados:* ${count ?? 0}`;
}

// ── /treinos_hoje ─────────────────────────────────────────────
async function handleTreinosHoje(): Promise<string> {
  const hoje = new Date().toISOString().split("T")[0];
  const { count, error } = await sb
    .from("workouts")
    .select("*", { count: "exact", head: true })
    .eq("date", hoje);

  if (error) return `❌ Erro ao buscar treinos: ${error.message}`;
  return `*🏋️ Treinos hoje:* ${count ?? 0}`;
}

// ── /scan ─────────────────────────────────────────────────────
async function handleScan(): Promise<string> {
  const agora = new Date();
  const limite7d = new Date(agora);
  limite7d.setDate(agora.getDate() - 7);
  const limite30d = new Date(agora);
  limite30d.setDate(agora.getDate() - 30);

  const [{ count: total }, { count: ativos7d }, { count: ativos30d }] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb.from("workouts").select("user_id", { count: "exact", head: true }).gte("date", limite7d.toISOString().split("T")[0]),
    sb.from("workouts").select("user_id", { count: "exact", head: true }).gte("date", limite30d.toISOString().split("T")[0]),
  ]);

  const t = total ?? 0;
  const a7 = ativos7d ?? 0;
  const inativos = Math.max(0, t - a7);
  const taxaEngajamento = t > 0 ? Math.round((a7 / t) * 100) : 0;

  const alertas: string[] = [];
  if (taxaEngajamento < 30) alertas.push("⚠️ Engajamento baixo (< 30%)");
  if (inativos > t * 0.7)   alertas.push("⚠️ Mais de 70% de usuários inativos");

  return [
    "*🔍 Scan Defensivo KRONIA*",
    "",
    `👥 Total de usuários: ${t}`,
    `🏋️ Ativos (7 dias): ${a7}`,
    `📅 Ativos (30 dias): ${ativos30d ?? 0}`,
    `😴 Inativos: ${inativos}`,
    `📊 Engajamento 7d: ${taxaEngajamento}%`,
    "",
    alertas.length > 0 ? alertas.join("\n") : "✅ Sem alertas críticos",
  ].join("\n");
}

// ── /kronos ───────────────────────────────────────────────────
async function handleKronos(pergunta: string): Promise<string> {
  if (!pergunta) return "Use: `/kronos` seguido da sua pergunta.\n\nEx: `/kronos como montar um treino de peito?`";
  if (!GROQ_API_KEY) return "❌ GROQ_API_KEY não configurada nas secrets do Supabase.";

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: "Você é o KRONOS, coach de alta performance do app KRONIA. Responda em português brasileiro de forma direta e prática, como um coach falando no WhatsApp. Máximo 200 palavras. Sem formatação markdown excessiva.",
        },
        { role: "user", content: pergunta },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) return `❌ Erro ${resp.status} ao contactar KRONOS.`;

  const data = await resp.json();
  const reply = data.choices?.[0]?.message?.content ?? "";
  return reply || "❌ KRONOS não retornou resposta.";
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // GET ?action=register — registra o webhook no Telegram
  if (req.method === "GET" && url.searchParams.get("action") === "register") {
    const webhookUrl = `${url.origin}/functions/v1/telegram-kronia-bot`;
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("KRONIA Telegram Bot online.", { status: 200 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = body?.message as Record<string, unknown> | undefined;
  if (!message) return new Response("OK", { status: 200 });

  const chatId = (message.chat as Record<string, unknown>)?.id as number;
  const text   = (message.text as string) ?? "";

  // Log para diagnóstico
  console.log(`[kronia-bot] chatId recebido: ${chatId} | ALLOWED: ${ALLOWED_CHAT_ID}`);

  // Segurança: só responde ao chat autorizado
  if (ALLOWED_CHAT_ID && String(chatId) !== String(ALLOWED_CHAT_ID)) {
    console.warn(`[kronia-bot] chatId bloqueado: ${chatId}`);
    return new Response("OK", { status: 200 });
  }

  let reply = "";

  if (text === "/start" || text === "/ajuda") {
    reply = handleAjuda();
  } else if (text === "/status") {
    reply = handleStatus();
  } else if (text === "/usuarios") {
    reply = await handleUsuarios();
  } else if (text === "/treinos_hoje") {
    reply = await handleTreinosHoje();
  } else if (text === "/scan") {
    reply = await handleScan();
  } else if (text.startsWith("/kronos")) {
    const pergunta = text.replace(/^\/kronos\s*/i, "").trim();
    reply = await handleKronos(pergunta);
  } else {
    reply = "Comando não reconhecido. Use /ajuda para ver os comandos disponíveis.";
  }

  await send(chatId, reply);
  return new Response("OK", { status: 200 });
});
