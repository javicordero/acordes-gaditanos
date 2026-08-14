# Contratos de Redirección y DNS

## Redirección Netlify (`_redirects`)

Formato: `<ruta_origen>  <url_destino>  <código>`

| Regla | Origen | Destino | Código |
|-------|--------|---------|--------|
| ads.txt | `/ads.txt` | `https://srv.adstxtmanager.com/19390/acordesgaditanos.com` | 301 |

## Registros DNS

Antes del cambio (registrador actual):
- Nameservers: los que tenga configurados el registrador

Después del cambio (Ezoic):
- Nameserver 1: `ns1.ezoic.com`
- Nameserver 2: `ns2.ezoic.com`

## Verificación

- `curl -I https://acordesgaditanos.com/ads.txt` → `HTTP/1.1 301 Moved Permanently`
- `nslookup acordesgaditanos.com` → debe mostrar los nameservers de Ezoic
- Panel Ezoic → dominio debe aparecer como verificado
