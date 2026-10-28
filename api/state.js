import { neon } from '@neondatabase/serverless';
import { COOKIE, lerCookie, tokenValido } from '../lib/session.js';

// Estado do app (professores, escalas...) guardado no Postgres e compartilhado por todos os
// aparelhos logados. O middleware já exige login; aqui conferimos de novo (defesa em profundidade).
// A coluna "grupo" permite, no futuro, separar dados por usuário/equipe sem mudar a estrutura.
const GRUPO = 'ibk-kids';
const LIMITE_BYTES = 2_000_000;

let sql;
let tabelaPronta = false;

async function preparar() {
  sql ??= neon(process.env.DATABASE_URL);
  if (tabelaPronta) return;
  await sql`CREATE TABLE IF NOT EXISTS app_state (
    grupo text PRIMARY KEY,
    dados jsonb NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_por text
  )`;
  tabelaPronta = true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const token = lerCookie(req.headers.cookie, COOKIE);
  if (!(await tokenValido(token, email, process.env.SESSION_SECRET))) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ erro: 'Banco de dados não configurado.' });
  }

  try {
    await preparar();

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
        VALUES (${GRUPO}, ${texto}::jsonb, now(), ${email})
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
