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
|P0        |Dual API surface sem roteamento documentado                  |
|P0        |Vercel 12/12 functions — no limite hard                      |
|P0        |`api/agent.js` — código morto (7 linhas, 1 slot desperdiçado)|
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

*Última atualização: 2026-05-27*
