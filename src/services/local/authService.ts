/**
 * Autenticacao local, sobre `localStorage`.
 *
 * O jogo e' 100% jogavel sem conta: `signInAsGuest` nao pede nada alem de um
 * nome e nunca falha por rede. Cadastro com e-mail existe para que a mesma
 * pessoa reencontre o proprio historico depois — e para que o dia da troca pelo
 * adapter remoto nao exija mexer em nenhuma tela.
 *
 * SOBRE A SENHA: guardar hash aqui NAO e' seguranca. Quem abre o console do
 * proprio navegador ja' pode ler e escrever tudo neste storage. O hash existe
 * so' para que uma senha reaproveitada de outro servico nao fique legivel em
 * texto puro no aparelho — e porque o formato de registro precisa ser o mesmo
 * que o servidor vai usar. A autenticacao de verdade nasce no Milestone 9.
 */

import { JsonStore, randomId } from '@services/local/storage';
import { normalizeDisplayName, normalizeEmail } from '@services/names';
import { ServiceError, type AuthService, type Session } from '@services/types';

const SESSION_KEY = 'session';
const ACCOUNTS_KEY = 'accounts';

/** Piso de senha. Baixo de proposito: isto e' um jogo, nao um banco. */
const MIN_PASSWORD_LENGTH = 6;

interface StoredAccount {
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  /** Algoritmo usado — o fallback nao esta' disponivel em todo contexto. */
  algorithm: 'sha-256' | 'fnv1a';
  createdAt: string;
}

type AccountTable = Record<string, StoredAccount>;

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<Session>;
  return (
    typeof session.userId === 'string' &&
    typeof session.displayName === 'string' &&
    typeof session.isGuest === 'boolean' &&
    typeof session.createdAt === 'string'
  );
}

function isAccountTable(value: unknown): value is AccountTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** FNV-1a de 32 bits. Fallback quando `crypto.subtle` nao existe. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 quando o contexto e' seguro; FNV-1a quando nao e'.
 *
 * `crypto.subtle` some fora de https/localhost — abrir o jogo pelo IP da rede
 * local para testar no celular cai exatamente nesse caso. Cadastrar precisa
 * continuar funcionando la'.
 */
async function hashPassword(
  password: string,
  salt: string,
): Promise<{ hash: string; algorithm: StoredAccount['algorithm'] }> {
  const subtle = globalThis.crypto?.subtle;
  const payload = `${salt}:${password}`;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return { hash: toHex(digest), algorithm: 'sha-256' };
  }
  return { hash: fnv1a(payload), algorithm: 'fnv1a' };
}

async function hashWith(
  password: string,
  account: StoredAccount,
): Promise<string> {
  if (account.algorithm === 'fnv1a') return fnv1a(`${account.salt}:${password}`);
  const { hash } = await hashPassword(password, account.salt);
  return hash;
}

export class LocalAuthService implements AuthService {
  private readonly store = new JsonStore();
  /** Espelho em memoria: o storage pode nao existir e a sessao vale mesmo assim. */
  private session: Session | null = null;
  private loaded = false;

  async getSession(): Promise<Session | null> {
    if (!this.loaded) {
      this.session = this.store.read<Session | null>(
        SESSION_KEY,
        (value): value is Session | null => value === null || isSession(value),
        null,
      );
      this.loaded = true;
    }
    return this.session;
  }

  async signInAsGuest(displayName: string): Promise<Session> {
    const session: Session = {
      userId: `guest-${randomId()}`,
      displayName: normalizeDisplayName(displayName),
      isGuest: true,
      createdAt: new Date().toISOString(),
    };
    this.persist(session);
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

    const accounts = this.readAccounts();
    if (accounts[normalizedEmail]) {
      throw new ServiceError('EMAIL_TAKEN', 'e-mail ja cadastrado');
    }

    const salt = randomId();
    const { hash, algorithm } = await hashPassword(password, salt);
    const account: StoredAccount = {
      userId: randomId(),
      email: normalizedEmail,
      displayName: name,
      passwordHash: hash,
      salt,
      algorithm,
      createdAt: new Date().toISOString(),
    };
    accounts[normalizedEmail] = account;
    this.store.write(ACCOUNTS_KEY, accounts);

    const session = this.sessionFor(account);
    this.persist(session);
    return session;
  }

  async signIn(email: string, password: string): Promise<Session> {
    const normalizedEmail = normalizeEmail(email);
    const account = this.readAccounts()[normalizedEmail];
    // Mesma mensagem para e-mail inexistente e senha errada: dizer qual dos dois
    // falhou entrega quais e-mails tem conta.
    if (!account) throw new ServiceError('BAD_CREDENTIALS', 'e-mail ou senha incorretos');

    const hash = await hashWith(password, account);
    if (hash !== account.passwordHash) {
      throw new ServiceError('BAD_CREDENTIALS', 'e-mail ou senha incorretos');
    }

    const session = this.sessionFor(account);
    this.persist(session);
    return session;
  }

  async signOut(): Promise<void> {
    this.session = null;
    this.loaded = true;
    this.store.remove(SESSION_KEY);
  }

  private sessionFor(account: StoredAccount): Session {
    return {
      userId: account.userId,
      displayName: account.displayName,
      isGuest: false,
      createdAt: account.createdAt,
    };
  }

  private persist(session: Session): void {
    this.session = session;
    this.loaded = true;
    this.store.write(SESSION_KEY, session);
  }

  private readAccounts(): AccountTable {
    return this.store.read<AccountTable>(ACCOUNTS_KEY, isAccountTable, {});
  }
}

export function createAuthService(): AuthService {
  return new LocalAuthService();
}
