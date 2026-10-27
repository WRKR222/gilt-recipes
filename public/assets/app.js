/* Shared helpers for The Gilt Recipes (public pages + admin). */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var G = window.Gilt = {};
  G.WA = '254722104932';               // WhatsApp / order line from the Instagram bio
  G.CUTS = {          // same keys and order as netlify/lib/shared.mjs; order follows the pig, nose to tail
    head: 'Head', jowl: 'Jowl', neck: 'Neck', shoulder: 'Shoulder', picnic: 'Picnic', backfat: 'Back Fat',
    loin: 'Loin & Chops', ribs: 'Ribs', belly: 'Belly & Bacon', leg: 'Leg & Ham', trotters: 'Hocks & Trotters',
  };
  G.SHORT = {
    head: 'Head', jowl: 'Jowl', neck: 'Neck', shoulder: 'Shoulder', picnic: 'Picnic', backfat: 'Back Fat',
    loin: 'Loin', ribs: 'Ribs', belly: 'Belly', leg: 'Leg', trotters: 'Hocks',
  };

  G.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---- storage that never throws ----
  var mem = {};
  G.get = function (k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } };
  G.set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } };

  G.uid = function () {
    var id = G.get('gilt_uid');
    if (!id || !/^[a-z0-9]{12,40}$/.test(id)) {
      var a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      id = Array.prototype.map.call(a, function (b) { return (b % 36).toString(36); }).join('') + Date.now().toString(36);
      id = id.slice(0, 24);
      G.set('gilt_uid', id);
    }
    return id;
  };

  // ---- "since your last visit" ----
  // the previous visit is pinned for the whole browser session, so moving between pages keeps the markers
  G.lastVisit = (function () {
    var prev;
    try {
      prev = sessionStorage.getItem('gilt_prev');
      if (prev === null) { prev = G.get('gilt_last_visit') || ''; sessionStorage.setItem('gilt_prev', prev); }
    } catch (e) { prev = G.get('gilt_last_visit') || ''; }
    G.set('gilt_last_visit', new Date().toISOString());
    return prev || null;
  })();

  // Single-file build (window.GILT_SINGLE): recipe links use #/r/<slug>; without the Netlify API the
  // page runs in preview mode (likes/comments/ratings saved on this device only).
  G.SINGLE = !!window.GILT_SINGLE;
  G.home = function () { return G.SINGLE ? location.pathname : '/'; };
  G.link = function (slug) { return (G.SINGLE ? '#/r/' : '/r/') + encodeURIComponent(slug); };
  G.cutLink = function (cut) { return G.home() + '?cut=' + encodeURIComponent(cut) + '#recipes'; };

  G.api = function (path, opts) {
    if (G.SINGLE) return G.backend.then(function (live) { return live ? G.realApi(path, opts) : G.mockApi(path, opts || {}); });
    return G.realApi(path, opts);
  };
  G.realApi = function (path, opts) {
    opts = opts || {};
    var headers = { 'content-type': 'application/json' };
    if (opts.key) headers['x-admin-key'] = opts.key;
    return fetch(path, {
      method: opts.method || 'GET', headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || ('Request failed (' + r.status + ')')); e.status = r.status; throw e; }
        return d;
      });
    });
  };

  G.date = function (iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  G.ago = function (iso) {
    var s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return G.date(iso);
  };
  G.mins = function (m) {
    m = +m || 0;
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  };

  /** New = first published in the last 14 days. Updated = changed (not a silent fix) in the last 45 days. */
  G.stamp = function (r) {
    var now = Date.now(), c = new Date(r.createdAt).getTime(), u = new Date(r.updatedAt).getTime();
    var since = G.lastVisit && u > new Date(G.lastVisit).getTime();
    if (u - c < 3600e3 && now - c < 14 * 864e5) return { cls: 'new', text: 'New', since: since };
    if (u - c >= 3600e3 && now - u < 45 * 864e5) return { cls: 'upd', text: 'Updated ' + G.date(r.updatedAt).replace(/ \d{4}$/, ''), since: since };
    return null;
  };
  G.stampHTML = function (r) {
    var s = G.stamp(r);
    return s ? '<span class="stamp ' + s.cls + (s.since ? ' since' : '') + '"' + (s.since ? ' title="Changed since your last visit"' : '') + '>' + G.esc(s.text) + '</span>' : '';
  };

  G.img = function (key) { return key ? '/api/img?k=' + encodeURIComponent(key) : ''; };

  G.waLink = function (text) { return 'https://wa.me/' + G.WA + '?text=' + encodeURIComponent(text); };

  // line pig (logo-style) used for icons and photo slots
  G.PIG = '<svg viewBox="80 40 540 270" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M118 168C112 112 162 78 240 74L372 72C410 72 438 80 458 92L470 62C473 54 482 54 486 60L506 104C528 116 548 132 566 146L590 148C600 150 604 162 600 176C597 186 590 190 580 190L560 190C546 206 524 218 500 224C486 232 470 238 456 242L452 296L428 296L424 252C380 260 330 262 280 260C250 259 226 256 206 252L200 296L176 296L170 240C140 228 122 204 118 168Z"/><path d="M118 160C98 156 88 140 98 128C106 120 118 128 110 138"/></svg>';
  G.slot = function (label) {
    return '<div class="slot" role="img" aria-label="Photo coming soon">' + G.PIG + '<span>' + G.esc(label || 'Photo slot') + '</span></div>';
  };
  G.photo = function (r, alt) {
    return r.image ? '<img src="' + G.img(r.image) + '" alt="' + G.esc(alt || r.title) + '">' : G.slot('Photo slot');
  };

  G.toast = function (msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  G.STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  G.HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg>';
  G.CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>';
  G.CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  /** Star picker: calls onPick(n). Returns {set(n)}. */
  G.stars = function (el, value, onPick) {
    el.classList.add('stars');
    el.setAttribute('role', 'radiogroup');
    el.innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" role="radio" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '" data-n="' + n + '">' + G.STAR + '</button>';
    }).join('');
    function set(v) {
      value = v;
      el.querySelectorAll('button').forEach(function (b) {
        var n = +b.dataset.n; b.classList.toggle('on', n <= v); b.setAttribute('aria-checked', String(n === v));
      });
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      set(+b.dataset.n); if (onPick) onPick(value);
    });
    set(value || 0);
    return { set: set, get: function () { return value; } };
  };

  /** Private feedback form (home page + recipe page). */
  G.feedbackForm = function (form, slug) {
    var picker = G.stars(form.querySelector('[data-stars]'), 0);
    var msg = form.querySelector('.msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      var body = {
        slug: slug || '', stars: picker.get(),
        name: form.querySelector('[name=name]').value,
        contact: form.querySelector('[name=contact]').value,
        message: form.querySelector('[name=message]').value,
        website: form.querySelector('[name=website]').value,
      };
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sending…';
      G.api('/api/feedback', { method: 'POST', body: body }).then(function () {
        form.reset(); picker.set(0);
        msg.className = 'msg ok'; msg.textContent = 'Thank you! The owner reads every note.';
      }).catch(function (err) {
        msg.className = 'msg err'; msg.textContent = err.message;
      }).then(function () { btn.disabled = false; });
    });
  };

  /** Reveal below-the-fold blocks. */
  G.reveal = function () {
    var els = document.querySelectorAll('.rv:not(.seen-in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('seen-in'); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('seen-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) {
      if (e.getBoundingClientRect().top < innerHeight) e.classList.add('seen-in'); else io.observe(e);
    });
  };

  G.year = function () { document.querySelectorAll('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); }); };
  document.addEventListener('DOMContentLoaded', G.year);
})();
