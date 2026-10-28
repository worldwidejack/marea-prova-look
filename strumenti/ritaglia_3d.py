#!/usr/bin/env python3
"""Dai disegni nero 1 (fondo magenta, marea-prova-st/concept/n1/gen) alle immagini da dare al generatore 3D:
una figura sola, scontornata (alfa vero, bordo magenta tolto), centrata in un quadrato con margine.
Uso: <python del venv di fenaki> strumenti/ritaglia_3d.py [nome …]  (senza nomi: tutti)
"""
import os
import sys
import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(QUI, '..', '..', 'marea-prova-st', 'concept', 'n1', 'gen')
OUT = os.path.join(QUI, '..', 'concept', '3d', 'input')

# nome, file, quale figura (da sinistra, contando le macchie grandi), lato del quadrato
LAVORI = [
    ('bar', 'bar.png', 0), ('capanno', 'capanno.png', 0), ('bancarella', 'bancarella.png', 0),
    ('barca', 'barca.png', 0), ('barista', 'abitanti_barista.png', 1), ('pescatore', 'abitanti_pescatore.png', 1),
    # dai fogli a griglia: (riga, colonna, colonne[, righe]) prima di cercare la figura (righe = colonne se mancano)
    ('casse_pesce', 'porto.png', 0, (0, 1, 4)),
    # alberi, palme, lampione e scogli (28/10: con la camera che gira i disegni si vedevano di cartone)
    ('palma', 'piante.png', 0, (0, 0, 3, 2)), ('palma_bassa', 'piante.png', 0, (0, 1, 3, 2)), ('albero', 'piante.png', 0, (0, 2, 3, 2)),
    ('albero_rosa', 'alberi2.png', 0, (0, 0, 3, 2)), ('betulla', 'alberi2.png', 0, (0, 1, 3, 2)), ('albero_arancio', 'alberi2.png', 0, (0, 2, 3, 2)),
    ('faraglione', 'rocce.png', 0, (0, 0, 3, 2)), ('scoglio', 'rocce.png', 0, (0, 1, 3, 2)),
    ('lampione', 'porto.png', 0, (3, 0, 4)),
]


def alfa_magenta(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    # quanto un pixel è magenta: rosso e blu alti, verde basso
    m = np.clip((np.minimum(r, b) - g - 60) / 80, 0, 1)
    return 1 - m


def main():
    os.makedirs(OUT, exist_ok=True)
    for nome, file, quale, *cella in LAVORI:
        if sys.argv[1:] and nome not in sys.argv[1:]:
            continue
        im = np.array(Image.open(os.path.join(GEN, file)).convert('RGB'))
        a = alfa_magenta(im)
        if cella:
            # per macchie, non per righe dritte (come prepara.celle): ChatGPT disegna la base di palme e alberi oltre il
            # confine della casella e il taglio dritto la mozzava. Si tengono le macchie col centro nella casella.
            r, c, nc, *nr = cella[0]
            nr = nr[0] if nr else nc
            H, W = im.shape[:2]
            n, lab, st, ce = cv2.connectedComponentsWithStats((a > 0.15).astype(np.uint8), connectivity=8)
            mie = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 25
                   and min(int(ce[i][1] // (H / nr)), nr - 1) == r and min(int(ce[i][0] // (W / nc)), nc - 1) == c]
            tenere = np.isin(lab, mie).astype(np.uint8)
            ys, xs = np.nonzero(tenere)
            x0, y0, x1, y1 = max(0, xs.min() - 20), max(0, ys.min() - 20), min(W, xs.max() + 21), min(H, ys.max() + 21)
            w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        else:
            piena = (a > 0.5).astype(np.uint8)
            piena = cv2.morphologyEx(piena, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            n, lab, st, _ = cv2.connectedComponentsWithStats(piena)
            grandi = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 4000]
            grandi.sort(key=lambda i: st[i, cv2.CC_STAT_LEFT])
            k = grandi[quale]
            x, y, w, h = st[k, :4]
            # la figura e i pezzetti staccati che le stanno addosso (lenza, bicchiere): tutto ciò che cade nel suo rettangolo allargato
            x0, y0, x1, y1 = max(0, x - 20), max(0, y - 20), min(im.shape[1], x + w + 20), min(im.shape[0], y + h + 20)
            tenere = np.zeros_like(piena)
            for i in range(1, n):
                cx, cy, cw, ch = st[i, :4]
                if cx >= x0 and cy >= y0 and cx + cw <= x1 and cy + ch <= y1:
                    tenere[lab == i] = 1
        tenere = cv2.dilate(tenere, np.ones((5, 5), np.uint8))
        alfa = (a * tenere)[y0:y1, x0:x1]
        rgb = im[y0:y1, x0:x1].astype(np.float32)
        # via il magenta che sporca il bordo: dove l'alfa è parziale si toglie la tinta magenta
        g = rgb[..., 1]
        rgb[..., 0] = np.minimum(rgb[..., 0], g + (rgb[..., 0] - g) * alfa)
        rgb[..., 2] = np.minimum(rgb[..., 2], g + (rgb[..., 2] - g) * alfa)
        lato = int(max(x1 - x0, y1 - y0) * 1.18)
        tela = np.zeros((lato, lato, 4), np.uint8)
        ox, oy = (lato - (x1 - x0)) // 2, (lato - (y1 - y0)) // 2
        tela[oy:oy + y1 - y0, ox:ox + x1 - x0, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
        tela[oy:oy + y1 - y0, ox:ox + x1 - x0, 3] = (np.clip(alfa, 0, 1) * 255).astype(np.uint8)
        out = Image.fromarray(tela, 'RGBA')
        if lato > 1024:
            out = out.resize((1024, 1024), Image.LANCZOS)
        out.save(os.path.join(OUT, nome + '.png'))
        # e una copia su bianco, per i siti che non capiscono l'alfa
        bianco = Image.new('RGB', out.size, 'white'); bianco.paste(out, mask=out.split()[3])
        bianco.save(os.path.join(OUT, nome + '_bianco.png'))
        print(nome, out.size, 'figura', (w, h))


main()
