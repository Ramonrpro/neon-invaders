# Contrato de API — NEON INVADERS

Este documento descreve o servidor do ranking. `src/services/types.ts` é a
tradução em TypeScript do que está aqui, e `src/services/remote/` é o cliente
correspondente.

**Stack: Supabase.** Postgres, autenticação e Row Level Security prontos; o
código próprio são duas Edge Functions que validam e gravam a run, porque o
score jamais pode ser gravado direto pelo cliente. As rotas abaixo são descritas
de forma neutra (REST) e a [seção 6](#6-mapa-para-o-supabase) mapeia cada uma
para o recurso equivalente do Supabase.

**Os dois modos convivem.** Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`,
quem responde é `src/services/local/` sobre `localStorage` e o jogo é completo do
mesmo jeito; com elas, `getServices()` devolve os adapters remotos. A escolha
mora em `src/services/index.ts` — nada dentro de `src/game/` muda nos dois casos.
O provisionamento está em [`supabase-setup.md`](./supabase-setup.md).

---

## 1. Convenções

- Base: `https://<projeto>.supabase.co/functions/v1` para as rotas de run,
  `/auth/v1` e `/rest/v1` para as demais (ver seção 6).
- Todo corpo é JSON com `content-type: application/json`.
- Sessão viaja em `Authorization: Bearer <access_token>`, **nunca em cookie** —
  cookie de terceiro morre no Safari e no modo privado, que são exatamente os
  navegadores em que este jogo mais roda.
- Timestamps são ISO 8601 em UTC.
- Erro tem sempre a mesma forma:

```json
{ "error": { "code": "BAD_CREDENTIALS", "message": "e-mail ou senha incorretos" } }
```

Códigos de erro (o cliente decide o texto pelo `code`, nunca pela `message`):

| `code`             | HTTP | Quando                                             |
| ------------------ | ---- | -------------------------------------------------- |
| `INVALID_NAME`     | 400  | `displayName` fora de 3–12 caracteres              |
| `INVALID_EMAIL`    | 400  | e-mail malformado                                  |
| `WEAK_PASSWORD`    | 400  | senha com menos de 6 caracteres                    |
| `EMAIL_TAKEN`      | 409  | já existe conta com esse e-mail                    |
| `BAD_CREDENTIALS`  | 401  | e-mail inexistente **ou** senha errada             |
| `NOT_AUTHENTICATED`| 401  | rota exige sessão e não veio token válido          |
| `RATE_LIMITED`     | 429  | excedeu o limite da seção 5                        |
| `UNAVAILABLE`      | 5xx  | qualquer falha do servidor ou da rede              |

`BAD_CREDENTIALS` é deliberadamente ambíguo entre "e-mail não existe" e "senha
errada": distinguir os dois entrega quais e-mails têm conta.

---

## 2. Runs

### `POST /runs/start`

Abre uma partida. Sem corpo. Aceita sessão anônima.

**200**

```json
{ "runToken": "b2c1…", "expiresAt": "2026-07-24T13:00:00.000Z" }
```

O token é de uso único, expira em 2 horas e é a única forma de submeter um
score. Ele amarra a submissão a uma partida que realmente começou e dá ao
servidor o relógio de referência para a duração declarada.

### `POST /runs/submit`

**Corpo** (`RunSubmission`)

```json
{
  "runToken": "b2c1…",
  "score": 12340,
  "levelReached": 4,
  "durationMs": 421000,
  "completedGame": false,
  "events": {
    "alienKills": { "A": 74, "B": 66, "C": 33 },
    "splitterKills": 12,
    "ufoKills": 5,
    "bossKills": 3,
    "powerUpsCollected": 9,
    "shotsFired": 1840
  }
}
```

**200 — aceita**

```json
{ "accepted": true, "rank": 7 }
```

`rank` ausente com `accepted: true` significa "gravada, mas fora das 100
melhores". Fora da tabela não é recusa.

**200 — recusada**

```json
{ "accepted": false, "reason": "SCORE_ABOVE_CAP" }
```

Recusa **não é erro HTTP**: o cliente precisa continuar mostrando a tela de fim
de jogo normalmente. Os valores possíveis de `reason` são os de
`RejectionReason` (`src/services/validation/plausibility.ts`) mais
`UNKNOWN_RUN_TOKEN`, `DURATION_MISMATCH` e `RATE_LIMITED`. O critério de cada um
está em [`anti-cheat.md`](./anti-cheat.md).

---

## 3. Ranking

### `GET /leaderboard?scope=global|weekly|me&limit=10`

`scope=me` exige sessão (`NOT_AUTHENTICATED` sem ela). `limit` é 10 por padrão e
100 no máximo.

**200**

```json
{
  "entries": [
    {
      "id": "9f1…",
      "playerName": "RAM",
      "score": 24500,
      "levelReached": 5,
      "durationMs": 892000,
      "completedGame": true,
      "createdAt": "2026-07-20T18:04:11.000Z"
    }
  ]
}
```

A entrada pública **nunca carrega o `userId`** — a ordenação e o recorte
acontecem no servidor, e o dono da linha é detalhe interno.

Ordem: `score` desc → `durationMs` asc → `createdAt` asc. O desempate pela
partida mais curta é o que impede que ficar parado numa fase fácil suba na
tabela.

### `GET /leaderboard/personal-best`

Exige sessão. **200**: `{ "entry": ScoreEntry | null }`.

---

## 4. Autenticação

| Rota                | Corpo                                | Resposta 200                        |
| ------------------- | ------------------------------------ | ----------------------------------- |
| `POST /auth/guest`  | `{ displayName }`                    | `{ session, accessToken }`          |
| `POST /auth/signup` | `{ email, password, displayName }`   | `{ session, accessToken }`          |
| `POST /auth/signin` | `{ email, password }`                | `{ session, accessToken }`          |
| `POST /auth/signout`| —                                    | `{ "ok": true }`                    |
| `GET  /auth/session`| —                                    | `{ session: Session \| null }`      |

`Session`:

```json
{
  "userId": "9f1…",
  "displayName": "RAM",
  "isGuest": true,
  "createdAt": "2026-07-24T12:00:00.000Z"
}
```

**O modo convidado é obrigatório e existe também no servidor.** O jogo é 100%
jogável sem conta; cadastro só serve para reencontrar o próprio histórico em
outro aparelho.

---

## 5. Rate limit

| Rota                | Por conta          | Por IP    | Onde é aplicado                    |
| ------------------- | ------------------ | --------- | ---------------------------------- |
| `POST /runs/start`  | 30/hora            | 90/hora   | `runs-start`                       |
| `POST /runs/submit` | 20/hora + 1 a cada 3 s | 60/hora | `runs-submit`                    |
| `POST /auth/*`      | —                  | painel    | GoTrue (Authentication → Rate Limits) |
| `GET  /leaderboard` | —                  | plataforma| PostgREST/CDN do Supabase          |

**O limite por IP é o triplo do limite por conta, de propósito.** IP não
identifica pessoa: um hotspot de celular, o NAT de uma escola ou dois irmãos no
mesmo Wi-Fi compartilham endereço, e barrar os dois pelo mesmo teto puniria
justamente quem não está abusando. Quem segura o abuso de verdade é o teto por
conta; o de IP existe só para o caso de contas descartáveis em série.

O IP nunca é gravado: o que entra no banco é `sha256(sal:ip)`, com o sal no
segredo `IP_HASH_SALT` da função. Dá para dizer "foi a mesma origem" sem dar para
dizer qual.

**Como o estouro chega ao cliente**, e a diferença importa:

- `POST /runs/start` devolve **429** com `RATE_LIMITED`. Não há partida para
  mostrar; o jogo segue sem token e a submissão do fim vira `unavailable`.
- `POST /runs/submit` devolve **200** com `{ accepted: false, reason:
  'RATE_LIMITED' }`, como qualquer outra recusa. Alguém acabou de jogar: a tela
  de fim de jogo tem de continuar normal.

A contagem sai da tabela `submissions`, que registra toda **tentativa** — contar
só o que foi aceito deixaria um script tentar sem limite até acertar um payload
coerente. A recusa por rate limit é a única que não vira linha lá: registrá-la
faria cada tentativa barrada empurrar a janela para a frente, e quem esbarrasse
no teto uma vez ficaria preso enquanto insistisse.

O adapter local implementa apenas o intervalo mínimo de 3 s entre submissões — o
resto depende de uma visão global que só o servidor tem.

---

## 6. Mapa para o Supabase

| Rota deste contrato              | Implementação                                                   |
| -------------------------------- | --------------------------------------------------------------- |
| `POST /auth/guest`               | `POST /auth/v1/signup` sem e-mail nem senha (usuário anônimo)     |
| `POST /auth/signup`              | `POST /auth/v1/signup`, ou `PUT /auth/v1/user` promovendo o convidado |
| `POST /auth/signin`              | `POST /auth/v1/token?grant_type=password`                         |
| `POST /auth/signout`             | `POST /auth/v1/logout`                                            |
| `GET  /auth/session`             | sessão guardada no aparelho + `token?grant_type=refresh_token`    |
| `POST /runs/start`               | Edge Function `runs-start` → insere em `run_tokens`               |
| `POST /runs/submit`              | Edge Function `runs-submit` → valida e insere em `scores`         |
| `GET  /leaderboard`              | `select` na view `leaderboard_public` via PostgREST               |
| `GET  /leaderboard?scope=me`     | `select` na view `leaderboard_mine` (filtra por `auth.uid()`)     |
| `GET  /leaderboard/personal-best`| a mesma view `leaderboard_mine` com `limit=1`                     |

**O cliente não usa `@supabase/supabase-js`.** O que este jogo precisa do
servidor cabe em cinco rotas do GoTrue, duas consultas ao PostgREST e duas Edge
Functions — tudo `fetch` com dois cabeçalhos (`apikey` e `Authorization`). O SDK
traria um bundle inteiro, um segundo mecanismo de persistência de sessão (que
escreveria em `localStorage` por fora do `JsonStore`, o único arquivo do projeto
autorizado a isso) e um modelo de erro diferente deste contrato.

**Escrever passa por função; ler vai direto à tabela.** Ranking é leitura
pública, cacheável e sem regra nenhuma para aplicar: passar isso por uma Edge
Function só somaria latência entre o jogador e uma tabela que ele pode ler de
qualquer jeito.

### Esquema

O arquivo que vale é `supabase/migrations/20260724120000_init.sql` — o resumo
abaixo existe para leitura, não para copiar e colar.

- **`profiles`** — `user_id`, `display_name` (3–12, no `check`), timestamps.
  A view do ranking é um JOIN com ela: sem perfil, a partida é gravada e nunca
  aparece. Por isso `runs-start` garante a linha no **começo** da partida.
- **`run_tokens`** — `token`, `user_id`, `started_at`, `used_at`, `ip_hash`.
  Consumo atômico (`update … where used_at is null`); expira em 2 h.
- **`scores`** — a partida aceita, com `events` em `jsonb`.
- **`submissions`** — auditoria de toda tentativa, com o motivo da recusa. É de
  onde sai a contagem do rate limit e é onde se olha quando alguém reclama.

Duas views, as duas com `security_invoker = on` para que a RLS das tabelas de
baixo continue valendo através delas: `leaderboard_public` (o ranking) e
`leaderboard_mine` (o recorte `me`, filtrado por `auth.uid()` **no banco**).

A entrada pública nunca carrega `user_id`. Filtrar por dono do lado do cliente
exigiria publicar a coluna — e aí qualquer um leria a tabela de qualquer outro.

Um `score_rank(uuid)` em SQL devolve a posição na mesma ordem de
`services/leaderboard.ts`. Ele mora no banco, e não na função, porque reproduzir
o desempate em filtros do PostgREST exigiria comparar timestamps na query string,
onde o `+` do fuso vira espaço e a conta sai errada em silêncio.

### Políticas de RLS (a parte que não pode ser esquecida)

```sql
alter table scores enable row level security;

-- Leitura pública do ranking, escrita NUNCA pelo cliente.
create policy "ranking e publico" on scores for select using (true);
revoke insert, update, delete on scores from anon, authenticated;
```

A **ausência** de policy de insert/update/delete não é esquecimento, é o
mecanismo: com RLS ligada e sem policy, só a `service_role` grava — e ela só
existe dentro da Edge Function. É isto, e não a obscuridade do bundle, que torna
o validador inescapável. `run_tokens` e `submissions` não têm policy nenhuma,
nem de leitura: token legível pelo cliente é token que um script reusa.

Sem essa configuração o jogador insere a própria linha em `scores` direto pelo
PostgREST e o ranking vira lixo em uma semana — que é exatamente o que a Edge
Function existe para impedir. O item 3 da conferência pós-deploy em
[`supabase-setup.md`](./supabase-setup.md) verifica isso na prática.
