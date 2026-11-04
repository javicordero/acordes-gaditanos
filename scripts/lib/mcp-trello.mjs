#!/usr/bin/env node
/**
 * Lanzador del MCP de Trello (`atlassian-trello-mcp`).
 *
 * OpenCode arranca este proceso y él hace de puente: lee las credenciales de
 * `.env` y lanza el servidor MCP con TRELLO_API_KEY y TRELLO_TOKEN. Así
 * `opencode.json` no lleva secretos y las claves siguen viviendo en un solo
 * sitio (`.env`, que está gitignored), igual que el resto de scripts del
 * proyecto.
 *
 * Va **siempre con tu token**, no con el de la cuenta bot: el MCP también mueve
 * tarjetas y los movimientos no tienen que notificar. Como Trello no avisa de
 * tus propias acciones, un comentario escrito con las herramientas `trello_*`
 * **no enciende la campanita**: para comentar se usa el CLI
 * (`npm run trello -- comentar`), que sí escribe con el bot.
 *
 * Prueba rápida de que el servidor arranca:
 *   node scripts/lib/mcp-trello.mjs
 * (se queda esperando por stdin: es normal, es un servidor MCP)
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const SERVIDOR = join(RAIZ, 'node_modules', 'atlassian-trello-mcp', 'dist', 'index.js');

function leerEnv() {
  const ruta = join(RAIZ, '.env');
  if (!existsSync(ruta)) return {};
  const bruto = readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '');
  const valores = {};
  for (const linea of bruto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) valores[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return valores;
}

const env = leerEnv();
const clave = process.env.TRELLO_API_KEY || env.TRELLO_API_KEY || env.TRELLO_KEY || '';
const token = process.env.TRELLO_TOKEN || env.TRELLO_TOKEN || '';

if (!clave || !token) {
  console.error(
    '[trello-mcp] Faltan TRELLO_KEY / TRELLO_TOKEN en .env. ' +
      'Se sacan en https://trello.com/power-ups/admin (Autenticación Trello).',
  );
  process.exit(2);
}

if (!existsSync(SERVIDOR)) {
  console.error(
    '[trello-mcp] No está instalado atlassian-trello-mcp. Ejecuta: npm install',
  );
  process.exit(2);
}

const hijo = spawn(process.execPath, [SERVIDOR], {
  stdio: 'inherit',
  env: { ...process.env, ...env, TRELLO_API_KEY: clave, TRELLO_TOKEN: token },
});

hijo.on('error', (e) => {
  console.error(`[trello-mcp] No se pudo arrancar el servidor: ${e.message}`);
  process.exit(1);
});
hijo.on('exit', (codigo, senal) => {
  process.exit(senal ? 1 : codigo ?? 0);
});
