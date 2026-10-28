import { db } from '../lib/db.js';
import { usuarioDaRequisicao } from '../lib/auth.js';
import { SENHA_MIN, gerarHash, senhaConfere } from '../lib/senha.js';

// Cada pessoa troca a própria senha. Isso encerra as demais sessões dela (versao + 1).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  try {
    const eu = await usuarioDaRequisicao(req);
    if (!eu) return res.status(401).json({ erro: 'Não autenticado.' });
    const atual = String(req.body?.atual || '');
    const nova = String(req.body?.nova || '');
    if (nova.length < SENHA_MIN) return res.status(400).json({ erro: `A nova senha precisa ter ao menos ${SENHA_MIN} caracteres.` });
    const sql = await db();
    const [u] = await sql`SELECT senha_hash FROM usuarios WHERE id = ${eu.id}`;
    if (!senhaConfere(atual, u.senha_hash)) {
      await new Promise((r) => setTimeout(r, 700));
      return res.status(400).json({ erro: 'A senha atual está incorreta.' });
    }
    await sql`UPDATE usuarios SET senha_hash = ${gerarHash(nova)}, versao = versao + 1 WHERE id = ${eu.id}`;
    res.setHeader('Set-Cookie', 'escalanova_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('api/senha', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
