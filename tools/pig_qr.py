"""Pig-face halftone QR for The Gilt Butchery packaging.

The QR dots themselves draw a pig's face. Each QR module is split 3 x 3:
the centre cell carries the real data (what phone scanners read) and the
8 cells around it paint the pig. Version 6 has a single alignment square (bottom right). Finder, timing, alignment and format
areas stay standard so every scanner can lock on.

    python3 tools/pig_qr.py "https://thegiltbutchery.netlify.app/?src=qr" Gilt-Pig-QR.svg
    (needs: pip install segno pillow)
"""
import sys
import segno
from PIL import Image, ImageDraw

INK, RED, PINK, WHITE = '#16110F', '#B3202A', '#F2B8B0', '#FFFFFF'
QUIET = 4          # modules of white border (QR standard)
M = 30             # module size in SVG units
DATA = 14          # size of the centre data cell; the pig is painted in the ring around it
EDGES = [0, (M - DATA) // 2, (M - DATA) // 2 + DATA, M]


def function_mask(n, version):
    """True where a module belongs to a fixed QR pattern (drawn solid, never halftoned)."""
    f = [[False] * n for _ in range(n)]

    def box(r0, c0, h, w):
        for r in range(max(0, r0), min(n, r0 + h)):
            for c in range(max(0, c0), min(n, c0 + w)):
                f[r][c] = True
    box(0, 0, 9, 9); box(0, n - 8, 9, 8); box(n - 8, 0, 8, 9)          # finders + separators + format info
    box(6, 0, 1, n); box(0, 6, n, 1)                                     # timing
    if version >= 2:
        step = [6, n - 7] if version <= 6 else {7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]}.get(version)
        if step is None:
            raise SystemExit('Use version 2-10')
        for r in step:
            for c in step:
                if (r, c) in ((6, 6), (6, step[-1]), (step[-1], 6)):
                    continue
                box(r - 2, c - 2, 5, 5)
    if version >= 7:
        box(0, n - 11, 6, 3); box(n - 11, 0, 3, 6)                       # version info
    return f


def pig_image(px):
    """Pig face as a px x px map: 'D' dark (red), 'P' pink, 'L' light."""
    S = px * 8
    img = Image.new('RGB', (S, S), (255, 255, 255))
    d = ImageDraw.Draw(img)
    U = lambda *v: [round(x * S) for x in v]
    red, pink, white = (179, 32, 42), (242, 184, 176), (255, 255, 255)
    # ears
    d.polygon([tuple(U(.17, .43)), tuple(U(.21, .11)), tuple(U(.42, .24))], fill=red)
    d.polygon([tuple(U(.83, .43)), tuple(U(.79, .11)), tuple(U(.58, .24))], fill=red)
    d.polygon([tuple(U(.22, .36)), tuple(U(.235, .19)), tuple(U(.35, .26))], fill=pink)
    d.polygon([tuple(U(.78, .36)), tuple(U(.765, .19)), tuple(U(.65, .26))], fill=pink)
    # head
    d.ellipse(U(.5 - .37, .54 - .36, .5 + .37, .54 + .36), fill=red)
    # eyes (white with dark pupil)
    for x in (.37, .63):
        d.ellipse(U(x - .065, .45 - .06, x + .065, .45 + .06), fill=white)
        d.ellipse(U(x - .028, .465 - .03, x + .028, .465 + .03), fill=red)
    # snout + nostrils
    d.ellipse(U(.5 - .16, .67 - .105, .5 + .16, .67 + .105), fill=pink)
    for x in (.445, .555):
        d.ellipse(U(x - .03, .67 - .045, x + .03, .67 + .045), fill=red)
    img = img.resize((px, px), Image.LANCZOS)
    out = []
    for y in range(px):
        row = ''
        for x in range(px):
            r, g, b = img.getpixel((x, y))
            if r < 215 and g < 120:
                row += 'D'
            elif r > 225 and g < 215:
                row += 'P'
            else:
                row += 'L'
        out.append(row)
    return out


def build(url, caption='SCAN FOR RECIPES', version=6):
    q = segno.make(url, error='h', version=version, boost_error=False)
    mat = [[bool(v) for v in row] for row in q.matrix]
    n = len(mat)
    fn = function_mask(n, q.version)
    pic = pig_image(n * 3)
    size = (n + 2 * QUIET) * M
    cap_h = 110 if caption else 0
    rects = {INK: [], RED: [], PINK: []}

    for r in range(n):
        for c in range(n):
            x0, y0 = (c + QUIET) * M, (r + QUIET) * M
            if fn[r][c]:
                if mat[r][c]:
                    rects[INK].append((x0, y0, M, M))
                continue
            for i in range(3):
                for j in range(3):
                    x, y = x0 + EDGES[j], y0 + EDGES[i]
                    w, h = EDGES[j + 1] - EDGES[j], EDGES[i + 1] - EDGES[i]
                    if i == 1 and j == 1:                       # data cell (bigger than the picture cells)
                        if mat[r][c]:
                            rects[INK].append((x, y, w, h))
                        continue
                    p = pic[r * 3 + i][c * 3 + j]
                    if p == 'D':
                        rects[RED].append((x, y, w, h))
                    elif p == 'P':
                        rects[PINK].append((x, y, w, h))

    def path(rs):
        # merge horizontal runs per row to keep the file small
        rows = {}
        for x, y, w, h in rs:
            rows.setdefault((y, h), []).append((x, w))
        d = []
        for (y, h), segs in sorted(rows.items()):
            segs.sort()
            sx, sw = segs[0]
            for x, w in segs[1:] + [(None, None)]:
                if x is not None and x == sx + sw:
                    sw += w
                    continue
                d.append(f'M{sx} {y}h{sw}v{h}h-{sw}z')
                if x is not None:
                    sx, sw = x, w
        return ''.join(d)

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size + cap_h}" width="{size}" height="{size + cap_h}" '
             f'shape-rendering="crispEdges" role="img" aria-label="QR code drawing a pig face: scan for The Gilt recipes">',
             f'<rect width="100%" height="100%" fill="{WHITE}"/>']
    for color in (PINK, RED, INK):
        if rects[color]:
            parts.append(f'<path fill="{color}" d="{path(rects[color])}"/>')
    if caption:
        parts.append(f'<text x="{size / 2}" y="{size + 30}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" '
                     f'font-weight="900" font-size="64" letter-spacing="8" fill="{INK}" shape-rendering="auto">{caption}</text>')
    parts.append('</svg>')
    return '\n'.join(parts)


if __name__ == '__main__':
    if len(sys.argv) < 3 or not sys.argv[1].startswith('https://'):
        raise SystemExit(__doc__)
    open(sys.argv[2], 'w').write(build(sys.argv[1]))
    print('saved', sys.argv[2])
