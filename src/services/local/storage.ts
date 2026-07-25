/**
 * Acesso a `localStorage` tolerante a storage indisponivel.
 *
 * Modo privado, iframe com cookies bloqueados e cota estourada sao situacoes
 * NORMAIS, nao excecoes: em todas elas o jogo continua jogavel e o que se perde
 * e' a memoria entre sessoes. Nenhum caminho daqui pode derrubar o boot.
 *
 * Este e' o unico arquivo do projeto que fala com `localStorage` diretamente.
 */

function probeStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    // Toque real: alguns navegadores so' lancam no primeiro acesso de verdade.
    const probe = '__neon_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Prefixo comum de todas as chaves do jogo. */
export const STORAGE_PREFIX = 'neon-invaders:';

export class JsonStore {
  private readonly storage = probeStorage();

  /** Verdadeiro quando ha' storage de verdade — usado so' para diagnostico. */
  get persistent(): boolean {
    return this.storage !== null;
  }

  /** Le e valida. Qualquer defeito devolve `fallback` em vez de lancar. */
  read<T>(key: string, isValid: (value: unknown) => value is T, fallback: T): T {
    try {
      const raw = this.storage?.getItem(STORAGE_PREFIX + key);
      if (!raw) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  write(key: string, value: unknown): void {
    try {
      this.storage?.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // Cota estourada ou storage sumiu no meio da sessao: segue em memoria.
    }
  }

  remove(key: string): void {
    try {
      this.storage?.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Idem.
    }
  }
}

/**
 * Identificador aleatorio.
 *
 * `crypto.randomUUID` so' existe em contexto seguro (https ou localhost) — abrir
 * o jogo pelo IP da rede local para testar no celular cai fora disso. O fallback
 * nao precisa ser criptografico: e' um id de linha de tabela local.
 */
export function randomId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}
