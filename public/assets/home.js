(function () {
  'use strict';
  var G = window.Gilt, $ = function (s) { return document.querySelector(s); };
  var recipes = [], counts = { likes: {}, comments: {} }, current = 'all';

  document.querySelectorAll('.pig-ico, .hero-pig').forEach(function (e) { e.innerHTML = G.PIG; });

  // Welcome people who scanned the pack QR, then tidy the address bar
  var params = new URLSearchParams(location.search);
  if (params.get('src') === 'qr') {
    $('#qrHi').hidden = false;
    params.delete('src');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }
  if (G.CUTS[params.get('cut')]) current = params.get('cut');

  $('#hdOrder').href = G.waLink("Hi The Gilt, I'd like to place an order.");
  G.feedbackForm($('#fbForm'));

  function card(r, i) {
    var likes = counts.likes[r.slug] || 0, com = counts.comments[r.slug] || 0;
    return '<a class="card rv" href="' + G.link(r.slug) + '">' +
      '<div class="ph">' + G.photo(r) +
        '<div class="stamps">' + G.stampHTML(r) + '</div>' +
        '<div class="oval" aria-hidden="true"><div><small>The Gilt</small><b>' + G.esc(G.SHORT[r.cut] || r.cut) + '</b></div></div>' +
      '</div>' +
      '<h3>' + G.esc(r.title) + '</h3>' +
      '<p>' + G.esc(r.intro) + '</p>' +
      '<div class="meta">' +
        '<span>' + G.CLOCK + G.esc(G.mins((+r.prepMins || 0) + (+r.cookMins || 0))) + '</span>' +
        (r.serves ? '<span>Serves ' + G.esc(r.serves) + '</span>' : '') +
        '<span aria-label="' + likes + ' likes">' + G.HEART + likes + '</span>' +
        '<span aria-label="' + com + ' comments">' + G.CHAT + com + '</span>' +
      '</div></a>';
  }

  function perCut() {
    var c = {}; recipes.forEach(function (r) { c[r.cut] = (c[r.cut] || 0) + 1; }); return c;
  }

  function renderChips() {
    var c = perCut();
    var html = '<button class="chip" type="button" data-cut="all" aria-pressed="' + (current === 'all') + '">All <span>' + recipes.length + '</span></button>';
    Object.keys(G.CUTS).forEach(function (k) {
      html += '<button class="chip" type="button" data-cut="' + k + '" aria-pressed="' + (current === k) + '"' + (c[k] ? '' : ' disabled') + '>' +
        G.esc(G.CUTS[k]) + ' <span>' + (c[k] || 0) + '</span></button>';
    });
    $('#chips').innerHTML = html;
    document.querySelectorAll('.pigchart .zone').forEach(function (z) {
      var k = z.dataset.cut, n = c[k] || 0, dup = z.hasAttribute('data-dup');   // the second hock is the same cut: one tab stop is enough
      z.classList.toggle('on', current === k);
      z.classList.toggle('empty', !n);
      z.setAttribute('tabindex', n && !dup ? '0' : '-1');
      z.setAttribute('role', 'button');
      if (dup) z.setAttribute('aria-hidden', 'true');
      z.setAttribute('aria-label', G.CUTS[k] + ': ' + (n ? n + ' recipe' + (n > 1 ? 's' : '') : 'recipes coming soon'));
      z.setAttribute('aria-pressed', String(current === k));
    });
    document.querySelectorAll('.pigchart .bd').forEach(function (b) {
      var n = c[b.dataset.n] || 0;
      b.classList.toggle('zero', !n);
      b.querySelector('text').textContent = n || '';
    });
  }

  function renderGrid() {
    var list = current === 'all' ? recipes : recipes.filter(function (r) { return r.cut === current; });
    $('#cutName').textContent = current === 'all' ? 'All cuts' : G.CUTS[current];
    $('#cutCount').textContent = list.length + ' recipe' + (list.length === 1 ? '' : 's') + (current === 'all' ? ' · newest first' : ' for this cut');
    $('#grid').innerHTML = list.length ? list.map(card).join('') :
      '<p class="empty-msg">No recipes for this cut yet. They are on the way. <a href="#feedback">Ask the owner for one.</a></p>';
    G.reveal();
  }

  function setCut(k, scroll) {
    current = G.CUTS[k] ? k : 'all';
    var p = new URLSearchParams(location.search);
    if (current === 'all') p.delete('cut'); else p.set('cut', current);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    renderChips(); renderGrid();
    if (scroll) $('#recipes').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.setCut = setCut;

  $('#chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (b && !b.disabled) setCut(b.dataset.cut, true);
  });
  document.querySelectorAll('.pigchart .zone').forEach(function (z) {
    function glow(on) {   // a cut that has two zones (the hocks) lights up together
      document.querySelectorAll('.pigchart .zone[data-cut="' + z.dataset.cut + '"]').forEach(function (o) { o.classList.toggle('hov', on); });
    }
    ['mouseenter', 'focus'].forEach(function (ev) { z.addEventListener(ev, function () { glow(true); }); });
    ['mouseleave', 'blur'].forEach(function (ev) { z.addEventListener(ev, function () { glow(false); }); });
    function go() { if (!z.classList.contains('empty')) setCut(z.dataset.cut === current ? 'all' : z.dataset.cut, true); }
    z.addEventListener('click', go);
    z.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  function renderFresh() {
    var list = recipes.filter(function (r) { return G.stamp(r); }).slice(0, 4);
    if (!list.length) list = recipes.slice(0, 4);
    $('#freshList').innerHTML = list.map(function (r) {
      var s = G.stamp(r), isUpd = s && s.cls === 'upd';
      return '<li><a href="' + G.link(r.slug) + '">' + (G.stampHTML(r) || '<span class="lbl" style="color:var(--muted)">' + G.esc(G.date(r.updatedAt)) + '</span>') +
        '<h3>' + G.esc(r.title) + '</h3>' +
        '<p class="note">' + G.esc(isUpd && r.lastNote ? r.lastNote : (G.CUTS[r.cut] || '') + ' · added ' + G.date(r.createdAt)) + '</p></a></li>';
    }).join('');
  }

  function renderNews() {
    if (!G.lastVisit) return;                         // first visit: nothing to compare with
    var since = new Date(G.lastVisit).getTime();
    var changed = recipes.filter(function (r) { return new Date(r.updatedAt).getTime() > since; });
    if (!changed.length) return;
    var nNew = changed.filter(function (r) { var s = G.stamp(r); return s && s.cls === 'new'; }).length;
    var nUpd = changed.length - nNew, parts = [];
    if (nNew) parts.push(nNew + ' new recipe' + (nNew > 1 ? 's' : ''));
    if (nUpd) parts.push(nUpd + ' updated');
    $('#newsIn').innerHTML = '<span>Since your last visit: ' + G.esc(parts.join(' and ')) + '.</span>' +
      '<a href="' + G.link(changed[0].slug) + '">See “' + G.esc(changed[0].title) + '” →</a>';
    $('#news').hidden = false;
  }

  function renderStats() {
    if (!recipes.length) return;
    var cuts = Object.keys(perCut()).length;
    $('#heroStats').innerHTML = '<span><b>' + recipes.length + '</b> recipes</span><span><b>' + cuts + '</b> cuts</span>' +
      '<span>Last updated <b>' + G.esc(G.date(recipes[0].updatedAt)) + '</b></span>';
  }

  Promise.all([
    G.api('/api/recipes'),
    G.api('/api/engage?counts=1').catch(function () { return { likes: {}, comments: {} }; }),
  ]).then(function (res) {
    recipes = res[0].recipes || []; counts = res[1];
    renderStats(); renderNews(); renderFresh(); renderChips(); renderGrid();
  }).catch(function () {
    $('#freshList').innerHTML = '<li><p class="empty-msg">Recipes could not load. Please refresh the page.</p></li>';
    renderChips(); renderGrid();
  }).then(function () {
    // tell the loading screen the page is ready (it lifts once its story has finished)
    window.__giltSiteReady = true;
    if (window.GiltLoader) window.GiltLoader.done();
  });

  G.reveal();
})();
