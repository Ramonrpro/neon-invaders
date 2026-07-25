/**
 * `AuthService` sobre o GoTrue do Supabase.
 *
 * Tres decisoes que explicam o arquivo:
 *
 * 1. **Convidado = usuario anonimo do GoTrue.** Nao e' um "modo sem conta"
 *    fingido: o servidor emite um `sub` de verdade, com token, e por isso a
 *    partida de quem nunca se cadastrou entra no mesmo ranking de todo mundo.
 *    O jogo continua 100% jogavel sem cadastro, que e' a regra do contrato.
 *
 * 2. **Renomear nao cria conta nova.** A `TitleScene` chama `signInAsGuest`
 *    toda vez que o jogador confirma o nome — inclusive quando so' quis
 *    corrigir uma letra. Criar um usuario anonimo a cada confirmacao encheria a
 *    tabela `auth.users` de contas descartaveis e esbarraria no rate limit do
 *    proprio GoTrue. Com sessao anonima ja' aberta, aqui so' o nome muda.
 *
 * 3. **`getSession` nunca lanca.** Ela roda no caminho de boot da tela de
 *    titulo, que nao tem tratamento de erro: uma excecao ali deixaria a tela
 *    presa em "carregando" para sempre. Rede fora do ar devolve a sessao
 *    guardada; sem sessao guardada, devolve `null` e o jogo pede o nome.
 */

import { normalizeDisplayName, normalizeEmail } from '@services/names';
import { supabaseFetch } from '@services/remote/client';
import type { SupabaseConfig } from '@services/remote/config';
import { RemoteSession, type GoTrueSession } from '@services/remote/session';
import { ServiceError, type AuthService, type Session } from '@services/types';

/** Piso de senha. Baixo de proposito: isto e' um jogo, nao um banco. */
const MIN_PASSWORD_LENGTH = 6;

export class RemoteAuthService implements AuthService {
  constructor(
    private readonly config: SupabaseConfig,
    readonly session = new RemoteSession(config),
  ) {}

  async getSession(): Promise<Session | null> {
    try {
      return await this.session.current();
    } catch {
      return this.session.peek();
    }
  }

  /**
   * Modo convidado.
   *
   * Com sessao anonima aberta, so' renomeia (ver decisao 2 no topo). Sem sessao,
   * abre uma nova pelo login anonimo do GoTrue — que precisa estar habilitado
   * no painel (Authentication > Sign In / Providers > Anonymous sign-ins).
   */
  async signInAsGuest(displayName: string): Promise<Session> {
    const name = normalizeDisplayName(displayName);

    const current = this.session.peek();
    if (current?.isGuest) {
      const renamed = this.session.rename(name);
      if (renamed) {
        await this.pushDisplayName(name);
        return renamed;
      }
    }

    const payload = await supabaseFetch<GoTrueSession>(this.config, '/auth/v1/signup', {
      method: 'POST',
      body: { data: { display_name: name } },
    });
    const session = this.session.adopt(payload, name);
    await this.upsertProfile(session.userId, name);
    return session;
  }

  async signUp(email: string, password: string, displayName: string): Promise<Session> {
    const normalizedEmail = normalizeEmail(email);
    const name = normalizeDisplayName(displayName);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ServiceError(
        'WEAK_PASSWORD',
        `senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    }

    // Convidado com sessao aberta nao vira conta NOVA: a conta anonima e'
    // promovida no lugar, mantendo o mesmo `userId`. E' o que preserva as
    // partidas ja' gravadas — cadastrar-se depois de uma semana jogando nao
    // pode custar o proprio historico.
    const guestToken = this.session.peek()?.isGuest ? await this.session.accessToken() : null;
    if (guestToken) return this.promoteGuest(guestToken, normalizedEmail, password, name);

    const payload = await supabaseFetch<GoTrueSession>(this.config, '/auth/v1/signup', {
      method: 'POST',
      body: { email: normalizedEmail, password, data: { display_name: name } },
    });

    // Com confirmacao de e-mail LIGADA no projeto, o signup devolve o usuario
    // sem token: nao ha' sessao ate' o link ser clicado. O contrato nao tem
    // codigo para "confirme seu e-mail", entao vai como indisponivel com
    // mensagem propria — e `supabase/config.toml` deixa a confirmacao desligada
    // justamente para este caminho ser raro.
    if (!payload.access_token) {
      throw new ServiceError('UNAVAILABLE', 'confirme o e-mail para entrar');
    }

    const session = this.session.adopt(payload, name);
    await this.upsertProfile(session.userId, name);
    return session;
  }

  async signIn(email: string, password: string): Promise<Session> {
    const payload = await supabaseFetch<GoTrueSession>(
      this.config,
      '/auth/v1/token?grant_type=password',
      { method: 'POST', body: { email: normalizeEmail(email), password } },
    );
    const session = this.session.adopt(payload);
    // O perfil pode nao existir se a conta foi criada com confirmacao por
    // e-mail: o `upsert` fecha essa lacuna no primeiro login de verdade.
    await this.upsertProfile(session.userId, session.displayName);
    return session;
  }

  async signOut(): Promise<void> {
    const token = await this.session.accessToken().catch(() => null);
    if (token) {
      // Falha aqui nao pode impedir a saida: a sessao local some de qualquer
      // jeito, e um refresh token orfao expira sozinho.
      await supabaseFetch<void>(this.config, '/auth/v1/logout', {
        method: 'POST',
        accessToken: token,
      }).catch(() => undefined);
    }
    this.session.clear();
  }

  /**
   * Acrescenta e-mail e senha a' conta anonima ja' aberta.
   *
   * A sessao em curso continua valendo — o GoTrue devolve o usuario atualizado,
   * nao um par de tokens novo. Com confirmacao de e-mail ligada no projeto, o
   * endereco so' passa a valer depois do link, mas a sessao (e o ranking) segue
   * funcionando o tempo todo.
   */
  private async promoteGuest(
    token: string,
    email: string,
    password: string,
    displayName: string,
  ): Promise<Session> {
    await supabaseFetch<unknown>(this.config, '/auth/v1/user', {
      method: 'PUT',
      accessToken: token,
      body: { email, password, data: { display_name: displayName } },
    });

    const session = this.session.promote(displayName);
    if (!session) throw new ServiceError('UNAVAILABLE', 'sessao perdida durante o cadastro');
    await this.upsertProfile(session.userId, displayName);
    return session;
  }

  /**
   * Grava o nome na tabela `profiles`.
   *
   * A view do ranking e' um JOIN com ela: sem esta linha, a partida e' aceita e
   * NUNCA aparece na tabela. O `merge-duplicates` faz o insert virar update
   * quando a linha ja' existe — e' a mesma chamada para conta nova e para
   * convidado que trocou de nome.
   */
  private async upsertProfile(userId: string, displayName: string): Promise<void> {
    const token = await this.session.accessToken();
    if (!token) return;
    try {
      await supabaseFetch<void>(this.config, '/rest/v1/profiles', {
        method: 'POST',
        accessToken: token,
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: [{ user_id: userId, display_name: displayName }],
      });
    } catch {
      // Perfil e' consequencia do login, nao condicao dele: quem acabou de
      // entrar nao pode ver a tela travar porque o nome nao subiu. A Edge
      // Function tem `ensureProfile` como rede de seguranca.
    }
  }

  /** Atalho do renomear: o `userId` ja' esta' na sessao guardada. */
  private async pushDisplayName(displayName: string): Promise<void> {
    const userId = this.session.peek()?.userId;
    if (userId) await this.upsertProfile(userId, displayName);
  }
}
