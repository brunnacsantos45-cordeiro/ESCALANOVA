import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Formato guardado: "scrypt$<salt hex>$<hash hex>".
export function gerarHash(senha) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(senha, salt, 32).toString('hex')}`;
}

export function senhaConfere(senha, armazenado) {
  const [alg, salt, hash] = (armazenado || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  return timingSafeEqual(esperado, scryptSync(senha, Buffer.from(salt, 'hex'), esperado.length));
}

export const SENHA_MIN = 10;
export const emailValido = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
