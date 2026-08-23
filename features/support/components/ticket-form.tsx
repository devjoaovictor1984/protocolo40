'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTicket } from '@/features/support/actions';
import { idleState } from '@/lib/forms/action-state';
import { cn } from '@/lib/utils';
import { MAX_SCREENSHOT_BYTES, TICKET_KINDS } from '@/lib/validation/support';

/**
 * Fale com a gente.
 *
 * Quatro campos e um print opcional. A página de onde veio e o aparelho são
 * preenchidos sozinhos: quem está relatando um erro não deveria ter que
 * descrever o próprio navegador.
 */
export function TicketForm({ paginaAtual }: { paginaAtual?: string }) {
  const [state, action] = useActionState(createTicket, idleState);
  const [kind, setKind] = useState<string>('erro');
  const [preview, setPreview] = useState<string | null>(null);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);

  // enviado com sucesso: o formulário volta limpo para o próximo relato.
  // O ajuste é feito na renderização, e não num efeito, para não existir um
  // quadro com a mensagem de sucesso e o texto antigo ainda na tela.
  const [ultimoEstado, setUltimoEstado] = useState(state);
  if (state !== ultimoEstado) {
    setUltimoEstado(state);
    if (state.status === 'success') {
      setPreview(null);
      setErroAnexo(null);
    }
  }

  useEffect(() => {
    if (state.status === 'success') {
      formulario.current?.reset();
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setErroAnexo(null);

    if (!file) {
      setPreview(null);
      return;
    }

    if (file.size > MAX_SCREENSHOT_BYTES) {
      setErroAnexo('Esta imagem passa de 3 MB. Escolha outra ou tire um print da tela.');
      event.target.value = '';
      setPreview(null);
      return;
    }

    setPreview(URL.createObjectURL(file));
  }

  return (
    <form ref={formulario} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="page_url" value={paginaAtual ?? ''} />
      <input
        type="hidden"
        name="user_agent"
        value={typeof navigator === 'undefined' ? '' : navigator.userAgent}
      />

      {state.status !== 'idle' && state.message ? (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            state.status === 'error'
              ? 'border-destructive/30 bg-destructive/8 text-destructive'
              : 'border-success/30 bg-success/8 text-success',
          )}
        >
          {state.status === 'success' ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4" />
          ) : null}
          {state.message}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Sobre o que é?</legend>
        <input type="hidden" name="kind" value={kind} />

        <div className="grid grid-cols-2 gap-2">
          {TICKET_KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
              className={cn(
                'min-h-12 rounded-xl border px-3 text-sm font-medium transition-colors',
                kind === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          maxLength={120}
          placeholder="Em poucas palavras"
          aria-invalid={state.fieldErrors?.title ? true : undefined}
          className="h-12 text-base"
        />
        {state.fieldErrors?.title ? (
          <p className="text-destructive text-sm">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">O que aconteceu?</Label>
        <Textarea
          id="body"
          name="body"
          rows={6}
          maxLength={4000}
          placeholder="Conte com as suas palavras. Se for um erro, diga o que você estava fazendo quando ele apareceu."
          aria-invalid={state.fieldErrors?.body ? true : undefined}
        />
        {state.fieldErrors?.body ? (
          <p className="text-destructive text-sm">{state.fieldErrors.body}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="screenshot">Print da tela (opcional)</Label>
        <input
          ref={arquivo}
          id="screenshot"
          name="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="sr-only"
        />

        {preview ? (
          <div className="border-border relative w-40 overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob local */}
            <img src={preview} alt="Print escolhido" className="w-full object-cover" />
            <button
              type="button"
              aria-label="Remover o print"
              onClick={() => {
                if (arquivo.current) arquivo.current.value = '';
                setPreview(null);
              }}
              className="bg-background/90 absolute top-1 right-1 rounded-full p-1.5"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 self-start"
            onClick={() => arquivo.current?.click()}
          >
            <ImagePlus aria-hidden className="size-4" />
            Anexar um print
          </Button>
        )}

        {erroAnexo ? <p className="text-destructive text-sm">{erroAnexo}</p> : null}
        {state.fieldErrors?.screenshot ? (
          <p className="text-destructive text-sm">{state.fieldErrors.screenshot}</p>
        ) : null}
      </div>

      <Button type="submit" className="h-14 text-base font-semibold">
        <Send aria-hidden className="size-4" />
        ENVIAR
      </Button>
    </form>
  );
}
