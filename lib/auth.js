import { COOKIE, lerCookie, lerToken } from './session.js';
import { db } from './db.js';

// Usuário autenticado da requisição, conferido no banco (ativo e com a mesma versão de senha).
// Redefinir a senha ou desativar a conta invalida as sessões abertas.
export async function usuarioDaRequisicao(req) {
  const t = await lerToken(lerCookie(req.headers.cookie, COOKIE), process.env.SESSION_SECRET);
  if (!t || !process.env.DATABASE_URL) return null;
  const sql = await db();
  const [u] = await sql`SELECT id, email, nome, papel, ativo, versao FROM usuarios WHERE id = ${t.id}`;
  if (!u || !u.ativo || u.versao !== t.versao) return null;
  return { id: u.id, email: u.email, nome: u.nome, papel: u.papel };
}
