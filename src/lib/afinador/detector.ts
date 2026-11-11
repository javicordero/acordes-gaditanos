/**
 * Detector de afinación con el micrófono.
 *
 * Pitchy (MPM) queda detrás de esta interfaz para poder sustituirlo. El
 * detector no se inicializa solo: hay que llamar a `activar()` desde un clic,
 * que es lo que necesitan iOS y las políticas de permisos.
 */

import { PitchDetector } from 'pitchy';
import { notaDesdeFrecuencia, type NotaDetectada } from './notas.ts';

export type EstadoAfinador = 'inactivo' | 'pidiendo' | 'activo' | 'error';

export type MotivoError = 'permiso' | 'sin-microfono' | 'ocupado' | 'sin-soporte' | 'desconocido';

export interface OpcionesAfinador {
  /** `null` cuando no hay señal suficiente. */
  onNota: (nota: NotaDetectada | null) => void;
  onEstado: (estado: EstadoAfinador, detalle?: MotivoError) => void;
  /** Nivel de entrada normalizado 0-1, para el medidor de señal. */
  onNivel?: (nivel: number) => void;
}

export interface ControlAfinador {
  activar: () => Promise<void>;
  parar: () => void;
  activo: () => boolean;
}

/** Lecturas que se guardan para la mediana (unos 400 ms a 60 ms por lectura). */
const VENTANA = 7;
const INTERVALO_MS = 60;
/** 0.8 es más permisivo que el 0.9 de Pitchy: el nailon no siempre da tanta claridad. */
const CLARIDAD_MINIMA = 0.8;
/** −60 dB: deja pasar una guitarra suave a medio metro de un micro de móvil. */
const VOLUMEN_MINIMO_DB = -60;
/** Lecturas seguidas sin señal antes de borrar la nota. */
const SILENCIOS = 4;
/** Diferencia de cents que no merece repintar la aguja. */
const HISTERESIS = 3;

function motivoDeError(error: unknown): MotivoError {
  const nombre = (error as { name?: string } | null)?.name ?? '';

  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'permiso';
  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') return 'sin-microfono';
  if (nombre === 'NotReadableError' || nombre === 'TrackStartError') return 'ocupado';
  if (nombre === 'TypeError') return 'sin-soporte';
  return 'desconocido';
}

export function crearAfinador({
  onNota,
  onEstado,
  onNivel,
}: OpcionesAfinador): ControlAfinador {
  let contexto: AudioContext | null = null;
  let flujo: MediaStream | null = null;
  let analizador: AnalyserNode | null = null;
  let silencio: GainNode | null = null;
  let detector: PitchDetector<Float32Array> | null = null;
  let buffer: Float32Array<ArrayBuffer> | null = null;
  let temporizador: number | null = null;

  let historial: number[] = [];
  let ultima: { midi: number; cents: number } | null = null;
  let silencios = 0;
  let activo = false;

  function soltar() {
    if (temporizador !== null) {
      window.clearInterval(temporizador);
      temporizador = null;
    }

    analizador?.disconnect();
    analizador = null;

    silencio?.disconnect();
    silencio = null;

    flujo?.getTracks().forEach((pista) => pista.stop());
    flujo = null;

    if (contexto && contexto.state !== 'closed') {
      void contexto.close().catch(() => {});
    }
    contexto = null;

    detector = null;
    buffer = null;
    historial = [];
    ultima = null;
    silencios = 0;
    activo = false;
    onNivel?.(0);
  }

  function analizar() {
    if (!analizador || !detector || !buffer || !contexto) return;

    analizador.getFloatTimeDomainData(buffer);

    // Nivel de entrada en dB, de −60 (nada) a 0 (máximo), para el medidor.
    let suma = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const muestra = buffer[i]!;
      suma += muestra * muestra;
    }
    const rms = Math.sqrt(suma / buffer.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    onNivel?.(Math.max(0, Math.min(1, (db + 60) / 60)));

    const [frecuencia, claridad] = detector.findPitch(buffer, contexto.sampleRate);

    if (!frecuencia || claridad < CLARIDAD_MINIMA) {
      silencios += 1;
      if (silencios >= SILENCIOS) {
        historial = [];
        ultima = null;
        onNota(null);
      }
      return;
    }

    silencios = 0;
    historial.push(frecuencia);
    if (historial.length > VENTANA) historial.shift();

    const ordenadas = [...historial].sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)]!;
    const nota = notaDesdeFrecuencia(mediana);
    if (!nota) return;

    // Sin histéresis la aguja vibra con cada frame.
    if (ultima && ultima.midi === nota.midi && Math.abs(ultima.cents - nota.cents) < HISTERESIS) {
      return;
    }

    ultima = { midi: nota.midi, cents: nota.cents };
    onNota(nota);
  }

  async function activar() {
    if (activo) return;

    onEstado('pidiendo');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Sin getUserMedia', 'TypeError');
      }

      // El contexto se crea dentro del clic, antes de pedir permiso: en iOS el
      // gesto se pierde al esperar a getUserMedia y el audio queda suspendido.
      contexto = new AudioContext();
      if (contexto.state === 'suspended') await contexto.resume();

      flujo = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const fuente = contexto.createMediaStreamSource(flujo);
      analizador = contexto.createAnalyser();
      analizador.fftSize = 4096;
      fuente.connect(analizador);

      // Sin una salida al destino, algunos navegadores no procesan el grafo y
      // el analizador devuelve silencio. Se cierra con una ganancia a cero.
      silencio = contexto.createGain();
      silencio.gain.value = 0;
      analizador.connect(silencio);
      silencio.connect(contexto.destination);

      detector = PitchDetector.forFloat32Array(analizador.fftSize);
      detector.minVolumeDecibels = VOLUMEN_MINIMO_DB;
      detector.clarityThreshold = CLARIDAD_MINIMA;

      buffer = new Float32Array(analizador.fftSize);
      activo = true;
      onEstado('activo');
      temporizador = window.setInterval(analizar, INTERVALO_MS);
    } catch (error) {
      soltar();
      onNota(null);
      onEstado('error', motivoDeError(error));
    }
  }

  function parar() {
    if (!activo && !flujo && !contexto) {
      onEstado('inactivo');
      return;
    }

    soltar();
    onNota(null);
    onEstado('inactivo');
  }

  return { activar, parar, activo: () => activo };
}
