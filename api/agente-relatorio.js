var https = require('https');
var nvidia = require('./_nvidia');
var auth = require('./_auth');

var SYSTEM = `Você é o Assistente de Relatórios Pedagógicos do DIÁRIO PRO. Gera relatórios anuais narrativos, individualizados e ricos para cada aluno, no padrão exigido pela educação básica brasileira.

REGRAS:
- Responda SOMENTE com JSON válido
- Formato: {"alunos": [{"nome": "...", "relatorio": "..."}]}
- Cada "relatorio" deve ter 2-3 parágrafos por aluno
- Cubra: desenvolvimento acadêmico, participação, pontos de crescimento, recomendações
- Tom: formal, positivo e construtivo — adequado para pais e coordenação
- Use o nome completo do aluno
- Varie o texto entre os alunos — evite padrões repetitivos
- Baseie-se APENAS nos dados fornecidos`;

function callNvidia(system, messages, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);
  var m = [{ role: 'system', content: system }].concat(messages);
  var payload = { model: 'meta/llama-3.3-70b-instruct', messages: m, max_tokens: 2000, temperature: 0.7, stream: false };
  nvidia.callNvidia(KEY, payload, 45000, 3, callback);
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
    var ano = b.ano || new Date().getFullYear();
    var alunos = b.alunos || [];

    if (!alunos.length) {
      return res.status(400).json({ error: 'Nenhum aluno informado' });
    }

    var alunosParaGerar = alunos.slice(0, 5);

    var alunosTexto = alunosParaGerar.map(function(a) {
      var media = a.notas && a.notas.length
        ? (a.notas.reduce(function(s, n) { return s + n; }, 0) / a.notas.length).toFixed(1)
        : 'sem dados';
      var presenca = a.totalAulas
        ? (((a.totalAulas - (a.faltas || 0)) / a.totalAulas) * 100).toFixed(0) + '%'
        : 'não informada';
      return a.nome + ' | Média: ' + media + ' | Presença: ' + presenca;
    }).join('\n');

    var prompt = 'Gere relatórios pedagógicos anuais (' + ano + ') para os seguintes alunos da turma "' + turma + '":\n\n' +
      alunosTexto + '\n\nRetorne JSON com array "alunos" contendo nome e relatorio para cada um.';

    callNvidia(SYSTEM, [{ role: 'user', content: prompt }], function(err, text) {
      if (err) return res.status(500).json({ error: err });
      try {
        res.status(200).json(parseJSON(text));
      } catch(e) {
        res.status(200).json({ alunos: [] });
      }
    });
  });
};
