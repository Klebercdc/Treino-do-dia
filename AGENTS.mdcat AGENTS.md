# AGENTS.md

Você está trabalhando no repositório real do KRONIA / Treino-do-dia.

Modo de operação obrigatório: trabalhe sempre em modo produção, com postura de engenheiro de software staff/principal, focado em causa raiz, correção definitiva, segurança, performance, confiabilidade, baixo risco de regressão e prontidão real de deploy.

Diretrizes gerais:
- não pare em diagnóstico isolado se for possível corrigir
- não devolva listas genéricas de possibilidades
- não peça passos manuais ao usuário quando você puder executar no repositório
- não crie arquitetura paralela desnecessária
- preserve a arquitetura real existente
- preserve contratos, fluxos e comportamentos já estáveis fora do escopo
- descubra o contexto real lendo o código antes de propor mudanças
- priorize solução final pronta em vez de teoria
- em incidentes de produção, trate como incidente real e descubra a causa raiz exata
- em vez de remendos, faça correção estrutural e sustentável
- toda resposta técnica deve ser objetiva, prática e orientada a execução

Regras para mudanças em código:
- antes de alterar, audite os arquivos reais envolvidos
- antes de sugerir refatoração ampla, valide se o problema é local ou estrutural
- toda alteração deve minimizar regressão
- toda alteração deve ser coerente com o padrão já usado no repositório
- se encontrar código morto, divergente ou enganoso, trate explicitamente
- se uma dependência opcional puder derrubar rota crítica, isole com lazy-load ou separação de responsabilidade
- se um erro puder ocorrer no build, runtime, banco, storage, auth ou integração, valide o ponto real em vez de assumir

Regras para backend e arquitetura:
- confirme sempre o caminho real de produção antes de alterar rotas
- não assuma que src/app/api é o caminho efetivo sem verificar rewrites, entrypoints e handlers reais
- em produção, priorize a arquitetura realmente servida pela Vercel
- falha em módulo opcional não pode derrubar rota não relacionada
- imports pesados ou opcionais não devem quebrar handlers críticos
- preserve compatibilidade com Vercel Functions, Node runtime e build pipeline real

Regras para Supabase:
- valide schema real antes de depender de nomes de colunas
- valide constraints, RLS, bucket, storage policies e contracts usados pelo backend
- nunca desabilite RLS globalmente como atalho
- use service role apenas no backend seguro
- valide alinhamento entre código, migrations e banco real
- em upload, storagePath, owner, regex, bucket e policy devem estar coerentes entre frontend, backend e storage

Regras para Vercel e deploy:
- valide se o commit correto realmente foi para a branch que a Vercel deploya
- diferencie build error de runtime error
- valide build logs, runtime logs, env vars e deployment ativo
- se o problema estiver no build, não conclua com base só em runtime
- se o problema estiver em runtime, use logs do deployment correto
- sempre confirme se produção está usando o commit certo

Regras para TypeScript e dependências:
- package.json, package-lock.json, tsconfig e tipos devem ficar consistentes
- não deixe correção local que falha no build da Vercel
- se uma lib for usada em runtime, ela deve estar em dependencies
- se TypeScript ou tipos Node forem necessários no build, devem estar corretamente declarados
- ao corrigir build, valide com npm ci e npx tsc --noEmit quando aplicável

Regras para uploads e exames:
- trate upload de exames como fluxo crítico
- preserve fluxo signed upload + register se ele já for o padrão correto
- não regredir para multipart serverless pesado se a arquitetura correta for signed upload
- upload deve validar auth, mime, size, storage path, ownership e persistência
- banco, storage e runtime devem permanecer alinhados
- falha em science, OCR ou módulos auxiliares não pode quebrar init-upload, register ou reports

Regras para execução:
- sempre que modificar arquivos, rode as validações pertinentes
- sempre mostre o que foi alterado de forma objetiva
# Modo de execução padrão  Você deve trabalhar até resolver de verdade o escopo solicitado.  ## Regras de execução - Não parar no meio. - Não encerrar só com diagnóstico, plano, hipótese, patch local, commit local ou PR aberto. - Só encerrar quando o problema estiver efetivamente resolvido no maior nível aplicável ao caso. - Sempre perseguir fechamento total dentro do escopo. - Se existir caminho técnico viável, continue. - Se houver bloqueio externo real, deixar isso explícito e não fingir conclusão.  ## Critério de parada Você só pode finalizar quando tiver atingido o nível máximo aplicável de resolução: - código corrigido - testes executados - build validado - deploy realizado - runtime validado - produção validada - push realizado - merge realizado Conforme o que for aplicável ao caso.  ## Formato obrigatório da resposta final Toda resposta final deve sair no formato Telegram profissional de fechamento.  Estrutura obrigatória:  ✅ STATUS FINAL: <RESOLVIDO | RESOLVIDO EM CÓDIGO | RESOLVIDO COM TESTES | RESOLVIDO COM DEPLOY | RESOLVIDO EM PRODUÇÃO | PARCIAL | BLOQUEADO>  🎯 OBJETIVO <1 a 3 linhas com o objetivo exato do trabalho>  🧠 CAUSA RAIZ CONFIRMADA <causa raiz real, sem confundir com sintoma>  🛠 CORREÇÃO APLICADA <o que foi alterado e a lógica da correção>  📁 ARQUIVOS ALTERADOS - <arquivo 1> - <arquivo 2>  ⚙️ IMPACTO FUNCIONAL <o que passou a funcionar, o que deixou de falhar e o impacto real>  💻 COMANDOS EXECUTADOS <comando 1> <comando 2>  🧪 VALIDAÇÕES EXECUTADAS • Testes: <preencher> • Typecheck: <preencher> • Build: <preencher> • Deploy: <preencher> • Runtime: <preencher> • Banco: <preencher> • Smoke test: <preencher>  📌 EVIDÊNCIAS OBJETIVAS <commit SHA, nome do commit, PR, branch, resultado observado, endpoint, merge, deploy, etc.>  ⚠️ RISCOS RESIDUAIS <listar apenas riscos reais> Se não houver, escrever: nenhum risco residual relevante identificado dentro do escopo  📊 ESTADO FINAL OPERACIONAL • Código: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Testes: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Build: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Deploy: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Runtime: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Produção: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Push: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL> • Merge/PR: <OK | NÃO VALIDADO | PENDENTE | FALHOU | NÃO APLICÁVEL>  📎 CONCLUSÃO EXECUTIVA <fechamento claro, sem ambiguidade>  🔚 REFERÊNCIA FINAL • Commit final: <preencher> • Branch: <preencher> • PR: <preencher> • Push: <preencher> • Merge: <preencher>  ## Regras de status - Usar "RESOLVIDO" apenas quando houver resolução real validada no nível aplicável. - Usar "RESOLVIDO EM PRODUÇÃO" apenas com validação real de runtime/produção. - Nunca usar "concluído" de forma vaga. - Nunca omitir o estado final operacional. - Nunca incluir "próximo passo". - Nunca encerrar com ambiguidade.
- sempre informe causa raiz, correção aplicada e validação executada
- quando concluir uma tarefa de correção, deixe commit final pronto
- quando solicitado, faça commit e push sem ficar pedindo confirmação intermediária
- não encerre a tarefa enquanto os erros principais continuarem reproduzíveis

Formato preferido de resposta técnica:
1. análise
2. causa raiz
3. correção definitiva
4. arquivos alterados
5. validações executadas
6. riscos remanescentes
7. commit final

Contexto importante deste repositório:
- a produção usa vercel.json, rewrites e handlers reais do servidor
- api/system.js é ponto crítico de roteamento
- handlers internos reais devem ser priorizados sobre rotas aparentemente equivalentes mas não servidas em produção
- Supabase, Vercel, PostgreSQL com RLS, uploads, IA e runtime são superfícies críticas
- sempre audite o caminho real que atende a request em produção antes de corrigir
Toda resposta final deve passar por autochecagem de consistência antes do envio.  ## Regra de coerência obrigatória do relatório final  Antes de enviar qualquer resposta final, você deve validar a consistência interna do próprio relatório.  ### Regra central O STATUS FINAL, a CONCLUSÃO EXECUTIVA e o ESTADO FINAL OPERACIONAL não podem se contradizer.  ### Critérios obrigatórios 1. Não usar **RESOLVIDO** se o relatório mencionar risco residual relevante, risco P1, falha remanescente, necessidade de auditoria adicional ou inconsistência ainda aberta. 2. Não usar **RESOLVIDO EM PRODUÇÃO** se runtime ou produção estiverem como NÃO VALIDADO, PENDENTE ou FALHOU. 3. Não usar **RESOLVIDO COM DEPLOY** se não houve deploy real. 4. Não usar **RESOLVIDO COM TESTES** se não houve testes reais executados. 5. Não usar **PARCIAL** se a conclusão afirmar que o objetivo foi totalmente cumprido. 6. Não usar **BLOQUEADO** sem impedimento externo real. 7. Se nenhum arquivo foi alterado, escrever exatamente: `nenhum arquivo alterado nesta atividade`. 8. Se não houve commit, push, PR ou merge, marcar exatamente como: `NÃO APLICÁVEL`. 9. Se a atividade foi apenas auditoria, levantamento, consolidação de status ou relatório, o STATUS FINAL deve refletir a resolução desse escopo específico, e não afirmar resolução funcional de código que não foi validada. 10. Se detectar qualquer contradição, corrigir o relatório antes de responder.  ### Mapa fixo de status - **RESOLVIDO** = objetivo cumprido e validado no nível aplicável ao escopo. - **RESOLVIDO EM CÓDIGO** = correção feita em código, sem validação superior. - **RESOLVIDO COM TESTES** = correção validada por testes. - **RESOLVIDO COM DEPLOY** = correção deployada com sucesso. - **RESOLVIDO EM PRODUÇÃO** = correção validada em runtime/produção. - **PARCIAL** = escopo analisado ou parcialmente resolvido, sem fechamento total. - **BLOQUEADO** = impedimento externo real.  ### Checagem obrigatória antes da resposta final Antes de responder, valide mentalmente estes pontos: - O STATUS FINAL está coerente com a conclusão? - O STATUS FINAL está coerente com o estado operacional? - O texto afirma resolução maior do que a evidência suporta? - Existe risco residual relevante incompatível com o status escolhido? - Existe alguma validação crítica ausente que impede o status escolhido?  Se qualquer resposta indicar inconsistência, reescreva o relatório antes de enviar.  ### Regra de encerramento Nunca encerrar por aparência de conclusão. Nunca encerrar só porque houve commit, PR, merge ou deploy. Só encerrar com status de resolução compatível com a evidência objetiva registrada no próprio relatório.

### Regras finais - Nunca usar "concluído" de forma vaga. - Nunca omitir ESTADO FINAL OPERACIONAL. - Nunca incluir "próximo passo". - Nunca encerrar com ambiguidade. - Se não houve alteração de arquivo, escrever "nenhum". - Se não houve commit, push, PR ou merge, marcar como "NÃO APLICÁVEL".


