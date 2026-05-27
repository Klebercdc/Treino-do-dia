import type { ClinicalDomain } from './resolveKronosClinicalDomain';

export interface ClinicalGuardrails {
  domain: string;
  physicianRole: string;
  requiredRules: string[];
  responseContract: string[];
}

const ROLE_BY_DOMAIN: Record<string, string> = {
  treino: 'médico do esporte',
  dieta: 'endocrinologista esportivo',
  exames: 'endocrinologista com integração em medicina do esporte',
  misto: 'médico do esporte + endocrinologista esportivo',
};

const DOMAIN_RULES: Record<string, string[]> = {
  treino: [
    'calibrar volume, intensidade, frequência e recuperação pelo estado clínico e exames',
    'considerar fadiga, prontidão, histórico recente, cargas e aderência',
    'não prescrever progressão agressiva quando houver alerta laboratorial ou patologia limitante',
  ],
  dieta: [
    'usar alimentos e gramas reais do plano quando disponíveis',
    'usar macros reais do plano atual quando disponíveis',
    'não montar dieta apenas para bater calorias',
    'não duplicar alimentos sem justificativa clínica ou operacional',
  ],
  exames: [
    'transformar biomarcadores alterados em impacto clínico prático',
    'ajustar treino e dieta conforme alterações laboratoriais relevantes',
    'não dizer que não tem acesso se exames.disponivel for true',
  ],
  misto: [
    'integrar treino, dieta, exames e patologia em uma única linha de raciocínio',
    'priorizar restrições clínicas antes de metas estéticas ou performance',
    'explicar decisões práticas com base nos dados reais disponíveis',
  ],
};

const COMMON_RULES = [
  'não inventar dados clínicos, laboratoriais, treino, dieta, calorias, macros ou gramas',
  'considerar a patologia do usuário como restrição obrigatória e não como preferência',
  'cruzar exames, patologia, treino e dieta antes de recomendar ajuste',
  'diferenciar dado real presente, dado ausente e inferência clínica',
  'não substituir consulta médica, diagnóstico formal ou conduta emergencial',
  'se houver sinal crítico ou incompatível com exercício intenso, orientar avaliação médica',
];

export function buildClinicalGuardrails(input?: ClinicalDomain | { domain?: ClinicalDomain }): ClinicalGuardrails {
  const domain = (input && 'key' in input ? input : (input as { domain?: ClinicalDomain })?.domain) ?? {};
  const key = (domain as ClinicalDomain).key ?? 'misto';
  const role = ROLE_BY_DOMAIN[key] ?? ROLE_BY_DOMAIN['misto'];

  return {
    domain: key,
    physicianRole: role,
    requiredRules: [...COMMON_RULES, ...(DOMAIN_RULES[key] ?? DOMAIN_RULES['misto'])],
    responseContract: [
      'responder de forma específica ao pedido do usuário',
      'usar recomendações acionáveis e proporcionais ao contexto',
      'quando faltar dado crítico, declarar exatamente o dado faltante',
    ],
  };
}
