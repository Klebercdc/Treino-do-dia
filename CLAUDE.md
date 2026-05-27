# CLAUDE.md — KRONIA

*Lido pelo Claude Code no início de cada sessão. Atualizar seção "Sessão Atual" antes de começar.*

-----

## Identidade do Projeto

KroniA — plataforma de saúde e performance com IA adaptativa.
Desenvolvedor solo. Deploy via GitHub + Vercel. Sem terminal direto.
Objetivo: estabilizar, consolidar e evoluir com zero regressões.
**Não redesenhar. Não refatorar por princípio. Entregar.**

-----

## Stack

- Next.js 14 App Router + TypeScript + Tailwind
- Supabase (RLS ativo, sa-east-1)
- Groq: `llama3-70b-8192` (smart) / `mixtral-8x7b-32768` (long) / `llama3-8b-8192` (fast)
- SPA vanilla: `index.html` + `app.js` + `styles.css`
- Vercel Hobby — **12/12 functions. NO LIMITE. Não criar nada em `api/`.**

-----

## Fontes de Verdade

|Domínio          |Canônico                            |Legacy / drenar                                          |
|-----------------|------------------------------------|---------------------------------------------------------|
|API              |`src/app/api/` (TypeScript)         |`api/`                                                   |
|Orquestração IA  |`src/ai/orchestrator.ts`            |`src/lib/engine/orchestrator.js`                         |
|Intent classifier|A definir após consolidação         |4 ativos, todos candidatos                               |
|Nutrição         |`src/core/nutrition/`               |`src/lib/nutrition/` (utils apenas)                      |
|AI types         |`src/ai/types.ts`                   |`src/lib/ai/types.ts`                                    |
|Context builder  |`src/ai/contextBuilder.ts`          |`src/lib/ai/context-builder.ts`                          |
|Embeddings       |`src/ai/embeddings.ts`              |`src/lib/ai/embeddings.ts`                               |
|Validators       |`src/ai/validator.ts`               |`src/lib/ai/response-validator.ts`                       |
|Agente clínico   |`src/lib/agents/kronosAgent.js`     |Migrar → `.ts` — P1 pendente, arquivo `.ts` não existe ainda|

-----

## Regras Inegociáveis

**NUNCA:**

- Criar arquivo novo em `api/`
- Criar segundo orquestrador
- Criar segundo intent classifier
- Escrever lógica clínica em JavaScript
- Adicionar lógica em módulo legacy em vez do canônico
- Propor reescrita de sistema estável sem dor real identificada
- Gerar burocracia enterprise para problema que não existe ainda

**SEMPRE:**

- Novos endpoints em `src/app/api/`
- `src/ai/orchestrator.ts` como único ponto de entrada de IA
- TypeScript para qualquer coisa clínica ou de IA
- Módulo canônico sobre o legacy
- Documentar nova dívida técnica antes de corrigir a antiga
- Preservar velocidade de entrega — um desenvolvedor, tempo finito

-----

## Checklist Antes de Qualquer Mudança

1. Adiciona arquivo em `api/`? → **parar**
1. Cria orquestrador paralelo? → **parar**
1. Cria intent classifier paralelo? → **parar**
1. Escreve em módulo legacy? → justificar ou redirecionar
1. Aumenta contagem de functions Vercel? → justificar ou compensar
1. Duplica um canônico existente? → consolidar em vez disso
1. Corrige sintoma ou causa raiz? → preferir causa raiz

-----

## Prioridades

**P0 — antes de qualquer coisa:**

- Blockers de produção
- Pressão no limite Vercel
- `api/agent.js` — código morto, deletar
- Ambiguidade de roteamento entre `api/` e `src/app/api/`

**P1 — sprint dedicado:**

- `kronosAgent.js` → `kronosAgent.ts`
- `src/ai/kronos/*.js` → `.ts`
- Consolidar 4 intent classifiers em 1
- Remover `src/lib/engine/orchestrator.js`
- Resolver módulos duplicados (types, context, embeddings, validators)
- Auditar e deletar `src/server/legacy/`

**P2 — progressivo:**

- Consolidar domínio de nutrição (core/nutrition canônico, lib/nutrition utils apenas)
- Melhorar observabilidade do pipeline de IA
- Modularização incremental do domínio de labs

-----

## Arquivos Críticos

|Arquivo                         |Status       |Ação                                                   |
|--------------------------------|-------------|-------------------------------------------------------|
|`src/ai/orchestrator.ts`        |✅ Canônico   |Ponto de entrada de toda IA                            |
|`src/lib/agents/kronosAgent.js` |⚠️ Migrar     |Clínico sem TypeScript — P1                            |
|`src/core/nutrition/`           |✅ Canônico   |Domínio de nutrição                                    |
|`api/agent.js`                  |🔴 Deletar    |Código morto, consome 1 slot Vercel                    |
|`src/lib/engine/orchestrator.js`|🔴 Legacy     |Substituir pelo canônico                               |
|`KRONIA_DIET_REBUILD.md`        |🔄 Em execução|Não alterar arquivos de dieta sem ler este doc antes   |

-----

## Formato de Resposta

**Tarefa rotineira** (bug fix, feature pequena, cleanup):

- Resposta direta, máximo 10 linhas
- Sem preâmbulo arquitetural

**Decisão P0 ou P1:**

- Problema: 2 linhas
- Solução canônica: 3 linhas
- Passos: numerados e concretos
- Riscos: só se existirem

**Nunca:**

- Abrir com "ROOT CAUSE ANALYSIS" para fix de 3 linhas
- Gerar 7 seções para tarefa simples
- Discutir escala futura antes de resolver o problema atual
- Propor solução calibrada para equipe quando há um desenvolvedor entregando

-----

## Sessão Atual

> ⚠️ **Atualizar antes de cada sessão**

```
Última sessão  : [o que foi feito]
Em aberto      : [o que ficou incompleto]
Não tocar agora: [o que está estável e não pode ser alterado]
Objetivo hoje  : [o que precisa ser feito nesta sessão]
```

-----

## Referência Completa

Visão de longo prazo, histórico de decisões e roadmap arquitetural → `ARCHITECTURE.md`

-----

*Última atualização: 2026-05-27*
