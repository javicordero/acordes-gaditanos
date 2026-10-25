// src/integrations/enlaces-con-barra.mjs
//
// Netlify sirve las páginas en /acordes/pasodoble-guenagente/ (200) y redirige
// /acordes/pasodoble-guenagente → /acordes/pasodoble-guenagente/ con un 301.
// La canonical y el sitemap ya usan la barra final, pero los enlaces internos
// se escriben sin ella, así que cada clic paga un salto de más (una ida y
// vuelta completa antes de empezar a recibir el HTML).
//
// Esta integración reescribe los `href` internos del HTML ya generado para que
// apunten directamente a la URL que responde 200. Solo toca rutas que existan
// de verdad en el build (`dist/<ruta>/index.html`), así que no puede romper
// assets, /api/ ni enlaces a páginas inexistentes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RE_HREF = /href="(\/[^"]*)"/g;
const RE_EXTENSION = /\.[a-z0-9]{1,5}$/i;

/**
 * Recorre `dist` y devuelve el conjunto de rutas de página (las que tienen
 * `index.html`), en crudo y codificadas, para poder comparar con los `href`.
 */
export function rutasDeDirectorio(root) {
  const rutas = new Set();

  const recorrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);

      if (entrada.isDirectory()) {
        recorrer(completo);
      } else if (entrada.name === 'index.html') {
        const relativa = path.relative(root, dir).split(path.sep).join('/');
        rutas.add(relativa);
        rutas.add(encodeURI(relativa));
      }
    }
  };

  recorrer(root);
  return rutas;
}

/**
 * Añade la barra final a los `href` internos que apuntan a una página del
 * build. Devuelve el HTML y cuántos enlaces ha cambiado.
 */
export function normalizarHrefs(html, rutas) {
  let cambios = 0;

  const normalizado = html.replace(RE_HREF, (original, valor) => {
    // //dominio, ya tiene barra, o no es una página.
    if (valor.startsWith('//') || valor === '/' || valor.endsWith('/')) {
      return original;
    }

    // Separa #ancla y ?consulta para reengancharlos después.
    const corte = valor.search(/[#?]/);
    const ruta = corte === -1 ? valor : valor.slice(0, corte);
    const sufijo = corte === -1 ? '' : valor.slice(corte);

    // Endpoint, no página.
    if (ruta.startsWith('/api/')) return original;

    // Assets y archivos estáticos (css, js, xml, json, png…).
    if (RE_EXTENSION.test(ruta.slice(ruta.lastIndexOf('/') + 1))) return original;

    const clave = ruta.slice(1);
    let existe = rutas.has(clave);

    if (!existe) {
      try {
        existe = rutas.has(decodeURI(clave));
      } catch {
        existe = false;
      }
    }

    if (!existe) return original;

    cambios++;
    return `href="${ruta}/${sufijo}"`;
  });

  return { html: normalizado, cambios };
}

/** Recorre todos los .html de `root`. */
export function ficherosHtml(root, acc = []) {
  for (const entrada of fs.readdirSync(root, { withFileTypes: true })) {
    const completo = path.join(root, entrada.name);

    if (entrada.isDirectory()) ficherosHtml(completo, acc);
    else if (entrada.name.endsWith('.html')) acc.push(completo);
  }

  return acc;
}

export default function enlacesConBarra() {
  return {
    name: 'enlaces-con-barra',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const rutas = rutasDeDirectorio(root);
        let total = 0;
        let paginas = 0;

        for (const fichero of ficherosHtml(root)) {
          const original = fs.readFileSync(fichero, 'utf8');
          const { html, cambios } = normalizarHrefs(original, rutas);

          if (cambios > 0) {
            fs.writeFileSync(fichero, html);
            total += cambios;
            paginas++;
          }
        }

        logger.info(`barra final: ${total} enlaces en ${paginas} páginas`);
      },
    },
  };
}
