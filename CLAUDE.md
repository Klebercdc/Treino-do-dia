# CLAUDE.md — KRONIA

Lido automaticamente pelo Claude Code no início de cada sessão.

Objetivo:
estabilizar, consolidar e evoluir o KroniA com segurança e velocidade.

NÃO:
- redesenhar arquitetura
- refatorar por estética
- criar sistemas paralelos
- criar burocracia enterprise

SIM:
- consolidar
- simplificar
- remover duplicação
- entregar sem regressão

━━━━━━━━━━━━━━━━━━━━
# CONTEXTO DO PROJETO
━━━━━━━━━━━━━━━━━━━━

KroniA é uma plataforma de saúde e performance com IA adaptativa.

Realidade atual:
- produção ativa
- desenvolvedor solo
- deploy via GitHub + Vercel
- sem terminal local
- velocidade importa
- regressão é inaceitável

Stack:
- Next.js 14 App Router
- TypeScript
- Tailwind
- Supabase
- Vercel Hobby
- SPA vanilla (`index.html`, `app.js`, `styles.css`)

Modelos IA:
- llama3-70b-8192 → smart
- mixtral-8x7b-32768 → long
- llama3-8b-8192 → fast

━━━━━━━━━━━━━━━━━━━━
# RESTRIÇÃO CRÍTICA
━━━━━━━━━━━━━━━━━━━━

Vercel Hobby está em:
12/12 functions.

NÃO criar novos arquivos em:
`/api`

Todo endpoint novo:
→ `src/app/api/`

━━━━━━━━━━━━━━━━━━━━
# FONTES DE VERDADE
━━━━━━━━━━━━━━━━━━━━

| Domínio | Canônico | Legacy |
|---|---|---|
| API | `src/app/api/` | `api/` |
| IA orchestration | `src/ai/orchestrator.ts` | `src/lib/engine/orchestrator.js` |
| Nutrição | `src/core/nutrition/` | `src/lib/nutrition/` |
| AI types | `src/ai/types.ts` | `src/lib/ai/types.ts` |
| Context builder | `src/ai/contextBuilder.ts` | `src/lib/ai/context-builder.ts` |
| Embeddings | `src/ai/embeddings.ts` | `src/lib/ai/embeddings.ts` |
| Validators | `src/ai/validator.ts` | `src/lib/ai/response-validator.ts` |
| Agente clínico | `kronosAgent.js` (atual) | Migrar → `.ts` — P1 pendente, `.ts` não existe ainda |

Intent classifier:
- ainda não consolidado
- NÃO criar novo
- consolidar os existentes

━━━━━━━━━━━━━━━━━━━━
# REGRAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━

NUNCA:
- criar arquivos em `/api`
- criar novo orchestrator
- criar novo intent classifier
- adicionar lógica em módulos legacy
- escrever lógica clínica em JavaScript
- criar "v2", "advanced", "experimental" ou sistemas paralelos
- propor rewrite massivo sem dor real
- criar abstrações para problemas hipotéticos
- mover centenas de arquivos por organização estética

SEMPRE:
- usar TypeScript para IA e clínica
- usar módulos canônicos
- consolidar ao invés de duplicar
- corrigir causa raiz quando possível
- preservar compatibilidade quando necessário
- priorizar entrega segura
- documentar dívida técnica nova

━━━━━━━━━━━━━━━━━━━━
# ESTRATÉGIA DE MIGRAÇÃO
━━━━━━━━━━━━━━━━━━━━

Migrar gradualmente.

Preferir:
- consolidar durante trabalho normal
- substituir legacy ao tocar feature relacionada
- remover adapters mortos progressivamente

Evitar:
- big bang rewrite
- freeze-and-rebuild
- branches longos de migração

━━━━━━━━━━━━━━━━━━━━
# SEGURANÇA CLÍNICA
━━━━━━━━━━━━━━━━━━━━

Tudo envolvendo:
- exames
- biomarcadores
- suplementos
- overtraining
- fadiga
- recomendações clínicas

Deve:
- usar TypeScript
- evitar fallback silencioso
- evitar implicit any
- validar explicitamente
- preservar rastreabilidade

━━━━━━━━━━━━━━━━━━━━
# CHECKLIST OBRIGATÓRIO
━━━━━━━━━━━━━━━━━━━━

Antes de qualquer mudança:

1. Cria arquivo em `/api`?
→ parar

2. Cria sistema paralelo?
→ parar

3. Duplica módulo canônico?
→ consolidar

4. Escreve em legacy?
→ justificar

5. Aumenta Vercel function count?
→ compensar

6. Corrige sintoma ou causa raiz?
→ preferir causa raiz

━━━━━━━━━━━━━━━━━━━━
# PRIORIDADES
━━━━━━━━━━━━━━━━━━━━

P0
- blockers produção
- pressão Vercel
- `api/agent.js`
- ambiguidade de roteamento

P1
- `kronosAgent.js` → `.ts`
- consolidar intent classifiers
- remover orchestrator legacy
- consolidar módulos duplicados
- auditar `src/server/legacy/`

P2
- consolidar nutrição
- melhorar observabilidade
- modularização incremental

━━━━━━━━━━━━━━━━━━━━
# ARQUIVOS CRÍTICOS
━━━━━━━━━━━━━━━━━━━━

| Arquivo | Status | Ação |
|---|---|---|
| `src/ai/orchestrator.ts` | canônico | ponto de entrada de toda IA |
| `src/lib/agents/kronosAgent.js` | migrar urgente | não tocar sem migrar para `.ts` |
| `src/core/nutrition/` | domínio oficial | canônico de nutrição |
| `api/agent.js` | deletar | código morto, consome 1 slot Vercel |
| `src/lib/engine/orchestrator.js` | remover | substituir pelo canônico |
| `KRONIA_DIET_REBUILD.md` | rebuild ativo | não alterar arquivos de dieta sem ler antes |

━━━━━━━━━━━━━━━━━━━━
# FORMATO DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━

Tarefas simples:
- direto
- curto
- sem relatório gigante

P0/P1:
- problema
- solução
- passos
- riscos (se existirem)

NÃO:
- criar whitepaper para bug simples
- discutir escala futura irrelevante
- propor estrutura enterprise incompatível com solo dev

━━━━━━━━━━━━━━━━━━━━
# SESSÃO ATUAL
━━━━━━━━━━━━━━━━━━━━

Atualizar antes de começar:

Última sessão:
[preencher]

Em aberto:
[preencher]

Não tocar:
[preencher]

Objetivo hoje:
[preencher]

━━━━━━━━━━━━━━━━━━━━
# DIRETIVA FINAL
━━━━━━━━━━━━━━━━━━━━

KroniA não precisa de mais arquitetura.

Precisa de:
- menos duplicação
- ownership claro
- consolidação
- estabilidade
- velocidade
- evolução controlada

Agir como principal engineer pragmático.
Não como arquiteto enterprise teórico.
