import { SLUG_RE, UID_RE, store, json, bad, isAdmin, clean, readJSON, listJSON, throttled } from '../lib/shared.mjs';

const ID_RE = /^\d{13}-[a-z0-9]{6}$/;

async function recipeExists(slug) {
  const r = await store('recipes').get(`r/${slug}`, { type: 'json' }).catch(() => null);
  return !!(r && r.published);
}

async function countByRecipe(st) {
  const { blobs } = await st.list();
  const out = {};
  for (const b of blobs) {
    const s = b.key.split('/')[0];
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

export default async (req, context) => {
  const url = new URL(req.url);
  const likes = store('likes'), comments = store('comments'), ratings = store('ratings');

  if (req.method === 'GET') {
    if (url.searchParams.get('counts')) {
      const [l, c] = await Promise.all([countByRecipe(likes), countByRecipe(comments)]);
      return json({ likes: l, comments: c });
    }
    if (url.searchParams.get('all')) {
      if (!isAdmin(req)) return bad('Unauthorized', 401);
      const all = await listJSON(comments, '');
      all.sort((a, b) => b.at.localeCompare(a.at));
      return json({ comments: all.slice(0, 200) });
    }
    const slug = url.searchParams.get('slug') || '';
    const uid = url.searchParams.get('uid') || '';
    if (!SLUG_RE.test(slug)) return bad('Bad slug');
    const [likeList, commentList, rateList] = await Promise.all([
      likes.list({ prefix: `${slug}/` }),
      listJSON(comments, `${slug}/`),
      listJSON(ratings, `${slug}/`),
    ]);
    const stars = rateList.map((r) => r.stars);
    const mine = UID_RE.test(uid) ? rateList.find((r) => r.uid === uid) : null;
    commentList.sort((a, b) => a.at.localeCompare(b.at));
    return json({
      likes: likeList.blobs.length,
      liked: UID_RE.test(uid) && likeList.blobs.some((b) => b.key === `${slug}/${uid}`),
      comments: commentList.map(({ id, name, text, at }) => ({ id, name, text, at })),
      rating: {
        count: stars.length,
        avg: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : 0,
        mine: mine ? mine.stars : 0,
      },
    });
  }

  if (req.method === 'DELETE') {
    if (!isAdmin(req)) return bad('Unauthorized', 401);
    const slug = url.searchParams.get('slug') || '', id = url.searchParams.get('id') || '';
    if (!SLUG_RE.test(slug) || !ID_RE.test(id)) return bad('Bad comment reference');
    await comments.delete(`${slug}/${id}`);
    return json({ ok: true });
  }

  if (req.method !== 'POST') return bad('Method not allowed', 405);

  const body = await readJSON(req);
  if (!body) return bad('Invalid JSON');
  const slug = String(body.slug || ''), uid = String(body.uid || '');
  if (!SLUG_RE.test(slug)) return bad('Bad slug');
  if (!(await recipeExists(slug))) return bad('Recipe not found', 404);

  if (body.action === 'like' || body.action === 'unlike') {
    if (!UID_RE.test(uid)) return bad('Bad visitor id');
    const key = `${slug}/${uid}`;
    if (body.action === 'like') await likes.setJSON(key, { at: new Date().toISOString() });
    else await likes.delete(key);
    const { blobs } = await likes.list({ prefix: `${slug}/` });
    return json({ likes: blobs.length, liked: body.action === 'like' });
  }

  if (body.action === 'rate') {
    if (!UID_RE.test(uid)) return bad('Bad visitor id');
    const stars = Math.round(Number(body.stars));
    if (!(stars >= 1 && stars <= 5)) return bad('Stars must be 1 to 5');
    await ratings.setJSON(`${slug}/${uid}`, { uid, stars, at: new Date().toISOString() });
    return json({ ok: true });
  }

  if (body.action === 'comment') {
    if (body.website) return json({ ok: true });            // honeypot: silently drop bots
    const name = clean(body.name, 40) || 'Guest';
    const text = clean(body.text, 1000);
    if (text.length < 2) return bad('Write a comment first');
    if (/https?:\/\/|www\./i.test(text) && (text.match(/https?:\/\/|www\./gi) || []).length > 1) return bad('Too many links');
    if (await throttled(context, 'comment', 20)) return bad('Please wait a few seconds before commenting again', 429);
    const at = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    const comment = { id, slug, name, text, at };
    await comments.setJSON(`${slug}/${id}`, comment);
    return json({ comment }, 201);
  }

  return bad('Unknown action');
};

export const config = { path: '/api/engage' };
