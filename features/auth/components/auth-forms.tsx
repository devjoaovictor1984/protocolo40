'use client';

import { useActionState } from 'react';

import {
  idleState,
  requestPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
} from '@/features/auth/actions';
import { Field, FormMessage, SubmitButton } from '@/features/auth/components/form-parts';

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(signInWithPassword, idleState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {redirectTo ? <input type="hidden" name="redirect" value={redirectTo} /> : null}
      <FormMessage state={state} />

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

      <SubmitButton>Entrar</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpWithPassword, idleState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Pelo menos 8 caracteres."
        error={state.fieldErrors?.password}
      />

      <SubmitButton>Criar minha conta</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, idleState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        required
        error={state.fieldErrors?.email}
      />

      <SubmitButton>Enviar link de recuperação</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, idleState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Pelo menos 8 caracteres."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Repita a nova senha"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />

      <SubmitButton>Salvar nova senha</SubmitButton>
    </form>
  );
}
