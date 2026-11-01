// Cierra la sesión.
import { COOKIE, json } from './_lib.mjs';

export default async () => json(
  { ok: true },
  200,
  { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
);
