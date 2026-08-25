'use client';

import { useState } from 'react';
import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { usePush } from '@/features/notifications/use-push';
import { useInstall } from '@/features/pwa/use-install';

/**
 * Ligar e desligar as notificações.
 *
 * O texto muda com o estado porque os estados pedem coisas diferentes, e
 * oferecer o mesmo botão em todos eles frustra:
 *
 * - **iPhone sem o app instalado** não tem push nenhum. O Safari só expõe a API
 *   em modo standalone. Aqui o caminho é instalar primeiro, e a tela diz isso
 *   em vez de mostrar um botão que não faz nada.
 * - **Negado** não volta pelo app: o navegador não pergunta duas vezes. Um
 *   botão ali seria uma mentira.
 */
export function PushToggle() {
  const { estado, ocupado, ativar, desativar } = usePush();
  const { instalado, plataforma } = useInstall();
  const [mexendo, setMexendo] = useState(false);

  const trabalhando = ocupado || mexendo;
  const precisaInstalar = plataforma === 'ios' && !instalado;

  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        {estado === 'ativo' ? (
          <Bell aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
        ) : (
          <BellOff aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {estado === 'ativo' ? 'Lembretes ligados' : 'Lembretes desligados'}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {precisaInstalar
              ? 'No iPhone, o aviso só funciona com o P20X instalado na tela de início. Instale primeiro — o convite está na tela de Hoje.'
              : estado === 'negado'
                ? 'Você bloqueou os avisos neste navegador. Para voltar atrás, mude nas configurações do site — o app não consegue perguntar de novo.'
                : estado === 'indisponivel'
                  ? 'Este navegador não recebe notificações.'
                  : estado === 'ativo'
                    ? 'Um aviso por dia, no horário que você escolheu, e só quando o dia ainda estiver em aberto. Nada de peso ou medida no texto.'
                    : 'Um aviso por dia, no horário que você escolher. Nunca mais de um, e nada se você já treinou.'}
          </p>
        </div>
      </div>

      {precisaInstalar ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Smartphone aria-hidden className="size-3.5" />
          Instale o app para receber
        </p>
      ) : estado === 'negado' || estado === 'indisponivel' ? null : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={trabalhando}
          onClick={async () => {
            setMexendo(true);

            try {
              if (estado === 'ativo') {
                await desativar();
                toast.success('Lembretes desligados.');
                return;
              }

              const resultado = await ativar();

              if (resultado === 'ativo') toast.success('Pronto. Você vai receber um por dia.');
              else if (resultado === 'negado')
                toast.error('O navegador bloqueou. Mude nas configurações do site.');
              else toast.error('Não deu para ligar agora. Tente de novo.');
            } finally {
              setMexendo(false);
            }
          }}
        >
          {trabalhando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : estado === 'ativo' ? (
            <BellOff aria-hidden className="size-4" />
          ) : (
            <Bell aria-hidden className="size-4" />
          )}
          {estado === 'ativo' ? 'Desligar lembretes' : 'Receber lembrete diário'}
        </Button>
      )}
    </section>
  );
}
