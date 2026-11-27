// Renueva el GOOGLE_REFRESH_TOKEN que usan las pestañas de Google del panel.
//
//   npm run google:refresh-token
//
// Abre el navegador con un consentimiento OAuth de los TRES scopes que usa el
// panel (AdSense, Analytics y Search Console) e imprime el refresh token nuevo,
// listo para pegar en Netlify. Se piden todos a la vez porque las tres pestañas
// comparten la misma variable: renovar solo AdSense dejaría las otras sin token
// si no hay cuenta de servicio configurada.
//
// El redirect http://127.0.0.1:4325/oauth2callback tiene que estar autorizado
// en el cliente OAuth de Google Cloud (es el mismo que usa ga4:dimension).
//
// Ojo: si la pantalla de consentimiento está en modo «Testing», el token vuelve
// a caducar a los 7 días. Publícala («In production») o añade la cuenta como
// usuaria de prueba antes de renovar.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';

const SIN_NAVEGADOR = process.argv.includes('--sin-navegador');

const env = {};
for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

// .env manda, pero si está vacío se pueden pasar por entorno al llamar al script.
const CLIENT_ID = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env');
  process.exit(1);
}

const PUERTO = 4325;
const REDIRECT = `http://127.0.0.1:${PUERTO}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/adsense.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const autorizacion = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
});

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }

  const fallo = url.searchParams.get('error');
  const code = url.searchParams.get('code');

  if (fallo) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h2>Google devolvió un error</h2><pre>' + (fallo + ' ' + (url.searchParams.get('error_description') || '')) + '</pre>');
    console.error('Error de Google:', fallo, url.searchParams.get('error_description') || '');
    servidor.close();
    process.exit(1);
  }

  if (!code) { res.writeHead(400).end('Falta el código'); return; }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    .end('<h2>Autorizado. Ya puedes cerrar esta pestaña y mirar la consola.</h2>');

  const tokenR = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
    }),
  });
  const tokenDatos = await tokenR.json();

  if (!tokenDatos.refresh_token) {
    console.error('Google no devolvió refresh_token:', tokenDatos.error_description || tokenDatos.error || JSON.stringify(tokenDatos));
    console.error('Asegúrate de autorizar con access_type=offline y prompt=consent.');
    servidor.close();
    process.exit(1);
  }

  // Comprobamos que el token nuevo sirve y vemos qué scopes concedió Google.
  const prueba = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokenDatos.refresh_token,
    }),
  });
  const datosPrueba = await prueba.json();
  const concedidos = String(datosPrueba.scope || tokenDatos.scope || '')
    .replace(/https:\/\/www.googleapis.com\/auth\//g, '');

  servidor.close();

  if (!prueba.ok || !datosPrueba.access_token) {
    console.error('El refresh_token nuevo no funciona:', datosPrueba.error_description || datosPrueba.error);
    process.exit(1);
  }

  console.log('\nRefresh token nuevo (cópialo entero):');
  console.log('--- INICIO ---');
  console.log(tokenDatos.refresh_token);
  console.log('--- FIN ---\n');
  console.log('Scopes concedidos:', concedidos || '(Google no los detalló)');
  for (const scope of SCOPES) {
    const corto = scope.replace('https://www.googleapis.com/auth/', '');
    if (concedidos && !concedidos.includes(corto)) {
      console.warn('  Falta el scope', corto, '→ revisa los permisos concedidos.');
    }
  }
  console.log('\nPégalo en Netlify → Site configuration → Environment variables →');
  console.log('GOOGLE_REFRESH_TOKEN (secret) y haz un deploy. No lo comitees en .env.\n');
  process.exit(0);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Abre esta URL y autoriza con la cuenta que tiene acceso a AdSense:\n\n' + autorizacion + '\n');
  console.log('Si sale «redirect_uri_mismatch», añade este redirect al cliente OAuth: ' + REDIRECT + '\n');
  if (!SIN_NAVEGADOR) exec(`start "" "${autorizacion}"`);
});
