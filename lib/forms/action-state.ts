/**
 * Estado compartilhado dos formulários com Server Actions.
 *
 * Mora fora dos arquivos `'use server'` de propósito: um módulo marcado assim
 * só pode exportar funções assíncronas. Exportar um objeto dali faz o módulo
 * falhar na avaliação — e o formulário quebra na hora do envio, não no build.
 */

export type ActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idleState: ActionState = { status: 'idle' };

/** Transforma os erros do Zod num mapa de campo → mensagem. */
export function fieldErrorsFrom(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }

  return errors;
}

export function invalidState(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ActionState {
  return {
    status: 'error',
    message: 'Confira os campos destacados.',
    fieldErrors: fieldErrorsFrom(issues),
  };
}
