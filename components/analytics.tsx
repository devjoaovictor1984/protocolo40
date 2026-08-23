'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { caminhoSeguro, GA_ID, META_PIXEL_ID } from '@/lib/analytics/config';

/**
 * Google Analytics 4 e pixel da Meta.
 *
 * O app é uma SPA: depois da primeira carga, a navegação não recarrega a
 * página, e nenhuma das duas ferramentas percebe sozinha. Por isso o pageview
 * automático é desligado no GA e disparado à mão a cada troca de rota — o
 * mesmo para o `PageView` da Meta.
 *
 * O caminho enviado é sempre o higienizado: id de treino, nome de usuário e
 * datas não saem daqui.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

export function Analytics() {
  const pathname = usePathname();
  // a primeira visita já é contada pelo script de carga; contar de novo dobraria
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }

    const caminho = caminhoSeguro(pathname);

    window.gtag?.('event', 'page_view', { page_path: caminho, page_location: undefined });
    window.fbq?.('track', 'PageView');
  }, [pathname]);

  return (
    <>
      {GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                send_page_view: true,
                anonymize_ip: true,
                page_path: ${JSON.stringify(caminhoSeguro(pathname))}
              });
            `}
          </Script>
        </>
      ) : null}

      {META_PIXEL_ID ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element -- exigido pelo pixel sem JS */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
    </>
  );
}
