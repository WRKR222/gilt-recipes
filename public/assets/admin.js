(function () {
  'use strict';
  var G = window.Gilt, $ = function (s) { return document.querySelector(s); };
  document.querySelectorAll('.pig-ico').forEach(function (e) { e.innerHTML = G.PIG; });

  var KEY_NAME = 'gilt_admin_key', key = '';
  try { key = sessionStorage.getItem(KEY_NAME) || ''; } catch (e) { key = ''; }
  var recipes = [], editing = null, imageKey = '';

  function api(path, opts) { opts = opts || {}; opts.key = key; return G.api(path, opts); }
  function titleOf(slug) { var r = recipes.find(function (x) { return x.slug === slug; }); return r ? r.title : slug; }

  // ---------- login ----------
  function enter() {
    return api('/api/recipes?all=1').then(function (d) {
      recipes = d.recipes || [];
      try { sessionStorage.setItem(KEY_NAME, key); } catch (e) { /* session only */ }
      $('#loginForm').hidden = true; $('#app').hidden = false; $('#logout').hidden = false;
      renderRecipes();
    });
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = e.target.querySelector('.msg');
    key = $('#key').value.trim();
    msg.className = 'msg'; msg.textContent = 'Checking…';
    enter().catch(function (err) {
      msg.className = 'msg err';
      msg.textContent = err.status === 401 ? 'That key is not right. Check ADMIN_KEY in Netlify.' : err.message;
    });
  });
  $('#logout').addEventListener('click', function () {
    try { sessionStorage.removeItem(KEY_NAME); } catch (e) { /* ignore */ }
    location.reload();
  });
  if (key) enter().catch(function () { key = ''; });

  // ---------- tabs ----------
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    showTab(b.dataset.tab);
  });
  function showTab(t) {
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === t)); });
    document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== t; });
    if (t === 'comments') loadComments();
    if (t === 'feedback') loadFeedback();
  }

  // ---------- recipes ----------
  $('#fCut').innerHTML = Object.keys(G.CUTS).map(function (k) { return '<option value="' + k + '">' + G.esc(G.CUTS[k]) + '</option>'; }).join('');

  function renderRecipes() {
    recipes.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    var pub = recipes.filter(function (r) { return r.published; }).length;
    $('#rCount').textContent = recipes.length + ' recipes · ' + pub + ' published · ' + (recipes.length - pub) + ' drafts';
    $('#rList').innerHTML = recipes.map(function (r) {
      return '<li><div><h3>' + G.esc(r.title) + '</h3><div class="sub">' +
        '<span>' + G.esc(G.CUTS[r.cut] || r.cut) + '</span>' +
        (r.published ? G.stampHTML(r) : '<span class="badge draft">Draft</span>') +
        (r.starter ? '<span class="badge" title="Written as a starting point. Edit it into your own recipe.">Starter recipe</span>' : '') +
        (r.image ? '' : '<span class="badge">No photo</span>') +
        '<span>Updated ' + G.esc(G.date(r.updatedAt)) + '</span></div></div>' +
        '<div class="acts">' +
        (r.published ? '<a class="sm" href="/r/' + encodeURIComponent(r.slug) + '" target="_blank" rel="noopener">View</a>' : '') +
        '<button class="sm" type="button" data-edit="' + G.esc(r.slug) + '">Edit</button>' +
        '<button class="sm del" type="button" data-del="' + G.esc(r.slug) + '">Delete</button></div></li>';
    }).join('') || '<li><p class="empty-msg">No recipes yet. Add your first one.</p></li>';
  }

  $('#rList').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openEditor(recipes.find(function (r) { return r.slug === ed.dataset.edit; }));
    if (del) {
      var slug = del.dataset.del;
      if (!confirm('Delete "' + titleOf(slug) + '"? This cannot be undone.')) return;
      api('/api/recipes?slug=' + encodeURIComponent(slug), { method: 'DELETE' }).then(function () {
        recipes = recipes.filter(function (r) { return r.slug !== slug; });
        renderRecipes(); G.toast('Recipe deleted');
      }).catch(function (err) { G.toast(err.message); });
    }
  });

  $('#newBtn').addEventListener('click', function () { openEditor(null); });
  $('#cancelBtn').addEventListener('click', function () { $('#editor').hidden = true; editing = null; });

  function setPreview() {
    $('#imgPrev').innerHTML = imageKey ? '<img src="' + G.img(imageKey) + '" alt="Recipe photo">' : G.slot('No photo yet');
    $('#imgRemove').hidden = !imageKey;
  }

  function openEditor(r) {
    editing = r;
    var f = function (id) { return $(id); };
    $('#edTitle').textContent = r ? 'Edit recipe' : 'New recipe';
    f('#fTitle').value = r ? r.title : '';
    f('#fCut').value = r ? r.cut : 'loin';
    f('#fPub').checked = r ? r.published : true;
    f('#fIntro').value = r ? r.intro : '';
    f('#fPrep').value = r ? r.prepMins : '';
    f('#fCook').value = r ? r.cookMins : '';
    f('#fServes').value = r ? r.serves : '';
    f('#fIngr').value = r ? r.ingredients.join('\n') : '';
    f('#fSteps').value = r ? r.steps.join('\n') : '';
    f('#fTip').value = r ? r.tip : '';
    f('#fNote').value = ''; f('#fSilent').checked = false;
    $('#changeBox').hidden = !(r && r.published);
    imageKey = r ? r.image : '';
    setPreview();
    $('#editor').querySelector('.msg').textContent = '';
    $('#editor').hidden = false;
    $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    f('#fTitle').focus({ preventScroll: true });
  }

  $('#imgRemove').addEventListener('click', function () { imageKey = ''; setPreview(); });

  // resize in the browser so uploads stay small on mobile data
  $('#fImg').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0]; if (!file) return;
    var msg = $('#editor').querySelector('.msg');
    msg.className = 'msg'; msg.textContent = 'Preparing photo…';
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      msg.textContent = 'Uploading photo…';
      api('/api/img', { method: 'POST', body: { data: c.toDataURL('image/jpeg', 0.84) } }).then(function (d) {
        imageKey = d.key; setPreview(); msg.className = 'msg ok'; msg.textContent = 'Photo ready. Save the recipe to keep it.';
      }).catch(function (err) { msg.className = 'msg err'; msg.textContent = err.message; });
      e.target.value = '';
    };
    img.onerror = function () { msg.className = 'msg err'; msg.textContent = 'That file could not be read as an image.'; };
    img.src = url;
  });

  $('#editor').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = e.target.querySelector('.msg'), btn = $('#saveBtn');
    var body = {
      title: $('#fTitle').value, cut: $('#fCut').value, published: $('#fPub').checked,
      intro: $('#fIntro').value, tip: $('#fTip').value,
      prepMins: $('#fPrep').value, cookMins: $('#fCook').value, serves: $('#fServes').value,
      ingredients: $('#fIngr').value.split('\n'), steps: $('#fSteps').value.split('\n'),
      image: imageKey, note: $('#fNote').value, silent: $('#fSilent').checked,
    };
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
    var req = editing
      ? api('/api/recipes?slug=' + encodeURIComponent(editing.slug), { method: 'PUT', body: body })
      : api('/api/recipes', { method: 'POST', body: body });
    req.then(function (d) {
      var r = d.recipe;
      recipes = recipes.filter(function (x) { return x.slug !== r.slug; }).concat(r);
      renderRecipes();
      $('#editor').hidden = true; editing = null;
      G.toast(body.silent ? 'Saved (no update notice)' : 'Saved. Customers will see it as ' + (G.stamp(r) ? G.stamp(r).text : 'published'));
    }).catch(function (err) { msg.className = 'msg err'; msg.textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });

  // ---------- comments ----------
  function loadComments() {
    $('#cList').innerHTML = '<li><p class="empty-msg">Loading…</p></li>';
    api('/api/engage?all=1').then(function (d) {
      $('#cList').innerHTML = d.comments.map(function (c) {
        return '<li><div><h3>' + G.esc(c.name) + ' <span class="hint" style="display:inline">on ' + G.esc(titleOf(c.slug)) + '</span></h3>' +
          '<p style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere">' + G.esc(c.text) + '</p><div class="sub">' + G.esc(G.ago(c.at)) + '</div></div>' +
          '<div class="acts"><a class="sm" href="/r/' + encodeURIComponent(c.slug) + '#talkH" target="_blank" rel="noopener">Reply</a>' +
          '<button class="sm del" type="button" data-slug="' + G.esc(c.slug) + '" data-id="' + G.esc(c.id) + '">Delete</button></div></li>';
      }).join('') || '<li><p class="empty-msg">No comments yet.</p></li>';
    }).catch(function (err) { $('#cList').innerHTML = '<li><p class="msg err">' + G.esc(err.message) + '</p></li>'; });
  }
  $('#cList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (!b || !confirm('Delete this comment?')) return;
    api('/api/engage?slug=' + encodeURIComponent(b.dataset.slug) + '&id=' + encodeURIComponent(b.dataset.id), { method: 'DELETE' })
      .then(function () { G.toast('Comment deleted'); loadComments(); }).catch(function (err) { G.toast(err.message); });
  });

  // ---------- feedback ----------
  function loadFeedback() {
    $('#fList').innerHTML = '<li><p class="empty-msg">Loading…</p></li>';
    api('/api/feedback').then(function (d) {
      $('#fList').innerHTML = d.feedback.map(function (f) {
        var who = [f.name, f.contact].filter(Boolean).join(' · ') || 'Anonymous';
        return '<li><div><h3>' + G.esc(who) + (f.stars ? ' <span class="stars-ro" aria-label="' + f.stars + ' stars">' + '★'.repeat(f.stars) + '</span>' : '') + '</h3>' +
          '<p style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere">' + G.esc(f.message) + '</p>' +
          '<div class="sub"><span>' + G.esc(G.ago(f.at)) + '</span>' + (f.slug ? '<span>About: ' + G.esc(titleOf(f.slug)) + '</span>' : '') + '</div></div>' +
          '<div class="acts"><button class="sm del" type="button" data-fid="' + G.esc(f.id) + '">Delete</button></div></li>';
      }).join('') || '<li><p class="empty-msg">No feedback yet.</p></li>';
    }).catch(function (err) { $('#fList').innerHTML = '<li><p class="msg err">' + G.esc(err.message) + '</p></li>'; });
  }
  $('#fList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fid]'); if (!b || !confirm('Delete this feedback?')) return;
    api('/api/feedback?id=' + encodeURIComponent(b.dataset.fid), { method: 'DELETE' })
      .then(function () { G.toast('Feedback deleted'); loadFeedback(); }).catch(function (err) { G.toast(err.message); });
  });

})();
