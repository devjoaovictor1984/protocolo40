'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AuthError } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
} from '@/lib/validation/auth';

export type ActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idleState: ActionState = { status: 'idle' };

/**
 * Traduz o erro do Supabase para uma frase que explica o que aconteceu e o que
 * fazer. Nunca devolvemos a mensagem crua nem stack trace para o usuário.
 */
function describeAuthError(error: AuthError): string {
  const code = error.code ?? '';

  if (code === 'invalid_credentials' || error.message.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira e tente de novo.';
  }
  if (code === 'email_not_confirmed') {
    return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  }
  if (code === 'user_already_exists' || error.message.includes('already registered')) {
    return 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.';
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
  }
  if (code === 'weak_password') {
    return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  }
  if (code === 'same_password') {
    return 'A nova senha precisa ser diferente da anterior.';
  }

  return 'Não foi possível concluir agora. Tente novamente em instantes.';
}

function fieldErrorsFrom(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}

function invalid(issues: readonly { path: readonly PropertyKey[]; message: string }[]): ActionState {
  return {
    status: 'error',
    message: 'Confira os campos destacados.',
    fieldErrors: fieldErrorsFrom(issues),
  };
}

export async function signInWithPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: 'error', message: describeAuthError(error) };
  }

  const requested = String(formData.get('redirect') ?? '');
  revalidatePath('/', 'layout');
  redirect(requested.startsWith('/') ? requested : '/app');
}

export async function signUpWithPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding` },
  });

  if (error) {
    return { status: 'error', message: describeAuthError(error) };
  }

  // Com confirmação de e-mail ligada ainda não existe sessão: o usuário precisa
  // clicar no link. Sem confirmação, já entra direto.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/onboarding');
  }

  return {
    status: 'success',
    message: 'Enviamos um link de confirmação para o seu e-mail. Abra para ativar sua conta.',
  };
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/redefinir-senha`,
  });

  if (error && error.code === 'over_email_send_rate_limit') {
    return { status: 'error', message: describeAuthError(error) };
  }

  // A resposta é a mesma existindo ou não a conta: não confirmamos para
  // estranhos quais e-mails estão cadastrados.
  return {
    status: 'success',
    message: 'Se existir uma conta com esse e-mail, o link de recuperação está a caminho.',
  };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'error',
      message: 'Seu link de recuperação expirou. Peça um novo para continuar.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { status: 'error', message: describeAuthError(error) };
  }

  revalidatePath('/', 'layout');
  redirect('/app');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
