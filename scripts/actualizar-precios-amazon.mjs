/**
 * Actualiza los precios de Amazon para el experimento A/B.
 *
 * Uso local:
 *   npm run precios:amazon
 *   npm run precios:amazon -- --dry-run
 *
 * En CI se ejecuta con las variables de entorno del repositorio. No imprime
 * credenciales y no escribe nada si la API rechaza la petición.
 *
 * Requisitos que hoy NO se cumplen y por eso el script no puede completar:
 *   - La cuenta debe ser elegible para Creators API (`AssociateNotEligible`).
 *   - Amazon debe autorizar por escrito el uso en el sitio responsive/móvil.
 *   - OffersV2 no devuelve gastos de envío; hace falta una solución conforme.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SALIDA = path.join(RAIZ, 'src/data/precios-amazon.json');
const DRY_RUN = process.argv.includes('--dry-run');

const ENDPOINTS_TOKEN = {
  '3.1': 'https://api.amazon.com/auth/o2/token',
  '3.2': 'https://api.amazon.co.uk/auth/o2/token',
  '3.3': 'https://api.amazon.co.jp/auth/o2/token',
};

const MERCADO = 'www.amazon.es';
const MONEDA = 'EUR';
const MAX_ASIN_POR_PETICION = 10;

function leerEnvLocal() {
  const ruta = path.join(RAIZ, '.env');
  if (!existsSync(ruta)) return {};
  const env = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...leerEnvLocal(), ...process.env };
const clienteId = env.AMAZON_CREATORS_CLIENT_ID;
const clienteSecreto = env.AMAZON_CREATORS_CLIENT_SECRET;
const version = env.AMAZON_CREATORS_VERSION || '3.2';
const partnerTag = env.AMAZON_PARTNER_TAG || 'acordesgadi02-21';

if (!clienteId || !clienteSecreto) {
  console.error('Faltan AMAZON_CREATORS_CLIENT_ID y AMAZON_CREATORS_CLIENT_SECRET.');
  process.exit(1);
}

const endpointToken = ENDPOINTS_TOKEN[version];
if (!endpointToken) {
  console.error(`Versión de credencial no soportada: ${version}`);
  process.exit(1);
}

const { CATALOGO_AMAZON } = await import('../src/data/afiliados-amazon.ts');
const activos = CATALOGO_AMAZON.filter((p) => p.activo !== false);

if (activos.some((p) => !p.asin)) {
  console.error('Hay productos activos sin ASIN. Complétalos antes de actualizar.');
  process.exit(1);
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pedirToken() {
  const res = await fetch(endpointToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clienteId,
      client_secret: clienteSecreto,
      scope: 'creatorsapi::default',
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error(
      `No se pudo obtener el token (${res.status}):`,
      json.error_description || json.error || 'sin detalle',
    );
    process.exit(1);
  }
  return json.access_token;
}

async function getItems(token, asins, intento = 0) {
  const res = await fetch('https://creatorsapi.amazon/catalog/v1/getItems', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-marketplace': MERCADO,
    },
    body: JSON.stringify({
      itemIds: asins,
      itemIdType: 'ASIN',
      marketplace: MERCADO,
      partnerTag,
      currencyOfPreference: MONEDA,
      languagesOfPreference: ['es_ES'],
      resources: [
        'itemInfo.title',
        'offersV2.listings.price',
        'offersV2.listings.availability',
        'offersV2.listings.condition',
        'offersV2.listings.isBuyBoxWinner',
        'offersV2.listings.merchantInfo',
      ],
    }),
  });

  const texto = await res.text();
  let json = {};
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    json = { raw: texto };
  }

  if (res.status === 429 || res.status >= 500) {
    if (intento < 2) {
      const espera = 1000 * 2 ** intento;
      console.warn(`Respuesta ${res.status}; reintento en ${espera} ms…`);
      await esperar(espera);
      return getItems(token, asins, intento + 1);
    }
  }

  return { res, json };
}

function precioDe(item) {
  const listings = (item.offersV2 && item.offersV2.listings) || [];
  const listing =
    listings.find((l) => l.isBuyBoxWinner) || listings[0] || null;
  if (!listing) return { error: 'sin oferta destacada' };

  if (listing.violatesMAP === true) {
    return { error: 'precio con restricción MAP' };
  }

  const disponibilidad = listing.availability && listing.availability.type;
  if (!['IN_STOCK', 'IN_STOCK_SCARCE'].includes(disponibilidad)) {
    return { error: `disponibilidad ${disponibilidad || 'desconocida'}` };
  }

  const condicion = listing.condition && listing.condition.value;
  if (condicion !== 'New') {
    return { error: `condición ${condicion || 'desconocida'}` };
  }

  const dinero = listing.price && listing.price.money;
  if (!dinero || !(dinero.amount > 0) || dinero.currency !== MONEDA) {
    return { error: 'precio o moneda no válidos' };
  }

  const precioTexto =
    typeof dinero.displayAmount === 'string' && dinero.displayAmount.includes('€')
      ? dinero.displayAmount
      : new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: MONEDA,
        }).format(dinero.amount);

  return {
    asin: item.asin,
    precio: dinero.amount,
    moneda: dinero.currency,
    precioTexto,
    disponibilidad,
    actualizado: new Date().toISOString(),
  };
}

const token = await pedirToken();
const productos = {};
const sinPrecio = {};

for (let i = 0; i < activos.length; i += MAX_ASIN_POR_PETICION) {
  const lote = activos.slice(i, i + MAX_ASIN_POR_PETICION);
  const { res, json } = await getItems(
    token,
    lote.map((p) => p.asin),
  );

  if (res.status === 403 && json.reason === 'AssociateNotEligible') {
    console.warn(
      'AVISO: la cuenta no es elegible para Creators API (' +
        (json.message || 'AssociateNotEligible') +
        '). No se escriben precios.',
    );
    process.exit(0);
  }

  if (!res.ok) {
    console.error(
      `Error de Creators API (${res.status}):`,
      json.reason || json.message || JSON.stringify(json).slice(0, 300),
    );
    process.exit(1);
  }

  const items = (json.itemsResult && json.itemsResult.items) || [];
  const porAsin = new Map(items.map((item) => [item.asin, item]));

  for (const producto of lote) {
    const item = porAsin.get(producto.asin);
    if (!item) {
      sinPrecio[producto.id] = 'sin respuesta de la API';
      continue;
    }
    const precio = precioDe(item);
    if (precio.error) {
      sinPrecio[producto.id] = precio.error;
      continue;
    }
    productos[producto.id] = precio;
  }

  if (i + MAX_ASIN_POR_PETICION < activos.length) await esperar(1000);
}

const completo =
  Object.keys(productos).length === activos.length &&
  Object.keys(sinPrecio).length === 0;

const datos = {
  actualizado: new Date().toISOString(),
  moneda: MONEDA,
  productos,
  completo,
  sinPrecio,
};

console.log(
  `Precios obtenidos: ${Object.keys(productos).length}/${activos.length} | completo: ${completo}`,
);
if (Object.keys(sinPrecio).length > 0) {
  console.warn('Sin precio:', sinPrecio);
}

if (Object.keys(productos).length === 0) {
  console.error('No hay ningún precio válido; no se sobrescribe el JSON.');
  process.exit(1);
}

if (DRY_RUN) {
  console.log('Dry run: no se escribe el JSON.');
  process.exit(0);
}

const temporal = `${SALIDA}.tmp`;
writeFileSync(temporal, JSON.stringify(datos, null, 2) + '\n');
renameSync(temporal, SALIDA);
console.log('Escrito:', path.relative(RAIZ, SALIDA));
