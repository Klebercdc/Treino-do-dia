# PRD — KroniA V4
## Plataforma Adaptativa de Treino, Nutrição e Recuperação com Inteligência Contextual

**Versão:** 4.0  
**Status:** Fundacional  
**Data:** 2026-05-28

---

## 1. VISÃO E MISSÃO

### 1.1 Visão

KroniA é uma plataforma mobile-first que transforma dados do usuário em protocolos individualizados que evoluem continuamente.

Quatro domínios integrados. Um sistema de inteligência unificado.

| Domínio | Função |
|---|---|
| Treino | Gera estímulo |
| Dieta | Sustenta estímulo |
| Recuperação | Controla adaptação |
| Exames | Refinam precisão (opcional) |

### 1.2 Missão

Permitir que qualquer pessoa — iniciante ou avançada — receba protocolos personalizados capazes de evoluir conforme novos dados são adicionados.

### 1.3 KRONOS AI — O Diferencial Central

KRONOS não é um chatbot.

KRONOS é um supervisor. Ele observa tudo que acontece dentro do ecossistema KroniA, processa os outputs das engines e transforma dados em decisões compreensíveis.

KRONOS entra quando necessário. O produto funciona sem ele.

### 1.4 Frase Oficial

> *"KroniA utiliza KRONOS AI para conectar treino, nutrição, recuperação e biomarcadores opcionais, adaptando protocolos automaticamente conforme novos dados são adicionados."*

---

## 2. FILOSOFIA CENTRAL

### 2.1 Os Cinco Pilares

```
Treino gera estímulo.
Dieta sustenta estímulo.
Recuperação controla adaptação.
Exames refinam precisão.
KRONOS supervisiona.
```

Esta hierarquia é imutável. Toda decisão de produto deve respeitar esta ordem.

### 2.2 Complexidade Interna

Toda a inteligência permanece nas engines.

O usuário não vê:
- scores numéricos internos
- estados das engines
- algoritmos de cálculo
- logs de decisão

O usuário percebe:
- treino atualizado
- dieta ajustada
- progresso detectado
- adaptações aplicadas
- KRONOS explicando quando necessário

**Implicação de produto:** Nenhuma tela pode expor um dado interno sem transformá-lo em linguagem de resultado. Nunca mostrar "Adaptation State: ACCUMULATING_FATIGUE". Mostrar: "Seu volume está alto. Semana que vem começa mais leve."

### 2.3 Funciona Sem Exames

Exames não são prerequisito de nenhuma funcionalidade.

Exames aumentam precisão. Nunca a desbloqueiam.

**Implicação de produto:** O usuário deve poder completar a jornada completa (treino → dieta → adaptação → progresso) sem nunca enviar um exame. Quando exames existem, o sistema os usa silenciosamente para refinar as engines.

### 2.4 Produto Não Depende de Conversa

O usuário pode:
- registrar treino
- receber protocolo adaptado
- receber dieta atualizada

sem abrir o chat com KRONOS.

KRONOS entra quando:
- uma decisão significativa precisa ser explicada
- o usuário pergunta
- um padrão clínico ou de treino merece atenção proativa

**Implicação de produto:** A inteligência é passiva. Ela trabalha nos bastidores. O chat é a camada de interpretação, não o produto em si.

---

## 3. PÚBLICO-ALVO

### 3.1 Segmentação

Três segmentos. Um produto. Experiências diferenciadas pela profundidade dos dados, não por features bloqueadas.

---

**INICIANTE**

Perfil:
- 18–30 anos, 0–12 meses de treino
- Objetivo: começar certo, não se perder, ver resultado
- Maior medo: estar perdendo tempo na academia sem progredir
- Budget: sensível ao preço

O que precisa do produto:
- Treino pronto para seguir hoje
- Confirmação de que está no caminho certo
- Simplicidade — não quer aprender jargão

O que vê na KroniA:
- "Seu treino desta semana"
- "Você evoluiu no agachamento"
- "Ajustamos sua dieta para seu objetivo"

O que não sabe que existe:
- Training Load Engine calculando estresse muscular
- Recovery Engine estimando recuperação global
- Adaptation Engine escolhendo o volume certo para o nível dele

Conversão trigger: primeiro sinal de progresso concreto detectado pelo sistema (peso novo em exercício, consistência de 3 semanas).  
Churn risk: alto se não sentir resultado nos primeiros 30 dias.

---

**INTERMEDIÁRIO**

Perfil:
- 22–38 anos, 1–4 anos de treino
- Objetivo: sair do platô, personalizar, entender o que está acontecendo
- Já tentou planilhas, apps de log, treinos do YouTube
- Sabe que o que fazia antes parou de funcionar

O que precisa do produto:
- Detecção de platô e recomendação de mudança
- Adaptação baseada em recuperação real, não em calendário fixo
- Acesso a algum nível de "porquê" das decisões

O que vê na KroniA:
- Progresso por grupo muscular
- "KRONOS detectou platô em peitoral. Ajustamos o volume e o ângulo de ataque."
- Dieta adaptada após semana de treino intenso

Conversão trigger: KRONOS explica uma adaptação que faz sentido para o histórico dele — algo que ele já suspeitava mas não sabia nomear.  
Churn risk: médio. Sai se sentir que o sistema não está "olhando" para os dados dele.

---

**AVANÇADO / PROFISSIONAL**

Perfil:
- 26–50 anos, 4+ anos de treino
- Objetivo: precisão, recuperação otimizada, refinamento contínuo
- Pode usar protocolos hormonais (TRT, uso assistido)
- Faz exames regularmente

O que precisa do produto:
- Integração de biomarcadores com decisões de treino e dieta
- Análise longitudinal de exames com contexto esportivo
- Detecção precoce de overreaching
- Controle granular sem paternalismo

O que vê na KroniA:
- Recuperação local por grupo muscular
- "Sua ferritina caiu. Adicionamos mais tempo de recuperação para membros inferiores essa semana."
- Tendência de biomarcadores correlacionada com performance

Conversão trigger: Lab Modifier refina uma decisão de treino com base em um exame — correlação que nenhum outro produto faz.  
Churn risk: muito baixo se o produto tratar o contexto clínico sem julgamento e com precisão.

---

### 3.2 Princípio de Onboarding

O nível de detalhe que o usuário vê escala com os dados que ele fornece.

| Dados fornecidos | Precisão do sistema |
|---|---|
| Objetivo + frequência | Protocolo baseado em populações similares |
| + histórico de treino (2+ semanas) | Protocolo personalizado ao histórico real |
| + aderência alimentar | Dieta adaptada ao comportamento real |
| + exames laboratoriais | Precisão clínica individual |

Cada camada adicional aumenta precisão. Nenhuma é obrigatória para começar.

---

## 4. ARQUITETURA DE PRODUTO

### 4.1 Pipeline Central

```
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
```

Cada engine recebe os outputs da anterior. O resultado é sempre incremental — cada camada adiciona informação, nunca a substitui.

---

### 4.2 Training Load Engine

**Responsabilidade:** calcular o estresse produzido pelo treino.

**Inputs:**
- volume semanal por grupo muscular
- intensidade (% 1RM estimado)
- densidade (volume / tempo)
- RPE por série
- frequência semanal
- cumulative load (últimas 4 semanas)
- muscle stress individual

**Processamento:**
- Calcular volume efetivo por músculo (séries × reps × RPE ajustado)
- Comparar com MEV/MRV histórico individual
- Calcular fadiga muscular local (curva de recuperação por grupo)
- Detectar picos agudos vs carga crônica (razão AC:CC)

**Output:**

| Estado | Critério |
|---|---|
| `LOW` | Volume abaixo de 60% do MEV individual |
| `MODERATE` | Volume entre MEV e 80% MAV |
| `HIGH` | Volume entre 80% MAV e MRV |
| `VERY_HIGH` | Volume acima do MRV ou pico AC:CC > 1.5 |

---

### 4.3 Recovery Engine

**Responsabilidade:** estimar a capacidade atual de recuperação.

**Inputs:**
- output do Training Load Engine
- aderência alimentar (calorias e proteínas vs meta)
- qualidade percebida do descanso (se fornecida)
- RPE médio das últimas sessões vs baseline
- tempo desde última sessão por músculo
- exames opcionais (ferritina, cortisol, testosterona, hemoglobina)

**Dois níveis de recuperação:**

**Global Recovery** — capacidade sistêmica de se recuperar  
(afeta decisões de volume total semanal e frequência)

**Local Recovery** — recuperação por grupo muscular  
(afeta quais músculos podem ser treinados e com qual intensidade)

**Output:**

| Estado | Critério |
|---|---|
| `LOW` | Recuperação comprometida — alta fadiga acumulada ou déficit nutricional |
| `MODERATE` | Recuperação parcial — capaz de treinar com volume reduzido |
| `HIGH` | Recuperação completa — capacidade máxima disponível |

Quando Lab Modifier está ativo, marcadores como ferritina baixa ou hematócrito elevado modificam o output de Recovery sem sobrescrever o cálculo base.

---

### 4.4 Progress Engine

**Responsabilidade:** entender a evolução do usuário.

**Inputs:**
- histórico de cargas por exercício (últimas 12 semanas)
- frequência de treino vs protocolo prescrito
- RPE médio por sessão ao longo do tempo
- variações de peso corporal (se fornecidas)

**Funções:**

| Função | O que detecta |
|---|---|
| PR Detection | Nova carga máxima em exercício |
| Performance Trend | Direção da evolução nos últimos 30/60 dias |
| Stagnation Detection | Ausência de progressão por ≥3 semanas em exercício prioritário |
| Progression Analysis | Taxa de progressão vs esperado para perfil e nível |

**Output:**

| Estado | Critério |
|---|---|
| `IMPROVING` | Progressão consistente nas últimas 4 semanas |
| `STABLE` | Manutenção de performance sem regressão |
| `DECLINING` | Queda de performance vs baseline pessoal |
| `PLATEAU` | Ausência de progressão por ≥3 semanas apesar de treino consistente |

---

### 4.5 Adaptation Engine

**Responsabilidade:** determinar a tolerância atual ao estímulo e o que fazer com ela.

**Este é o cérebro do sistema.**

**Inputs:**
- output do Training Load Engine
- output do Recovery Engine
- output do Progress Engine

**Lógica central:**

A Adaptation Engine cruza os três estados para determinar onde o usuário está no espectro de adaptação.

| Training Load | Recovery | Progress | Output |
|---|---|---|---|
| LOW | HIGH | STABLE/DECLINING | `UNDERLOADED` |
| MODERATE | HIGH | IMPROVING | `OPTIMAL` |
| HIGH | MODERATE | STABLE | `ACCUMULATING_FATIGUE` |
| VERY_HIGH | LOW | STABLE/DECLINING | `OVERREACHED` |
| MODERATE/HIGH | MODERATE | PLATEAU | `PLATEAU_PATTERN` |

**Outputs e Implicações:**

| Estado | O que significa | O que o sistema faz |
|---|---|---|
| `UNDERLOADED` | Estímulo insuficiente para adaptação | Aumenta volume ou intensidade |
| `OPTIMAL` | Balanço ideal estímulo-recuperação | Mantém protocolo com progressão planejada |
| `ACCUMULATING_FATIGUE` | Fadiga se acumulando — adaptação em risco | Reduz volume, mantém intensidade, monitora |
| `OVERREACHED` | Além da capacidade de recuperação | Insere deload obrigatório |
| `PLATEAU_PATTERN` | Estímulo não está mais produzindo resposta | Muda variável de treino (volume, ângulo, frequência) |

---

### 4.6 Lab Modifier (Opcional)

**Responsabilidade:** aumentar a precisão das engines com dados bioquímicos.

**Não controla.** Modifica.

**Fluxo:**

```
Biomarcador analisado
  ↓
Modifier calculado (fator 0.5 – 1.2)
  ↓
Aplicado sobre Recovery Engine
  ↓
Adaptation Engine recalcula com Recovery modificado
```

**Exemplos de modificação:**

| Biomarcador | Condição | Modificação |
|---|---|---|
| Ferritina | < 30 ng/mL | Recovery Local membros inferiores reduzido |
| Hemoglobina | < 12 g/dL | Global Recovery reduzido — endurance afetada |
| Cortisol | Elevado cronicamente | Global Recovery reduzido — recuperação sistêmica comprometida |
| Testosterona livre | Baixa para perfil | Modifier de anabolismo — progressão esperada ajustada |
| Hematócrito | > 52% (contexto hormonal) | Flag clínico — KRONOS notifica, não bloqueia |

**Regra absoluta:** nenhum marcador individual substitui a decisão das engines. O Lab Modifier adiciona precisão. O sistema funciona sem ele.

---

### 4.7 Decision Layer

**Responsabilidade:** transformar os outputs das engines em ações concretas.

**Ações possíveis:**
- Reduzir volume de grupo muscular específico
- Aumentar intensidade mantendo volume
- Inserir semana de deload
- Alterar frequência semanal
- Rebalancear macros (proteína, carboidrato)
- Trocar exercício por variação com estímulo diferente
- Mudar ordem de prioridade muscular no protocolo

**Classificação das decisões:**

| Tipo | Critério | Aprovação |
|---|---|---|
| **Pequena** | < 10% de mudança em uma variável | Automática — aplicada sem confirmação |
| **Grande** | > 10% de mudança ou múltiplas variáveis | Confirmada — KRONOS apresenta e espera aceite |
| **Crítica** | Deload completo, mudança de protocolo, flag clínico | Sugestão apenas — usuário decide |

**Exemplos:**

Pequena (automática):
> Volume de quadríceps aumentado de 10 para 11 séries semanais.

Grande (confirmada):
> "Detectamos fadiga acumulada em membros inferiores. Sugerimos reduzir o volume de perna de 18 para 12 séries esta semana e aumentar proteína para 2.2g/kg. Confirmar?"

Crítica (sugestão):
> "KRONOS identificou padrão de overreaching. Recomendamos uma semana de deload. Você decide quando começar."

---

### 4.8 KRONOS AI

**O que KRONOS não é:**
- chatbot aberto
- concorrente do ChatGPT
- assistente universal

**O que KRONOS é:**
- supervisor de todo o sistema
- coach que explica decisões das engines
- intérprete de dados para linguagem do usuário
- camada conversacional quando o usuário precisa de contexto

**Funções:**

| Função | Quando ativa |
|---|---|
| Explicar decisão | Sempre que uma mudança significativa é feita |
| Correlacionar dados | Quando padrão cruzado é detectado (treino + exame, dieta + recuperação) |
| Responder perguntas | Quando o usuário abre o chat |
| Adaptar protocolos | Quando usuário pede ajuste específico |
| Notificar padrão crítico | Quando engines detectam estado preocupante |

**Regra de ouro:**  
KRONOS fala quando tem algo relevante a dizer. Não preenche silêncio.

---

## 5. OUTPUTS DO SISTEMA

O que o usuário recebe:

| Output | Como aparece |
|---|---|
| Treino da semana | Protocolo atualizado, pronto para executar |
| Dieta ajustada | Plano alimentar com macros revisados |
| Adaptação aplicada | Notificação breve do que mudou e por quê |
| Progresso detectado | Celebração contextual (PR, consistência, evolução) |
| Explicação do KRONOS | Quando mudança é grande ou crítica |
| Alerta clínico | Quando biomarcador merece atenção (nunca diagnóstico) |

O que o usuário não vê:

- Estados internos das engines (`ACCUMULATING_FATIGUE`, `OVERREACHED`)
- Scores numéricos de recuperação (70/100)
- Fatores de modificação de biomarcadores
- Logs de decisão do Decision Layer

---

## 6. REQUISITOS FUNCIONAIS

### Fase 1 — Core (Semanas 1–8)

**Objetivo:** produto funciona do início ao fim para um usuário sem exames.

**RF-01 — Onboarding com Protocolo Imediato**
- Usuário responde 5 perguntas (objetivo, nível, frequência, restrições, tempo disponível)
- Sistema gera protocolo de treino + dieta inicial
- Critério: usuário tem protocolo em < 3 minutos após cadastro

**RF-02 — Training Load Engine (V1)**
- Calcula volume semanal por grupo muscular
- Compara com MEV/MRV do perfil
- Output: LOW / MODERATE / HIGH / VERY_HIGH por grupo
- Critério: calcula após cada sessão registrada

**RF-03 — Protocolo de Treino Adaptativo**
- Treino gerado e atualizado automaticamente com base no Training Load
- Não depende de conversa com KRONOS
- Critério: protocolo atualizado semanalmente sem input do usuário

**RF-04 — Dieta Adaptativa Básica**
- Dieta ajustada conforme objetivo e dados de treino
- Rebalanceia proteína/carboidrato conforme carga semanal
- Critério: dieta atualizada quando Training Load muda de tier

**RF-05 — Decision Layer (Mudanças Pequenas)**
- Pequenas adaptações aplicadas automaticamente
- Usuário notificado de forma resumida
- Critério: mudança pequena aplicada e notificada sem confirmação

**RF-06 — KRONOS Básico**
- Responde perguntas sobre treino e dieta do usuário
- Explica mudanças aplicadas pelo Decision Layer
- Critério: contexto das engines injetado em toda resposta

**RF-07 — PR Detection e Celebração**
- Detecta novo recorde pessoal em exercício
- Contextualiza com histórico ("5kg a mais que o melhor anterior")
- Critério: detecção automática, sem o usuário precisar reportar

---

### Fase 2 — Inteligência (Semanas 9–20)

**Objetivo:** sistema completo de adaptação ativo. Produto diferenciado.

**RF-08 — Recovery Engine (Global + Local)**
- Estima recuperação sistêmica e por grupo muscular
- Integra aderência alimentar e padrão de treino
- Critério: output atualizado após cada sessão e a cada dia sem treino

**RF-09 — Progress Engine**
- Detecta tendência de evolução (IMPROVING / STABLE / DECLINING / PLATEAU)
- Stagnation detection após 3 semanas sem progressão
- Critério: output atualizado semanalmente com janela de 4 semanas

**RF-10 — Adaptation Engine**
- Cruza Training Load + Recovery + Progress
- Determina estado de adaptação (5 estados)
- Critério: output atualizado após cada sessão; sem acesso direto do usuário ao estado interno

**RF-11 — Decision Layer Completo**
- Mudanças grandes apresentadas com confirmação
- Mudanças críticas como sugestão
- KRONOS explica todas as mudanças grandes e críticas
- Critério: fluxo de confirmação funcional; KRONOS gera explicação automaticamente

**RF-12 — Dashboard de Progresso**
- Visualização de evolução por exercício e grupo muscular
- Tendência das últimas 4/8/12 semanas
- Critério: dados disponíveis para qualquer exercício com ≥ 3 registros

---

### Fase 3 — Precisão (Semanas 21+)

**Objetivo:** biomarcadores integrados. Máxima individualização.

**RF-13 — Lab Modifier**
- Upload e OCR de exames laboratoriais
- Parsing automático de biomarcadores
- Modifier calculado e aplicado sobre Recovery Engine
- Critério: exame processado em < 15s; modifier ativo silenciosamente

**RF-14 — Análise Longitudinal de Exames**
- Comparação entre exames: marcador melhorou / piorou / estável / persistente
- Correlação com períodos de treino e dieta
- Critério: disponível quando ≥ 2 exames registrados

**RF-15 — KRONOS Avançado**
- Explica correlação entre biomarcadores e performance
- Trata contexto hormonal (natural / TRT / uso assistido) sem julgamento
- Nunca diagnostica — sempre redireciona para profissional em valores críticos
- Critério: `lab_flag` e `context_flag` distintos na análise

---

## 7. NORTH STAR METRIC

### 7.1 Definição

> **Usuários que registraram treino, receberam uma adaptação e retornaram.**

Este é o ciclo de valor completo da KroniA:
1. Usuário contribui dados (treino)
2. Sistema retorna inteligência (adaptação)
3. Usuário confia no ciclo e volta

Se um usuário completa este ciclo, ele entendeu o produto. Se ele repete, ele está retido.

### 7.2 Como Medir

```sql
-- Usuários que completaram o ciclo no mês
WITH ciclo AS (
  SELECT DISTINCT w.user_id
  FROM workout_history w
  JOIN adaptation_events a ON a.user_id = w.user_id
    AND a.created_at > w.trained_at
    AND a.created_at < w.trained_at + INTERVAL '7 days'
  JOIN workout_history w2 ON w2.user_id = w.user_id
    AND w2.trained_at > a.created_at
  WHERE w.trained_at > NOW() - INTERVAL '30 days'
)
SELECT COUNT(*) AS north_star_users FROM ciclo;
```

### 7.3 Métricas de Suporte

| Métrica | Definição | Meta 90d |
|---|---|---|
| Ciclo completo / MAU | % de usuários ativos que completaram o ciclo | > 40% |
| Tempo até primeira adaptação | Minutos entre primeiro treino e primeira mudança automática | < 72h |
| Retenção semana 4 | Usuários ativos na semana 4 após cadastro | > 45% |
| Retenção semana 12 | Usuários ativos na semana 12 | > 30% |
| PR / usuário / mês | PRs detectados por usuário ativo | ≥ 1 |
| Adaptações sem conversa | % de adaptações aplicadas sem o usuário abrir o chat | > 70% |
| Churn Pro (mensal) | Usuários Pro que cancelaram | < 8% |

---

## 8. REQUISITOS NÃO-FUNCIONAIS

### 8.1 Performance

| Operação | P95 máximo |
|---|---|
| Cálculo das engines após sessão registrada | < 3s |
| Geração de protocolo de treino | < 5s |
| Geração de dieta | < 8s |
| Resposta KRONOS no chat | < 3s |
| OCR de exame | < 15s |
| Registro offline de treino | 0ms (local first) |

### 8.2 Experiência Sem Conexão

Funciona offline:
- Registro de treino completo
- Timer de descanso
- Acesso ao protocolo da semana (cached)
- Histórico recente (cached)

Requer conexão:
- KRONOS chat
- Geração de novo protocolo
- Processamento de exame

### 8.3 Segurança e Privacidade

- RLS Supabase ativo em todas as tabelas
- Contexto hormonal e dados de exames: nunca em logs de texto plano
- Dados de exames: imagem original descartada pós-OCR
- LGPD: export completo e delete completo implementados
- Lógica clínica e de IA: TypeScript strict, zero `any`

### 8.4 Confiabilidade

- Engines calculam silenciosamente — falha não bloqueia o app
- Se KRONOS não responder: mensagem de erro clara, nunca 500 silencioso
- Adaptações não aplicadas automaticamente em caso de dados insuficientes — aguarda próximo ciclo

---

## 9. EXPERIÊNCIA DO USUÁRIO

### 9.1 Princípios

**Complexidade é responsabilidade do produto, não do usuário.**  
O usuário toma decisões. O sistema faz os cálculos.

**O produto age. KRONOS explica.**  
O Decision Layer aplica mudanças. KRONOS conta o que foi feito e por quê.

**Progresso é visível. Algoritmo é invisível.**  
O usuário vê "você evoluiu". Não vê "Progress Engine output: IMPROVING".

**Silêncio é conforto.**  
Quando tudo está no estado OPTIMAL, o produto não envia notificação. Silêncio significa que está funcionando.

### 9.2 Fluxo Padrão do Usuário (Semana Típica)

```
Segunda: Abre app → vê treino de perna da semana → treina → registra
  Sistema: Training Load atualizado → Recovery local de quad calculado

Quarta: Abre app → vê treino de costas → treina → registra
  Sistema: Adaptation Engine detecta OPTIMAL

Sexta: Abre app → vê treino de peito → treina → registra
  Sistema: Progress Engine detecta PR em supino
  App: "Novo recorde em supino: 80kg × 6. 5kg a mais que sua melhor marca."

Domingo: Sistema detecta semana completa → gera protocolo da próxima semana
  Decision Layer: volume de quad aumenta 1 série (mudança pequena, automática)
  App: "Seu treino da próxima semana está pronto. Adicionamos mais uma série de quadríceps."
```

O usuário não abriu o chat. Recebeu protocolo, adaptação e celebração de progresso.

### 9.3 Quando KRONOS Fala Proativamente

| Situação | O que KRONOS diz |
|---|---|
| Adaptation: OVERREACHED | "Você acumulou muita fadiga. Recomendo uma semana mais leve. Quando quer começar?" |
| Adaptation: PLATEAU_PATTERN | "Seu agachamento está estagnado há 3 semanas. Sugiro mudar o ângulo de ataque." |
| Progress: PR detectado | "Novo recorde pessoal. Continua assim." |
| Lab: ferritina baixa | "Seus exames mostram ferritina baixa. Ajustamos o volume de perna por enquanto." |
| Semana de consistência (4 semanas seguidas) | "4 semanas de consistência. Esse é o caminho." |

### 9.4 Design da Notificação

Regras:
- Uma notificação por evento
- Linguagem direta — máximo 2 frases
- Sem jargão técnico nas notificações ao usuário
- Ação clara quando necessária

---

## 10. MAPEAMENTO TÉCNICO

### 10.1 O Que Existe Hoje → Engines V4

| Engine V4 | Equivalente atual | Status |
|---|---|---|
| Training Load Engine | Cálculos de MEV/MAV/MRV + RPE tracking | Parcial — sem output unificado |
| Recovery Engine | `fadiga_scores`, `alertas_kronos` | Básico — sem local recovery |
| Progress Engine | PR detection mencionado, sem engine formal | Não existe formalmente |
| Adaptation Engine | Lógica distribuída no orchestrator | Não existe como engine unificada |
| Lab Modifier | `lab_report_biomarkers`, `context_flag` | Existe — bem estruturado |
| Decision Layer | KRONOS decide via chat | Não existe como camada autônoma |
| KRONOS AI | Chat completo com 10 intenções | Existe — precisa ser repositionado |

### 10.2 Gaps Críticos a Construir

**Para Fase 1:**
- Adaptation Engine V1 (Training Load → output unificado)
- Decision Layer (pequenas mudanças automáticas)
- Onboarding guiado com protocolo imediato
- Sistema de notificação de adaptações

**Para Fase 2:**
- Recovery Engine (Global + Local por músculo)
- Progress Engine (stagnation detection, trend analysis)
- Adaptation Engine V2 (cruza todas as engines)
- Decision Layer completo (grande/crítico com confirmação)

**Para Fase 3:**
- Lab Modifier integrado formalmente nas engines
- Análise longitudinal de exames na interface

### 10.3 Restrições Técnicas

| Restrição | Impacto | Ação |
|---|---|---|
| Vercel Hobby: 12/12 functions | Blocker para novos endpoints | Remover `api/agent.js` como P0 antes de qualquer Fase 1 |
| `kronosAgent.js` sem TypeScript | Risco em lógica clínica | Migrar para `.ts` antes de Fase 2 |
| Orchestrators paralelos | Comportamento inconsistente | Consolidar antes de Fase 2 |
| Intent classifiers paralelos | Routing inconsistente | Consolidar antes de Fase 1 |

Novos componentes das engines:
- Toda lógica de engine → `src/core/engines/`
- Adaptation Engine → `src/core/engines/adaptationEngine.ts`
- Recovery Engine → `src/core/engines/recoveryEngine.ts`
- Progress Engine → `src/core/engines/progressEngine.ts`
- Decision Layer → `src/core/engines/decisionLayer.ts`
- Lab Modifier → `src/core/engines/labModifier.ts`

---

## 11. ROADMAP

### Fase 1 — Core (Semanas 1–8)

**Critério de entrada:** Vercel < 12/12, intent classifier unificado, KRONOS em TypeScript.

| Entrega | Semana | Done quando |
|---|---|---|
| Onboarding com protocolo imediato | 1–2 | Usuário tem treino em < 3 min após cadastro |
| Training Load Engine V1 | 2–3 | Output LOW/MODERATE/HIGH/VERY_HIGH calculado após sessão |
| Decision Layer (pequenas mudanças) | 3–4 | Mudança pequena aplicada e notificada automaticamente |
| Dieta adaptativa básica | 4–5 | Dieta ajustada quando Training Load muda de tier |
| PR Detection + celebração | 5–6 | PR detectado sem input do usuário |
| KRONOS explica adaptações | 6–7 | Toda mudança do Decision Layer tem explicação do KRONOS |
| Testes E2E + ajustes | 7–8 | Zero regressão, North Star mensurável |

**Critério de saída da Fase 1:**  
Usuário entra, recebe protocolo, treina, recebe adaptação, retorna. Ciclo completo sem abrir o chat.

---

### Fase 2 — Inteligência (Semanas 9–20)

**Critério de entrada:** ciclo North Star funcionando em pelo menos 30% dos usuários ativos.

| Entrega | Semana | Done quando |
|---|---|---|
| Recovery Engine (Global) | 9–11 | Output de recuperação global calculado diariamente |
| Recovery Engine (Local) | 11–13 | Recuperação por grupo muscular calculada após sessão |
| Progress Engine | 13–15 | Stagnation detection ativa; trend calculado semanalmente |
| Adaptation Engine V2 | 15–17 | 5 estados funcionando; Decision Layer recebe input completo |
| Decision Layer completo | 17–18 | Grandes e críticas com fluxo de confirmação |
| Dashboard de progresso | 18–20 | Evolução por exercício disponível com ≥ 3 registros |

**Critério de saída da Fase 2:**  
North Star > 40% dos usuários ativos. Churn Pro < 10%.

---

### Fase 3 — Precisão (Semanas 21+)

**Critério de entrada:** Adaptation Engine V2 estável por 4+ semanas em produção.

| Entrega | Semana | Done quando |
|---|---|---|
| Lab Modifier integrado nas engines | 21–24 | Exame modifica Recovery silenciosamente |
| Análise longitudinal de exames | 24–26 | Tendência de biomarcadores visível com ≥ 2 exames |
| KRONOS avançado (correlação biomarcador + treino) | 26–28 | KRONOS explica correlação em linguagem do usuário |

---

## 12. TESTES E VALIDAÇÃO

### 12.1 Critérios de Done por Feature

- [ ] TypeScript strict — zero `any` em código de engine ou clínico
- [ ] Teste unitário para cada engine (inputs → outputs corretos)
- [ ] Teste de integração: pipeline completo com dados mockados
- [ ] Teste E2E: usuário registra treino → adaptação aplicada → notificação correta
- [ ] RLS: usuário A não afeta dados de B
- [ ] Degradação graciosa: engine falha → protocolo anterior mantido, sem crash
- [ ] Offline: registro funciona; adapatação aguarda reconexão

### 12.2 Casos de Teste Críticos para as Engines

| # | Cenário | Output esperado |
|---|---|---|
| 1 | Usuário treina 6x/semana por 3 semanas sem deload | Adaptation: OVERREACHED → Decision sugere deload |
| 2 | Volume de quadríceps abaixo do MEV por 2 semanas | Adaptation: UNDERLOADED → Decision aumenta volume automaticamente |
| 3 | Mesmo peso em supino por 4 semanas | Progress: PLATEAU → KRONOS sugere variação |
| 4 | Ferritina 25 ng/mL no exame | Lab Modifier aplica → Recovery Local membros inferiores reduzido |
| 5 | Usuário sem exame | Sistema funciona normalmente sem Lab Modifier |
| 6 | Usuário sem conversa por 30 dias | Protocolo atualizado sem chat; KRONOS não força conversa |
| 7 | Mudança crítica (deload) | Sugestão apresentada, não aplicada automaticamente |
| 8 | Mudança pequena (+ 1 série) | Aplicada automaticamente, notificação breve |
| 9 | Hematócrito 53% em contexto hormonal | Flag clínico no KRONOS — sem bloqueio de funcionalidade |
| 10 | Aderência alimentar < 70% por 2 semanas | Recovery Global reduzido → Adaptation recalcula |

---

## 13. DEPENDÊNCIAS E RISCOS

### 13.1 Dependências Técnicas

| Dependência | Criticidade | Ação se falhar |
|---|---|---|
| Groq API (KRONOS) | Alta | Fallback para modelo menor; mensagem clara ao usuário |
| Supabase (banco + storage) | Crítica | Não há fallback — monitorar uptime e uso |
| Vercel (deploy) | Crítica | Manter function count ≤ 10/12 com margem |
| Google Gemini (OCR) | Média | Groq Vision como fallback |

### 13.2 Riscos de Produto

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Adaptation Engine com outputs errados = protocolo incorreto | Média | Testes exaustivos antes de Fase 2; limite de mudança automática |
| Usuário rejeita adaptações automáticas | Baixa | Transparência na notificação; override sempre disponível |
| Competidor global lança equivalente em PT-BR | Média | Profundidade clínica (Lab Modifier, contexto hormonal) não replicada rapidamente |
| Custo de IA escala com base de usuários | Baixa (agora) | Engines rodam localmente; IA só ativa no KRONOS chat e geração |

### 13.3 Riscos Clínicos

| Risco | Mitigação |
|---|---|
| Engine gera recomendação perigosa (overload severo) | Decision Layer tem limites máximos hardcoded; mudanças > 30% sempre críticas |
| KRONOS normaliza marcador clínico crítico | Regra absoluta: valores fora de faixa de segurança → redirecionamento, nunca normalização |
| Contexto hormonal exposto em logs | Dado tratado como PII; nunca em logs de infra |

---

## 14. PERGUNTAS ABERTAS

| Pergunta | Responsável | Prazo |
|---|---|---|
| Qual o critério exato de "mudança pequena vs grande" para o Decision Layer? | Kleber (produto) | Antes da Fase 1 |
| Usuário pode desativar adaptações automáticas? | Kleber (produto) | Antes da Fase 1 |
| Qual a fonte de dados para "aderência alimentar" sem o usuário logar tudo? | Kleber (produto) | Fase 1 |
| Recovery Engine: descanso/sono entra como input? Se sim, como é coletado? | Kleber (produto) | Fase 2 |
| Ultra tier (R$59,90): acesso às Fases 2 e 3? Ou Pro já inclui tudo? | Kleber (negócio) | Antes da Fase 2 |
| Dashboard de progresso: é visual (gráfico) ou textual? | Kleber (design) | Fase 2 |
| Override manual do usuário salva como dado ou reseta o ciclo? | Kleber (produto) | Fase 1 |

---

## 15. HISTÓRICO E APROVAÇÕES

| Data | Versão | Autor | Alteração |
|---|---|---|---|
| 2026-05-28 | 4.0 | Kleber / Claude Code | Criação — PRD V4 fundacional com arquitetura de engines |

---

## 16. AUTOMAÇÃO DE SINCRONIZAÇÃO

### 16.1 Arquivos Estruturais Monitorados

```
src/core/engines/
src/ai/orchestrator.ts
src/ai/systemPrompt.ts
src/ai/contextBuilder.ts
src/app/api/kronia/
supabase/migrations/
vercel.json
```

### 16.2 Seções Sensíveis a Mudanças

| Arquivo/Diretório alterado | Seções a revisar | O que verificar |
|---|---|---|
| `src/core/engines/` | 4, 6, 10.1 | Lógica das engines, inputs/outputs, estados |
| `src/ai/orchestrator.ts` | 4.8, 6, 8.1 | Fluxo KRONOS, integração com engines |
| `src/ai/systemPrompt.ts` | 4.8, 9.3 | Comportamento KRONOS, quando fala |
| `supabase/migrations/` | 10.2, 8.3 | Novas tabelas para engines, RLS |
| `src/app/api/kronia/` | 6, 8.1 | Novos endpoints de engines |
| `vercel.json` | 10.3 | Function count |

### 16.3 Entrada de Registry (para `.claude/prd-registry.json`)

```json
"docs/prd/kronia-v4-platform.md": [
  "src/core/engines/",
  "src/ai/orchestrator.ts",
  "src/ai/systemPrompt.ts",
  "src/ai/contextBuilder.ts",
  "src/app/api/kronia/",
  "supabase/migrations/",
  "vercel.json"
]
```
