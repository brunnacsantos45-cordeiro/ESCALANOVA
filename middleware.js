import { next } from '@vercel/functions';
import { COOKIE, lerCookie, lerToken } from './lib/session.js';

// Protege o app inteiro; ficam públicos só a tela de login, a API de login/logout e os
// arquivos que o navegador busca sem cookie (manifest e ícones). O middleware confere só a
// assinatura do cookie; as APIs conferem de novo no banco (conta ativa, papel, versão).
export const config = {
  matcher: ['/((?!login\\.html|api/login|api/logout|manifest\\.webmanifest|icone-.*\\.png).*)'],
};

export default async function middleware(request) {
  const sessao = await lerToken(lerCookie(request.headers.get('cookie'), COOKIE), process.env.SESSION_SECRET);
  if (!sessao) return Response.redirect(new URL('/login.html', request.url), 302);
  return next();
}
