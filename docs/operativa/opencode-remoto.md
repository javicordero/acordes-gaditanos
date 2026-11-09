# OpenCode remoto: servidor en el PC y acceso desde el móvil

Cómo está montado el servidor de OpenCode que se usa desde fuera de casa, por qué
está configurado así y qué hacer cuando algo falla. **No hay nada de esto dentro del
repositorio**: el sitio es 100 % estático y no depende de este montaje, que vive entero
en el PC del propietario.

## Arquitectura

```text
Móvil (app oficial de Android)  ──►  OpenTunnel (HTTPS público)  ──►  servicio compartido
                                                                       127.0.0.1:4096
```

- **App oficial**: *OpenCode* para Android (`ai.opencode.mobilecode`, Anomaly
  Innovations). Es un mando remoto: las sesiones y el trabajo siguen en el PC.
- **OpenTunnel**: túnel que OpenCode levanta con `opencode pair --remote`. Da una URL
  HTTPS pública sin abrir puertos en el router. El tráfico va cifrado de extremo a
  extremo y el acceso sigue pidiendo la contraseña del servidor.
- **Servicio compartido**: `opencode service` es el servidor de verdad. Guarda las
  sesiones, habla con los modelos y ejecuta las herramientas. Escucha **solo** en
  `127.0.0.1:4096`.
- **Tailscale** (solo para desarrollo): sigue instalado y conectado, pero ya no publica
  nada con `serve`. Se usa únicamente para abrir `http://100.108.147.80:4321` desde el
  móvil fuera de casa.

## Por qué el servidor escucha en `127.0.0.1`

No hace falta exponerlo en la red local: el móvil entra por el túnel y el escritorio
por loopback. Así el puerto 4096 no está abierto ni en la red local ni en internet.
El emparejamiento (`pair`) **exige el servicio compartido**; un `opencode serve`
suelto no sirve para el QR.

## Lo que vive fuera del repositorio

| Qué | Dónde |
| --- | --- |
| Script que arranca el servicio | `C:\Users\Usuario\.opencode\iniciar-servidor.ps1` |
| Contraseña del servidor | `C:\Users\Usuario\.opencode\servidor-password.txt` (ACL solo para el usuario) |
| Arranque automático | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenCode Server.vbs` |
| Registro del servicio | `%TEMP%\opencode-serve.log` |
| Script de reinicio + QR | `C:\Users\Usuario\.opencode\reiniciar-y-emparejar.ps1` |
| Log del reinicio | `%TEMP%\opencode-reinicio.log` |
| Binario | `C:\Users\Usuario\AppData\Local\opencode\bin\opencode.exe` (copia vieja: `opencode-2.0.22.exe`) |

**La contraseña no se escribe aquí ni en ningún archivo versionado.** El script la lee
del `.txt` y la aplica con `opencode service set password`. El usuario de Basic auth es
**siempre `opencode`**.

## Arranque automático

- El `.vbs` de la carpeta Inicio lanza `iniciar-servidor.ps1` **al iniciar sesión**
  (oculto, sin ventana, sin UAC). El script reaplica hostname, puerto y contraseña y
  ejecuta `opencode service start`.
- **Suspensión**: desactivada con el PC enchufado (`powercfg /change standby-timeout-ac 0`);
  con batería sigue a los 10 minutos.

Consecuencia: si el PC se reinicia y nadie inicia sesión, el servidor **no** está
corriendo. Para que arrancase antes del login habría que pasar el `.vbs` al Programador
de tareas con permisos de administrador.

## Comprobar que está todo vivo

```powershell
opencode service status                                # debe dar http://127.0.0.1:4096
opencode service get                                   # hostname, port, remote
Get-NetTCPConnection -State Listen -LocalPort 4096     # debe escuchar en 127.0.0.1
```

## Cómo se usa

- **Móvil**: app oficial. Se conecta escaneando el QR de `opencode pair --remote`.
  La sesión dura 30 días; cambiar la contraseña echa a todos los dispositivos.
- **Escritorio**: abrir `http://127.0.0.1:4096` en el navegador, o usar *OpenCode
  Desktop* → *Settings → Servers* con esa URL y la contraseña.
- **PWA**: se puede instalar desde la URL del túnel, pero al ser una URL larga es más
  cómodo usar la app.

## Emparejar

```powershell
opencode pair --remote          # en una terminal interactiva
opencode pair --remote --yes    # sin preguntar (scripts)
```

Imprime un enlace de un solo uso y un QR que **caducan a los 5 minutos**. Para
desactivar el acceso remoto: `opencode service set remote false`.

## Seguridad

El túnel deja el servidor accesible desde internet: **la contraseña es la única
barrera**. Tratarlo como una terminal abierta en el PC. Cambiar la contraseña:

```powershell
opencode service set password '<nueva>'
opencode service restart
```

Y actualizar `servidor-password.txt` para que el arranque automático no la pise.

## Tailscale: solo para el servidor de desarrollo

El acceso de OpenCode ya no pasa por aquí (va por OpenTunnel), pero Tailscale se queda
para una cosa: abrir el servidor de desarrollo del sitio desde el móvil fuera de casa.

- `tailscale serve` está **vacío** (se borró): no se publica ni el 4096 ni el 4321.
- El acceso es directo a la IP de la tailnet: `http://100.108.147.80:4321`, con
  `npm run dev` en marcha (Astro escucha en todas las interfaces).
- En casa y en la misma Wi-Fi no hace falta: `http://192.168.0.165:4321`.
- Si algún día se quiere la vía antigua para el 4096:
  `tailscale serve --bg http://127.0.0.1:4096`.

Los lanzadores `Desactivar Tailscale.cmd` y `Desinstalar Tailscale.cmd` de
`C:\Users\Usuario\.opencode\` siguen ahí por si se decide retirarlo, pero **no hay que
ejecutarlos** mientras se use el 4321 desde fuera.

## Problemas conocidos

- **El QR no aparece**: el servidor está parado o escuchando fuera de loopback. Comprobar
  `opencode service status` y reiniciar.
- **401 / connection failed**: falta la contraseña o no coincide. Cambiarla y reiniciar
  el servicio.
- **El túnel deja de funcionar**: acceso remoto apagado
  (`opencode service set remote false`). Volver a emparejar.
- **El QR caduca**: dura 5 minutos y sirve una sola vez; generar otro.
- **Sesión móvil caducada**: dura 30 días. Volver a emparejar.
- **Tras actualizar OpenCode**: reiniciar el servicio para que use el binario nuevo
  (`opencode service restart` o el `.vbs`).
- **El 4321 no responde fuera de casa**: Tailscale caído en el PC (`tailscale up`) o en
  el móvil, o clave del equipo caducada. Desactivar la caducidad en
  <https://login.tailscale.com/admin/machines> → `...` → *Disable key expiry*.

> El acceso remoto equivale a una terminal en el PC: quien entre puede ejecutar
> comandos y editar archivos. Tratarlo como tal.
