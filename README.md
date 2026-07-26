# HCJ-OS Backend — v0.2 (Postgres/Supabase, sem custo)

Versão actualizada: em vez de guardar os dados num ficheiro SQLite dentro do
próprio servidor Render, este backend liga-se a uma base de dados **Postgres
gratuita no Supabase**. Isto resolve o problema do plano Free do Render apagar
os dados a cada reinício — agora podes usar o **Render Free** sem medo de
perder nada, porque os dados vivem noutro lado, persistentes.

Testado nesta entrega (motor Postgres real, via simulação): criação de
organização, criação de utilizador, login, criação de caso partilhado entre
utilizadores da mesma organização, bloqueio correcto por permissões (RBAC),
detecção de nomes duplicados, e definição da chave Groq por organização.

## Parte 1 — Criar a base de dados no Supabase (grátis, sem cartão)

1. Vai a **https://supabase.com** → **"Start your project"** → regista-te (podes
   usar a conta GitHub para entrar mais rápido).
2. **"New project"** → escolhe o teu workspace → preenche:
   - **Name:** `hcj-os`
   - **Database Password:** cria uma password forte e **guarda-a** (vais
     precisar dela já a seguir)
   - **Region:** a mais próxima (Frankfurt/Europe, por exemplo)
3. Espera ~2 minutos enquanto o Supabase cria o projecto.
4. Quando estiver pronto, vai a **Project Settings** (ícone de engrenagem, em
   baixo à esquerda) → **Database**.
5. Procura **"Connection string"** → separador **"URI"** (ou "Transaction
   pooler", ambos funcionam) → copia o valor. Terá este aspecto:
   ```
   postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. Substitui `[YOUR-PASSWORD]` pela password que definiste no passo 2.
   **Guarda este link completo** — é o teu `DATABASE_URL`.

## Parte 2 — Actualizar o código no GitHub

1. No teu repositório `hcj-os-backend`, vais substituir estes ficheiros pelos
   novos desta entrega: `server.js`, `db.js`, `package.json`, `.env.example`,
   `routes/auth.js`, `routes/data.js`, `routes/ai.js` (o `middleware/auth.js`
   não muda).
2. Mais simples: apaga o repositório antigo e sobe esta pasta inteira de novo
   (tal como fizeste da primeira vez, arrastando o conteúdo para "uploading an
   existing file").

## Parte 3 — Configurar o Render (agora podes usar o plano Free)

Se já tens o Web Service criado no Render, vai a **Settings** e:

1. Em **Environment**, remove `DB_PATH` (se existir) e adiciona:
   - `DATABASE_URL` → cola o connection string completo do Supabase (Parte 1)
2. Já não precisas de nenhum **Disk** — remove-o se o tinhas criado (Settings
   → Disks → Delete). O Postgres do Supabase é que guarda tudo agora.
3. Pode voltar ao **Instance Type: Free** sem perder dados — o disco já não
   é necessário porque nada fica guardado localmente no Render.
4. Guarda e faz **Manual Deploy → Deploy latest commit**.

Se estiveres a criar o Web Service de raiz, segue os mesmos passos de sempre,
mas usa `DATABASE_URL` em vez de `DB_PATH`, e escolhe **Free** em Instance Type.

## Testar que está tudo a funcionar

```
https://o-teu-servico.onrender.com/api/health
```
Deve responder `{"ok":true,"name":"HCJ-OS Backend","db":"postgres",...}`.

Para confirmar que os dados persistem mesmo com o plano Free: cria uma
organização de teste, espera o servidor "adormecer" (15 min sem uso), acede
de novo (demora ~30-50 segundos a acordar, é normal no Free), e confirma que
a organização continua lá — prova que o Supabase guardou tudo, independente
do Render ter reiniciado.

## Ver os dados como se fosse Excel (opcional)

No Supabase, vai a **Table Editor** (barra lateral) — vês cada tabela
(`organizations`, `users`, `cases`, `reports`, `audit_log`) como uma folha de
cálculo, com linhas e colunas. É só para confirmares visualmente — o
preenchimento continua a ser feito automaticamente pelo backend, nunca precisas
de escrever nada à mão ali.

## Nota sobre escala

Esta configuração (Render Free + Supabase Free) é perfeita para o piloto e
para validares com clientes reais sem gastar nada. Quando estiveres a cobrar
a sério e precisares de mais performance/uptime garantido, os planos pagos de
qualquer um dos dois sobem em poucos cliques, sem mexer no código.

## Próximo passo: ligar o `index.html` a este backend

Mantém-se válido o mesmo plano da versão anterior: primeiro login/registo,
depois casos, depois relatórios, por último o proxy de IA — sempre testando
cada peça antes de avançar para a seguinte.
