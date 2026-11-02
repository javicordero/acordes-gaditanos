// Entra con GitHub: manda al usuario a la pantalla de autorización.
//
// El `state` va firmado (nonce.firma) en la propia URL, sin cookie: así la
// comprobación anti-CSRF del callback no depende de que el navegador conserve
// la cookie en el salto por GitHub (Safari/WebView en móvil la descartaban).
import { urlAutorizacion, estadoNuevo } from './_lib.mjs';

export default async () => new Response(null, {
  status: 302,
  headers: {
    Location: urlAutorizacion(estadoNuevo()),
    'Cache-Control': 'no-store',
  },
});
