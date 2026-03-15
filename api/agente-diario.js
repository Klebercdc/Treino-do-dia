var https = require('https');
var nvidia = require('./_nvidia');
var auth = require('./_auth');

var SYSTEM = `Você é o Assistente Pedagógico do DIÁRIO PRO. Sua função é ajudar professores a redigir registros de diário pedagógico claros, ricos e reflexivos.

REGRAS:
- Responda SOMENTE com JSON válido, sem texto antes ou depois
- Formato: {"titulo": "...", "conteudo": "..."}
- O conteúdo deve ter 3-5 parágrafos
- Tom: profissional, reflexivo, pedagógico
- Use linguagem da educação brasileira
- Inclua: o que foi feito, como a turma reagiu, observações individuais relevantes, próximos passos
- NUNCA invente dados específicos de alunos que não foram fornecidos
- Baseie-se APENAS nos dados recebidos no contexto`;

function callNvidia(system, messages, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);
  var m = [{ role: 'system', content: system }].concat(messages);
  var payload = { model: 'meta/llama-3.3-70b-instruct', messages: m, max_tokens: 800, temperature: 0.7, stream: false };
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
    var turma = b.turma || 'Turma';
    var data = b.data || new Date().toLocaleDateString('pt-BR');
    var atividades = b.atividades || [];
    var observacoes = b.observacoes || '';

    var prompt = 'Gere um registro de diário pedagógico para o dia ' + data + ', turma "' + turma + '".' +
      (atividades.length ? ' Atividades realizadas: ' + atividades.join(', ') + '.' : '') +
      (observacoes ? ' Observações do professor: ' + observacoes + '.' : '') +
      ' Retorne apenas JSON com titulo e conteudo.';

    callNvidia(SYSTEM, [{ role: 'user', content: prompt }], function(err, text) {
      if (err) return res.status(500).json({ error: err });
      try {
        var result = parseJSON(text);
        res.status(200).json(result);
      } catch(e) {
        res.status(200).json({ titulo: 'Registro do dia ' + data, conteudo: text });
      }
    });
  });
};
