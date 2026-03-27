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
 *   SUPABASE_URL              → URL do projeto
 *   SUPABASE_SERVICE_ROLE_KEY → Service Role Key
 *   CRON_SECRET               → Secret para validar chamadas do cron
 *   VAPID_PUBLIC_KEY          → Chave pública VAPID
 *   VAPID_PRIVATE_KEY         → Chave privada VAPID
 *   VAPID_SUBJECT             → mailto:seu@email.com
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const INACTIVITY_DAYS = 3;

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
}

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PUSH_PAYLOAD = JSON.stringify({
  title: 'KRONIA: Hora de treinar? 🏋️',
  body: 'Sua fadiga está dissipada. Não deixe seu progresso esfriar!',
  icon: '/Kronia.png',
  badge: '/Kronia.png',
  tag: 'kronia-reengajamento',
  url: '/',
  renotify: true,
});

async function fetchInactiveUsers(sb: ReturnType<typeof createClient>): Promise<InactiveUser[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() - INACTIVITY_DAYS);
  const isoLimite = limite.toISOString().split('T')[0];

  const { data: ativos, error: errAtivos } = await sb
    .from('workouts')
    .select('user_id')
    .gte('date', isoLimite);

  if (errAtivos) throw new Error(`Busca ativos: ${errAtivos.message}`);

  const userIdsAtivos = new Set((ativos ?? []).map((r: { user_id: string }) => r.user_id));

  const { data: subs, error: errSubs } = await sb.from('push_subscriptions').select('user_id');
  if (errSubs) throw new Error(`Busca subs: ${errSubs.message}`);

  return (subs ?? [])
    .filter((s: { user_id: string }) => !userIdsAtivos.has(s.user_id))
    .map((s: { user_id: string }) => ({ user_id: s.user_id }));
}

async function fetchSubscriptions(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<PushSubscription[]> {
  const { data, error } = await sb
    .from('push_subscriptions')
    .select('id, user_id, subscription_json')
    .eq('user_id', userId);

  if (error) throw new Error(`Subs do usuário ${userId}: ${error.message}`);
  return (data ?? []) as PushSubscription[];
}

async function sendPush(
  sb: ReturnType<typeof createClient>,
  sub: PushSubscription,
): Promise<'ok' | 'expired' | 'error'> {
  try {
    await webpush.sendNotification(sub.subscription_json, PUSH_PAYLOAD);
    return 'ok';
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      await sb.from('push_subscriptions').delete().eq('id', sub.id);
      return 'expired';
    }
    console.error(`Push falhou para ${sub.id}:`, err);
    return 'error';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Validar env vars dentro do handler para evitar crash no boot
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@kronia.app';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.' });
  }
  if (!vapidPublic || !vapidPrivate) {
    return jsonResponse(500, { error: 'Chaves VAPID ausentes.' });
  }

  // Autenticação mínima do cron via secret header
  if (cronSecret) {
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return jsonResponse(401, { error: 'Unauthorized.' });
    }
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const resultado = {
      executado_em: new Date().toISOString(),
      usuarios_inativos: 0,
      notificacoes_ok: 0,
      notificacoes_expiradas: 0,
      notificacoes_erro: 0,
    };

    const inativos = await fetchInactiveUsers(sb);
    resultado.usuarios_inativos = inativos.length;
    console.log(`Usuários inativos há ${INACTIVITY_DAYS}+ dias: ${inativos.length}`);

    for (const { user_id } of inativos) {
      const subs = await fetchSubscriptions(sb, user_id);
      for (const sub of subs) {
        const status = await sendPush(sb, sub);
        if (status === 'ok') resultado.notificacoes_ok++;
        if (status === 'expired') resultado.notificacoes_expiradas++;
        if (status === 'error') resultado.notificacoes_erro++;
      }
    }

    console.log('Resultado:', resultado);
    return jsonResponse(200, resultado);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro na Edge Function:', message);
    return jsonResponse(500, { error: message });
  }
});
