# AI + Supabase Setup (Nutrição com RAG)

## 1) Configurar variáveis
1. Copie `.env.example` para `.env.local`.
2. Preencha:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AI_PROVIDER` (`groq` recomendado)
   - `GROQ_API_KEY` (preferencial)
   - `AI_CHAT_MODEL` (ex.: `llama-3.3-70b-versatile` no Groq)
   - `AI_EMBEDDING_MODEL` (opcional)

### Regras de provider
- Chave oficial de chat: `GROQ_API_KEY`.
- Se `AI_PROVIDER=groq`, o chat usa endpoint Groq.
- Se `AI_PROVIDER` não existir e `GROQ_API_KEY` existir, o sistema detecta `groq` automaticamente.
- Embeddings são opcionais: sem `AI_EMBEDDING_MODEL`, o sistema marca `SKIPPED` sem quebrar o chat.

## 2) Rodar migrations
```bash
supabase db push
```

## 3) Publicar Edge Functions
```bash
supabase functions deploy generate-nutrition-context
supabase functions deploy ingest-nutrition-knowledge
```

## 4) Rodar seeds
O seed está em `supabase/migrations/010_seeds.sql` e é aplicado no `db push`.

## 5) Testar API de health
```bash
curl -X GET http://localhost:3000/api/system/health
```

## 6) Testar endpoint de chat
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"userMessage":"Analise meu plano atual"}'
```

## 7) Rodar system check
```bash
npm run system:check
```

Saída esperada para IA (exemplo):
```txt
AI CHECK provider: groq status: OK chat key: found embedding key: missing embeddings: skipped
```

## 8) Validar fluxo ponta a ponta
1. Ingerir documento via `ingest-nutrition-knowledge`.
2. Enviar pergunta via `/api/ai/chat`.
3. Confirmar persistência em `ai_messages` e `ai_context_logs`.
4. Confirmar recuperação semântica via `match_nutrition_knowledge`.

## Guia rápido (4 passos)
**PASSO 1:** Entre no painel do Supabase (`Project Settings -> API`).

**PASSO 2:** Copie `Project URL`, `anon public key` e `service_role key`.

**PASSO 3:** Na Vercel, mantenha `GROQ_API_KEY` (não precisa renomear para `AI_API_KEY`).

**PASSO 4:** Rode `npm run system:check`.
