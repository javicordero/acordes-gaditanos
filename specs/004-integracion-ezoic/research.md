# Research: Integración Ezoic en acordesgaditanos.com

## 1. Redirección ads.txt a Ezoic Ads.txt Manager

**Estado**: ✅ YA IMPLEMENTADO en `public/_redirects`
```
/ads.txt  https://srv.adstxtmanager.com/19390/acordesgaditanos.com  301
```

**Decisión**: Mantener la regla actual. Verificar con `curl -I https://acordesgaditanos.com/ads.txt` que devuelve 301.
**Alternativas consideradas**: Archivo `ads.txt` estático en `public/` — descartado porque Ezoic necesita gestionarlo dinámicamente.
**Riesgo**: Si la URL de Ezoic cambia, hay que actualizar `_redirects` y redeploy.

## 2. Integración DNS con Ezoic

Ezoic requiere apuntar los nameservers del dominio a sus servidores:
- `ns1.ezoic.com`
- `ns2.ezoic.com`

Esto permite a Ezoic actuar como proxy CDN y gestionar el tráfico.

**Decisión**: Cambiar nameservers en el registrador de dominio actual.
**Consideraciones**:
- Propagación DNS: 24-72 horas. El sitio no se cae durante este período.
- Durante propagación, algunos visitantes ven el sitio con anuncios y otros sin ellos.
- Ezoic proporciona un "placeholder" SSL mientras se activa el certificado real.
- Riesgo: si se quiere deshacer, hay que cambiar nameservers de vuelta y esperar propagación.

## 3. Ezoic + SSG (Astro)

Ezoic funciona como proxy inverso/CDN. No requiere cambios en el código de Astro.

**Decisión**: Integración DNS directa. No usar Ezoic Leap (speed optimization) inicialmente.
**Alternativas**: Integración vía Ezoic Script (inyección JS) — más limitada, requiere modificar el layout de Astro. DNS es más completo.

## 4. Rendimiento esperado

- Ezoic añade ~200-800ms de latencia por el proxy DNS (depende de ubicación geográfica).
- Los anuncios se renderizan asíncronamente, no bloquean el contenido principal.
- Para mantener Lighthouse ≥ 85: configurar Ezoic para cargar anuncios con lazy loading y priorizar contenido above the fold.

## 5. Verificación y monitoreo

- Panel Ezoic muestra métricas de tráfico, ingresos, velocidad.
- Verificar con `curl -I` y `nslookup` post-cambio DNS.
- Navegación manual en varias páginas para confirmar layout intacto.
