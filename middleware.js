import { next } from '@vercel/functions';
import { COOKIE, lerCookie, tokenValido } from './lib/session.js';

// Protege o app inteiro; ficam públicos só a tela de login, a API de login/logout e os
// arquivos que o navegador busca sem cookie (manifest e ícones).
export const config = {
  matcher: ['/((?!login\\.html|api/login|api/logout|manifest\\.webmanifest|icone-.*\\.png).*)'],
};

export default async function middleware(request) {
  const token = lerCookie(request.headers.get('cookie'), COOKIE);
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (await tokenValido(token, email, process.env.SESSION_SECRET)) return next();
  return Response.redirect(new URL('/login.html', request.url), 302);
}
