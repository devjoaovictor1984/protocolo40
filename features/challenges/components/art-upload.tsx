'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { arteDoDesafio } from '@/features/challenges/components/challenge-card';

/**
 * A arte de fundo do desafio.
 *
 * Antes daqui só existia um campo de texto pedindo o **nome do arquivo** — o
 * que obrigava a subir a imagem pelo painel do Supabase e depois voltar para
 * digitar o nome sem errar uma letra. Quem não sabia disso simplesmente não
 * conseguia pôr arte nenhuma, que é exatamente o que aconteceu.
 *
 * O envio vai direto do navegador para o bucket `challenge-art`, cuja policy
 * de escrita já exige `eh_admin()`. Não passa por Server Action porque uma
 * imagem de fundo tem megabytes, e o limite de corpo de uma action é bem menor
 * — subir pelo storage evita esbarrar nele.
 *
 * O caminho fica num input escondido: quem grava a coluna continua sendo o
 * `salvarDesafio`, junto com o resto do formulário. Assim, enviar a imagem e
 * desistir do desafio não deixa uma linha meio preenchida no banco — só um
 * arquivo órfão no bucket, que é barato e reversível.
 */

/** O que o bucket aceita. Vídeo e SVG ficam de fora de propósito. */
const TIPOS = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024;

export function ArtUpload({ nome, atual }: { nome: string; atual: string | null }) {
  const [caminho, setCaminho] = useState(atual);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function enviar(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    if (!TIPOS.includes(arquivo.type)) {
      toast.error('Formato não aceito.', { description: 'Use WebP, JPG, PNG ou AVIF.' });
      return;
    }

    if (arquivo.size > MAX_BYTES) {
      toast.error('Imagem grande demais.', {
        description: `São ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é 8 MB. Exporte em WebP.`,
      });
      return;
    }

    setEnviando(true);

    try {
      const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'webp';
      // o carimbo de tempo evita que a arte nova fique escondida atrás do cache
      // da antiga, que é servido por um bucket público
      const alvo = `${Date.now()}.${extensao}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from('challenge-art')
        .upload(alvo, arquivo, { contentType: arquivo.type, upsert: false });

      if (error) throw error;

      setCaminho(alvo);
      toast.success('Arte enviada.', { description: 'Salve o desafio para valer.' });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : '';

      toast.error('Não conseguimos enviar a imagem.', {
        description: /row-level security|not authorized|403/i.test(mensagem)
          ? 'Esta conta não tem permissão de administrador para o bucket.'
          : 'Confira a conexão e tente de novo.',
      });
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* é este campo que o salvarDesafio lê; o resto é interface */}
      <input type="hidden" name="image_path" value={caminho ?? ''} />

      {caminho ? (
        <div className="border-border relative aspect-[16/9] w-full overflow-hidden rounded-xl border">
          <Image
            src={arteDoDesafio(caminho) ?? ''}
            alt={`Arte de fundo de ${nome || 'do desafio'}`}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={enviando}
          className="border-border hover:bg-muted text-muted-foreground flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
        >
          {enviando ? (
            <Loader2 aria-hidden className="size-6 animate-spin" />
          ) : (
            <ImageUp aria-hidden className="size-6" />
          )}
          <span className="text-sm font-medium">
            {enviando ? 'Enviando…' : 'Escolher a arte de fundo'}
          </span>
          <span className="text-xs">WebP, JPG ou PNG · até 8 MB · 16:9 fica melhor</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/webp,image/jpeg,image/png,image/avif"
        onChange={(evento) => void enviar(evento)}
        className="sr-only"
        id={`arte-arquivo-${nome || 'novo'}`}
      />

      {caminho ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            disabled={enviando}
            onClick={() => input.current?.click()}
          >
            {enviando ? 'Enviando…' : 'Trocar arte'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-10"
            disabled={enviando}
            onClick={() => setCaminho(null)}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Usar cartão simples
          </Button>
        </div>
      ) : null}

      {/* a arte é fundo, não cartaz: o app desenha o nome e a frase por cima */}
      <p className="text-muted-foreground text-xs">
        A arte é <strong>fundo</strong>: o nome, a frase e a contagem de dias são escritos pelo app
        em cima dela. Não mande imagem com texto — ele fica ilegível num telefone, não acompanha o
        tema claro e escuro e não é lido em voz alta por leitor de tela.
      </p>
    </div>
  );
}
