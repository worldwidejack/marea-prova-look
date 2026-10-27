#!/usr/bin/env python3
"""La tavolozza di un disegno nero 1: i colori che usa davvero (k-medie in Lab sui pixel pieni), per ridurre alla stessa
tavolozza la texture del modello 3D che ne nasce (strumenti/blender_modello.py). Esce un JSON con i colori in 0-255.

Uso: <python del venv di fenaki> strumenti/tavolozza.py concept/3d/input/bar.png 16 concept/3d/tavolozze/bar.json
"""
import json
import os
import sys
import numpy as np
from PIL import Image


def lab(rgb):
    """sRGB 0-255 → CIE Lab (D65)."""
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def kmedie(x, k, giri=25, seme=7):
    rng = np.random.default_rng(seme)
    # partenza «k-means++» semplice: centri lontani fra loro
    centri = [x[rng.integers(len(x))]]
    for _ in range(k - 1):
        d = np.min(((x[:, None, :] - np.array(centri)[None]) ** 2).sum(2), 1)
        centri.append(x[rng.choice(len(x), p=d / d.sum())])
    c = np.array(centri)
    for _ in range(giri):
        e = ((x[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
        c = np.array([x[e == i].mean(0) if np.any(e == i) else c[i] for i in range(k)])
    return c, e


def main():
    file, k, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    im = np.array(Image.open(file).convert('RGBA'))
    px = im[..., :3][im[..., 3] > 200].reshape(-1, 3).astype(np.float64)
    rng = np.random.default_rng(1)
    if len(px) > 40000:
        px = px[rng.choice(len(px), 40000, replace=False)]
    _, e = kmedie(lab(px), k)
    # il colore di ogni gruppo è la mediana dei suoi pixel veri (niente medie impastate)
    colori, quanti = [], []
    for i in range(k):
        g = px[e == i]
        if len(g) < 30:
            continue
        r, gg, b = np.median(g, 0)
        if min(r, b) - gg > 30:  # resto del fondo magenta sul bordo: non è un colore del disegno
            continue
        colori.append([int(r), int(gg), int(b)])
        quanti.append(len(g))
    ordine = np.argsort(quanti)[::-1]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'fonte': os.path.basename(file), 'colori': [colori[i] for i in ordine],
               'quota': [round(quanti[i] / len(px), 3) for i in ordine]}, open(out, 'w'), indent=1)
    print(out, len(colori), 'colori')


main()
