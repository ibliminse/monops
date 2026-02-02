'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const CONSENT_KEY = 'monops_analytics_consent';

export function GoogleAnalytics() {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      setHasConsent(localStorage.getItem(CONSENT_KEY) === 'accepted');
    };

    checkConsent();

    // Same-tab: consent banner dispatches this after user clicks Accept/Decline
    window.addEventListener('monops-consent-updated', checkConsent);
    // Cross-tab: fires when localStorage changes in another tab
    window.addEventListener('storage', checkConsent);

    return () => {
      window.removeEventListener('monops-consent-updated', checkConsent);
      window.removeEventListener('storage', checkConsent);
    };
  }, []);

  if (!GA_MEASUREMENT_ID || !hasConsent) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
