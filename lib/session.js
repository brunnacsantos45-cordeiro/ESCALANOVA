// Sessão por cookie assinado (HMAC-SHA256). Usa Web Crypto: roda no Node e no Edge.
export const COOKIE = 'escalanova_session';
export const DURACAO_S = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function assinar(texto, segredo) {
  const chave = await crypto.subtle.importKey(
    'raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
}

function iguais(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function criarToken(email, segredo) {
  const exp = Math.floor(Date.now() / 1000) + DURACAO_S;
  const corpo = `${exp}.${email}`;
  return `${corpo}.${await assinar(corpo, segredo)}`;
}

export async function tokenValido(token, email, segredo) {
  if (!token || !segredo || !email) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const corpo = token.slice(0, i);
  const [exp, ...resto] = corpo.split('.');
  if (resto.join('.') !== email) return false;
  if (!(Number(exp) > Math.floor(Date.now() / 1000))) return false;
  return iguais(token.slice(i + 1), await assinar(corpo, segredo));
}

export function lerCookie(header, nome) {
  for (const parte of (header || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return '';
}
