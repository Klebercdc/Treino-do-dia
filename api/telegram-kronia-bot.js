/**
 * KRONIA — Vercel API Route: telegram-kronia-bot
 * ================================================
 * Webhook do Telegram. Recebe comandos e responde com dados do Kronia.
 *
 * Variáveis de ambiente necessárias (Vercel Dashboard → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN        → Token do @KroniaAppBot
 *   TELEGRAM_CHAT_ID          → Chat ID autorizado
 *   NEXT_PUBLIC_SUPABASE_URL  → URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY → Service Role Key
 *   GROQ_API_KEY              → Chave da API do KRONOS (opcional)
 *
 * Registrar webhook (rode uma vez após o deploy):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://treino-do-dia-orpin.vercel.app/api/telegram-kronia-bot"
 */

const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';

async function send(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  if (!res.ok) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
}

function handleAjuda() {
  return [
    '*🏋️ KRONIA Bot — Comandos*',
    '',
    '/status — Status do sistema',
    '/usuarios — Total de usuários cadastrados',
    '/treinos\\_hoje — Treinos registrados hoje',
    '/scan — Scan defensivo da base de usuários',
    '/kronos [pergunta] — Fala com o KRONOS',
    '/ajuda — Esta mensagem',
  ].join('\n');
}

function handleStatus() {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `*✅ KRONIA Online*\n\n🕐 ${agora}\n🗄️ Banco conectado`;
}

async function handleUsuarios(sb) {
  const { count, error } = await sb
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) return `❌ Erro ao buscar usuários: ${error.message}`;
  return `*👥 Usuários cadastrados:* ${count ?? 0}`;
}

async function handleTreinosHoje(sb) {
  const hoje = new Date().toISOString().split('T')[0];
  const { count, error } = await sb
    .from('workouts')
    .select('*', { count: 'exact', head: true })
    .eq('date', hoje);

  if (error) return `❌ Erro ao buscar treinos: ${error.message}`;
  return `*🏋️ Treinos hoje:* ${count ?? 0}`;
}

async function handleScan(sb) {
  const agora = new Date();
  const limite7d = new Date(agora);
  limite7d.setDate(agora.getDate() - 7);
  const limite30d = new Date(agora);
  limite30d.setDate(agora.getDate() - 30);

  const [{ count: total }, { count: ativos7d }, { count: ativos30d }] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('workouts').select('user_id', { count: 'exact', head: true }).gte('date', limite7d.toISOString().split('T')[0]),
    sb.from('workouts').select('user_id', { count: 'exact', head: true }).gte('date', limite30d.toISOString().split('T')[0]),
  ]);

  const t = total ?? 0;
  const a7 = ativos7d ?? 0;
  const inativos = Math.max(0, t - a7);
  const taxaEngajamento = t > 0 ? Math.round((a7 / t) * 100) : 0;

  const alertas = [];
  if (taxaEngajamento < 30) alertas.push('⚠️ Engajamento baixo (< 30%)');
  if (inativos > t * 0.7)   alertas.push('⚠️ Mais de 70% de usuários inativos');

  return [
    '*🔍 Scan Defensivo KRONIA*',
    '',
    `👥 Total de usuários: ${t}`,
    `🏋️ Ativos (7 dias): ${a7}`,
    `📅 Ativos (30 dias): ${ativos30d ?? 0}`,
    `😴 Inativos: ${inativos}`,
    `📊 Engajamento 7d: ${taxaEngajamento}%`,
    '',
    alertas.length > 0 ? alertas.join('\n') : '✅ Sem alertas críticos',
  ].join('\n');
}

async function handleKronos(pergunta) {
  if (!pergunta) return 'Use: `/kronos` seguido da sua pergunta.\n\nEx: `/kronos como montar um treino de peito?`';
  if (!GROQ_API_KEY) return '❌ GROQ_API_KEY não configurada.';

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'system',
          content: 'Você é o KRONOS, coach de alta performance do app KRONIA. Responda em português brasileiro de forma direta e prática, como um coach falando no WhatsApp. Máximo 200 palavras. Sem formatação markdown excessiva.',
        },
        { role: 'user', content: pergunta },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) return `❌ Erro ${resp.status} ao contactar KRONOS.`;
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '❌ KRONOS não retornou resposta.';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('KRONIA Telegram Bot online.');
  }

  const body = req.body;
  const message = body?.message;
  if (!message) return res.status(200).send('OK');

  const chatId = message?.chat?.id;
  const text   = message?.text || '';

  if (String(chatId) !== String(ALLOWED_CHAT_ID)) {
    return res.status(200).send('OK');
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  let reply = '';

  if (text === '/start' || text === '/ajuda') {
    reply = handleAjuda();
  } else if (text === '/status') {
    reply = handleStatus();
  } else if (text === '/usuarios') {
    reply = await handleUsuarios(sb);
  } else if (text === '/treinos_hoje') {
    reply = await handleTreinosHoje(sb);
  } else if (text === '/scan') {
    reply = await handleScan(sb);
  } else if (text.startsWith('/kronos')) {
    const pergunta = text.replace(/^\/kronos\s*/i, '').trim();
    reply = await handleKronos(pergunta);
  } else {
    reply = 'Comando não reconhecido. Use /ajuda para ver os comandos disponíveis.';
  }

  await send(chatId, reply);
  return res.status(200).send('OK');
};
