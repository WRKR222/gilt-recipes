import { SLUG_RE, store, json, bad, isAdmin, clean, readJSON, listJSON, throttled } from '../lib/shared.mjs';

export default async (req, context) => {
  const st = store('feedback');

  if (req.method === 'GET') {
    if (!isAdmin(req)) return bad('Unauthorized', 401);
    const all = await listJSON(st, '');
    all.sort((a, b) => b.at.localeCompare(a.at));
    return json({ feedback: all.slice(0, 300) });
  }

  if (req.method === 'DELETE') {
    if (!isAdmin(req)) return bad('Unauthorized', 401);
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^\d{13}-[a-z0-9]{6}$/.test(id)) return bad('Bad id');
    await st.delete(id);
    return json({ ok: true });
  }

  if (req.method !== 'POST') return bad('Method not allowed', 405);
  const body = await readJSON(req);
  if (!body) return bad('Invalid JSON');
  if (body.website) return json({ ok: true });                 // honeypot
  const message = clean(body.message, 2000);
  if (message.length < 3) return bad('Tell us a little more');
  const stars = Math.round(Number(body.stars));
  const slug = SLUG_RE.test(String(body.slug || '')) ? body.slug : '';
  if (await throttled(context, 'feedback', 30)) return bad('Thanks! Please wait a moment before sending more', 429);
  const at = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
  await st.setJSON(id, {
    id, at, slug, message,
    name: clean(body.name, 60),
    contact: clean(body.contact, 80),
    stars: stars >= 1 && stars <= 5 ? stars : 0,
  });
  return json({ ok: true }, 201);
};

export const config = { path: '/api/feedback' };
