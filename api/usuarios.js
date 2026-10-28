import { db } from '../lib/db.js';
import { usuarioDaRequisicao } from '../lib/auth.js';
import { SENHA_MIN, emailValido, gerarHash } from '../lib/senha.js';

// Administração de contas: só para papel "admin". Nunca apaga linhas: contas são desativadas.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const eu = await usuarioDaRequisicao(req);
    if (!eu) return res.status(401).json({ erro: 'Não autenticado.' });
    if (eu.papel !== 'admin') return res.status(403).json({ erro: 'Apenas administradores.' });
    const sql = await db();

    if (req.method === 'GET') {
      const lista = await sql`SELECT id, email, nome, papel, ativo, criado_em FROM usuarios ORDER BY id`;
      return res.status(200).json({ usuarios: lista, eu: eu.id });
    }

    if (req.method === 'POST') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const nome = String(req.body?.nome || '').trim().slice(0, 80);
      const senha = String(req.body?.senha || '');
      const papel = req.body?.papel === 'admin' ? 'admin' : 'membro';
      if (!emailValido(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
      if (senha.length < SENHA_MIN) return res.status(400).json({ erro: `A senha precisa ter ao menos ${SENHA_MIN} caracteres.` });
      const [existe] = await sql`SELECT id FROM usuarios WHERE email = ${email}`;
      if (existe) return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });
      const [novo] = await sql`INSERT INTO usuarios (email, nome, senha_hash, papel)
        VALUES (${email}, ${nome}, ${gerarHash(senha)}, ${papel}) RETURNING id, email, nome, papel, ativo`;
      return res.status(201).json({ usuario: novo });
    }

    if (req.method === 'PATCH') {
      const id = Number(req.body?.id);
      const [alvo] = await sql`SELECT id, papel, ativo FROM usuarios WHERE id = ${id}`;
      if (!alvo) return res.status(404).json({ erro: 'Conta não encontrada.' });

      if (typeof req.body.ativo === 'boolean' && req.body.ativo !== alvo.ativo) {
        if (!req.body.ativo) {
          const [{ n }] = await sql`SELECT count(*)::int AS n FROM usuarios WHERE papel = 'admin' AND ativo AND id <> ${id}`;
          if (alvo.papel === 'admin' && n === 0) {
            return res.status(400).json({ erro: 'Não é possível desativar o único administrador.' });
          }
        }
        // versao + 1 encerra as sessões abertas dessa conta
        await sql`UPDATE usuarios SET ativo = ${req.body.ativo}, versao = versao + 1 WHERE id = ${id}`;
      }
      if (req.body.senha !== undefined) {
        const senha = String(req.body.senha);
        if (senha.length < SENHA_MIN) return res.status(400).json({ erro: `A senha precisa ter ao menos ${SENHA_MIN} caracteres.` });
        await sql`UPDATE usuarios SET senha_hash = ${gerarHash(senha)}, versao = versao + 1 WHERE id = ${id}`;
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    console.error('api/usuarios', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
