import type { Metadata } from 'next';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Seus dados',
  robots: { index: false, follow: false },
};

/**
 * Baixar os próprios dados.
 *
 * Não é tela de "exportar relatório": é a resposta a uma pergunta legítima —
 * "o que vocês têm sobre mim, e como eu levo isso embora". Por isso o pacote
 * completo vem primeiro e não pede nenhuma escolha, e por isso a página diz em
 * português o que cada arquivo contém.
 */

const PLANILHAS = [
  {
    tipo: 'treinos',
    titulo: 'Treinos',
    descricao:
      'Uma linha por exercício, com data, duração, esforço, séries, repetições e carga. É o formato que abre em tabela dinâmica.',
  },
  {
    tipo: 'medidas',
    titulo: 'Peso e medidas',
    descricao: 'Peso, cintura, peito, braço, quadril, coxa e percentual de gordura, por data.',
  },
  {
    tipo: 'recordes',
    titulo: 'Recordes',
    descricao: 'Cada marca pessoal, com o exercício, o valor e o dia em que aconteceu.',
  },
  {
    tipo: 'agua',
    titulo: 'Água',
    descricao: 'Mililitros registrados por dia.',
  },
] as const;

export default async function DadosPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader
        titulo="Seus dados"
        descricao="Tudo o que você registrou aqui é seu, e sai daqui quando você quiser."
        trilha={[{ href: '/configuracoes', label: 'Configurações' }]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Tudo de uma vez
        </h2>

        <a
          href="/api/exportar?tipo=tudo&formato=json"
          className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex items-center gap-4 rounded-xl border p-4 transition-colors"
        >
          <FileJson aria-hidden className="text-primary size-5 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">Pacote completo (JSON)</span>
            <span className="text-muted-foreground text-sm">
              Perfil, treinos, medidas, água, recordes, descansos e metas num arquivo só. É o
              formato para levar seus dados a outro sistema.
            </span>
          </span>
          <Download aria-hidden className="text-muted-foreground size-4 shrink-0" />
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Para abrir numa planilha
        </h2>

        <ul className="flex flex-col gap-2">
          {PLANILHAS.map((item) => (
            <li key={item.tipo}>
              <a
                href={`/api/exportar?tipo=${item.tipo}&formato=csv`}
                className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
              >
                <FileSpreadsheet aria-hidden className="text-muted-foreground size-5 shrink-0" />
                <span className="flex-1">
                  <span className="block font-medium">{item.titulo}</span>
                  <span className="text-muted-foreground text-sm">{item.descricao}</span>
                </span>
                <Download aria-hidden className="text-muted-foreground size-4 shrink-0" />
              </a>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-sm">
          Os arquivos usam ponto e vírgula como separador e vírgula no decimal — é o que faz o
          Excel em português abrir as colunas separadas. Fotos de evolução não entram aqui: elas
          ficam no seu aparelho e na galeria do app.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Sobre esses arquivos
        </h2>
        <p className="text-muted-foreground text-sm">
          O download sai direto do seu aparelho para o arquivo, sem passar por e-mail e sem link
          temporário. Depois de salvo, quem cuida dele é você: um CSV de medidas aberto no
          computador de trabalho fica visível para quem sentar ali.
        </p>
      </section>
    </div>
  );
}
