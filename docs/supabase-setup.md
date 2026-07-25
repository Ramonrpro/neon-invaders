# Subir o ranking online — NEON INVADERS

Este é o roteiro do provisionamento. Tudo o que o código precisa já está no
repositório: esquema, políticas, Edge Functions e adapters. O que falta é
apontá-los para um projeto Supabase de verdade — e isso exige uma conta, que
nenhum agente cria por você.

**Antes de começar, o mais importante:** sem as variáveis de ambiente da seção 4,
o jogo continua funcionando exatamente como antes, com o ranking no
`localStorage` do aparelho. O servidor é um acréscimo opcional, nunca um
requisito de boot.

---

## O que existe no repositório

| Caminho                                       | O que é                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `supabase/config.toml`                        | Configuração do projeto (auth anônima, rate limits)  |
| `supabase/migrations/*.sql`                   | Tabelas, views, RLS, índices e funções               |
| `supabase/functions/runs-start/`              | Abre a partida e emite o token                       |
| `supabase/functions/runs-submit/`             | Valida e grava — o **único** caminho até `scores`    |
| `supabase/functions/_shared/validation/`      | Cópia gerada do validador (`npm run supabase:sync`)  |
| `src/services/remote/`                        | Os adapters do lado do navegador                     |

---

## 1. Criar o projeto

1. Crie um projeto em [supabase.com](https://supabase.com). Região mais perto de
   quem vai jogar; o plano gratuito dá conta com folga.
2. Guarde o **ref** do projeto (o subdomínio de `https://<ref>.supabase.co`).
3. Em **Project Settings → API**, copie `Project URL` e a chave **anon**.

## 2. Instalar a CLI e ligar o repositório

**`npm install -g supabase` não funciona** — o pacote recusa instalação global de
propósito. No Windows, use `npx` (nada a instalar) ou Scoop:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref <ref>
```

```powershell
# alternativa, se preferir o comando permanente:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Troque `project_id` em `supabase/config.toml` pelo mesmo `<ref>`.

## 3. Aplicar o esquema e as funções

```powershell
npm run supabase:sync                        # regenera o validador compartilhado
npx supabase@latest db push                  # tabelas, views, RLS e índices
npx supabase@latest functions deploy runs-start
npx supabase@latest functions deploy runs-submit
```

O sal do hash de IP, gerado com o Node que já está aqui (evita depender do
`openssl`, que não vem no Windows):

```powershell
$sal = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx supabase@latest secrets set IP_HASH_SALT=$sal
```

`IP_HASH_SALT` é o sal do hash de IP usado no rate limit. Sem ele nada quebra,
mas o espaço de IPv4 é pequeno o bastante para que os hashes sejam revertidos por
força bruta — com sal, o banco guarda "mesma origem" sem guardar endereço.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **não** precisam ser configuradas: a
plataforma as injeta no ambiente de toda Edge Function.

### Ligar o login anônimo

**Authentication → Sign In / Providers → Anonymous sign-ins: ativado.**

Este é o passo mais fácil de esquecer e o que mais confunde depois: sem ele o
modo convidado falha, e como a `TitleScene` engole o erro para não travar, o
sintoma é o jogo simplesmente não registrar partida nenhuma.

## 4. Apontar o jogo para o projeto

```powershell
Copy-Item .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `.gitignore` já cobre
`*.local`.

A chave `anon` é pública por definição — ela viaja no bundle e qualquer um a lê
no DevTools. Quem protege o ranking é a RLS, não o segredo: com ela dá para ler a
tabela e criar a própria sessão, e nada mais.

```bash
npm run dev
```

No console: `getServices().backend` deve dizer `'supabase'`.

---

## 5. Conferência pós-deploy

Estes cinco itens são o que os testes **não** conseguem verificar sem um projeto
no ar. Fazer os cinco leva cinco minutos e é a diferença entre "deployado" e
"funcionando".

1. **O jogo abre e pede o nome.** Confirme um nome de três letras. Em
   **Authentication → Users** aparece um usuário anônimo; em **Table Editor →
   profiles**, a linha com o nome.
2. **Uma partida entra no ranking.** Jogue e morra de propósito. A tela de fim de
   jogo mostra a posição, e o `RANKING` da tela de título passa a listar.
3. **A RLS está de pé.** Com o jogo aberto, no console do navegador:

   ```js
   await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/scores`, {
     method: 'POST',
     headers: {
       apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
       'content-type': 'application/json',
     },
     body: JSON.stringify({ score: 999999, level_reached: 5, duration_ms: 1, events: {} }),
   }).then((r) => r.status);
   ```

   **Tem de responder 401 ou 403.** Se responder 201, a policy de insert existe
   onde não deveria e o ranking é lixo em uma semana — pare tudo e revise a
   seção de RLS da migration.

4. **O validador está no caminho.** Repita a submissão de uma run impossível
   direto na Edge Function (score altíssimo com contadores zerados) e confirme
   que volta `{"accepted":false,"reason":"SCORE_MISMATCH"}` — 200, não erro.
5. **O token vale uma vez.** Chame `runs-submit` duas vezes com o mesmo
   `runToken`: a segunda tem de devolver `UNKNOWN_RUN_TOKEN`.

---

## 6. Operação

- **Poda de tokens.** `runs-start` limpa os vencidos em 1 chamada a cada 20. Com
  a extensão `pg_cron` habilitada, agende a poda de hora em hora (o comando está
  comentado no fim da migration).
- **Auditoria.** A tabela `submissions` guarda toda tentativa, aceita ou
  recusada, com o motivo. É onde se olha quando alguém reclama de uma recusa.
- **Rate limit do GoTrue.** Os limites de auth (§5 do contrato) são da
  plataforma, não do nosso código: **Authentication → Rate Limits**. O valor que
  mais importa é o de contas anônimas por hora por IP — convidado é grátis, mas
  não ilimitado.
- **Mudou o validador?** `npm run supabase:sync` e faça o deploy de
  `runs-submit` de novo. `tests/edgeShared.test.ts` falha se você esquecer o
  sync; nada avisa se você esquecer o deploy.

---

## 7. Voltar para o modo local

Apague `.env.local` (ou esvazie as duas variáveis) e recarregue. O jogo volta ao
ranking do aparelho na hora, sem tocar em uma linha de código — é o mesmo
interruptor que existe desde o Milestone 7.
