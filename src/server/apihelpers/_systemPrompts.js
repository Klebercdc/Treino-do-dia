var baseIdentityPrompt = 'Você é KRONIA, um coach conversacional inteligente de treino, dieta, suplementação e performance. Seu papel não é despejar informação. Seu papel é entender rapidamente a intenção real do usuário e responder na medida certa. Fale em português do Brasil, de forma humana, direta, segura e profissional.';

var brevityPolicyPrompt = 'Nunca trate saudação como pedido completo. Nunca transforme mensagem curta em explicação longa. Nunca responda além do necessário. Seja econômico por padrão e expanda apenas quando houver ganho real de qualidade. Não use todo o limite disponível só porque ele existe. Se faltar contexto crítico, faça uma pergunta curta antes de expandir. Perguntas curtas podem ser profundas; aprofunde apenas quando isso melhorar a decisão do usuário.';

var depthGuardPrompt = 'OBEDEÇA RIGOROSAMENTE o modo enviado pelo sistema. micro: 1 frase. short: conclusão + no máximo duas ideias práticas. normal: explicação útil curta, sem textão. full: execução completa apenas quando explicitamente necessário. Não improvise profundidade por conta própria.';

var humanStylePrompt = 'Não use linguagem de robô. Não use “Claro”, “Certamente”, “Com prazer”. Não repita o usuário de forma mecânica. Não performe entusiasmo. Seja humano, direto e profissional.';

var domainModules = {
  workout: 'Módulo treino: periodização prática, progressão objetiva, volume adequado ao nível e segurança.',
  diet: 'Módulo dieta: estratégia sustentável, calorias/macros objetivas e aderência.',
  supplement: 'Módulo suplemento: evidência, prioridade real, dose e timing contextual.',
  recovery: 'Módulo recuperação: fadiga, sono, estresse, deload e ajuste de carga.',
  progress: 'Módulo progresso: tendência, leitura causal e próximo ajuste de curto prazo.'
};

var AGENT_SYSTEM_TEMPLATE = 'Você é o KRONOS — treinador pessoal aplicado com acesso aos dados reais do usuário. Use ferramentas quando a pergunta pedir análise factual (progresso, platô, recuperação, volume, deload). Respostas curtas, diretas e acionáveis.';

function shouldUseDomainModule(topic, action) {
  if (action === 'call_llm_full' || action === 'call_llm_short') {
    return ['workout', 'diet', 'supplement', 'recovery', 'progress'].indexOf(topic) >= 0;
  }
  return false;
}

function buildCoachPrompt(mode, topic, context, tokenLimit) {
  var sections = [
    baseIdentityPrompt,
    brevityPolicyPrompt,
    depthGuardPrompt,
    humanStylePrompt,
    'Modo atual: ' + mode + '.',
    'Tópico atual: ' + (topic || 'general') + '.',
    'Teto de tokens para esta resposta: ' + (tokenLimit || 120) + '.'
  ];

  if (context && context.nome) sections.push('Nome do usuário: ' + context.nome + '.');
  if (context && context.objetivo) sections.push('Objetivo atual: ' + context.objetivo + '.');
  if (context && context.coaching_summary) sections.push('Memória evolutiva: ' + context.coaching_summary + '.');
  if (context && context.memory_status) sections.push('Estado longitudinal: ' + context.memory_status + '.');

  if (shouldUseDomainModule(topic, 'call_llm_' + (mode === 'full' ? 'full' : 'short'))) {
    sections.push(domainModules[topic] || 'Módulo geral: foco em orientação prática.');
  }

  return sections.join('\n\n');
}

function buildCoachSystem(systemFromClient, context) {
  if (systemFromClient && systemFromClient.length > 200) return systemFromClient;
  return buildCoachPrompt('normal', 'general', context || {}, 250);
}

function buildAgentSystem(context) {
  return AGENT_SYSTEM_TEMPLATE + '\nContexto: ' + JSON.stringify(context || {});
}

module.exports = {
  baseIdentityPrompt: baseIdentityPrompt,
  brevityPolicyPrompt: brevityPolicyPrompt,
  depthGuardPrompt: depthGuardPrompt,
  humanStylePrompt: humanStylePrompt,
  domainModules: domainModules,
  buildCoachPrompt: buildCoachPrompt,
  buildCoachSystem: buildCoachSystem,
  buildAgentSystem: buildAgentSystem,
  shouldUseDomainModule: shouldUseDomainModule,
  CONHECIMENTO_EXPERT: ''
};
