/**
 * Webhook unificado Hotmart + Kiwify
 * Ativa/cancela o plano Pro do usuário no Supabase.
 *
 * Hotmart: POST /api/payment-webhook?provider=hotmart
 *   Header: x-hotmart-hottok = HOTMART_WEBHOOK_TOKEN
 *
 * Kiwify: POST /api/payment-webhook?provider=kiwify
 *   Header: x-webhook-token = KIWIFY_WEBHOOK_TOKEN
 *
 * Variáveis de ambiente necessárias:
 *   SUPABASE_SERVICE_KEY    = service_role key do Supabase
 *   HOTMART_WEBHOOK_TOKEN   = token de validação do Hotmart (configurável no painel)
 *   KIWIFY_WEBHOOK_TOKEN    = token de validação do Kiwify
 *
 * Configuração no Hotmart/Kiwify:
 *   URL do webhook: https://treino-do-dia-orpin.vercel.app/api/payment-webhook?provider=hotmart
 */

var cors    = require('./_cors');
var plans   = require('./_plans');

// ─── Eventos que ativam o Pro ─────────────────────────
var PRO_ACTIVATE_EVENTS = [
  // Hotmart
  'PURCHASE_COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_REACTIVATED',
  'SUBSCRIPTION_REACTIVATION',
  // Kiwify
  'order_approved', 'subscription_reactivated'
];

// ─── Eventos que cancelam o Pro ───────────────────────
var PRO_CANCEL_EVENTS = [
  // Hotmart
  'PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED',
  'SUBSCRIPTION_CANCELLATION',
  // Kiwify
  'order_refunded', 'subscription_canceled', 'order_chargeback'
];

// ─── Parser de email por provider ─────────────────────
function extractEmail(provider, payload) {
  if (provider === 'hotmart') {
    // Hotmart: data.buyer.email
    return (payload.data && payload.data.buyer && payload.data.buyer.email) || null;
  }
  if (provider === 'kiwify') {
    // Kiwify: customer.email
    return (payload.Customer && payload.Customer.email) ||
           (payload.customer && payload.customer.email) || null;
  }
  return null;
}

function extractEvent(provider, payload) {
  if (provider === 'hotmart') return payload.event || '';
  if (provider === 'kiwify') return payload.order_status || payload.event || '';
  return '';
}

function extractSubscriberId(provider, payload) {
  if (provider === 'hotmart') {
    return (payload.data && payload.data.subscription && payload.data.subscription.subscriber && payload.data.subscription.subscriber.code) || null;
  }
  if (provider === 'kiwify') {
    return (payload.subscription_id) || null;
  }
  return null;
}

// ─── Lógica principal ─────────────────────────────────
function processWebhook(provider, payload, callback) {
  var event       = extractEvent(provider, payload);
  var buyerEmail  = extractEmail(provider, payload);
  var subscriberId = extractSubscriberId(provider, payload);

  // Salva webhook recebido (auditoria)
  var webhookRecord = {
    provider:    provider,
    event:       event,
    buyer_email: buyerEmail,
    payload:     payload,
    processed:   false
  };

  plans.supabaseRequest('POST', 'payment_webhooks', webhookRecord, function(logErr, logResult) {
    var webhookId = logResult && logResult[0] && logResult[0].id;

    if (!buyerEmail) {
      return callback(null, { status: 'ignored', reason: 'sem email no payload' });
    }

    var isActivate = PRO_ACTIVATE_EVENTS.some(function(e) { return e === event; });
    var isCancel   = PRO_CANCEL_EVENTS.some(function(e)   { return e === event; });

    if (!isActivate && !isCancel) {
      return callback(null, { status: 'ignored', event: event });
    }

    // Busca usuário pelo email no Supabase Auth (via auth.users view)
    plans.supabaseRequest('GET', 'auth_users_view?email=eq.' + encodeURIComponent(buyerEmail) + '&select=id', null, function(err, rows) {
      // Fallback: busca via profiles (se auth.users não acessível)
      if (err || !rows || rows.length === 0) {
        // Tenta via rpc ou simplesmente loga e sai
        console.error('[webhook] usuário não encontrado para email:', buyerEmail, err || '');
        // Marca webhook como processado mesmo assim (para não re-processar)
        if (webhookId) {
          plans.supabaseRequest('PATCH', 'payment_webhooks?id=eq.' + webhookId, { processed: true }, function() {});
        }
        return callback(null, { status: 'user_not_found', email: buyerEmail });
      }

      var userId = rows[0].id;
      var now    = new Date().toISOString();

      var update;
      if (isActivate) {
        // Pro: expira em 35 dias (margem sobre 30 dias para evitar corte antecipado)
        var expires = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
        update = {
          plan:          'pro',
          activated_at:  now,
          expires_at:    expires,
          updated_at:    now
        };
        if (provider === 'hotmart' && subscriberId) update.hotmart_subscriber_code = subscriberId;
        if (provider === 'kiwify'  && subscriberId) update.kiwify_subscriber_id    = subscriberId;
      } else {
        update = { plan: 'free', expires_at: now, updated_at: now };
      }

      plans.supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, update, function(updateErr) {
        if (updateErr) return callback(updateErr, null);

        // Marca webhook como processado
        if (webhookId) {
          plans.supabaseRequest('PATCH', 'payment_webhooks?id=eq.' + webhookId, { processed: true }, function() {});
        }

        callback(null, { status: 'ok', action: isActivate ? 'activated' : 'canceled', userId: userId });
      });
    });
  });
}

// ─── Token validation ─────────────────────────────────
function validateToken(req, provider) {
  if (provider === 'hotmart') {
    var token = process.env.HOTMART_WEBHOOK_TOKEN;
    if (!token) return true; // sem token configurado → aceita (dev)
    var received = req.headers['x-hotmart-hottok'] || req.headers['x-hotmart-token'] || '';
    return received === token;
  }
  if (provider === 'kiwify') {
    var ktoken = process.env.KIWIFY_WEBHOOK_TOKEN;
    if (!ktoken) return true;
    var kreceived = req.headers['x-webhook-token'] || req.headers['x-kiwify-token'] || '';
    return kreceived === ktoken;
  }
  return false;
}

// ─── Handler Vercel ───────────────────────────────────
module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  var provider = (req.query && req.query.provider) || 'hotmart';
  if (provider !== 'hotmart' && provider !== 'kiwify') {
    return res.status(400).json({ error: 'provider inválido. Use ?provider=hotmart ou ?provider=kiwify' });
  }

  if (!validateToken(req, provider)) {
    console.warn('[webhook] token inválido para provider:', provider);
    return res.status(401).json({ error: 'Token de webhook inválido' });
  }

  var payload = req.body || {};

  processWebhook(provider, payload, function(err, result) {
    if (err) {
      console.error('[webhook] erro:', err);
      return res.status(500).json({ error: String(err) });
    }
    res.status(200).json({ ok: true, result: result });
  });
};
