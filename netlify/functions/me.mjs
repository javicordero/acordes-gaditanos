// Dice si hay sesión y con qué usuario.
import { sesion, json } from './_lib.mjs';

export default async (req) => {
  const s = sesion(req);
  if (!s) return json({ error: 'sin sesión' }, 401);
  return json({ login: s.login, local: s.local === true });
};
