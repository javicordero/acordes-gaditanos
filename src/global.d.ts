/// <reference types="vite-plugin-pwa/client" />

interface Window {
  adsbygoogle: unknown[];
  gtag?: (...args: unknown[]) => void;
  googlefc?: unknown;
  __agPwa?: {
    prompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null;
    installed: boolean;
  };
}
