#!/usr/bin/env python3
"""Prova delle armi a strati (29/10): dai fogli di Codex (concept/armi/fogli/<vista>_leggera-pesante-onda.png) agli sprite
del banco (public/sprite_armi/), leggendo i segnaposto di ciano puro e togliendoli.

Righe del foglio: 1 camminata con l'arma leggera (bastone nel pugno destro, punta avanti e in giù), 2 camminata con l'arma
pesante in spalla (bastone tenuto in basso con due mani), 3 onda energetica (palla di ciano fra le mani).
Per ogni disegno:
- bastone → «presa» (dove sta la mano, in pixel dello sprite), «ang» (angolo sullo schermo, verso la punta), «lungo»;
- uno sprite «_sopra»: i pixel del corpo che stanno DAVANTI all'arma (il pugno attorno al manico, e il corpo dove Codex
  ha nascosto il bastone perché passava dietro). Il gioco disegna: sprite, arma 3D, sprite «_sopra»;
- palla → «palla» (centro e raggio in pixel dello sprite), dove il gioco mette l'effetto;
- il ciano si toglie: fuori dal corpo diventa trasparente, sopra il corpo si riempie coi colori attorno.
Scala, tavolozza e contorno come tools/sprite/pixel.py (la stessa tavolozza di F3), così questi sprite stanno accanto
alla camminata di prima.

Uso: <fenaki-python> strumenti/armi.py [--controllo]   (--controllo: un foglio ingrandito in concept/armi/_controllo.png)
"""
import glob
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAREA = os.environ.get('MAREA', os.path.expanduser('~/Desktop/JACK/_GITHUB/marea/.claude/worktrees/prova-armi'))
sys.path.insert(0, os.path.join(MAREA, 'tools', 'sprite'))
from pixel import celle, da_esadecimale, quantizza, rimpicciolisci  # noqa: E402

MOSSE = ['leggera', 'pesante', 'onda']
ALTO = 48
TAVOLOZZA = os.path.join(MAREA, 'assets', 'concept', 'sprite', 'protagonista', 'sprite', 'tavolozza.json')


def ciano(rgba):
    r, g, b, a = (rgba[..., i].astype(int) for i in range(4))
    # anche il ciano chiaro che Codex mette a volte in punta o nel pugno (r ~150)
    return (a > 128) & (g > 150) & (b > 150) & (r < np.minimum(g, b) - 50) & (np.abs(g - b) < 70)


def togli_ciano(rgba, C, corpo):
    """Il ciano sopra il corpo si riempie coi colori attorno, quello fuori diventa trasparente."""
    # il bordo del bastone (ciano scuro, ciano mischiato al magenta) non passa il filtro del colore: si allarga di qualche
    # pixel e si toglie anche quello; il pugno che ne perde un po' si riempie dai pixel attorno
    e = max(3, int(round(rgba.shape[0] * 0.012)) | 1)
    C = cv2.dilate(C.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (e, e))) > 0
    corpo = corpo & ~C
    k = max(5, int(round(rgba.shape[0] * 0.09)) | 1)  # largo quanto il bastone allargato: lo richiude dentro i capelli
    chiuso = cv2.morphologyEx(corpo.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
    dentro = C & chiuso & (rgba[..., 3] > 128)
    out = rgba.copy()
    if dentro.any():
        rgb = np.ascontiguousarray(out[..., :3])
        out[..., :3] = cv2.inpaint(rgb, dentro.astype(np.uint8), 5, cv2.INPAINT_TELEA)
    out[C & ~dentro, 3] = 0
    # le briciole di bastone rimaste staccate dal corpo
    n, lab, st, _ = cv2.connectedComponentsWithStats((out[..., 3] > 128).astype(np.uint8), connectivity=8)
    if n > 2:
        grande = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        for i in range(1, n):
            if i != grande and st[i, cv2.CC_STAT_AREA] < st[grande, cv2.CC_STAT_AREA] * 0.03:
                out[lab == i, 3] = 0
    return out


def bastone(C, corpo, mossa, alto_fig):
    """Presa, direzione e lunghezza del bastone (pixel del foglio) e la maschera di chi gli sta davanti."""
    ys, xs = np.nonzero(C)
    if len(xs) < 12:
        return None, np.zeros_like(corpo)
    P = np.stack([xs, ys], 1).astype(np.float64)
    c = P.mean(0)
    u = np.linalg.svd(P - c, full_matrices=False)[2][0]
    t = (P - c) @ u
    A, B = c + u * t.min(), c + u * t.max()
    # la presa: leggera = l'estremo in alto (punta avanti e in giù), pesante = quello in basso (in spalla verso l'alto);
    # poi conta anche il corpo attorno (il pugno)
    r = max(4, int(alto_fig * 0.06))

    def corpo_attorno(p):
        x, y = int(round(p[0])), int(round(p[1]))
        z = corpo[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1]
        return z.mean() if z.size else 0

    regola = (A[1] < B[1]) if mossa == 'leggera' else (A[1] > B[1])
    sa, sb = corpo_attorno(A) + (0.35 if regola else 0), corpo_attorno(B) + (0 if regola else 0.35)
    G, T = (A, B) if sa >= sb else (B, A)
    d = (T - G) / max(1e-6, np.linalg.norm(T - G))
    L = float(np.linalg.norm(T - G))
    # dove il bastone si vede lungo la sua linea (dal pugno alla punta), a passi di un pixel del foglio
    spesso = max(3, int(alto_fig * 0.025))
    Cd = cv2.dilate(C.astype(np.uint8), np.ones((spesso * 2 + 1,) * 2, np.uint8)) > 0
    H, W = C.shape
    n = int(L) + 1
    vis = np.zeros(n, bool)
    for i in range(n):
        x, y = G + d * i
        xi, yi = int(round(x)), int(round(y))
        vis[i] = 0 <= xi < W and 0 <= yi < H and Cd[yi, xi]
    coda = vis[max(0, int(n * 0.8)):].mean() > 0.5 if n else True
    # chi sta davanti all'arma: il pugno attorno alla presa e il corpo dove il bastone non si vede (passava dietro)
    YY, XX = np.mgrid[0:H, 0:W]
    dx, dy = XX - G[0], YY - G[1]
    tt = dx * d[0] + dy * d[1]
    dist = np.abs(dx * d[1] - dy * d[0])
    idx = np.clip(tt.astype(int), 0, n - 1)
    vis_p = np.where(tt > L, coda, vis[idx])
    pugno = (dx ** 2 + dy ** 2) < (alto_fig * 0.07) ** 2
    davanti = corpo & (pugno | ((tt > 0) & ~vis_p & (dist < alto_fig * 0.2)))
    return {'G': G, 'ang': float(np.arctan2(d[1], d[0])), 'L': L}, davanti


def palla(C):
    if C.sum() < 6:
        return None
    ys, xs = np.nonzero(C)
    return {'c': np.array([xs.mean(), ys.mean()]), 'r': float(np.sqrt(len(xs) / np.pi))}


def main():
    pal = np.array([da_esadecimale(x) for x in json.load(open(TAVOLOZZA, encoding='utf-8'))], dtype=np.float64)
    fogli = sorted(glob.glob(os.path.join(QUI, 'concept', 'armi', 'fogli', '*_leggera-pesante-onda.png')))
    out = os.path.join(QUI, 'public', 'sprite_armi')
    os.makedirs(out, exist_ok=True)
    p_el = os.path.join(out, 'elenco.json')
    elenco = json.load(open(p_el, encoding='utf-8')) if os.path.exists(p_el) else {}
    avvisi, controllo = [], []
    for f in fogli:
        vista = os.path.basename(f).split('_')[0]
        cs = celle(Image.open(f), 3, 4)
        piene = [c for c in cs if c]
        if len(piene) < 12:
            avvisi.append(f'{vista}: {12 - len(piene)} celle vuote')
        for c in piene:
            C = ciano(c['rgba'])
            corpo = (c['rgba'][..., 3] > 128) & ~C
            ys = np.nonzero(corpo.any(1))[0]
            c['C'], c['corpo'] = C, corpo
            c['alto_fig'] = (ys.max() - ys.min() + 1) if len(ys) else c['rgba'].shape[0]
            c['fondo_corpo'] = c['fondo'] - (c['rgba'].shape[0] - 1 - (ys.max() if len(ys) else c['rgba'].shape[0] - 1))
        # scala: la figura (senza bastone) più alta della prima riga = 48 px, come la camminata di F3
        metro = max(c['alto_fig'] for c in piene if c['riga'] == 0)
        s = ALTO / metro
        basi = {r: max(c['fondo_corpo'] for c in piene if c['riga'] == r) for r in range(3)}
        for c in piene:
            mossa, n = MOSSE[c['riga']], c['col'] + 1
            nome = f'{vista}_{mossa}_{n}'
            info, davanti, bolla = None, None, None
            if mossa == 'onda':
                bolla = palla(c['C'])
                if bolla is None:
                    avvisi.append(f'{nome}: niente palla di ciano')
            else:
                info, davanti = bastone(c['C'], c['corpo'], mossa, metro)
                if info is None:
                    avvisi.append(f'{nome}: niente bastone (nascosto dal corpo?)')
            pulito = togli_ciano(c['rgba'], c['C'], c['corpo'])
            # via le righe e le colonne rimaste vuote (il bastone fuori dal corpo): la tela finisce sotto i piedi
            ya, xa = (np.nonzero(pulito[..., 3] > 128)[i] for i in (0, 1))
            y0, y1, x0, x1 = ya.min(), ya.max() + 1, xa.min(), xa.max() + 1
            fondo = c['fondo'] - (pulito.shape[0] - y1)
            pulito, davanti = pulito[y0:y1, x0:x1], (davanti[y0:y1, x0:x1] if davanti is not None else None)
            if info is not None:
                info['G'] = info['G'] - (x0, y0)
            if bolla is not None:
                bolla['c'] = bolla['c'] - (x0, y0)
            C2, M2 = rimpicciolisci(pulito, s)
            h2, w2 = M2.shape
            sx, sy = w2 / pulito.shape[1], h2 / pulito.shape[0]
            giu = round((basi[c['riga']] - fondo) * s)
            tela = quantizza({'C': C2, 'M': M2, 'giu': max(0, giu)}, pal)
            Image.fromarray(tela, 'RGBA').save(os.path.join(out, nome + '.png'))
            H2, W2 = tela.shape[:2]
            voce = {'w': W2, 'h': H2, 's': 19.2, 'ax': W2 // 2, 'ay': H2 - 1, 'piede': [0.8, 0.8], 'scatola': [0.8, 0.8, 2.5],
                    'modo': 'piano', 'avanti': 0.3}
            if info is not None:
                im_d = Image.fromarray((davanti * 255).astype(np.uint8)).resize((w2, h2), Image.BOX)
                Md = (np.array(im_d) > 100) & M2
                sopra = tela.copy()
                sopra[..., 3] = 0
                sopra[1:1 + h2, 1:1 + w2, 3] = np.where(Md, 255, 0)
                Image.fromarray(sopra, 'RGBA').save(os.path.join(out, nome + '_sopra.png'))
                elenco[nome + '_sopra'] = dict(voce)
                G = info['G']
                voce['presa'] = [round(G[0] * sx + 1, 2), round(G[1] * sy + 1, 2)]
                voce['ang'] = round(info['ang'], 3)
                voce['lungo'] = round(info['L'] * sx, 1)
            if bolla is not None:
                voce['palla'] = [round(bolla['c'][0] * sx + 1, 2), round(bolla['c'][1] * sy + 1, 2), round(bolla['r'] * sx, 2)]
            elenco[nome] = voce
            controllo.append((nome, tela, voce))
    with open(p_el, 'w', encoding='utf-8') as fp:
        json.dump(dict(sorted(elenco.items())), fp, indent=0)
    print(f'{len(controllo)} sprite da {len(fogli)} fogli → {out}')
    for a in avvisi:
        print('  ! ' + a)
    if '--controllo' in sys.argv:
        foglio_controllo(controllo, os.path.join(QUI, 'concept', 'armi', '_controllo.png'))


def foglio_controllo(voci, dove, z=5):
    """Gli sprite ingranditi con la presa (punto rosso), la direzione (linea gialla) e la palla (cerchio)."""
    viste = sorted({n.split('_')[0] for n, _, _ in voci}, key=lambda v: ['S', 'SSE', 'SE', 'ESE', 'E', 'ENE', 'NE', 'NNE', 'N'].index(v))
    cw, ch = 40 * z, 62 * z
    im = Image.new('RGB', (cw * 12, ch * len(viste)), (245, 240, 232))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(im)
    for nome, tela, v in voci:
        vista, mossa, n = nome.split('_')
        r, k = viste.index(vista), MOSSE.index(mossa) * 4 + int(n) - 1
        sp = Image.fromarray(tela, 'RGBA').resize((tela.shape[1] * z, tela.shape[0] * z), Image.NEAREST)
        ox, oy = k * cw + (cw - sp.width) // 2, r * ch + ch - sp.height - 4
        im.paste(sp, (ox, oy), sp)
        if 'presa' in v:
            gx, gy = ox + v['presa'][0] * z, oy + v['presa'][1] * z
            dr.line([gx, gy, gx + np.cos(v['ang']) * 22 * z, gy + np.sin(v['ang']) * 22 * z], fill=(230, 190, 20), width=3)
            dr.ellipse([gx - 6, gy - 6, gx + 6, gy + 6], fill=(220, 30, 30))
        if 'palla' in v:
            px, py, pr = ox + v['palla'][0] * z, oy + v['palla'][1] * z, max(4, v['palla'][2] * z)
            dr.ellipse([px - pr, py - pr, px + pr, py + pr], outline=(30, 160, 220), width=3)
        dr.text((k * cw + 4, r * ch + 2), nome, fill=(90, 80, 70))
    im.save(dove)
    print('controllo →', dove)


if __name__ == '__main__':
    main()
