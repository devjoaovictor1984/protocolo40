'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Instalar o app na tela de início.
 *
 * Cada plataforma resolve isto de um jeito, e uma delas não resolve:
 *
 * - **Android/Chrome** dispara `beforeinstallprompt`, que dá um botão de
 *   verdade. O evento chega uma vez só e precisa ser guardado: chamar
 *   `prompt()` fora do gesto do usuário não faz nada.
 * - **iOS** não tem API nenhuma. O único caminho é Compartilhar → Adicionar à
 *   Tela de Início, e o app precisa ensinar isso com o desenho do botão certo.
 * - **Desktop** tem o ícone na barra de endereço, e também dispara o evento.
 *
 * Tudo aqui é leitura de coisa que existe fora do React — o modo de exibição da
 * janela, o navegador, um evento que já passou. Por isso `useSyncExternalStore`
 * e não `useEffect` com `setState`: ele tem um retrato para o servidor, o que
 * evita a hidratação divergir, e não provoca uma segunda renderização em
 * cascata a cada montagem.
 */

export type Plataforma = 'android' | 'ios' | 'desktop';

export type EstadoDaInstalacao = {
  /** Já está rodando como app instalado. */
  instalado: boolean;
  plataforma: Plataforma;
  /** Existe prompt nativo para chamar. */
  podeInstalarDireto: boolean;
  /** Abre o prompt nativo. Devolve se a pessoa aceitou. */
  instalar: () => Promise<boolean>;
};

type PromptDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Detectar iPhone por user agent é frágil, e aqui é frágil o suficiente: o
 * custo de errar é mostrar a instrução errada, não quebrar nada. O iPad moderno
 * se anuncia como Mac, e o que o entrega é o toque.
 */
function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'desktop';

  const ua = navigator.userAgent;
  const toques = navigator.maxTouchPoints ?? 0;

  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';

  return 'desktop';
}

function lerInstalado(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // o Safari do iOS não implementa display-mode: standalone
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Assina o que pode mudar depois que a página abriu.
 *
 * Instalar pelo ícone da barra de endereço não dispara `appinstalled` em toda
 * versão; o modo de exibição é o sinal que sempre chega.
 */
function assinarInstalado(avisar: () => void): () => void {
  const modo = window.matchMedia('(display-mode: standalone)');

  modo.addEventListener('change', avisar);
  window.addEventListener('appinstalled', avisar);

  return () => {
    modo.removeEventListener('change', avisar);
    window.removeEventListener('appinstalled', avisar);
  };
}

/** No servidor não há janela: nada é instalado e a plataforma é a neutra. */
const naoInstaladoNoServidor = () => false;
const plataformaNoServidor = (): Plataforma => 'desktop';

export function useInstall(): EstadoDaInstalacao {
  const instalado = useSyncExternalStore(
    assinarInstalado,
    lerInstalado,
    naoInstaladoNoServidor,
  );

  // a plataforma não muda enquanto a página vive; assinar nada é correto
  const plataforma = useSyncExternalStore(
    useCallback(() => () => {}, []),
    detectarPlataforma,
    plataformaNoServidor,
  );

  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);

  useEffect(() => {
    const guardar = (evento: Event) => {
      // sem isto o Chrome mostra a própria barra, que compete com a nossa
      evento.preventDefault();
      setPrompt(evento as PromptDeInstalacao);
    };

    const limpar = () => setPrompt(null);

    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', limpar);

    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', limpar);
    };
  }, []);

  return {
    instalado,
    plataforma,
    podeInstalarDireto: prompt !== null,
    instalar: async () => {
      if (!prompt) return false;

      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      // o evento só serve uma vez; guardá-lo depois disso é enganar a tela
      setPrompt(null);
      return outcome === 'accepted';
    },
  };
}

/** Lembra a dispensa por 30 dias, para o convite não virar praga. */
const CHAVE = 'p20x_instalar_dispensado';
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

function lerDispensa(): boolean {
  try {
    const guardado = window.localStorage.getItem(CHAVE);
    return guardado !== null && Date.now() - Number(guardado) < TRINTA_DIAS;
  } catch {
    // navegador com armazenamento bloqueado: mostrar é melhor que sumir
    return false;
  }
}

/**
 * O servidor renderiza como dispensado, e o cliente decide depois.
 *
 * O caminho contrário faria o convite piscar na tela de quem já o dispensou —
 * pior do que aparecer um quadro depois para quem nunca viu.
 */
const dispensadoNoServidor = () => true;

/**
 * `localStorage` não avisa quando é escrito pela própria aba, então a dispensa
 * vira uma loja de verdade: quem dispensa notifica, e quem estiver montado relê.
 */
const ouvintes = new Set<() => void>();

function assinarDispensa(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

export function useDispensa(): [boolean, () => void] {
  const dispensado = useSyncExternalStore(assinarDispensa, lerDispensa, dispensadoNoServidor);

  const dispensar = useCallback(() => {
    try {
      window.localStorage.setItem(CHAVE, String(Date.now()));
    } catch {
      // sem armazenamento o convite volta na próxima visita, e tudo bem
    }
    for (const avisar of ouvintes) avisar();
  }, []);

  return [dispensado, dispensar];
}
