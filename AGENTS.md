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

Objetivo final: entregar solução real, pronta para produção, com correção definitiva e sem deixar trabalho manual desnecessário para o usuário.
