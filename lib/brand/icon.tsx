import { ImageResponse } from 'next/og';

/**
 * Marca do P20X em forma de ícone.
 *
 * Um anel de progresso incompleto sobre fundo escuro: a mesma figura que o
 * cronômetro desenha na tela do treino. Sem texto, para continuar legível a
 * 32px e dentro da área segura de um ícone maskable.
 */
export function renderIcon(size: number, maskable = false, badge = false) {
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
          // o badge da barra de status do Android é recortado como silhueta:
          // qualquer cor vira branco, e fundo escuro viraria um quadrado sólido
          background: badge ? 'transparent' : '#15171c',
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: '50%',
            border: `${stroke}px solid ${badge ? '#ffffff' : '#2a2e37'}`,
            borderTopColor: badge ? '#ffffff' : '#e2542a',
            borderRightColor: badge ? '#ffffff' : '#e2542a',
            borderBottomColor: badge ? '#ffffff' : '#e2542a',
            transform: 'rotate(45deg)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
