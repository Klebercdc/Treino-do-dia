# KroniA — MVP Definition
## O menor produto que prova o ciclo adaptativo

**Versão:** 1.0  
**Status:** Ativo  
**Data:** 2026-05-28

---

## 1. PRINCÍPIO DO MVP

O MVP não é uma versão menor do produto completo.

O MVP é a menor versão que responde uma pergunta específica:

> *"Se o sistema adapta o protocolo do usuário com base em dados reais de treino, o usuário confia o suficiente para retornar?"*

Se a resposta for sim, com dados, o produto completo está validado.

Se a resposta for não, é melhor descobrir agora do que depois de 18 meses de desenvolvimento.

**O que o MVP NÃO precisa provar:**
- Que o Lab Modifier funciona
- Que a Recovery Engine é precisa
- Que a nutrition adaptation é útil
- Que o sistema escala para 100k usuários

**O que o MVP PRECISA provar:**
- Usuário recebe protocolo no dia 1
- Sistema detecta padrão real nos dados do usuário
- Sistema faz uma adaptação baseada nesse padrão
- Usuário reconhece a adaptação como válida
- Usuário retorna na semana seguinte

---

## 2. ESCOPO DO MVP

### Está DENTRO do MVP

**Training Load Engine V1**  
Calcula volume semanal por grupo muscular e compara com MEV/MRV por nível.  
Simples, rule-based, sem personalização individual ainda.

**PR Detection**  
Detecta novo recorde pessoal após cada sessão via 1RM estimado (fórmula Epley).  
Zero engine complexa — apenas comparação de histórico.

**Decision Layer V1**  
Aplica mudanças pequenas automaticamente com base no Training Load.  
Rule-based. Sem ML. Conservador.

**Onboarding com Protocolo Imediato**  
5 perguntas → protocolo de treino em < 3 minutos.

**KRONOS V1 com Contexto de Adaptação**  
KRONOS já existe. Precisa receber o estado do Training Load e as adaptações aplicadas como contexto adicional.

**Notificação de Adaptação**  
Card na dashboard com o que mudou e por quê (em linguagem do usuário).

---

### Está FORA do MVP

| Feature | Por que está fora | Quando entra |
|---|---|---|
| Recovery Engine completa | Inferida passivamente pelo Training Load + RPE — suficiente para MVP | Fase 2 |
| Progress Engine | PR Detection cobre o essencial do MVP | Fase 2 |
| Adaptation Engine completa | Training Load → Decision Layer direto no MVP | Fase 2 |
| Lab Modifier | Alto custo operacional, baixo impacto no ciclo central | Fase 3 |
| Nutrition adaptation | Não está no ciclo North Star do MVP | Fase 2 |
| User Agency UI completa | Override básico (ignorar notificação) é suficiente | Fase 2 |
| Dashboard de progresso | PR Detection na notificação cobre o MVP | Fase 2 |

---

## 3. ARQUITETURA TÉCNICA DO MVP

### 3.1 Novos arquivos a criar

```
src/core/engines/
  trainingLoadEngine.ts     ← nova engine
  decisionLayerV1.ts        ← nova engine
  prDetection.ts            ← novo módulo

src/app/api/kronia/
  adaptations/route.ts      ← novo endpoint
```

---

### 3.2 Training Load Engine V1

**Arquivo:** `src/core/engines/trainingLoadEngine.ts`

**Algoritmo:**

```typescript
// MEV/MRV por nível (sets efetivos por semana)
const VOLUME_STANDARDS = {
  iniciante:    { mev: 8,  mrv: 16 },
  intermediario: { mev: 10, mrv: 20 },
  avancado:     { mev: 12, mrv: 22 },
} as const;

// Grupos musculares rastreados
const MUSCLE_GROUPS = [
  'peito', 'costas', 'ombros', 'biceps', 'triceps',
  'quadriceps', 'posterior', 'gluteos', 'panturrilha', 'abdomen'
] as const;

// RPE → fator de intensidade relativa
function rpeToIntensityFactor(rpe: number): number {
  return Math.max(0.5, rpe / 10);
}

// Calcula volume efetivo de uma sessão para um grupo muscular
function effectiveVolume(sets: WorkoutSet[], muscleGroup: string): number {
  return sets
    .filter(s => s.muscle_group === muscleGroup)
    .reduce((acc, s) => acc + rpeToIntensityFactor(s.rpe ?? 7), 0);
}

// Output por grupo muscular
type LoadState = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

function classifyLoad(
  weeklyVolume: number,
  standards: { mev: number; mrv: number }
): LoadState {
  const { mev, mrv } = standards;
  if (weeklyVolume < mev * 0.6)    return 'LOW';
  if (weeklyVolume < mrv * 0.8)    return 'MODERATE';
  if (weeklyVolume <= mrv)          return 'HIGH';
  return 'VERY_HIGH';
}

export async function computeTrainingLoad(
  userId: string,
  level: 'iniciante' | 'intermediario' | 'avancado'
): Promise<Record<string, LoadState>> {
  // Busca últimas 4 sessões (janela de 7 dias)
  const sessions = await getRecentWorkouts(userId, 7);
  const standards = VOLUME_STANDARDS[level];
  const result: Record<string, LoadState> = {};

  for (const muscle of MUSCLE_GROUPS) {
    const allSets = sessions.flatMap(s => s.sets ?? []);
    const vol = effectiveVolume(allSets, muscle);
    result[muscle] = classifyLoad(vol, standards);
  }

  return result;
}
```

**Tabela existente usada:** `workout_history` (já existe, sem migration necessária para MVP)

---

### 3.3 PR Detection

**Arquivo:** `src/core/engines/prDetection.ts`

**Algoritmo (Fórmula de Epley):**

```typescript
// 1RM estimado: weight × (1 + reps / 30)
function estimateOneRM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface PREvent {
  exerciseId: string;
  exerciseName: string;
  newOneRM: number;
  previousOneRM: number;
  improvement: number; // %
}

export async function detectPRs(
  userId: string,
  sessionId: string
): Promise<PREvent[]> {
  const session = await getSession(userId, sessionId);
  const prs: PREvent[] = [];

  for (const exercise of session.exercises) {
    const bestSet = exercise.sets
      .filter(s => s.reps >= 1 && s.reps <= 12)
      .map(s => ({ ...s, orm: estimateOneRM(s.weight_kg, s.reps) }))
      .sort((a, b) => b.orm - a.orm)[0];

    if (!bestSet) continue;

    const historicalMax = await getHistoricalMaxORM(userId, exercise.id);

    // PR se novo 1RM > histórico × 1.01 (filtro de ruído)
    if (bestSet.orm > historicalMax * 1.01) {
      await updateMaxORM(userId, exercise.id, bestSet.orm);
      prs.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        newOneRM: bestSet.orm,
        previousOneRM: historicalMax,
        improvement: ((bestSet.orm - historicalMax) / historicalMax) * 100,
      });
    }
  }

  return prs;
}
```

**Migration necessária:**

```sql
-- Tabela para armazenar máximos históricos por exercício
CREATE TABLE IF NOT EXISTS exercise_personal_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  max_1rm_kg  NUMERIC(6,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  UUID,
  UNIQUE (user_id, exercise_id)
);

ALTER TABLE exercise_personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_records" ON exercise_personal_records
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_pr_user_exercise ON exercise_personal_records(user_id, exercise_id);
```

---

### 3.4 Decision Layer V1

**Arquivo:** `src/core/engines/decisionLayerV1.ts`

```typescript
export interface Adaptation {
  type: 'VOLUME_INCREASE' | 'VOLUME_DECREASE' | 'PR_CELEBRATED' | 'OVERLOAD_WARNING';
  muscleGroup?: string;
  message: string;            // linguagem do usuário
  technicalReason: string;    // contexto para KRONOS
  isAutomatic: boolean;       // true = aplicada sem confirmação
}

export async function computeAdaptations(
  userId: string,
  trainingLoad: Record<string, LoadState>,
  prEvents: PREvent[]
): Promise<Adaptation[]> {
  const adaptations: Adaptation[] = [];

  // Regra 1: VERY_HIGH por 2+ semanas → reduz 1 série
  for (const [muscle, state] of Object.entries(trainingLoad)) {
    if (state === 'VERY_HIGH') {
      const consecutiveWeeks = await getConsecutiveHighWeeks(userId, muscle);
      if (consecutiveWeeks >= 2) {
        adaptations.push({
          type: 'VOLUME_DECREASE',
          muscleGroup: muscle,
          message: `Reduzimos 1 série de ${muscle} na próxima semana. Você está acima do volume ideal há 2 semanas.`,
          technicalReason: `Training Load VERY_HIGH por ${consecutiveWeeks} semanas consecutivas. Cumulative fatigue acumulada.`,
          isAutomatic: true,
        });
      }
    }

    // Regra 2: LOW por 3+ semanas → adiciona 1 série
    if (state === 'LOW') {
      const consecutiveLowWeeks = await getConsecutiveLowWeeks(userId, muscle);
      if (consecutiveLowWeeks >= 3) {
        adaptations.push({
          type: 'VOLUME_INCREASE',
          muscleGroup: muscle,
          message: `Adicionamos 1 série de ${muscle}. Você está abaixo do volume mínimo há 3 semanas.`,
          technicalReason: `Training Load LOW por ${consecutiveLowWeeks} semanas. Volume abaixo do MEV — estímulo insuficiente.`,
          isAutomatic: true,
        });
      }
    }
  }

  // Regra 3: PRs detectados → celebração
  for (const pr of prEvents) {
    adaptations.push({
      type: 'PR_CELEBRATED',
      message: `Novo recorde em ${pr.exerciseName}. ${pr.improvement.toFixed(1)}% acima da sua melhor marca.`,
      technicalReason: `PR detectado. 1RM estimado: ${pr.newOneRM.toFixed(1)}kg vs anterior ${pr.previousOneRM.toFixed(1)}kg.`,
      isAutomatic: true,
    });
  }

  return adaptations;
}
```

---

### 3.5 Tabela de Adaptation Events

**Migration:**

```sql
CREATE TABLE adaptation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  muscle_group    TEXT,
  message         TEXT NOT NULL,
  technical_reason TEXT NOT NULL,
  is_automatic    BOOLEAN DEFAULT true,
  week_of         DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  outcome         TEXT  -- 'accepted' | 'rejected' | 'ignored'
);

ALTER TABLE adaptation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_adaptations" ON adaptation_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_adaptations_user_week ON adaptation_events(user_id, week_of DESC);
```

---

### 3.6 Novo Endpoint

**Arquivo:** `src/app/api/kronia/adaptations/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/kronia/adaptations
// Retorna adaptações pendentes da semana atual
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekStart = getWeekStart(new Date());

  const { data, error } = await supabase
    .from('adaptation_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('week_of', weekStart.toISOString())
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ adaptations: data });
}

// POST /api/kronia/adaptations
// Registra acknowledgment de uma adaptação
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { adaptationId, outcome } = await req.json();

  const { error } = await supabase
    .from('adaptation_events')
    .update({
      acknowledged_at: new Date().toISOString(),
      outcome,
    })
    .eq('id', adaptationId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

---

### 3.7 Integração com KRONOS

No `contextBuilder.ts`, adicionar ao bundle de contexto:

```typescript
// Busca adaptações da semana para injetar no contexto do KRONOS
const adaptations = await supabase
  .from('adaptation_events')
  .select('type, muscle_group, message, technical_reason, week_of')
  .eq('user_id', userId)
  .gte('week_of', weekStart)
  .order('created_at', { ascending: false })
  .limit(5);

// Injetar no system prompt como contexto adicional
const adaptationContext = adaptations.data?.length
  ? `\nADAPTAÇÕES DESTA SEMANA:\n${adaptations.data.map(a =>
      `- ${a.type}: ${a.technical_reason}`
    ).join('\n')}`
  : '';
```

---

### 3.8 Trigger do Pipeline

O pipeline do MVP roda automaticamente após cada sessão de treino registrada.

No endpoint `workout/route.ts`, após salvar a sessão:

```typescript
// Disparar pipeline assíncrono (não bloqueia resposta ao usuário)
await triggerAdaptationPipeline(userId, sessionId);
```

```typescript
// src/core/engines/adaptationPipeline.ts
export async function triggerAdaptationPipeline(userId: string, sessionId: string) {
  try {
    const [profile, trainingLoad, prs] = await Promise.all([
      getUserProfile(userId),
      computeTrainingLoad(userId, profile.level),
      detectPRs(userId, sessionId),
    ]);

    const adaptations = await computeAdaptations(userId, trainingLoad, prs);

    // Salvar apenas se há adaptações novas
    if (adaptations.length > 0) {
      await saveAdaptationEvents(userId, adaptations);
    }
  } catch (err) {
    // Pipeline failure nunca quebra a experiência do usuário
    console.error('[AdaptationPipeline] Error:', err);
  }
}
```

---

## 4. ONBOARDING COM PROTOCOLO IMEDIATO

### 5 Perguntas (máximo)

1. **Objetivo** → ganhar músculo / perder gordura / melhorar performance / saúde geral
2. **Nível de experiência** → iniciante (< 1 ano) / intermediário (1–4 anos) / avançado (4+ anos)
3. **Frequência disponível** → 2x / 3x / 4x / 5x+ por semana
4. **Restrições** → alguma lesão ou limitação? (opcional)
5. **Tempo por sessão** → < 45 min / 45–60 min / 60–90 min / 90+ min

Com essas 5 respostas, o sistema gera:
- Divisão de treino adequada (Full Body / PPL / Upper-Lower / etc.)
- Volume inicial por grupo muscular (baseado em MEV + nível)
- Protocolo da primeira semana completo

**Meta:** usuário vê o primeiro treino em < 3 minutos após cadastro.

---

## 5. CRITÉRIOS DE SUCESSO DO MVP

### Critérios de validação (após 30 dias com usuários reais)

| Pergunta de validação | Métrica | Threshold de sucesso |
|---|---|---|
| O sistema adapta? | % de usuários que receberam ≥ 1 adaptação automática | > 60% dos usuários com ≥ 3 semanas |
| O usuário reconhece? | % de adaptações automáticas não recusadas | > 80% |
| O usuário retorna? | Retenção semana 4 para usuários que receberam adaptação | > 45% |
| O ciclo funciona? | % que completou ciclo North Star (adaptação → execução → retorno) | > 35% |
| O PR cria engajamento? | Sessões registradas na semana seguinte a um PR | > 70% |

Se qualquer threshold cair abaixo do target, investigar antes de construir Fase 2.

### Red flags que indicam problema fundamental

- Usuários recusam > 30% das adaptações automáticas → o critério de "mudança pequena" está errado
- Retenção semana 4 < 25% mesmo com adaptações → o produto certo, onboarding errado
- Nenhum PR detectado após 4 semanas → dados insuficientes (usuários não registrando RPE)

---

## 6. TIMELINE ESTIMADO (Solo Dev)

| Semana | Entrega |
|---|---|
| 1–2 | Migration de tabelas + Training Load Engine V1 |
| 3 | PR Detection + adaptation_events table |
| 4 | Decision Layer V1 + pipeline trigger |
| 5 | Endpoint /adaptations + integração KRONOS context |
| 6 | UI: card de adaptação na dashboard + notificação |
| 7 | Onboarding refatorado com protocolo imediato |
| 8 | Testes E2E do ciclo completo + ajustes |

**Pré-requisito absoluto antes da Semana 1:**
- Vercel ≤ 11/12 functions (remover `api/agent.js`)
- Intent classifier consolidado

---

## 7. O QUE MEDIR DURANTE O MVP

### Eventos a rastrear (analytics)

```typescript
// Registrar em kronia_intelligence_events
const MVP_EVENTS = {
  ONBOARDING_COMPLETED:     'onboarding_completed',       // tempo até protocolo gerado
  FIRST_WORKOUT_REGISTERED: 'first_workout_registered',   // D0 de ativação
  ADAPTATION_RECEIVED:      'adaptation_received',        // tipo + grupo muscular
  ADAPTATION_ACKNOWLEDGED:  'adaptation_acknowledged',    // accepted/rejected/ignored
  PR_DETECTED:              'pr_detected',                // exercício + % de melhora
  CYCLE_COMPLETED:          'north_star_cycle_completed', // adaptação → execução → retorno
  KRONOS_ASKED_ABOUT_ADAPTATION: 'kronos_adaptation_query', // usuário pediu explicação
};
```

### Query de validação do North Star (SQL)

```sql
-- Usuários que completaram o ciclo North Star no período
WITH adaptations AS (
  SELECT DISTINCT user_id, week_of
  FROM adaptation_events
  WHERE created_at > NOW() - INTERVAL '30 days'
),
executions AS (
  SELECT DISTINCT user_id, DATE_TRUNC('week', trained_at) AS trained_week
  FROM workout_history
  WHERE trained_at > NOW() - INTERVAL '30 days'
),
returns AS (
  SELECT DISTINCT a.user_id
  FROM adaptations a
  JOIN executions e ON e.user_id = a.user_id
    AND e.trained_week >= a.week_of
  JOIN executions e2 ON e2.user_id = a.user_id
    AND e2.trained_week > e.trained_week
)
SELECT
  COUNT(*) AS north_star_users,
  (SELECT COUNT(DISTINCT user_id) FROM executions) AS total_active_users,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(DISTINCT user_id) FROM executions), 0) * 100, 1) AS north_star_pct
FROM returns;
```

---

## 8. DEFINIÇÃO DE DONE DO MVP

O MVP está concluído quando:

- [ ] Usuário cadastra e recebe protocolo em < 3 minutos
- [ ] Training Load Engine calcula após cada sessão registrada (< 3s)
- [ ] PR Detection funciona para qualquer exercício com ≥ 2 registros
- [ ] Decision Layer aplica ≥ 1 mudança pequena para usuário com ≥ 3 semanas de dados
- [ ] Adaptação aparece na dashboard com linguagem do usuário
- [ ] KRONOS recebe contexto de adaptação e consegue explicá-la
- [ ] Pipeline falha silenciosamente sem afetar a experiência do usuário
- [ ] RLS: usuário A não acessa adaptações do usuário B
- [ ] Zero regressão em funcionalidades existentes
- [ ] North Star query retorna dados corretos

---

*Versão: 1.0 — 2026-05-28*  
*KroniA — titanpro.app.br*
