/**
 * Ponte entre a partida e o `ScoreService`.
 *
 * Resolve tres problemas que apareceriam espalhados pelas Scenes se cada uma
 * falasse com o servico direto:
 *
 * 1. **Corrida com o overlay.** `scene.launch('GameOver')` so' cria a Scene no
 *    passo seguinte do loop, enquanto a submissao local resolve no microtask —
 *    um evento emitido na hora chegaria antes de existir quem o escutasse. Aqui
 *    o resultado fica GUARDADO, e `onResolved` entrega na hora a quem chegar
 *    depois.
 * 2. **Falha de rede nao pode atrapalhar o jogo.** Ranking fora do ar vira um
 *    texto discreto na tela de resultado, nunca uma excecao no game loop.
 * 3. **Token de partida.** Abrir a run e submetê-la com o mesmo token e' um
 *    detalhe do contrato que nao interessa a nenhuma Scene.
 *
 * Instancia unica de modulo: o token de uma partida precisa continuar valendo
 * entre a `GameScene` que jogou e a `GameOverScene` que reporta.
 */

import { getServices } from '@services/index';
import type { RunSubmission, ScoreService } from '@services/types';

export type SubmissionStatus =
  /** Nenhuma partida submetida ainda nesta sessao. */
  | 'idle'
  /** Enviada, esperando resposta. */
  | 'pending'
  /** Entrou no ranking. */
  | 'accepted'
  /** O validador recusou. Ver `docs/anti-cheat.md`. */
  | 'rejected'
  /** Ranking indisponivel — a partida foi jogada, so' nao foi registrada. */
  | 'unavailable';

export interface SubmissionState {
  status: SubmissionStatus;
  /** Posicao no ranking global, quando entrou na tabela. */
  rank: number | null;
  /** Codigo da recusa, para log. */
  reason: string | null;
}

/** O que a Scene entrega: a submissao sem o token, que e' assunto do reporter. */
export type RunPayload = Omit<RunSubmission, 'runToken'>;

const IDLE: SubmissionState = { status: 'idle', rank: null, reason: null };

export class RunReporter {
  private state: SubmissionState = IDLE;
  private runToken: string | null = null;
  private readonly listeners = new Set<(state: SubmissionState) => void>();

  constructor(private readonly scores: ScoreService) {}

  get current(): SubmissionState {
    return this.state;
  }

  /**
   * Abre uma partida. Chamado no comeco de cada jogo novo.
   *
   * Sem `await` do lado da Scene: um ranking fora do ar nao pode atrasar o
   * primeiro frame. Se o token nao chegar, a partida acontece normalmente e a
   * submissao no fim vira `unavailable`.
   */
  begin(): void {
    this.runToken = null;
    this.state = IDLE;
    void this.scores
      .startRun()
      .then(({ runToken }) => {
        this.runToken = runToken;
      })
      .catch(() => {
        this.runToken = null;
      });
  }

  /** Fecha a partida e submete. O resultado fica guardado em `current`. */
  submit(payload: RunPayload): void {
    if (this.runToken === null) {
      this.resolve({ status: 'unavailable', rank: null, reason: 'NO_RUN_TOKEN' });
      return;
    }

    const submission: RunSubmission = { ...payload, runToken: this.runToken };
    // O token vale uma vez so': soltar aqui evita reenvio se a Scene repetir.
    this.runToken = null;
    this.state = { status: 'pending', rank: null, reason: null };

    void this.scores
      .submitRun(submission)
      .then((result) => {
        this.resolve(
          result.accepted
            ? { status: 'accepted', rank: result.rank ?? null, reason: null }
            : { status: 'rejected', rank: null, reason: result.reason ?? null },
        );
      })
      .catch(() => {
        this.resolve({ status: 'unavailable', rank: null, reason: null });
      });
  }

  /**
   * Avisa quando a submissao resolver. Se ja' resolveu, chama na hora — e' o que
   * torna a ordem entre a submissao e a criacao do overlay irrelevante.
   *
   * @returns funcao para cancelar a inscricao (a Scene chama no shutdown).
   */
  onResolved(listener: (state: SubmissionState) => void): () => void {
    if (this.state.status !== 'pending') {
      listener(this.state);
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resolve(state: SubmissionState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
    this.listeners.clear();
  }
}

let instance: RunReporter | null = null;

/** Instancia unica. Criada no primeiro uso, nunca no import. */
export function getRunReporter(): RunReporter {
  if (!instance) instance = new RunReporter(getServices().scores);
  return instance;
}
