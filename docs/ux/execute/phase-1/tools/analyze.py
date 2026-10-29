"""Phase 1 maps: thumb reach (right hand, one left-hand view), squint blur, and summary tables.
Usage: python3 analyze.py <shotsDir> <outDir>
Thumb model [Heuristica: Hoober 2013 / Hurff thumb zone], parameters fixed so it is reproducible:
pivot = thumb base, 4 mm outside the right edge and 18 mm above the bottom edge (mirrored for the left hand).
d < 25 mm -> media (flexion cerca de la base); 25-70 mm -> facil; 70-88 mm -> media; > 88 mm -> dificil.
"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SHOTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
DSF = 2
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f_small = ImageFont.truetype(FONT, 22)
f_badge = ImageFont.truetype(FONTB, 20)
f_title = ImageFont.truetype(FONTB, 26)
ZONE_RGB = {'facil': (52, 168, 83), 'media': (245, 166, 35), 'dificil': (220, 53, 69)}
ZONE_ES = {'facil': 'fácil', 'media': 'media', 'dificil': 'difícil'}


def zone_of(x, y, vp, hand='right'):
    mm = vp['mmPerPx']
    w, h = vp['width'] * mm, vp['height'] * mm
    px = w + 4 if hand == 'right' else -4
    py = h - 18
    d = ((x * mm - px) ** 2 + (y * mm - py) ** 2) ** 0.5
    if d < 25: return 'media'
    if d <= 70: return 'facil'
    if d <= 88: return 'media'
    return 'dificil'


def zone_layer(vp, hand):
    W, H = vp['width'] * DSF, vp['height'] * DSF
    ys, xs = np.mgrid[0:H, 0:W] / DSF
    mm = vp['mmPerPx']
    px = vp['width'] * mm + 4 if hand == 'right' else -4
    py = vp['height'] * mm - 18
    d = np.hypot(xs * mm - px, ys * mm - py)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    for cond, key in [((d < 25) | ((d > 70) & (d <= 88)), 'media'), ((d >= 25) & (d <= 70), 'facil'), (d > 88, 'dificil')]:
        rgba[cond, :3] = ZONE_RGB[key]
        rgba[cond, 3] = 70
    return Image.fromarray(rgba, 'RGBA')


def thumb_map(base, hand='right'):
    meta = json.load(open(os.path.join(SHOTS, base + '.json')))
    vp = meta['viewport']
    shot = Image.open(os.path.join(SHOTS, base + '.png')).convert('RGBA')
    img = Image.alpha_composite(shot, zone_layer(vp, hand))
    draw = ImageDraw.Draw(img)
    rows = []
    controls = [c for c in meta['controls'] if c['w'] >= 4 and c['h'] >= 4]
    for i, c in enumerate(controls, 1):
        cx, cy = c['x'] + c['w'] / 2, c['y'] + c['h'] / 2
        z = zone_of(cx, cy, vp, hand)
        small = min(c['w'], c['h']) < 44
        col = ZONE_RGB[z]
        box = [c['x'] * DSF, c['y'] * DSF, (c['x'] + c['w']) * DSF, (c['y'] + c['h']) * DSF]
        draw.rectangle(box, outline=col + (255,), width=4 if not small else 3)
        if small:
            draw.rectangle([b + 3 * s for b, s in zip(box, (1, 1, -1, -1))], outline=(0, 0, 0, 255), width=1)
        bx, by = box[0] + 2, box[1] + 2
        draw.rounded_rectangle([bx, by, bx + 34, by + 26], 6, fill=col + (255,))
        draw.text((bx + 17, by + 13), str(i), font=f_badge, fill='white', anchor='mm')
        rows.append({'n': i, 'label': c['label'], 'zone': z, 'w': round(c['w']), 'h': round(c['h']), 'small': small, 'disabled': c['disabled']})
    # Side legend
    panel_w = 560
    canvas = Image.new('RGBA', (img.width + panel_w, img.height), (255, 255, 255, 255))
    canvas.paste(img, (0, 0))
    d2 = ImageDraw.Draw(canvas)
    x0 = img.width + 20
    title = f"{meta['scenario']['label']}"
    d2.text((x0, 20), title[:38], font=f_title, fill='black')
    d2.text((x0, 56), f"{vp['name']} · {meta['mode']} · mano {'derecha' if hand == 'right' else 'izquierda'}", font=f_small, fill=(60, 60, 60))
    d2.text((x0, 84), 'Modelo heurístico, no datos de uso', font=f_small, fill=(120, 120, 120))
    y = 124
    for key in ['facil', 'media', 'dificil']:
        d2.rectangle([x0, y, x0 + 26, y + 22], fill=ZONE_RGB[key])
        d2.text((x0 + 36, y), f"Zona {ZONE_ES[key]}", font=f_small, fill='black')
        y += 30
    d2.text((x0, y), '▢ doble borde = lado menor < 44 px', font=f_small, fill='black')
    y += 40
    for r in rows:
        if y > canvas.height - 30: d2.text((x0, y), '…', font=f_small, fill='black'); break
        mark = ' ✗44' if r['small'] else ''
        dis = ' (inactivo)' if r['disabled'] else ''
        d2.rounded_rectangle([x0, y, x0 + 34, y + 26], 6, fill=ZONE_RGB[r['zone']])
        d2.text((x0 + 17, y + 13), str(r['n']), font=f_badge, fill='white', anchor='mm')
        d2.text((x0 + 44, y + 1), f"{r['label'][:24]}{dis} {r['w']}×{r['h']}{mark}", font=f_small, fill='black')
        y += 32
    suffix = '_thumb' if hand == 'right' else '_thumbL'
    canvas.convert('RGB').save(os.path.join(OUT, base + suffix + '.png'), optimize=True)
    return rows


def blur_map(base):
    shot = Image.open(os.path.join(SHOTS, base + '.png')).convert('RGB')
    blurred = shot.filter(ImageFilter.GaussianBlur(radius=7 * DSF))
    side = Image.new('RGB', (shot.width * 2 + 20, shot.height), 'white')
    side.paste(shot, (0, 0)); side.paste(blurred, (shot.width + 20, 0))
    side.save(os.path.join(OUT, base + '_blur.png'), optimize=True)


manifest = json.load(open(os.path.join(SHOTS, 'manifest.json')))
summary = []
for m in manifest:
    base = m['file'][:-4]
    rows = thumb_map(base)
    blur_map(base)
    meta = json.load(open(os.path.join(SHOTS, base + '.json')))
    texts = meta['texts']
    fails = [t for t in texts if not t['pass'] and not t['disabled']]
    summary.append({
        'id': m['id'], 'label': m['label'], 'viewport': m['viewport'], 'mode': m['mode'],
        'controls': len(rows), 'facil': sum(r['zone'] == 'facil' for r in rows), 'media': sum(r['zone'] == 'media' for r in rows),
        'dificil': sum(r['zone'] == 'dificil' for r in rows), 'small': [f"{r['label']} {r['w']}×{r['h']}" for r in rows if r['small'] and not r['disabled']],
        'controls_detail': rows,
        'contrast_fail': [{k: t[k] for k in ('text', 'size', 'weight', 'fg', 'bg', 'ratio', 'required')} for t in fails],
        'texts': len(texts), 'scrollHeight': meta['scrollHeight'],
        'largest': sorted(({'text': t['text'], 'size': t['size'], 'weight': t['weight'], 'ratio': t['ratio'], 'y': round(t['y'])} for t in texts), key=lambda t: -t['size'] * t['weight'])[:6],
        'centered': sum(t['align'] == 'center' for t in texts),
    })
# One left-hand view
thumb_map('05-run-75_390x844_light', 'left')
thumb_map('01-picker_390x844_light', 'left')
json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(summary))
