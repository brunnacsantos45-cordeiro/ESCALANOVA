import { usuarioDaRequisicao } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const u = await usuarioDaRequisicao(req);
    if (!u) return res.status(401).json({ erro: 'Não autenticado.' });
    return res.status(200).json({ email: u.email, nome: u.nome, papel: u.papel });
  } catch (err) {
    console.error('api/me', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
