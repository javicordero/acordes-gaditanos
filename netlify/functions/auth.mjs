// Entra con GitHub: manda al usuario a la pantalla de autorización.
import { randomBytes } from 'node:crypto';
import { urlAutorizacion, COOKIE_ESTADO } from './_lib.mjs';

export default async () => {
  const estado = randomBytes(16).toString('base64url');
  const cookie = `${COOKIE_ESTADO}=${estado}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: urlAutorizacion(estado),
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store',
    },
  });
};
