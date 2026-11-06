// src/lib/pwa/instalacion.ts
//
// Lógica de instalación de la PWA: disparo del prompt nativo en Android y panel
// de instrucciones en iOS/otros navegadores.
// El evento beforeinstallprompt lo captura un script inline del <head> y lo deja
// en window.__agPwa.

import {
  detectarOs,
  esStandalone,
  eventoPwa,
  iniciarAnaliticaPwa,
} from './analytics';
import { unaVezPorSesion } from './sesion';

interface AgPwa {
  prompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null;
  installed: boolean;
}

function esMovil(): boolean {
  const o = detectarOs();
  return o === 'android' || o === 'ios';
}

function agPwa(): AgPwa | undefined {
  return (window as unknown as { __agPwa?: AgPwa }).__agPwa;
}

// ¿Mostramos la invitación a instalar? Siempre en móvil, salvo que el usuario ya
// esté dentro de la app (display-mode standalone). El aviso flotante se puede
// descartar (vuelve pasados unos días); la tarjeta y el banner no.
export function puedeInstalar(): boolean {
  return esMovil() && !esStandalone();
}

// pwa_installed se emite una sola vez por sesión de página.
let instaladoReportado = false;
function reportarInstalado() {
  if (instaladoReportado) return;
  instaladoReportado = true;
  eventoPwa('pwa_installed');
}

function ubicacionActual(): string {
  const path = typeof location === 'undefined' ? '' : location.pathname;
  if (path === '/' || path === '/index.html') return 'portada';
  if (path.startsWith('/acordes/')) return 'ficha';
  return 'otra';
}

// El navegador ofrece instalar la app (beforeinstallprompt). Se mide una sola vez
// por carga.
let promptNativoReportado = false;
function reportarPromptNativo() {
  if (promptNativoReportado) return;
  const ctx = agPwa();
  if (!ctx || !ctx.prompt) return;
  promptNativoReportado = true;
  eventoPwa('pwa_native_prompt_available', { ubicacion: ubicacionActual() });
}

// Apertura de la app instalada: una vez por sesión. Es la única forma de contar
// las instalaciones que no dejan rastro (en iOS no existe `appinstalled`) y de
// saber cuánta gente usa la app de verdad, no cuánta pulsó «instalar».
function reportarAppAbierta() {
  if (!esStandalone()) return;
  if (!unaVezPorSesion('ag_app_abierta')) return;
  eventoPwa('pwa_app_open', { ubicacion: ubicacionActual() });
}

function abrirPanel() {
  const panel = document.getElementById('ag-instalar-panel');
  if (!panel) return;
  const esIos = detectarOs() === 'ios';
  panel.querySelector('[data-ag-ios]')?.classList.toggle('ag-activo', esIos);
  panel.querySelector('[data-ag-otro]')?.classList.toggle('ag-activo', !esIos);
  panel.hidden = false;
}

function cerrarPanel() {
  const panel = document.getElementById('ag-instalar-panel');
  if (panel) panel.hidden = true;
}

// Nombre del evento por acción y botón: `pwa_install_<accion>_<sufijo>`, para
// poder abrir el embudo de cada botón sin depender de dimensiones de GA4.
const SUFIJO: Record<string, string> = {
  cabecera: 'cabecera',
  banner_novedad: 'banner',
  tarjeta_ficha: 'tarjeta',
  aviso: 'aviso',
};

export function eventoInstalar(
  accion: 'click' | 'ios' | 'accepted' | 'dismissed',
  componente: string,
) {
  const sufijo = SUFIJO[componente] ?? 'otro';
  eventoPwa(`pwa_install_${accion}_${sufijo}`, { componente });
}

// `componente` identifica el botón que lanzó la instalación (`cabecera`,
// `banner_novedad`, `tarjeta_ficha`), para poder abrir el embudo por superficie.
export function instalar(componente = 'desconocido') {
  if (detectarOs() === 'ios') {
    eventoInstalar('ios', componente);
    abrirPanel();
    return;
  }

  const prompt = agPwa()?.prompt;
  if (prompt) {
    prompt.prompt();
    prompt.userChoice
      .then((choice: { outcome: string }) => {
        eventoInstalar(choice.outcome === 'accepted' ? 'accepted' : 'dismissed', componente);
        const ctx = agPwa();
        if (ctx) ctx.prompt = null;
        if (choice.outcome === 'accepted') reportarInstalado();
      })
      .catch(() => {
        /* el usuario cerró el prompt sin elegir */
      });
    return;
  }

  // Sin prompt disponible: instrucciones genéricas en el panel.
  abrirPanel();
}

export function initPwa() {
  iniciarAnaliticaPwa();
  reportarAppAbierta();

  // `appinstalled` lo captura el script inline y llega como evento propio.
  window.addEventListener('ag:appinstalled', () => {
    reportarInstalado();
  });

  // El prompt nativo del navegador: se mide cuándo está disponible. También se
  // comprueba al arrancar por si llegó antes que este módulo.
  window.addEventListener('ag:beforeinstallprompt', reportarPromptNativo);
  reportarPromptNativo();

  // Cerrar el panel al pulsar la X o el fondo. El aviso NO se oculta: solo se
  // cierra el panel.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-ag-cerrar]')) cerrarPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarPanel();
  });
}
