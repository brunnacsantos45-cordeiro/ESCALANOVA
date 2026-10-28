import { db } from '../lib/db.js';
import { usuarioDaRequisicao } from '../lib/auth.js';

// Estado do app (professores, escalas...) compartilhado por todos os logins ativos.
// O middleware já exige sessão; aqui conferimos de novo no banco (usuário ativo).
// "grupo" permite, no futuro, separar os dados por equipe sem mudar a estrutura.
//
// Edição simultânea: cada gravação informa a "rev" (versão) em que se baseou. Se o banco já
// estiver numa versão mais nova, nada é gravado e a resposta é 409 com o estado atual; o app
// mescla as alterações das duas pontas e tenta de novo (veja merge.js).
const GRUPO = 'ibk-kids';
const LIMITE_BYTES = 2_000_000;

const iso = (t) => new Date(t).toISOString();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const usuario = await usuarioDaRequisicao(req);
    if (!usuario) return res.status(401).json({ erro: 'Não autenticado.' });
    const sql = await db();

    if (req.method === 'GET') {
      const [l] = await sql`SELECT dados, rev, atualizado_em FROM app_state WHERE grupo = ${GRUPO}`;
      if (!l) return res.status(200).json({ dados: null, rev: 0, atualizado_em: null });
      return res.status(200).json({ dados: l.dados, rev: l.rev, atualizado_em: iso(l.atualizado_em) });
    }

    if (req.method === 'PUT') {
      const dados = req.body?.dados;
      const rev = Number.isInteger(req.body?.rev) ? req.body.rev : 0;
      if (!dados || !Array.isArray(dados.professores) || !Array.isArray(dados.escala)) {
        return res.status(400).json({ erro: 'Dados inválidos.' });
      }
      const texto = JSON.stringify(dados);
      if (texto.length > LIMITE_BYTES) return res.status(413).json({ erro: 'Dados grandes demais.' });

      let gravado;
      if (rev === 0) {
        // primeira gravação: só entra se ainda não existe linha
        gravado = await sql`
          INSERT INTO app_state (grupo, dados, atualizado_em, atualizado_por, rev)
          VALUES (${GRUPO}, ${texto}::jsonb, now(), ${usuario.email}, 1)
          ON CONFLICT (grupo) DO NOTHING
          RETURNING rev, atualizado_em`;
      } else {
        // só atualiza se ninguém gravou depois da versão em que o app se baseou
        gravado = await sql`
          UPDATE app_state
             SET dados = ${texto}::jsonb, atualizado_em = now(), atualizado_por = ${usuario.email}, rev = rev + 1
           WHERE grupo = ${GRUPO} AND rev = ${rev}
          RETURNING rev, atualizado_em`;
      }
      if (gravado.length === 0) {
        const [atual] = await sql`SELECT dados, rev, atualizado_em FROM app_state WHERE grupo = ${GRUPO}`;
        return res.status(409).json({
          conflito: true,
          dados: atual?.dados ?? null,
          rev: atual?.rev ?? 0,
          atualizado_em: atual ? iso(atual.atualizado_em) : null,
        });
      }
      return res.status(200).json({ ok: true, rev: gravado[0].rev, atualizado_em: iso(gravado[0].atualizado_em) });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    console.error('api/state', err?.message);
    return res.status(500).json({ erro: 'Erro ao acessar o banco.' });
  }
}
