'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Mostrar uma lista em lotes.
 *
 * Listas que crescem para sempre — medidas, fotos, recordes — acabam
 * renderizando centenas de nós no celular de quem mais usa o app. Quem tem
 * dois anos de registro é justamente quem não pode ter a tela travando.
 *
 * O padrão aqui é o mesmo do histórico: um lote, um botão, e o número do que
 * ainda falta. Nada de rolagem infinita, que tira da pessoa a noção de onde
 * está e impede chegar ao rodapé.
 */
export function useVerMais<T>(itens: T[], porLote: number) {
  const [visiveis, setVisiveis] = useState(porLote);

  return {
    mostrados: itens.slice(0, visiveis),
    restantes: Math.max(0, itens.length - visiveis),
    mostrarMais: () => setVisiveis((atual) => atual + porLote),
    porLote,
  };
}

export function VerMais({
  restantes,
  porLote,
  onMostrar,
  substantivo,
}: {
  restantes: number;
  porLote: number;
  onMostrar: () => void;
  /** o que está sendo listado, no plural: "registros", "fotos" */
  substantivo: string;
}) {
  if (restantes === 0) return null;

  return (
    <Button variant="outline" className="h-12" onClick={onMostrar}>
      <ChevronDown aria-hidden className="size-4" />
      Ver mais {Math.min(restantes, porLote)} {substantivo}
      <span className="text-muted-foreground tnum ml-1 text-xs">de {restantes}</span>
    </Button>
  );
}
