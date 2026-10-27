(function () {
  'use strict';
  var G = window.Gilt, $ = function (s) { return document.querySelector(s); };
  document.querySelectorAll('.pig-ico').forEach(function (e) { e.innerHTML = G.PIG; });
  $('#likeBtn .h').innerHTML = G.HEART;

  var m = G.SINGLE ? location.hash.match(/^#\/r\/([a-z0-9-]+)/) : location.pathname.match(/^\/r\/([a-z0-9-]+)\/?$/);
  var slug = m ? m[1] : new URLSearchParams(location.search).get('r');
  var uid = G.uid(), recipe = null;

  function fail() { $('#loading').hidden = true; $('#notFound').hidden = false; document.title = 'Recipe not found · The Gilt Recipes'; }
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return fail();

  function render(r) {
    recipe = r;
    var cut = G.CUTS[r.cut] || r.cut;
    document.title = r.title + ' · The Gilt Recipes';
    var md = document.querySelector('meta[name=description]'); if (md) md.content = r.intro || r.title;
    $('#cutLink').textContent = cut; $('#cutLink').href = G.cutLink(r.cut);
    $('#cutGiant').textContent = G.SHORT[r.cut] || cut;
    $('#stampWrap').innerHTML = G.stampHTML(r);
    $('#title').textContent = r.title;
    $('#intro').textContent = r.intro || '';

    var upd = r.updatedAt !== r.createdAt && r.changelog && r.changelog.length;
    var last = upd ? r.changelog[r.changelog.length - 1] : null;
    $('#updated').innerHTML = upd
      ? '<span>Last updated <b>' + G.esc(G.date(r.updatedAt)) + '</b></span>' + (last && last.note ? '<i>“' + G.esc(last.note) + '”</i>' : '')
      : '<span>Added <b>' + G.esc(G.date(r.createdAt)) + '</b></span>';

    $('#photo').innerHTML = G.photo(r, r.title);
    var facts = [['Prep', G.mins(r.prepMins)], ['Cook', G.mins(r.cookMins)]];
    if (r.serves) facts.push(['Serves', r.serves]);
    facts.push(['Cut', cut]);
    $('#facts').innerHTML = facts.map(function (f) { return '<div><span class="lbl" style="color:var(--muted)">' + G.esc(f[0]) + '</span><b>' + G.esc(f[1]) + '</b></div>'; }).join('');

    // ingredients: ticks are remembered per recipe on this device
    var tickKey = 'gilt_ticks_' + r.slug, ticks = {};
    try { ticks = JSON.parse(G.get(tickKey) || '{}') || {}; } catch (e) { ticks = {}; }
    $('#ingredients').innerHTML = r.ingredients.map(function (t, i) {
      return '<li><label><input type="checkbox" data-i="' + i + '"' + (ticks[i] ? ' checked' : '') + '><span>' + G.esc(t) + '</span></label></li>';
    }).join('');
    $('#ingredients').addEventListener('change', function (e) {
      if (!e.target.dataset) return; ticks[e.target.dataset.i] = e.target.checked; G.set(tickKey, JSON.stringify(ticks));
    });
    $('#steps').innerHTML = r.steps.map(function (s) { return '<li><p style="margin:0">' + G.esc(s) + '</p></li>'; }).join('');
    if (r.tip) { $('#tipText').textContent = r.tip; $('#tip').hidden = false; }

    $('#orderH').textContent = 'Order ' + (G.SHORT[r.cut] || cut).toLowerCase() + ' for this recipe';
    var wa = G.waLink("Hi The Gilt, I'd like to order " + cut.toLowerCase() + ' for the "' + r.title + '" recipe.');
    $('#orderBtn').href = wa; $('#hdOrder').href = wa;

    if (r.changelog && r.changelog.length) {
      $('#historyList').innerHTML = r.changelog.slice().reverse().map(function (c) {
        return '<li><b>' + G.esc(G.date(c.at)) + '</b>: ' + G.esc(c.note) + '</li>';
      }).join('') + '<li><b>' + G.esc(G.date(r.createdAt)) + '</b>: First published</li>';
      $('#history').hidden = false;
    }
    $('#loading').hidden = true; $('#recipe').hidden = false;
  }

  // ---------- engagement ----------
  var rater;
  function renderEngage(d) {
    setLike(d.likes, d.liked);
    rater.set(d.rating.mine || 0);
    $('#rateLbl').textContent = d.rating.count
      ? d.rating.avg.toFixed(1) + ' ★ from ' + d.rating.count + ' cook' + (d.rating.count > 1 ? 's' : '') + (d.rating.mine ? ' · thanks!' : '')
      : 'Cooked it? Rate it';
    renderComments(d.comments);
  }
  function setLike(n, on) {
    $('#likeN').textContent = n;
    $('#likeBtn').setAttribute('aria-pressed', String(!!on));
  }
  function renderComments(list) {
    $('#cN').textContent = list.length ? '(' + list.length + ')' : '';
    $('#cEmpty').hidden = !!list.length;
    $('#cList').innerHTML = list.map(function (c) {
      return '<li><div class="who"><span>' + G.esc(c.name) + '</span><time datetime="' + G.esc(c.at) + '">' + G.esc(G.ago(c.at)) + '</time></div><p>' + G.esc(c.text) + '</p></li>';
    }).join('');
  }
  function loadEngage() {
    return G.api('/api/engage?slug=' + encodeURIComponent(slug) + '&uid=' + uid).then(renderEngage).catch(function () {});
  }

  rater = G.stars($('#rateStars'), 0, function (n) {
    G.api('/api/engage', { method: 'POST', body: { slug: slug, uid: uid, action: 'rate', stars: n } })
      .then(function () { G.toast('Thanks for rating!'); loadEngage(); })
      .catch(function (e) { G.toast(e.message); });
  });

  var liking = false;
  $('#likeBtn').addEventListener('click', function () {
    if (liking) return; liking = true;
    var on = $('#likeBtn').getAttribute('aria-pressed') !== 'true', n = +$('#likeN').textContent;
    setLike(Math.max(0, n + (on ? 1 : -1)), on);                      // optimistic
    G.api('/api/engage', { method: 'POST', body: { slug: slug, uid: uid, action: on ? 'like' : 'unlike' } })
      .then(function (d) { setLike(d.likes, d.liked); })
      .catch(function (e) { setLike(n, !on); G.toast(e.message); })
      .then(function () { liking = false; });
  });

  $('#cForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, msg = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]');
    var name = (f.querySelector('[name=name]').value || '').trim().replace(/\.+$/, '');
    var text = f.querySelector('[name=text]').value.trim();
    if (text.length < 2) { msg.className = 'msg err'; msg.textContent = 'Write a comment first.'; return; }
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Posting…';
    G.api('/api/engage', { method: 'POST', body: { slug: slug, uid: uid, action: 'comment', name: name, text: text, website: f.querySelector('[name=website]').value } })
      .then(function () {
        f.querySelector('[name=text]').value = '';
        G.set('gilt_name', name);
        msg.className = 'msg ok'; msg.textContent = 'Posted. Thank you!';
        return loadEngage();
      })
      .catch(function (err) { msg.className = 'msg err'; msg.textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
  $('#cName').value = G.get('gilt_name') || '';

  G.feedbackForm($('#fbForm'), slug);

  $('#shareBtn').addEventListener('click', function () {
    var data = { title: recipe ? recipe.title : 'The Gilt Recipes', text: 'A recipe from The Gilt Butchery', url: location.href };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject())
      .then(function () { G.toast('Link copied'); })
      .catch(function () { G.toast(location.href); });
  });

  G.api('/api/recipes?slug=' + encodeURIComponent(slug))
    .then(function (d) { render(d.recipe); return loadEngage(); })
    .catch(fail);
})();
