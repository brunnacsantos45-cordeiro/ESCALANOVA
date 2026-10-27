import { COOKIE } from '../lib/session.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  res.redirect(303, '/login.html');
}
