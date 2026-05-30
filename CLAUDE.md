# CLAUDE.md — Regras do projeto KRONIA

## Fonte de verdade
- O PRD (KRONIA V5) em [docs/prd/kronia-v5-platform.md] é o norte absoluto.
  Não invente funcionalidade fora do escopo dele.
- Não afirme nada sobre código que você não abriu e leu de fato.

## Fluxo de trabalho
- Antes de codar: analise e mostre o plano. Só implemente fase que eu
  aprovar, UMA por vez. Nunca o app inteiro de uma vez.
- Antes de editar uma fase, diga em poucas linhas o que VAI e o que
  NÃO VAI mexer.

## Escopo
- Mexa só nos arquivos previstos para a fase.
- Não refatore "de brinde", nem por estética.
- Não redesenhe nada fora do escopo. Preserve navegação e dados.

## Proibições sem aprovação explícita
- Não altere schema, migration, RLS ou autenticação.
- Não crie rota API nova sem checar o limite da Vercel (≤ 11/12).
- Se a fase exigir algo disso, marque como BLOQUEANTE e pare.

## Git
- Trabalhe em branch: fase-[N]-[nome-curto]. Nunca merge na main.
- Pode commitar/push na branch para gerar preview no Vercel.

## Suposições
- Baixo risco (UI, texto, ordem): assuma e siga.
- Bloqueante (schema, dados, RLS, arquitetura, custo, limite Vercel):
  explique, aponte a parte do PRD que gerou a dúvida, e pare.

## Relatório (sempre)
- AO FINAL de toda sessão, gere um arquivo .txt na raiz no formato
  relatorio-fase-[N].txt (um por fase, sem sobrescrever os anteriores),
  contendo: o que foi verificado e o resultado, arquivos alterados (1
  linha de motivo cada), correções aplicadas, status dos pré-requisitos
  relevantes, como testar no preview, e o que ficou pendente.
