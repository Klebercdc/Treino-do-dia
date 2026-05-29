# PRD — KRONIA V5
## Sistema Adaptativo de Performance com Inteligência Contextual

**Versão:** 5.0  
**Status:** Fundacional  
**Data:** 2026-05-28

---

## 1. VISÃO DO PRODUTO

KroniA é um sistema adaptativo de performance que aprende continuamente como cada indivíduo responde ao estímulo e ajusta protocolos de treino, nutrição e recuperação de forma automática.

O objetivo do sistema não é apenas gerar protocolos.

O objetivo é maximizar adaptação individual ao longo do tempo.

**O diferencial central não é a tecnologia. É o dado acumulado.**

Cada treino registrado, cada adaptação aceita ou recusada, cada resposta de recuperação — torna o sistema mais preciso para aquele indivíduo específico. Esse acúmulo não é replicável.

---

## 2. MISSÃO

Permitir que qualquer pessoa — iniciante ou avançada — receba protocolos adaptativos que evoluem continuamente conforme novos dados aparecem.

Sem que o usuário precise entender como.

---

## 3. O PROBLEMA

Pessoas normalmente possuem:

- treino separado de dieta
- recuperação ignorada
- exames desconectados da performance
- protocolos que não mudam com o corpo

O problema não é informação.

O problema é falta de integração — e ausência de adaptação.

Nenhum sistema existente conecta os quatro domínios e ajusta protocolos automaticamente com base na resposta individual de cada pessoa.

---

## 4. POSICIONAMENTO

KroniA **NÃO É**:

- aplicativo de treino
- chatbot fitness
- gerador de dieta
- assistente universal

KroniA **É**:

- sistema adaptativo de performance
- motor de decisão contextual
- plataforma que aprende com cada indivíduo

---

## 5. FILOSOFIA CENTRAL

**Performance é o núcleo.**

```
Treino gera estímulo.
Nutrição sustenta estímulo.
Recuperação regula adaptação.
Biomarcadores refinam precisão.
KRONOS supervisiona.
```

Esta hierarquia é imutável.

Toda decisão de produto, de feature, de interface deve respeitar esta ordem.

### Princípios operacionais

**Complexidade interna. Simplicidade externa.**

Toda a inteligência permanece nas engines.

O usuário não vê estados internos, scores ou algoritmos.

O usuário percebe: treino atualizado, dieta ajustada, progresso detectado, adaptações aplicadas.

*Regra de interface:* Nunca exibir "ACCUMULATING_FATIGUE". Exibir: "Semana que vem começa mais leve."

---

**O sistema funciona sem exames.**

Biomarcadores aumentam precisão. Nunca desbloqueiam funcionalidade.

O usuário deve poder completar a jornada completa sem nunca enviar um exame.

---

**O produto não depende de conversa.**

Usuário pode registrar treino, receber adaptação e receber dieta sem abrir o chat.

KRONOS entra quando necessário. Silêncio do sistema significa que está funcionando.

---

**Agência do usuário é dado de qualidade.**

Quando o usuário recusa uma adaptação, está ensinando o sistema.

Quando o usuário fornece contexto ("semana ruim", "viagem", "lesão"), o sistema aprende o que não é mensurável automaticamente.

Override não é falha. É sinal.

---

**O sistema melhora com o tempo para cada pessoa.**

Semana 1: o sistema usa padrões populacionais como ponto de partida.

Semana 12: o sistema conhece a resposta específica daquele indivíduo ao estímulo.

Semana 52: esse nível de precisão não existe em nenhum outro lugar.

---

**Inferência sobre coleta.**

O sistema deriva dados de comportamento antes de pedir que o usuário os forneça.

RPE alto e performance caindo inferem fadiga — sem perguntar sobre sono.  
Tempo entre sessões e carga acumulada estimam recuperação — sem formulários.  
Aceitação ou recusa de adaptações confirma se o protocolo funciona — sem surveys.

Coleta explícita ocorre apenas quando a inferência é insuficiente para uma decisão de alto risco.

*Regra de engenharia:* se um dado pode ser derivado do comportamento normal de uso, não criar campo de input para ele.

---

**Espaço de estados delimitado.**

Alta personalização não significa complexidade crescente.

As engines operam dentro de um espaço de estados fixo e explícito:

- Training Load: 4 estados
- Recovery: 3 estados
- Progress: 4 estados
- Adaptation: 5 estados

A personalização ocorre na calibração dos thresholds individuais dentro desses estados — não na multiplicação dos estados.

Novos estados só entram com decisão explícita de produto. Exceções e casos especiais não são adicionados silenciosamente.

*Razão:* um sistema com estados fixos e thresholds individuais é testável, previsível e mantível. Um sistema cujos estados crescem conforme surgem exceções torna-se ingerenciável.

---

## 6. DIFERENCIAL COMPETITIVO

O diferencial não é o algoritmo.

O diferencial é o dado acumulado por pessoa ao longo do tempo.

Qualquer concorrente pode replicar as engines.

Nenhum concorrente pode replicar 6 meses de histórico individual de resposta ao treino, padrão de recuperação, aceitação de adaptações e correlação com biomarcadores.

**Esse dado cria um fosso que cresce com o uso.**

Quanto mais tempo um usuário permanece, mais preciso o sistema fica para ele.

Quanto mais preciso, maior o custo percebido de sair.

Isso é retenção estrutural — não de feature, mas de dado.

---

## 7. CORE ARCHITECTURE

O sistema é um **loop contínuo**, não um pipeline linear.

```
EXECUÇÃO DO USUÁRIO
        ↓
     INPUTS
        ↓
TRAINING LOAD ENGINE
        ↓
 RECOVERY ENGINE
        ↓
 PROGRESS ENGINE
        ↓
ADAPTATION ENGINE
        ↓
LAB MODIFIER (opcional)
        ↓
 DECISION LAYER
        ↓
   KRONOS AI
        ↓
    OUTPUTS
        ↓
EXECUÇÃO DO USUÁRIO  ← o ciclo reinicia
```

Cada ciclo alimenta o próximo.

Cada adaptação aceita ou recusada pelo usuário retorna como dado de qualidade para o próximo ciclo.

O sistema não executa uma vez. Ele aprende continuamente.

---

## 8. INPUTS

O sistema utiliza dois tipos de input:

**Estruturais** (coletados no onboarding):

- perfil (idade, sexo, peso, altura)
- objetivo
- nível de experiência
- frequência disponível
- restrições e patologias

**Comportamentais** (coletados continuamente):

- treinos registrados (exercícios, carga, reps, RPE)
- aderência alimentar
- contexto declarado pelo usuário ("semana ruim", "viagem")
- aceitação ou recusa de adaptações
- biomarcadores opcionais (exames)

**Semana 1:** sistema opera com inputs estruturais + padrões populacionais.

**Semana 4+:** inputs comportamentais dominam. O sistema opera com dados reais daquele indivíduo.

### Hierarquia de inputs

Nem todos os inputs têm o mesmo custo de coleta. O sistema foi projetado para funcionar com o que o usuário já produz naturalmente.

**Tier 1 — Produzidos no uso normal** (nenhuma ação adicional do usuário)

- RPE por série (coletado durante registro de treino)
- Carga e volume registrados
- Tempo entre sessões
- Aceitação ou recusa de adaptações

O sistema funciona com Tier 1 apenas. Engines operam. Adaptações ocorrem.

---

**Tier 2 — Opcionais de baixa fricção** (1 toque, quando o usuário quiser)

- Contexto declarado ("semana ruim", "viagem", "lesão leve")
- Override ou prioridade declarada

Aumentam precisão das engines. Nunca exigidos.

---

**Tier 3 — Enriquecimento avançado** (Fase 3, Ultra tier)

- Biomarcadores via exame laboratorial
- Entrada estruturada de marcadores específicos

Ativam o Lab Modifier. Aumentam precisão clínica individual.

---

**Regra absoluta:** o sistema nunca bloqueia nem degrada experiência por ausência de Tier 2 ou Tier 3.

---

## 9. TRAINING LOAD ENGINE

**Objetivo:** determinar o estresse produzido pelo treino.

**Responsável por:**

- volume semanal por grupo muscular
- intensidade (% 1RM estimado via RPE)
- frequência e densidade
- cumulative load (janela de 4 semanas)
- muscle stress individual

**Cold start:** semanas 1–3, o sistema usa MEV/MRV baseados em nível declarado (iniciante / intermediário / avançado) e frequência. A partir de dados reais, substitui os padrões populacionais progressivamente.

**Output:**

| Estado | Critério |
|---|---|
| `LOW` | Volume abaixo de 60% do MEV individual |
| `MODERATE` | Entre MEV e 80% do MAV |
| `HIGH` | Entre 80% do MAV e MRV |
| `VERY_HIGH` | Acima do MRV ou razão AC:CC > 1.5 |

---

## 10. RECOVERY ENGINE

**Objetivo:** estimar a capacidade atual de recuperação.

**O que mede:**

- Recovery Global — capacidade sistêmica de recuperação
- Recovery Local — por grupo muscular

**Modelo de inferência comportamental**

A Recovery Engine não depende de auto-relatos. Infere recuperação a partir de comportamento observável.

**Inputs Tier 1 — sempre disponíveis, sem ação do usuário:**

- RPE médio das últimas sessões vs baseline pessoal do usuário
- Variação de performance (carga e reps vs ciclos anteriores)
- Tempo decorrido desde última sessão por grupo muscular
- Output do Training Load Engine (carga acumulada)

Esses quatro inputs são suficientes para a engine operar.

**Inputs Tier 2 — opcionais, aumentam precisão:**

- Contexto declarado pelo usuário (1 toque)
- Aderência alimentar aproximada (inferida da dieta ativa quando não declarada)

**Inputs Tier 3 — Fase 3, precisão clínica:**

- Biomarcadores via Lab Modifier (ferritina, hemoglobina, cortisol)

**Cold start:** semanas 1–4, sistema estima recuperação com base em padrões de fadiga por nível declarado e frequência. Substitui progressivamente por dados comportamentais reais.

**Limitação explícita:** sem dados de sono ou HRV, recuperação é inferida de comportamento, não medida diretamente. O sistema opera de forma conservadora quando inferência é insuficiente — prefere subestimar capacidade a sobrecarregar.

**Output:**

| Estado | Critério |
|---|---|
| `LOW` | Alta fadiga acumulada ou déficit nutricional significativo |
| `MODERATE` | Recuperação parcial — volume reduzido tolerado |
| `HIGH` | Capacidade completa disponível |

---

## 11. PROGRESS ENGINE

**Objetivo:** detectar evolução real.

**Responsável por:**

- PR Detection — nova carga máxima por exercício
- Performance Trend — direção da evolução (janela 30/60 dias)
- Stagnation Detection — ausência de progressão ≥ 3 semanas em exercício prioritário
- Progression Rate — velocidade de progressão vs esperado para perfil

**Cold start:** PR detection ativa desde a 2ª sessão do mesmo exercício. Trend e stagnation requerem ≥ 4 semanas de dados.

**Output:**

| Estado | Critério |
|---|---|
| `IMPROVING` | Progressão consistente nas últimas 4 semanas |
| `STABLE` | Manutenção sem regressão |
| `DECLINING` | Queda de performance vs baseline pessoal |
| `PLATEAU` | Ausência de progressão ≥ 3 semanas com treino consistente |

---

## 12. ADAPTATION ENGINE

**Objetivo:** responder a pergunta central do sistema.

> *"Quanto estímulo este indivíduo tolera AGORA?"*

**Recebe:**

- output do Training Load Engine
- output do Recovery Engine
- output do Progress Engine

**Lógica de cruzamento:**

| Training Load | Recovery | Progress | Output |
|---|---|---|---|
| LOW | HIGH | STABLE / DECLINING | `UNDERLOADED` |
| MODERATE | HIGH | IMPROVING | `OPTIMAL` |
| HIGH | MODERATE | STABLE | `ACCUMULATING_FATIGUE` |
| VERY_HIGH | LOW | STABLE / DECLINING | `OVERREACHED` |
| MODERATE / HIGH | MODERATE | PLATEAU | `PLATEAU_PATTERN` |

**Cold start:** semanas 1–6, outputs conservadores. O sistema prefere subestimar capacidade a sobrecarregar. Progride para outputs baseados em dados individuais conforme histórico acumula.

**Limites de personalização**

A Adaptation Engine personaliza dentro de um espaço delimitado.

O protocolo individual nunca desvia além de:

| Variável | Desvio máximo do baseline populacional |
|---|---|
| Volume semanal por grupo | ± 40% do volume de referência para o perfil |
| Frequência semanal | ± 1 sessão da frequência declarada |
| Taxa de progressão de carga | ± 15% da progressão esperada para nível e objetivo |

Esses limites existem por duas razões:

1. **Segurança:** protocolos fora desse espaço não têm validação suficiente para aplicação automática
2. **Testabilidade:** o comportamento do sistema permanece previsível e verificável

Quando um usuário genuinamente requer protocolo fora desses limites, o sistema entra em modo conservador e KRONOS sinaliza a situação.

**Output e ação associada:**

| Estado | Significado | Consequência no Decision Layer |
|---|---|---|
| `UNDERLOADED` | Estímulo insuficiente | Aumenta volume ou intensidade |
| `OPTIMAL` | Balanço ideal | Mantém protocolo com progressão planejada |
| `ACCUMULATING_FATIGUE` | Fadiga acumulando | Reduz volume, monitora |
| `OVERREACHED` | Além da capacidade | Deload obrigatório |
| `PLATEAU_PATTERN` | Estímulo sem resposta | Muda variável de treino |

---

## 13. LAB MODIFIER

Opcional. Funciona em silêncio.

**Função:** modificar a precisão da Recovery Engine com dados bioquímicos.

Não controla o sistema. Refina o que já existe.

**Fluxo:**

```
Biomarcador processado
        ↓
Modifier calculado (fator 0.5 – 1.2)
        ↓
Aplicado sobre Recovery Engine
        ↓
Adaptation Engine recalcula com Recovery modificado
```

### Escopo delimitado de biomarcadores

O Lab Modifier opera sobre um conjunto fixo de **15 marcadores** de alta relevância para performance.

Não tenta interpretar exames completos. Fora desse conjunto, marcadores são registrados mas não influenciam as engines nesta versão.

| Marcador | Impacto nas engines |
|---|---|
| Ferritina | Recovery Local (membros inferiores) |
| Hemoglobina | Recovery Global |
| Hematócrito | Recovery Global + flag de segurança |
| Testosterona total | Taxa de progressão esperada |
| Testosterona livre | Taxa de progressão + Recovery Global |
| SHBG | Modulação do modifier de testosterona |
| Cortisol | Recovery Global (estresse sistêmico) |
| TSH | Metabolismo basal — ajusta progressão esperada |
| Vitamina D | Recovery Local (força muscular) |
| Vitamina B12 | Recovery Global (energia neural) |
| Glicemia em jejum | Disponibilidade energética |
| Insulina em jejum | Sensibilidade — ajusta dieta adaptativa |
| Creatinina | Flag de sobrecarga renal em volume alto |
| TGO / TGP | Flag hepático em contexto hormonal |
| PSA (masculino) | Flag de segurança em contexto androgênico |

**Máximo de modificadores simultâneos:** 3. Se mais de 3 marcadores indicam modificação no mesmo ciclo, o sistema prioriza pelos de maior `safety_relevance`.

### Dois modos de entrada

**Modo 1 — Upload de exame (PDF/JPEG)**

OCR automático extrai valores. Sistema apresenta os valores parseados para confirmação do usuário antes de aplicar qualquer modifier.

Valor com baixa confiança de parsing → sistema pede confirmação explícita.  
Valor ausente → marcador não influencia o modifier (nunca usa default perigoso).  
Unidade não reconhecida → sistema solicita modo 2.

**Modo 2 — Entrada estruturada manual**

Usuário digita os valores específicos dos 15 marcadores diretamente.

Elimina variabilidade de OCR quando o usuário tem os valores em mãos.  
Indicado para laboratórios com formatos não reconhecidos automaticamente.

### Gestão de incerteza

O sistema não aplica modifier quando não tem confiança no valor.

Incerteza é melhor do que precisão falsa.

**Transparência:** quando o Lab Modifier produz mudança visível no protocolo, KRONOS explica em linguagem do usuário. O usuário não precisa saber que existe um "modifier" — precisa entender por que seu protocolo mudou.

**Regra absoluta:** valores fora de faixa crítica de segurança nunca são normalizados, independente do contexto hormonal declarado. KRONOS redireciona para profissional. O sistema não diagnostica.

---

## 14. DECISION LAYER

**O ponto onde inteligência vira ação.**

Transforma o output da Adaptation Engine em mudanças reais no protocolo.

### Ações possíveis

- Ajustar volume de grupo muscular específico
- Ajustar intensidade mantendo volume
- Alterar frequência semanal
- Inserir semana de deload
- Trocar exercício por variação com estímulo diferente
- Rebalancear macros (proteína, carboidrato)
- Ajustar tempo de recuperação entre sessões

### Classificação das decisões

**Pequena — automática**

Critério: mudança ≤ 10% em uma variável.

Aplicada sem confirmação. Usuário recebe notificação breve.

Exemplos:
- Volume de quadríceps: 10 → 11 séries semanais
- Tempo de descanso: 90s → 120s
- Troca de variação de exercício (rosca direta → rosca martelo)

---

**Grande — confirmada**

Critério: mudança > 10% em uma variável, ou múltiplas variáveis simultâneas.

Apresentada ao usuário. Aguarda confirmação. Explicada pelo KRONOS.

Exemplos:
- Volume de membros inferiores reduzido em 30%
- Adição de sessão de recuperação ativa
- Rebalanceamento significativo de macros

---

**Crítica — sugestão apenas**

Critério: mudança de protocolo completo, flag clínico do Lab Modifier, overreaching detectado.

Apresentada como recomendação. Usuário decide quando e se aplica.

Exemplos:
- Semana de deload completa
- Mudança de divisão de treino (PPL → Upper/Lower)
- Marcador clínico que merece atenção médica

---

### Frequência máxima de intervenção

O sistema não adapta continuamente sem limite.

**Pequenas:** podem ocorrer a cada ciclo semanal.

**Grandes:** máximo uma por ciclo de 2 semanas.

**Críticas:** sem frequência mínima — ocorrem quando necessário.

**Razão:** adaptação biológica leva semanas. Mudar o protocolo toda semana impede que o usuário avalie se a mudança funcionou. O sistema respeita o tempo de adaptação do corpo.

---

### O que o sistema NÃO faz

- Não adapta sem dados suficientes (aguarda o próximo ciclo)
- Não aplica mudança grande enquanto houver mudança grande pendente de confirmação
- Não ignora override do usuário sem registrá-lo como dado

---

## 15. KRONOS AI

KRONOS não é o produto.

KRONOS é a camada que torna o produto compreensível.

**KRONOS NÃO É:**

- chatbot aberto
- assistente universal
- interface principal do produto

**KRONOS É:**

- supervisor do ecossistema
- interpretador de decisões das engines
- camada conversacional quando o usuário precisa de contexto

### Quando KRONOS fala

**Proativamente:**

| Gatilho | O que diz |
|---|---|
| Mudança grande aplicada | Explica o que mudou e por quê |
| Estado OVERREACHED detectado | "Você acumulou fadiga. Recomendo uma semana mais leve." |
| PLATEAU_PATTERN por 2 ciclos | "Seu agachamento está estagnado. Vamos mudar o estímulo." |
| PR detectado | "Novo recorde. Continua assim." |
| Lab Modifier ativo e produz mudança | "Seus exames influenciaram o protocolo desta semana." |
| 4 semanas de consistência | "4 semanas seguidas. Esse é o caminho." |

**Em resposta:**

Qualquer pergunta dentro do domínio (treino, nutrição, recuperação, exames, adaptação).

**Quando não fala:**

Estado OPTIMAL sem mudança significativa.

Silêncio é sinal de que o sistema está funcionando.

### Regra de ouro

KRONOS fala quando tem algo relevante a dizer.

Não preenche silêncio. Não gera engajamento artificial.

---

## 16. COLD START MODEL

O sistema funciona desde o primeiro dia.

A precisão aumenta com o tempo.

### Fases de calibração

**Semanas 1–2: Base populacional**

Sistema opera com padrões baseados em: nível declarado, objetivo, frequência e perfil.

O protocolo gerado é adequado para o perfil. Não é personalizado ainda.

O usuário não percebe diferença — recebe treino e dieta desde o início.

**Semanas 3–4: Calibração inicial**

Primeiros dados comportamentais disponíveis (RPE real, aderência real, resposta percebida).

Engines começam a substituir padrões populacionais por dados individuais.

Primeiras adaptações pequenas possíveis.

**Semanas 5–12: Personalização crescente**

Histórico suficiente para PR detection, stagnation detection e trend analysis.

Decision Layer opera com confiança crescente.

Mudanças grandes passam a ter base em dados individuais, não em padrões.

**Semana 12+: Precisão individual**

O sistema conhece a resposta específica daquele indivíduo ao estímulo.

Esse nível de precisão não existe em nenhum outro lugar para aquela pessoa.

### Comunicação com o usuário no cold start

O usuário não vê "modo de calibração".

O usuário vê: protocolo desde o primeiro dia, KRONOS explica que o sistema fica mais preciso com o tempo.

---

## 17. USER AGENCY

O usuário sempre tem controle.

Override não é problema. É dado de qualidade.

### Mecanismos de agência

**Recusar adaptação**

Usuário pode recusar qualquer mudança grande ou crítica.

O sistema registra a recusa. Não insiste. Usa a recusa como dado de calibração.

Após 3 recusas do mesmo tipo de adaptação, KRONOS pergunta: *"Você costuma recusar esse tipo de ajuste. O que não está funcionando?"*

---

**Sinalizar contexto**

Usuário pode declarar contexto que o sistema não consegue medir:

- "Semana ruim"
- "Viagem"
- "Não dormi bem"
- "Lesão leve"
- "Estresse alto"

Quando contexto é declarado, o sistema pausa adaptações automáticas e opera de forma conservadora até o próximo ciclo normal.

---

**Priorizar objetivo específico**

Usuário pode sinalizar foco temporário:

- "Quero priorizar peitoral essa semana"
- "Quero manter — não aumentar volume agora"

O sistema respeita o objetivo declarado enquanto ele for seguro dado o estado das engines.

---

**Override permanente**

Usuário pode desativar adaptações automáticas completamente.

Nesse modo, o sistema continua calculando internamente mas não aplica nada sem confirmação explícita.

Usuário com alto conhecimento técnico (Persona Avançada) pode preferir esse modo.

---

## 18. FAILURE MODEL

O sistema vai errar. Isso foi planejado.

### Tipos de erro

**Erro de estimativa (mais comum)**

Recovery Engine estima LOW. Usuário se sente bem.

Tratamento:
- Usuário registra treino com performance normal ou acima da esperada
- Sistema detecta discrepância entre estimativa e resultado real
- Recovery model recalibra para aquele indivíduo
- Próxima estimativa é mais precisa

---

**Erro de adaptação (menos comum)**

Decision Layer recomenda deload. Usuário ignora e performa bem.

Tratamento:
- Sistema registra que a adaptação foi recusada
- Registra o resultado do ciclo seguinte
- Se resultado foi positivo: threshold de deload recalibrado para cima para aquele indivíduo
- Se resultado foi negativo: KRONOS menciona a correlação na próxima oportunidade

---

**Erro de interpretação do KRONOS**

KRONOS explica algo de forma incorreta ou inadequada para o contexto do usuário.

Tratamento:
- Usuário pode sinalizar feedback diretamente no chat
- Feedback entra no histórico de memória
- KRONOS usa o feedback nas próximas interações

---

### Princípio do erro

O sistema não finge ser infalível.

Quando o usuário demonstra que o sistema estava errado, o sistema aprende.

Esse ciclo de correção é parte do diferencial competitivo — não um problema a esconder.

---

## 19. EXPERIÊNCIA DO USUÁRIO

### O que o usuário percebe

- Treino da semana pronto
- Adaptação aplicada com explicação breve
- Progresso detectado e celebrado
- Dieta ajustada quando necessário
- KRONOS disponível quando quiser contexto

### O que o usuário não percebe

- Estados internos das engines
- Cálculos de Recovery e Training Load
- Fatores do Lab Modifier
- Logs de decisão do Decision Layer

### Fluxo padrão (semana típica)

```
Segunda: registra treino de perna
  → Training Load atualizado
  → Recovery Local de quadríceps calculado

Quarta: registra treino de costas
  → Adaptation Engine detecta OPTIMAL

Sexta: registra treino de peito
  → Progress Engine detecta PR em supino
  → App: "Novo recorde em supino. 5kg a mais que sua melhor marca."

Domingo: sistema fecha o ciclo semanal
  → Decision Layer: volume de quadríceps +1 série (automático)
  → App: "Seu treino da próxima semana está pronto. Adicionamos mais uma série de quadríceps."
```

O usuário não abriu o chat. Recebeu protocolo, adaptação e celebração de progresso.

### Linguagem de resultado

O sistema pensa em performance.

O usuário ouve resultado.

| O sistema calcula | O usuário vê |
|---|---|
| ACCUMULATING_FATIGUE | "Semana que vem começa mais leve" |
| Recovery LOCAL LOW (quadríceps) | "Perna precisa de mais tempo esta semana" |
| PLATEAU_PATTERN (supino) | "Vamos mudar o ângulo no supino" |
| Lab Modifier ativo (ferritina) | "Seus exames pediram um ajuste na semana" |
| UNDERLOADED | "Você está abaixo do seu potencial. Vamos aumentar." |

---

## 20. PÚBLICO

### Iniciante

Quer: simplicidade, orientação, confiança de que está no caminho certo.

Experimenta: protocolo desde o primeiro dia, sem configuração complexa.

Converte quando: o sistema detecta o primeiro resultado concreto e o nomeia.

---

### Intermediário

Quer: sair do platô, personalização real, entender o que está acontecendo.

Experimenta: Adaptation Engine detecta padrão que ele já suspeitava. KRONOS nomeia.

Converte quando: KRONOS explica uma adaptação que faz sentido para o histórico dele.

---

### Avançado / Profissional

Quer: precisão, recuperação otimizada, correlação com biomarcadores.

Experimenta: Lab Modifier refinando decisões. KRONOS tratando contexto clínico sem julgamento.

Converte quando: sistema demonstra precisão que nenhum outro produto ou profissional oferece com aquele nível de integração.

---

## 21. NORTH STAR

**Usuários que receberam uma adaptação, executaram o protocolo e retornaram.**

Este é o ciclo de confiança completo:

1. Sistema entrega adaptação baseada em dados reais
2. Usuário confia o suficiente para executar
3. Usuário retorna — o que confirma que o ciclo valeu

### Como medir "executou"

Execução = sessão de treino registrada após receber adaptação.

Não é necessário 100% de aderência. Uma sessão registrada após a adaptação é sinal de retorno ao ciclo.

### Por que esse é o norte certo

Outras métricas medem uso.

Esta métrica mede confiança no sistema.

Sem confiança, o produto não funciona independente do volume de uso.

### Métricas de suporte

| Métrica | Meta 90d |
|---|---|
| Ciclo completo / MAU | > 40% |
| Tempo até primeira adaptação recebida | < 72h após primeiro treino |
| Retenção semana 4 | > 45% |
| Retenção semana 12 | > 30% |
| Adaptações executadas (aceitas + ciclo concluído) | > 65% das grandes |
| Adaptações automáticas sem recusa | > 80% das pequenas |
| Churn Pro mensal | < 8% |

---

## 22. MODELO DE NEGÓCIO

A complexidade das engines é responsabilidade do sistema.

O usuário compra resultado — não feature.

### Tiers

**FREE**

- Registro de treino
- Protocolo inicial baseado em perfil
- Training Load Engine (básico)
- PR Detection
- KRONOS: 15 interações/mês

*Objetivo do Free:* demonstrar que o sistema funciona. Não limitar a ponto de não convencer.

---

**PRO — R$ 29,90/mês**

- Pipeline completo de engines (Training Load + Recovery + Progress + Adaptation)
- Decision Layer (automático + grande com confirmação)
- Dieta adaptativa
- KRONOS ilimitado
- Dashboard de evolução

*Gatilho de conversão:* Adaptation Engine detectando padrão que o usuário reconhece como verdadeiro.

---

**ULTRA — R$ 59,90/mês** *(Fase 3)*

- Lab Modifier ativo
- Análise longitudinal de biomarcadores
- Correlação exames × performance
- Decision Layer crítico com KRONOS avançado

*Gatilho de conversão:* Lab Modifier produz insight que nenhum profissional havia correlacionado.

---

## 23. ROADMAP

### Pré-requisitos técnicos (antes de qualquer fase)

- Vercel: function count ≤ 11/12 (remover `api/agent.js`)
- Intent classifier unificado
- `kronosAgent.js` migrado para TypeScript
- Orchestrator canônico consolidado

---

### Fase 1 — Core (Semanas 1–8)

**Critério de saída:** usuário completa o ciclo North Star sem abrir o chat.

| Entrega | Done quando |
|---|---|
| Onboarding com protocolo imediato | Usuário tem protocolo em < 3 min |
| Training Load Engine V1 | Output calculado após cada sessão |
| Decision Layer: mudanças pequenas | Mudança automática + notificação breve |
| Cold start model | Semanas 1–4 funcionam com padrões populacionais |
| PR Detection + celebração | PR detectado sem input do usuário |
| KRONOS explica adaptações | Toda mudança grande tem explicação |

---

### Fase 2 — Inteligência (Semanas 9–20)

**Critério de entrada:** ciclo North Star ativo em > 30% dos usuários.

| Entrega | Done quando |
|---|---|
| Recovery Engine (Global + Local) | Output por grupo muscular após cada sessão |
| Progress Engine completo | Stagnation detection + trend ativo |
| Adaptation Engine V2 | 5 estados funcionando com base em dados reais |
| Decision Layer: grande + crítico | Fluxo de confirmação funcional |
| User Agency model | Override, contexto e recusa funcionando |
| Failure model ativo | Recusa registrada como dado, recalibração ocorrendo |
| Dashboard de evolução | Curva de progresso por exercício |

---

### Fase 3 — Precisão (Semanas 21+)

**Critério de entrada:** Adaptation Engine V2 estável por 4+ semanas.

| Entrega | Done quando |
|---|---|
| Lab Modifier integrado | Exame modifica Recovery silenciosamente |
| Análise longitudinal | Tendência de biomarcadores com ≥ 2 exames |
| KRONOS avançado | Correlação exame × performance em linguagem do usuário |
| Ultra tier ativo | Tier disponível para usuários com exames |

---

## 24. REGRA CENTRAL

Performance é o núcleo.

Treino gera estímulo.

Nutrição sustenta.

Recuperação regula.

Biomarcadores refinam.

KRONOS supervisiona.

O dado acumulado é o diferencial.

---

## 25. FRASE OFICIAL

**Externa (usuário):**

> *"KroniA aprende como você responde ao treino e adapta tudo automaticamente. Você executa. O sistema evolui com você."*

**Interna (produto):**

> *"Sistema adaptativo de performance que maximiza adaptação individual através de inteligência contextual acumulada."*
