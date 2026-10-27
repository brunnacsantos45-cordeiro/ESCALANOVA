// Define a senha de login SEM que ela apareça em tela, no Git ou em logs.
// Uso: npm run set-password   (na pasta do projeto, com a Vercel CLI logada na conta certa)
// Gera o hash scrypt e grava ADMIN_PASSWORD_HASH e SESSION_SECRET na Vercel (Production).
import { randomBytes, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { createInterface } from 'node:readline';

let mudo = false;
const rl = createInterface({
  input: process.stdin,
  output: new (await import('node:stream')).Writable({
    write(chunk, _enc, cb) { if (!mudo) process.stdout.write(chunk); cb(); },
  }),
  terminal: true,
});

function perguntar(texto, secreto) {
  return new Promise((resolve) => {
    mudo = false;
    rl.question(texto, (r) => { mudo = false; if (secreto) process.stdout.write('\n'); resolve(r); });
    mudo = secreto; // o prompt já foi escrito; daqui em diante o que se digita não é exibido
  });
}
const pedirTexto = (t) => perguntar(t, false);
const pedirSenha = (t) => perguntar(t, true);

function vercelEnv(nome, valor) {
  spawnSync('npx', ['vercel', 'env', 'rm', nome, 'production', '--yes'], { shell: true, stdio: 'ignore' });
  const r = spawnSync('npx', ['vercel', 'env', 'add', nome, 'production', '--sensitive'], {
    shell: true, input: valor, stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) { console.error(`Falha ao gravar ${nome}.`); process.exit(1); }
}

const email = (await pedirTexto('E-mail de login: ')).trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('E-mail inválido.'); process.exit(1); }
const s1 = await pedirSenha('Nova senha (mín. 10 caracteres): ');
if (s1.length < 10) { console.error('Senha curta demais.'); process.exit(1); }
const s2 = await pedirSenha('Repita a senha: ');
if (s1 !== s2) { console.error('As senhas não conferem.'); process.exit(1); }

const salt = randomBytes(16);
const hash = scryptSync(s1, salt, 32);
vercelEnv('ADMIN_EMAIL', email);
vercelEnv('ADMIN_PASSWORD_HASH', `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
vercelEnv('SESSION_SECRET', randomBytes(32).toString('hex')); // renova: encerra sessões antigas
rl.close();
console.log('Senha atualizada. Faça um novo deploy (vercel --prod) para valer.');
