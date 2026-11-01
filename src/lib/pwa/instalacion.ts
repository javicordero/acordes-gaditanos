// src/lib/pwa/instalacion.ts
//
// Lógica de instalación de la PWA: estado (descartado/instalado), disparo del
// prompt nativo en Android y panel de instrucciones en iOS/otros navegadores.
// El evento beforeinstallprompt lo captura un script inline del <head> (antes de
// que carguen los módulos) y lo deja en window.__agPwa.

import {
  detectarOs,
  esStandalone,
  eventoPwa,
  iniciarAnaliticaPwa,
} from './analytics';

const CLAVE_DESCARTADO = 'ag_pwa_descartado';
const CLAVE_INSTALADO = 'ag_pwa_instalado';
const CADUCIDAD_DESCARTE_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

interface AgPwa {
  prompt: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null;
  installed: boolean;
}

function esMovil(): boolean {
  const o = detectarOs();
  return o === 'android' || o === 'ios';
}

function leerFlag(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

function agPwa(): AgPwa | undefined {
  return (window as unknown as { __agPwa?: AgPwa }).__agPwa;
}

export function estaInstalado(): boolean {
  return leerFlag(CLAVE_INSTALADO) || Boolean(agPwa()?.installed);
}

export function estaDescartado(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE_DESCARTADO) || 0);
    return Boolean(t) && Date.now() - t < CADUCIDAD_DESCARTE_MS;
  } catch {
    return false;
  }
}

// ¿Mostramos la invitación a instalar? Solo en móvil, no en standalone, y si no
// está instalada ni descartada recientemente.
export function puedeInstalar(): boolean {
  return esMovil() && !esStandalone() && !estaInstalado() && !estaDescartado();
}

// pwa_installed se emite una sola vez (venga de `appinstalled` o del userChoice
// aceptado), para no duplicar la métrica.
let instaladoReportado = false;
function reportarInstalado() {
  if (instaladoReportado) return;
  instaladoReportado = true;
  try {
    localStorage.setItem(CLAVE_INSTALADO, '1');
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
  eventoPwa('pwa_installed');
}

export function descartar() {
  try {
    localStorage.setItem(CLAVE_DESCARTADO, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
  cerrarPanel();
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

export function instalar() {
  if (detectarOs() === 'ios') {
    eventoPwa('pwa_ios_instructions_shown');
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

  // Sin prompt disponible (Android sin criterios cumplidos, escritorio…):
  // instrucciones genéricas en el panel.
  abrirPanel();
}

export function initPwa() {
  iniciarAnaliticaPwa();

  // `appinstalled` lo captura el script inline y llega como evento propio.
  window.addEventListener('ag:appinstalled', () => {
    reportarInstalado();
  });

  // Cerrar el panel al pulsar la X o el fondo (equivale a descartar).
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-ag-cerrar]')) descartar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarPanel();
  });
}
