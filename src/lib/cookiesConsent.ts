// src/utils/cookiesConsent.ts
export function loadAdsense() {
  if (typeof window === 'undefined') return;
  if (document.querySelector('script[src*="googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
    return; // ya cargado
  }

  // SCRIPT
  const script = document.createElement('script');
  script.async = true;
  script.src =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3280015847198273';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}