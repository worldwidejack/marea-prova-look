#!/usr/bin/env python3
"""Il modello del protagonista col contorno nero (5 viste su fondo chiaro) → 5 viste scontornate in concept/n1/base/vista_<S|SE|E|NE|N>.png,
con le misure (altezza, testa con capelli in % dell'altezza, larghezza della testa e del corpo) confrontate col modello approvato.
Uso: python strumenti/viste_modello.py [concept/n1/gen/modello_nero.png]"""
import os
import sys

import numpy as np
from PIL import Image

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SP = os.path.expanduser('~/Desktop/JACK/_GITHUB/marea-stile-personaggio')
src = open(os.path.join(SP, 'strumenti', 'otto_direzioni.py')).read().split('\nviste = figure(')[0]
od = {'__file__': os.path.join(SP, 'strumenti', 'otto_direzioni.py')}
exec(compile(src, 'otto_direzioni', 'exec'), od)
NOMI = ['S', 'SE', 'E', 'NE', 'N']


def misure(fig):
    """Altezza, testa (dalla cima al collo: la riga più stretta tra il 30% e il 60% dell'altezza), larghezze."""
    a = np.asarray(fig)[..., 3] > 40
    ys = np.where(a.any(axis=1))[0]
    y0, y1 = ys.min(), ys.max()
    h = y1 - y0 + 1
    larg = np.array([a[y].sum() for y in range(y0, y1 + 1)])
    lo, hi = int(h * 0.30), int(h * 0.60)
    collo = lo + int(np.argmin(larg[lo:hi]))
    testa = larg[:collo].max()
    corpo = larg[collo:int(h * 0.85)].max()
    return h, collo / h, testa, corpo


def viste(file):
    out = od['figure'](Image.open(file), 5)
    return [f for f, _ in out]


if __name__ == '__main__':
    nero = viste(sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'concept', 'n1', 'gen', 'modello_nero.png'))
    vecchio = viste(os.path.join(SP, '_MODELLO_protagonista.png'))
    os.makedirs(os.path.join(R, 'concept', 'n1', 'base'), exist_ok=True)
    for n, f, v in zip(NOMI, nero, vecchio):
        f.save(os.path.join(R, 'concept', 'n1', 'base', f'vista_{n}.png'))
        h, t, lt, lc = misure(f); h2, t2, lt2, lc2 = misure(v)
        print(f'{n:3s} nero: alto {h} testa {t:.0%} testa/corpo {lt / lc:.2f} | approvato: alto {h2} testa {t2:.0%} testa/corpo {lt2 / lc2:.2f}')
