import { ImageResponse } from 'next/og';

/**
 * Marca do P20X em forma de ícone.
 *
 * Um anel de progresso incompleto sobre fundo escuro: a mesma figura que o
 * cronômetro desenha na tela do treino. Sem texto, para continuar legível a
 * 32px e dentro da área segura de um ícone maskable.
 */
export function renderIcon(size: number, maskable = false) {
  // ícone maskable precisa de 20% de margem para o recorte do sistema
  const inset = maskable ? size * 0.2 : size * 0.08;
  const ring = size - inset * 2;
  const stroke = Math.max(2, ring * 0.14);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#15171c',
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: '50%',
            border: `${stroke}px solid #2a2e37`,
            borderTopColor: '#e2542a',
            borderRightColor: '#e2542a',
            borderBottomColor: '#e2542a',
            transform: 'rotate(45deg)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
