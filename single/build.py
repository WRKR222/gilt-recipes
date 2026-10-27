"""Build the single-file blog: one self-contained HTML (CSS, JS, starter recipes inlined).
Run from the project root:  python3 single/build.py  ->  dist/the-gilt-recipes.html"""
import base64, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
read = lambda *a: open(P(*a), encoding='utf-8').read()

index, recipe = read('public', 'index.html'), read('public', 'recipe.html')

def between(s, start, end, inclusive=False):
    a = s.index(start); b = s.index(end, a) + (len(end) if inclusive else 0)
    return s[a:b] if inclusive else s[a + len(start):b]

header = between(index, '<header class="hd">', '</header>', True)
loader_head = between(index, '<!--loader:head-->', '<!--/loader:head-->', True)
loader_body = between(index, '<!--loader:body-->', '<!--/loader:body-->', True)
loader_js = read('public', 'assets', 'loader.js')
footer = between(index, '<footer class="ft">', '</footer>', True)
home_main = between(index, '<main>', '</main>')
recipe_main = between(recipe, '<main id="main">', '</main>')

seed_js = subprocess.check_output(['node', '--input-type=module', '-e',
    "import s from '%s'; const now=new Date().toISOString();"
    "console.log(JSON.stringify(s.map(r=>({...r,image:'',published:true,createdAt:now,updatedAt:now,changelog:[]}))))"
    % P('netlify', 'lib', 'seed.mjs').replace('\\', '/')], text=True).strip()
json.loads(seed_js)  # validate

def wrap(name, js):
    return 'window.%s = function () {\n%s\n};' % (name, js)

favicon = 'data:image/svg+xml;base64,' + base64.b64encode(read('public', 'assets', 'favicon.svg').encode()).decode()
head_meta = re.search(r'<title>.*?</title>.*?(?=<link rel="icon")', index, re.S).group(0)
fonts = re.search(r'<link rel="preconnect" href="https://fonts.googleapis.com">.*?display=swap" rel="stylesheet">', index, re.S).group(0)

router = r"""
(function () {
  var G = window.Gilt, isRecipe = /^#\/r\//.test(location.hash);
  var main = document.getElementById('main');
  main.appendChild(document.getElementById(isRecipe ? 'tplRecipe' : 'tplHome').content.cloneNode(true));
  if (isRecipe) document.documentElement.classList.add('no-loader');   // the loading screen is for the home page only
  document.querySelectorAll('a[href="/"]').forEach(function (a) { a.setAttribute('href', G.home()); });
  if (isRecipe) {
    var pill = document.querySelector('.hd .pill');
    pill.setAttribute('href', G.home() + '#cuts');
    pill.innerHTML = '<span class="long">All recipes</span><span class="short">All</span>';
  }
  window.addEventListener('hashchange', function () {
    if (isRecipe || /^#\/r\//.test(location.hash)) location.reload();
  });
  (isRecipe ? window.__recipe : window.__home)();
  if (!isRecipe && location.hash.length > 1) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) setTimeout(function () { t.scrollIntoView(); }, 60);
  }
})();"""

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{head_meta.strip()}
{loader_head}
<link rel="icon" href="{favicon}" type="image/svg+xml">
{fonts}
<style>
{read('public', 'assets', 'style.css')}
</style>
</head>
<body>
{loader_body}
<a class="skip" href="#recipes">Skip to recipes</a>
{header}
<div class="preview-note" role="note">Preview mode: likes, ratings and comments are saved on this device only. They are shared with everyone once the blog runs on Netlify.</div>
<main id="main"></main>
<template id="tplHome">{home_main}</template>
<template id="tplRecipe">{recipe_main}</template>
{footer}
<script>window.GILT_SINGLE = true; window.GILT_SEED = {seed_js};</script>
<script>
{read('public', 'assets', 'app.js')}
</script>
<script>
{read('single', 'preview-api.js')}
</script>
<script>
{wrap('__home', read('public', 'assets', 'home.js'))}
{wrap('__recipe', read('public', 'assets', 'recipe.js'))}
</script>
<script>{router}</script>
<script>
{loader_js}
</script>
</body>
</html>
"""
out = sys.argv[1] if len(sys.argv) > 1 else P('dist', 'the-gilt-recipes.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
