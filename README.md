# KRONIA — App de Musculação com IA

> Coach inteligente de treino com periodização científica MEV/MAV/MRV e IA conversacional (KRONOS)

[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E)](https://supabase.com)
[![Pagamento](https://img.shields.io/badge/Pagamento-Hotmart%20%7C%20Kiwify-orange)](https://hotmart.com)

---

## Visão Geral

O KRONIA é uma **Progressive Web App (PWA)** de musculação voltada para o mercado brasileiro. Combina registro de treinos, análise de progresso com periodização científica e um coach de IA conversacional chamado **KRONOS**, que responde com base no histórico real do usuário.

### Diferenciais

- **KRONOS** — IA coach em PT-BR, analisa fadiga (RPE), volume e histórico para sugerir ajustes
- **Periodização científica** — MEV, MAV e MRV automaticamente calculados por grupo muscular
- **Offline-first** — funciona sem internet dentro da academia
- **Freemium pronto** — quota de uso, paywall e integração com Hotmart/Kiwify já implementados
- **LGPD compliance** — exportação e deleção de dados implementadas

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS (PWA) |
| Backend | Vercel Serverless (Node.js) |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth (Google OAuth + Email) |
| IA — modelos | NVIDIA (Mixtral-8x7B, Llama3-70B) + Google Gemini |
| Gráficos | Chart.js + D3.js |
| Pagamento | Hotmart + Kiwify (webhooks) |
| Hospedagem | Vercel |

---

## Funcionalidades

### Free
- Registro de treinos (carga, reps, RPE por série)
- Treinos prontos (divisões 2 a 6 dias)
- Timer de descanso com haptic feedback
- Histórico de sessões (últimas 80)
- Supersets
- Cálculo automático de 1RM
- Sincronização na nuvem (Supabase)
- Calculadora de macros e dieta
- Streak de consistência

### PRO (plano pago)
- KRONOS — coach de IA ilimitado
- Análise avançada de periodização
- Detecção de PRs e volume tracking
- Score de fadiga e prontidão
- Geração de protocolo personalizado por IA
- Log por voz (speech recognition)
- Transforms Engine (análise estilo Maltego)

---

## Estrutura de Arquivos

```
/
├── index.html              # App principal (shell HTML + todas as telas)
├── app.js                  # Lógica do frontend (5.100 linhas)
├── auth.js                 # Supabase Auth + sync
├── styles.css              # Design system + temas
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache offline)
├── transforms_engine.js    # Engine de análise de progresso
├── transform_kernel.js     # Kernel de cálculos de periodização
├── kronos_pulse.js         # Sistema de notificações proativas do KRONOS
├── plans.js                # Gerenciamento de planos (frontend)
├── icons.js                # Biblioteca de ícones SVG
│
├── api/                    # Vercel Serverless Functions
│   ├── _auth.js            # Middleware de autenticação JWT
│   ├── _cors.js            # Headers CORS
│   ├── _gemini.js          # Integração Google Gemini
│   ├── _nvidia.js          # Integração NVIDIA AI
│   ├── _plans.js           # Lógica de planos e quotas
│   ├── _ratelimit.js       # Rate limiting por usuário
│   ├── _logger.js          # Logger de uso de AI
│   ├── chat.js             # Endpoint principal do KRONOS
│   ├── agent.js            # Agent de treino avançado
│   ├── config.js           # Configuração pública do app
│   ├── payment-webhook.js  # Webhook Hotmart + Kiwify
│   ├── lgpd-export.js      # Exportação de dados (LGPD Art. 18)
│   └── lgpd-delete.js      # Deleção de dados (LGPD Art. 18)
│
└── supabase/
    ├── config.toml         # Configuração do projeto Supabase
    └── migrations/         # Migrations SQL
```

---

## Configuração do Ambiente

### Variáveis de Ambiente (Vercel)

```env
# Supabase
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=eyJ...           # Chave pública (anon)
SUPABASE_SERVICE_KEY=eyJ...        # Chave service_role (privada — nunca expor)

# IA
NVIDIA_API_KEY=nvapi-...
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...               # Opcional (fallback)

# Pagamento
HOTMART_TOKEN=...                  # Token de validação dos webhooks Hotmart
KIWIFY_SECRET=...                  # Secret dos webhooks Kiwify
CHECKOUT_URL=https://hotmart.com/... # URL do checkout PRO

# Configuração
FREE_AI_LIMIT=15                   # Requisições gratuitas por mês
```

### Setup Local

```bash
# 1. Clone o repositório
git clone <repo-url>
cd Treino-do-dia

# 2. Instale a Vercel CLI
npm install -g vercel

# 3. Configure variáveis de ambiente
vercel env pull .env.local

# 4. Rode localmente
vercel dev

# O app estará disponível em http://localhost:3000
```

### Deploy em Produção

```bash
vercel --prod
```

---

## Banco de Dados (Supabase)

### Schema Principal

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Configurações do usuário (altura, peso, objetivo, divisão) |
| `workout_history` | Histórico de sessões (JSONB) |
| `workout_templates` | Protocolos salvos |
| `user_plans` | Plano atual + quota de IA usada |
| `ai_usage_logs` | Logs de uso de IA (tokens, modelo, custo) |
| `payment_webhooks` | Eventos de pagamento Hotmart/Kiwify |
| `deletion_requests` | Solicitações de exclusão (LGPD) |

### Row Level Security (RLS)

Todas as tabelas têm RLS ativo — cada usuário acessa apenas seus próprios dados. O webhook de pagamento usa a `service_role` key via servidor.

### Executar Migrations

```bash
# Via Supabase CLI
supabase db push

# Ou aplicar manualmente no SQL Editor do painel Supabase
# Os arquivos estão em: supabase/migrations/
```

### Troubleshooting: erro 503 no chat

Se o chat retornar 503 em produção por falta de tabelas (ex.: `user_plans`), siga o runbook:

- `DOC_FIX_503_SUPABASE_MIGRATIONS.md`

Resumo: aplicar o script SQL idempotente de criação das tabelas faltantes e, em seguida, alinhar o ambiente com `supabase db push`.

---

## Modelo de Negócio

### Planos

| Plano | Preço | Limite IA | Funcionalidades |
|-------|-------|-----------|-----------------|
| Free | Grátis | 15 req/mês | Registro de treinos, timer, histórico |
| PRO | R$ 29,90/mês | Ilimitado | KRONOS, análise avançada, protocolos IA |

### Fluxo de Pagamento

1. Usuário atinge limite → modal de paywall exibido
2. Redirect para checkout Hotmart/Kiwify
3. Webhook recebido em `/api/payment-webhook`
4. `user_plans.plan` atualizado para `'pro'`
5. Usuário volta ao app com acesso ilimitado

### Reset de Quota

Executar mensalmente (ex: via cron no Supabase):
```sql
SELECT reset_monthly_quotas();
```

---

## Conformidade LGPD

- **Exportação de dados**: `GET /api/lgpd-export` — retorna todos os dados do usuário em JSON
- **Deleção de dados**: `DELETE /api/lgpd-delete` — registra solicitação e agenda exclusão
- **RLS ativo**: usuários não acessam dados de terceiros
- **Coleta mínima**: apenas dados necessários para o funcionamento do app

---

## PWA (Progressive Web App)

O app pode ser instalado diretamente do navegador (Android/iOS) sem app store:

- **Manifest**: `manifest.json` — define ícones, nome, orientação
- **Service Worker**: `sw.js` — cache de assets para uso offline
- **Shortcuts**: "Novo Treino" e "KRONOS" disponíveis no menu de contexto do ícone

---

## Arquitetura de IA

### KRONOS (Coach Conversacional)

```
Usuário → /api/chat → _ratelimit.js (verifica quota)
                    → _auth.js (valida JWT)
                    → _nvidia.js ou _gemini.js (chamada ao modelo)
                    → _logger.js (registra tokens/custo)
                    → Resposta ao usuário
```

### Contexto Injetado Automaticamente

O KRONOS recebe automaticamente:
- Histórico das últimas sessões (30 dias)
- Scores de fadiga e RPE acumulado
- Volume por grupo muscular
- PRs recentes
- Configuração do usuário (objetivo, divisão, biometria)

### Transforms Engine

Sistema de análise inspirado no Maltego — transforma dados brutos de treino em entidades relacionadas (exercício → músculo → fadiga → recomendação). Usado para a tela de Análise Avançada.

---

## Scripts de Backup

```bash
# Backup para Google Drive
./backup-to-drive.sh

# Restaurar do Google Drive
./restore-from-drive.sh
```

Requer `rclone` configurado com credenciais do Google Drive.

---

## Roadmap Sugerido

- [ ] Modularizar `app.js` em ES Modules
- [ ] Adicionar testes automatizados (Vitest)
- [ ] Dashboard de métricas do negócio (MRR, churn, DAU)
- [ ] Integração com wearables (Apple Health, Google Fit)
- [ ] Versão white-label para personal trainers
- [ ] App nativo (Capacitor.js — reaproveitando o código atual)

---

## Licença

Propriedade do autor. Todos os direitos reservados.

## Endpoint interno: importação de exercícios

Para rodar a importação no servidor (sem expor `SUPABASE_SERVICE_ROLE_KEY` no frontend), use o endpoint:

- `POST /api/admin-import-exercises`
- Header obrigatório: `x-admin-key: <IMPORT_ADMIN_KEY>`

Exemplo com `curl`:

```bash
curl -X POST "https://<seu-dominio>/api/admin-import-exercises" \
  -H "x-admin-key: $IMPORT_ADMIN_KEY"
```

Comportamento:
- carrega `data/exercises.json`
- importa em lotes de 200 (`import_exercises_json`)
- retorna resumo por lote e total final em `exercises`
