# KRONIA — ARCHITECTURE DOCUMENT

*Visão permanente. Atualizar apenas em decisões arquiteturais maiores.*

-----

## Visão do Produto

KroniA é uma plataforma de saúde e performance com IA adaptativa.
Combina inteligência de treino, nutrição, recuperação e raciocínio clínico
em um sistema coeso, evidence-based e centrado no usuário.

**Tagline:** "O coach que nunca dorme."

-----

## Stack Técnico

|Camada        |Tecnologia                                                             |
|--------------|-----------------------------------------------------------------------|
|Frontend      |SPA vanilla (index.html / app.js / styles.css) + Next.js 14 App Router|
|Backend       |Next.js 14 App Router (src/app/api/) — **canônico**                    |
|Legacy backend|api/ Vercel Serverless — **em drenagem**                               |
|Banco de dados|Supabase (RLS ativo, sa-east-1)                                        |
|IA            |Groq API (Llama3-70b, Mixtral-8x7b, Llama3-8b)                         |
|Deploy        |Vercel Hobby → Vercel Pro (migração planejada)                         |
|Domínio       |titanpro.app.br                                                        |
|Repositório   |github.com/Klebercdc/Treino-do-dia                                     |

-----

## Tabelas Supabase Principais

- `profiles`
- `body_metrics`
- `nutrition_goals`
- `lab_reports`
- `supplement_protocols`
- `fadiga_scores`
- `alertas_kronos`

-----

## Pricing

|Plano|Preço       |
|-----|------------|
|Free |R$ 0        |
|Pro  |R$ 29,90/mês|
|Ultra|R$ 59,90/mês|

-----

## Decisões Arquiteturais Permanentes

### API

- `src/app/api/` é a camada canônica (TypeScript, Next.js App Router)
- `api/` é legacy — nenhum arquivo novo deve ser criado ali
- Migração: cada feature nova vai para `src/app/api/`, o equivalente em `api/` é removido quando possível

#### Como o roteamento funciona

O Vercel processa `vercel.json` rewrites ANTES de entregar ao Next.js.
Regra prática: se a rota está no `vercel.json`, vai para `api/`. Se não está, o Next.js serve via `src/app/api/`.

**Rotas servidas por `api/` (via vercel.json rewrite):**

| URL | Handler |
|---|---|
| `/api/kronos` | `api/system.js` |
| `/api/kronia/labs/register` | `api/system.js` |
| `/api/kronia/labs/reports` | `api/system.js` |
| `/api/kronia/labs/reports/:id` | `api/system.js` |
| `/api/kronia/labs/init-upload` | `api/system.js` |
| `/api/kronia/diet/generate` | `api/science.js` |
| `/api/kronia/diet/substitutions` | `api/science.js` |
| `/api/kronia/diet/swap` | `api/science.js` |
| `/api/kronia/diet/remove-block` | `api/science.js` |
| `/api/kronia/diet/adjust-portion` | `api/science.js` |
| `/api/kronia/diet/print` | `api/science.js` |
| `/api/system/health` | `api/system.js` |
| `/api/nutrition-calc` | `api/science.js` |
| `/api/nutrition-plan` | `api/science.js` |
| `/api/lgpd-export` | `api/system.js` |
| `/api/lgpd-delete` | `api/system.js` |
| `/api/plan-*` | `api/plan.js` |
| `/api/affiliate-*` | `api/affiliate.js` |
| `/api/science-*` | `api/science.js` |

**Rotas servidas por `src/app/api/` (Next.js, sem rewrite):**

| URL | Handler |
|---|---|
| `/api/kronia/chat` | `src/app/api/kronia/chat/route.ts` |
| `/api/kronia/chat-file` | `src/app/api/kronia/chat-file/route.ts` |
| `/api/kronia/workout` | `src/app/api/kronia/workout/route.ts` |
| `/api/kronia/workout/templates` | `src/app/api/kronia/workout/templates/route.ts` |
| `/api/kronia/exercises/*` | `src/app/api/kronia/exercises/*/route.ts` |
| `/api/kronia/intelligence` | `src/app/api/kronia/intelligence/route.ts` |
| `/api/kronia/intent` | `src/app/api/kronia/intent/route.ts` |
| `/api/labs/upload` | `src/app/api/labs/upload/route.ts` |
| `/api/labs/process` | `src/app/api/labs/process/route.ts` |
| `/api/cron/daily-dispatch` | `src/app/api/cron/daily-dispatch/route.ts` |
| `/api/cron/labs-watchdog` | `src/app/api/cron/labs-watchdog/route.ts` |
| `/api/cron/sync-exercises` | `src/app/api/cron/sync-exercises/route.ts` |

**Conflitos identificados (mesmo path, handlers diferentes — vercel.json vence):**

| URL | Ganha | Ignorado |
|---|---|---|
| `/api/kronia/labs/register` | `api/system.js` | `src/app/api/kronia/labs/register/route.ts` |
| `/api/kronia/labs/reports` | `api/system.js` | `src/app/api/kronia/labs/reports/route.ts` |
| `/api/kronia/labs/reports/[id]` | `api/system.js` | `src/app/api/kronia/labs/reports/[id]/route.ts` |
| `/api/system/health` | `api/system.js` | `src/app/api/system/health/route.ts` |

Esses arquivos em `src/app/api/` estão mortos em produção enquanto o rewrite existir.

### Orquestração

- `src/ai/orchestrator.ts` é o orquestrador canônico
- `src/lib/engine/orchestrator.js` é legacy — a ser removido
- Nenhum módulo deve operar com lógica de orquestração própria fora do orquestrador central

### Intent Classification

- Consolidar em um único classificador canônico (TypeScript)
- Os 4 atuais (`intentClassifier.ts`, `intentAgent.ts`, `core/intent/intentClassifier.js`, `lib/engine/intentClassifier.js`) são a ser drenados

### Domínio de Nutrição

- `src/core/nutrition/` é o módulo de domínio canônico
- `src/lib/nutrition/` deve conter apenas utilitários stateless
- Sem lógica de negócio de nutrição fora desses dois diretórios

### Tipagem

- Todo arquivo clínico **obrigatoriamente** em TypeScript
- `kronosAgent.js` → `kronosAgent.ts` é prioridade P1
- Arquivos em `src/ai/kronos/*.js` → `.ts` junto

### UI

- UI não contém lógica de negócio
- UI não contém lógica de IA
- Componentes são declarativos e reutilizáveis

-----

## Fonte de Verdade por Domínio

|Domínio        |Arquivo / Diretório Canônico                       |
|---------------|---------------------------------------------------|
|Orquestração IA|`src/ai/orchestrator.ts`                           |
|Agente clínico |`src/lib/agents/kronosAgent.ts` (migração pendente)|
|Nutrição       |`src/core/nutrition/`                              |
|Intent         |A definir após consolidação                        |
|Types IA       |`src/ai/types.ts`                                  |
|Context Builder|`src/ai/contextBuilder.ts`                         |
|Embeddings     |`src/ai/embeddings.ts`                             |
|Validators     |`src/ai/validator.ts`                              |

-----

## Dívida Técnica Conhecida (snapshot 2026-05-26)

|Severidade|Problema                                                     |
|----------|-------------------------------------------------------------|
|P0        |~~Dual API surface sem roteamento documentado~~ ✅ documentado|
|P0        |~~Vercel 12/12~~ → 11/12 após deleção de `api/agent.js`      |
|P0        |~~`api/agent.js`~~ ✅ deletado                               |
|P0        |4 arquivos em `src/app/api/` mortos (conflito com vercel.json)|
|P1        |4 intent classifiers paralelos                               |
|P1        |2 orquestradores paralelos                                   |
|P1        |`kronosAgent.js` sem TypeScript                              |
|P1        |Módulos duplicados (types, context, embeddings, validators)  |
|P1        |`src/server/legacy/` — verificar e deletar ou migrar         |
|P2        |45+ arquivos de nutrição em 4 diretórios                     |

-----

## Anti-Padrões Proibidos

- Criar novo arquivo em `api/`
- Criar segundo orquestrador ou intent classifier
- Escrever lógica clínica em JavaScript (apenas TypeScript)
- Colocar lógica de negócio em componente de UI
- Duplicar tabela Supabase existente
- Criar fix temporário sem documentar como dívida técnica

-----

## Roadmap Arquitetural (não é sprint — é direção)

1. Drenagem completa de `api/` → `src/app/api/`
1. Intent classifier único em TypeScript
1. Orquestrador único como ponto de entrada de toda IA
1. `kronosAgent.ts` com tipagem completa
1. Estrutura de módulos por domínio (nutrition, workout, clinical)
1. Observabilidade de pipeline de IA
1. Recovery engine com fallback estratégico

-----

*Última atualização: 2026-05-27 — P0 concluído*
