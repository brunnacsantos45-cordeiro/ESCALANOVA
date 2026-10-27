import { scryptSync, timingSafeEqual } from 'node:crypto';
import { COOKIE, DURACAO_S, criarToken } from '../lib/session.js';

// ADMIN_PASSWORD_HASH tem o formato "scrypt$<salt hex>$<hash hex>" (veja scripts/set-password.mjs).
function senhaConfere(senha, armazenado) {
  const [alg, salt, hash] = (armazenado || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const obtido = scryptSync(senha, Buffer.from(salt, 'hex'), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
    return res.status(500).json({ erro: 'Login não configurado no servidor.' });
  }
  const admin = ADMIN_EMAIL.trim().toLowerCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  const ok = email === admin && senhaConfere(senha, ADMIN_PASSWORD_HASH);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700)); // atrasa tentativas de força bruta
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  const token = await criarToken(admin, SESSION_SECRET);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO_S}`);
  return res.status(200).json({ ok: true });
}
