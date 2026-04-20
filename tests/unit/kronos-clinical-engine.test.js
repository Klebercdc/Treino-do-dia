'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var domainResolver = require('../../src/ai/kronos/resolveKronosClinicalDomain');
var guardrailsBuilder = require('../../src/ai/kronos/buildClinicalGuardrails');
var examInterpreter = require('../../src/ai/kronos/interpretarExames');
var promptBuilder = require('../../src/ai/kronos/buildKronosSystemPrompt');

test('resolveKronosClinicalDomain detects integrated clinical domain', function () {
  var domain = domainResolver.resolveKronosClinicalDomain({
    topic: 'diet',
    intent: 'nutrition_planning',
    message: 'ajuste minha dieta com base nos exames e no treino'
  });

  assert.equal(domain.key, 'misto');
  assert.match(domain.physicianRole, /endocrinologia esportiva|endocrinologista/i);
});

test('interpretarExames returns structured alerts and clinical impact only', function () {
  var result = examInterpreter.interpretarExames({
    disponivel: true,
    dataUltimaColeta: '2026-04-01',
    biomarcadores: [
      { nome: 'Glicose', valor: 112, unidade: 'mg/dL', referencia: '70 - 99', status: 'alto' },
      { nome: 'HDL', valor: 55, unidade: 'mg/dL', referencia: '> 40', status: 'normal' }
    ],
    observacoes: ['alteração metabólica']
  }, {
    patologias: ['diabetes tipo 2']
  });

  assert.equal(result.disponivel, true);
  assert.equal(result.alertas.length, 1);
  assert.equal(result.impactoClinicoPorBiomarcador.length, 1);
  assert.match(result.impactoClinicoPorBiomarcador[0].impactoClinico, /controle glicêmico/i);
  assert.equal(result.resumoClinico.totalBiomarcadoresDisponiveis, 2);
});

test('buildKronosSystemPrompt includes pathology, evidence and guardrails', function () {
  var domain = domainResolver.resolveKronosClinicalDomain({ message: 'treino com exame alterado' });
  var guardrails = guardrailsBuilder.buildClinicalGuardrails(domain);
  var prompt = promptBuilder.buildKronosSystemPrompt({
    user: { patologia: 'hipertensão' },
    contextoClinico: { patologias: ['hipertensão'] },
    treino: { disponivel: true },
    dieta: { disponivel: true },
    exames: { disponivel: true },
    clinicalDomain: domain,
    clinicalEvidenceContext: { evidenceAvailable: true, topics: ['treino'], sources: [{ title: 'Diretriz clínica' }] },
    clinicalGuardrails: guardrails
  }, 'mixed_context', { topic: 'workout', clinicalDomain: domain, clinicalGuardrails: guardrails });

  assert.match(prompt, /PATOLOGIA OBRIGATÓRIA DO USUÁRIO: hipertensão/);
  assert.match(prompt, /Sempre cruze exames \+ patologia \+ treino \+ dieta/);
  assert.match(prompt, /CONTEXTO DE EVIDÊNCIA CLÍNICA/);
});

test('askKronos preserves raw exam biomarkers and uses user pathology in exam interpretation', async function () {
  var service = require('../../src/ai/kronos/askKronos');
  var llmPayload = null;

  await service.askKronos({
    message: 'analise meus exames',
    kronosContext: {
      user: { patologia: 'diabetes tipo 2' },
      contextoClinico: { patologias: [] },
      treino: { disponivel: false },
      dieta: { disponivel: false },
      exames: {
        disponivel: true,
        dataUltimaColeta: '2026-04-01',
        biomarcadores: [
          { nome: 'Glicose', valor: 112, unidade: 'mg/dL', status: 'alto' },
          { nome: 'HDL', valor: 55, unidade: 'mg/dL', status: 'normal' }
        ]
      }
    },
    callLLM: async function (payload) {
      llmPayload = payload;
      return 'ok';
    }
  });

  assert.equal(llmPayload.appContext.exames.biomarcadores.length, 2);
  assert.equal(llmPayload.appContext.exames.alertas.length, 1);
  assert.deepEqual(llmPayload.appContext.exames.resumoClinico.patologiasConsideradas, ['diabetes tipo 2']);
  assert.match(llmPayload.systemPrompt, /"biomarcadores"/);
});
