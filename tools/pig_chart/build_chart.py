"""Rebuilds the cut-chart SVG (zones + labels) from reference.jpg and prints it to chart.svg.html.
Needs: pip install numpy pillow scipy scikit-image.  Run:  python3 tools/pig_chart/build_chart.py
Zones are the separate dark shapes in the picture (the white lines are gaps between them)."""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
a = np.array(Image.open(os.path.join(HERE, 'reference.jpg')).convert('L'))
H, W = a.shape
lab, _ = ndi.label(a < 110)
yy, xx = np.mgrid[:H, :W]

# component id (found by inspecting the picture) -> [cut key, accessible name, label lines]
# label line = (text, cx, cy, angle, length, cap height); measured from the picture's own lettering
ZONES = [
    (10, 'head',     'Head',        [('HEAD', 141.5, 239.2, -17.4, 90, 41)]),
    (25, 'jowl',     'Jowl',        [('JOWL', 137.9, 313.3, 5.0, 54, 26)]),
    (7,  'neck',     'Neck',        [('NECK', 219.0, 208.5, -88.9, 53, 25)]),
    (2,  'shoulder', 'Shoulder',    [('SHOULDER', 273.2, 185.1, -86.0, 131, 31)]),
    (22, 'picnic',   'Picnic',      [('PICNIC', 260.4, 306.5, 2.0, 57, 23)]),
    (34, 'trotters', 'Front hock',  [('HOCK', 236.3, 360.4, 5.5, 52, 24)]),
    (1,  'backfat',  'Back fat',    [('BACK FAT', 416.5, 125.5, 0.3, 161, 41)]),
    (12, 'loin',     'Loin',        [('LOIN', 399.8, 195.0, -4.0, 101, 56)]),
    (17, 'ribs',     'Ribs',        [('RIBS', 379.8, 278.6, -5.2, 85, 46)]),
    (19, 'belly',    'Bacon',       [('BACON', 452.8, 331.3, -9.3, 97, 34)]),
    (3,  'leg',      'Leg and ham', [('LEG', 592.5, 180.5, 0, 101, 71), ('HAM', 597.0, 255.0, 0, 102, 58)]),
    (28, 'trotters', 'Hind hock',   [('HOCK', 595.3, 340.2, -1.8, 61, 28)]),
]

def path_of(mask):
    sm = ndi.gaussian_filter(mask.astype(float), 1.4)
    d = []
    for c in measure.find_contours(np.pad(sm, 1), 0.5):
        if len(c) < 12: continue
        c = measure.approximate_polygon(c, 0.7)
        d.append('M' + 'L'.join('%.1f %.1f' % (p[1] - 1, p[0] - 1) for p in c[:-1]) + 'Z')
    return ''.join(d)

parts_z, parts_l, badges = [], [], []
x0 = y0 = 1e9; x1 = y1 = 0
for cid, key, name, lines in ZONES:
    m = lab == cid
    f = ndi.binary_fill_holes(m)
    if key == 'leg':                       # keep the tail's curl open
        f = np.where((xx >= 655) & (yy <= 175), m, f)
    ys, xs = np.where(f); x0 = min(x0, xs.min()); x1 = max(x1, xs.max()); y0 = min(y0, ys.min()); y1 = max(y1, ys.max())
    parts_z.append('<path class="zone" data-cut="%s"%s fill-rule="evenodd" d="%s"/>' % (key, ' data-dup="1"' if name == 'Hind hock' else '', path_of(f)))
    # label
    obstacle = np.zeros_like(f)
    t = []
    for text, cx, cy, ang, ln, h in lines:
        fs = h / 0.70
        t.append('<text x="0" y="%.1f" text-anchor="middle" textLength="%d" lengthAdjust="spacingAndGlyphs" font-size="%.1f"%s>%s</text>' % (
            0, ln, fs, '', text))
    # place lines
    g = []
    for (text, cx, cy, ang, ln, h), tx in zip(lines, t):
        fs = h / 0.70
        tx = tx.replace('y="0.0"', 'y="%.1f"' % (h / 2))
        g.append('<g transform="translate(%.1f %.1f) rotate(%.1f)">%s</g>' % (cx, cy, ang, tx))
        # keep the badge clear of the lettering
        r = np.hypot(xx - cx, yy - cy)
        a_ = np.radians(ang); u = (xx - cx) * np.cos(a_) + (yy - cy) * np.sin(a_); v = -(xx - cx) * np.sin(a_) + (yy - cy) * np.cos(a_)
        obstacle |= (abs(u) < ln / 2 + 8) & (abs(v) < h / 2 + 8)
    parts_l.append('<g class="lb">%s</g>' % ''.join(g))
    free = f & ~obstacle
    # keep clear of the zone edge and of the tail
    dt = ndi.distance_transform_edt(np.pad(free, 1))[1:-1, 1:-1]
    if key == 'leg': dt[(xx > 640) & (yy < 190)] = 0
    by, bx = np.unravel_index(np.argmax(dt), dt.shape)
    rad = max(6, min(12, dt[by, bx] - 2))
    badges.append((key, bx, by, rad, dt[by, bx]))
    parts_l.append('<g class="bd zero" data-n="%s" transform="translate(%d %d)"><circle r="%.1f"/><text y="%.1f" font-size="%.1f"></text></g>' % (
        key, bx, by, rad, rad * 0.36, rad * 1.15))

pad = 8
vb = '%d %d %d %d' % (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
svg = ('<svg class="pigchart" viewBox="%s" role="group" aria-label="Pork cut chart">\n  <g id="zones">\n    %s\n  </g>\n  <g id="zoneLabels" aria-hidden="true">\n    %s\n  </g>\n</svg>'
       % (vb, '\n    '.join(parts_z), '\n    '.join(parts_l)))
open(os.path.join(HERE, 'chart.svg.html'), 'w').write(svg)
print('viewBox', vb, 'svg KB', len(svg) // 1024)
for b in badges: print(b)
