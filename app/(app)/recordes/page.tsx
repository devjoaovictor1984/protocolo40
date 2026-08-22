import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy } from 'lucide-react';

import { EmptyState, RecordBadge } from '@/components/stats';
import { Button } from '@/components/ui/button';
import { formatRecordValue, listRecords } from '@/features/records/queries';
import { requireUser } from '@/lib/auth/session';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = { title: 'Recordes', robots: { index: false, follow: false } };

export default async function RecordesPage() {
  const user = await requireUser();
  const groups = await listRecords(user.id);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Recordes</h1>
        <p className="text-muted-foreground text-sm">
          Detectados automaticamente quando o treino sincroniza.
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Seu primeiro treino já vira recorde."
          description="A partir dele, cada marca superada aparece aqui com a data e o valor anterior."
          action={
            <Button render={<Link href="/treino/hoje?auto=1" />} className="h-12">
              COMEÇAR TREINO
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.key}>
              <details className="border-border group rounded-xl border">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{group.title}</p>
                    <p className="text-muted-foreground tnum mt-0.5 text-sm">
                      {formatDay(group.current.achievedOn)}
                      {group.current.previousValue !== null
                        ? ` · antes: ${group.current.previousValue}`
                        : ' · primeira marca'}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-lg font-extrabold">
                    {formatRecordValue(group.current)}
                  </span>
                </summary>

                {group.history.length > 1 ? (
                  <ul className="border-border divide-border divide-y border-t">
                    {group.history.map((entry) => (
                      <li key={entry.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="tnum text-muted-foreground">{formatDay(entry.achievedOn)}</span>
                        <span className="tnum">{formatRecordValue(entry)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground border-t px-4 py-3 text-sm">
                    Ainda sem histórico: esta é a primeira marca.
                  </p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}

      {groups.length > 0 ? (
        <RecordBadge className="self-start">
          {groups.length} {groups.length === 1 ? 'recorde' : 'recordes'}
        </RecordBadge>
      ) : null}
    </div>
  );
}
