# Precios de Amazon: experimento A/B y auditoría

> **Estado: NO ACTIVO.** Las fichas siguen mostrando la variante A (sin precio)
> a todo el mundo. No se asigna ningún bucket y no se muestra ningún precio de
> Amazon. El código está preparado, pero bloqueado por tres requisitos
> externos que se detallan abajo.

## 1. Qué se quería probar

Comparar dos variantes en las dos posiciones de afiliación de las fichas:

- **A (50 %)**: tarjetas actuales, sin precio.
- **B (50 %)**: las mismas tarjetas, con el precio actual de Amazon.

El objetivo no es conseguir más clics, sino saber si el precio genera **más
ingresos netos por visualización** sin perjudicar AdSense ni la experiencia.

## 2. Auditoría previa (13 nov 2026)

### 2.1. ASIN de los 21 productos

Los 21 productos tienen ASIN identificado a partir de su enlace `amzn.to`:

| Producto | ASIN |
|---|---|
| `libro_pasodoble` | `8494588567` |
| `libro_aragon` | `8417950893` |
| `libro_historias` | `8419188565` |
| `libro_educacion` | `8410286300` |
| `libro_patrimonio` | `8410525984` |
| `libro_historia` | `8412297334` |
| `libro_republica` | `8498286719` |
| `libro_subiela` | `8494802879` |
| `libro_ares` | `B0G2QVRWP8` |
| `libro_veneno` | `B0CNH6GFY3` |
| `guitarra_cejilla` | `B00TDMA1LE` |
| `guitarra_afinador` | `B073ZPTM1F` |
| `cejilla_madera` | `B0BC1RMMXP` |
| `guitarra_cuerdas` | `B000EEL6J6` |
| `guitarra_funda` | `B07BMQMF9N` |
| `guitarra_estuche` | `B08ZN6YBTD` |
| `guitarra_puas` | `B09F6QQW2P` |
| `guitarra_soporte` | `B0932MSRV2` |
| `taza_buenos_dias` | `B07XXD5HF5` |
| `taza_aragon` | `B0847SV4BW` |
| `juego_mesa` | `B0DK94BXFQ` |

**Aviso:** el ASIN de `taza_aragon` es una taza de «Capitán Veneno», no una
taza genérica de Juan Carlos Aragón. El nombre comercial actual es una
etiqueta nuestra; antes de publicar precios conviene usar el título que
devuelve la API o corregir el nombre.

### 2.2. Creators API

Credenciales probadas con la versión **3.2** (endpoint EU):

- **Token OAuth: 200 OK.** Las credenciales son válidas.
- **GetItems en `www.amazon.es`: 403 `AssociateNotEligible`.**
  Mensaje: «Your account does not currently meet the eligibility requirements.»
- GetItems en `www.amazon.co.uk`: mismo 403.
- GetItems en `www.amazon.com`: 400 `InvalidAssociate` (el `partnerTag` es de
  España, como corresponde).

**Conclusión:** la cuenta **no tiene acceso a Creators API**. No es un problema
de las credenciales ni del código: falta la elegibilidad de la cuenta. Según la
documentación, Creators API solo se abre a asociados con ventas cualificadas y
aceptación final en el programa. Hay que solicitarlo desde Associates Central
(Contact Us) y esperar aprobación.

**No se implementa scraping ni precios de ejemplo.** Sin API, no hay precio.

### 2.3. Autorización para el sitio móvil

La licencia europea (IP License, punto 2.d) dice, en resumen:

> No se puede usar Product Advertising Content en un sitio o aplicación
> diseñados o pensados para móvil sin autorización previa y expresa de Amazon.
> La excepción es un sitio no optimizado para móvil al que se accede desde un
> tablet, o una Approved Mobile Application.

Acordes Gaditanos es un sitio **responsive**, con layout específico de móvil y
la mayoría del tráfico en móvil. Por tanto, **no se puede dar por exenta**. Se
necesita autorización escrita de Amazon antes de mostrar precios de la API,
aunque sea solo en escritorio: la restricción alcanza al sitio en conjunto.

**Conclusión:** bloqueado hasta tener aprobación por escrito. No se debe
activar la variante B mientras tanto.

### 2.4. Gastos de envío

La política de Amazon exige mostrar claramente los gastos de envío cuando se
muestra el precio. La documentación de OffersV2 indica que
`DeliveryInfo.ShippingCharges` ya **no está disponible** en OffersV2 (la tabla
de equivalencias de OffersV1 a OffersV2 lo marca como «Not Available»).

**Conclusión:** con OffersV2 no tenemos el dato de envío. Antes de activar
precios hay que resolver este requisito (consultar a Amazon o usar una fuente
oficial que lo incluya). No se inventa ni se pone «envío gratis» por defecto.

## 3. Arquitectura elegida

### 3.1. Opción implementada: JSON estático + build

```
GitHub Actions (cada hora) → scripts/actualizar-precios-amazon.mjs
    → Creators API (GetItems + OffersV2)
    → src/data/precios-amazon.json
    → commit si cambia
    → Netlify reconstruye Astro
    → el cliente pinta los precios de la variante B
```

- Mantiene Astro SSG y no introduce un backend permanente.
- El JSON se versiona y se puede auditar.
- La licencia permite cachear contenido que no sea imagen hasta 24 h. Con una
  ejecución horaria y la comprobación de frescura en el cliente, se cumple.
- **No se cachean ni descargan imágenes de la API.** Las tarjetas siguen usando
  las imágenes actuales del catálogo, no las de OffersV2.
- El workflow está en `.github/workflows/precios-amazon.yml`. Ahora solo tiene
  `workflow_dispatch`; el `schedule` horario está comentado hasta que se
  resuelvan los bloqueos.

**Coste:** un commit por hora cuando cambie el JSON (el timestamp cambia en
cada actualización). Si molesta el ruido de commits, la alternativa es la
opción 3.2.

### 3.2. Alternativa: Netlify Blobs + build hook

Una Netlify Scheduled Function actualiza un Blob cada hora y dispara un build
hook; el build lee el Blob y genera el JSON. Evita commits horarios, pero añade
una función programada, un almacén y un token de build. Es más infraestructura
para el mismo resultado. Se puede adoptar más adelante si el commit horario
resulta incómodo.

### 3.3. Credenciales

Nunca en el navegador ni en Git. Localmente viven en `.env` (ignorado). En
producción:

- GitHub Actions: secretos `AMAZON_CREATORS_CLIENT_ID`,
  `AMAZON_CREATORS_CLIENT_SECRET`, `AMAZON_CREATORS_VERSION` (3.2) y
  `AMAZON_PARTNER_TAG`.
- Netlify: solo si se usa la alternativa de Blobs/función.

### 3.4. Formato del JSON

`src/data/precios-amazon.json`:

```json
{
  "actualizado": "2026-11-13T01:00:00.000Z",
  "moneda": "EUR",
  "productos": {
    "libro_pasodoble": {
      "asin": "8494588567",
      "precio": 18.95,
      "moneda": "EUR",
      "precioTexto": "18,95 €",
      "disponibilidad": "IN_STOCK",
      "actualizado": "2026-11-13T01:00:00.000Z"
    }
  },
  "completo": true,
  "sinPrecio": {}
}
```

- `completo` solo es `true` si **todos** los productos activos tienen precio
  válido. Si falta uno, la variante B no se activa (no se mezclan tarjetas con
  y sin precio).
- `sinPrecio` guarda el motivo de los que fallan, para revisarlo.
- El JSON actual está vacío y con fecha de 1970: la web se sirve en A.

### 3.5. Cómo se actualiza y cómo falla

`npm run precios:amazon` (o `-- --dry-run`):

1. Pide token OAuth al endpoint EU 3.2.
2. Consulta los ASIN en lotes de 10 (21 productos → 3 peticiones).
3. Pide `offersV2.listings.price`, `availability`, `condition`,
   `isBuyBoxWinner` y `merchantInfo`.
4. Acepta solo oferta BuyBox, condición `New`, disponibilidad `IN_STOCK` o
   `IN_STOCK_SCARCE`, moneda EUR y precio > 0. Si `violatesMAP` es true, no
   muestra precio.
5. Si la API devuelve 403 `AssociateNotEligible`, **no escribe** y sale con
   aviso. Si no hay ningún precio válido, no sobrescribe el JSON.
6. Reintenta 429 y 5xx con espera exponencial.
7. Escribe el JSON de forma atómica.

Si el JSON tiene más de 24 h, el cliente deja de mostrar precios aunque el HTML
siga cacheado. Es la red de seguridad de la licencia.

## 4. Experimento A/B

### 4.1. Asignación

- 50 % A / 50 % B, con `crypto.getRandomValues`.
- Se guarda en `localStorage` con la clave `ag_amazon_precio_v1`.
- No se usa cookie: no viaja al servidor y no necesita backend.
- Solo se asigna si el CMP de Google ha dado consentimiento de analítica.
  Si no hay consentimiento, el visitante se queda en A y no se guarda nada.
- Una vez asignada, la variante se mantiene al navegar entre fichas.
- No se crean sub-tags de Amazon ni se cambia el tracking ID actual.
- No se modifica el catálogo, la rotación, los enlaces, las posiciones ni
  AdSense.

### 4.2. Presentación del precio

- El HTML inicial es la variante A actual: no hay precio visible.
- Para B, el cliente lee el JSON y rellena los huecos `[data-amazon-precio]`
  que ya existen en las tarjetas (bloque y franja).
- Si falta un solo precio en la página, no se activa B: se queda A. No se
  mezclan tarjetas con y sin precio.
- El aviso de precio incluye la fecha/hora de actualización, la advertencia de
  que el precio puede cambiar y la declaración de Amazon. Se muestra solo en B.
- **Pendiente de compliance:** los gastos de envío y la proximidad del aviso a
  la franja inline. No se activa hasta resolverlo.

### 4.3. Analítica

Los eventos actuales no cambian de nombre:

- `click_amazon_<producto>_bloque` / `click_amazon_<producto>_inline`
- `view_amazon_<producto>_bloque` / `view_amazon_<producto>_inline`

Cuando el experimento está activo, se añade el parámetro `variante` (`a` o
`b`) a los clics y a las visualizaciones. Sin dimensiones personalizadas: el
nombre del evento ya separa producto y posición; la ficha se ve con
`page_location`.

Medición:

- CTR por variante.
- CTR por producto y posición.
- Ingresos de Amazon por variante (cuando se separen las ventas).
- Ingresos por 1.000 visualizaciones de producto.
- AdSense y páginas por sesión.

La visualización se cuenta con `IntersectionObserver` al 50 % del producto,
no al cargar el HTML.

## 5. Qué está implementado y qué falta

### Implementado

- ASIN en el catálogo (`src/data/afiliados-amazon.ts`).
- Script de actualización (`scripts/actualizar-precios-amazon.mjs`).
- JSON de precios vacío y comprobación de frescura/completitud.
- Interruptores en `src/data/amazon-precios-config.ts`.
- A/B estable con consentimiento y `localStorage`.
- Huecos de precio en bloque y franja, ocultos por defecto.
- Aviso de precio y declaración de Amazon, ocultos por defecto.
- Workflow manual de GitHub Actions (sin schedule).
- Eventos con parámetro `variante` cuando el experimento está activo.

### Bloqueado

1. **Elegibilidad de Creators API**: 403 `AssociateNotEligible`.
2. **Autorización escrita de Amazon** para el sitio responsive/móvil.
3. **Gastos de envío**: OffersV2 no los devuelve y la política los exige.
4. **Aviso de precio en la franja inline**: falta un patrón de hipervínculo o
   pop-up que cumpla la licencia y no ensucie el diseño.

## 6. Checklist para activar (solo cuando 1-3 estén resueltos)

- [ ] Amazon confirma la elegibilidad de la cuenta para Creators API.
- [ ] Amazon autoriza por escrito el uso en el sitio responsive/móvil.
- [ ] Hay una fuente oficial y conforme de gastos de envío.
- [ ] El aviso de precio está resuelto también para la franja inline.
- [ ] `npm run precios:amazon` devuelve `completo: true` y un JSON fresco.
- [ ] `PRECIOS_AMAZON_ACTIVOS = true` y `LICENCIA_MOVIL_APROBADA = true` en
      `src/data/amazon-precios-config.ts`.
- [ ] Secretos de GitHub configurados.
- [ ] Descomentado el `schedule` horario del workflow.
- [ ] Probadas A y B en escritorio y móvil, con asignación estable.
- [ ] Comprobados clics y visualizaciones con `variante`.
- [ ] Documentada la fecha de revisión: **8 de enero de 2027**.

## 7. Revisión

Fecha objetivo: **8 de enero de 2027**. No se cambian productos, posiciones ni
diseños durante la prueba salvo problema técnico o de cumplimiento.
