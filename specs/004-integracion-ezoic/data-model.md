# Data Model: Integración Ezoic

## Entidades de Configuración

### Redirección ads.txt
| Campo | Valor | Descripción |
|-------|-------|-------------|
| Ruta origen | `/ads.txt` | Ruta solicitada |
| Destino | `https://srv.adstxtmanager.com/19390/acordesgaditanos.com` | URL de Ezoic Ads.txt Manager |
| Código | 301 | Redirect permanente |
| Archivo | `public/_redirects` | Declaración Netlify |

### Nameservers Ezoic
| Nameserver | Propósito |
|------------|-----------|
| `ns1.ezoic.com` | DNS primario |
| `ns2.ezoic.com` | DNS secundario |

### Estado de Integración
| Estado | Descripción |
|--------|-------------|
| `ads_txt_ok` | Redirect 301 verificado |
| `dns_pending` | Nameservers pendientes de cambio |
| `dns_propagating` | Propagación DNS en curso (24-72h) |
| `dns_active` | Nameservers Ezoic propagados |
| `ezoic_verified` | Ezoic confirma verificación del dominio |
| `ads_live` | Anuncios visibles en el sitio |
