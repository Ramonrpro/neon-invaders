/**
 * O que toda Edge Function deste projeto precisa antes de fazer qualquer coisa:
 * um cliente com service_role, o dono da requisicao e uma marca de origem que
 * sirva ao rate limit sem guardar o IP de ninguem.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  FALLBACK_DISPLAY_NAME,
} from './limits.ts';

/**
 * Cliente administrativo: ignora RLS.
 *
 * E' a unica coisa no sistema inteiro que consegue gravar em `scores`, e e' por
 * isso que o validador e' inescapavel. A chave nunca sai daqui — ela vive no
 * ambiente da funcao, jamais no bundle do jogo.
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente da funcao');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Token do cabecalho `Authorization: Bearer <jwt>`. */
function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Quem esta' chamando.
 *
 * A plataforma ja' verifica a assinatura do JWT (`verify_jwt = true` em
 * `config.toml`), mas `getUser` e' o que confirma que o usuario ainda EXISTE —
 * um token valido de uma conta apagada nao pode abrir partida. Convidado conta
 * como usuario: o modo anonimo do GoTrue emite um `sub` de verdade.
 */
export async function resolveUser(
  admin: SupabaseClient,
  req: Request,
): Promise<{ id: string; displayName: string | null } | null> {
  const token = bearer(req);
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const metadata = data.user.user_metadata as Record<string, unknown> | null;
  const raw = typeof metadata?.display_name === 'string' ? metadata.display_name : null;
  return { id: data.user.id, displayName: raw };
}

/**
 * Marca de origem para o rate limit: SHA-256 de `sal:ip`.
 *
 * O IP em texto puro nao entra no banco. O sal (`IP_HASH_SALT`, um segredo da
 * funcao) impede que alguem com uma copia da tabela reconstrua os enderecos por
 * forca bruta — o espaco de IPv4 e' pequeno o bastante para isso ser trivial sem
 * ele. Sem IP identificavel, resta so' o que interessa: "foi a mesma origem".
 */
export async function originHash(req: Request): Promise<string | null> {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim();
  if (!ip) return null;

  const salt = Deno.env.get('IP_HASH_SALT') ?? '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Quantas linhas a coluna `column` acumulou desde `sinceMs` atras. */
export async function countSince(
  admin: SupabaseClient,
  table: 'run_tokens' | 'submissions',
  column: 'user_id' | 'ip_hash',
  value: string,
  windowMs: number,
  timestampColumn: 'started_at' | 'created_at',
): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value)
    .gte(timestampColumn, since);

  // Falha de contagem NAO pode virar bloqueio: um erro transitorio do banco
  // trancaria o ranking para todo mundo. Na duvida, deixa passar — o teto de
  // plausibilidade continua de pe' adiante.
  if (error) return 0;
  return count ?? 0;
}

/** Nome dentro de 3..12 caracteres, ou `null` se nao der para aproveitar. */
export function sanitizeDisplayName(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) return null;
  return trimmed;
}

/**
 * Garante que a conta tem perfil.
 *
 * A view do ranking e' um JOIN com `profiles`: sem linha la', a partida e'
 * gravada e NUNCA aparece. O cliente cria o perfil no login, mas uma conta que
 * chegou por outro caminho (um token antigo, um cadastro confirmado por e-mail
 * dias depois) nao teria. Rede de seguranca, nao caminho principal.
 */
export async function ensureProfile(
  admin: SupabaseClient,
  userId: string,
  displayName: string | null,
): Promise<void> {
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) return;

  await admin.from('profiles').insert({
    user_id: userId,
    display_name: sanitizeDisplayName(displayName) ?? FALLBACK_DISPLAY_NAME,
  });
}
