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

var crypto  = require('crypto');
var cors    = require('../src/server/apihelpers/_cors');
var plans   = require('../src/server/apihelpers/_plans');
var planRules = require('../src/lib/plans/planRules');
var billingProviders = require('../src/lib/plans/billingProviders');
var { PLAN } = require('../src/types/domain');

// ─── Replay guard (in-memory, TTL 10 min) ────────────
// Impede que a mesma requisição seja processada duas vezes
// (proteção contra replay attacks e retransmissões duplas do provider).
var _seenNonces = Object.create(null);
var NONCE_TTL_MS = 10 * 60 * 1000;
setInterval(function() {
  var cut = Date.now() - NONCE_TTL_MS;
  Object.keys(_seenNonces).forEach(function(k) {
    if (_seenNonces[k] < cut) delete _seenNonces[k];
  });
}, 60 * 1000);

function _checkReplay(nonce) {
  if (!nonce) return false;
  if (_seenNonces[nonce]) return true; // já visto = replay
  _seenNonces[nonce] = Date.now();
  return false;
}

// ─── Extrai campos seguros do payload (sem PII desnecessária) ──
// Nunca persiste o payload bruto — apenas campos necessários para auditoria.
function _sanitizePayload(provider, payload) {
  var safe = {};
  try {
    if (provider === 'hotmart') {
      var purchase = (payload.data && payload.data.purchase) || {};
      var product  = (payload.data && payload.data.product)  || {};
      safe.transaction_id = purchase.transaction || null;
      safe.amount         = (purchase.price && purchase.price.value) || null;
      safe.currency       = (purchase.price && purchase.price.currencyValue) || 'BRL';
      safe.product_name   = product.name || null;
    }
    if (provider === 'kiwify') {
      safe.transaction_id = payload.order_id || null;
      safe.amount         = payload.amount   || null;
      safe.currency       = 'BRL';
      safe.product_name   = (payload.product && payload.product.name) || null;
    }
  } catch(e) {}
  return safe;
}

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

  // Salva webhook recebido (auditoria) — apenas campos necessários, sem PII extra
  var webhookRecord = {
    provider:    provider,
    event:       event,
    buyer_email: buyerEmail,
    payload:     _sanitizePayload(provider, payload),
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
        var detectedPlan = billingProviders.detectPlanFromPayload(provider, payload);
        var expires = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
        update = {
          plan:          planRules.toDbPlan(detectedPlan),
          activated_at:  now,
          expires_at:    expires,
          updated_at:    now
        };
        if (provider === 'hotmart' && subscriberId) update.hotmart_subscriber_code = subscriberId;
        if (provider === 'kiwify'  && subscriberId) update.kiwify_subscriber_id    = subscriberId;
      } else {
        update = { plan: planRules.toDbPlan(PLAN.FREE), expires_at: now, updated_at: now };
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

// ─── Validação de assinatura HMAC-SHA256 ─────────────
//
// Hotmart v2 envia HMAC-SHA256 no header "x-hotmart-hmac-sha256".
// Kiwify envia HMAC-SHA256 no campo "signature" do body ou header "x-kiwify-signature".
// Ambos usam o token configurado no painel como secret.
//
// Fallback para token simples (header) enquanto o provider não estiver configurado
// para enviar HMAC — compatibilidade com fase de ativação inicial.
//
// NOTA: O HMAC usa req.rawBody quando disponível.
// Se o runtime não expuser rawBody, faz fallback para JSON.stringify(body).


function resolveWebhookRawBody(req) {
  if (req && req.rawBody !== undefined && req.rawBody !== null) {
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  }
  return Buffer.from(JSON.stringify((req && req.body) || {}), 'utf8');
}

function safeTimingEqual(received, expected) {
  var receivedValue = String(received || '');
  var expectedValue = String(expected || '');
  var receivedBuffer = Buffer.from(receivedValue);
  var expectedBuffer = Buffer.from(expectedValue);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  try {
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch (_) {
    return false;
  }
}

function validateSignature(req, provider) {
  // ── Hotmart ──────────────────────────────────────────
  if (provider === 'hotmart') {
    var secret = process.env.HOTMART_WEBHOOK_TOKEN;
    if (!secret) return { ok: false, reason: 'missing_hotmart_token_config' };

    var hmacHeader = req.headers['x-hotmart-hmac-sha256'] || '';
    if (hmacHeader) {
      // Verificação HMAC com timing-safe (previne timing attacks)
      try {
        var rawBody = resolveWebhookRawBody(req);
        var expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        var sigBuf   = Buffer.from(hmacHeader.toLowerCase(), 'hex');
        var expBuf   = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return { ok: false, reason: 'invalid_hotmart_hmac' };
        }
      } catch(e) {
        return { ok: false, reason: 'invalid_hotmart_hmac' };
      }
    } else {
      // Fallback: token simples no header (fase inicial / painel não configurado para HMAC)
      var tokenReceived = req.headers['x-hotmart-hottok'] || req.headers['x-hotmart-token'] || '';
      if (!safeTimingEqual(tokenReceived, secret)) {
        return { ok: false, reason: 'invalid_hotmart_token' };
      }
    }

    // Validação de timestamp (Hotmart envia creation_date em ms no payload)
    var ts = req.body && req.body.creation_date;
    if (ts && Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) {
      return { ok: false, reason: 'timestamp_expired' };
    }

    // Replay guard: usa transaction id como nonce
    var nonce = (req.body && req.body.data && req.body.data.purchase && req.body.data.purchase.transaction) || null;
    if (_checkReplay(nonce)) return { ok: false, reason: 'replay_detected' };

    return { ok: true };
  }

  // ── Kiwify ───────────────────────────────────────────
  if (provider === 'kiwify') {
    var ksecret = process.env.KIWIFY_WEBHOOK_TOKEN;
    if (!ksecret) return { ok: false, reason: 'missing_kiwify_token_config' };

    var ksig = (req.body && req.body.signature) || req.headers['x-kiwify-signature'] || '';
    if (ksig) {
      try {
        var kRawBody  = resolveWebhookRawBody(req);
        var kExpected = crypto.createHmac('sha256', ksecret).update(kRawBody).digest('hex');
        var kSigBuf   = Buffer.from(ksig.toLowerCase(), 'hex');
        var kExpBuf   = Buffer.from(kExpected, 'hex');
        if (kSigBuf.length !== kExpBuf.length || !crypto.timingSafeEqual(kSigBuf, kExpBuf)) {
          return { ok: false, reason: 'invalid_kiwify_hmac' };
        }
      } catch(e) {
        return { ok: false, reason: 'invalid_kiwify_hmac' };
      }
    } else {
      var kTokenReceived = req.headers['x-webhook-token'] || req.headers['x-kiwify-token'] || '';
      if (!safeTimingEqual(kTokenReceived, ksecret)) {
        return { ok: false, reason: 'invalid_kiwify_token' };
      }
    }

    // Replay guard: usa order_id como nonce
    var kNonce = (req.body && req.body.order_id) || null;
    if (_checkReplay(kNonce)) return { ok: false, reason: 'replay_detected' };

    return { ok: true };
  }

  return { ok: false, reason: 'invalid_provider' };
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

  if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[webhook] SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY ausente. Requisição rejeitada por segurança.');
    return res.status(503).json({ error: 'Webhook temporariamente indisponível por configuração de segurança ausente.' });
  }

  var sigValidation = validateSignature(req, provider);
  if (!sigValidation.ok) {
    if (sigValidation.reason === 'missing_hotmart_token_config' || sigValidation.reason === 'missing_kiwify_token_config') {
      console.error('[webhook] token/secret não configurado para provider:', provider);
      return res.status(503).json({ error: 'Webhook indisponível: credencial de validação não configurada.' });
    }
    if (sigValidation.reason === 'replay_detected') {
      console.warn('[webhook] replay detectado para provider:', provider);
      return res.status(200).json({ ok: true, result: { status: 'ignored', reason: 'replay' } });
    }
    console.warn('[webhook] assinatura inválida para provider:', provider, '—', sigValidation.reason);
    return res.status(401).json({ error: 'Assinatura de webhook inválida.' });
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
