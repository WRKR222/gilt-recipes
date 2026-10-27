/* Single-file build only. Uses the live Netlify API when the page is served next to it;
   otherwise (opened as a file or hosted without functions) runs a preview backend that keeps
   likes, ratings, comments and feedback in this browser only. */
(function () {
  'use strict';
  var G = window.Gilt, KEY = 'gilt_preview_db';

  G.backend = (/^https?:$/.test(location.protocol)
    ? fetch('/api/recipes', { headers: { accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return !!(d && Array.isArray(d.recipes)); })
        .catch(function () { return false; })
    : Promise.resolve(false)
  ).then(function (live) {
    G.preview = !live;
    if (!live) document.documentElement.classList.add('preview');
    return live;
  });

  function db() {
    var d = null;
    try { d = JSON.parse(G.get(KEY) || 'null'); } catch (e) { d = null; }
    return d || { likes: {}, ratings: {}, comments: {}, feedback: [] };
  }
  function save(d) { G.set(KEY, JSON.stringify(d)); }
  function err(msg, status) { var e = new Error(msg); e.status = status || 400; return Promise.reject(e); }
  var recipes = (window.GILT_SEED || []).slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
  function find(slug) { return recipes.filter(function (r) { return r.slug === slug; })[0]; }
  function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); }

  G.mockApi = function (path, opts) {
    var u = new URL(path, 'https://x.local'), q = u.searchParams, method = opts.method || 'GET', body = opts.body || {}, d = db();
    if (u.pathname === '/api/recipes') {
      if (q.get('slug')) { var r = find(q.get('slug')); return r ? Promise.resolve({ recipe: r }) : err('Recipe not found', 404); }
      return Promise.resolve({ recipes: recipes.map(function (r) { return Object.assign({ lastNote: '' }, r); }) });
    }
    if (u.pathname === '/api/engage') {
      if (method === 'GET' && q.get('counts')) {
        var likes = {}, com = {};
        Object.keys(d.likes).forEach(function (s) { likes[s] = Object.keys(d.likes[s]).length; });
        Object.keys(d.comments).forEach(function (s) { com[s] = d.comments[s].length; });
        return Promise.resolve({ likes: likes, comments: com });
      }
      var slug = method === 'GET' ? q.get('slug') : body.slug, uid = method === 'GET' ? q.get('uid') : body.uid;
      if (!find(slug)) return err('Recipe not found', 404);
      d.likes[slug] = d.likes[slug] || {}; d.ratings[slug] = d.ratings[slug] || {}; d.comments[slug] = d.comments[slug] || [];
      if (method === 'GET') {
        var stars = Object.keys(d.ratings[slug]).map(function (k) { return d.ratings[slug][k]; });
        return Promise.resolve({
          likes: Object.keys(d.likes[slug]).length, liked: !!d.likes[slug][uid], comments: d.comments[slug],
          rating: { count: stars.length, avg: stars.length ? Math.round(stars.reduce(function (a, b) { return a + b; }, 0) / stars.length * 10) / 10 : 0, mine: d.ratings[slug][uid] || 0 },
        });
      }
      if (body.action === 'like' || body.action === 'unlike') {
        if (body.action === 'like') d.likes[slug][uid] = 1; else delete d.likes[slug][uid];
        save(d); return Promise.resolve({ likes: Object.keys(d.likes[slug]).length, liked: body.action === 'like' });
      }
      if (body.action === 'rate') {
        var n = Math.round(+body.stars); if (!(n >= 1 && n <= 5)) return err('Stars must be 1 to 5');
        d.ratings[slug][uid] = n; save(d); return Promise.resolve({ ok: true });
      }
      if (body.action === 'comment') {
        if (body.website) return Promise.resolve({ ok: true });
        var text = clean(body.text, 1000); if (text.length < 2) return err('Write a comment first');
        var c = { id: Date.now() + '-local', name: clean(body.name, 40) || 'Guest', text: text, at: new Date().toISOString() };
        d.comments[slug].push(c); save(d); return Promise.resolve({ comment: c });
      }
      return err('Unknown action');
    }
    if (u.pathname === '/api/feedback' && method === 'POST') {
      if (clean(body.message, 2000).length < 3) return err('Tell us a little more');
      d.feedback.push({ at: new Date().toISOString(), message: clean(body.message, 2000) }); save(d);
      return Promise.resolve({ ok: true });
    }
    return err('Not available in preview', 404);
  };
})();
