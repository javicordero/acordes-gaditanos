// src/utils/cookiesConsent.ts
export const CONSENT_KEY = 'ag_cookie_consent';

export function hasAcceptedCookies() {
  if (typeof document === 'undefined') return false;

  // Primero miramos cookie
  const cookieMatch = document.cookie.split('; ').find((row) => row.startsWith(`${CONSENT_KEY}=`));

  const cookieValue = cookieMatch?.split('=')[1];

  const localValue = typeof localStorage !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null;

  return cookieValue === 'accepted' || localValue === 'accepted';
}

export function loadAdsense() {
  if (typeof window === 'undefined') return;
  if (document.querySelector('script[src*="googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
    return; // ya cargado
  }

  // META
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'google-adsense-account');
  meta.setAttribute('content', 'ca-pub-3280015847198273');
  document.head.appendChild(meta);

  // SCRIPT
  const script = document.createElement('script');
  script.async = true;
  script.src =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3280015847198273';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}
