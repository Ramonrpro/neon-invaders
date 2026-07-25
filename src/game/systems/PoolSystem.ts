/**
 * Pool generico de objetos.
 *
 * Todo objeto de vida curta do jogo (projeteis, particulas, explosoes) sai
 * daqui. Nada de `new` dentro de `update()` — alocacao por frame gera pausa de
 * GC, e pausa de GC em um jogo de 60 fps aparece como travadinha.
 *
 * `release` usa swap-remove: O(1) e sem alocar array novo (diferente de splice).
 */
export class Pool<T> {
  private readonly free: T[] = [];
  private readonly active: T[] = [];

  constructor(size: number, factory: (index: number) => T) {
    for (let i = 0; i < size; i++) {
      this.free.push(factory(i));
    }
  }

  get activeCount(): number {
    return this.active.length;
  }

  get freeCount(): number {
    return this.free.length;
  }

  /**
   * Itens em uso. Ao percorrer liberando itens, itere de tras para frente —
   * o swap-remove reposiciona o ultimo elemento sobre o removido.
   */
  get activeItems(): readonly T[] {
    return this.active;
  }

  /** Pega um item livre, ou `null` se o pool estourou. */
  acquire(): T | null {
    const item = this.free.pop();
    if (item === undefined) return null;
    this.active.push(item);
    return item;
  }

  release(item: T): void {
    const index = this.active.indexOf(item);
    if (index < 0) return;
    const last = this.active[this.active.length - 1]!;
    this.active[index] = last;
    this.active.pop();
    this.free.push(item);
  }

  releaseAll(): void {
    while (this.active.length > 0) {
      this.free.push(this.active.pop()!);
    }
  }
}
