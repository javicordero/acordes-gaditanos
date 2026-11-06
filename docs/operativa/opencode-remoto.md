# OpenCode remoto: servidor en el PC y acceso desde el móvil

Cómo está montado el servidor de OpenCode que se usa desde fuera de casa, por qué
está configurado así y qué hacer cuando algo falla. **No hay nada de esto dentro del
repositorio**: el sitio es 100 % estático y no depende de este montaje, que vive entero
en el PC del propietario.

## Arquitectura

```text
Móvil (PWA en el navegador)  ─┐
                              ├─► Tailscale (red privada, WireGuard)
Móvil (app OpenCode Mobile)  ─┘        │
                                       ▼
                        tailscaled (serve, HTTPS con certificado)
                                       │
                                       ▼
                        opencode serve en 127.0.0.1:4096
                                     (solo loopback)
```

- **Tailscale** crea la red privada. No hay puertos abiertos en el router ni nada
  expuesto a internet: se llega solo desde equipos de la misma tailnet.
- **`tailscale serve`** publica `https://desktop-tra3lr8.tail21060a.ts.net/` dentro de
  la tailnet y hace de proxy al servidor local. Pone el certificado válido, así que el
  navegador lo trata como **origen seguro** (PWA instalable, portapapeles, cámara y QR).
- **`opencode serve`** es el servidor de verdad: guarda las sesiones, habla con los
  modelos y ejecuta las herramientas. Es el que hay que tener corriendo.

## Por qué el servidor escucha en `127.0.0.1` y no en la IP de Tailscale

Primero se probó con `--hostname 100.108.147.80` (solo la IP de la tailnet). Funciona
para conectar directo, pero **`tailscale serve` no puede hacer de proxy a la IP de
Tailscale del propio equipo**: el tráfico se muerde la cola y devuelve **502**.

Se comprobó con dos servidores de prueba: contra `100.108.147.80` daba timeout, contra
`127.0.0.1` respondía al instante. Por eso el backend es loopback y **Tailscale es la
única puerta**. Efecto secundario bueno: el puerto 4096 ya no está abierto ni en la red
local.

## Lo que vive fuera del repositorio

| Qué | Dónde |
| --- | --- |
| Script que arranca el servidor | `C:\Users\Usuario\.opencode\iniciar-servidor.ps1` |
| Contraseña del servidor | `C:\Users\Usuario\.opencode\servidor-password.txt` (ACL solo para el usuario) |
| Arranque automático | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenCode Server.vbs` |
| Registro del servidor | `%TEMP%\opencode-serve.log` |
| Tailscale | Servicio de Windows `Tailscale` (Automático) |

**La contraseña no se escribe aquí ni en ningún archivo versionado.** El script la lee
del `.txt` y la pasa por la variable `OPENCODE_PASSWORD` (en V2 ese es el nombre; el
`OPENCODE_SERVER_PASSWORD` de V1 también vale). El usuario de Basic auth es **siempre
`opencode`**; solo se puede cambiar la contraseña.

## Arranque automático

- **Tailscale**: servicio de Windows en `Automatic`. Arranca con el sistema.
- **Servidor de OpenCode**: el `.vbs` de la carpeta Inicio lanza
  `iniciar-servidor.ps1` **al iniciar sesión** (oculto, sin ventana, sin UAC). Si ya hay
  algo escuchando en el puerto 4096, no arranca un segundo.
- **`serve`**: la configuración de `tailscale serve --bg` la guarda Tailscale y se
  reaplica al arrancar el servicio.
- **Suspensión**: desactivada con el PC enchufado (`powercfg /change standby-timeout-ac 0`);
  con batería sigue a los 10 minutos.

Consecuencia: si el PC se reinicia y nadie inicia sesión, el servidor **no** está
corriendo. Para que arrancase antes del login habría que pasar el `.vbs` al Programador
de tareas con permisos de administrador.

## Comprobar que está todo vivo

```powershell
Get-Service Tailscale                                  # debe estar Running
Get-NetTCPConnection -State Listen -LocalPort 4096     # debe escuchar en 127.0.0.1
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

Y la prueba real, desde cualquier equipo de la tailnet:

```powershell
curl -s -o NUL -w "%{http_code}`n" https://desktop-tra3lr8.tail21060a.ts.net/api/info
```

- **401** → el servidor responde y exige contraseña (correcto).
- **200** → has mandado la contraseña.
- **502** → `serve` no llega al backend: mira que el servidor escuche en `127.0.0.1:4096`.

## Cómo se usa

- **PWA (recomendado)**: abrir `https://desktop-tra3lr8.tail21060a.ts.net/` en el
  navegador del móvil, meter dirección y contraseña y usar **Instalar aplicación**.
  La sesión del navegador dura 30 días.
- **App OpenCode Mobile** (`cc.agentlabs.opencode`, no oficial): crear la conexión de
  tipo **Tunnel** con esa misma URL https. La conexión por IP (`http://100.x.x.x:4096`)
  ya no vale, porque el servidor es loopback.
- **OpenCode Desktop**: *Settings → Servers → Add server* con la misma URL y contraseña.
- **Emparejamiento sin teclear la contraseña**: `opencode pair --url https://...` genera
  un enlace de un solo uso (5 min) y un QR. Hace falta `OPENCODE_PASSWORD` en el entorno.

## Notificaciones en la PWA

La interfaz tiene **Ajustes → pestaña «Notificaciones»**, pero conviene saber qué hace
por dentro: usa la API local (`new Notification(...)`) y solo dispara cuando
`document.visibilityState !== "visible"` o la página no tiene el foco. En los 51
archivos JS del servidor **no hay `pushManager` ni `showNotification()`**, así que:

- **No hay Web Push**: con la PWA cerrada no llega nada.
- **En Android probablemente no salta ninguna**, porque Chrome para Android no permite
  `new Notification()`; en móvil solo funciona `showNotification()` desde un service
  worker, que aquí no se usa. En el navegador de escritorio sí funciona.
- Mientras no se implemente Web Push, la vía fiable es abrir la PWA: la lista marca las
  sesiones con cambios sin ver (`unseenCount`).

## Problemas conocidos

- **La app móvil da errores raros**: es un cliente de la **API V1**. OpenCode V2 cambió
  el contrato del servidor, así que algunas rutas devuelven 404 (se vio con
  `GET /api/fs/list → 404`). Si falla, usar la PWA del navegador, que es la interfaz
  oficial de V2.
- **401**: falta la contraseña o es incorrecta. La app y la PWA muestran 401 como
  «connection failed».
- **502 en HTTPS**: el backend no está escuchando en `127.0.0.1:4096`.
- **No conecta fuera de casa**: Tailscale apagado en el móvil, o clave del PC caducada.
  Desactivar la caducidad en <https://login.tailscale.com/admin/machines> → `...` →
  *Disable key expiry*.
- **`tailscale serve` da «Serve is not enabled on your tailnet»**: hay que habilitarlo
  una vez en `https://login.tailscale.com/f/serve`. El HTTPS del dominio `.ts.net` se
  activa en el panel → **DNS** → *HTTPS Certificates*.

## Si cambia el nombre o la IP

El nombre `desktop-tra3lr8.tail21060a.ts.net` es el del equipo en Tailscale. Si se
renombra la máquina o se reinstala Tailscale, cambia: hay que repetir
`tailscale serve --bg http://127.0.0.1:4096` y actualizar la URL en la PWA, la app y
Desktop. La contraseña no cambia.

> El acceso remoto equivale a una terminal en el PC: quien entre puede ejecutar
> comandos y editar archivos. Tratarlo como tal.
