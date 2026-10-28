import { neon } from '@neondatabase/serverless';

let sql;
let pronto = false;

// Cria as tabelas na primeira chamada (IF NOT EXISTS: nunca apaga nem altera dados existentes).
export async function db() {
  sql ??= neon(process.env.DATABASE_URL);
  if (!pronto) {
    await sql`CREATE TABLE IF NOT EXISTS usuarios (
      id serial PRIMARY KEY,
      email text NOT NULL UNIQUE,
      nome text NOT NULL DEFAULT '',
      senha_hash text NOT NULL,
      papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'membro')),
      ativo boolean NOT NULL DEFAULT true,
      versao integer NOT NULL DEFAULT 1,
      criado_em timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_state (
      grupo text PRIMARY KEY,
      dados jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_por text
    )`;
    pronto = true;
  }
  return sql;
}
