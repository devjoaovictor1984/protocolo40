'use client';

import { useActionState, useState } from 'react';
import { CalendarRange, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { salvarDesafio, type EstadoDoFormulario } from '@/features/challenges/admin-actions';
import { ArtUpload } from '@/features/challenges/components/art-upload';
import { cn } from '@/lib/utils';
import { esbocoDoMes, MESES } from '@/services/challenges';
import type { ChallengeRow } from '@/types/database';

const inicial: EstadoDoFormulario = { status: 'idle' };

/**
 * Edição de um desafio. `desafio` nulo cria um novo.
 *
 * Os campos são controlados, e não `defaultValue`, por causa do seletor de mês:
 * ele precisa escrever em seis deles de uma vez. Uncontrolled obrigaria a mexer
 * no DOM por `ref`, que funciona até alguém remontar o formulário.
 */
export function ChallengeForm({
  desafio,
  insignias,
}: {
  desafio: ChallengeRow | null;
  insignias: { slug: string; name: string }[];
}) {
  const [state, action] = useActionState(salvarDesafio, inicial);
  const id = desafio?.id ?? 'novo';

  const [campos, setCampos] = useState({
    title: desafio?.title ?? '',
    slug: desafio?.slug ?? '',
    tagline: desafio?.tagline ?? '',
    description: desafio?.description ?? '',
    starts_on: desafio?.starts_on ?? '',
    ends_on: desafio?.ends_on ?? '',
    goal: String(desafio?.goal ?? 25),
    badge_slug: desafio?.badge_slug ?? '',
  });

  const mudar = (chave: keyof typeof campos) => (valor: string) =>
    setCampos((atual) => ({ ...atual, [chave]: valor }));

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status !== 'idle' && state.mensagem ? (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            state.status === 'erro'
              ? 'border-destructive/30 bg-destructive/8 text-destructive'
              : 'border-success/30 bg-success/8 text-success',
          )}
        >
          {state.status === 'ok' ? <CheckCircle2 aria-hidden className="mt-0.5 size-4" /> : null}
          {state.mensagem}
        </p>
      ) : null}

      {desafio ? <input type="hidden" name="id" value={desafio.id} /> : null}

      <SeletorDeMes
        aoEscolher={(esboco) =>
          setCampos((atual) => ({
            ...atual,
            title: esboco.title,
            slug: esboco.slug,
            starts_on: esboco.starts_on,
            ends_on: esboco.ends_on,
            goal: String(esboco.goal),
            badge_slug: esboco.badge_slug,
            // a frase e o texto não são preenchidos: são o que só quem escreve
            // sabe, e um placeholder genérico aqui viraria texto publicado
            tagline: atual.tagline || '20 minutos. Todos os dias.',
          }))
        }
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`title-${id}`}>Nome</Label>
        <Input
          id={`title-${id}`}
          name="title"
          value={campos.title}
          onChange={(e) => mudar('title')(e.target.value)}
          placeholder="Desafio de Outubro"
          className="h-12"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`slug-${id}`}>Endereço</Label>
        <Input
          id={`slug-${id}`}
          name="slug"
          value={campos.slug}
          onChange={(e) => mudar('slug')(e.target.value)}
          placeholder="outubro-2026"
          className="h-12"
          required
        />
        {/* o endereço entra na URL e é o que a pessoa compartilha; trocar depois
            quebraria os links já enviados */}
        <p className="text-muted-foreground text-xs">
          Vira o endereço da página: /desafios/<span className="font-mono">endereco</span>. Só
          minúsculas, números e hífen — e melhor não mudar depois que alguém já compartilhou.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`tagline-${id}`}>Frase curta</Label>
        <Input
          id={`tagline-${id}`}
          name="tagline"
          value={campos.tagline}
          onChange={(e) => mudar('tagline')(e.target.value)}
          placeholder="20 minutos. Todos os dias."
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`description-${id}`}>A ideia do desafio</Label>
        <Textarea
          id={`description-${id}`}
          name="description"
          value={campos.description}
          onChange={(e) => mudar('description')(e.target.value)}
          rows={8}
          placeholder="Por que este desafio existe, o que ele cobra e o que acontece se falhar um dia."
          required
        />
        <p className="text-muted-foreground text-xs">
          Linha em branco separa parágrafos. É o texto que convence alguém a entrar — vale escrever
          com calma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`starts-${id}`}>Começa em</Label>
          <Input
            id={`starts-${id}`}
            name="starts_on"
            type="date"
            value={campos.starts_on}
            onChange={(e) => mudar('starts_on')(e.target.value)}
            className="h-12"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`ends-${id}`}>Termina em</Label>
          <Input
            id={`ends-${id}`}
            name="ends_on"
            type="date"
            value={campos.ends_on}
            onChange={(e) => mudar('ends_on')(e.target.value)}
            className="h-12"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`goal-${id}`}>Dias para concluir</Label>
          <Input
            id={`goal-${id}`}
            name="goal"
            type="number"
            inputMode="numeric"
            min={1}
            value={campos.goal}
            onChange={(e) => mudar('goal')(e.target.value)}
            className="h-12"
            required
          />
          <p className="text-muted-foreground text-xs">
            Deixe folga: um desafio sem margem quebra na primeira gripe e a pessoa abandona o mês.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`badge-${id}`}>Insígnia ao concluir</Label>
          <select
            id={`badge-${id}`}
            name="badge_slug"
            value={campos.badge_slug}
            onChange={(e) => mudar('badge_slug')(e.target.value)}
            className="border-input bg-background h-12 rounded-md border px-3 text-sm"
          >
            <option value="">Nenhuma</option>
            {insignias.map((insignia) => (
              <option key={insignia.slug} value={insignia.slug}>
                {insignia.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Arte de fundo</Label>
        <ArtUpload nome={campos.title} atual={desafio?.image_path ?? null} />
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={desafio?.is_active ?? true}
          className="accent-primary size-5"
        />
        Aparecer para todo mundo
      </label>

      <Button type="submit" className="h-12">
        {desafio ? 'Salvar' : 'Criar desafio'}
      </Button>
    </form>
  );
}

/**
 * Escolher o mês em vez de digitar seis campos.
 *
 * Quase todo desafio do app é um mês fechado, e montar um à mão significava
 * acertar nome, endereço, as duas datas, a meta e a insígnia — todos dependentes
 * uns dos outros. Apontar a insígnia de outubro num desafio de novembro, ou
 * errar o último dia de fevereiro, é o tipo de erro que só aparece depois que
 * alguém já entrou.
 *
 * Preenche, não trava: tudo continua editável logo abaixo.
 */
function SeletorDeMes({
  aoEscolher,
}: {
  aoEscolher: (esboco: NonNullable<ReturnType<typeof esbocoDoMes>>) => void;
}) {
  const anoAtual = new Date().getFullYear();
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState(String(anoAtual));

  const esboco = mes ? esbocoDoMes(Number(ano), Number(mes)) : null;

  return (
    <section className="border-border bg-muted/40 flex flex-col gap-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarRange aria-hidden className="text-muted-foreground size-4" />
        Desafio de um mês
      </h3>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <select
          aria-label="Mês do desafio"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border-input bg-background h-11 rounded-md border px-3 text-sm"
        >
          <option value="">Escolher mês…</option>
          {MESES.map((item) => (
            <option key={item.numero} value={item.numero}>
              {item.nome}
            </option>
          ))}
        </select>

        <Input
          aria-label="Ano do desafio"
          type="number"
          inputMode="numeric"
          min={anoAtual}
          max={anoAtual + 5}
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          className="h-11 w-24"
        />

        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={esboco === null}
          onClick={() => esboco && aoEscolher(esboco)}
        >
          Preencher
        </Button>
      </div>

      {esboco ? (
        <p className="text-muted-foreground text-xs">
          Preenche <span className="font-mono">{esboco.slug}</span>, de 1 a {esboco.diasDoMes} do
          mês, meta de <strong>{esboco.goal} dias</strong> — o mês inteiro menos cinco de folga — e
          a insígnia do mês. Falta só escrever a ideia do desafio.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Escolha o mês e o app monta nome, endereço, datas, meta e insígnia. Tudo continua
          editável depois.
        </p>
      )}
    </section>
  );
}
