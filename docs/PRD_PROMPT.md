# Prompt Profissional para Criação de PRD — KroniA

Use este prompt completo para gerar um PRD estruturado para qualquer nova feature ou iniciativa da plataforma KroniA.

---

## COMO USAR

1. Copie o bloco `PROMPT` abaixo
2. Substitua os `[CAMPOS EM COLCHETES]` com as informações da feature
3. Cole em qualquer LLM (Claude, GPT-4, Gemini) para gerar o PRD completo

---

## PROMPT

```
Você é um Product Manager sênior especialista em plataformas de saúde e performance digital.

Sua tarefa é criar um PRD (Product Requirements Document) completo e detalhado para uma nova feature da plataforma KroniA.

---

## CONTEXTO DO PRODUTO

**KroniA** é uma plataforma brasileira de saúde e performance com IA adaptativa.

**Proposta de valor:**
Coach de musculação com IA conversacional (KRONOS) que analisa fadiga, volume muscular,
histórico de treinos e biomarcadores para recomendar ajustes de protocolo personalizados.

**Usuário alvo:**
Praticantes de musculação no Brasil que querem treinar com ciência, sem precisar de personal
trainer presencial. Perfil: 20-40 anos, gym-goers intermediários a avançados, dispostos a pagar
R$ 29,90/mês por performance real.

**Modelo de negócio:**
- Free: registro de treinos, timer, histórico, 15 req/mês de IA
- Pro (R$ 29,90/mês): KRONOS ilimitado, análise avançada, detecção de PRs, score de fadiga
- Ultra (R$ 59,90/mês): recursos premium futuros

**Stack técnico:**
- Frontend: PWA (HTML5 + Vanilla JS + CSS3) — offline-first
- Backend: Next.js 14 App Router + TypeScript + Vercel Serverless
- Database: Supabase PostgreSQL com RLS
- IA: Groq API (Llama3-70b, Mixtral-8x7b, Llama3-8b) + Google Gemini
- Deploy: Vercel Hobby (CRÍTICO: no limite de 12/12 serverless functions)

**Features existentes:**
- Registro de treinos (carga, reps, RPE por série, supersets)
- KRONOS Coach: IA conversacional em PT-BR
- Periodização científica: MEV/MAV/MRV por grupo muscular
- Score de fadiga e prontidão
- Calculadora de macros e geração de dietas por IA
- Upload e OCR de exames laboratoriais
- Análise de biomarcadores clínicos
- Sistema freemium com quotas por plano

**Restrições técnicas não-negociáveis:**
- NÃO criar novos arquivos em `/api/` (Vercel no limite)
- Novos endpoints SEMPRE em `src/app/api/`
- Lógica clínica e IA obrigatoriamente em TypeScript
- Sem sistemas paralelos ou duplicação de módulos canônicos
- Sem aumentar Vercel function count sem compensar

---

## FEATURE A ESPECIFICAR

**Nome da feature:** [NOME DA FEATURE]

**Contexto e motivação:**
[DESCREVA O PROBLEMA QUE ESTA FEATURE RESOLVE OU A OPORTUNIDADE QUE CAPTURA.
Ex: "Usuários pro relatam que perdem contexto entre sessões de treino pois o KRONOS não
lembra conversas anteriores além de 7 dias"]

**Tipo de iniciativa:**
[MARQUE UMA: Nova feature | Melhoria de feature existente | Correção de problema | Débito técnico | Monetização]

**Impacto esperado:**
[DESCREVA O RESULTADO DESEJADO.
Ex: "Reduzir churn de usuários Pro em ~15% no primeiro mês após feature launch"]

**Stakeholders:**
[QUEM É AFETADO. Ex: "Usuários Pro, lógica do KRONOS, banco de dados de memória"]

---

## INSTRUÇÃO DE GERAÇÃO

Com base em todo o contexto acima, crie um PRD completo seguindo EXATAMENTE esta estrutura:

---

# PRD: [Nome da Feature]

## 1. Resumo Executivo
- Problema central (1 parágrafo)
- Solução proposta (1 parágrafo)
- Impacto esperado em métricas de negócio
- Dependências críticas

## 2. Contexto e Motivação

### 2.1 Problema
Descreva com precisão o problema do usuário ou oportunidade de negócio.
Use dados quantitativos quando possível.

### 2.2 Por que agora?
Justificativa de prioridade. Por que esta feature antes de outras?

### 2.3 O que acontece se não construirmos?
Custo de inação (churn, oportunidade perdida, dívida técnica crescente).

## 3. Objetivos e Métricas de Sucesso

| Objetivo | Métrica | Baseline atual | Meta em 30 dias | Meta em 90 dias |
|----------|---------|---------------|-----------------|-----------------|
| [obj 1]  | [KPI]   | [valor]        | [target]         | [target]         |

Inclua ao menos:
- 1 métrica de engajamento
- 1 métrica de negócio (conversão, retenção ou receita)
- 1 métrica técnica (latência, erros, disponibilidade)

## 4. Usuários e Cenários

### 4.1 Personas afetadas
Para cada persona: nome, plano (Free/Pro), comportamento atual, frustração principal.

### 4.2 Jornada atual (As-Is)
Fluxo atual passo a passo. Marque onde está o problema/fricção.

### 4.3 Jornada futura (To-Be)
Fluxo após a feature. Marque onde a experiência melhora.

### 4.4 Edge cases e usuários extremos
Comportamentos fora do padrão que a feature deve suportar ou explicitamente não suportar.

## 5. Requisitos Funcionais

### 5.1 Funcionalidades obrigatórias (Must Have)
Liste com critérios de aceitação claros.

Format:
**RF-01 — [Nome]**
- Descrição: O que o sistema deve fazer
- Critério de aceitação: Como verificar que está correto
- Plano afetado: Free | Pro | Ambos

### 5.2 Funcionalidades desejáveis (Should Have)
Idem formato acima.

### 5.3 Funcionalidades fora de escopo (Won't Have)
Liste explicitamente o que NÃO faz parte desta versão e por quê.

## 6. Requisitos Não-Funcionais

### 6.1 Performance
- Latência máxima aceitável para cada operação crítica
- Volume esperado (requests/dia, usuários simultâneos)
- Comportamento offline (PWA)

### 6.2 Segurança e Privacidade
- Dados sensíveis envolvidos (dados clínicos, treinos, preferências)
- Requisitos LGPD aplicáveis
- RLS Supabase: novas políticas necessárias?

### 6.3 Disponibilidade
- SLA esperado
- Comportamento em falha de IA (fallback)
- Comportamento sem conexão (service worker)

### 6.4 Escalabilidade
- Impacto no limite Vercel (12/12 functions)
- Impacto em storage Supabase
- Custo estimado de IA (tokens/mês com adoção esperada)

## 7. Design e Experiência

### 7.1 Princípios de UX para esta feature
Liste 2-3 princípios que guiam as decisões de design.

### 7.2 Mockup ou Fluxo de UI
Descreva textualmente as principais telas/estados:
- Estado vazio (primeiro uso)
- Estado com dados
- Estado de loading/erro
- Estado de sucesso

### 7.3 Copy e Microtextos críticos
Mensagens de sistema, CTAs, labels que afetam a percepção da feature.

## 8. Arquitetura Técnica

### 8.1 Componentes afetados
Liste arquivos canônicos que serão modificados (use os caminhos reais do projeto).

### 8.2 Novos componentes (se necessário)
Apenas se não houver alternativa de reusar canônicos existentes.
Justifique por que é necessário criar algo novo.

### 8.3 Mudanças de banco de dados
- Novas tabelas ou colunas (com tipos)
- Novas políticas RLS
- Migrations necessárias
- Impacto em performance de queries existentes

### 8.4 Integrações externas
- Groq API: modelo recomendado, estimativa de tokens
- Supabase: funcionalidades específicas usadas
- Vercel: impacto em function count e edge config

### 8.5 Riscos técnicos
Liste os top 3 riscos técnicos com probabilidade e mitigação.

## 9. Plano de Rollout

### 9.1 Pré-requisitos
O que deve estar pronto antes de começar (migrações, features, dívidas técnicas).

### 9.2 Fases de entrega
Divida em fases incrementais. Cada fase deve ser deployável e testável independentemente.

**Fase 1 — [Nome]:** [O que entrega, critério de done]
**Fase 2 — [Nome]:** [O que entrega, critério de done]
...

### 9.3 Feature flags
Esta feature precisa de feature flag? Para quê? (rollout gradual, A/B, plano-gate)

### 9.4 Rollback
Como reverter se algo der errado em produção.

## 10. Testes e Validação

### 10.1 Critérios de done
Checklist que define quando a feature está pronta para produção.

- [ ] Testes unitários para lógica clínica/IA
- [ ] Testes E2E (Playwright) para fluxo principal
- [ ] Testado offline (PWA/service worker)
- [ ] Validado em mobile (portrait primary)
- [ ] RLS testado com usuário free e pro
- [ ] Sem regressão em features adjacentes
- [ ] Performance dentro dos SLAs definidos

### 10.2 Casos de teste críticos
Liste 5-10 cenários de teste que cobrem o caminho feliz e os edge cases mais importantes.

### 10.3 Como medir sucesso pós-launch
Dashboards, queries SQL ou eventos de analytics que provam que a feature funciona.

## 11. Dependências e Riscos

### 11.1 Dependências externas
APIs, serviços, teams (se houver) que podem bloquear entrega.

### 11.2 Riscos de negócio
Riscos além dos técnicos: regulatório, competitivo, de adoção, de comunicação.

### 11.3 Assunções
Liste as hipóteses que estão sendo assumidas. Se alguma for falsa, o PRD muda.

## 12. Perguntas Abertas

Liste as questões ainda não resolvidas que precisam de decisão antes da implementação.
Para cada uma: quem decide, e prazo para decisão.

## 13. Histórico e Aprovações

| Data | Versão | Autor | Alteração |
|------|--------|-------|-----------|
| [data] | 1.0 | [nome] | Criação inicial |

---

## REGRAS DE QUALIDADE PARA O PRD GERADO

1. **Seja específico.** Métricas sem baseline são inúteis. Evite "melhorar experiência do usuário".
2. **Respeite as restrições técnicas.** Não sugira criar arquivos em `/api/`, não crie sistemas paralelos.
3. **Priorize causa raiz.** Se a feature corrige um sintoma, identifique a causa real.
4. **Seja honesto sobre incertezas.** Seção 12 existe para isso.
5. **Pense em mobile-first.** 80%+ dos usuários acessam via PWA no celular.
6. **Pense em offline.** KroniA é offline-first. Features de registro devem funcionar sem rede.
7. **Pense em carga clínica.** Qualquer dado de saúde (exames, fadiga, biomarcadores) exige validação explícita e rastreabilidade.
8. **Evite scope creep.** Seção 5.3 (Won't Have) é tão importante quanto Must Have.
9. **Fale com o usuário brasileiro.** Copy em PT-BR, valores em BRL, contexto cultural local.
10. **Solo dev.** Não assuma equipes, squads ou processos enterprise. O PRD deve ser executável por uma pessoa.
```

---

## EXEMPLO DE FEATURE DESCRIPTION

Para a feature "Memória Longa do KRONOS":

```
**Nome da feature:** Memória Persistente do KRONOS

**Contexto e motivação:**
Atualmente o KRONOS perde contexto de conversas após 7 dias. Usuários Pro relatam
frustração ao precisar re-explicar histórico clínico e preferências a cada nova semana.
O KRONOS é vendido como "coach pessoal" mas não tem comportamento de coach
que lembra seu aluno.

**Tipo de iniciativa:** Melhoria de feature existente

**Impacto esperado:**
Reduzir churn mensal de usuários Pro de 12% para <8% nos primeiros 90 dias.
Aumentar NPS de 34 para 45+.

**Stakeholders:**
Usuários Pro ativos, sistema KRONOS (src/ai/), tabela de memória Supabase,
contextBuilder.ts
```

---

## DICAS DE USO

- **Para features P0/P1:** Preencha todos os campos. O PRD deve ser completo antes de escrever uma linha de código.
- **Para bugfixes:** Use versão reduzida (seções 1, 5, 8, 9, 10 são suficientes).
- **Para dívida técnica:** Foque nas seções 2, 6, 8, 9. Substitua "usuários" por "desenvolvedores/sistema".
- **Para exploração de hipótese:** Adicione a instrução "Gere 3 abordagens alternativas com trade-offs antes da seção 5."

---

*Versão: 1.0 — 2026-05-28*
*Projeto: KroniA — titanpro.app.br*
