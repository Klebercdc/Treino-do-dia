/**
 * Logger de uso de IA — registra tokens NVIDIA para monitoramento de custos.
 *
 * Custo estimado padrão: llama-3.1-70b-instruct na NVIDIA
 *   Input:  ~$0.00035 por 1k tokens
 *   Output: ~$0.00040 por 1k tokens
 *
 * Variáveis de ambiente:
 *   SUPABASE_SERVICE_KEY  = service_role key
 *   NVIDIA_INPUT_COST_PER_1K  = custo por 1k tokens de entrada (USD, padrão: 0.00035)
 *   NVIDIA_OUTPUT_COST_PER_1K = custo por 1k tokens de saída (USD, padrão: 0.00040)
 */

var plans = require('./_plans');

var INPUT_COST  = parseFloat(process.env.NVIDIA_INPUT_COST_PER_1K  || '0.00035');
var OUTPUT_COST = parseFloat(process.env.NVIDIA_OUTPUT_COST_PER_1K || '0.00040');

/**
 * Registra uma chamada à API NVIDIA no banco de dados.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.endpoint      - ex.: 'chat' | 'agent' | 'plan-current' | 'science-sync'
 * @param {number} opts.promptTokens
 * @param {number} opts.completionTokens
 * @param {string} [opts.model]
 */
function logUsage(opts) {
  if (!process.env.SUPABASE_SERVICE_KEY) return; // dev: não loga

  var prompt     = opts.promptTokens     || 0;
  var completion = opts.completionTokens || 0;
  var total      = prompt + completion;
  var costUsd    = (prompt / 1000) * INPUT_COST + (completion / 1000) * OUTPUT_COST;

  var record = {
    user_id:           opts.userId,
    endpoint:          opts.endpoint || 'unknown',
    prompt_tokens:     prompt,
    completion_tokens: completion,
    total_tokens:      total,
    model:             opts.model || null,
    cost_usd:          parseFloat(costUsd.toFixed(6))
  };

  // Fire & forget — não bloqueia a resposta
  plans.supabaseRequest('POST', 'ai_usage_logs', record, function(err) {
    if (err) console.error('[logger] erro ao salvar log de uso:', err);
  });
}

module.exports = { logUsage: logUsage };
