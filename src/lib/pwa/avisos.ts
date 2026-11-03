// src/lib/pwa/avisos.ts
//
// Avisos push de la PWA. Solo tienen sentido dentro de la app instalada en el
// móvil (en iOS, además, hace falta iOS 16.4+ y la app en la pantalla de inicio).
//
// El permiso del sistema se pide SIEMPRE detrás de un clic: si se pide solo al
// cargar, Chrome lo bloquea y no vuelve a preguntar.
//
// La suscripción se guarda en el worker `push-worker` (solo endpoint y claves) y
// se da de baja desde el mismo interruptor o desde los ajustes del móvil. Cuando
// el móvil rechaza un push (404/410) el script de envío la borra del worker.

import { AVISOS } from '../constants';
import { esStandalone, eventoPwa } from './analytics';

export type EstadoAvisos =
  | 'no-soportado'
  | 'solo-app'
  | 'sin-decidir'
  | 'activado'
  | 'denegado'
  | 'error';

const CLAVE_ACTIVO = 'ag_avisos_activo';
const CLAVE_DESCARTE = 'ag_avisos_descartado';
// Si el usuario dice «Ahora no», la barra vuelve a salir pasados estos días.
const DIAS_RECORDATORIO = 30;
// `serviceWorker.ready` no resuelve nunca si no hay SW (astro dev): no colgarse.
const ESPERA_SW = 8000;

export function soportePush(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Solo en la app instalada: el permiso no se ofrece desde el navegador. */
export function esAppInstalada(): boolean {
  return esStandalone();
}

export function avisosDisponibles(): boolean {
  return soportePush() && esAppInstalada();
}

function base64urlABytes(clave: string): Uint8Array {
  const relleno = '='.repeat((4 - (clave.length % 4)) % 4);
  const base64 = (clave + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((listo) => setTimeout(() => listo(null), ESPERA_SW)),
    ]);
  } catch {
    return null;
  }
}

function leerActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_ACTIVO) === '1';
  } catch {
    return false;
  }
}

function marcarActivo(activo: boolean) {
  try {
    if (activo) localStorage.setItem(CLAVE_ACTIVO, '1');
    else localStorage.removeItem(CLAVE_ACTIVO);
  } catch {
    /* sin localStorage la barra vuelve a salir: no es grave */
  }
}

export function avisosDescartados(): boolean {
  try {
    const valor = localStorage.getItem(CLAVE_DESCARTE);
    if (!valor) return false;
    const ts = Number(valor);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts < DIAS_RECORDATORIO * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function descartarAvisos() {
  try {
    localStorage.setItem(CLAVE_DESCARTE, String(Date.now()));
  } catch {
    /* sin localStorage vuelve a salir en la próxima visita */
  }
}

/** Al activarlos, el descarte anterior deja de contar. */
export function olvidarDescarte() {
  try {
    localStorage.removeItem(CLAVE_DESCARTE);
  } catch {
    /* nada que limpiar */
  }
}

async function enviarSuscripcion(suscripcion: PushSubscription): Promise<boolean> {
  try {
    const datos = suscripcion.toJSON();
    const res = await fetch(`${AVISOS.workerUrl}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: datos.endpoint, keys: datos.keys }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function estaActivado(): Promise<boolean> {
  if (!soportePush()) return false;
  const reg = await registro();
  if (!reg) return false;
  try {
    return Boolean(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!soportePush()) return 'no-soportado';
  if (!esAppInstalada()) return 'solo-app';
  if (Notification.permission === 'denied') return 'denegado';
  if (Notification.permission === 'granted' && (await estaActivado())) return 'activado';
  return 'sin-decidir';
}

/**
 * Pide permiso (detrás de un clic), suscribe el móvil y apunta la suscripción en
 * el worker. Devuelve el estado en el que se queda la cosa.
 */
export async function activarAvisos(): Promise<EstadoAvisos> {
  if (!soportePush()) return 'no-soportado';
  if (!esAppInstalada()) return 'solo-app';

  if (!AVISOS.vapidPublicKey) {
    console.warn('Falta AVISOS.vapidPublicKey: ejecuta `npm run push -- --generar-claves`.');
    return 'error';
  }

  let permiso = Notification.permission;
  if (permiso !== 'granted') {
    try {
      permiso = await Notification.requestPermission();
    } catch {
      permiso = 'default';
    }
  }

  if (permiso !== 'granted') {
    eventoPwa('pwa_push_denegado');
    return permiso === 'denied' ? 'denegado' : 'sin-decidir';
  }

  const reg = await registro();
  if (!reg) return 'error';

  try {
    let suscripcion = await reg.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlABytes(AVISOS.vapidPublicKey) as BufferSource,
      });
    }

    if (!(await enviarSuscripcion(suscripcion))) return 'error';

    marcarActivo(true);
    olvidarDescarte();
    eventoPwa('pwa_push_activado');
    return 'activado';
  } catch (error) {
    console.warn('No se pudo activar el push', error);
    eventoPwa('pwa_push_error');
    return 'error';
  }
}

/** Baja en el móvil y en el worker. */
export async function desactivarAvisos(): Promise<void> {
  const reg = await registro();
  if (reg) {
    try {
      const suscripcion = await reg.pushManager.getSubscription();
      if (suscripcion) {
        await fetch(`${AVISOS.workerUrl}/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        }).catch(() => undefined);
        await suscripcion.unsubscribe().catch(() => undefined);
      }
    } catch {
      /* si algo falla, al menos se limpia el estado local */
    }
  }

  marcarActivo(false);
  eventoPwa('pwa_push_desactivado');
}

/**
 * Al cargar la app: si el permiso se ha concedido fuera (o se revocó en los
 * ajustes del móvil), el worker y el móvil tienen que quedar de acuerdo.
 */
export async function sincronizarAvisos(): Promise<void> {
  if (!soportePush()) return;

  try {
    // Bloqueado desde los ajustes del móvil: se borra la suscripción.
    if (Notification.permission === 'denied') {
      if (leerActivo()) await desactivarAvisos();
      return;
    }

    // Sin permiso o sin haberlo activado nunca: no se toca nada.
    if (Notification.permission !== 'granted' || !leerActivo()) return;
    if (!AVISOS.vapidPublicKey) return;

    const reg = await registro();
    if (!reg) return;

    let suscripcion = await reg.pushManager.getSubscription();
    if (!suscripcion) {
      // Permiso concedido pero sin suscripción (datos borrados, SW renovado…).
      suscripcion = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlABytes(AVISOS.vapidPublicKey) as BufferSource,
      });
    }
    await enviarSuscripcion(suscripcion);
  } catch {
    /* sin conexión o sin soporte: se reintenta en la próxima apertura */
  }
}
