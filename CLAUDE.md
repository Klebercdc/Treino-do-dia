# CLAUDE.md — KRONIA

*Lido pelo Claude Code no início de cada sessão. Manter atualizado.*

-----

## Identidade do Projeto

KroniA — plataforma de saúde e performance com IA adaptativa.
Desenvolvedor solo. Deploy via GitHub + Vercel. Sem terminal direto.

-----

## Stack

- Next.js 14 App Router + TypeScript + Tailwind
- Supabase (RLS, sa-east-1)
- Groq API: `llama3-70b-8192` (smart) / `mixtral-8x7b-32768` (long) / `llama3-8b-8192` (fast)
- SPA vanilla: `index.html` + `app.js` + `styles.css`
- Vercel Hobby — **12/12 functions. NO LIMITE. Não criar nada em `api/`.**

-----

## Regras Inegociáveis (5)

1. **API canônica é `src/app/api/`** — nunca criar arquivo novo em `api/`
1. **Orquestrador único é `src/ai/orchestrator.ts`** — nunca criar segundo orquestrador
1. **Componente clínico = TypeScript obrigatório** — kronosAgent e kronos/* são prioridade de migração
1. **Uma fonte de verdade por domínio** — nunca duplicar classifier, validator, context builder
1. **UI não tem lógica de negócio** — nunca colocar cálculo ou chamada de IA em componente

-----

## Arquivos Críticos

|Arquivo                         |Status       |Observação                             |
|--------------------------------|-------------|---------------------------------------|
|`src/ai/orchestrator.ts`        |✅ Canônico   |Ponto de entrada de toda IA            |
|`src/lib/agents/kronosAgent.js` |⚠️ Migrar     |Clínico sem TypeScript — P1            |
|`src/core/nutrition/`           |✅ Canônico   |Domínio de nutrição                    |
|`api/agent.js`                  |🔴 Deletar    |Código morto, consome 1 slot Vercel    |
|`src/lib/engine/orchestrator.js`|🔴 Legacy     |Substituir por `src/ai/orchestrator.ts`|
|`KRONIA_DIET_REBUILD.md`        |🔄 Em execução|Rebuild ativo do fluxo de dieta        |

-----

## Dívida Técnica Ativa

- 4 intent classifiers paralelos → consolidar em 1 TypeScript
- 2 orquestradores → `src/ai/orchestrator.ts` é o canônico
- Módulos duplicados: types, context, embeddings, validators em `src/ai/` vs `src/lib/ai/`
- `src/server/legacy/` → auditar e deletar

-----

## Contexto da Sessão Atual

> **⚠️ Atualizar esta seção antes de cada sessão nova**

```
Última sessão: [descrever o que foi feito]
Em aberto: [descrever o que ficou incompleto]
Não tocar agora: [listar o que não pode ser alterado nesta sessão]
Objetivo desta sessão: [descrever claramente o que precisa ser feito]
```

-----

## Preferências de Execução

- Executar diretamente sem perguntas clarificatórias
- Priorizar soluções de causa raiz sobre patches temporários
- Qualquer novo arquivo deve seguir a estrutura canônica documentada no ARCHITECTURE.md
- Se identificar dívida técnica nova, documentar aqui antes de corrigir

-----

## Referência Completa

Para visão, princípios e histórico arquitetural completo → `ARCHITECTURE.md`

-----

*Última atualização: 2026-05-27*
*Próxima atualização: antes da próxima sessão de desenvolvimento*
