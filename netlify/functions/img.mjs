import { store, json, bad, isAdmin, readJSON } from '../lib/shared.mjs';

const KEY_RE = /^[a-z0-9-]{6,60}\.(jpg|png|webp)$/;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export default async (req) => {
  const st = store('images');
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const k = url.searchParams.get('k') || '';
    if (!KEY_RE.test(k)) return bad('Bad image key');
    const data = await st.get(k, { type: 'arrayBuffer' });
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(data, {
      headers: { 'content-type': TYPES[k.split('.').pop()], 'cache-control': 'public, max-age=31536000, immutable' },
    });
  }

  if (!isAdmin(req)) return bad('Unauthorized', 401);

  if (req.method === 'POST') {
    // body: { data: "data:image/jpeg;base64,..." }  (the admin page resizes to <= 1600px first)
    const body = await readJSON(req);
    const m = body && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.data || '');
    if (!m) return bad('Send a JPEG, PNG or WebP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4_000_000) return bad('Image too large (max 4 MB after resizing)');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await st.set(key, buf);
    return json({ key }, 201);
  }

  if (req.method === 'DELETE') {
    const k = url.searchParams.get('k') || '';
    if (!KEY_RE.test(k)) return bad('Bad image key');
    await st.delete(k);
    return json({ ok: true });
  }

  return bad('Method not allowed', 405);
};

export const config = { path: '/api/img' };
