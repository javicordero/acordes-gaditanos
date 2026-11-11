// Crea la dimensión personalizada `consulta` en GA4 con un consentimiento OAuth
// de un solo uso. No guarda ningún token: usa el access_token y lo descarta.
//
//   node scripts/crear-dimension-consulta.mjs [--comprobar]
//
// Abre el navegador en localhost:4325; el redirect tiene que estar autorizado en
// el cliente OAuth de Google Cloud (http://127.0.0.1:4325/oauth2callback).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';

const COMPROBAR = process.argv.includes('--comprobar');
const SIN_NAVEGADOR = process.argv.includes('--sin-navegador');

const env = {};
for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const PROPERTY = String(env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim();
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

if (!PROPERTY || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GA4_PROPERTY_ID, GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env');
  process.exit(1);
}

const PUERTO = 4325;
const REDIRECT = `http://127.0.0.1:${PUERTO}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics.readonly',
];

const ADMIN = `https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY}`;
const DATA = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`;

const pedir = async (url, token, opciones = {}) => {
  const r = await fetch(url, {
    method: opciones.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { raw: texto.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, datos };
};

const error = (d) => (d && d.error && (d.error.message || d.error.status)) || JSON.stringify(d).slice(0, 300);

async function crearDimension(token) {
  const existentes = await pedir(ADMIN + '/customDimensions', token);
  if (!existentes.ok) {
    console.error('No puedo leer las dimensiones:', existentes.status, error(existentes.datos));
    return false;
  }

  const lista = existentes.datos.customDimensions || [];
  const yaEsta = lista.find((d) => d.parameterName === 'consulta');
  if (yaEsta) {
    console.log('Ya existe:', yaEsta.name, '· nombre visible:', (yaEsta.displayName || '').trim());
    return true;
  }

  console.log('Creando la dimensión «consulta»…');
  const alta = await pedir(ADMIN + '/customDimensions', token, {
    method: 'POST',
    body: {
      parameterName: 'consulta',
      displayName: 'consulta',
      scope: 'EVENT',
      description: 'Texto buscado en el buscador del sitio (40 caracteres máximo).',
    },
  });

  if (!alta.ok) {
    console.error('No se pudo crear:', alta.status, error(alta.datos));
    return false;
  }

  console.log('Creada:', alta.datos.name, '· nombre visible:', alta.datos.displayName);

  // La Admin API tarda unos minutos en propagar la dimensión a la Data API.
  console.log('\nProbando si la Data API la reconoce ya como customEvent:consulta…');
  const prueba = await pedir(DATA, token, {
    method: 'POST',
    body: {
      dateRanges: [{ startDate: '2026-01-01', endDate: 'yesterday' }],
      dimensions: [{ name: 'customEvent:consulta' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'buscar_sin_resultados' } },
      },
      limit: 5,
    },
  });

  if (prueba.ok) {
    const filas = prueba.datos.rows || [];
    console.log('La Data API ya la acepta. Filas con datos:', filas.length);
    filas.forEach((f) => console.log('  ·', f.dimensionValues[0].value, '→', f.metricValues[0].value));
  } else {
    console.log('Todavía no (normal):', prueba.status, error(prueba.datos));
    console.log('Vuelve a probar en unos minutos con: node scripts/crear-dimension-consulta.mjs --comprobar');
  }
  return true;
}

async function soloComprobar(token) {
  const r = await pedir(ADMIN + '/customDimensions', token);
  if (!r.ok) return console.error('Error leyendo dimensiones:', r.status, error(r.datos));
  let existe = false;
  for (const d of r.datos.customDimensions || []) {
    console.log('·', d.parameterName, '→', (d.displayName || '').trim(), '(', d.scope, ')');
    if (d.parameterName === 'consulta') existe = true;
  }
  if (!existe) {
    console.log('\nLa dimensión «consulta» no existe todavía.');
    return;
  }

  const prueba = await pedir(DATA, token, {
    method: 'POST',
    body: {
      dateRanges: [{ startDate: '2026-01-01', endDate: 'yesterday' }],
      dimensions: [{ name: 'customEvent:consulta' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'buscar_sin_resultados' } },
      },
      limit: 20,
    },
  });

  if (!prueba.ok) {
    console.log('\nLa Data API aún no la reconoce:', prueba.status, error(prueba.datos));
    return;
  }
  const filas = prueba.datos.rows || [];
  console.log('\nLa Data API ya la reconoce. Filas con datos:', filas.length);
  filas.forEach((f) => console.log('  ·', JSON.stringify(f.dimensionValues[0].value), '→', f.metricValues[0].value));
}

if (COMPROBAR) {
  // Sin consentimiento nuevo: basta el scope de lectura que ya tiene el .env.
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
    }),
  });
  const { access_token: token } = await r.json();
  await soloComprobar(token);
  process.exit(0);
}

const autorizacion = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
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
    .end('<h2>Autorizado. Ya puedes cerrar esta pestaña.</h2><p>Mira la consola.</p>');

  const tokenR = await fetch('https://oauth2.googleapis.com/token', {
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

  if (!tokenDatos.access_token) {
    console.error('No pude canjear el código:', tokenDatos.error_description || tokenDatos.error);
    servidor.close();
    process.exit(1);
  }

  console.log('Autorizado con:', String(tokenDatos.scope || '').replace(/https:\/\/www.googleapis.com\/auth\//g, ''), '\n');
  const ok = await crearDimension(tokenDatos.access_token);
  servidor.close();
  process.exit(ok ? 0 : 1);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Abre esta URL y autoriza (la abro yo también):\n\n' + autorizacion + '\n');
  console.log('Si sale «redirect_uri_mismatch», añade este redirect al cliente OAuth: ' + REDIRECT + '\n');
  if (!SIN_NAVEGADOR) exec(`start "" "${autorizacion}"`);
});
