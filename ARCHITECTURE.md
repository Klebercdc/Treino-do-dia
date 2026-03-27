# KRONIA — Clean Architecture (Interface → Application → Domain → Infrastructure)

## 1) Objetivo
Toda regra de negócio deve viver na camada de aplicação (use-cases + orchestrators), nunca em páginas/componentes/handlers de UI.

## 2) Camadas
- **Interface**: páginas/componentes declarativos, coleta de eventos, chamadas para `window.KroniaApplication.application.*`.
- **Application**: casos de uso, guards, state machine implícita e resolução de rotas de negócio.
- **Domain**: estados, políticas de transição, validações puras.
- **Infrastructure**: persistência, integrações Supabase/IA/Edge e logging estruturado.

## 3) Módulos de domínio (isolados)
- `auth`
- `onboarding`
- `profile`
- `workout`
- `diet`
- `supplements`
- `chat`
- `plans`
- `subscriptions`
- `logs`
- `rag`
- `system-check`

A comunicação entre módulos deve ocorrer via contratos explícitos.

## 4) Casos de uso obrigatórios (camada de aplicação)
- `resolveInitialRoute`
- `resolvePostLoginRoute`
- `completeOnboarding`
- `saveUserProfile`
- `generateWorkoutPlan`
- `generateDietPlan`
- `generateSupplementProtocol`
- `classifyChatIntent`
- `processChatMessage`
- `loadUserDashboard`
- `updatePlan`
- `approvePlan`
- `validateAccess`
- `resolveNextAction`
- `handleBusinessError`

## 5) Contrato padrão de resposta
Todos os casos de uso retornam obrigatoriamente:

```ts
{
  status: 'success' | 'error',
  data: unknown,
  errors: Array<{ code: string; message: string }>,
  nextAction: { route?: string; action?: string } | null
}
```

## 6) Estados de jornada
`visitor`, `authenticated`, `onboarding_pending`, `onboarding_in_progress`, `onboarding_completed`, `plan_not_created`, `plan_generating`, `plan_generated`, `plan_active`, `plan_expired`, `blocked`.

Transições inválidas devem retornar `INVALID_STATE`.

## 7) Erros padronizados
`PROFILE_INCOMPLETE`, `PLAN_NOT_FOUND`, `UNAUTHORIZED`, `SUBSCRIPTION_REQUIRED`, `INVALID_STATE`, `AI_FAILURE`, `SYSTEM_ERROR`.

## 8) Segurança
- Sem uso de `SERVICE_ROLE` no client.
- Operações sensíveis apenas no server/edge.
- Validação de entrada obrigatória para todo fluxo.

## 9) Observabilidade
Todo fluxo crítico registra: `userId`, ação, entrada, resultado, erro, timestamp e contexto.
