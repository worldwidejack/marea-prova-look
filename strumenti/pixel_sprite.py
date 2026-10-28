#!/usr/bin/env python3
"""Dai fogli in pixel art di Codex (concept/sprite_pixel/pixel_<vista>.png: 4 colonne × 3 righe su magenta) agli sprite
del protagonista per la versione di Riccardo (look pixel con personaggio disegnato):
- ogni cella si scontorna (alfa dal magenta) e si ritaglia;
- tutto il foglio si porta alla stessa scala: il protagonista in piedi (camminata) alto ALTO px; rimpicciolito a media
  d'area, poi alfa netta (0/1), tavolozza comune di tutte le viste (k-medie) e contorno di 1 pixel dove manca;
- piedi: ogni riga ha la sua linea di base (la più bassa della riga), il punto d'appoggio sta al centro della figura.
Scrive public/sprite_pixel/<vista>_<mossa>_<n>.png e public/sprite_pixel/elenco.json (stesso formato degli sprite).
Viste: le 9 della metà destra (S, SSE, SE, ESE, E, ENE, NE, NNE, N; la sinistra è lo specchio), quelle che ci sono.
Abitanti (concept/sprite_pixel/npc_<nome>.png: 5 colonne × 1 riga, S SE E NE N): <nome>_<vista>.png, tavolozza loro.

Uso: <python del venv di fenaki> strumenti/pixel_sprite.py [--alto 48]
"""
import json
import os
import sys
import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(QUI, '..', 'concept', 'sprite_pixel')
OUT = os.path.join(QUI, '..', 'public', 'sprite_pixel')
ALTO = int(sys.argv[sys.argv.index('--alto') + 1]) if '--alto' in sys.argv else 48
VISTE = ['S', 'SSE', 'SE', 'ESE', 'E', 'ENE', 'NE', 'NNE', 'N']
# abitanti: alto in px (lo chignon, la canna), piede e scatola come gli altri oggetti
NPC = {'barista': (54, [0.9, 0.9], [0.9, 0.9, 2.5]), 'pescatore': (46, [0.9, 0.9], [0.9, 0.9, 2.0])}
VISTE_NPC = ['S', 'SE', 'E', 'NE', 'N']
RIGHE = ['cammina', 'scatto', 'bevi']
INCHIOSTRO = np.array([21, 16, 14], dtype=np.float64)


def alfa_magenta(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    return 1 - np.clip((np.minimum(r, b) - g - 60) / 80, 0, 1)


def celle(im, righe=3, colonne=4):
    """Le figure del foglio (righe × colonne): per ogni cella il ritaglio RGBA e il fondo della figura nella cella."""
    rgb = np.array(im.convert('RGB'))
    a = alfa_magenta(rgb)
    H, W = a.shape
    out = []
    for r in range(righe):
        for c in range(colonne):
            y0, y1, x0, x1 = r * H // righe, (r + 1) * H // righe, c * W // colonne, (c + 1) * W // colonne
            m = (a[y0:y1, x0:x1] > 0.5).astype(np.uint8)
            # si tiene la figura (la macchia più grande) e i pezzi attaccati a lei; via polvere e linee di velocità staccate
            n, lab, st, _ = cv2.connectedComponentsWithStats(m)
            if n < 2:
                out.append(None)
                continue
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            vicino = cv2.dilate((lab == k).astype(np.uint8), np.ones((9, 9), np.uint8))
            tieni = np.isin(lab, [i for i in range(1, n) if i == k or (vicino[lab == i].any() and st[i, cv2.CC_STAT_AREA] > 40)])
            ys, xs = np.where(tieni)
            ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            alfa = a[y0:y1, x0:x1] * tieni
            rgba = np.dstack([rgb[y0:y1, x0:x1][ya:yb, xa:xb], (alfa[ya:yb, xa:xb] * 255).astype(np.uint8)])
            out.append({'rgba': rgba, 'fondo': yb, 'riga': r, 'col': c})
    return out


def rimpicciolisci(rgba, s):
    """Media d'area pesata dall'alfa (niente aloni magenta), poi alfa netta."""
    h, w = rgba.shape[:2]
    W2, H2 = max(1, round(w * s)), max(1, round(h * s))
    a = rgba[..., 3:4].astype(np.float64) / 255
    pre = rgba[..., :3].astype(np.float64) * a
    im_pre = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    im_a = Image.fromarray((a[..., 0] * 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    A = np.array(im_a).astype(np.float64) / 255
    C = np.array(im_pre).astype(np.float64) / np.maximum(A[..., None], 1e-3)
    return np.clip(C, 0, 255), A > 0.5


def kmedie(x, k, giri=20):
    rng = np.random.default_rng(3)
    c = x[rng.choice(len(x), k, replace=False)]
    for _ in range(giri):
        e = ((x[:, None] - c[None]) ** 2).sum(2).argmin(1)
        c = np.array([x[e == i].mean(0) if np.any(e == i) else c[i] for i in range(k)])
    return c


def quantizza(c, pal):
    """Colori della tavolozza, contorno di 1 pixel dove manca, tela col margine e i piedi sulla riga di base."""
    C, M = c['C'], c['M']
    idx = ((C[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
    Q = pal[idx]
    # contorno di 1 pixel: ogni pixel pieno che tocca il vuoto (4 vicini) diventa inchiostro se non è già scuro
    pad = np.pad(M, 1)
    bordo = M & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    scuro = Q.sum(-1) < 150
    Q[bordo & ~scuro] = INCHIOSTRO
    h, w = M.shape
    tela = np.zeros((h + 2 + c['giu'], w + 2, 4), np.uint8)
    tela[1:1 + h, 1:1 + w, :3] = Q.astype(np.uint8)
    tela[1:1 + h, 1:1 + w, 3] = M * 255
    return tela


def abitanti(elenco):
    """Gli abitanti in 5 viste: tutte alla stessa scala (la vista più alta = alto px), piedi sulla stessa base."""
    for nome, (alto, piede, scatola) in NPC.items():
        f = os.path.join(SRC, f'npc_{nome}.png')
        if not os.path.exists(f):
            continue
        cs = celle(Image.open(f), 1, 5)
        s = alto / max(c['rgba'].shape[0] for c in cs if c)
        base = max(c['fondo'] for c in cs if c)
        for c in cs:
            if c:
                c['C'], c['M'] = rimpicciolisci(c['rgba'], s)
                c['giu'] = round((base - c['fondo']) * s)
        px = np.concatenate([c['C'][c['M']] for c in cs if c])
        pal = np.vstack([kmedie(px[::max(1, len(px) // 20000)], 13), INCHIOSTRO])
        for c in cs:
            if not c:
                continue
            tela = quantizza(c, pal)
            n = f"{nome}_{VISTE_NPC[c['col']]}"
            Image.fromarray(tela, 'RGBA').save(os.path.join(OUT, n + '.png'))
            H2, W2 = tela.shape[:2]
            elenco[n] = {'w': W2, 'h': H2, 's': 19.2, 'ax': W2 // 2, 'ay': H2 - 1, 'piede': piede, 'scatola': scatola,
                         'modo': 'piano', 'avanti': 0.3}
        print(nome, 'scala', round(s, 3), [c['M'].shape for c in cs if c])


def main():
    os.makedirs(OUT, exist_ok=True)
    fogli = {v: Image.open(os.path.join(SRC, f'pixel_{v}.png')) for v in VISTE if os.path.exists(os.path.join(SRC, f'pixel_{v}.png'))}
    tutte = {}
    for v, im in fogli.items():
        cs = celle(im)
        # scala: il più alto della camminata = ALTO px
        alt = max(c['rgba'].shape[0] for c in cs if c and c['riga'] == 0)
        s = ALTO / alt
        basi = {r: max(c['fondo'] for c in cs if c and c['riga'] == r) for r in range(3)}
        for c in cs:
            if not c:
                continue
            C, M = rimpicciolisci(c['rgba'], s)
            c['C'], c['M'] = C, M
            c['giu'] = round((basi[c['riga']] - c['fondo']) * s)  # quanto la figura sta sopra la base della riga
        tutte[v] = cs
    # tavolozza comune: 15 colori dai pixel pieni di tutte le viste, più l'inchiostro
    px = np.concatenate([c['C'][c['M']] for cs in tutte.values() for c in cs if c])
    # (più il verde menta della pozione, che da solo è troppo poco per avere un posto)
    pal = np.vstack([kmedie(px[::max(1, len(px) // 20000)], 15), INCHIOSTRO, [[120, 214, 182], [196, 246, 226]]])
    elenco = {}
    for v, cs in tutte.items():
        print(v, 'scala', round(ALTO / max(c['rgba'].shape[0] for c in cs if c and c['riga'] == 0), 3),
              'larghe', [c['M'].shape[1] for c in cs if c and c['riga'] == 0])
        for c in cs:
            if not c:
                continue
            tela = quantizza(c, pal)
            nome = f"{v}_{RIGHE[c['riga']]}_{c['col'] + 1}"
            Image.fromarray(tela, 'RGBA').save(os.path.join(OUT, nome + '.png'))
            H2, W2 = tela.shape[:2]
            # punto d'appoggio: angolo fra due pixel (intero), al centro della figura, sulla riga sotto i piedi
            elenco[nome] = {'w': W2, 'h': H2, 's': 19.2, 'ax': W2 // 2, 'ay': H2 - 1, 'piede': [0.8, 0.8],
                            'scatola': [0.8, 0.8, 2.5], 'modo': 'piano', 'avanti': 0.3}
    abitanti(elenco)
    json.dump(elenco, open(os.path.join(OUT, 'elenco.json'), 'w'), indent=0)
    print(len(elenco), 'sprite', 'tavolozza', len(pal), 'colori ->', OUT)


main()
