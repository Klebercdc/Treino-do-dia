var https = require('https');
var nvidia = require('./_nvidia');

var SYSTEM = `Você é o Assistente de Análise de Turma do DIÁRIO PRO. Analisa o desempenho coletivo de turmas escolares e gera insights acionáveis para o professor.

REGRAS:
- Responda SOMENTE com JSON válido
- Formato: {"resumo": "...", "alertas": ["...", "..."], "destaques": ["...", "..."], "acoes": ["...", "..."]}
- "resumo": visão geral da turma (2-3 frases)
- "alertas": até 3 pontos que precisam de atenção imediata
- "destaques": até 3 pontos positivos da turma
- "acoes": até 3 ações concretas recomendadas para o professor
- Tom: direto, prático, focado em melhorias
- Baseie-se apenas nos dados recebidos`;

function callNvidia(system, messages, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);
  var m = [{ role: 'system', content: system }].concat(messages);
  var payload = { model: 'meta/llama-3.3-70b-instruct', messages: m, max_tokens: 500, temperature: 0.6, stream: false };
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  var b = req.body || {};
  var turma = b.turma || 'Turma';
  var totalAlunos = b.totalAlunos || 0;
  var mediaGeral = b.mediaGeral || 0;
  var presencaMedia = b.presencaMedia || 0;
  var alunosEmRisco = b.alunosEmRisco || 0;
  var totalAtividades = b.totalAtividades || 0;

  var prompt = 'Analise a turma "' + turma + '" com ' + totalAlunos + ' alunos.' +
    ' Média geral: ' + mediaGeral + '.' +
    ' Presença média: ' + presencaMedia + '%.' +
    ' Alunos em risco (média < 6): ' + alunosEmRisco + '.' +
    ' Total de atividades realizadas: ' + totalAtividades + '.' +
    ' Retorne JSON com resumo, alertas, destaques e acoes.';

  callNvidia(SYSTEM, [{ role: 'user', content: prompt }], function(err, text) {
    if (err) return res.status(500).json({ error: err });
    try {
      res.status(200).json(parseJSON(text));
    } catch(e) {
      res.status(200).json({ resumo: text, alertas: [], destaques: [], acoes: [] });
    }
  });
};
