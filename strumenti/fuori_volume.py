#!/usr/bin/env python3
"""Quanto di ogni disegno esce dal suo volume 3D (la scatola invisibile che decide chi sta davanti a chi).

Un pixel del disegno fuori dalla scatola prende la profondità del piano del disegno: se sta SOTTO la scatola (cespugli
alla base, ombre disegnate, oggetti appoggiati davanti) il terreno davanti lo copre e il disegno sembra tagliato; se sta
ai lati o sopra (tetti che sporgono, chiome) può passare davanti o dietro alle cose sbagliate.
Stampa la tabella dal peggiore e salva concept/n1/fuori_volume.jpg (in rosso il fuori sotto, in giallo il fuori ai lati,
in ciano il contorno della scatola). Uso: python strumenti/fuori_volume.py [nomi…]"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SP = os.path.join(R, 'public', 'sprite')
D = np.array([math.sqrt(0.5), 0, -math.sqrt(0.5)])
V = np.array([math.cos(math.pi / 6) * math.sin(math.pi / 4), math.sin(math.pi / 6), math.cos(math.pi / 6) * math.cos(math.pi / 4)])
U = np.cross(V, D); U /= np.linalg.norm(U)


def sagoma(e, tetto=False):
    """Il contorno della scatola (o del tetto) sullo schermo, in pixel dello sprite."""
    if tetto:
        bx, bz, y0, y1 = e['tetto']
    else:
        (bx, bz, y1), y0 = e['scatola'], -0.05
    pts = []
    for x in (-bx / 2, bx / 2):
        for z in (-bz / 2, bz / 2):
            for y in (y0, y1):
                p = np.array([x, y, z])
                pts.append((e['ax'] + p @ D * e['s'], e['ay'] - p @ U * e['s']))
    pts = sorted(set(pts))
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for q in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], q) <= 0: hi.pop()
        hi.append(q)
    return lo[:-1] + hi[:-1]


def misura(nome, e):
    im = Image.open(os.path.join(SP, nome + '.webp')).convert('RGBA')
    a = np.asarray(im)[..., 3] > 60
    poli = sagoma(e)
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).polygon(poli, fill=255)
    if e.get('tetto'): ImageDraw.Draw(m).polygon(sagoma(e, True), fill=255)
    dentro = np.asarray(m) > 0
    fuori = a & ~dentro
    # sotto = fuori e più in basso del bordo inferiore della sagoma in quella colonna
    basso = np.full(im.width, -1)
    cols = np.where(dentro.any(axis=0))[0]
    for c in cols: basso[c] = np.where(dentro[:, c])[0].max()
    yy = np.arange(im.height)[:, None]
    sotto = fuori & (basso[None, :] >= 0) & (yy > basso[None, :])
    lati = fuori & ~sotto
    tot = a.sum()
    return im, poli, sotto, lati, sotto.sum() / tot, lati.sum() / tot


if __name__ == '__main__':
    el = json.load(open(os.path.join(SP, 'elenco.json')))
    # contano gli sprite «scatola» (edifici, tappeti): quelli «piano» stanno tutti a una profondità e non si tagliano
    nomi = sys.argv[1:] or [n for n in el if el[n].get('modo') == 'scatola']
    righe = [(n, *misura(n, el[n])) for n in nomi]
    righe.sort(key=lambda r: -(r[5] + r[6]))
    print(f"{'sprite':18s} sotto  lati")
    for n, _, _, _, _, so, la in righe:
        print(f'{n:18s} {so:5.0%} {la:5.0%}')
    tele = []
    for n, im, poli, sotto, lati, so, la in righe[:40]:
        a = np.asarray(im).copy()
        bg = np.full_like(a, 235); bg[..., 3] = 255
        al = a[..., 3:4] / 255.0
        rgb = (a[..., :3] * al + bg[..., :3] * (1 - al)).astype(np.uint8)
        rgb[sotto] = [230, 30, 30]; rgb[lati] = [240, 200, 0]
        t = Image.fromarray(rgb); ImageDraw.Draw(t).polygon(poli, outline=(0, 180, 220))
        ImageDraw.Draw(t).text((4, 4), f'{n} {so:.0%}/{la:.0%}', fill=(0, 0, 0))
        t.thumbnail((260, 260)); tele.append(t)
    W = 8 * 270
    fo = Image.new('RGB', (W, 270 * math.ceil(len(tele) / 8)), 'white')
    for i, t in enumerate(tele): fo.paste(t, ((i % 8) * 270, (i // 8) * 270))
    fo.save(os.path.join(R, 'concept', 'n1', 'fuori_volume.jpg'), quality=85)
