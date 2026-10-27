import { CUTS, SLUG_RE, store, json, bad, isAdmin, clean, cleanList, slugify, readJSON, listJSON } from '../lib/shared.mjs';
import seed from '../lib/seed.mjs';

const IMG_RE = /^[a-z0-9-]{6,60}\.(jpg|png|webp)$/;

async function ensureSeeded(st) {
  const meta = await st.get('meta/seeded', { type: 'json' }).catch(() => null);
  if (meta) return;
  const now = new Date().toISOString();
  await Promise.all(seed.map((r) => st.setJSON(`r/${r.slug}`, {
    ...r, image: '', published: true, starter: true, createdAt: now, updatedAt: now, editedAt: now, changelog: [],
  })));
  await st.setJSON('meta/seeded', { at: now });
}

const summary = (r) => ({
  slug: r.slug, title: r.title, cut: r.cut, intro: r.intro, image: r.image,
  prepMins: r.prepMins, cookMins: r.cookMins, serves: r.serves, published: r.published,
  createdAt: r.createdAt, updatedAt: r.updatedAt,
  lastNote: r.changelog && r.changelog.length ? r.changelog[r.changelog.length - 1].note : '',
});

function num(v, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
}

/** Validate an incoming recipe body. Returns [recipeFields, error]. */
function parse(body) {
  if (!body || typeof body !== 'object') return [null, 'Invalid JSON'];
  const title = clean(body.title, 140);
  if (title.length < 3) return [null, 'Title is required'];
  if (!CUTS[body.cut]) return [null, 'Pick a cut'];
  const ingredients = cleanList(body.ingredients, 60, 200);
  const steps = cleanList(body.steps, 40, 1200);
  if (!ingredients.length || !steps.length) return [null, 'Add at least one ingredient and one step'];
  const image = clean(body.image, 80);
  if (image && !IMG_RE.test(image)) return [null, 'Bad image reference'];
  return [{
    title, cut: body.cut, ingredients, steps, image,
    intro: clean(body.intro, 600), tip: clean(body.tip, 600),
    prepMins: num(body.prepMins, 2000), cookMins: num(body.cookMins, 2000), serves: num(body.serves, 100),
    published: body.published !== false,
  }, null];
}

export default async (req) => {
  const st = store('recipes');
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const admin = isAdmin(req);

  if (req.method === 'GET') {
    await ensureSeeded(st);
    if (slug) {
      if (!SLUG_RE.test(slug)) return bad('Bad slug');
      const r = await st.get(`r/${slug}`, { type: 'json' });
      if (!r || (!r.published && !admin)) return bad('Recipe not found', 404);
      return json({ recipe: r });
    }
    if (url.searchParams.get('all') && !admin) return bad('Unauthorized', 401);
    const all = await listJSON(st, 'r/');
    const list = all.filter((r) => admin || r.published)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return json({ recipes: admin ? list : list.map(summary), cuts: CUTS });
  }

  if (!admin) return bad('Unauthorized', 401);

  if (req.method === 'POST') {
    const body = await readJSON(req);
    const [fields, err] = parse(body);
    if (err) return bad(err);
    let base = slugify(fields.title), s = base, i = 2;
    while (await st.get(`r/${s}`)) s = `${base}-${i++}`;
    const now = new Date().toISOString();
    const recipe = { slug: s, ...fields, starter: false, createdAt: now, updatedAt: now, editedAt: now, changelog: [] };
    await st.setJSON(`r/${s}`, recipe);
    return json({ recipe }, 201);
  }

  if (req.method === 'PUT') {
    if (!slug || !SLUG_RE.test(slug)) return bad('Bad slug');
    const old = await st.get(`r/${slug}`, { type: 'json' });
    if (!old) return bad('Recipe not found', 404);
    const body = await readJSON(req);
    const [fields, err] = parse(body);
    if (err) return bad(err);
    const now = new Date().toISOString();
    const note = clean(body.note, 200);
    const silent = body.silent === true;           // small fixes don't announce an update
    const changelog = [...(old.changelog || [])];
    if (!silent) changelog.push({ at: now, note: note || 'Recipe updated' });
    const recipe = {
      ...old, ...fields, starter: false,
      updatedAt: silent ? old.updatedAt : now, editedAt: now, changelog: changelog.slice(-30),
    };
    // a draft being published for the first time counts as new
    if (!old.published && fields.published) { recipe.createdAt = now; recipe.updatedAt = now; recipe.changelog = []; }
    await st.setJSON(`r/${slug}`, recipe);
    return json({ recipe });
  }

  if (req.method === 'DELETE') {
    if (!slug || !SLUG_RE.test(slug)) return bad('Bad slug');
    await st.delete(`r/${slug}`);
    return json({ ok: true });
  }

  return bad('Method not allowed', 405);
};

export const config = { path: '/api/recipes' };
