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

interface AgPwa {
  prompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null;
  installed: boolean;
  suprimido?: boolean;
}

function esMovil(): boolean {
  const o = detectarOs();
  return o === 'android' || o === 'ios';
}

function agPwa(): AgPwa | undefined {
  return (window as unknown as { __agPwa?: AgPwa }).__agPwa;
}

// ¿Mostramos la invitación a instalar? Siempre en móvil, salvo que el usuario ya
// esté dentro de la app (display-mode standalone). No depende de clics ni de
// descartes: el aviso permanece hasta que se abre la app instalada.
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
// por carga y se indica si lo hemos suprimido nosotros (en la portada).
let promptNativoReportado = false;
function reportarPromptNativo() {
  if (promptNativoReportado) return;
  const ctx = agPwa();
  if (!ctx || !ctx.prompt) return;
  promptNativoReportado = true;
  eventoPwa('pwa_native_prompt_available', {
    ubicacion: ubicacionActual(),
    suprimido: ctx.suprimido ? 'si' : 'no',
  });
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

// `componente` identifica el botón que lanzó la instalación (`flotante`,
// `banner_novedad`, `tarjeta_ficha`), para poder abrir el embudo por superficie.
export function instalar(componente = 'desconocido') {
  if (detectarOs() === 'ios') {
    eventoPwa('pwa_ios_instructions_shown', { componente });
    abrirPanel();
    return;
  }

  const prompt = agPwa()?.prompt;
  if (prompt) {
    prompt.prompt();
    prompt.userChoice
      .then((choice: { outcome: string }) => {
        eventoPwa(
          choice.outcome === 'accepted' ? 'pwa_prompt_accepted' : 'pwa_prompt_dismissed',
          { componente },
        );
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

  // `appinstalled` lo captura el script inline y llega como evento propio.
  window.addEventListener('ag:appinstalled', () => {
    reportarInstalado();
  });

  // El prompt nativo del navegador: se mide cuándo está disponible y si lo hemos
  // suprimido (portada). También se comprueba al arrancar por si llegó antes que
  // este módulo.
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
