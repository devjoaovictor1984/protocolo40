'use client';

import { getDb, listMeasurements, putMeasurement } from '@/lib/offline/db';
import { enqueue } from '@/lib/offline/queue';
import { createClient } from '@/lib/supabase/client';
import type { LocalMeasurement } from '@/types/offline';

/**
 * Peso e medidas.
 *
 * Uma medida por dia: registrar de novo no mesmo dia atualiza a anterior, em
 * vez de criar uma segunda linha. Só a data é obrigatória — todo o resto é
 * opcional, porque ninguém mede coxa e quadril todo dia.
 */

export type SaveMeasurementInput = {
  userId: string;
  measuredOn: string;
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  bodyFatPct?: number | null;
  notes?: string | null;
};

export async function saveMeasurement(input: SaveMeasurementInput): Promise<LocalMeasurement> {
  const existing = (await listMeasurements(input.userId)).find(
    (item) => item.measured_on === input.measuredOn,
  );

  const measurement: LocalMeasurement = {
    client_id: existing?.client_id ?? crypto.randomUUID(),
    user_id: input.userId,
    remote_id: existing?.remote_id ?? null,
    measured_on: input.measuredOn,
    weight_kg: input.weightKg ?? existing?.weight_kg ?? null,
    waist_cm: input.waistCm ?? existing?.waist_cm ?? null,
    chest_cm: input.chestCm ?? existing?.chest_cm ?? null,
    arm_cm: input.armCm ?? existing?.arm_cm ?? null,
    hip_cm: input.hipCm ?? existing?.hip_cm ?? null,
    thigh_cm: input.thighCm ?? existing?.thigh_cm ?? null,
    body_fat_pct: input.bodyFatPct ?? existing?.body_fat_pct ?? null,
    notes: input.notes ?? existing?.notes ?? null,
    sync_state: 'pending',
    sync_error: null,
    updated_at: Date.now(),
  };

  await putMeasurement(measurement);
  await enqueue('CREATE_MEASUREMENT', measurement.client_id);

  return measurement;
}

export async function localMeasurements(userId: string): Promise<LocalMeasurement[]> {
  return listMeasurements(userId);
}

export async function measurementOn(userId: string, day: string): Promise<LocalMeasurement | null> {
  const all = await listMeasurements(userId);
  return all.find((item) => item.measured_on === day) ?? null;
}

/** O peso mais recente registrado, para pré-preencher formulários. */
export async function latestWeight(userId: string): Promise<number | null> {
  const all = await listMeasurements(userId);
  return all.find((item) => item.weight_kg !== null)?.weight_kg ?? null;
}

/** Traz do servidor as medidas e guarda no aparelho. */
export async function hydrateMeasurements(userId: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('measured_on', { ascending: false })
    .limit(400);

  if (error || !data) return 0;

  const db = await getDb();
  let stored = 0;

  for (const row of data) {
    const existing = await db.get('measurements', row.client_id);
    if (existing && existing.sync_state !== 'synced') continue;

    await db.put('measurements', {
      client_id: row.client_id,
      user_id: userId,
      remote_id: row.id,
      measured_on: row.measured_on,
      weight_kg: row.weight_kg,
      waist_cm: row.waist_cm,
      chest_cm: row.chest_cm,
      arm_cm: row.arm_cm,
      hip_cm: row.hip_cm,
      thigh_cm: row.thigh_cm,
      body_fat_pct: row.body_fat_pct,
      notes: row.notes,
      sync_state: 'synced',
      sync_error: null,
      updated_at: Date.now(),
    });

    stored += 1;
  }

  return stored;
}
