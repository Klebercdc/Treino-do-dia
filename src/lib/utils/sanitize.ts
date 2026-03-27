const MAX_USER_MESSAGE_LEN = 4000;

export function sanitizeUserInput(input: string, maxLength = MAX_USER_MESSAGE_LEN): string {
  const normalized = input.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('Mensagem vazia após sanitização.');
  }

  if (normalized.length > maxLength) {
    throw new Error(`Mensagem excede limite de ${maxLength} caracteres.`);
  }

  return normalized;
}
