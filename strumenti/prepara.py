#!/usr/bin/env python3
"""Dalle immagini generate (fondo magenta) agli sprite del gioco, tutti alla stessa scala: S_OUT px per unità di mondo.
Dal 26/10 sera legge lo stile «nero 1» da concept/n1/gen (ChatGPT e Codex); le immagini vecchie restano in concept/asset.

Per ogni sprite scrive public/sprite/<nome>.webp e una riga in public/sprite/elenco.json:
  w, h        misura dell'immagine in px
  s           px per unità (sempre S_OUT)
  ax, ay      il pixel che cade sul centro della pianta, a terra
  piede       [larghezza x, profondità z] della pianta (collisioni e ombra)
  scatola     [x, z, alto] del volume centrato sul piede (per il velo e, negli edifici, per la profondità)
  modo        «piano» = tutto il disegno a una profondità (la base portata avanti di «avanti» unità, quanto il disegno
              scende sotto la base: il terreno davanti non lo taglia); «scatola» = profondità dai muri e dal «tetto»
  tetto       [x, z, da, a] il volume che sporge sopra i muri (tetto, tenda), solo per gli edifici
Gli edifici e la barca usano la guida (concept/guide/*.json): si sa dove cade ogni punto del mondo nell'immagine.
Gli oggetti dei fogli si misurano dall'altezza in unità: s = altezza in px / altezza a schermo.
Persone: la scala la dà il protagonista (2,5 unità) disegnato nella stessa immagine.

Uso:  ../jackos-lab/progetti/fenaki/.venv/bin/python strumenti/prepara.py [--controllo out.jpg]
"""
import json
import math
import os
import sys
import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(QUI, '..')
ASSET = os.path.join(ROOT, 'concept', 'n1', 'gen')
GUIDE = os.path.join(ROOT, 'concept', 'guide')
OUT = os.path.join(ROOT, 'public', 'sprite')
S_OUT = 120  # px per unità: su PC 1080p un'unità è ~67 px a schermo, ~134 sui display doppi
C30, S30, K = math.cos(math.pi / 6), math.sin(math.pi / 6), math.sin(math.pi / 4) * math.sin(math.pi / 6)

# edifici sulla guida: file, nome, guida, centro della pianta (x, z) nel mondo della guida, piede, muri, tetto
# (i muri 0,3 più larghi del piede: il bordo nero e lo zoccolo disegnati stanno dentro il volume)
DA_GUIDA = [
    ('bar.png', 'bar', 'bar', (3, 2.5), (6, 5), (6.3, 5.3, 4.4), (6.9, 5.9, 4.3, 7.1)),
    ('capanno.png', 'capanno', 'capanno', (2.25, 1.75), (4.5, 3.5), (4.8, 3.8, 4.2), (5.2, 4.2, 4.1, 4.75)),
    ('bancarella.png', 'bancarella', 'bancarella', (1.5, 0.8), (3, 1.6), (3.3, 1.9, 3.3), (3.7, 2.3, 3.2, 3.95)),
    ('bancone.png', 'bancone', 'bancone', (2.25, 0.55), (4.5, 1.1), (4.5, 1.1, 2.5), None),
]
# la barca: due viste nella stessa guida; si taglia l'immagine a metà
BARCHE = [('barca.png', 'barca_giu', 'barca', (-1.6, 1.6), (4.0, 1.7), 'sinistra'),
          ('barca.png', 'barca_su', 'barca', (3.2, -3.2), (1.7, 4.0), 'destra')]
BANDE = {}  # la fascia rossa delle barche vuote, per allineare la voga
# stesi per terra: la profondità la dà la loro scatola sottile (sennò passerebbero sopra a chi ci sta in piedi)
PIATTI = {'tappeto', 'telo'}

# fogli a griglia: file, colonne, righe, [(nome, alto in unità, piede (x, z), scatola (x, z, alto) o None = piede × alto)]
FOGLI = [
    ('porto.png', 4, 4, [
        ('cassa', 0.9, (0.9, 0.9), None), ('casse_pesce', 1.7, (0.9, 0.9), None), ('barile', 1.1, (0.8, 0.8), None), ('secchio_pesci', 0.7, (0.6, 0.6), None),
        ('nassa', 0.7, (1.2, 0.8), None), ('rotolo_corda', 0.3, (0.8, 0.8), None), ('remi', 0.15, (1.6, 1.0), None), ('rastrelliera', 2.2, (1.6, 0.4), None),
        ('bitta', 1.3, (0.6, 0.6), None), ('bitta_corda', 0.8, (0.7, 0.7), None), ('boe', 1.0, (0.9, 0.6), None), ('rete', 0.6, (1.4, 1.2), None),
        ('lampione', 3.8, (0.5, 0.5), (0.5, 0.5, 3.8)), ('cartello', 2.2, (0.4, 0.4), None), ('panca', 0.7, (1.6, 0.6), None), ('carretto', 1.1, (1.6, 0.9), None),
    ]),
    ('spiaggia.png', 4, 4, [
        ('tavolino', 0.8, (0.9, 0.9), None), ('sgabello_verde', 0.6, (0.6, 0.6), None), ('sgabello_rosa', 0.6, (0.6, 0.6), None), ('panca_schienale', 1.0, (1.6, 0.6), None),
        ('ombrellone', 2.8, (0.4, 0.4), (2.0, 2.0, 2.8)), ('telo', 0.05, (1.0, 1.8), None), ('frigo', 0.6, (0.8, 0.5), None), ('barile_tavolo', 1.1, (0.8, 0.8), None),
        ('pianta_vaso', 1.4, (0.6, 0.6), None), ('sdraio', 0.8, (0.8, 1.6), None), ('secchiello', 0.4, (0.5, 0.5), None), ('casse_limoni', 1.2, (0.9, 0.9), None),
        ('lavagna', 1.2, (0.6, 0.4), None), ('sgabello_tondo', 0.5, (0.5, 0.5), None), ('palo_luci', 3.0, (0.3, 0.3), None), ('cesto_pane', 0.4, (0.6, 0.6), None),
    ]),
    ('piante.png', 3, 2, [
        ('palma', 7.5, (0.8, 0.8), (1.0, 1.0, 7.5)), ('palma_bassa', 5.5, (0.8, 0.8), (1.0, 1.0, 5.5)), ('albero', 7.0, (1.2, 1.2), (3.2, 3.2, 7.0)),
        ('cespuglio', 1.3, (1.6, 1.4), None), ('cespuglio_fiori', 1.3, (1.6, 1.4), None), ('siepe', 1.0, (1.0, 1.0), None),
    ]),
    ('alberi2.png', 3, 2, [
        ('albero_rosa', 6.8, (1.2, 1.2), (3.0, 3.0, 6.8)), ('betulla', 7.2, (0.8, 0.8), (2.2, 2.2, 7.2)), ('albero_arancio', 6.4, (1.2, 1.2), (3.0, 3.0, 6.4)),
        ('alberello', 3.2, (0.6, 0.6), (1.4, 1.4, 3.2)), ('aiuola', 0.7, (1.4, 1.0), None), ('ceppo', 0.7, (1.0, 1.0), None),
    ]),
    ('rocce.png', 3, 2, [
        ('faraglione', 5.0, (3.0, 3.0), None), ('scoglio', 2.4, (2.6, 2.2), None), ('lastra', 0.6, (2.4, 1.8), None),
        ('massi_muschio', 1.2, (1.8, 1.2), None), ('sasso', 0.8, (0.9, 0.9), None), ('sassolini', 0.35, (0.9, 0.7), None),
    ]),
    ('staccionate.png', 2, 2, [
        ('staccionata_dx', 1.3, (0.3, 2.4), (0.3, 2.4, 1.3)), ('staccionata_sx', 1.3, (2.4, 0.3), (2.4, 0.3, 1.3)),
        ('paletto', 1.3, (0.3, 0.3), None), ('corda_pali', 0.9, (0.3, 2.4), None),
    ]),
    ('piccoli.png', 4, 4, [
        ('conchiglia', 0.12, (0.3, 0.3), None), ('capasanta', 0.1, (0.3, 0.3), None), ('stella', 0.06, (0.35, 0.35), None), ('granchio', 0.15, (0.35, 0.3), None),
        ('ciottoli', 0.12, (0.45, 0.35), None), ('fiori_arancio', 0.35, (0.5, 0.4), None), ('margherite', 0.35, (0.5, 0.4), None), ('ciuffo', 0.3, (0.45, 0.4), None),
        ('ciuffo_alto', 0.55, (0.45, 0.4), None), ('felce', 0.45, (0.45, 0.4), None), ('funghi', 0.3, (0.35, 0.3), None), ('sasso_muschio', 0.3, (0.45, 0.4), None),
        ('gabbiano', 0.6, (0.5, 0.3), None), ('legnetto', 0.1, (0.9, 0.3), None), ('bottiglia', 0.12, (0.45, 0.25), None), ('vasetto', 0.35, (0.3, 0.3), None),
    ]),
    ('interni.png', 4, 4, [
        ('scaffale', 3.2, (0.5, 1.6), None), ('tavolo_tondo', 1.0, (1.1, 1.1), None), ('tavolo_quadro', 1.0, (1.0, 1.0), None), ('sedia_dx', 1.3, (0.6, 0.6), None),
        ('sedia_sx', 1.3, (0.6, 0.6), None), ('sgabello_bar', 1.0, (0.5, 0.5), None), ('barile_dentro', 1.1, (0.8, 0.8), None), ('palma_vaso', 2.6, (0.7, 0.7), None),
        ('tappeto', 0.03, (2.4, 1.6), None), ('radio', 1.3, (0.7, 0.5), None), ('casse_bottiglie', 1.2, (0.9, 0.9), None), ('quadro_pesce', 0.9, (1.0, 0.1), None),
        ('timone', 1.0, (1.0, 0.1), None), ('appendiabiti', 2.2, (0.5, 0.5), None), ('libreria', 1.8, (1.2, 0.4), None), ('lanterna', 0.9, (0.6, 0.6), None),
    ]),
]
# abitanti: file, [(nome, indice figura)], piede, scatola, quanto sporge il piede sotto il centro (× K × s).
# Figura 0 = il protagonista disegnato accanto per la scala: 2,5 unità.
FIGURE = [
    ('abitanti_barista.png', [('barista', 1), ('barista_2', 2)], (0.6, 0.6), (0.7, 0.7, 2.9), 0.3),
    ('abitanti_pescatore.png', [('pescatore', 1), ('pescatore_2', 2)], (0.9, 0.9), (0.9, 0.9, 2.3), 0.6),
]
ALTO_EROE = 2.5
# il passo: per direzione 5 figure in fila, la prima ferma (eroe_<D>), le altre il passo (eroe_<D>_1..4)
DIREZIONI = ['S', 'SE', 'E', 'NE', 'N']
# voga: due fotogrammi sulla stessa guida, barche in (-2.5, 2.5) e (2.5, -2.5)
VOGA = [('rema_giu.png', 'rema_giu', (4.0, 1.7)), ('rema_su.png', 'rema_su', (1.7, 4.0))]


def scontorna(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g  # quanto è magenta
    alfa = 1 - np.clip((m - 60) / 80, 0, 1)
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (1 - alfa)
    a[..., 0] -= spill; a[..., 2] -= spill
    return Image.fromarray(np.dstack([np.clip(a, 0, 255), alfa * 255]).astype(np.uint8), 'RGBA')


def senza_alone(im):
    """I pixel di bordo (semitrasparenti o vuoti) prendono il colore del pixel pieno più vicino:
    così, rimpicciolendo e filtrando, il bordo non tira mai verso il magenta o il nero."""
    a = np.asarray(im).copy()
    pieno = a[..., 3] > 230
    if pieno.all() or not pieno.any(): return im
    src = (~pieno).astype(np.uint8)
    _, lab = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
    zeri = np.flatnonzero(src.ravel() == 0)
    rgb = a[..., :3].reshape(-1, 3)
    vuoti = np.flatnonzero(src.ravel())
    rgb[vuoti] = rgb[zeri[lab.ravel()[vuoti] - 1]]
    a[..., :3] = rgb.reshape(a.shape[0], a.shape[1], 3)
    return Image.fromarray(a, 'RGBA')


def pulisci(im):
    """Toglie i pezzetti di un'altra cella entrati nel ritaglio: restano le macchie grandi."""
    a = np.asarray(im)
    n, lab, st, _ = cv2.connectedComponentsWithStats((a[..., 3] > 40).astype(np.uint8), 8)
    if n <= 2: return im
    grande = st[1:, cv2.CC_STAT_AREA].max()
    H, W = a.shape[:2]
    def al_bordo(i):
        x, y, w, h = st[i, cv2.CC_STAT_LEFT], st[i, cv2.CC_STAT_TOP], st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
        return x <= 1 or y <= 1 or x + w >= W - 1 or y + h >= H - 1
    # via i pezzetti e i pezzi di un'altra cella (toccano il bordo e non sono la macchia più grande)
    via = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < grande * 0.04 or (al_bordo(i) and st[i, cv2.CC_STAT_AREA] < grande)]
    b = a.copy(); b[np.isin(lab, via), 3] = 0
    return Image.fromarray(b, 'RGBA')


def scatola(im):
    return im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()


def salva(nome, im, s, ax, ay, piede, box, elenco, modo='piano', tetto=None):
    """Ritaglia al contenuto, porta a S_OUT px per unità e registra."""
    bb = scatola(im)
    pad = 4
    x0, y0 = max(0, bb[0] - pad), max(0, bb[1] - pad)
    x1, y1 = min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)
    im = senza_alone(im.crop((x0, y0, x1, y1))); ax -= x0; ay -= y0
    f = S_OUT / s
    w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(os.path.join(OUT, nome + '.webp'), 'WEBP', quality=92, method=6, exact=True)
    # quanto il disegno scende sotto la base (in unità a schermo): il terreno davanti a quella quota sta più vicino alla
    # camera di 1,73 volte tanto (camera a 30°), quindi il disegno va portato avanti almeno di così
    giu = max(0.0, (scatola(im)[3] - ay * f) / S_OUT)
    elenco[nome] = {'w': w, 'h': h, 's': S_OUT, 'ax': round(ax * f, 1), 'ay': round(ay * f, 1),
                    'piede': list(piede), 'scatola': list(box), 'modo': modo, 'avanti': round(1.75 * giu + 0.12, 2)}
    if tetto: elenco[nome]['tetto'] = list(tetto)


def su_guida(im, guida):
    """L'immagine generata può essere più grande della guida (ChatGPT dà 1254 al posto di 1024): scala e origine si allargano."""
    g = json.load(open(os.path.join(GUIDE, guida + '.json')))
    gw = Image.open(os.path.join(GUIDE, guida + '.png')).width
    k = im.width / gw
    return g['scala'] * k, (g['origine'][0] * k, g['origine'][1] * k), k


def maschera_guida(guida, k, box):
    """La sagoma grigia della guida (non magenta), alla misura dell'immagine generata, ritagliata come il pezzo."""
    g = Image.open(os.path.join(GUIDE, guida + '.png')).convert('RGB')
    g = g.resize((round(g.width * k), round(g.height * k)), Image.NEAREST).crop(box)
    a = np.asarray(g).astype(int)
    return ~((a[..., 0] > 200) & (a[..., 1] < 60) & (a[..., 2] > 200))


def registra(pezzo, guida_m, ax, ay, s):
    """La barca disegnata è un po' più grande e spostata rispetto al volume: si allinea lo scafo (larghezza e fondo)."""
    m = np.asarray(pezzo)[..., 3] > 40
    xs, ys = np.where(m.any(axis=0))[0], np.where(m.any(axis=1))[0]
    gx, gy = np.where(guida_m.any(axis=0))[0], np.where(guida_m.any(axis=1))[0]
    k = (xs.max() - xs.min()) / (gx.max() - gx.min())
    cx, cgx = (xs.max() + xs.min()) / 2, (gx.max() + gx.min()) / 2
    return cx + (ax - cgx) * k, ys.max() + (ay - gy.max()) * k, s * k


def da_guida(elenco):
    for file, nome, guida, (cx, cz), piede, box, tetto in DA_GUIDA:
        p = os.path.join(ASSET, file)
        if not os.path.exists(p): print('manca', file); continue
        im = Image.open(p)
        s, (ox, oy), _ = su_guida(im, guida)
        ax, ay = ox + (cx - cz) * math.cos(math.pi / 4) * s, oy + (cx + cz) * K * s
        salva(nome, pulisci(scontorna(im)), s, ax, ay, piede, box, elenco, 'scatola', tetto)
    for file, nome, guida, (cx, cz), piede, lato in BARCHE:
        p = os.path.join(ASSET, file)
        if not os.path.exists(p): print('manca', file); continue
        im = scontorna(Image.open(p))
        s, (ox, oy), k = su_guida(im, guida)
        meta = im.width // 2
        taglio = (0, 0, meta, im.height) if lato == 'sinistra' else (meta, 0, im.width, im.height)
        pezzo = pulisci(im.crop(taglio))
        ax, ay = ox + (cx - cz) * math.cos(math.pi / 4) * s - taglio[0], oy + (cx + cz) * K * s
        ax, ay, s2 = registra(pezzo, maschera_guida(guida, k, taglio), ax, ay, s)
        print(nome, 'registrata: scala ×%.3f' % (s2 / s))
        x0, x1, fondo = banda_rossa(pezzo)
        BANDE[nome] = {'x0': x0, 'x1': x1, 'fondo': fondo, 'ax': ax, 'ay': ay, 's': s2}
        salva(nome, pezzo, s2, ax, ay, piede, (piede[0], piede[1], 0.9), elenco)


def celle(im, col, righe):
    """Divide un foglio a griglia per macchie, non per righe dritte: ogni pezzo staccato del disegno va alla casella in cui
    cade il suo centro. ChatGPT disegna spesso la base di palme e alberi oltre il confine della casella: il taglio a griglia
    la mozzava dritta (e in gioco si vedeva)."""
    a = np.asarray(im)
    m = (a[..., 3] > 40).astype(np.uint8)
    k, et, st, ce = cv2.connectedComponentsWithStats(m, connectivity=8)
    cw, ch = im.width / col, im.height / righe
    di = np.full(k, -1)
    for i in range(1, k):
        if st[i, cv2.CC_STAT_AREA] < 25: continue
        di[i] = min(int(ce[i][1] // ch), righe - 1) * col + min(int(ce[i][0] // cw), col - 1)
    lab = di[et]
    out = []
    for c in range(col * righe):
        sel = lab == c
        if not sel.any(): out.append(None); continue
        ys, xs = np.where(sel)
        b = a.copy(); b[~sel, 3] = 0
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        out.append(Image.fromarray(b, 'RGBA').crop((x0, y0, x1, y1)))
    return out


def fogli(elenco):
    for file, col, righe, voci in FOGLI:
        p = os.path.join(ASSET, file)
        if not os.path.exists(p): print('manca', file); continue
        pezzi = celle(scontorna(Image.open(p)), col, righe)
        for i, (nome, alto, piede, box) in enumerate(voci):
            if nome == '-': continue
            cella = pezzi[i]
            if cella is None: print('vuota', nome); continue
            bb = scatola(cella)  # già isolata per macchie: niente pulisci (taglierebbe i pezzi sul bordo del ritaglio)
            alto_schermo = alto * C30 + (piede[0] + piede[1]) * K
            s = (bb[3] - bb[1]) / alto_schermo
            ax = (bb[0] + bb[2]) / 2
            ay = bb[3] - (piede[0] + piede[1]) / 2 * K * s
            salva(nome, cella, s, ax, ay, piede, box or (piede[0], piede[1], alto), elenco, 'scatola' if nome in PIATTI else 'piano')


def sagome(im, n):
    """Le n figure di una riga (fondo magenta): le n macchie più grandi, i pezzetti (lenza, galleggiante) alla più vicina."""
    a = (np.asarray(im)[..., 3] > 40).astype(np.uint8)
    k, et, st, ce = cv2.connectedComponentsWithStats(a, connectivity=8)
    ordine = sorted(range(1, k), key=lambda i: -st[i, cv2.CC_STAT_AREA])
    semi = sorted(ordine[:n], key=lambda i: ce[i][0])
    di = np.full(k, -1)
    for j, i in enumerate(semi): di[i] = j
    for i in ordine[n:]:
        if st[i, cv2.CC_STAT_AREA] >= 20: di[i] = int(np.argmin([abs(ce[i][0] - ce[q][0]) for q in semi]))
    lab = di[et]
    out = []
    for j in range(n):
        m = lab == j
        b = np.asarray(im).copy(); b[~m, 3] = 0
        ys, xs = np.where(m)
        out.append((Image.fromarray(b, 'RGBA'), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return out


def x_corpo(im, bb, da=0.15, a=0.55):
    """Centro orizzontale del busto (righe tra da e a dell'altezza): resta fermo mentre le gambe si muovono."""
    m = np.asarray(im)[..., 3] > 40
    h = bb[3] - bb[1]
    r = m[int(bb[1] + h * da):int(bb[1] + h * a)]
    xs = np.where(r.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2


def x_piedi(im, bb, quota=0.8):
    m = np.asarray(im)[..., 3] > 40
    h = bb[3] - bb[1]
    xs = np.where(m[int(bb[1] + h * quota):bb[3]].any(axis=0))[0]
    return (xs.min() + xs.max()) / 2


def figure(elenco):
    for file, scelte, piede, box, sotto in FIGURE:
        p = os.path.join(ASSET, file)
        if not os.path.exists(p): print('manca', file); continue
        im = scontorna(Image.open(p))
        fig = sagome(im, 1 + len(scelte))
        eroe = fig[0][1]
        s = (eroe[3] - eroe[1]) / (ALTO_EROE * C30 + 0.6 * K)
        for nome, i in scelte:
            f, bb = fig[i]
            alto = (bb[3] - bb[1]) / s
            print(f'{nome}: {alto / C30 * 1:.2f} unità a schermo, {(bb[3] - bb[1]) / (eroe[3] - eroe[1]):.2f} × il protagonista')
            salva(nome, f, s, x_piedi(f, bb), bb[3] - sotto * K * s, piede, box, elenco)


def strisce(elenco):
    for d in DIREZIONI:
        p = os.path.join(ASSET, f'passo_{d}.png')
        if not os.path.exists(p): print('manca', p); continue
        im = scontorna(Image.open(p))
        fig = sagome(im, 5)
        fermo = fig[0][1]
        s = (fermo[3] - fermo[1]) / (ALTO_EROE * C30 + 0.6 * K)
        fondo = max(bb[3] for _, bb in fig)
        nomi = [f'eroe_{d}'] + [f'eroe_{d}_{i}' for i in range(1, 5)]
        for nome, (f, bb) in zip(nomi, fig):
            salva(nome, f, s, x_corpo(f, bb), fondo - 0.3 * K * s, (0.6, 0.6), (0.7, 0.7, ALTO_EROE), elenco)
        print(d, 'altezze', [bb[3] - bb[1] for _, bb in fig])


def banda_rossa(pezzo):
    """La fascia rossa in fondo allo scafo (lunghezza della barca a schermo): x0, x1, fondo. Le scarpe rosse stanno più su."""
    a = np.asarray(pezzo).astype(int)
    al = a[..., 3] > 40
    ys = np.where(al.any(axis=1))[0]
    sotto = np.zeros_like(al); sotto[int(ys.min() + (ys.max() - ys.min()) * 0.6):] = True
    rosso = al & sotto & (a[..., 0] > 130) & (a[..., 0] - a[..., 1] > 60) & (a[..., 1] < 120)
    yy, xx = np.where(rosso)
    return xx.min(), xx.max(), yy.max()


def voga(elenco):
    """La barca con lui che rema: si porta alla misura della barca vuota (già registrata sul volume) usando la fascia
    rossa dello scafo, così salendo a bordo la barca non cambia misura né posto."""
    for file, nome, piede in VOGA:
        p = os.path.join(ASSET, file)
        if not os.path.exists(p): print('manca', file); continue
        vuota = BANDE['barca_giu' if nome == 'rema_giu' else 'barca_su']
        im = scontorna(Image.open(p))
        meta = im.width // 2
        for i in range(2):
            pezzo = pulisci(im.crop((0, 0, meta, im.height)) if i == 0 else im.crop((meta, 0, im.width, im.height)))
            x0, x1, fondo = banda_rossa(pezzo)
            k = (x1 - x0) / (vuota['x1'] - vuota['x0'])
            ax = (x0 + x1) / 2 + (vuota['ax'] - (vuota['x0'] + vuota['x1']) / 2) * k
            ay = fondo + (vuota['ay'] - vuota['fondo']) * k
            print(f'{nome}_{i + 1}: barca ×{k:.3f} rispetto a quella vuota')
            salva(f'{nome}_{i + 1}', pezzo, vuota['s'] * k, ax, ay, piede, (piede[0], piede[1], 2.0), elenco)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    elenco = {}
    da_guida(elenco); fogli(elenco); figure(elenco); strisce(elenco); voga(elenco)
    json.dump(elenco, open(os.path.join(OUT, 'elenco.json'), 'w'), indent=0)
    print(len(elenco), 'sprite')
    if '--controllo' in sys.argv:
        # foglio di controllo: ogni sprite con un puntino rosso sul piede
        tele = []
        for n, e in elenco.items():
            t = Image.open(os.path.join(OUT, n + '.webp')).convert('RGBA')
            bg = Image.new('RGBA', t.size, (240, 240, 230, 255)); bg.alpha_composite(t)
            arr = np.asarray(bg.convert('RGB')).copy()
            cv2.circle(arr, (int(e['ax']), int(e['ay'])), 5, (255, 0, 0), -1)
            tele.append(Image.fromarray(arr))
        W = 2400; x = y = rh = 0; pos = []
        for t in tele:
            t.thumbnail((300, 300))
            if x + t.width > W: x, y, rh = 0, y + rh + 8, 0
            pos.append((x, y)); x += t.width + 8; rh = max(rh, t.height)
        fo = Image.new('RGB', (W, y + rh), 'white')
        for t, p in zip(tele, pos): fo.paste(t, p)
        fo.save(sys.argv[sys.argv.index('--controllo') + 1])
