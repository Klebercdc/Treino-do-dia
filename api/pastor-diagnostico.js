/**
 * PASTOR DIAGNÓSTICO — O Pastor das Ovelhas do Código
 *
 * Roda diariamente via Vercel Cron (ver vercel.json) às 03:00 UTC.
 * Faz a ronda pelo sistema como um pastor: verifica cada "ovelha" (serviço),
 * auto-corrige o que pode e compacta dados velhos para o rebanho seguir em frente.
 *
 * Checagens:
 *   1. Variáveis de ambiente (obrigatórias x opcionais)
 *   2. Conectividade com Supabase
 *   3. Quotas de planos desatualizadas → auto-reset
 *   4. Webhooks de pagamento presos → alerta
 *   5. Compactação: remove logs de IA com mais de 90 dias
 *
 * Segurança:
 *   Protegido por CRON_SECRET (env var). O header pode ser:
 *     Authorization: Bearer <CRON_SECRET>
 *   Se CRON_SECRET não estiver definido, só aceita requests de localhost.
 *
 * Resultado salvo na tabela `diagnosticos` (migration 003).
 * GET /api/pastor-diagnostico  → retorna o último relatório salvo.
 * POST /api/pastor-diagnostico → executa a ronda completa.
 */

var https = require('https');
var cors = require('./_cors');

// ══════════════════════════════════════════
// HELPER: chamada direta ao Supabase REST
// ══════════════════════════════════════════

function supabaseReq(method, path, body, callback) {
  var base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  var key  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return callback('SUPABASE não configurado', null);

  var url;
  try { url = new URL(base + path); } catch (e) { return callback('URL inválida: ' + e.message, null); }

  var bodyStr = body ? JSON.stringify(body) : '';
  var headers = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  var options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode >= 400) return callback('HTTP ' + res.statusCode + ': ' + data.substring(0, 200), null);
      try { callback(null, data ? JSON.parse(data) : null); }
      catch (e) { callback('JSON parse: ' + e.message, null); }
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  if (bodyStr) req.write(bodyStr);
  req.end();
}

// ══════════════════════════════════════════
// CHECK 1 — Variáveis de ambiente
// ══════════════════════════════════════════

function checkEnv(report) {
  var criticas  = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY'];
  var opcionais = ['CHECKOUT_URL', 'FREE_AI_LIMIT', 'CRON_SECRET'];

  var faltando_criticas  = criticas.filter(function(k) { return !process.env[k]; });
  var faltando_opcionais = opcionais.filter(function(k) { return !process.env[k]; });

  report.checagens.env = {
    ok: faltando_criticas.length === 0,
    faltando_criticas: faltando_criticas,
    faltando_opcionais: faltando_opcionais
  };

  if (faltando_criticas.length) {
    report.erros.push('ENV: variáveis críticas ausentes: ' + faltando_criticas.join(', '));
  }
}

// ══════════════════════════════════════════
// CHECK 2 — Conectividade Supabase
// ══════════════════════════════════════════

function checkSupabase(report, callback) {
  supabaseReq('GET', '/rest/v1/user_plans?select=user_id&limit=1', null, function(err) {
    report.checagens.supabase = { ok: !err, erro: err || null };
    if (err) report.erros.push('SUPABASE: falha de conexão — ' + err);
    callback();
  });
}

// ══════════════════════════════════════════
// CHECK 3 — Quotas de planos desatualizadas
//           AUTO-REPARO: chama reset_monthly_quotas
// ══════════════════════════════════════════

function checkERepararQuotaStale(report, reparos, callback) {
  var mesAtual = new Date();
  mesAtual.setUTCDate(1);
  mesAtual.setUTCHours(0, 0, 0, 0);
  var isoMes = mesAtual.toISOString();

  var q = '/rest/v1/user_plans?period_start=lt.' + encodeURIComponent(isoMes)
        + '&select=user_id,period_start,ai_requests_used';

  supabaseReq('GET', q, null, function(err, data) {
    if (err) {
      report.checagens.quota_stale = { ok: false, erro: err };
      report.avisos.push('QUOTA: não foi possível verificar planos — ' + err);
      return callback();
    }

    var stale = Array.isArray(data) ? data : [];
    report.checagens.quota_stale = { ok: stale.length === 0, planos_desatualizados: stale.length };

    if (stale.length === 0) return callback();

    report.avisos.push('QUOTA: ' + stale.length + ' plano(s) com quota do mês passado — executando reset automático');

    supabaseReq('POST', '/rest/v1/rpc/reset_monthly_quotas', {}, function(errReset) {
      if (errReset) {
        report.erros.push('QUOTA: falha no reset automático — ' + errReset);
      } else {
        reparos.push('Quota de ' + stale.length + ' plano(s) resetada automaticamente');
        report.checagens.quota_stale.reparado = true;
      }
      callback();
    });
  });
}

// ══════════════════════════════════════════
// CHECK 4 — Webhooks de pagamento presos
// ══════════════════════════════════════════

function checkWebhooksPresos(report, callback) {
  var limite = new Date(Date.now() - 3600000).toISOString(); // 1h atrás
  var q = '/rest/v1/payment_webhooks?processed=eq.false&created_at=lt.' + encodeURIComponent(limite)
        + '&select=id,provider,event,created_at';

  supabaseReq('GET', q, null, function(err, data) {
    if (err) {
      report.checagens.webhooks = { ok: false, erro: err };
      return callback();
    }
    var presos = Array.isArray(data) ? data : [];
    report.checagens.webhooks = {
      ok: presos.length === 0,
      webhooks_presos: presos.length,
      detalhes: presos.slice(0, 5).map(function(w) {
        return w.provider + ':' + w.event + ' (' + w.created_at + ')';
      })
    };
    if (presos.length > 0) {
      report.avisos.push('WEBHOOKS: ' + presos.length + ' webhook(s) não processado(s) há mais de 1h — verificar manualmente');
    }
    callback();
  });
}

// ══════════════════════════════════════════
// CHECK 5 — Compactação de logs antigos
//           AUTO-REPARO: deleta logs > 90 dias
// ══════════════════════════════════════════

function compactarLogs(report, reparos, callback) {
  var limite = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  var q = '/rest/v1/ai_usage_logs?created_at=lt.' + encodeURIComponent(limite);

  supabaseReq('DELETE', q, null, function(err, data) {
    if (err) {
      report.checagens.compactacao = { ok: false, erro: err };
      report.avisos.push('COMPACTAÇÃO: falha ao limpar logs antigos — ' + err);
      return callback();
    }
    var removidos = Array.isArray(data) ? data.length : 0;
    report.checagens.compactacao = { ok: true, logs_removidos: removidos };
    if (removidos > 0) {
      reparos.push('Compactação: ' + removidos + ' log(s) de IA com mais de 90 dias removidos');
    }
    callback();
  });
}

// ══════════════════════════════════════════
// SALVAR RELATÓRIO NA TABELA diagnosticos
// ══════════════════════════════════════════

function salvarRelatorio(report, callback) {
  var base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  var key  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return callback();

  var body = {
    executado_em:      report.executado_em,
    status:            report.status,
    erros:             report.erros,
    avisos:            report.avisos,
    reparos_executados: report.reparos_executados,
    checagens:         report.checagens
  };

  supabaseReq('POST', '/rest/v1/diagnosticos', body, function(err) {
    if (err) report.avisos.push('RELATÓRIO: falha ao persistir no banco — ' + err);
    callback();
  });
}

// ══════════════════════════════════════════
// BUSCAR ÚLTIMO RELATÓRIO (GET)
// ══════════════════════════════════════════

function buscarUltimoRelatorio(callback) {
  var q = '/rest/v1/diagnosticos?order=executado_em.desc&limit=5&select=*';
  supabaseReq('GET', q, null, callback);
}

// ══════════════════════════════════════════
// PIPELINE COMPLETO DA RONDA
// ══════════════════════════════════════════

function executarRonda(callback) {
  var reparos = [];
  var report = {
    executado_em:       new Date().toISOString(),
    status:             'ok',
    erros:              [],
    avisos:             [],
    reparos_executados: [],
    checagens:          {},
    rebanho:            '🐑 Ronda do Pastor concluída'
  };

  checkEnv(report);

  checkSupabase(report, function() {
  checkERepararQuotaStale(report, reparos, function() {
  checkWebhooksPresos(report, function() {
  compactarLogs(report, reparos, function() {

    report.reparos_executados = reparos;
    report.status = report.erros.length > 0  ? 'erro'
                  : report.avisos.length > 0 ? 'aviso'
                  : 'ok';

    var emoji = report.status === 'erro'   ? '🔴'
              : report.status === 'aviso'  ? '🟡'
              : '🟢';

    report.rebanho = emoji + ' Ronda concluída — '
      + report.erros.length + ' erro(s), '
      + report.avisos.length + ' aviso(s), '
      + reparos.length + ' reparo(s) automático(s)';

    salvarRelatorio(report, function() {
      callback(null, report);
    });

  }); }); }); });
}

// ══════════════════════════════════════════
// HANDLER HTTP
// ══════════════════════════════════════════

function isAuthorized(req) {
  var secret = process.env.CRON_SECRET;
  // Em produção, CRON_SECRET é obrigatório — x-forwarded-for é forjável no Vercel
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production') return false;
    // Local/preview: aceita apenas loopback (sem x-forwarded-for para evitar bypass)
    var ip = req.socket && req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }
  var authHeader = req.headers['authorization'] || req.headers['x-cron-secret'] || '';
  return authHeader === 'Bearer ' + secret || authHeader === secret;
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Não autorizado. Configure CRON_SECRET.' });
  }

  // GET → retorna os últimos relatórios sem executar ronda
  if (req.method === 'GET') {
    buscarUltimoRelatorio(function(err, data) {
      if (err) return res.status(500).json({ error: err });
      return res.status(200).json({ relatorios: data || [] });
    });
    return;
  }

  // POST → executa ronda completa
  if (req.method === 'POST') {
    executarRonda(function(err, report) {
      if (err) return res.status(500).json({ error: err });
      return res.status(200).json(report);
    });
    return;
  }

  res.status(405).end();
};
