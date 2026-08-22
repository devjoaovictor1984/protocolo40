'use client';

/** Última barreira: erro no próprio layout raiz. Precisa trazer html e body. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100dvh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#15171c',
          color: '#eceef2',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>PROTOCOLO40 está fora do ar</h1>
        <p style={{ color: '#8e96a5', maxWidth: '24rem' }}>
          Recarregue a página. Se continuar assim, tente de novo em alguns minutos.
        </p>
        {error.digest ? (
          <p style={{ color: '#8e96a5', fontSize: '.75rem' }}>Código: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
