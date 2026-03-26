# Status de Validação E2E (2026-03-26)

Este documento registra o estado da validação ponta a ponta dos fluxos de planos/pagamentos/afiliados no ambiente local de CI sem credenciais de produção.

## Resultado

- **Status geral:** reprovado para validação E2E real.
- **Motivo principal:** variáveis obrigatórias ausentes no ambiente de execução para acesso ao Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

## Verificações executadas

### Sanidade de sintaxe (Node)

- `node --check api/_plans.js`
- `node --check api/plan-current.js`
- `node --check api/plan-features.js`
- `node --check api/config.js`
- `node --check api/payment-webhook.js`
- `node --check api/billing-sync.js`
- `node --check api/affiliate-sale.js`
- `node --check plans.js`

### Ambiente

- `node -e "console.log('SUPABASE_URL', !!process.env.SUPABASE_URL, 'SUPABASE_SERVICE_KEY', !!process.env.SUPABASE_SERVICE_KEY)"`
- Resultado observado: ambos `false`.

## Impacto por cenário

1. **Cadastro + trial automático:** bloqueado sem Auth/DB reais.
2. **Trial ativo + limites/acessos premium:** bloqueado para execução real, apenas validação estática de integração.
3. **Expiração de trial para free:** bloqueado sem banco e sem passagem real de tempo/dados.
4. **Bloqueio premium por plano:** bloqueado em runtime real autenticado.
5. **Upgrade via billing-sync + reflexo no frontend:** bloqueado sem integração real com backend/banco.
6. **Webhook de pagamento + atualização de plano:** bloqueado sem origem externa e persistência real.
7. **Afiliado com idempotência:** bloqueado sem RPCs transacionais reais.
8. **Feature usage idempotente por event_key:** bloqueado sem banco para confirmar constraints/efeito.
9. **Consumo frontend `/api/config`, `/api/plan-current`, `/api/plan-features`:** validado apenas por inspeção estática e contrato.

## Próximos passos para aprovação E2E

1. Configurar ambiente com `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` válidos.
2. Garantir migrations SQL aplicadas (incluindo funções e grants de RPC).
3. Executar suíte de cenários com usuários reais de teste (novo, trial, expirada, paga).
4. Simular e repetir eventos de webhook para validar idempotência.
5. Capturar evidências (logs, IDs de transação, estado antes/depois em banco) e anexar ao relatório final.
