# Quickstart: Integración Ezoic

## Fase 1 — Verificar ads.txt (P1)

```powershell
curl -I https://acordesgaditanos.com/ads.txt
# Esperado: HTTP 301 → srv.adstxtmanager.com/19390/...
```

Si no redirige, verificar que `public/_redirects` contiene:
```
/ads.txt  https://srv.adstxtmanager.com/19390/acordesgaditanos.com  301
```
Hacer deploy en Netlify y reverificar.

## Fase 2 — Integración DNS (P2)

1. Acceder al panel del registrador de dominio
2. Cambiar nameservers a:
   - `ns1.ezoic.com`
   - `ns2.ezoic.com`
3. Esperar propagación (24-72h)
4. Verificar con `nslookup acordesgaditanos.com`
5. En panel Ezoic: verificar que el dominio aparece como "Active"

## Fase 3 — Verificar anuncios (P3)

1. Navegar por el sitio y confirmar que los anuncios se renderizan
2. Ejecutar Lighthouse Performance y verificar score ≥ 85
3. Comprobar que autoscroll y búsqueda siguen funcionando

## Rollback

Si algo falla: cambiar nameservers a los originales del registrador. El sitio vuelve a la normalidad tras propagación DNS.
