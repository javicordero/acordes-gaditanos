/**
 * Páginas de agrupación del glosario: selecciones curadas de acordes.
 *
 * Cada grupo es contenido escrito a mano (no un listado automático) porque lo
 * que aporta es la selección y el porqué de cada acorde, no el volcado. Aquí
 * viven también los criterios para que `npm run auditar:agrupaciones` compruebe
 * que lo que dice la página se cumple en los datos del glosario.
 *
 * Puro (sin Astro) para poder importarlo desde Node con
 * `node --experimental-strip-types`.
 */

import { claveAcorde, indicePostura, type Glosario } from './acordes.ts';

export type ClaveAgrupacion = 'faciles' | 'cejilla' | 'espanola' | 'carnaval';

/**
 * Qué promete la página y, por tanto, qué se comprueba:
 * - `sin-cejilla`: la postura no lleva cejilla, pisa 3 cuerdas como mucho y no
 *   pasa del traste 3.
 * - `con-cejilla`: la postura se toca con cejilla.
 * - `primera-posicion`: no pasa del traste 3 (suena mejor en nailon).
 * - `coplas`: aparece al menos en `coplasMinimas` coplas del cancionero.
 */
export type Criterio = 'sin-cejilla' | 'con-cejilla' | 'primera-posicion' | 'coplas';

export interface AcordeAgrupacion {
  /** Etiqueta del glosario (Do, Lam, Fa#7…). */
  etiqueta: string;
  /** Postura concreta que se muestra, de la 6ª a la 1ª cuerda (`x` = muda). */
  postura: string;
  /** Por qué está en esta selección. */
  motivo: string;
}

export interface Progresion {
  titulo: string;
  acordes: string[];
  nota: string;
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export interface Agrupacion {
  clave: ClaveAgrupacion;
  /** Ruta pública, sin barras: `/acordes-faciles-guitarra/`. */
  slug: string;
  h1: string;
  title: string;
  description: string;
  keywords: string;
  /** Entradilla corta, la que se ve debajo del H1. */
  resumen: string;
  /** Párrafos de introducción (150-250 palabras en total). */
  intro: string[];
  criterio: Criterio;
  criterioTexto: string;
  acordes: AcordeAgrupacion[];
  progresion: Progresion;
  faq: PreguntaFrecuente[];
  /** Otras agrupaciones enlazadas al final. */
  otras: ClaveAgrupacion[];
  /** Solo para el criterio `coplas`. */
  coplasMinimas?: number;
}

export const AGRUPACIONES: Record<ClaveAgrupacion, Agrupacion> = {
  /* ---------------------------------------------------------------- */
  /* Acordes fáciles                                                    */
  /* ---------------------------------------------------------------- */
  faciles: {
    clave: 'faciles',
    slug: 'acordes-faciles-guitarra',
    h1: 'Acordes fáciles de guitarra',
    title: 'Acordes fáciles de guitarra: 12 acordes sin cejilla - Acordes Gaditanos',
    description:
      'Los 12 acordes más fáciles para empezar en la guitarra: sin cejilla, con dos o tres dedos y cuerdas al aire. Diagramas, por qué son fáciles y una progresión para tocarlos seguidos.',
    keywords:
      'acordes fáciles, acordes fáciles de guitarra, acordes sin cejilla, acordes para principiantes, primeros acordes de guitarra, Do Sol Lam Mim',
    resumen:
      'Doce acordes que se tocan sin cejilla, con dos o tres dedos y cuerdas al aire. Son los primeros que se aprenden y con ellos ya se acompañan coplas enteras.',
    intro: [
      'Antes de la cejilla y de las séptimas raras está esto: doce formas que caben en tres trastes, dejan cuerdas al aire y se colocan con dos o tres dedos. No son acordes «de juguete»: con ellos se tocan pasodobles, tangos y casi cualquier canción. La única condición es que la mano izquierda no tenga que atravesar el mástil.',
      'El orden no es casual. Van en parejas, y cada pareja es el mismo acorde con un dedo menos: Mim y Mim7, Lam y Lam7, Do y Domaj7, Sol y Sol7. Así se aprende el gesto antes que la memoria; si sabes el de arriba, ya sabes el de abajo y entiendes por qué suenan distintos.',
      'Los diagramas están en afinación estándar (Mi-La-Re-Sol-Si-Mi). La × es una cuerda que no se toca y el ○ una cuerda al aire. Si todavía no sabes leerlos, en la ficha de cada acorde tienes la digitación cuerda por cuerda y todas sus posiciones.',
    ],
    criterio: 'sin-cejilla',
    criterioTexto:
      'Ninguno lleva cejilla: todas las posturas caben en los tres primeros trastes, pisan tres cuerdas como máximo y dejan al menos una cuerda al aire.',
    acordes: [
      {
        etiqueta: 'Mim',
        postura: '0 2 2 0 0 0',
        motivo:
          'Dos dedos y suenan las seis cuerdas. Es el primero que se enseña porque perdona: aunque pulses de más, el acorde sigue sonando.',
      },
      {
        etiqueta: 'Mim7',
        postura: '0 2 0 0 0 0',
        motivo:
          'El mismo Mim levantando el dedo de la 4ª cuerda. Un solo dedo y suena más suelto; sirve para llegar a La.',
      },
      {
        etiqueta: 'Lam',
        postura: 'x 0 2 2 1 0',
        motivo:
          'La forma de Mi trasladada una cuerda. Tres dedos y dos cuerdas al aire, con el bajo en la 5ª.',
      },
      {
        etiqueta: 'Lam7',
        postura: 'x 0 2 0 1 0',
        motivo:
          'Lam sin el dedo de la 3ª cuerda. Es el acorde más suave de la lista y engancha con Do.',
      },
      {
        etiqueta: 'Do',
        postura: 'x 3 2 0 1 0',
        motivo:
          'Tres dedos y tres cuerdas al aire. El bajo en la 5ª cuerda le da cuerpo sin necesidad de fuerza.',
      },
      {
        etiqueta: 'Domaj7',
        postura: 'x 3 2 0 0 0',
        motivo:
          'Do levantando el índice. Suena abierto, casi flotante; muy usado al final de una frase.',
      },
      {
        etiqueta: 'Sol',
        postura: '3 2 0 0 0 3',
        motivo:
          'Tres dedos y tres cuerdas al aire. Es el acorde que más llena sin cejilla y el que más se usa para cerrar.',
      },
      {
        etiqueta: 'Sol7',
        postura: '3 2 0 0 0 1',
        motivo:
          'Sol con un dedo más en la 1ª cuerda. Empuja hacia Do y cierra cualquier vuelta.',
      },
      {
        etiqueta: 'Mi',
        postura: '0 2 2 1 0 0',
        motivo:
          'Tres dedos y tres cuerdas al aire. El más rotundo de los abiertos: mucha resonancia con poco esfuerzo.',
      },
      {
        etiqueta: 'Mi7',
        postura: '0 2 0 1 0 0',
        motivo:
          'Mi sin el dedo de la 4ª. Es el dominante de La y aparece en casi todas las coplas del carnaval.',
      },
      {
        etiqueta: 'La',
        postura: 'x 0 2 2 2 0',
        motivo:
          'Tres dedos en las cuerdas 2ª, 3ª y 4ª. Con Mi y Re forma el trío más rentable de la guitarra.',
      },
      {
        etiqueta: 'Rem',
        postura: 'x x 0 2 3 1',
        motivo:
          'Tres dedos en las cuatro primeras cuerdas. Re es esta misma forma un traste más arriba: si sale Rem, sale Re.',
      },
    ],
    progresion: {
      titulo: 'Una progresión para empezar',
      acordes: ['Do', 'Sol', 'Lam', 'Mim'],
      nota: 'Do–Sol–Lam–Mim. Toca cada acorde cuatro tiempos y cambia al siguiente sin parar el rasgueo. Es la vuelta más común del carnaval y de medio repertorio popular, y los cuatro caben en la mano sin cejilla.',
    },
    faq: [
      {
        pregunta: '¿Cuál es el acorde más fácil de guitarra?',
        respuesta:
          'Mim7: un solo dedo en la 5ª cuerda, traste 2, y las demás al aire. Si todavía no te suena limpio, empieza por Mim y levanta después el dedo de la 4ª cuerda.',
      },
      {
        pregunta: '¿Se puede tocar sin cejilla?',
        respuesta:
          'Sí. Con Do, Sol, Lam, Mim, Mi, La, Rem y sus séptimas se acompañan coplas enteras. La cejilla aparece cuando quieres cambiar de tono o usar formas que no existen al aire.',
      },
      {
        pregunta: '¿Cuántos acordes necesito para tocar una canción?',
        respuesta:
          'Con tres o cuatro ya se sostiene una copla. La progresión Do–Sol–Lam–Mim, por ejemplo, sirve para muchas letras; cambiar el orden o el ritmo ya suena a otra cosa.',
      },
    ],
    otras: ['cejilla', 'espanola', 'carnaval'],
  },

  /* ---------------------------------------------------------------- */
  /* Acordes con cejilla                                                */
  /* ---------------------------------------------------------------- */
  cejilla: {
    clave: 'cejilla',
    slug: 'acordes-con-cejilla',
    h1: 'Acordes con cejilla',
    title: 'Acordes con cejilla: 11 posiciones para todo el mástil - Acordes Gaditanos',
    description:
      'Los acordes con cejilla que más se usan, con la forma de Mi y la forma de La, en qué traste va cada uno y una progresión en Fa para practicar el cambio.',
    keywords:
      'acordes con cejilla, cejilla guitarra, acordes con barra, forma de mi, forma de la, Fa con cejilla, cejilla traste 1',
    resumen:
      'Once acordes con cejilla, las dos formas que lo explican todo y una progresión en Fa para perderle el miedo al dedo índice.',
    intro: [
      'La cejilla es el mismo acorde movido de sitio. Con una sola forma —la de Mi o la de La— tienes los doce tonos: basta con deslizar la mano por el mástil. Por eso quien acompaña coplas cambia de tono sin pensar: no aprende doce acordes, aprende dos formas.',
      'Aquí están las once cejillas que más se usan, del traste 1 al 4. Las primeras aparecen en cualquier canción; las últimas ya piden un mástil que responda. Todas se tocan con el índice atravesado y los otros tres dedos formando el acorde por delante.',
      'Un aviso: la cejilla no se aprieta con el pulgar, se aprieta con el brazo. Si el índice se cansa, gira la muñeca hacia delante y deja que el peso de la mano haga el trabajo. Y si una cuerda interior no suena, casi nunca es la cejilla: es que el dedo está demasiado lejos del traste.',
    ],
    criterio: 'con-cejilla',
    criterioTexto:
      'Las once posturas se tocan con cejilla: cuatro son la forma de Mi y siete la forma de La o de Lam, que son las dos que se trasladan por todo el mástil.',
    acordes: [
      {
        etiqueta: 'Fa',
        postura: '1 3 3 2 1 1',
        motivo:
          'La cejilla de referencia: forma de Mi en el traste 1. Si sale Fa, salen los otros once tonos.',
      },
      {
        etiqueta: 'Sib',
        postura: 'x 1 3 3 3 1',
        motivo:
          'Forma de La en el traste 1. Suena más grave que Fa y sirve para acompañar sin subir la voz.',
      },
      {
        etiqueta: 'Sim',
        postura: 'x 2 4 4 3 2',
        motivo:
          'Forma de Lam en el traste 2. La cejilla solo pisa dos cuerdas: es la más llevadera de la lista.',
      },
      {
        etiqueta: 'Fa#m',
        postura: '2 4 4 2 2 2',
        motivo:
          'Forma de Mim en el traste 2. El relativo menor de La, muy común en las coplas.',
      },
      {
        etiqueta: 'Dom',
        postura: 'x 3 5 5 4 3',
        motivo:
          'Forma de Lam en el traste 3. Un menor redondo, con el bajo en la 5ª cuerda.',
      },
      {
        etiqueta: 'Solm',
        postura: '3 5 5 3 3 3',
        motivo:
          'Forma de Mim en el traste 3. El menor de Sib; aparece cuando la copla modula hacia arriba.',
      },
      {
        etiqueta: 'Do',
        postura: 'x 3 5 5 5 3',
        motivo:
          'Forma de La en el traste 3. El cuarto grado de Fa y la cejilla que cierra la progresión.',
      },
      {
        etiqueta: 'Do#m',
        postura: 'x 4 6 6 5 4',
        motivo:
          'Forma de Lam en el traste 4. El relativo menor de Mi, habitual en pasodobles.',
      },
      {
        etiqueta: 'Sol#m',
        postura: '4 6 6 4 4 4',
        motivo:
          'Forma de Mim en el traste 4. El relativo menor de Si; pide un mástil cómodo y cuerdas bajas.',
      },
      {
        etiqueta: 'Sol#',
        postura: '4 6 6 5 4 4',
        motivo:
          'Forma de Mi en el traste 4. El mayor de Sol#; casi siempre va antes de Do#m.',
      },
      {
        etiqueta: 'Do#',
        postura: 'x 4 6 6 6 4',
        motivo:
          'Forma de La en el traste 4. Cierra la progresión que sube por semitonos y deja la 6ª libre.',
      },
    ],
    progresion: {
      titulo: 'Una progresión en Fa',
      acordes: ['Fa', 'Sib', 'Solm', 'Do'],
      nota: 'Fa–Sib–Solm–Do: la cejilla se queda en los trastes 1, 1, 3 y 3. Los cuatro son con cejilla, así que no hay excusa para soltar la mano. Tócala despacio y sin levantar el índice entre acorde y acorde.',
    },
    faq: [
      {
        pregunta: '¿Cuesta más la cejilla en una guitarra española?',
        respuesta:
          'Sí, si las cuerdas están altas o son muy gruesas. En nailon conviene una acción baja y cuerdas de tensión media; con eso, una cejilla en el traste 1 deja de doler en una semana de práctica.',
      },
      {
        pregunta: '¿Por qué no me suena la cejilla?',
        respuesta:
          'Casi siempre por dos motivos: el índice está lejos del traste (tiene que ir pegado a él) o la mano va demasiado plana. Gira la muñeca, apoya el canto del índice y comprueba cuerda por cuerda.',
      },
      {
        pregunta: '¿Qué diferencia hay entre la forma de Mi y la de La?',
        respuesta:
          'La de Mi tiene la fundamental en la 6ª cuerda y la de La en la 5ª. Suenan distinto: la de Mi es más grave y llena; la de La deja libre la 6ª y se usa para no cargar los bajos.',
      },
    ],
    otras: ['faciles', 'espanola', 'carnaval'],
  },

  /* ---------------------------------------------------------------- */
  /* Acordes para guitarra española                                     */
  /* ---------------------------------------------------------------- */
  espanola: {
    clave: 'espanola',
    slug: 'acordes-guitarra-espanola',
    h1: 'Acordes para guitarra española',
    title: 'Acordes para guitarra española: los que mejor suenan en nailon - Acordes Gaditanos',
    description:
      'Qué acordes suenan mejor con cuerdas de nailon, por qué los bajos al aire ganan cuerpo y la cadencia andaluza Lam–Sol–Fa–Mi con diagramas y digitación.',
    keywords:
      'acordes guitarra española, acordes guitarra clásica, acordes nailon, cadencia andaluza, acordes flamencos, guitarra española acordes',
    resumen:
      'Los acordes que mejor responden en una guitarra de nailon: bajos al aire, primera posición y la cadencia andaluza que define el sonido español.',
    intro: [
      'Una guitarra española no suena como una acústica de acero, y no solo por el material. El nailon tiene menos ataque y más cuerpo: las cuerdas al aire duran, los bajos se mezclan y las posiciones altas se apagan antes. Por eso los acordes que mejor le sientan son los que dejan cuerdas al aire y apoyan la fundamental en la 6ª o en la 5ª.',
      'Esta selección no va de dificultad —hay dos cejillas— sino de sonoridad. Son los acordes con los que se acompaña de verdad en guitarra española: los que mantienen el bajo sonando mientras el pulgar hace el rasgueo y los que permiten dejar vibrar las cuerdas sin que se emborronen.',
      'La prueba está en la cadencia andaluza: Lam–Sol–Fa–Mi. Cuatro acordes, dos con cejilla, y el sonido español por excelencia. Si te suena limpia y sin cortes, la guitarra y la mano están en el sitio.',
    ],
    criterio: 'primera-posicion',
    criterioTexto:
      'Todas las posturas se tocan en los tres primeros trastes, con cuerdas al aire o con la cejilla en el 1. Son las que mejor aprovechan la resonancia del nailon.',
    acordes: [
      {
        etiqueta: 'Mi',
        postura: '0 2 2 1 0 0',
        motivo:
          'La fundamental en la 6ª al aire y dos cuerdas más al aire. Es el acorde con más cuerpo de la guitarra española.',
      },
      {
        etiqueta: 'La',
        postura: 'x 0 2 2 2 0',
        motivo:
          'Bajo en la 5ª al aire y tres cuerdas libres. El punto de partida del rasgueo por arriba.',
      },
      {
        etiqueta: 'Re',
        postura: 'x x 0 2 3 2',
        motivo:
          'Cuatro cuerdas, dos al aire, en la parte aguda. Suena brillante sin tapar la voz.',
      },
      {
        etiqueta: 'Sol',
        postura: '3 2 0 0 0 3',
        motivo:
          'Tres cuerdas al aire y el bajo más grave de la lista. Llena sin necesidad de fuerza.',
      },
      {
        etiqueta: 'Do',
        postura: 'x 3 2 0 1 0',
        motivo:
          'Bajo en la 5ª y tres cuerdas libres. El acorde que sostiene cualquier estrofa.',
      },
      {
        etiqueta: 'Lam',
        postura: 'x 0 2 2 1 0',
        motivo:
          'La forma de Mi una cuerda más abajo; el menor más natural en nailon.',
      },
      {
        etiqueta: 'Mim',
        postura: '0 2 2 0 0 0',
        motivo:
          'Dos dedos y seis cuerdas sonando. En nailon es el acorde que más resuena con menos esfuerzo.',
      },
      {
        etiqueta: 'Rem',
        postura: 'x x 0 2 3 1',
        motivo:
          'Más agudo y más íntimo; deja el bajo libre para que el pulgar marque el ritmo.',
      },
      {
        etiqueta: 'Fa',
        postura: '1 3 3 2 1 1',
        motivo:
          'La cejilla en el traste 1 con la forma de Mi. En nailon suena redondo y no estridente.',
      },
      {
        etiqueta: 'Sib',
        postura: 'x 1 3 3 3 1',
        motivo:
          'Forma de La en el traste 1. El bajo en la 5ª deja la 6ª libre para el pulgar.',
      },
    ],
    progresion: {
      titulo: 'La cadencia andaluza',
      acordes: ['Lam', 'Sol', 'Fa', 'Mi'],
      nota: 'Lam–Sol–Fa–Mi, con el bajo bajando por semitonos. Es la progresión que más se reconoce como «español» y la que mejor enseña a dejar sonar el nailon: no cortes el bajo al cambiar de acorde.',
    },
    faq: [
      {
        pregunta: '¿Qué acordes suenan mejor en guitarra española?',
        respuesta:
          'Los que dejan cuerdas al aire y apoyan el bajo en la 6ª o la 5ª: Mi, La, Re, Sol, Do, Lam, Mim y Rem. Con nailon ganan cuerpo y permiten que el pulgar marque el ritmo sin apagar el acorde.',
      },
      {
        pregunta: '¿Se puede tocar flamenco con estos acordes?',
        respuesta:
          'La cadencia Lam–Sol–Fa–Mi es la base del flamenco por medio. Con ella y un rasgueo de pulgar ya se reconoce el aire; el resto es técnica de mano derecha.',
      },
      {
        pregunta: '¿Es mejor el nailon para acompañar coplas?',
        respuesta:
          'Para acompañar voz, sí: el nailon no compite con el registro del cantaor y el rasgueo se mezcla mejor. El acero brilla más, pero tapa antes.',
      },
    ],
    otras: ['faciles', 'cejilla', 'carnaval'],
  },

  /* ---------------------------------------------------------------- */
  /* Acordes de Carnaval                                                */
  /* ---------------------------------------------------------------- */
  carnaval: {
    clave: 'carnaval',
    slug: 'acordes-de-carnaval',
    h1: 'Los acordes más usados en el Carnaval de Cádiz',
    title: 'Acordes de Carnaval: los 12 más usados en las coplas - Acordes Gaditanos',
    description:
      'Los acordes que más aparecen en las coplas del Carnaval de Cádiz, con el número real de coplas de cada uno y una progresión típica para acompañarlas.',
    keywords:
      'acordes carnaval de cadiz, acordes de carnaval, acordes coplas, acordes pasodobles, acompañar carnaval con guitarra',
    resumen:
      'Los doce acordes que más salen en el cancionero, con el número real de coplas que los usan y la vuelta que se repite en el carnaval.',
    intro: [
      'El carnaval de Cádiz tiene repertorio propio, pero armonía de siempre: tonalidades de La y de Do, dominantes que empujan y pocos acordes raros. Esta lista sale de contar las fichas del cancionero una por una: no es una selección de gustos, es lo que de verdad se toca.',
      'El orden es el de apariciones. Mi7 encabeza la lista y le siguen Sol, Do, Re y Lam. Que un dominante esté por delante de tónicas y menores dice mucho del estilo: el carnaval vive de la tensión que resuelve en la frase siguiente.',
      'Cada tarjeta indica en cuántas coplas aparece el acorde y enlaza a su ficha, donde tienes todas las posiciones. Abajo, la progresión más repetida para acompañar una letra desde el primer compás.',
    ],
    criterio: 'coplas',
    coplasMinimas: 200,
    criterioTexto:
      'Los doce acordes con más presencia en el cancionero. El número de coplas se calcula sobre las fichas publicadas y se revisa en cada build.',
    acordes: [
      {
        etiqueta: 'Mi7',
        postura: '0 2 0 1 0 0',
        motivo:
          'El dominante que más suena en el carnaval. Empuja a La y cierra frases; aparece en más coplas que ningún otro acorde.',
      },
      {
        etiqueta: 'Sol',
        postura: '3 2 0 0 0 3',
        motivo:
          'El mayor que más se usa después de Do. Tres dedos, tres cuerdas al aire y mucha presencia.',
      },
      {
        etiqueta: 'Do',
        postura: 'x 3 2 0 1 0',
        motivo:
          'La tónica de referencia. Abre y cierra estrofas en buena parte del repertorio.',
      },
      {
        etiqueta: 'Re',
        postura: 'x x 0 2 3 2',
        motivo: 'El cuarto grado de La. Da aire cuando la copla sube de registro.',
      },
      {
        etiqueta: 'Lam',
        postura: 'x 0 2 2 1 0',
        motivo: 'El relativo menor de Do; el color de las coplas melancólicas.',
      },
      {
        etiqueta: 'Mim',
        postura: '0 2 2 0 0 0',
        motivo:
          'El relativo menor de Sol. Dos dedos y suena igual de bien en cualquier registro.',
      },
      {
        etiqueta: 'Si7',
        postura: 'x 2 1 2 0 2',
        motivo: 'Dominante de Mi, muy usado en las coplas escritas en Mi menor.',
      },
      {
        etiqueta: 'La7',
        postura: 'x 0 2 0 2 0',
        motivo: 'Dominante de Re. Aparece en las modulaciones hacia arriba.',
      },
      {
        etiqueta: 'Rem',
        postura: 'x x 0 2 3 1',
        motivo: 'El menor de Fa; habitual en tangos y cuplés.',
      },
      {
        etiqueta: 'La',
        postura: 'x 0 2 2 2 0',
        motivo:
          'La tónica del carnaval por excelencia: el tono en el que cantan la mayoría de las agrupaciones.',
      },
      {
        etiqueta: 'Fa',
        postura: '1 3 3 2 1 1',
        motivo: 'El cuarto grado de Do. Lleva cejilla, pero es imprescindible.',
      },
      {
        etiqueta: 'Fa#7',
        postura: '2 4 2 3 2 2',
        motivo: 'Dominante de Si menor; el giro que da el aire de comparsa.',
      },
    ],
    progresion: {
      titulo: 'La vuelta del carnaval',
      acordes: ['Do', 'Sol', 'Lam', 'Mi7'],
      nota: 'Do–Sol–Lam–Mi7 es la progresión que más se repite en el cancionero. Toca cada acorde a cuatro tiempos sin parar el rasgueo: Mi7 es el dominante de Lam, así que la vuelta se cierra volviendo a Lam o repitiendo desde Do.',
    },
    faq: [
      {
        pregunta: '¿Qué acordes se usan en el Carnaval de Cádiz?',
        respuesta:
          'Sobre todo los de La y Do: La, Mi7, Do, Sol, Lam, Re, Mim, Si7 y La7. Los doce de esta página cubren la mayoría de las coplas del cancionero.',
      },
      {
        pregunta: '¿Por qué aparece tanto Mi7?',
        respuesta:
          'Porque el carnaval vive del dominante que empuja y resuelve: Mi7 lleva a La, y La es el tono más habitual de los cantaores. Por eso encabeza la lista de apariciones.',
      },
      {
        pregunta: '¿Hace falta cejilla para tocar carnaval?',
        respuesta:
          'No. Diez de los doce se tocan sin cejilla; solo Fa y Fa#7 la llevan. Con los otros diez ya se acompañan la mayoría de las letras.',
      },
    ],
    otras: ['faciles', 'cejilla', 'espanola'],
  },
};

/** Los cuatro grupos en el orden en que se enlazan. */
export const LISTA_AGRUPACIONES: Agrupacion[] = [
  AGRUPACIONES.faciles,
  AGRUPACIONES.cejilla,
  AGRUPACIONES.espanola,
  AGRUPACIONES.carnaval,
];

/* ------------------------------------------------------------------ */
/* Revisión                                                            */
/* ------------------------------------------------------------------ */

export interface ContextoRevision {
  glosario: Glosario;
  /** Coplas distintas que usan cada acorde (solo hace falta para `coplas`). */
  coplas: Map<string, number> | null;
}

/** Comprueba que la página cumple lo que promete. Devuelve los problemas. */
export function revisarAgrupacion(
  grupo: Agrupacion,
  { glosario, coplas }: ContextoRevision,
): string[] {
  const problemas: string[] = [];
  const fallo = (mensaje: string) => problemas.push(`${grupo.clave}: ${mensaje}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(grupo.slug)) {
    fallo(`slug no válido: ${grupo.slug}`);
  }
  if (grupo.acordes.length < 8 || grupo.acordes.length > 15) {
    fallo(`${grupo.acordes.length} acordes (debe haber entre 8 y 15)`);
  }
  if (grupo.faq.length < 2) {
    fallo(`${grupo.faq.length} preguntas frecuentes (mínimo 2)`);
  }

  const vistos = new Map<string, string>();
  for (const { etiqueta, postura, motivo } of grupo.acordes) {
    const entrada = glosario[etiqueta];
    if (!entrada) {
      fallo(`${etiqueta} no existe en el glosario`);
      continue;
    }
    if (!motivo.trim()) fallo(`${etiqueta} sin motivo`);

    const clave = claveAcorde(entrada);
    const repetido = vistos.get(clave);
    if (repetido) {
      fallo(`${etiqueta} repite el acorde de ${repetido}`);
    } else {
      vistos.set(clave, etiqueta);
    }

    const indice = indicePostura(entrada, postura);
    if (indice === null) {
      fallo(`${etiqueta} (${postura}) no está entre sus posiciones`);
      continue;
    }
    const posicion = entrada.posiciones[indice]!;
    const pisadas = posicion.trastes.filter((t) => t > 0);
    const maximo = Math.max(...pisadas, 0);

    if (grupo.criterio === 'sin-cejilla') {
      if (posicion.cejilla) fallo(`${etiqueta} (${postura}) lleva cejilla`);
      if (pisadas.length > 3) {
        fallo(`${etiqueta} (${postura}) pisa ${pisadas.length} cuerdas (máximo 3)`);
      }
      if (maximo > 3) fallo(`${etiqueta} (${postura}) llega al traste ${maximo} (máximo 3)`);
      if (!posicion.trastes.includes(0)) {
        fallo(`${etiqueta} (${postura}) no deja ninguna cuerda al aire`);
      }
    }

    if (grupo.criterio === 'con-cejilla' && !posicion.cejilla) {
      fallo(`${etiqueta} (${postura}) no lleva cejilla`);
    }

    if (grupo.criterio === 'primera-posicion' && maximo > 3) {
      fallo(`${etiqueta} (${postura}) llega al traste ${maximo} (máximo 3)`);
    }

    if (grupo.criterio === 'coplas') {
      if (!coplas) {
        fallo('faltan las coplas para comprobar el criterio');
      } else {
        const total = coplas.get(entrada.slug) ?? 0;
        const minimo = grupo.coplasMinimas ?? 0;
        if (total < minimo) {
          fallo(`${etiqueta} aparece en ${total} coplas (mínimo ${minimo})`);
        }
      }
    }
  }

  const etiquetas = new Set(grupo.acordes.map((a) => a.etiqueta));
  for (const acorde of grupo.progresion.acordes) {
    if (!etiquetas.has(acorde)) {
      fallo(`la progresión usa ${acorde}, que no está en la selección`);
    }
  }

  for (const otra of grupo.otras) {
    if (!AGRUPACIONES[otra]) fallo(`enlaza a una agrupación desconocida: ${otra}`);
    if (otra === grupo.clave) fallo('se enlaza a sí misma');
  }

  return problemas;
}
