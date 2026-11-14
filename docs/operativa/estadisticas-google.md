# Estadísticas de Google (panel `/admin`)

Tres pestañas dentro de **Estadísticas**, con el mismo patrón visual (periodo,
tarjetas, gráfico y tablas). Cada una tiene su función de Netlify y comparten la
autenticación de `netlify/functions/_google.mjs`. El flujo general del panel está
en [`panel-admin.md`](panel-admin.md).

- **Search Console** (`gsc.mjs`): Search Analytics API. Clics, impresiones, CTR
  y posición por consulta, página, país y dispositivo. Google cierra los datos
  con 2-3 días de retraso, así que la ventana termina dos días antes de hoy.
  La tabla **Consultas** enseña las **20 primeras** (por clics) y un botón para
  desplegar el resto de las 200 que devuelve la API; con el buscador se ven
  todas las coincidencias.
  Lleva un bloque **Búsquedas por ruta**: buscador y chips (**Todo / Fichas /
  Autores / Carnaval / Glosario / Otros**) que piden a la API las **consultas**
  y las **páginas** que coinciden, con `dimensionFilterGroups` sobre `page`
  (`includingRegex` para el texto y el tipo, `excludingRegex` para `otros`).
  Solo devuelve las primeras 500 filas de cada consulta y Google anonimiza las
  búsquedas raras.
  Variables: `GSC_SITE_URL` (por ejemplo `sc-domain:acordesgaditanos.com` o
  `https://acordesgaditanos.com/`) y la autenticación de Google.
- **Analytics** (`ga4.mjs`): GA4 Data API. Tiene cuatro subpestañas:
  **Eventos** (la que abre por defecto), **Amazon**, **Búsquedas** y **Resumen**. Los periodos
  son **Ayer, 7, 30 y 90 días**. Eventos muestra el nombre claro de cada evento,
  su nombre técnico debajo, eventos, usuarios, porcentaje y barra. El top 50
  excluye los eventos de Amazon antes de aplicar el límite, pero las tarjetas y
  el denominador del porcentaje siguen incluyendo todos los eventos. **Amazon**
  consulta los eventos de clic y visualización por separado del top general:
  muestra CTR (clics / visualizaciones), emplazamientos, productos, productos
  en listas separadas por emplazamiento y evolución diaria. Sin visualizaciones el CTR es
  «—» y varios clics pueden llevarlo por encima del 100 %. Los productos que
  ya no están en el catálogo se identifican por su ID; eventos con formato
  desconocido se muestran aparte. Los informes se paginan hasta 100 000 filas
  y avisan si quedan incompletos. Un fallo de Amazon no afecta al resto de GA4.
  No son ventas ni comisiones y solo incluyen la analítica consentida.
  **Búsquedas**
  lista lo que se busca y no encuentra nada: pide la dimensión personalizada
  `customEvent:consulta` filtrando el evento `buscar_sin_resultados`, con
  consulta, búsquedas, usuarios, porcentaje y barra. Esa dimensión **hay que
  crearla en GA4** (Administrar → Definiciones personalizadas → ámbito **Evento**,
  nombre visible `consulta`, parámetro `consulta`); la Data API solo expone los
  parámetros registrados y **no rellena el histórico**. Si aún no existe, la
  subpestaña lo explica y el resto de Analytics sigue funcionando
  (`busquedasError`). Recuerda que el evento sale con cada búsqueda a cero, también
  a medio escribir, y solo de quien acepta las cookies; el texto va recortado a
  40 caracteres. Para crear la dimensión desde aquí, `npm run ga4:dimension`
  (`scripts/crear-dimension-consulta.mjs`) pide un consentimiento OAuth de un solo
  uso con `analytics.edit`; no guarda ningún token y necesita el redirect
  `http://127.0.0.1:4325/oauth2callback` dado de alta en el cliente OAuth.
  Resumen mantiene sesiones, usuarios, páginas vistas, engagement,
  sesiones por día, páginas, canales, países y dispositivos. Variable:
  `GA4_PROPERTY_ID` (el ID numérico de la propiedad, no el `G-...`).
- **AdSense** (`ads.mjs`): AdSense Management API v2. Periodos **Hoy, Ayer, 7,
  30 y 90 días**. Informes por **método de emplazamiento**, **unidades de
  anuncio**, **top páginas** y **países**, con las columnas **Impresiones**,
  **Ingresos**, **RPM impr.**, **Active View**, **Clics** y **Page RPM**.
  Page RPM es la métrica principal de las tarjetas. En **método de
  emplazamiento** y **unidades de anuncio** no se muestra Page RPM; en **top
  páginas** y **países** no se muestra Active View, porque no aportan en esos
  desgloses. Variables:
  `ADSENSE_ACCOUNT_ID` (`pub-...`, sin `ca-`) y `ADSENSE_CURRENCY` (por defecto
  `EUR`). AdSense suele necesitar OAuth de usuario; la cuenta de servicio no
  siempre vale.
- **Autenticación**: `_google.mjs` admite cuenta de servicio
  (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`) o OAuth
  (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN`). El
  token se pide y se guarda solo en el servidor, nunca llega al navegador.
- **Sin configurar**: si faltan variables, la pestaña muestra qué falta y los
  pasos, sin errores. La respuesta se cachea 15 minutos cuando hay datos.
- **No comparable**: Search Console, GA4, AdSense, Cloudflare y D1 miden cosas
  distintas (consentimiento, bots, muestreo, canales, ingresos). No se suman.
- **AdSense**: la API solo cubre los últimos 3 años y los ingresos son
  estimados. La cuenta debe tener la API habilitada y el refresh token debe
  incluir `https://www.googleapis.com/auth/adsense.readonly`.
- **GA4**: el Data API necesita el ID numérico de la propiedad y que la cuenta
  de servicio sea lectora. El consentimiento y los bloqueadores hacen que no
  cuadre con D1 ni con Cloudflare.
- **Search Console**: la cuenta de servicio debe ser usuario de la propiedad.
  Las consultas con muy poco volumen pueden venir muestreadas o sin datos.
