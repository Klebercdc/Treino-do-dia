# Explicação completa do ajuste de casing de planos (sem resumo)

Este documento descreve integralmente o que foi alterado para corrigir inconsistências de `casing` (maiúsculas/minúsculas) no fluxo de plano do usuário, por que isso foi feito, quais riscos existiam antes, qual foi a estratégia adotada e como validar o comportamento após a mudança.

## 1) Problema observado

O projeto possui múltiplos pontos de leitura/escrita de plano (`free`, `pro`, `ultra`, `trial`, `trial_ultra_7_days`) com convenções diferentes entre backend, domínio e frontend:

- O domínio canônico em `src/types/domain.js` usa valores em maiúsculo (`FREE`, `PRO`, `ULTRA`, `TRIAL_ULTRA_7_DAYS`).
- A camada de banco/frontend histórico usa frequentemente minúsculo (`free`, `pro`, `ultra`, `trial_ultra_7_days`).
- Parte da lógica visual no `plans.js` depende de comparações estritas em minúsculo.

Quando um ponto da aplicação envia plano em casing diferente do esperado por outro ponto, surgem efeitos colaterais, por exemplo:

- Badge do plano mostrando estado incorreto.
- Cálculo de trial não entrando no ramo esperado.
- Comportamentos condicionais de interface tratando usuário pago como gratuito por mismatch de string.

## 2) Risco técnico antes da correção

No `plans.js`, a função que busca dados do usuário (`fetchUserPlan`) atribuía `res.data.plan` diretamente ao estado `_userPlan.plan` sem normalização. Isso deixa a aplicação sensível ao formato retornado na origem dos dados. Se a origem retornar `PRO`, `ULTRA` ou `TRIAL_ULTRA_7_DAYS`, as comparações que esperam `pro`, `ultra` e `trial_ultra_7_days` falham.

Como exemplo prático: `isPro` é calculado com `plan === 'pro' || isUltra`; se vier `PRO`, essa condição não ativa. Resultado: UX incoerente.

## 3) Estratégia de correção aplicada

A abordagem foi centralizar normalização no frontend onde o estado de exibição é consumido:

1. Criar uma função explícita de normalização de plano no `plans.js`.
2. Aplicar essa função no ponto único de hidratação de estado (`fetchUserPlan`).
3. Preservar compatibilidade retroativa com valor legado `trial`.
4. Definir fallback seguro para `free` quando vier valor desconhecido.

Essa estratégia é deliberadamente defensiva: mesmo com variações de origem, o estado interno do front fica sempre previsível.

## 4) Alterações realizadas arquivo por arquivo

### 4.1) `plans.js`

Foi adicionada a função:

- `normalizePlanId(plan)`

Regras implementadas:

- Converte entrada para string, remove espaços e aplica `toLowerCase()`.
- Se valor for `trial` **ou** `trial_ultra_7_days`, retorna `trial_ultra_7_days`.
- Se valor for `free`, `pro` ou `ultra`, retorna o próprio valor normalizado.
- Para qualquer valor não reconhecido, retorna `free` (fallback seguro).

Depois disso, no `fetchUserPlan()`, o campo:

- `plan: res.data.plan`

foi substituído por:

- `plan: normalizePlanId(res.data.plan)`

Com isso, `_userPlan.plan` deixa de depender de casing externo e passa a respeitar contrato interno único.

### 4.2) `src/app/api/chat/route.js`

Foi ajustado o mock local de usuário para usar `PRO` (maiúsculo) ao invés de `pro`, mantendo coerência com o domínio canônico quando esse mock for utilizado em validações/experimentos dessa rota.

## 5) O que **não** foi alterado (intencionalmente)

- Não foi modificada a modelagem SQL.
- Não foi alterado o contrato público das APIs.
- Não foi mudado o shape de resposta de endpoints de plano.
- Não foi adicionada regra de negócio nova de billing/trial.

O ajuste foi focado exclusivamente em robustez de normalização e consistência de casing no ponto de consumo de UI.

## 6) Impacto esperado após a correção

Após a mudança:

- Valores `PRO`/`ULTRA`/`TRIAL_ULTRA_7_DAYS` vindos de backend não quebram a UI.
- Comparações da tela de planos ficam determinísticas.
- Fluxo de trial não depende de variação de casing da origem.
- Reduz risco de regressão silenciosa quando diferentes módulos evoluem com convenções de string distintas.

## 7) Justificativa para mapear `trial` -> `trial_ultra_7_days`

Havia coexistência de nomenclaturas (`trial` e `trial_ultra_7_days`) no histórico. Para manter comportamento uniforme e evitar ramos duplicados na UI, foi escolhido um identificador único interno (`trial_ultra_7_days`).

Com isso:

- Dados antigos com `trial` continuam funcionando.
- Novos dados com `trial_ultra_7_days` também funcionam.
- A lógica de exibição pode evoluir sobre um único nome canônico interno no frontend.

## 8) Validação executada

Foram executadas verificações sintáticas com Node para garantir que os arquivos alterados continuam válidos:

- `node --check plans.js`
- `node --check src/app/api/chat/route.js`

Ambos passaram sem erro.

## 9) Como conferir manualmente no produto

Passo a passo sugerido para QA manual:

1. Autenticar com usuário cujo `user_plans.plan` esteja em minúsculo (`pro`) e conferir badge/estado de plano.
2. Atualizar valor para maiúsculo (`PRO`) e repetir; o comportamento deve permanecer idêntico.
3. Repetir para `ULTRA`/`ultra`.
4. Repetir para `trial` e `trial_ultra_7_days`, validando exibição de trial e dias restantes.
5. Testar valor inválido (ex.: `enterprise`) e confirmar fallback para comportamento de `free`.

## 10) Benefício de manutenção

A normalização explícita em função dedicada reduz dívida técnica porque:

- Isola regra de compatibilidade em um único local.
- Facilita revisão futura de novos planos.
- Diminui propagação de `if/else` de casing espalhados pela UI.

Se novos planos forem adicionados, basta evoluir `normalizePlanId` de forma centralizada.

