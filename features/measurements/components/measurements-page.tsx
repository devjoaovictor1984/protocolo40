'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { toast } from 'sonner';

import { LineChart } from '@/components/charts';
import { EmptyState } from '@/components/stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { localMeasurements, saveMeasurement } from '@/features/measurements/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { measurementSchema } from '@/lib/validation/profile';
import { formatDay } from '@/services/calendar';
import { weightSeries } from '@/services/progress';
import type { LocalMeasurement } from '@/types/offline';

/**
 * Peso e medidas.
 *
 * Só a data é obrigatória. O peso fica em cima porque é o que a maioria
 * registra todo dia; o resto abre sob demanda e não exige nada.
 */

const BODY_FIELDS = [
  { name: 'waist_cm', label: 'Cintura (cm)' },
  { name: 'chest_cm', label: 'Peito (cm)' },
  { name: 'arm_cm', label: 'Braço (cm)' },
  { name: 'hip_cm', label: 'Quadril (cm)' },
  { name: 'thigh_cm', label: 'Coxa (cm)' },
  { name: 'body_fat_pct', label: 'Gordura (%)' },
] as const;

export function MeasurementsPage({ openFormOnMount = false }: { openFormOnMount?: boolean }) {
  const { userId } = useSession();
  const today = useToday();
  const queryClient = useQueryClient();

  const { data: measurements, isLoading } = useQuery({
    queryKey: ['measurements', userId],
    queryFn: () => localMeasurements(userId),
    staleTime: 10_000,
  });

  const [open, setOpen] = useState(openFormOnMount);
  const [date, setDate] = useState(today);

  const existing = (measurements ?? []).find((item) => item.measured_on === date) ?? null;
  const series = weightSeries(measurements ?? []);

  async function handleSaved() {
    await queryClient.invalidateQueries({ queryKey: ['measurements'] });
    await queryClient.invalidateQueries({ queryKey: ['sync', 'queue'] });
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Medidas</h1>
        {!open ? (
          <Button className="h-11" onClick={() => setOpen(true)}>
            Registrar
          </Button>
        ) : null}
      </header>

      {open ? (
        <MeasurementForm
          // trocar a data remonta o formulário com o que já existe naquele dia,
          // sem efeito nenhum sincronizando estado
          key={date}
          userId={userId}
          today={today}
          date={date}
          onDateChange={setDate}
          existing={existing}
          onSaved={handleSaved}
          onCancel={() => setOpen(false)}
        />
      ) : null}

      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (measurements ?? []).length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Seu ponto de partida começa com um número."
          description="Registre o peso de hoje. Depois é só comparar — nada precisa ser diário."
          action={
            !open ? (
              <Button className="h-12" onClick={() => setOpen(true)}>
                Registrar peso
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <LineChart
            title="Peso"
            unit="kg"
            data={series}
            format={(value) => value.toFixed(1).replace('.', ',')}
            emptyMessage="Nenhum peso registrado ainda."
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Registros
            </h2>
            <ul className="border-border divide-border divide-y rounded-xl border">
              {(measurements ?? []).map((item) => (
                <li key={item.client_id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="tnum font-medium">{formatDay(item.measured_on)}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {[
                        item.waist_cm ? `cintura ${item.waist_cm}` : null,
                        item.chest_cm ? `peito ${item.chest_cm}` : null,
                        item.arm_cm ? `braço ${item.arm_cm}` : null,
                        item.body_fat_pct ? `${item.body_fat_pct}% gordura` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'só peso'}
                    </p>
                  </div>

                  <p className="tnum text-lg font-bold">
                    {item.weight_kg ? `${item.weight_kg.toFixed(1).replace('.', ',')} kg` : '—'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Formulário não controlado: os valores vivem no DOM e são lidos do FormData no
 * envio. Trocar a data remonta o componente pela `key`, então os campos voltam
 * já preenchidos com o registro daquele dia.
 */
function MeasurementForm({
  userId,
  today,
  date,
  onDateChange,
  existing,
  onSaved,
  onCancel,
}: {
  userId: string;
  today: string;
  date: string;
  onDateChange: (date: string) => void;
  existing: LocalMeasurement | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const parsed = measurementSchema.safeParse({
      measured_on: form.get('measured_on'),
      weight_kg: form.get('weight_kg'),
      waist_cm: form.get('waist_cm'),
      chest_cm: form.get('chest_cm'),
      arm_cm: form.get('arm_cm'),
      hip_cm: form.get('hip_cm'),
      thigh_cm: form.get('thigh_cm'),
      body_fat_pct: form.get('body_fat_pct'),
      notes: form.get('notes'),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os valores informados.');
      return;
    }

    const { measured_on, notes, ...numbers } = parsed.data;
    const hasNumber = Object.values(numbers).some((value) => value !== null);

    if (!hasNumber && !notes) {
      setError('Preencha ao menos um campo além da data.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await saveMeasurement({
        userId,
        measuredOn: measured_on,
        weightKg: parsed.data.weight_kg,
        waistCm: parsed.data.waist_cm,
        chestCm: parsed.data.chest_cm,
        armCm: parsed.data.arm_cm,
        hipCm: parsed.data.hip_cm,
        thighCm: parsed.data.thigh_cm,
        bodyFatPct: parsed.data.body_fat_pct,
        notes,
      });

      toast.success('Registrado.');
      await onSaved();
    } catch {
      setError('Não conseguimos salvar agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-border flex flex-col gap-4 rounded-xl border p-4">
      {error ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="measured_on">Data</Label>
          <Input
            id="measured_on"
            name="measured_on"
            type="date"
            defaultValue={date}
            max={today}
            onChange={(event) => onDateChange(event.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="weight_kg">Peso (kg)</Label>
          <Input
            id="weight_kg"
            name="weight_kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="400"
            defaultValue={existing?.weight_kg ?? ''}
            className="tnum h-12 text-base"
            placeholder="86,4"
          />
        </div>
      </div>

      <details>
        <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">
          Medidas do corpo (opcional)
        </summary>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {BODY_FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name} className="text-muted-foreground text-xs">
                {field.label}
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                defaultValue={existing?.[field.name] ?? ''}
                className="tnum h-11"
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="notes" className="text-muted-foreground text-xs">
            Observações
          </Label>
          <Textarea id="notes" name="notes" defaultValue={existing?.notes ?? ''} rows={2} maxLength={500} />
        </div>
      </details>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12 flex-1 font-semibold" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
