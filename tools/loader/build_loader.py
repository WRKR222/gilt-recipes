"""paths.json (traced drawing) + loader.template.js -> public/assets/loader.js.
Run from the project root:  python3 tools/loader/build_loader.py
To use a different drawing, trace it with the gilt-loader project's trace.py and replace paths.json."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, 'paths.json')))
js = (open(os.path.join(here, 'loader.template.js')).read()
      .replace('%FRAMES%', json.dumps(d['frames']))
      .replace('%DATA%', json.dumps(d['s'], separators=(',', ':'))))
out = os.path.join(here, '..', '..', 'public', 'assets', 'loader.js')
open(out, 'w').write(js)
print('wrote', os.path.normpath(out), len(js) // 1024, 'KB; drawing is', d['w'], 'x', d['h'])
