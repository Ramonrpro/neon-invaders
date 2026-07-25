-- ============================================================================
-- NEON INVADERS — esquema do ranking.
--
-- A regra que organiza este arquivo inteiro: **o cliente jamais escreve em
-- `scores`.** Ele le' o ranking direto pelo PostgREST (barato, cacheavel) e
-- submete a partida por uma Edge Function que roda o validador de
-- plausibilidade com a service_role. Sem isso, o jogador insere a propria linha
-- pelo console e o ranking vira lixo em uma semana.
--
-- Ver `docs/api-contract.md` §6 e `docs/anti-cheat.md`.
-- ============================================================================

-- ---------------------------------------------------------------- tabelas

-- Nome de ranking. O `auth.users` do Supabase guarda e-mail e senha; o nome
-- exibido mora aqui porque e' PUBLICO — a view do ranking le' desta tabela, e
-- nada de `auth` pode ser exposto ao `anon`.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 12),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Partidas abertas. Um token vale UMA submissao e da' ao servidor o relogio de
-- referencia da duracao declarada — sem ele, `durationMs` seria mais um numero
-- que o cliente inventa.
create table if not exists public.run_tokens (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  used_at    timestamptz,
  -- SHA-256 do IP com sal do servidor. Serve ao rate limit sem guardar o IP.
  ip_hash    text
);

create table if not exists public.scores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  score          integer not null check (score >= 0),
  level_reached  smallint not null check (level_reached between 1 and 5),
  duration_ms    integer not null check (duration_ms > 0),
  completed_game boolean not null default false,
  events         jsonb not null,
  created_at     timestamptz not null default now()
);

-- Auditoria de submissao, aceita OU recusada.
--
-- Existe por dois motivos que se somam: o rate limit tem de contar TENTATIVAS
-- (contar so' o que foi aceito deixaria um script tentar sem limite ate' achar
-- um payload coerente), e o dia em que alguem reclamar de uma recusa, o motivo
-- precisa estar gravado em algum lugar.
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete set null,
  ip_hash    text,
  accepted   boolean not null,
  reason     text,
  score      integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indices

-- A ordem do ranking, exatamente como `services/leaderboard.ts` a define:
-- score desc, depois a partida mais CURTA, depois a mais antiga. Indice composto
-- na mesma ordem — qualquer divergencia aqui produz a mesma partida em posicoes
-- diferentes conforme quem respondeu.
create index if not exists scores_ranking_idx
  on public.scores (score desc, duration_ms asc, created_at asc);

-- Recorte semanal e recorte "meus".
create index if not exists scores_created_at_idx on public.scores (created_at desc);
create index if not exists scores_user_idx on public.scores (user_id, score desc);

-- Contagens do rate limit (§5 do contrato).
create index if not exists run_tokens_user_idx on public.run_tokens (user_id, started_at desc);
create index if not exists run_tokens_ip_idx on public.run_tokens (ip_hash, started_at desc);
create index if not exists submissions_user_idx on public.submissions (user_id, created_at desc);
create index if not exists submissions_ip_idx on public.submissions (ip_hash, created_at desc);

-- ------------------------------------------------------------------ views

-- `security_invoker = on`: a view roda com os direitos de QUEM consulta, nao com
-- os do dono. E' o que faz a RLS das tabelas de baixo continuar valendo atraves
-- dela — uma view security definer aqui seria um furo com cara de conveniencia.
create or replace view public.leaderboard_public
  with (security_invoker = on) as
  select s.id,
         p.display_name as player_name,
         s.score,
         s.level_reached,
         s.duration_ms,
         s.completed_game,
         s.created_at
    from public.scores s
    join public.profiles p on p.user_id = s.user_id;

-- O recorte "meus". Existe como view separada porque a entrada publica NUNCA
-- pode carregar `user_id` (contrato, §3): filtrar por dono do lado do cliente
-- exigiria expor a coluna, e ai' qualquer um leria a tabela de qualquer outro.
-- Aqui o filtro e' `auth.uid()` — o servidor decide de quem e' a linha.
create or replace view public.leaderboard_mine
  with (security_invoker = on) as
  select s.id,
         p.display_name as player_name,
         s.score,
         s.level_reached,
         s.duration_ms,
         s.completed_game,
         s.created_at
    from public.scores s
    join public.profiles p on p.user_id = s.user_id
   where s.user_id = auth.uid();

-- -------------------------------------------------------------------- RLS

alter table public.profiles    enable row level security;
alter table public.run_tokens  enable row level security;
alter table public.scores      enable row level security;
alter table public.submissions enable row level security;

-- profiles: qualquer um LE' (o ranking mostra o nome), cada um escreve o proprio.
drop policy if exists "perfis sao publicos" on public.profiles;
create policy "perfis sao publicos"
  on public.profiles for select
  using (true);

drop policy if exists "cada um cria o proprio perfil" on public.profiles;
create policy "cada um cria o proprio perfil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cada um edita o proprio perfil" on public.profiles;
create policy "cada um edita o proprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- scores: leitura publica, escrita por NINGUEM.
--
-- A ausencia de policy de insert/update/delete nao e' esquecimento — e' o
-- mecanismo. Com RLS ligada e sem policy, so' a service_role (que ignora RLS)
-- grava, e a service_role so' existe dentro da Edge Function. E' isto que torna
-- o validador inescapavel.
drop policy if exists "ranking e publico" on public.scores;
create policy "ranking e publico"
  on public.scores for select
  using (true);

-- Cinto e suspensorio: mesmo que uma policy de escrita apareca por descuido, o
-- GRANT nao existe.
revoke insert, update, delete on public.scores from anon, authenticated;

-- `run_tokens` e `submissions` ficam sem policy NENHUMA: nem leitura. Um token
-- de partida legivel pelo cliente e' um token que um script reusa; o log de
-- auditoria e' assunto de quem opera o servidor.
revoke all on public.run_tokens  from anon, authenticated;
revoke all on public.submissions from anon, authenticated;

grant select on public.leaderboard_public to anon, authenticated;
grant select on public.leaderboard_mine   to anon, authenticated;

-- ------------------------------------------------------------- posicao

-- Posicao de uma partida na tabela global.
--
-- Mora no banco, e nao na Edge Function, por uma razao de exatidao: a ordem
-- precisa ser a MESMA de `src/services/leaderboard.ts` (score desc, duracao
-- asc, mais antiga primeiro), e reproduzir esse desempate em filtros do
-- PostgREST exigiria comparar timestamps na query string — onde o `+` do fuso
-- vira espaco e a conta sai errada em silencio. Aqui e' uma comparacao SQL.
create or replace function public.score_rank(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 1 + count(*)::int
    from public.scores s, public.scores t
   where t.id = target
     and (
       s.score > t.score
       or (s.score = t.score and s.duration_ms < t.duration_ms)
       or (s.score = t.score and s.duration_ms = t.duration_ms and s.created_at < t.created_at)
     );
$$;

revoke all on function public.score_rank(uuid) from anon, authenticated;

-- --------------------------------------------------------------- limpeza

-- Token expira em 2 horas (contrato §2). Depois disso ele so' ocupa espaco e
-- polui a contagem do rate limit.
create or replace function public.prune_run_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.run_tokens
   where started_at < now() - interval '2 hours';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_run_tokens() from anon, authenticated;

-- Com a extensao pg_cron habilitada no painel, agende a poda de hora em hora:
--
--   select cron.schedule('prune-run-tokens', '0 * * * *',
--                        $$select public.prune_run_tokens()$$);
--
-- Sem pg_cron o esquema continua correto: `runs-start` poda oportunisticamente.
