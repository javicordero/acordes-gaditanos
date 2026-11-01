// Vuelta de GitHub: cambia el código por un token, comprueba que eres tú y deja
// la sesión en una cookie cifrada.
import {
  SITE, OWNER, COOKIE_ESTADO, cifrar, cookies, cookieSesion, gh,
} from './_lib.mjs';

const error = (mensaje, detalle = '') => new Response(
  `<!doctype html><meta charset="utf-8"><title>No se pudo entrar</title>
   <body style="font:16px/1.5 system-ui;padding:40px;max-width:640px;margin:auto">
   <h1 style="font-size:20px">No se pudo entrar</h1>
   <p>${mensaje}</p>${detalle ? `<pre style="white-space:pre-wrap;color:#8a8175">${detalle}</pre>` : ''}
   <p><a href="/estudio">Volver</a></p></body>`,
  { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

export default async (req) => {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('code');
  const estado = url.searchParams.get('state');
  const cookieEstado = cookies(req)[COOKIE_ESTADO];

  if (!codigo) return error('GitHub no ha devuelto el código de autorización.');
  if (!estado || !cookieEstado || estado !== cookieEstado) {
    return error('La comprobación de seguridad no cuadra. Vuelve a intentarlo desde /estudio.');
  }

  let token;
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: codigo,
        redirect_uri: `${SITE}/estudio/api/auth-callback`,
      }),
    });
    const d = await r.json();
    if (!d.access_token) return error('GitHub no ha dado un token.', d.error_description || '');
    token = d.access_token;
  } catch (e) {
    return error('No he podido hablar con GitHub.', String(e.message || e));
  }

  let login;
  try {
    const u = await gh('/user', { token });
    login = u.login;
  } catch (e) {
    return error('No he podido leer tu usuario de GitHub.', String(e.message || e));
  }

  if (String(login).toLowerCase() !== OWNER) {
    return error(`La cuenta ${login} no es la propietaria de este panel.`);
  }

  // Dos cookies: la de sesión y la de estado (que se borra). Se añaden con
  // `append` porque un `Set-Cookie` con array se serializa mal y el navegador
  // se queda sin sesión.
  const cabeceras = new Headers();
  cabeceras.set('Location', `${SITE}/estudio/`);
  cabeceras.append('Set-Cookie', cookieSesion(cifrar({ login, token, exp: Date.now() + 12 * 60 * 60 * 1000 })));
  cabeceras.append('Set-Cookie', `${COOKIE_ESTADO}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  cabeceras.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers: cabeceras });
};
