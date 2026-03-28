# Correção do erro 503 no chat (produção)

## Sintoma

Ao abrir o chat, a API retorna **HTTP 503**.

## Causa raiz

O backend consulta a tabela `public.user_plans` para resolver plano/limites do usuário.
Em produção, essa tabela (e outras tabelas base de auth/plano/histórico) não existe porque as migrations não foram aplicadas no banco desse ambiente.

## Impacto

Sem as tabelas de plano e dados base, o fluxo do chat não consegue montar contexto do usuário e encerra com 503.

## Correção imediata (sem risco de perda)

1. Abrir o **Supabase Dashboard** do projeto de produção.
2. Ir em **SQL Editor**.
3. Criar uma aba nova.
4. Colar o script SQL de criação idempotente (o bloco que começa em `CREATE TABLE IF NOT EXISTS public.profiles`).
5. Clicar em **Run**.

> Esse script é idempotente (`IF NOT EXISTS`): **não apaga dados** e **não altera tabelas já existentes**.

## Correção recomendada (definitiva)

Aplicar todo o histórico de migrations deste repositório no ambiente de produção para manter schema/versionamento consistentes:

```bash
supabase db push
```

Se for necessário aplicar manualmente no painel, execute os arquivos em ordem numérica na pasta `supabase/migrations/`.

## Verificação pós-correção

- Confirmar existência das tabelas críticas:
  - `profiles`
  - `user_plans`
  - `workout_history`
  - `ai_usage_logs`
- Repetir login com usuário real.
- Abrir chat e validar que a API retorna 200.

## Prevenção

- Incluir etapa obrigatória de migration no deploy de produção.
- Rodar checklist de healthcheck/schema antes de liberar versão.
