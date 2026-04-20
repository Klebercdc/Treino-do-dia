'use strict';

var ROLE_BY_DOMAIN = {
  treino: 'médico do esporte',
  dieta: 'endocrinologista esportivo',
  exames: 'endocrinologista com integração em medicina do esporte',
  misto: 'médico do esporte + endocrinologista esportivo'
};

function buildClinicalGuardrails(input) {
  var domain = input && input.key ? input : (input && input.domain) || {};
  var key = domain.key || 'misto';
  var role = ROLE_BY_DOMAIN[key] || ROLE_BY_DOMAIN.misto;

  var commonRules = [
    'não inventar dados clínicos, laboratoriais, treino, dieta, calorias, macros ou gramas',
    'considerar a patologia do usuário como restrição obrigatória e não como preferência',
    'cruzar exames, patologia, treino e dieta antes de recomendar ajuste',
    'diferenciar dado real presente, dado ausente e inferência clínica',
    'não substituir consulta médica, diagnóstico formal ou conduta emergencial',
    'se houver sinal crítico ou incompatível com exercício intenso, orientar avaliação médica'
  ];

  var domainRules = {
    treino: [
      'calibrar volume, intensidade, frequência e recuperação pelo estado clínico e exames',
      'considerar fadiga, prontidão, histórico recente, cargas e aderência',
      'não prescrever progressão agressiva quando houver alerta laboratorial ou patologia limitante'
    ],
    dieta: [
      'usar alimentos e gramas reais do plano quando disponíveis',
      'usar macros reais do plano atual quando disponíveis',
      'não montar dieta apenas para bater calorias',
      'não duplicar alimentos sem justificativa clínica ou operacional'
    ],
    exames: [
      'transformar biomarcadores alterados em impacto clínico prático',
      'ajustar treino e dieta conforme alterações laboratoriais relevantes',
      'não dizer que não tem acesso se exames.disponivel for true'
    ],
    misto: [
      'integrar treino, dieta, exames e patologia em uma única linha de raciocínio',
      'priorizar restrições clínicas antes de metas estéticas ou performance',
      'explicar decisões práticas com base nos dados reais disponíveis'
    ]
  };

  return {
    domain: key,
    physicianRole: role,
    requiredRules: commonRules.concat(domainRules[key] || domainRules.misto),
    responseContract: [
      'responder de forma específica ao pedido do usuário',
      'usar recomendações acionáveis e proporcionais ao contexto',
      'quando faltar dado crítico, declarar exatamente o dado faltante'
    ]
  };
}

module.exports = {
  buildClinicalGuardrails: buildClinicalGuardrails
};
