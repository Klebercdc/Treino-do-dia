var https = require('https');
var nvidia = require('./_nvidia');
var auth = require('./_auth');

var SYSTEM = `Você é o Assistente de Planejamento de Atividades do DIÁRIO PRO. Sugere atividades pedagógicas criativas e adequadas à faixa etária e ao conteúdo curricular.

REGRAS:
- Responda SOMENTE com JSON válido
- Formato: {"sugestoes": [{"nome": "...", "tipo": "...", "descricao": "...", "duracao": "...", "materiais": "..."}]}
- Forneça exatamente 3 sugestões
- "tipo": um de "avaliacao", "trabalho", "leitura", "exercicio", "projeto", "jogo"
- "duracao": tempo estimado (ex: "50 minutos", "1 semana")
- "materiais": materiais necessários ou "Nenhum material especial"
- Atividades devem ser práticas, engajantes e pedagogicamente embasadas
- Considere a faixa etária e o bimestre informados`;

function callNvidia(system, messages, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);
  var m = [{ role: 'system', content: system }].concat(messages);
  var payload = { model: 'meta/llama-3.3-70b-instruct', messages: m, max_tokens: 700, temperature: 0.8, stream: false };
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
    var turma = b.turma || 'turma';
    var serie = b.serie || 'Ensino Fundamental';
    var bimestre = b.bimestre || '1º Bimestre';
    var disciplina = b.disciplina || 'geral';
    var temaAtual = b.temaAtual || '';

    var prompt = 'Sugira 3 atividades pedagógicas para ' + serie + ' (' + turma + '), ' + bimestre + '.' +
      (disciplina !== 'geral' ? ' Disciplina: ' + disciplina + '.' : '') +
      (temaAtual ? ' Tema atual: ' + temaAtual + '.' : '') +
      ' Retorne JSON com array "sugestoes".';

    callNvidia(SYSTEM, [{ role: 'user', content: prompt }], function(err, text) {
      if (err) return res.status(500).json({ error: err });
      try {
        res.status(200).json(parseJSON(text));
      } catch(e) {
        res.status(200).json({ sugestoes: [] });
      }
    });
  });
};
