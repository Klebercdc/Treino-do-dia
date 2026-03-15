var https = require('https');
var nvidia = require('./_nvidia');
var auth = require('./_auth');

var SYSTEM = `Você é o Assistente de Análise de Alunos do DIÁRIO PRO. Analisa o progresso individual de alunos com base em dados de notas, frequência e observações pedagógicas.

REGRAS:
- Responda SOMENTE com JSON válido
- Formato: {"analise": "...", "pontosFort": ["...", "..."], "atencao": ["...", "..."], "sugestoes": ["...", "..."]}
- "analise": parágrafo geral sobre o aluno (3-5 frases)
- "pontosFort": até 3 pontos positivos
- "atencao": até 3 pontos que precisam de atenção (vazio se aluno vai bem)
- "sugestoes": até 3 sugestões práticas para o professor
- Tom: construtivo, objetivo, focado em aprendizagem
- Baseie-se APENAS nos dados recebidos`;

function callNvidia(system, messages, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);
  var m = [{ role: 'system', content: system }].concat(messages);
  var payload = { model: 'meta/llama-3.3-70b-instruct', messages: m, max_tokens: 600, temperature: 0.6, stream: false };
  nvidia.callNvidia(KEY, payload, 25000, 3, callback);
}

function parseJSON(text) {
  var clean = text.replace(/```json|```/g, '').trim();
  var s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('no json');
  return JSON.parse(clean.slice(s, e + 1));
}

module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  auth.requireAuth(req, res, function() {
    var b = req.body || {};
    var nome = b.nome || 'Aluno';
    var notas = b.notas || [];
    var faltas = b.faltas || 0;
    var totalAulas = b.totalAulas || 100;
    var observacoes = b.observacoes || '';

    var media = notas.length ? (notas.reduce(function(a, n) { return a + n; }, 0) / notas.length).toFixed(1) : 'sem notas';
    var presenca = totalAulas > 0 ? (((totalAulas - faltas) / totalAulas) * 100).toFixed(0) : 0;

    var prompt = 'Analise o progresso do aluno "' + nome + '".' +
      ' Notas por bimestre: ' + (notas.length ? notas.join(', ') : 'não informadas') +
      '. Média atual: ' + media + '.' +
      ' Faltas: ' + faltas + ' (' + presenca + '% de presença).' +
      (observacoes ? ' Observações do professor: ' + observacoes + '.' : '') +
      ' Retorne JSON com analise, pontosFort, atencao e sugestoes.';

    callNvidia(SYSTEM, [{ role: 'user', content: prompt }], function(err, text) {
      if (err) return res.status(500).json({ error: err });
      try {
        res.status(200).json(parseJSON(text));
      } catch(e) {
        res.status(200).json({ analise: text, pontosFort: [], atencao: [], sugestoes: [] });
      }
    });
  });
};
