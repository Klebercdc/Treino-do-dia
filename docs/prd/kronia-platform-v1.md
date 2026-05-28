# PRD: KroniA — Plataforma de Saúde e Performance com IA
**Versão:** 1.0 — Documento Fundacional  
**Data:** 2026-05-28  
**Status:** Ativo

---

## 1. Resumo Executivo

KroniA é a plataforma brasileira de saúde e performance que une periodização científica, IA conversacional clínica e análise de biomarcadores em um único produto mobile-first. O diferencial central é o **KRONOS** — coach de IA que responde exclusivamente com base nos dados reais do usuário (histórico de treino, exames laboratoriais, perfil clínico completo), nunca com conselhos genéricos.

O produto está em produção com modelo freemium ativo (Free / Pro R$29,90 / Ultra R$59,90) e serve um mercado de 40M+ praticantes de musculação no Brasil. É o único produto PT-BR que combina: periodização científica (MEV/MAV/MRV), análise de exames com contexto esportivo (incluindo TRT e uso assistido), e geração de treino e dieta personalizada com IA — tudo offline-first via PWA.

**Bloqueios críticos ativos:**
- Vercel Hobby em 12/12 functions — nenhum endpoint novo sem remover um existente
- Dívida P1: 2 orchestrators paralelos, 4 intent classifiers, `kronosAgent.js` sem TypeScript

**Dependências críticas:** Groq API (IA core), Supabase (banco e storage), Vercel (deploy).

---

## 2. Contexto e Motivação

### 2.1 O Problema

O praticante de musculação brasileiro enfrenta três barreiras simultâneas:

**Barreira de acesso ao conhecimento:**  
Periodização científica real — calcular MEV/MAV/MRV, interpretar fadiga acumulada, ajustar volume por grupo muscular — exige personal trainer (R$100–300/sessão) ou anos de auto-estudo. A maioria treina por intuição e estagna.

**Barreira de fragmentação de dados:**  
Treino fica em planilha ou app de registro, nutrição em app separado, exames em PDF esquecido no celular. Ninguém correlaciona os três. Um hematócrito elevado que afeta performance nunca é conectado ao treino daquele mês.

**Barreira da IA genérica:**  
ChatGPT e Gemini respondem sobre treino sem saber o histórico do usuário, sem entender MEV/MAV/MRV, sem contexto de exames, em inglês, tratando todos como iniciantes. Cada nova conversa começa do zero.

### 2.2 Por Que Agora

- Brasil: 2º maior mercado fitness do mundo, 40M+ praticantes de musculação (ACAD 2023)
- 97M usuários de smartphones, penetração de 82%
- Custo de LLMs caiu ~90% em 2 anos — viabilizou produto freemium com margem real
- PWA elimina fricção de distribuição (sem App Store, instalação em 2 toques)
- Janela de oportunidade: antes de players globais construírem profundidade clínica em PT-BR

### 2.3 Custo de Inação

- Cada mês com blocker técnico (Vercel 12/12) = features de produto congeladas
- Cada mês sem PRD fundacional = decisões tomadas sem contexto = regressões ao tocar features adjacentes
- Churn silencioso: usuários Pro sem progresso percebido cancelam sem feedback

---

## 3. Objetivos e Métricas de Sucesso

| Objetivo | Métrica | Baseline (estimado) | Meta 30d | Meta 90d |
|---|---|---|---|---|
| Retenção Pro | Churn mensal | ~12% | <10% | <8% |
| Conversão | Free → Pro | ~3% | 4% | 6% |
| Engajamento IA | KRONOS req/usuário/semana | ~2 | 3 | 4+ |
| Qualidade | Error rate `/kronia/chat` | ~1% | <0.5% | <0.3% |
| Performance | Latência chat P95 | ~3s | <2.5s | <2s |
| Estabilidade | Vercel function count | 12/12 | ≤11/12 | ≤10/12 |
| Base | MAU ativos | — | +30% | +80% |

**Métricas que precisam de baseline real** (ação imediata — Seção 12):  
Conversão real Free→Pro, churn real Pro, sessões KRONOS por usuário por semana.

---

## 4. Público-Alvo

### 4.1 Contexto de Mercado

| Dado | Valor | Fonte |
|---|---|---|
| Praticantes de musculação BR | 40M+ | ACAD 2023 |
| Academias registradas BR | 35.000+ | CONFEF |
| Ticket médio personal trainer | R$100–300/sessão | Estimativa mercado |
| Ticket médio app fitness BR | R$15–40/mês | App Store / Play Store |
| Penetração smartphone BR | 82% | IBGE 2024 |
| Idioma exclusivo | PT-BR | Estratégico |

**Posicionamento de preço:**  
KroniA Pro (R$29,90/mês) é percebido como "1 sessão de personal por mês, disponível 24/7". Para o público-alvo, a comparação não é com outros apps — é com o custo de ter ou não ter orientação especializada.

---

### 4.2 Personas

---

#### Persona 1 — O Dedicado Sem Personal
**"Lucas"** — 25–35 anos, analista/desenvolvedor, SP ou grandes centros

| | |
|---|---|
| **Treino** | 4–5x/semana, intermediário a avançado, 2–5 anos |
| **Objetivo** | Hipertrofia + força |
| **Contexto hormonal** | Natural |
| **Renda** | R$5.000–12.000/mês |
| **Plano KroniA** | Pro |

**Comportamento:**  
Pesquisa antes de agir — lê artigos, assiste canais de ciência do treino (Alberto Núñez, Mike Israetel), mas não tem tempo ou disposição para contratar personal. Conhece os conceitos de periodização mas não calcula MEV/MAV/MRV sozinho. Testa protocolos por conta própria e precisa validar se está no caminho certo.

**Frustração central:**  
Apps de treino registram séries mas não dizem nada sobre elas. Quer análise real, não só log.

**Uso do KRONOS:**  
- "Monte um treino de força para costas e ombros na sexta, tenho 60 minutos"  
- "Estou no mês 3 do meu ciclo de hipertrofia, meu volume está alto demais?"  
- "Qual meu grupo muscular mais fraco pelos últimos 30 dias?"

**Job-to-be-done:**  
*"Dê-me o mesmo nível de orientação que um bom personal daria — com o meu histórico, no meu tempo, sem eu pagar R$800/mês."*

**Conversão trigger:** Primeiro treino gerado com os exercícios e volumes que fazem sentido para o histórico dele — sem ser genérico.  
**Churn risk:** Baixo se sentir evolução nos primeiros 30 dias. Alto se KRONOS der respostas genéricas que ele já sabe.

---

#### Persona 2 — O Health-Conscious
**"Rafael"** — 35–50 anos, profissional liberal (médico, engenheiro, gestor), RJ ou SP

| | |
|---|---|
| **Treino** | 3–4x/semana, objetivo saúde e longevidade |
| **Objetivo** | Saúde + composição corporal |
| **Contexto hormonal** | TRT supervisionado ou considerando |
| **Renda** | R$15.000–40.000/mês |
| **Plano KroniA** | Pro → potencial Ultra |

**Comportamento:**  
Faz exames bianuais por iniciativa própria. Lê sobre longevidade (Peter Attia, Bryan Johnson adaptado para BR). Já consulta médico do esporte mas quer mais granularidade no cruzamento de dados. Usa TRT prescrito ou está avaliando.

**Frustração central:**  
Médico vê exames com referências clínicas para sedentário. Personal não vê exames. Ninguém conecta hematócrito, testosterona livre, ferritina e performance de treino na mesma conversa.

**Uso do KRONOS:**  
- "Minha ferritina caiu de 68 para 41 em 6 meses. O que isso significa para meu treino?"  
- "Estou em TRT há 3 meses, hematócrito 51%, como isso afeta meu programa de cardio?"  
- "Meu último exame tem PSA 1.8, é relevante para o treinamento?"

**Job-to-be-done:**  
*"Correlacione meus dados de saúde com minha performance e me diga o que monitorar, com contexto esportivo — não o padrão do laboratório para sedentário."*

**Conversão trigger:** KRONOS interpreta um exame com contexto esportivo e longitudinal que nem o médico conectou.  
**Churn risk:** Muito baixo. Altamente dependente do produto. Menor sensibilidade a preço — candidato ao Ultra.

---

#### Persona 3 — O Atleta Amateur
**"Diego"** — 28–40 anos, fisiculturista amador ou praticante avançado, qualquer cidade

| | |
|---|---|
| **Treino** | 5–6x/semana, periodização própria |
| **Objetivo** | Performance máxima + composição |
| **Contexto hormonal** | Uso assistido (ciclo, TPC, manutenção) |
| **Renda** | R$4.000–10.000/mês |
| **Plano KroniA** | Pro |

**Comportamento:**  
Autodidata avançado — conhece MEV/MAV/MRV, acompanha pesquisa de hipertrofia. Realiza ou já realizou protocolos hormonais. Precisa de monitoramento clínico que entende o contexto esportivo sem alarmar ou moralizar. Já teve experiências ruins com médicos convencionais sobre exames.

**Frustração central:**  
Nenhum app ou profissional trata seu contexto como dado clínico válido. Ou ignoram completamente a variável hormonal ou reagem com julgamento moral ao invés de análise técnica.

**Uso do KRONOS:**  
- "Estou em pós-ciclo, TPC semana 2, RPE médio subiu para 8.5. Devo reduzir o volume?"  
- "Hematócrito 52%, hemoglobina 17.1, estou em cruise. Que biomarcadores devo monitorar?"  
- "Monte um protocolo de deload para a semana que vem baseado no meu histórico recente"

**Job-to-be-done:**  
*"Seja meu parceiro técnico de análise — não meu professor moral. Trate meu contexto hormonal como dado clínico e me ajude a treinar de forma inteligente e segura."*

**Conversão trigger:** KRONOS analisa o exame com `context_flag` separado do `lab_flag` — diferenciando referência de laboratório de referência esportiva — sem moralizar.  
**Churn risk:** Alto se KRONOS tratar contexto hormonal como tabu, der resposta genérica ou ignorar o histórico. Zero tolerância a "consulte um médico" como resposta única.

---

#### Persona 4 — A Iniciante Motivada
**"Beatriz"** — 18–28 anos, estudante ou profissional jovem, qualquer cidade

| | |
|---|---|
| **Treino** | 3x/semana, 3–12 meses de experiência |
| **Objetivo** | Estética + bem-estar |
| **Contexto hormonal** | Natural |
| **Renda** | R$1.500–4.000/mês |
| **Plano KroniA** | Free → conversão Pro |

**Comportamento:**  
Usa principalmente o registro de treino e o timer. Ainda não entende bem o KRONOS mas clicou no botão "Analisar treino" uma vez. Budget sensível — verifica valor antes de assinar. Faz perguntas sobre nutrição ("posso trocar arroz por batata-doce?") que acessam diretamente o catálogo de substituições.

**Frustração central:**  
Sente que está "perdendo tempo" na academia sem saber se está progredindo. Não tem segurança para montar a próxima semana de treino.

**Uso do KRONOS:**  
- "Estou treinando há 4 meses, posso ver minha evolução?"  
- "Posso substituir frango por atum no almoço?"  
- "Qual exercício devo priorizar na perna essa semana?"

**Job-to-be-done:**  
*"Me mostre que estou evoluindo e me diga o que fazer diferente — em linguagem que eu entenda."*

**Conversão trigger:** KRONOS detecta que ela bateu um novo recorde pessoal no agachamento e parabeniza com contexto do histórico ("você aumentou 5kg em 8 semanas — isso é evolução real").  
**Churn risk:** Alto nos primeiros 30 dias se não sentir progresso concreto. A detecção de PR e o onboarding são os principais alavancadores de retenção para este perfil.

---

#### Persona 5 — O Profissional de Saúde *(Horizonte)*
**"Dr. Thiago"** — 30–45 anos, médico do esporte, nutricionista ou educador físico

**Não é persona primária, mas é vetor de crescimento B2B futuro.**  
Usa KroniA para si e recomenda (ou indicaria) para pacientes/alunos. Valoriza rastreabilidade clínica, referências científicas, separação `lab_flag` vs `context_flag`, modo longitudinal de exames.

*Prioridade: Q3 2026. Não bloqueia nada hoje.*

---

### 4.3 Segmentação por Plano

| Persona | Plano Natural | Trigger de Upgrade | Risco de Churn |
|---|---|---|---|
| Dedicado Sem Personal | Free → Pro rápido | Primeiro treino gerado certeiro | Baixo |
| Health-Conscious | Pro → potencial Ultra | Interpretação de exame com contexto | Muito baixo |
| Atleta Amateur | Pro direto | Análise hormonal clínica sem moralização | Alto se experiência ruim |
| Iniciante Motivada | Free longa → Pro | Detecção de PR + onboarding | Alto nos 30 primeiros dias |
| Profissional Saúde | Pro | B2B futuro | N/A hoje |

---

### 4.4 Jornada Atual (As-Is)

*(Lucas, Persona 1 — primeira semana)*

1. Descobre KroniA via indicação ou busca "app treino IA PT-BR"
2. Acessa o link no navegador mobile ← **[FRICÇÃO: não é App Store — precisa adicionar à tela inicial manualmente]**
3. Cadastra conta Supabase
4. Dashboard vazio sem onboarding ← **[FRICÇÃO: não sabe por onde começar]**
5. Registra primeiro treino manualmente — descobre o timer
6. Termina treino, vê botão do KRONOS ← **[ENTRADA: percebe que há IA]**
7. Faz primeira pergunta: "Como foi meu treino?" ← **[DELEITE: KRONOS já viu o treino]**
8. Usa 15 req/mês nas primeiras 2 semanas ← **[BLOQUEIO: paywall]**
9. Considera Pro ← **[DECISÃO: conversion moment]**

Problemas na jornada atual:
- Passo 2: PWA não tem descoberta via app store
- Passo 4: sem onboarding, usuário não entende o potencial
- Passo 8: quota de 15 req esgota antes do usuário perceber todo o valor

---

### 4.5 Jornada Futura (To-Be)

*(pós roadmap 90d — Fase 3)*

1. Instala PWA com guia visual "adicione à tela inicial"
2. **Onboarding guiado**: KRONOS coleta objetivo, nível, frequência, restrições → gera protocolo inicial em 3 minutos
3. Primeira semana: registra treinos com sugestão de exercícios pelo discovery
4. **Semana 2**: KRONOS detecta volume de quadríceps abaixo do MEV → sugere ajuste
5. **Semana 3**: usuário bate PR no agachamento ← **[DELEITE MÁXIMO]** → KRONOS parabeniza com contexto histórico
6. Recebe notificação "Você tem análise nova" → abre PRO trial ou converte diretamente
7. **Mês 2**: upload de exame anual → KRONOS interpreta com contexto esportivo, longitudinal
8. Usuário Pro fidelizado — KRONOS conhece seu histórico, não precisa re-explicar perfil

---

### 4.6 Edge Cases

| Cenário | Comportamento esperado |
|---|---|
| Usuário relata dor aguda durante treino | KRONOS detecta no chat, para de sugerir exercícios, pergunta localização e intensidade |
| Exame com valor crítico (ex: PSA > 10) | KRONOS explica em linguagem acessível e redireciona para médico — nunca normaliza |
| Contexto hormonal com hematócrito > 54% | KRONOS sinaliza como monitorar, não normaliza por contexto esportivo |
| Offline prolongado (viagem sem internet) | Registro de treino funciona 100%; sync retroativa ao reconectar sem perda de dados |
| Usuário sem exames mas com restrição alimentar | KRONOS gera dieta respeitando restrições declaradas no perfil, sem pedir exame antes |
| Pergunta fora de domínio ("me ajude com código") | KRONOS responde dentro do escopo: saúde, treino, nutrição |

---

## 5. Requisitos Funcionais

### 5.1 Funcionalidades Ativas (Must Have)

**RF-01 — Registro de Treino**
- Descrição: Registro de séries com carga, reps e RPE por exercício, supersets suportados
- Critério: Dados persistem offline e sincronizam ao reconectar sem perda
- Plano: Ambos

**RF-02 — KRONOS Coach (10 Intenções)**
- Descrição: IA conversacional que classifica intenção, injeta 8 camadas de contexto do usuário e responde exclusivamente com dados reais
- Intenções: `chat`, `treino`, `dieta`, `suplementacao`, `mobilidade`, `ajuste`, `duvida`, `continuidade`, `configuracao`, `acao_direta`
- Critério: Resposta < 3s P95; contexto dos últimos 30 dias de treino injetado; nunca resposta genérica se dados existem
- Plano: Free (15 req/mês) | Pro (ilimitado)

**RF-03 — Periodização Científica (MEV/MAV/MRV)**
- Descrição: Cálculo automático de volume mínimo efetivo, volume máximo adaptativo e máximo recuperável por grupo muscular
- Critério: Exibe volumes semanais vs targets; alerta quando abaixo ou acima da faixa
- Plano: Pro

**RF-04 — Score de Fadiga e Prontidão**
- Descrição: Score composto (0–10) baseado em RPE acumulado, volume semanal e histórico
- Critério: Atualizado após cada sessão; alertas `overtraining`, `plateau`, `deficit_proteico` automáticos
- Plano: Pro

**RF-05 — Análise Clínica de Exames**
- Descrição: Upload de PDF/JPEG com OCR automático (Groq Vision + Gemini fallback); parsing de 80+ biomarcadores; interpretação com `lab_flag` (referência do laboratório) e `context_flag` (referência esportiva/hormonal); análise longitudinal entre exames
- Critério: OCR < 15s; separação correta de lab_flag vs context_flag; nunca diagnóstico, sempre redirecionamento para profissional em valores críticos
- Plano: Pro

**RF-06 — Geração de Dieta por IA**
- Descrição: Dieta estruturada em 5 seções obrigatórias (prescrição nutricional, plano alimentar, substituições, sequência de consumo, orientações clínicas); respeitando perfil, patologias, restrições e exames
- Critério: Geração < 10s; PDF disponível para download; substituições por grupo alimentar incluídas
- Plano: Pro

**RF-07 — Geração de Treino por IA**
- Descrição: Protocolo personalizado com periodização, exercícios, séries, cargas alvo e notas de execução
- Critério: Geração considera histórico recente, fadiga acumulada e MEV/MAV/MRV do usuário
- Plano: Pro

**RF-08 — Catálogo de Exercícios com Discovery**
- Descrição: Busca contextual por exercício; detalhes com instruções, músculos-alvo, equipamento, nível, erros comuns, mídia
- Critério: Discovery retorna exercícios relevantes em < 2s; detalhes com fallback gracioso se mídia ausente
- Plano: Ambos

**RF-09 — Memória Persistente**
- Descrição: KRONOS mantém memória estruturada por tipo (perfil, preferência, restrição, lesão, objetivo, rotina, resumo, feedback)
- Critério: Usuário não precisa re-explicar preferências entre sessões; memória atualizada automaticamente
- Plano: Pro

**RF-10 — Offline-First (PWA)**
- Descrição: Registro de treino e timer funcionam sem conexão; sincronização retroativa ao reconectar
- Critério: App instalável via browser (Add to Home Screen); service worker ativo; zero perda de dados em modo offline
- Plano: Ambos

**RF-11 — LGPD Compliance**
- Descrição: Exportação de todos os dados do usuário (GET); deleção completa (DELETE)
- Critério: Export retorna JSON com todos os registros; delete remove todos os dados sem resíduo
- Plano: Ambos

**RF-12 — Log por Voz**
- Descrição: Registro de série via speech recognition (carga, reps, exercício)
- Critério: Transcrição em < 2s; correto em ambientes ruidosos (academia)
- Plano: Pro

**RF-13 — Calculadora de Macros**
- Descrição: Cálculo de metas calóricas e macros baseado em peso, objetivo e nível de atividade
- Critério: Resultado instantâneo; exportável para dieta ativa
- Plano: Free

### 5.2 Funcionalidades Prioritárias no Roadmap (Should Have)

**RF-14 — Onboarding Guiado**
- Descrição: Fluxo de boas-vindas que coleta objetivo, nível, frequência e restrições → gera primeiro protocolo automaticamente
- Critério: Usuário tem primeiro treino sugerido em < 5 minutos após cadastro
- Plano: Ambos (Pro: protocolo completo; Free: protocolo básico)

**RF-15 — Detecção de PR com Celebração**
- Descrição: Detecção automática de recorde pessoal por exercício → notificação no app + KRONOS parabeniza com contexto histórico
- Critério: PR detectado corretamente; mensagem do KRONOS referencia o histórico ("aumentou 5kg em 8 semanas")
- Plano: Pro

**RF-16 — Dashboard de Progresso**
- Descrição: Visualização de evolução de carga/volume por exercício e grupo muscular ao longo do tempo
- Critério: Gráfico de evolução para últimos 30/90 dias por exercício
- Plano: Pro

**RF-17 — Tendência Longitudinal de Exames**
- Descrição: Interface visual de evolução de biomarcador ao longo de múltiplos exames (melhorou/piorou/estável/persistente)
- Critério: Timeline de até 12 últimos valores por marcador; tendência calculada e exibida
- Plano: Pro

### 5.3 Fora de Escopo (Won't Have)

| Feature | Motivo |
|---|---|
| App nativo iOS/Android | PWA resolve o caso de uso; custo de manutenção duplicaria |
| Marketplace de personal trainers | Fora da proposta de valor; complexidade desproporcionada |
| Integração com wearables (Apple Watch, Garmin) | Custo de integração vs valor incremental — não prioridade |
| Streaming de vídeo de exercícios | Storage cost proibitivo no Vercel Hobby |
| Social / comunidade | Risco de moderação; fora do foco clínico |
| Multi-idioma | Foco estratégico PT-BR |

---

## 6. Requisitos Não-Funcionais

### 6.1 Performance

| Operação | P50 | P95 | P99 |
|---|---|---|---|
| Chat KRONOS | < 1.5s | < 3s | < 5s |
| Classificação de intent | < 300ms | < 600ms | < 1s |
| Registro de treino (offline) | 0ms | 0ms | 0ms |
| Geração de dieta PDF | < 7s | < 10s | < 15s |
| OCR de exame | < 10s | < 15s | < 20s |
| App load (4G) | < 1.5s | < 2s | < 3s |
| Catálogo de exercícios | < 1s | < 2s | < 3s |

### 6.2 Segurança e Privacidade

**Dados sensíveis de saúde:**
- Exames laboratoriais, biomarcadores, contexto hormonal
- Histórico de treino, composição corporal, patologias
- Nunca expostos em logs de texto plano

**Contexto hormonal:**
- `usa_hormônios_exógenos`, `compostos_declarados`, `contexto_hormonal` — campos explicitamente sensíveis
- RLS ativo: usuário acessa apenas seus próprios dados
- Nunca expostos em analytics ou logs de infra

**RLS Supabase:**
- Ativo em todas as tabelas: `WHERE user_id = auth.uid()`
- Políticas testadas em staging antes de cada migration
- Storage: path baseado em `user_id/` — nenhum cross-access possível

**LGPD:**
- Export completo via endpoint dedicado
- Delete completo verificado: sem resíduo em nenhuma tabela
- Dados de exames: imagem original não persistida pós-OCR (apenas dados extraídos)

### 6.3 Disponibilidade e Degradação

| Componente | SLA Target | Comportamento em Falha |
|---|---|---|
| App (PWA) | 100% (offline) | Service worker garante uso offline |
| KRONOS chat | 99.5% | Se Groq falhar → mensagem clara ao usuário, nunca 500 silencioso |
| OCR de exames | 99% | Groq Vision → Gemini fallback automático |
| Geração de dieta | 99% | Erro explícito com retry sugerido |
| Banco de dados | 99.9% | Supabase SLA |

### 6.4 Escalabilidade e Custo

**Vercel Hobby (blocker atual):**
- Limite: 12/12 functions — qualquer nova function sem remover uma é blocker de deploy
- Ação imediata: remover `api/agent.js` (9 linhas, código morto) → libera 1 slot

**Custo estimado por usuário Pro/mês:**

| Componente | Custo estimado | Base de cálculo |
|---|---|---|
| KRONOS chat (llama3-70b) | ~R$ 2,40 | 30 req × R$0,08/req |
| Geração de dieta (mixtral) | ~R$ 0,48 | 4 req × R$0,12/req |
| OCR de exames (Gemini) | ~R$ 0,50 | 2 req × R$0,25/req |
| Intent classifier (llama3-8b) | ~R$ 0,30 | 50 req × R$0,006/req |
| **Total estimado** | **~R$ 3,68** | Margem bruta Pro: ~87% |

**Supabase Free Tier:**
- Limite: 500MB storage, 50k req/dia
- Trigger de upgrade: ~300 MAU ativos ou storage > 400MB

---

## 7. Design e Experiência

### 7.1 Princípios de UX

**1. Mobile-first absoluto.**  
90%+ dos acessos são mobile, portrait. Nenhuma decisão de interface que funcione "melhor no desktop" é aceitável. Timer, input de série, chat com KRONOS — tudo pensado para uma mão.

**2. Performance como feature.**  
Cada 100ms removidos da latência do KRONOS são percebidos pelo usuário. Tela de loading é fricção. Respostas parciais com streaming melhoram percepção de velocidade mesmo sem reduzir tempo real.

**3. Coach, não chatbot.**  
KRONOS tem personalidade consistente: direto, técnico, PT-BR informal mas preciso. Nunca paternalista. Nunca genérico quando tem dados. Nunca moraliza sobre estilo de vida — analisa clinicamente.

**4. Contexto sem julgamento.**  
Usuário com TRT ou protocolo hormonal recebe análise clínica técnica, não redirecionamento envergonhado. O produto é posicionado como parceiro clínico, não como árbitro de escolhas pessoais.

### 7.2 Estados Críticos de Interface

| Estado | Comportamento esperado |
|---|---|
| **Dashboard vazio** (novo usuário) | CTA único "Iniciar primeiro treino" + KRONOS se apresenta brevemente |
| **Durante treino** | Timer proeminente, input de série em tap único, sem distrações, modo landscape suportado |
| **Pós-treino** | Resumo automático de volume + fadiga + próxima sugestão do KRONOS |
| **Paywall (Free 15/15)** | "Você usou 15 de 15 conversas este mês" + valor mostrado antes do bloqueio |
| **Offline** | Banner discreto "Modo offline — seu treino está salvo" |
| **Exame processando** | Progress indicator com etapas (upload → OCR → análise) |
| **Exame com valor crítico** | Explicação acessível + redirecionamento para profissional — sem alarme desnecessário |
| **PR detectado** | Celebração contextual ("Novo recorde no supino! +2.5kg vs melhor anterior") |

### 7.3 Copy e Microtextos Críticos

**KRONOS — tom de voz:**
- Referencia o usuário pelo nome quando disponível no perfil
- Jargão técnico com explicação imediata: "sua ferritina está em 41 ng/mL — abaixo do ideal para atletas de força (recomendado: 50–150)"
- Evita: "consulte um médico" como única resposta em contextos que permitam análise real

**CTAs de conversão:**
- Foco em resultado, não em feature
- "Ver sua fadiga real" > "Ativar análise avançada"
- "Criar seu protocolo personalizado" > "Assinar Pro"
- "KRONOS lembra de tudo — sem limite" > "Chat ilimitado"

**Contexto hormonal — linguagem:**
- Neutro, clínico, sem conotação moral
- "Marcadores compatíveis com uso de androgênios exógenos" vs julgamento
- Sempre: "seus valores sugerem" / "sinais compatíveis com" — nunca diagnóstico

---

## 8. Arquitetura Técnica

### 8.1 Componentes Canônicos

| Domínio | Arquivo canônico | Status |
|---|---|---|
| Orquestração IA | `src/ai/orchestrator.ts` | Canônico — não tocar sem motivo |
| Intent classifier | `src/ai/intentClassifier.ts` | Canônico (consolidar 3 classifiers legacy) |
| Context builder | `src/ai/contextBuilder.ts` | Estável — 8 camadas de contexto |
| System prompt | `src/ai/systemPrompt.ts` | Estável — personalidade do KRONOS |
| Tipos IA | `src/ai/types.ts` | Canônico |
| Nutrição | `src/core/nutrition/` | Canônico |
| Labs/Exames | `src/core/labs/` | Estável |
| API routes | `src/app/api/kronia/` | Canônico — 12 routes ativas |

### 8.2 Modelos de IA por Caso de Uso

| Caso de uso | Modelo | Justificativa |
|---|---|---|
| Chat KRONOS | `llama3-70b-8192` | Raciocínio clínico, qualidade máxima |
| Geração de treino/dieta | `mixtral-8x7b-32768` | Context window largo (histórico + exames) |
| Classificação de intent | `llama3-8b-8192` | Velocidade, baixo custo, tarefa determinística |
| OCR de exames | Google Gemini | Melhor desempenho em documentos PDF/JPEG |

### 8.3 Banco de Dados (Estado Atual)

**53+ migrations executadas** em produção. Tabelas principais:

| Domínio | Tabelas principais |
|---|---|
| Usuário | `profiles`, `user_plans`, `ai_usage_logs` |
| Treino | `workout_history`, `workout_templates`, `fadiga_scores`, `alertas_kronos` |
| IA & Memória | `memory_items`, `chat_messages`, `user_memory_queue` |
| Exames | `lab_reports`, `lab_report_biomarkers`, `lab_report_extractions` |
| Nutrição | `nutrition_plans`, `foods`, `food_aliases`, `food_portions`, `food_substitutions`, `recipe_catalog`, `user_food_preferences` |
| Exercícios | `exercises` |
| Conhecimento | `knowledge_articles`, `scientific_references`, `clinical_evidence_sources` |
| Afiliados | `affiliate_sales`, `affiliate_commissions` |
| Admin | `admin_import_jobs`, `diagnostic_executions`, `kronia_intelligence_events` |

**RLS:** ativo em todas as tabelas com `user_id = auth.uid()`

### 8.4 Dívida Técnica que Bloqueia Produto

| Item | Risco concreto | Prioridade |
|---|---|---|
| Vercel 12/12 functions | Zero features novas com endpoint | **P0 — BLOCKER** |
| `api/agent.js` (9 linhas, morto) | Consome 1 slot Vercel sem servir nada | **P0** |
| 2 orchestrators paralelos | Comportamento inconsistente entre routes | **P1** |
| 4 intent classifiers paralelos | Intent errado para edge cases | **P1** |
| `kronosAgent.js` sem TypeScript | Unsafe para lógica clínica; implicit `any` | **P1** |
| `src/lib/engine/orchestrator.js` | Legacy ativo — deve ser substituído pelo canônico | **P1** |

### 8.5 Riscos Técnicos

**1. Vercel function limit** (Probabilidade Alta / Impacto Crítico)  
Qualquer push que adicione uma function acima de 12 quebra o deploy de produção.  
Mitigação: remover `api/agent.js` como P0 antes de qualquer work de feature.

**2. Groq API rate limits** (Probabilidade Média / Impacto Alto)  
Picos de usuário podem acionar throttling (429). Atualmente sem queue.  
Mitigação: implementar retry com exponential backoff no `modelClient.ts`; considerar cache semântico para perguntas repetidas.

**3. Supabase Free tier** (Probabilidade Baixa agora / Impacto Alto depois)  
50k req/dia e 500MB de storage. Com crescimento de MAU, esse limite pode ser atingido.  
Mitigação: monitorar dashboard de uso; trigger de upgrade definido em ~300 MAU.

---

## 9. Plano de Evolução

### 9.1 Pré-Requisitos Inegociáveis (Antes de Qualquer Feature Nova)

1. **Remover `api/agent.js`** → libera 1 slot Vercel → unblocks todo desenvolvimento
2. **Consolidar orchestrators** → comportamento de IA consistente e rastreável
3. **Consolidar intent classifiers** → um único ponto de decisão de intenção
4. **Migrar `kronosAgent.js` → `.ts`** → segurança clínica garantida por TypeScript strict

### 9.2 Fases de Entrega

**Fase 1 — Estabilização** *(Semanas 1–2)*  
Objetivo: zero blockers técnicos, error rate < 0.5%, Vercel com folga.
- Remover `api/agent.js`
- Consolidar orchestrators (canônico = `src/ai/orchestrator.ts`)
- Consolidar intent classifiers (canônico = `src/ai/intentClassifier.ts`)
- Migrar `kronosAgent.js` → `kronosAgent.ts`
- Done: Vercel ≤11/12, error rate P95 < 0.5%, zero regressão em produção

**Fase 2 — Retenção** *(Semanas 3–6)*  
Objetivo: usuários Pro percebem evolução; churn reduz.
- Detecção explícita de PR + celebração contextual (RF-15)
- Dashboard de progresso por exercício (RF-16)
- Tendência longitudinal de exames na interface (RF-17)
- Done: PR detectado corretamente, +0.5 sessões KRONOS/semana por usuário Pro

**Fase 3 — Aquisição** *(Semanas 7–12)*  
Objetivo: novos usuários chegam ao "aha moment" em < 5 minutos.
- Onboarding guiado com protocolo inicial (RF-14)
- Melhorias de copy e fluxo de conversão Free→Pro
- Otimização de latência KRONOS (P95 < 2s)
- Done: tempo-até-primeiro-protocolo < 5 min, conversão Free→Pro +1pp

### 9.3 Feature Flags

| Feature | Flag | Rollout |
|---|---|---|
| Onboarding guiado | `onboarding_v2` | 10% → 50% → 100% |
| Detecção de PR | `pr_detection` | 100% Pro desde o início |
| Dashboard progresso | `progress_dashboard` | 100% Pro desde o início |
| Tendência de exames | `lab_trends` | 100% Pro (usuários com ≥2 exames) |

### 9.4 Rollback

- **Vercel:** revert automático via GitHub ao último deploy estável
- **Supabase migrations:** cada migration deve ter rollback script documentado antes de ser executada em produção
- **IA (modelos):** fallback configurado no orchestrator: llama3-70b → llama3-8b se rate limit; Groq → mensagem de erro gracioso se indisponível

---

## 10. Testes e Validação

### 10.1 Critérios de Done (por Feature)

- [ ] TypeScript strict — zero `any` em código clínico e de IA
- [ ] Teste unitário para lógica de domínio (MEV/MAV/MRV, fadiga, parses de biomarcadores)
- [ ] Teste E2E Playwright: fluxo principal + fluxo offline + fluxo paywall
- [ ] Testado em mobile Chrome Android, portrait
- [ ] RLS validado: usuário A não acessa dados do usuário B
- [ ] Latência medida e dentro do SLA definido na Seção 6.1
- [ ] Degradação graciosa testada: Groq timeout → resposta correta ao usuário
- [ ] Zero regressão em features adjacentes (KRONOS, exames, geração de treino)

### 10.2 Casos de Teste Críticos

| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Treino registrado offline → reconectar | Dados sincronizados sem perda |
| 2 | Free user em 15/15 req KRONOS | Paywall exibido antes do bloqueio |
| 3 | Exame com valor crítico (PSA > 10) | KRONOS explica, não diagnostica, redireciona |
| 4 | Contexto hormonal (hematócrito 52%) | KRONOS analisa clinicamente, não moraliza |
| 5 | Groq API timeout | Mensagem clara ao usuário, não 500 |
| 6 | Usuário B tenta acessar dados do usuário A | 403 (RLS ativo) |
| 7 | "Estou cansado" → intent classifier | `chat` — nunca `treino` ou `acao_direta` |
| 8 | Dieta gerada com restrição de glúten | Plano sem nenhum item com glúten |
| 9 | 3 exames no histórico — marcador piorando | KRONOS cita tendência longitudinal |
| 10 | App carregado sem internet | Registro de treino e timer funcionam 100% |

### 10.3 Como Medir Sucesso Pós-Launch

```sql
-- Taxa de conversão Free→Pro (últimos 30 dias)
SELECT 
  COUNT(*) FILTER (WHERE plan = 'pro') AS pro_users,
  COUNT(*) AS total_users,
  ROUND(COUNT(*) FILTER (WHERE plan = 'pro')::numeric / COUNT(*) * 100, 1) AS conversion_pct
FROM user_plans
WHERE created_at > NOW() - INTERVAL '30 days';

-- Engajamento KRONOS (sessões por usuário/semana)
SELECT 
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS total_messages,
  COUNT(DISTINCT user_id) AS active_users,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 1) AS msgs_per_user
FROM chat_messages
WHERE role = 'user'
GROUP BY 1 ORDER BY 1 DESC;

-- Churn Pro (usuários que não renovaram)
SELECT COUNT(*) AS churned_users
FROM user_plans
WHERE plan = 'pro' 
  AND payment_status != 'active'
  AND expires_at < NOW()
  AND expires_at > NOW() - INTERVAL '30 days';

-- Latência KRONOS (via kronia_intelligence_events)
SELECT 
  DATE_TRUNC('day', created_at) AS day,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (analysis->>'latency_ms')::numeric) AS p95_ms
FROM kronia_intelligence_events
WHERE module = 'chat'
GROUP BY 1 ORDER BY 1 DESC;
```

---

## 11. Dependências e Riscos

### 11.1 Dependências Externas

| Serviço | Criticidade | Risco Atual | Mitigação |
|---|---|---|---|
| Groq API | Crítica — IA core | Rate limits em picos; mudança de preço | Retry com backoff; fallback de modelo |
| Supabase | Crítica — DB e storage | Free tier: 500MB / 50k req/dia | Monitorar; upgrade em ~300 MAU |
| Vercel Hobby | Crítica — deploy | 12/12 functions — BLOCKER ativo | Remover `api/agent.js` como P0 |
| Google Gemini | Média — OCR | Quota diária de requests | Fila de processamento de exames |
| Hotmart/Kiwify | Média — pagamento | Webhooks instáveis historicamente | Retry idempotente implementado (migration 011) |

### 11.2 Riscos de Negócio

**1. Competidores globais localizando PT-BR** (Probabilidade Média / Impacto Alto)  
ChatGPT, Gemini e outros podem lançar plugins fitness em PT-BR.  
Mitigação: especialização clínica profunda (contexto hormonal, longitudinal de exames, MEV/MAV/MRV real) que players genéricos não replicam em 6–12 meses. Mover rápido em diferenciação de produto.

**2. Churn por falta de progresso percebido** (Probabilidade Alta / Impacto Alto)  
Usuário Pro que não "sente" o produto funcionando cancela silenciosamente.  
Mitigação: RF-15 (PR detection), RF-16 (dashboard), onboarding com protocolo imediato.

**3. Custo de IA escalando com base** (Probabilidade Baixa agora / Impacto Médio)  
Se Groq mudar pricing ou uso por usuário crescer acima do estimado.  
Mitigação: prompt compression, cache semântico para perguntas repetidas, `llama3-8b` para casos simples.

**4. Regulatório (dados de saúde sensíveis)** (Probabilidade Baixa / Impacto Alto)  
LGPD e regulação de dados de saúde no Brasil são crescentes.  
Mitigação: LGPD implementada (export + delete); KRONOS nunca diagnostica, sempre redireciona; dados sensíveis nunca em logs.

### 11.3 Assunções

| Assunção | Risco se falsa | Como validar |
|---|---|---|
| Usuários pagam R$29,90 por coach IA de qualidade | Modelo freemium não sustentável | Entrevistas + análise de churn |
| 80%+ acessos são mobile | UI decisions erradas | Analytics (confirmar) |
| Groq API é estável para produção | Outages afetam KRONOS | Monitorar uptime; manter fallback |
| Supabase Free suporta carga atual | Throttling silencioso | Checar dashboard de uso semanal |

---

## 12. Perguntas Abertas

| Pergunta | Responsável | Prazo |
|---|---|---|
| Qual é a conversão real Free→Pro atual? (query na Seção 10.3) | Kleber | Imediato |
| Qual o churn mensal real de usuários Pro? | Kleber | Imediato |
| Quantos MAU ativos temos hoje? | Kleber | Imediato |
| Ultra tier (R$59,90): o que entrega que justifica 2x o Pro? | Kleber (produto) | Fase 2 |
| KRONOS deve ter avatar / identidade visual? Impacto em engajamento? | Kleber (produto) | Fase 3 |
| Persona 5 (profissional de saúde): abrir estratégia B2B em 2026? | Kleber (estratégia) | Q3 2026 |
| Quando migrar Supabase para plano pago? Definir trigger de MAU | Kleber (financeiro) | Monitorar |
| Exames: manter Gemini para OCR ou avaliar AWS Textract? | Kleber (técnico) | Fase 2 |

---

## 13. Histórico e Aprovações

| Data | Versão | Autor | Alteração |
|---|---|---|---|
| 2026-05-28 | 1.0 | Claude Code | Criação — PRD fundacional KroniA com público-alvo detalhado |

---

## 14. Automação de Sincronização

### 14.1 Arquivos Estruturais Monitorados

```
src/ai/orchestrator.ts
src/ai/intentClassifier.ts
src/ai/contextBuilder.ts
src/ai/systemPrompt.ts
src/ai/types.ts
src/app/api/kronia/
src/core/nutrition/
src/core/labs/
supabase/migrations/
vercel.json
package.json
```

### 14.2 Seções Sensíveis a Mudanças

| Arquivo/Diretório alterado | Seções do PRD a revisar | O que verificar |
|---|---|---|
| `src/app/api/kronia/` | 5.1, 8.1 | Novos endpoints, contratos de API, rate limits |
| `supabase/migrations/` | 8.3, 6.2, 9.1, 13 | Schema, políticas RLS, histórico de mudanças |
| `src/ai/types.ts` | 5.1, 8.1 | Contratos de intent, payloads, novos tipos |
| `src/ai/orchestrator.ts` | 8.4, 6.1 | Modelos usados, fluxo de chamada, latência |
| `src/ai/systemPrompt.ts` | 4.2, 5.1, 7.3 | Comportamento KRONOS, limitações, copy |
| `src/ai/intentClassifier.ts` | 5.1, 4.2 | Intenções reconhecidas, edge cases |
| `src/ai/contextBuilder.ts` | 5.1, 4.2 | Dados injetados no contexto, memória |
| `vercel.json` | 6.3, 6.4, 8.4 | Rotas, crons, limites, function count |
| `package.json` | 6.4, 8 | Dependências, custos de infra |

### 14.3 Entrada de Registry (para `.claude/prd-registry.json`)

```json
"docs/prd/kronia-platform-v1.md": [
  "src/ai/orchestrator.ts",
  "src/ai/intentClassifier.ts",
  "src/ai/contextBuilder.ts",
  "src/ai/systemPrompt.ts",
  "src/ai/types.ts",
  "src/app/api/kronia/",
  "src/core/nutrition/",
  "src/core/labs/",
  "supabase/migrations/",
  "vercel.json",
  "package.json"
]
```
