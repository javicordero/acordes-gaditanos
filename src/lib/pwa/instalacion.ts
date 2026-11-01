// src/lib/pwa/instalacion.ts
//
// Lógica de instalación de la PWA: estado (descartado), disparo del prompt nativo
// en Android y panel de instrucciones en iOS/otros navegadores.
// El evento beforeinstallprompt lo captura un script inline del <head> (antes de
// que carguen los módulos) y lo deja en window.__agPwa.

import {
  detectarOs,
  esStandalone,
  eventoPwa,
  iniciarAnaliticaPwa,
} from './analytics';

const CLAVE_DESCARTADO = 'ag_pwa_descartado';
const CADUCIDAD_DESCARTE_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

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

export function estaDescartado(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE_DESCARTADO) || 0);
    return Boolean(t) && Date.now() - t < CADUCIDAD_DESCARTE_MS;
  } catch {
    return false;
  }
}

// ¿Mostramos la invitación a instalar?
// - Solo en móvil, si no estamos ya dentro de la app (standalone) ni descartado.
// - Android: solo si el navegador ofreció el prompt nativo (beforeinstallprompt),
//   que es la señal de que la app es instalable. Si ya está instalada (aunque
//   estés en el navegador), Chrome no lo dispara y no mostramos el botón.
// - iOS: en Safari siempre se puede añadir a pantalla de inicio; no hay otra señal.
// Nota: no usamos un flag persistente de "ya instalado" porque localStorage no se
// borra al desinstalar la app y dejaría el botón oculto para siempre.
export function puedeInstalar(): boolean {
  if (!esMovil() || esStandalone() || estaDescartado()) return false;
  if (detectarOs() === 'android') return Boolean(agPwa()?.prompt);
  return true;
}

// pwa_installed se emite una sola vez por sesión de página (no en cada recarga).
let instaladoReportado = false;
function reportarInstalado() {
  if (instaladoReportado) return;
  instaladoReportado = true;
  eventoPwa('pwa_installed');
}

// Avisa a los componentes (FAB, tarjeta) de que el estado ha cambiado para que
// vuelvan a decidir si mostrarse.
function notificarEstado() {
  window.dispatchEvent(new CustomEvent('ag:pwa-estado'));
}

export function descartar() {
  try {
    localStorage.setItem(CLAVE_DESCARTADO, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
  cerrarPanel();
  notificarEstado();
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
        notificarEstado();
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
    notificarEstado();
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
