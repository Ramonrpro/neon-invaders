/**
 * Normalizacao de nome de ranking e de e-mail. Logica pura.
 *
 * Mora fora de `local/` e de `remote/` porque os dois adapters precisam
 * concordar: o nome que o modo convidado aceita hoje tem de ser exatamente o
 * nome que o servidor aceita amanha, senao trocar de adapter muda o que o
 * seletor de tres letras da tela de titulo consegue produzir.
 *
 * O teto de 12 caracteres tambem esta' no `check` da tabela `profiles` — la' e'
 * a ultima palavra; aqui e' o que evita a viagem ate' o banco para ouvir nao.
 */

import { DISPLAY_NAME, ServiceError } from '@services/types';

/** Nome de ranking: 3 a 12 caracteres, sem espaco nas pontas nem duplicado. */
export function normalizeDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < DISPLAY_NAME.minLength || trimmed.length > DISPLAY_NAME.maxLength) {
    throw new ServiceError(
      'INVALID_NAME',
      `nome precisa ter de ${DISPLAY_NAME.minLength} a ${DISPLAY_NAME.maxLength} caracteres`,
    );
  }
  return trimmed;
}

/** E-mail em caixa baixa. Validacao proposital de uma linha — ver abaixo. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  // Quem confirma de verdade e' o servidor, com um e-mail de verificacao; aqui
  // so' filtramos digitacao obviamente errada. Regex de e-mail "completa" e'
  // folclore: ela recusa endereco valido e aceita invalido do mesmo jeito.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ServiceError('INVALID_EMAIL', 'e-mail invalido');
  }
  return email;
}
