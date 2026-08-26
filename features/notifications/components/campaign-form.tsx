'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Send, TestTube } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  dispararCampanha,
  testarNoMeuAparelho,
  type EstadoDaCampanha,
} from '@/features/notifications/admin-actions';
import { cn } from '@/lib/utils';
import type { Orcamento } from '@/services/campaign-budget';

const inicial: EstadoDaCampanha = { status: 'idle' };

/**
 * Escrever e disparar uma campanha.
 *
 * A prévia não é enfeite: uma notificação é vista em uma linha e meia, e a
 * diferença entre um título de 40 e um de 70 caracteres é a diferença entre a
 * frase inteira e a frase cortada. Ver antes evita descobrir depois de mandar
 * para todo mundo.
 *
 * O botão de teste manda só para o próprio aparelho, e existe pelo mesmo motivo.
 */
export function CampaignForm({
  inscritos,
  orcamento,
}: {
  inscritos: number;
  orcamento: Orcamento;
}) {
  const [envio, dispararAction] = useActionState(dispararCampanha, inicial);
  const [teste, testarAction] = useActionState(testarNoMeuAparelho, inicial);

  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');

  const estado = envio.status !== 'idle' ? envio : teste;

  return (
    <form className="flex flex-col gap-4">
      {estado.status !== 'idle' && estado.mensagem ? (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            estado.status === 'erro'
              ? 'border-destructive/30 bg-destructive/8 text-destructive'
              : 'border-success/30 bg-success/8 text-success',
          )}
        >
          {estado.status === 'ok' ? <CheckCircle2 aria-hidden className="mt-0.5 size-4" /> : null}
          {estado.mensagem}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="title"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={60}
          placeholder="O Desafio de Setembro começou"
          className="h-12"
          required
        />
        <p className="text-muted-foreground tnum text-xs">{titulo.length}/60</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="corpo">Mensagem</Label>
        <Textarea
          id="corpo"
          name="body"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          maxLength={180}
          rows={3}
          placeholder="Trinta dias, vinte minutos por dia. Entre agora e comece com todo mundo."
          required
        />
        <p className="text-muted-foreground tnum text-xs">{corpo.length}/180</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="url">Para onde leva</Label>
        <Input
          id="url"
          name="url"
          defaultValue="/hoje"
          placeholder="/desafios/setembro-2026"
          className="h-12"
        />
        <p className="text-muted-foreground text-xs">
          Só caminho de dentro do app. Endereço de outro site é recusado e vira /hoje.
        </p>
      </div>

      <Previa titulo={titulo} corpo={corpo} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" formAction={testarAction} variant="outline" className="h-12 flex-1">
          <TestTube aria-hidden className="size-4" />
          Testar no meu aparelho
        </Button>

        {/* o teste continua liberado quando o orçamento acaba: ele vai só para
            o próprio aparelho e não gasta nada de ninguém */}
        <Button
          type="submit"
          formAction={dispararAction}
          disabled={!orcamento.podeEnviar}
          className="h-12 flex-1 font-semibold"
        >
          <Send aria-hidden className="size-4" />
          ENVIAR PARA {inscritos}
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        {orcamento.motivo ??
          `Vai para ${inscritos} ${inscritos === 1 ? 'aparelho' : 'aparelhos'} de uma vez, e não tem como desfazer. Teste antes.`}
      </p>
    </form>
  );
}

/** Como fica no aparelho — em uma linha e meia, que é o que aparece de verdade. */
function Previa({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-xl p-4">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Como chega
      </p>

      <div className="bg-background border-border flex items-start gap-3 rounded-xl border p-3 shadow-sm">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold"
        >
          P20X
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{titulo || 'Título da notificação'}</p>
          <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
            {corpo || 'A mensagem aparece aqui, cortada onde o aparelho corta.'}
          </p>
        </div>
      </div>
    </div>
  );
}
