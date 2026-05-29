# CLAUDE.md — Kronia (Treino-do-dia)

Instruções permanentes para o Claude Code neste repositório.
Leia este arquivo antes de qualquer tarefa.

---

## 0. Validacao deste arquivo (faca primeiro)

Este arquivo foi escrito com base em contexto externo, **nao** lendo o repositorio.
Antes de tratar qualquer regra abaixo como verdade:

1. Leia a estrutura real do repositorio (package.json, pastas, arquivos principais).
1. Compare com o que esta descrito aqui (stack, nomes de arquivo, engines, padroes).
1. **Reporte as divergencias** numa lista curta antes de seguir: o que bate, o que nao existe, o que esta diferente, o que faltou.
1. Nao corrija este arquivo sozinho. Aponte o erro e espere meu ok pra ajustar.

Se algo aqui contradiz o codigo real, **o codigo real ganha** — me avise.

---

## 1. Contexto do projeto

Kronia e um PWA de fitness e nutricao com IA (KRONOS, o coach).
Dominio: titanpro.app.br
Dono: Kleber — desenvolvedor solo, com background clinico em enfermagem/nefrologia.

Produto lida com **dados de saude de usuarios reais**. Erro de seguranca ou de logica clinica tem consequencia real. Trate com esse nivel de cuidado.

---

## 2. Stack (nao desviar sem avisar)

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres, RLS ativo, regiao sa-east-1)
- Groq API: llama3-70b-8192 (principal), mixtral-8x7b-32768, llama3-8b-8192
- Deploy: Vercel
- Distribuicao: PWA / TWA

Nao introduza biblioteca, framework ou servico novo sem explicar o motivo e o custo de manutencao antes.

---

## 3. Regras de trabalho (workflow)

1. **Antes de codar, faca um plano curto.** Liste os arquivos que vai tocar e o que muda em cada um. Espere meu "ok" em mudancas grandes (mais de 3 arquivos ou mudanca de schema).
1. **Uma mudanca por vez.** Nao misture refactor com feature nova no mesmo commit.
1. **Nao invente arquivos nem funcoes.** Leia o codigo real antes. Se nao encontrar algo, diga que nao encontrou — nao suponha.
1. **Toda funcao nova precisa de tratamento de erro.** Nada de happy-path sozinho.
1. **Pare e pergunte** quando a tarefa estiver ambigua. Nao chute requisito.
1. **Nao delete codigo que voce nao entende.** Comente o porque antes de remover.

---

## 4. Seguranca (obrigatorio)

- **Nunca** exponha chave de API, service_role key ou secret no client. So `NEXT_PUBLIC_*` vai pro browser, e nada sensivel nesse prefixo.
- **RLS e a fonte da verdade.** Nunca confie em filtro feito so no client. Toda query sensivel precisa de policy no Supabase.
- Valide e sanitize toda entrada de usuario antes de mandar pro banco ou pra IA (risco de injection/XSS).
- Dados de saude (exames, patologia, dieta) so acessiveis pelo proprio usuario. Confirme a policy antes de criar endpoint que toca essas tabelas.
- Nunca logue dado pessoal de saude em console ou em log de producao.
- Ao editar arquivo, sinalize se introduzir: `dangerouslySetInnerHTML`, `eval`, concatenacao de SQL, ou input direto em comando shell.

---

## 5. Padroes de codigo

- TypeScript estrito. Evite `any`; se usar, justifique.
- Componentes pequenos e com responsabilidade unica.
- Logica de negocio (engines metabolicas, calculo de dieta) **fora** dos componentes de UI.
- Nomes descritivos em codigo. Comentarios em portugues, curtos, so onde a intencao nao e obvia.
- Sem emoji em codigo, commit ou documentacao.

---

## 6. Engines clinicas / metabolicas

Arquivos como `pcm_engine.js`, `training_energy_engine.js`, `metabolic_behavior_engine.js` contem logica que afeta recomendacao nutricional.

- Nao altere formula sem confirmar comigo a base de calculo.
- Toda mudanca em engine precisa de exemplo de entrada/saida antes e depois, pra eu validar.
- Use bandas de tolerancia, limites de quantidade de itens e limites de porcao — nao trate como problema de "preencher macro" cego.

---

## 7. KRONOS (coach de IA)

- KRONOS deve cruzar dados reais do usuario (exames, dieta, treino, patologia) antes de responder. Se o contexto nao foi buscado, busque — nao responda no vacuo.
- Diferencie no raciocinio: fato (dado do usuario), hipotese, e recomendacao.
- Nao invente valor de exame nem diagnostico. Se faltar dado, diga que falta.

---

## 8. Commits e deploy

- Mensagem de commit clara, em portugues, descrevendo o "o que" e o "porque".
- Antes de sugerir merge/deploy: rode typecheck mentalmente e liste o que pode quebrar.
- Nunca faca deploy direto sem eu revisar mudanca em schema ou em policy de RLS.

---

## 9. Como falar comigo

- Direto e breve. Comando executado, nao confirmacao repetida.
- Se eu estiver otimista demais, vago ou pulando um risco, me avise.
- Portugues informal esta ok.
