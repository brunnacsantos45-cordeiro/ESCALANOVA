import { db } from '../lib/db.js';
import { usuarioDaRequisicao } from '../lib/auth.js';

// Estado do app (professores, escalas...) compartilhado por todos os logins ativos.
// O middleware já exige sessão; aqui conferimos de novo no banco (usuário ativo).
// "grupo" permite, no futuro, separar os dados por equipe sem mudar a estrutura.
const GRUPO = 'ibk-kids';
const LIMITE_BYTES = 2_000_000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const usuario = await usuarioDaRequisicao(req);
    if (!usuario) return res.status(401).json({ erro: 'Não autenticado.' });
    const sql = await db();

    if (req.method === 'GET') {
      const linhas = await sql`SELECT dados, atualizado_em FROM app_state WHERE grupo = ${GRUPO}`;
      if (linhas.length === 0) return res.status(200).json({ dados: null, atualizado_em: null });
      return res.status(200).json({
        dados: linhas[0].dados,
        atualizado_em: new Date(linhas[0].atualizado_em).toISOString(),
      });
    }

    if (req.method === 'PUT') {
      const dados = req.body?.dados;
      if (!dados || !Array.isArray(dados.professores) || !Array.isArray(dados.escala)) {
        return res.status(400).json({ erro: 'Dados inválidos.' });
      }
      const texto = JSON.stringify(dados);
      if (texto.length > LIMITE_BYTES) return res.status(413).json({ erro: 'Dados grandes demais.' });
      const linhas = await sql`
        INSERT INTO app_state (grupo, dados, atualizado_em, atualizado_por)
        VALUES (${GRUPO}, ${texto}::jsonb, now(), ${usuario.email})
        ON CONFLICT (grupo) DO UPDATE
          SET dados = EXCLUDED.dados, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por
        RETURNING atualizado_em`;
      return res.status(200).json({ ok: true, atualizado_em: new Date(linhas[0].atualizado_em).toISOString() });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    console.error('api/state', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
