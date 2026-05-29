# CLAUDE.md — KroniA

Leia este arquivo antes de qualquer tarefa.

---

## 0. Valide antes de agir

Este arquivo pode estar desatualizado. Na primeira sessao, antes de aplicar qualquer regra:

1. Leia a estrutura real: `package.json`, pastas principais, `vercel.json`
2. Compare com o que esta descrito aqui
3. **Reporte divergencias** — o que bate, o que nao existe, o que mudou
4. Nao corrija este arquivo sozinho. Aponte e espere ok

Se o codigo contradiz uma regra daqui, **o codigo ganha** — me avise.

---

## 1. O projeto

KroniA e um PWA de fitness e nutricao com IA (KRONOS, o coach).
Dominio: titanpro.app.br
Solo dev. Producao ativa. Dados de saude de usuarios reais.

Erro de logica clinica tem consequencia real. Trate com esse nível de cuidado.

**Arquitetura dual** (nao mudar sem entender):
- SPA vanilla na raiz: `index.html`, `app.js`, `styles.css` — frontend principal
- Next.js em `src/` — rotas, API App Router, orquestracao de IA
- Serverless functions em `api/*.js` — backend Vercel real

---

## 2. Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres, RLS ativo, regiao sa-east-1)
- Groq API: `llama3-70b-8192` (principal), `mixtral-8x7b-32768`, `llama3-8b-8192`
- Deploy: Vercel Hobby
- Distribuicao: PWA / TWA

Nao introduza lib, framework ou servico sem explicar motivo e custo de manutencao.

---

## 3. RESTRICAO CRITICA — Vercel functions

O `vercel.json` mapeia `"functions": {"api/*.js": ...}`.
Cada arquivo `.js` em `api/` consome 1 slot. O plano Hobby tem limite fixo.

**NUNCA criar arquivo novo em `api/`.**
Todo endpoint novo vai em `src/app/api/`.
Qualquer aumento de function count precisa compensar deletando outro.

---

## 4. Fontes de verdade

| Dominio | Canonico | Legado (nao escrever aqui) |
|---|---|---|
| Serverless API | `api/*.js` (imutavel, so deletar) | — |
| App Router API | `src/app/api/` | — |
| IA orchestration | `src/ai/orchestrator.ts` | `src/lib/engine/` (quase vazio) |
| AI types | `src/ai/types.ts` | `src/lib/ai/types.ts` |
| Context builder | `src/ai/contextBuilder.ts` | `src/lib/ai/context-builder.ts` |
| Embeddings | `src/ai/embeddings.ts` | `src/lib/ai/embeddings.ts` |
| Validators | `src/ai/validator.ts` | `src/lib/ai/response-validator.ts` |
| Agente clinico | `src/lib/agents/kronosAgent.ts` | — (migrado) |
| Nutricao | `src/core/nutrition/` | `src/lib/nutrition/` |

**Intent classifier: NAO consolidado.**
`src/ai/intentClassifier.ts` e `src/ai/intentAgent.ts` coexistem.
NAO criar um terceiro. Consolidar ao tocar a feature.

**Atencao:** `src/core/nutrition/` e `src/lib/nutrition/` sao quase todos `.js`.
Logica clinica em JavaScript — nao adicionar mais. Migrar para `.ts` ao tocar.

---

## 5. Checklist pre-mudanca

Antes de qualquer alteracao:

1. Cria arquivo em `api/`? → parar
2. Cria sistema paralelo ou "v2"? → parar
3. Duplica modulo canonico? → consolidar
4. Escreve em modulo legado? → justificar
5. Escreve logica clinica em `.js`? → usar `.ts`
6. Aumenta Vercel function count? → compensar com delecao
7. Esta corrigindo sintoma ou causa raiz? → preferir causa raiz

---

## 6. Regras absolutas

NUNCA:
- criar arquivo em `api/`
- criar novo orchestrator, novo intent classifier
- adicionar logica clinica em JavaScript
- criar "v2", "advanced", "experimental" ou sistemas paralelos
- fazer big bang rewrite ou freeze-and-rebuild
- criar abstracao para problema hipotetico

SEMPRE:
- TypeScript para logica de IA e clinica
- usar modulo canonico (ver tabela acima)
- consolidar ao inves de duplicar
- corrigir causa raiz quando possivel
- documentar divida tecnica nova

---

## 7. Seguranca

- `NEXT_PUBLIC_*` e o unico prefixo que vai pro browser. Nada sensivel nesse prefixo.
- `service_role` key nunca sai do servidor.
- **RLS e a fonte da verdade.** Nunca confie em filtro so no client. Toda query sensivel precisa de policy no Supabase.
- Dados de saude (exames, patologia, dieta) so acessiveis pelo proprio usuario. Confirme a policy antes de criar endpoint que toca essas tabelas.
- Valide e sanitize toda entrada de usuario antes de mandar pro banco ou pra IA.
- Nunca logue dado pessoal de saude em console ou log de producao.
- Ao editar, sinalize se introduzir: `dangerouslySetInnerHTML`, `eval`, concatenacao de SQL, input direto em shell.

---

## 8. Engines clinicas

Arquivos: `pcm_engine.js`, `training_energy_engine.js`, `metabolic_behavior_engine.js` e similares em `src/core/nutrition/`.

- Nao altere formula sem confirmar a base de calculo comigo.
- Toda mudanca precisa de exemplo entrada/saida antes e depois para eu validar.
- Use bandas de tolerancia e limites de porcao — nao trate como "preencher macro" cego.
- Logica clinica nova: sempre em `.ts`, sem fallback silencioso, sem `implicit any`.

Tudo envolvendo exames, biomarcadores, suplementos, overtraining ou fadiga:
- validar explicitamente
- preservar rastreabilidade
- evitar inferencia silenciosa

---

## 9. KRONOS

KRONOS deve cruzar dados reais do usuario (exames, dieta, treino, patologia) antes de responder.
Se o contexto nao foi buscado, busque — nao responda no vacuo.

Diferencie no raciocinio:
- **fato**: dado real do usuario
- **hipotese**: inferencia baseada em padrao
- **recomendacao**: sugestao clinica

Nao invente valor de exame nem diagnostico. Se faltar dado, diga que falta.

---

## 10. Workflow

1. **Plano antes de codar.** Liste os arquivos que vai tocar e o que muda. Espere meu ok em mudancas grandes (mais de 3 arquivos ou mudanca de schema).
2. **Uma mudanca por vez.** Nao misture refactor com feature no mesmo commit.
3. **Nao invente arquivos nem funcoes.** Leia o codigo real antes. Se nao encontrar, diga — nao suponha.
4. **Toda funcao nova tem tratamento de erro.** Nada de happy-path sozinho.
5. **Pare e pergunte** quando a tarefa estiver ambigua. Nao chute requisito.
6. **Nao delete codigo que nao entende.** Entenda primeiro.

---

## 11. Commits e deploy

- Mensagem clara em portugues: o que e por que.
- Antes de sugerir merge/deploy: liste o que pode quebrar.
- Nunca deploy direto com mudanca de schema ou policy de RLS sem eu revisar.

---

## 12. Como falar comigo

- Direto e breve.
- Se eu estiver otimista demais, vago ou pulando risco, me avise.
- Portugues informal esta ok.
