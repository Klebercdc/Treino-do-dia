## name: kronia
description: >
Contexto completo do Kronia (titanpro.app.br): stack, schema Supabase,
convenções de código, regras de negócio, modelos de IA e padrões de UI.
Ative sempre que a tarefa envolver Kronia, KRONOS, dieta, treino ou métricas do usuário.

# Kronia — Contexto do Projeto

## Identidade

- **Produto**: Kronia (ex-TITAN PRO) — PWA de fitness tracking + AI coaching
- **Tagline**: "O coach que nunca dorme."
- **Domínio**: titanpro.app.br
- **GitHub**: github.com/Klebercdc/Treino-do-dia

## Stack

- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS
- **SPA files**: `index.html`, `app.js`, `styles.css`
- **Backend**: Next.js 14 App Router (rotas em `/app/api/`)
- **Banco**: Supabase com RLS ativo em todas as tabelas
- **IA (chat geral)**: Groq API
  - Smart: `llama-3.3-70b-versatile`
  - Fast: `llama-3.1-8b-instant`
  - Vision: `meta-llama/llama-4-scout-17b-16e-instruct`
- **IA (KRONOS agêntico)**: Anthropic API
  - Modelo: `claude-sonnet-4-6`
  - Helper simples: `src/lib/services/claude.js` (usa `claude-3-5-sonnet-20241022`)
- **Deploy**: Vercel
- **Icons**: Lucide React (sem emojis na UI)
- **Auth**: email/password only (sem Google login)
- **Logo**: `public/logo.png` (não usar ícone Zap)

## Schema Supabase

### `profiles`

```
id                 uuid  PK (ref auth.users)
full_name          text
birth_date         date
sex                text
height_cm          numeric(6,2)
current_weight_kg  numeric(6,2)
goal_weight_kg     numeric(6,2)
activity_level     text
objective          text
dietary_pattern    text
allergies          text[]
intolerances       text[]
disliked_foods     text[]
liked_foods        text[]
clinical_notes     text
created_at         timestamptz
updated_at         timestamptz
```

### `user_plans`

```
user_id                  uuid  PK (ref auth.users)
plan                     text  -- 'free' | 'trial' | 'trial_ultra_7_days' | 'pro' | 'ultra'
ai_requests_used         integer
period_start             timestamptz
hotmart_subscriber_code  text
kiwify_subscriber_id     text
activated_at             timestamptz
expires_at               timestamptz
updated_at               timestamptz
```

### `body_metrics`

```
id               uuid  PK
user_id          uuid  FK auth.users
measured_at      timestamptz
weight_kg        numeric(6,2)
body_fat_percent numeric(5,2)
waist_cm         numeric(6,2)
hip_cm           numeric(6,2)
chest_cm         numeric(6,2)
arm_cm           numeric(6,2)
thigh_cm         numeric(6,2)
notes            text
created_at       timestamptz
```

### `nutrition_goals`

```
id              uuid  PK
user_id         uuid  FK auth.users
calories_target numeric(8,2)
protein_g       numeric(8,2)
carbs_g         numeric(8,2)
fat_g           numeric(8,2)
fiber_g         numeric(8,2)
water_ml        numeric(10,2)
meal_strategy   text
created_at      timestamptz
updated_at      timestamptz
```

> Sem campo `ativo`. Para a meta vigente, ordenar por `updated_at DESC LIMIT 1`.

### `lab_reports`

```
id                uuid  PK
user_id           uuid  FK auth.users
file_url          text
file_name         text
file_type         text
parsed            jsonb  -- biomarkers extraídos pelo OCR
confidence        numeric
is_valid          boolean
parse_status      text  -- 'pending' | 'parsed' | 'failed'
validation_errors jsonb
clinical_flags    jsonb
critical_flags    jsonb
created_at        timestamptz
```

> Sem campos `tipo`, `resultado` ou `data_exame`. Tipo e valores ficam dentro de `parsed`.

### `supplement_protocols`

```
id               uuid  PK
user_id          uuid  FK auth.users
supplement_name  text
dosage           text
timing           text
purpose          text
notes            text
active           boolean  -- TRUE = ativo
created_at       timestamptz
updated_at       timestamptz
```

### `fadiga_scores`

```
id          uuid  PK
user_id     uuid  FK auth.users
score       numeric(4,1)  -- 0.0–10.0
notas       text
created_at  timestamptz
```

### `alertas_kronos`

```
id          uuid  PK
user_id     uuid  FK auth.users
tipo        text  -- 'overtraining' | 'plateau' | 'deficit_proteico'
mensagem    text
lido        boolean
created_at  timestamptz
```

## Planos e Preços

|Plano|Preço   |
|-----|--------|
|Free |R$ 0    |
|Pro  |R$ 29,90|
|Ultra|R$ 59,90|

## KRONOS — AI Coach

- É o agente de IA do Kronia
- Implementado em `src/lib/agents/kronosAgent.js` (loop agêntico, até 8 iterações)
- Endpoint: `POST /api/kronos` → handler em `api/kronos.js`
- Usa `claude-sonnet-4-6` via Anthropic API (native fetch, sem SDK)
- **Fluxo obrigatório**: busca `body_metrics` → `nutrition_goals` → `lab_reports` → `fadiga_scores` → `supplement_protocols` ANTES de qualquer resposta clínica
- Cria alertas em `alertas_kronos` quando detecta overtraining, plateau ou déficit proteico
- KRONOS com raciocínio clínico = plano **Ultra** only

## Convenções de Código

### TypeScript

- Strict mode sempre
- Interfaces para tipos de dados do Supabase
- Sem `any` — usar `unknown` se necessário

### Supabase

- RLS ativo: sempre filtrar por `user_id`
- Usar `supabase.from('tabela').select().eq('user_id', userId)`
- Nunca expor dados de outros usuários

### Componentes

- Lucide React para ícones
- Tailwind para estilo
- Sem emojis na UI de produção

### API Routes

- Sempre validar session antes de qualquer query
- Retornar `{ data, error }` padronizado
- Status codes corretos (401, 403, 404, 500)

## Limite de Serverless Functions — Vercel Hobby

O plano Hobby do Vercel aceita no máximo **12 Serverless Functions** por deploy.
Funções atuais (10 JS + 1 Python + 1 cron = 12 — no limite):

| Arquivo | Tipo |
|---|---|
| `api/admin-import-exercises-auto.js` | JS |
| `api/affiliate.js` | JS |
| `api/agent.js` | JS |
| `api/chat.js` | JS |
| `api/kronia-labs.js` | JS |
| `api/memory.js` | JS |
| `api/payment-webhook.js` | JS |
| `api/plan.js` | JS |
| `api/science.js` | JS |
| `api/system.js` | JS |
| `api/exam_ocr.py` | Python |
| `api/cron/auto-import-exercises.js` | JS (cron) |

**Regra obrigatória**: nunca criar um novo arquivo em `api/` sem antes remover outro ou consolidar a rota dentro de `api/system.js` via rewrite em `vercel.json` (padrão `__route=nome`).

## Arquivos que NÃO devem ser modificados sem aviso

- `public/logo.png`
- Migrations Supabase já aplicadas
- Configurações de RLS existentes

## Regras de Negócio

- Features premium só para plano Pro/Ultra
- KRONOS com raciocínio clínico = Ultra only
- Dados de saúde nunca saem do Supabase sem consent explícito
- Seguir LGPD: dados sensíveis de saúde com retenção controlada
