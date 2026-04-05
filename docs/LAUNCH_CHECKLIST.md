# KRONIA Launch Checklist

## Antes do deploy

- Rode `npm run launch:gate`
- Confirme que o veredito está em `launch_ready_high` ou `launch_ready_controlled`
- Confirme que `scientific.articles`, `scientific.evidence` e `scientific.topics` estão acima de zero
- Confirme que `catalog.exercisesActive` está acima de `1000`
- Valide manualmente:
  - chat com referência
  - gerar dieta para `hipertrofia`
  - gerar dieta para `emagrecimento`
  - CTA `Ver exercício`
  - treino sem referência deve bloquear, não inventar prescrição

## Depois do deploy

- Verifique o health endpoint do sistema
- Exporte `KRONIA_APP_BASE_URL` apontando para a URL publicada
- Rode `npm run launch:postdeploy`
- Confirme que o app não mostra erro de service worker no chat
- Confirme que o Supabase continua retornando artigos e evidências
- Monitore logs das rotas:
  - `/api/kronia/chat`
  - `/api/kronia/diet`
  - `/api/kronia/workout`
  - `/api/kronia/exercises/details`

## Comandos rápidos

```bash
npm run launch:gate
export KRONIA_APP_BASE_URL="https://seu-app.com"
npm run launch:postdeploy
```

## Critérios de rollback

- `release:readiness` cair para `launch_risk_high`
- dieta voltar a responder sem evidência para objetivos cobertos
- chat parar de receber contexto científico
- `Ver exercício` voltar a retornar HTML/JSON inválido
- service worker voltar a interceptar `/api/`
