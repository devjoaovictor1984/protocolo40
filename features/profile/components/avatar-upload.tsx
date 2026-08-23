'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/session/session-context';
import { avatarPath, initialsOf } from '@/lib/storage/avatar';
import { processAvatar, previewUrl } from '@/lib/storage/image-pipeline';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Diz o que de fato aconteceu.
 *
 * Um arquivo que o navegador não consegue abrir não é problema de conexão, e
 * mandar a pessoa "verificar a internet" só faz ela tentar de novo o mesmo
 * arquivo quebrado.
 */
function describeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/could not be decoded|decode|Invalid image/i.test(message)) {
    return 'Este arquivo não parece ser uma imagem válida. Tente outra foto.';
  }
  if (message.includes('grande')) {
    return message;
  }
  if (/exceeded the maximum allowed size|Payload too large/i.test(message)) {
    return 'A imagem ficou grande demais depois do processamento. Tente uma foto menor.';
  }
  if (/mime type|not supported/i.test(message)) {
    return 'Formato não aceito. Use JPG, PNG ou WebP.';
  }

  return 'Verifique sua conexão e tente novamente.';
}

/**
 * Foto de perfil.
 *
 * O arquivo é recortado e comprimido no aparelho antes de subir, e sempre grava
 * no mesmo caminho — uma foto por pessoa, sem lixo acumulando no bucket.
 *
 * Diferente da foto de evolução, esta não passa pela fila offline: trocar o
 * avatar não é o caminho crítico do produto, e sem rede o aviso é honesto.
 */
export function AvatarUpload({
  initialUrl,
  size = 'default',
}: {
  initialUrl: string | null;
  size?: 'default' | 'lg';
}) {
  const router = useRouter();
  const { userId, fullName, username } = useSession();

  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const initials = initialsOf(fullName, username);
  const dimension = size === 'lg' ? 'size-24' : 'size-20';

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);

    try {
      const { blob } = await processAvatar(file);
      const path = avatarPath(userId);
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/webp', upsert: true });

      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', userId);

      if (error) throw error;

      // mostra a versão local na hora; o servidor confirma no próximo render
      setUrl(previewUrl(blob));
      toast.success('Foto atualizada.');
      router.refresh();
    } catch (caught) {
      toast.error('Não foi possível enviar a foto.', { description: describeUploadError(caught) });
    } finally {
      setSaving(false);
      if (input.current) input.current.value = '';
    }
  }

  async function handleRemove() {
    setSaving(true);

    try {
      const supabase = createClient();
      await supabase.storage.from('avatars').remove([avatarPath(userId)]);

      const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
      if (error) throw error;

      setUrl(null);
      toast.success('Foto removida.');
      router.refresh();
    } catch {
      toast.error('Não foi possível remover a foto agora.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={saving}
        aria-label={url ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
        className="group relative rounded-full"
      >
        <Avatar className={cn(dimension, 'border-border border-2')}>
          {url ? <AvatarImage src={url} alt="" /> : null}
          <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
        </Avatar>

        <span
          aria-hidden
          className={cn(
            'bg-primary text-primary-foreground absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2',
            'border-background shadow-sm',
          )}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
        </span>
      </button>

      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={(event) => void handleFile(event)}
        className="sr-only"
        id="foto-perfil"
      />

      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          disabled={saving}
          onClick={() => input.current?.click()}
        >
          {saving ? 'Enviando…' : url ? 'Trocar foto' : 'Adicionar foto'}
        </Button>

        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-9"
            disabled={saving}
            onClick={() => void handleRemove()}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remover
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">Quadrada fica melhor. Máx. 25 MB.</p>
        )}
      </div>
    </div>
  );
}
