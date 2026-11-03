export const CONFIG = {
  site: 'https://acordesgaditanos.com',
  siteName: 'Acordes Gaditanos',
  siteDescription: 'La mayor colección de acordes de guitarra del Carnaval de Cádiz. Aprende a tocar con tu guitarra todas las presentaciones, pasodobles, tangos, cuplés y popurrís de tus comparsas, chirigotas, coros y cuartetos favoritos.',
  keywords: 'carnaval, carnaval de cadiz, COAC, guitarra, acordes de guitarra, comparsa, chirigota, coro, cuartetos, letras carnaval, acordes carnaval',
} as const;

export const ANALYTICS = {
  gtmId: 'GTM-MZG7K2Q4',
  gaId: 'G-CTX6DK49K4',
  cloudflareToken: '69575422c7ad4587aad9e1a1b02a5b43',
  statsWorkerUrl: 'https://stats-worker.javiercorderotoscano.workers.dev',
} as const;

// Avisos push de la PWA. La clave privada VAPID no está aquí: vive en .env y en
// los secretos de GitHub. La pública es la que usa el móvil para suscribirse.
export const AVISOS = {
  workerUrl: 'https://push-worker.javiercorderotoscano.workers.dev',
  vapidPublicKey: 'BOwt_TO_ZSNmimMsQ-s0v5eo6NWcN17NcPxpXwgyB_McqIgcBopZOHJ9iyky5QnJqD9JOf2TRquf9R2atw35CFI',
} as const;

export const SEO = {
  googleSearchConsole: 'rcKUCESBALVUqnlrzW0AnQh8FqUzluPR9L1zex9eMw0',
  adsenseAccount: 'ca-pub-3280015847198273',
  defaultOgImage: '/og-image.jpg',
} as const;

export const CONTENT = {
  defaultYear: '2026',
  recentLimit: 8,
} as const;