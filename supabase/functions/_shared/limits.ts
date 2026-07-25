/**
 * Limites operacionais do servidor. Sao POLITICA, nao regra de jogo.
 *
 * Nada aqui se confunde com `_shared/validation/limits.ts`, que guarda os tetos
 * FISICOS do jogo (quantos aliens uma formacao tem, quanto HP tem um chefao).
 * Aqueles dizem se a partida podia ter acontecido; estes dizem quantas vezes por
 * hora vale a pena escutar o mesmo aparelho.
 *
 * A tabela publicada esta' em `docs/api-contract.md` §5.
 */

/** Uma hora, em ms — janela de todas as contagens abaixo. */
export const HOUR_MS = 60 * 60 * 1000;

/** Partidas abertas por hora, por conta. Uma a cada 2 minutos ja' e' folgado. */
export const RUN_START_PER_USER_PER_HOUR = 30;

/**
 * Partidas abertas por hora, por IP — o TRIPLO do limite por conta.
 *
 * Aqui o contrato e' deliberadamente afrouxado: IP nao identifica pessoa. Um
 * hotspot de celular, o NAT de uma escola ou dois irmaos no mesmo Wi-Fi
 * compartilham endereco, e o teto por conta ja' segura o abuso de verdade. O
 * limite por IP existe so' para o caso de contas descartaveis em serie.
 */
export const RUN_START_PER_IP_PER_HOUR = RUN_START_PER_USER_PER_HOUR * 3;

/** Submissoes por hora, por conta. Conta TENTATIVA, aceita ou recusada. */
export const SUBMIT_PER_USER_PER_HOUR = 20;

/** Submissoes por hora, por IP. Mesmo raciocinio do teto de partidas. */
export const SUBMIT_PER_IP_PER_HOUR = SUBMIT_PER_USER_PER_HOUR * 3;

/** Intervalo minimo entre duas submissoes da mesma conta. */
export const SUBMIT_MIN_INTERVAL_MS = 3000;

/** Validade do token de partida (contrato §2). */
export const RUN_TOKEN_TTL_MS = 2 * HOUR_MS;

/**
 * Folga entre a duracao declarada e o relogio do servidor.
 *
 * A checagem e' so' de TETO. O relogio do jogo para quando a aba perde o foco
 * (o Phaser congela o loop), entao o tempo declarado e' sempre menor ou igual ao
 * tempo de parede — declarar menos e' rotina, declarar mais e' impossivel.
 * Mesmo valor do adapter local, pelo mesmo motivo.
 */
export const CLOCK_TOLERANCE_MS = 5000;

/** Tamanho da tabela: acima disso a partida e' gravada, mas sem posicao. */
export const LEADERBOARD_CAPACITY = 100;

/** Nome de exibicao quando a conta chega sem perfil. Ver `ensureProfile`. */
export const FALLBACK_DISPLAY_NAME = 'PILOTO';

/** Limites de `displayName`, iguais aos de `src/services/types.ts`. */
export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 12;
