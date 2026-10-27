// Formulário local (só 127.0.0.1) para definir e-mail e senha de login do ESCALANOVA.
// A senha é recebida aqui, vira hash scrypt e vai direto para a Vercel; nunca é gravada em disco.
// Uso: node scripts/set-login-web.mjs   (a pasta precisa estar ligada ao projeto Vercel certo)
import { createServer } from 'node:http';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const token = randomBytes(16).toString('hex');
const PORTA = 4789;

function vercelEnv(nome, valor) {
  spawnSync('npx', ['vercel', 'env', 'rm', nome, 'production', '--yes'], { shell: true, stdio: 'ignore' });
  const r = spawnSync('npx', ['vercel', 'env', 'add', nome, 'production', '--sensitive'], {
    shell: true, input: valor, stdio: ['pipe', 'ignore', 'inherit'],
  });
  return r.status === 0;
}

const pagina = `<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Definir login</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;max-width:380px;margin:40px auto;padding:0 16px}
label{display:block;margin:14px 0 4px;font-weight:600}input{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font:inherit;box-sizing:border-box}
button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:8px;background:#FF7A00;color:#fff;font:inherit;font-weight:600;cursor:pointer}
#m{margin-top:14px;min-height:20px}</style>
<h2>Definir login do ESCALANOVA</h2>
<form id="f"><label>E-mail</label><input id="e" type="email" required autocomplete="username">
<label>Senha (mín. 10 caracteres)</label><input id="s" type="password" minlength="10" required autocomplete="new-password">
<label>Repita a senha</label><input id="r" type="password" minlength="10" required autocomplete="new-password">
<button id="b">Salvar</button><div id="m"></div></form>
<script>
f.onsubmit=async(ev)=>{ev.preventDefault();m.textContent='';
 if(s.value!==r.value){m.textContent='As senhas não conferem.';return}
 b.disabled=true;m.textContent='Salvando na Vercel… (leva alguns segundos)';
 const x=await fetch('/salvar?t=${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e.value,senha:s.value})});
 const d=await x.json();m.textContent=d.msg;if(!d.ok)b.disabled=false;};
</script></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  if (url.searchParams.get('t') !== token) { res.writeHead(403).end('Acesso negado'); return; }
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(pagina); return; }
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    const responder = (ok, msg) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok, msg }));
    let d;
    try { d = JSON.parse(corpo); } catch { return responder(false, 'Requisição inválida.'); }
    const email = String(d.email || '').trim().toLowerCase();
    const senha = String(d.senha || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return responder(false, 'E-mail inválido.');
    if (senha.length < 10) return responder(false, 'Senha curta demais.');
    const salt = randomBytes(16);
    const hash = scryptSync(senha, salt, 32);
    const ok = vercelEnv('ADMIN_EMAIL', email)
      && vercelEnv('ADMIN_PASSWORD_HASH', `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`)
      && vercelEnv('SESSION_SECRET', randomBytes(32).toString('hex'));
    responder(ok, ok ? 'Pronto! Login salvo. Pode fechar esta página.' : 'Falha ao gravar na Vercel. Veja o terminal.');
    if (ok) setTimeout(() => process.exit(0), 500);
  });
});

server.listen(PORTA, '127.0.0.1', () => {
  console.log(`Abra: http://127.0.0.1:${PORTA}/?t=${token}`);
});
setTimeout(() => process.exit(1), 15 * 60 * 1000); // expira em 15 min
