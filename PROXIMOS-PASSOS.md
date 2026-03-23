# KRONIA — PRÓXIMOS PASSOS APÓS ENCERRAR A SESSÃO
> Guia completo, passo a passo, sem pular nada.
> Criado em 2026-03-23. Branch: claude/web-scraping-library-4I1DH

---

## PASSO 1 — FAZER O MERGE DA BRANCH NO GITHUB

Tudo que foi feito está na branch `claude/web-scraping-library-4I1DH`.
Você precisa fazer o merge para o `master` para o Vercel pegar as mudanças.

1. Abra o navegador
2. Acesse: `https://github.com/klebercdc/treino-do-dia`
3. Clique na aba **Pull requests** (segunda aba do menu superior)
4. Você vai ver um PR aberto com o nome da branch `claude/web-scraping-library-4I1DH`
   - Se não aparecer nenhum PR, clique no botão verde **"Compare & pull request"** que aparece no topo amarelo
5. Clique no PR para abrir
6. Role até o final da página
7. Clique no botão verde **"Merge pull request"**
8. Clique em **"Confirm merge"**
9. Pronto — o código está no master

---

## PASSO 2 — VERIFICAR O DEPLOY NO VERCEL

O Vercel faz deploy automático quando o master é atualizado.

1. Abra o navegador
2. Acesse: `https://vercel.com/dashboard`
3. Faça login com a conta que está conectada ao projeto
4. Clique no projeto **treino-do-dia** (ou KRONIA)
5. Clique na aba **Deployments** (menu superior dentro do projeto)
6. Você vai ver um deploy novo aparecendo com status **"Building"** (azul)
7. Aguarde virar **"Ready"** (verde) — demora entre 1 e 3 minutos
8. Se aparecer **"Error"** (vermelho), clique nele para ver o log de erro

---

## PASSO 3 — REMOVER A VARIÁVEL NVIDIA DO VERCEL

O Nvidia foi removido do código. A variável no Vercel não faz mais nada mas pode confundir.

1. Ainda no Vercel, clique no projeto **treino-do-dia**
2. Clique em **Settings** (menu superior dentro do projeto)
3. No menu lateral esquerdo clique em **Environment Variables**
4. Procure a variável chamada **NVIDIA_API_KEY**
5. Clique nos **três pontinhos (...)** à direita dela
6. Clique em **Delete**
7. Confirme clicando em **Delete** novamente na caixa que aparece
8. Confirme que a variável **GROQ_API_KEY** está na lista — se não estiver, você precisa criar:
   - Clique em **Add New**
   - Em "Key" digite: `GROQ_API_KEY`
   - Em "Value" cole a sua chave do Groq (começa com `gsk_...`)
   - Marque as três opções: **Production**, **Preview**, **Development**
   - Clique em **Save**

---

## PASSO 4 — RODAR A MIGRATION 005 NO SUPABASE

Essa migration adiciona os campos de imagem, instruções, nível e equipamento
na tabela de exercícios. Precisa rodar uma única vez.

1. Abra o navegador
2. Acesse: `https://supabase.com/dashboard`
3. Faça login na sua conta
4. Clique no projeto do KRONIA (o nome que você deu ao criar)
5. No menu lateral esquerdo clique em **SQL Editor**
6. Clique em **New query** (botão no topo esquerdo do editor)
7. Agora abra outro programa — o VS Code, Bloco de Notas, ou qualquer editor
8. No seu computador, navegue até a pasta do projeto: `Treino-do-dia`
9. Abra a pasta `supabase` → depois a pasta `migrations`
10. Abra o arquivo: `005_exercises_rich_fields.sql`
11. Selecione todo o conteúdo do arquivo: **Ctrl+A** (Windows) ou **Cmd+A** (Mac)
12. Copie: **Ctrl+C** (Windows) ou **Cmd+C** (Mac)
13. Volte para o navegador no Supabase SQL Editor
14. Clique dentro da área branca de texto do editor
15. Cole: **Ctrl+V** (Windows) ou **Cmd+V** (Mac)
16. Clique no botão verde **"Run"** (canto superior direito do editor) ou pressione **Ctrl+Enter**
17. Embaixo do editor vai aparecer a mensagem: `Success. No rows returned`
18. Isso significa que funcionou

---

## PASSO 5 — RODAR O ETL PARA POPULAR OS EXERCÍCIOS

Esse script baixa 873 exercícios com imagens e instruções e coloca no banco.
Roda uma única vez. Demora cerca de 2 a 4 minutos.

### 5.1 — Instalar o Python (se não tiver)

1. Abra o navegador
2. Acesse: `https://python.org/downloads`
3. Clique no botão amarelo grande **"Download Python 3.x.x"**
4. Abra o instalador baixado
5. **IMPORTANTE**: marque a caixa **"Add Python to PATH"** antes de clicar em Install
6. Clique em **Install Now**
7. Aguarde terminar e clique em **Close**

### 5.2 — Abrir o terminal na pasta do projeto

**Windows:**
1. Abra o File Explorer (Windows Explorer)
2. Navegue até a pasta `Treino-do-dia`
3. Clique na barra de endereço (onde aparece o caminho da pasta)
4. Apague o que está lá e digite: `cmd`
5. Pressione **Enter** — vai abrir o Prompt de Comando já dentro da pasta certa

**Mac:**
1. Abra o Finder
2. Navegue até a pasta `Treino-do-dia`
3. Clique com o botão direito na pasta
4. Clique em **"Abrir no Terminal"** (ou "New Terminal at Folder")

### 5.3 — Instalar as dependências do ETL

No terminal que abriu, digite exatamente isso e pressione **Enter**:

```
pip install requests pandas supabase python-dotenv
```

Aguarde instalar tudo. Vai aparecer várias linhas de texto. Quando terminar, o cursor volta para você digitar.

### 5.4 — Criar o arquivo .env com as credenciais

1. Abra o VS Code (ou Bloco de Notas)
2. Crie um arquivo novo
3. Cole o seguinte conteúdo:

```
SUPABASE_URL=COLOQUE_AQUI_A_URL_DO_SEU_PROJETO_SUPABASE
SUPABASE_SERVICE_KEY=COLOQUE_AQUI_A_SERVICE_ROLE_KEY
```

**Para pegar a SUPABASE_URL:**
1. Acesse `https://supabase.com/dashboard`
2. Clique no seu projeto KRONIA
3. No menu lateral clique em **Settings**
4. Clique em **API**
5. Copie o valor de **Project URL** (começa com `https://xxxxx.supabase.co`)
6. Cole no lugar de `COLOQUE_AQUI_A_URL_DO_SEU_PROJETO_SUPABASE`

**Para pegar a SUPABASE_SERVICE_KEY:**
1. Na mesma tela de Settings → API do Supabase
2. Role a página para baixo até **Project API Keys**
3. Clique em **Reveal** ao lado da chave **service_role** (NÃO a anon/public)
4. Copie a chave inteira (começa com `eyJ...`)
5. Cole no lugar de `COLOQUE_AQUI_A_SERVICE_ROLE_KEY`

**Salvar o arquivo .env:**
1. Salve o arquivo com o nome exato: `.env` (com ponto na frente, sem extensão)
2. Salve DENTRO da pasta `Treino-do-dia` (mesma pasta do `app.js`)

**ATENÇÃO:** No Bloco de Notas, ao salvar mude o tipo de arquivo para "Todos os arquivos (*.*)" para não salvar como `.env.txt`

### 5.5 — Rodar o ETL

No terminal que você abriu (ainda dentro da pasta `Treino-do-dia`), digite:

```
python etl/seed_kronia.py
```

Pressione **Enter**.

Você vai ver uma sequência de mensagens como:
```
10:32:01  INFO     ═══ KRONIA ETL v2 — Partida Fria ═══
10:32:01  INFO     Buscando exercícios em https://raw.githubusercontent.com/...
10:32:04  INFO       873 exercícios únicos carregados
10:32:04  INFO       Exercícios enviados: 200 / 873
10:32:06  INFO       Exercícios enviados: 400 / 873
...
10:34:22  INFO     ═══ ETL concluído ═══
```

Quando aparecer `ETL concluído`, está feito.

Um arquivo chamado `seed_preview.json` vai ser criado dentro da pasta `etl/`.
Você pode abrir esse arquivo para ver os exercícios e PRs que foram gerados.

---

## PASSO 6 — VERIFICAR SE TUDO ESTÁ FUNCIONANDO

### 6.1 — Verificar os exercícios no banco

1. Acesse `https://supabase.com/dashboard`
2. Clique no projeto KRONIA
3. No menu lateral clique em **Table Editor**
4. Clique na tabela **exercises**
5. Você deve ver 873 linhas com exercícios
6. Cada linha deve ter: `name`, `muscle_group`, `image_url`, `instructions`, `level`, `equipment`

### 6.2 — Verificar o app no ar

1. Acesse a URL do seu app no Vercel
   - Encontre em: Vercel → projeto → **Visit** (botão no topo)
2. Faça login no app
3. Clique em **KRONIA TRANSFORMS** (o card laranja na home)
4. Você vai ver o grafo de entidades
5. Clique na aba **Machines** (nova aba que aparece)
6. Você vai ver 3 cards:
   - Análise Completa do Atleta
   - Caçador de PRs
   - Vigilante de Overtraining
7. Clique em **▶ Run** em qualquer uma para testar

---

## RESUMO RÁPIDO — ORDEM DE EXECUÇÃO

```
1. GitHub → merge da branch → claude/web-scraping-library-4I1DH → master
2. Vercel  → aguardar deploy ficar verde (automático após merge)
3. Vercel  → Settings → Environment Variables → deletar NVIDIA_API_KEY
4. Supabase → SQL Editor → rodar 005_exercises_rich_fields.sql
5. Terminal → pip install + criar .env + python etl/seed_kronia.py
6. Verificar → Supabase tabela exercises (873 linhas) + app aba Machines
```

---

## SE ALGO DER ERRADO

### ETL falhou com "SUPABASE_URL inválida"
→ O arquivo .env não foi salvo na pasta certa ou tem espaços em branco
→ Verifique se o .env está em `Treino-do-dia/.env` (não em `Treino-do-dia/etl/.env`)

### ETL falhou com "service_role key inválida"
→ Você usou a chave `anon` em vez da `service_role`
→ Volte ao Supabase → Settings → API → Project API Keys → use a de baixo (service_role)

### Vercel deploy com erro
→ Clique no deploy vermelho → veja o log
→ Se aparecer erro de "Cannot find module", significa que algum import ficou quebrado

### Aba Machines não aparece
→ Verifique se o merge foi feito e se o Vercel fez redeploy
→ Limpe o cache do navegador: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)

### Supabase migration falhou
→ A tabela exercises pode não existir ainda — rode primeiro a migration 004
→ Arquivo: `supabase/migrations/004_kronia_transforms.sql`
→ Cole no SQL Editor e rode antes de rodar a 005

---

*Esse arquivo fica em: `Treino-do-dia/PROXIMOS-PASSOS.md`*
*Branch com todo o código: `claude/web-scraping-library-4I1DH`*
