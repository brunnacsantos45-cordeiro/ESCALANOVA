// Sessão por cookie assinado (HMAC-SHA256). Usa Web Crypto: roda no Node e no Edge.
// O cookie leva {u: id, v: versão, p: papel, e: e-mail, x: expiração}. A conferência no banco
// (usuário ativo, versão igual) é feita em lib/auth.js; o middleware só confere a assinatura.
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

const paraB64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, '');
const deB64 = (txt) => JSON.parse(decodeURIComponent(escape(atob(txt))));

export async function criarToken({ id, versao, papel, email }, segredo) {
  const corpo = paraB64({ u: id, v: versao, p: papel, e: email, x: Math.floor(Date.now() / 1000) + DURACAO_S });
  return `${corpo}.${await assinar(corpo, segredo)}`;
}

// Devolve {id, versao, papel, email} se a assinatura e a validade conferem; senão null.
export async function lerToken(token, segredo) {
  if (!token || !segredo) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const corpo = token.slice(0, i);
  if (!iguais(token.slice(i + 1), await assinar(corpo, segredo))) return null;
  try {
    const d = deB64(corpo);
    if (!(d.x > Math.floor(Date.now() / 1000))) return null;
    return { id: d.u, versao: d.v, papel: d.p, email: d.e };
  } catch {
    return null;
  }
}

export function lerCookie(header, nome) {
  for (const parte of (header || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return '';
}
