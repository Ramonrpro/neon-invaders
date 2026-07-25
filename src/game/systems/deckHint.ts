/**
 * A dica de arrasto do deck ja' foi vista nesta sessao?
 *
 * O estado e' de MODULO, nao campo de instancia da `GameScene`, e a diferenca
 * importa. Um campo de instancia tambem sobreviveria entre partidas (o Phaser
 * reaproveita a instancia da Scene), mas cairia na armadilha da secao 8 do
 * CLAUDE.md pelo avesso: `resetRunState()` existe justamente para zerar campos
 * de instancia, e a primeira pessoa que acrescentar um campo esquecido la' vai
 * zerar a dica junto — fazendo o aviso reaparecer a cada partida, que e'
 * exatamente o que ele nao deve fazer.
 *
 * Estado de modulo zera so' no reload da pagina, que e' a definicao operacional
 * de "mesma sessao".
 */

let dismissed = false;

export function isDeckHintDismissed(): boolean {
  return dismissed;
}

export function dismissDeckHint(): void {
  dismissed = true;
}
