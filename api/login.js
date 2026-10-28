import { COOKIE, DURACAO_S, criarToken } from '../lib/session.js';
import { db } from '../lib/db.js';
import { gerarHash, senhaConfere } from '../lib/senha.js';

const HASH_FALSO = gerarHash('nao-existe'); // gasta o mesmo tempo quando o e-mail não existe

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET, DATABASE_URL } = process.env;
  if (!SESSION_SECRET || !DATABASE_URL) {
    return res.status(500).json({ erro: 'Login não configurado no servidor.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');

  try {
    const sql = await db();
    let [u] = await sql`SELECT * FROM usuarios WHERE email = ${email}`;

    // Primeiro acesso após a criação do banco: o administrador definido nas variáveis de
    // ambiente vira o primeiro usuário (admin) da tabela, com a mesma senha de antes.
    if (!u && ADMIN_EMAIL && ADMIN_PASSWORD_HASH && email === ADMIN_EMAIL.trim().toLowerCase()) {
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM usuarios`;
      if (n === 0 && senhaConfere(senha, ADMIN_PASSWORD_HASH)) {
        [u] = await sql`INSERT INTO usuarios (email, nome, senha_hash, papel)
                        VALUES (${email}, 'Administrador', ${ADMIN_PASSWORD_HASH}, 'admin') RETURNING *`;
      }
    }

    const ok = senhaConfere(senha, u ? u.senha_hash : HASH_FALSO) && u && u.ativo;
    if (!ok) {
      await new Promise((r) => setTimeout(r, 700)); // atrasa tentativas de força bruta
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const token = await criarToken(
      { id: u.id, versao: u.versao, papel: u.papel, email: u.email }, SESSION_SECRET
    );
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO_S}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('api/login', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
