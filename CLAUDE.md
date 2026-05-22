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
- **IA**: Groq API
  - Smart: `llama3-70b-8192`
  - Long context: `mixtral-8x7b-32768`
  - Fast: `llama3-8b-8192`
- **Deploy**: Vercel
- **Icons**: Lucide React (sem emojis na UI)
- **Auth**: email/password only (sem Google login)
- **Logo**: `public/logo.png` (não usar ícone Zap)

## Schema Supabase

### `profiles`

```
id          uuid  PK (ref auth.users)
nome        text
email       text
plano       text  -- 'free' | 'pro' | 'ultra'
created_at  timestamptz
```

### `body_metrics`

```
id          uuid  PK
user_id     uuid  FK profiles.id
peso_kg     numeric
altura_cm   numeric
gordura_pct numeric  -- opcional
imc         numeric  -- calculado
data        date
created_at  timestamptz
```

### `nutrition_goals`

```
id              uuid  PK
user_id         uuid  FK profiles.id
calorias_alvo   integer
proteina_g      numeric
carboidrato_g   numeric
gordura_g       numeric
data_inicio     date
ativo           boolean
```

### `lab_reports`

```
id          uuid  PK
user_id     uuid  FK profiles.id
tipo        text  -- ex: 'hemograma', 'lipidios', 'hormonal'
resultado   jsonb -- valores do exame
data_exame  date
observacoes text
created_at  timestamptz
```

### `supplement_protocols`

```
id             uuid  PK
user_id        uuid  FK profiles.id
suplemento     text
dose_mg        numeric
frequencia     text
horario        text
ativo          boolean
```

### `fadiga_scores`

```
id          uuid  PK
user_id     uuid  FK profiles.id
score       integer  -- 0-10
nota        text
created_at  timestamptz
```

### `alertas_kronos`

```
id          uuid  PK
user_id     uuid  FK profiles.id
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
- **Problema atual**: não cruza dados reais antes de gerar resposta
- **Modelo correto**: deve buscar `lab_reports`, `body_metrics`, `nutrition_goals` e `fadiga_scores` do usuário ANTES de qualquer resposta clínica
- Usa `llama3-70b-8192` para raciocínio clínico
- Usa `mixtral-8x7b-32768` para contexto longo (histórico de exames)

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

## Arquivos que NÃO devem ser modificados sem aviso

- `public/logo.png`
- Migrations Supabase já aplicadas
- Configurações de RLS existentes

## Regras de Negócio

- Features premium só para plano Pro/Ultra
- KRONOS com raciocínio clínico = Ultra only
- Dados de saúde nunca saem do Supabase sem consent explícito
- Seguir LGPD: dados sensíveis de saúde com retenção controlada
