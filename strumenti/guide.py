#!/usr/bin/env python3
"""Volumi grigi su fondo magenta, disegnati con la camera del gioco (ortografica, 45°, 30°: isometrico 2:1).

Codex li riceve come prima immagine e ci disegna sopra l'edificio o la barca: così angolo, scala e posizione
sono quelli del gioco. Per ogni guida scrive anche concept/guide/<nome>.json con la scala (px per unità) e
dove cade l'origine del mondo nell'immagine, che il gioco usa per piazzare lo sprite.

Uso:  python strumenti/guide.py
"""
import json
import math
import os
from PIL import Image, ImageDraw

QUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(QUI, '..', 'concept', 'guide')
C45, S45, C30, S30 = math.cos(math.pi / 4), math.sin(math.pi / 4), math.cos(math.pi / 6), math.sin(math.pi / 6)
MAGENTA = (255, 0, 255)


def proietta(x, y, z, s, ox, oy):
    """Mondo → pixel: x verso destra-giù, z verso sinistra-giù, y in alto."""
    return ox + (x - z) * C45 * s, oy + (x + z) * S45 * S30 * s - y * C30 * s


def scatola(d, p, x0, z0, x1, z1, y0, y1, tono=1.0, contorno=(60, 60, 60)):
    """Disegna una scatola: sopra, faccia +z (davanti-sinistra) e faccia +x (davanti-destra)."""
    g = lambda v: tuple(int(c * tono) for c in v)
    sopra = [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)]
    sx = [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)]
    dx = [p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)]
    d.polygon(sx, fill=g((200, 200, 200)), outline=contorno)
    d.polygon(dx, fill=g((165, 165, 165)), outline=contorno)
    d.polygon(sopra, fill=g((232, 232, 232)), outline=contorno)


def tetto_a_capanna(d, p, x0, z0, x1, z1, y0, y1, sporto=0.4):
    """Tetto a due falde col colmo lungo x."""
    zm = (z0 + z1) / 2
    a, b = x0 - sporto, x1 + sporto
    f0, f1 = z0 - sporto, z1 + sporto
    falda_davanti = [p(a, y0, f1), p(b, y0, f1), p(b, y1, zm), p(a, y1, zm)]
    timpano = [p(b, y0, f0), p(b, y0, f1), p(b, y1, zm)]
    d.polygon(timpano, fill=(150, 150, 150), outline=(60, 60, 60))
    d.polygon(falda_davanti, fill=(215, 215, 215), outline=(60, 60, 60))


def rettangolo_su_faccia_x(d, p, x, z0, z1, y0, y1, colore=(70, 70, 70)):
    d.polygon([p(x, y0, z0), p(x, y0, z1), p(x, y1, z1), p(x, y1, z0)], fill=colore)


def rettangolo_su_faccia_z(d, p, z, x0, x1, y0, y1, colore=(70, 70, 70)):
    d.polygon([p(x0, y0, z), p(x1, y0, z), p(x1, y1, z), p(x0, y1, z)], fill=colore)


class Registro:
    """Raccoglie i poligoni a scala 1 e origine 0; alla fine si scala per riempire la tela."""
    def __init__(self):
        self.poli = []

    def polygon(self, pts, fill=None, outline=None):
        self.poli.append((pts, fill, outline))


def nuova(nome, w, h, disegna, nota, riempi=0.8):
    reg = Registro()
    disegna(reg, lambda x, y, z: proietta(x, y, z, 1, 0, 0))
    xs = [x for pts, _, _ in reg.poli for x, _ in pts]
    ys = [y for pts, _, _ in reg.poli for _, y in pts]
    s = min(w * riempi / (max(xs) - min(xs)), h * riempi / (max(ys) - min(ys)))
    ox = w / 2 - (max(xs) + min(xs)) / 2 * s
    oy = h / 2 - (max(ys) + min(ys)) / 2 * s
    im = Image.new('RGB', (w, h), MAGENTA)
    d = ImageDraw.Draw(im)
    for pts, fill, outline in reg.poli:
        d.polygon([(ox + x * s, oy + y * s) for x, y in pts], fill=fill, outline=outline)
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, nome + '.png'))
    with open(os.path.join(OUT, nome + '.json'), 'w') as f:
        json.dump({'scala': round(s, 3), 'origine': [round(ox, 1), round(oy, 1)], 'nota': nota}, f, indent=1)


def bar(d, p):
    # bar sulla spiaggia: pianta 6 × 5, muri 4,4, tetto a capanna fino a 7, veranda coperta sul lato +x (verso il mare)
    scatola(d, p, 0, 0, 6, 5, 0, 4.4)
    rettangolo_su_faccia_x(d, p, 6, 1.9, 3.3, 0, 3.9)          # porta (1,4 × 3,9)
    rettangolo_su_faccia_x(d, p, 6, 0.5, 1.4, 1.6, 3.0, (110, 110, 110))   # finestra
    rettangolo_su_faccia_x(d, p, 6, 3.8, 4.7, 1.6, 3.0, (110, 110, 110))   # finestra
    rettangolo_su_faccia_z(d, p, 5, 1.0, 2.6, 1.6, 3.0, (110, 110, 110))   # finestra sul lato sinistro
    rettangolo_su_faccia_z(d, p, 5, 3.4, 5.0, 1.6, 3.0, (110, 110, 110))
    tetto_a_capanna(d, p, 0, 0, 6, 5, 4.4, 7.0)


def capanno(d, p):
    # capanno dei pescatori: pianta 4,5 × 3,5, muri 4,2, tetto piatto a tavole leggermente inclinato
    scatola(d, p, 0, 0, 4.5, 3.5, 0, 4.2)
    scatola(d, p, -0.3, -0.3, 4.8, 3.8, 4.2, 4.6, 1.05)
    rettangolo_su_faccia_z(d, p, 3.5, 1.2, 3.4, 0, 3.6)        # porta a due ante sul lato +z


def bancarella(d, p):
    # bancarella del pesce: banco 3 × 1,6 alto 1,3, quattro pali, tenda a 3,6
    scatola(d, p, 0, 0, 3, 1.6, 0, 1.3)
    for x, z in ((0.1, 0.1), (2.9, 0.1), (0.1, 1.5), (2.9, 1.5)):
        scatola(d, p, x - 0.08, z - 0.08, x + 0.08, z + 0.08, 1.3, 3.4, 0.8)
    scatola(d, p, -0.3, -0.3, 3.3, 1.9, 3.4, 3.6, 1.05)


def barca(d, p):
    # due barche a remi 4 × 1,7: a sinistra la prua verso giù-destra (+x), a destra la prua verso su-destra (-z)
    def scafo(px, pz, lungo_x):
        L, W, H = 4.0, 1.7, 0.75
        if lungo_x:
            pts_b = [(px - L / 2, pz - W / 2 + 0.25), (px + L / 2 - 0.9, pz - W / 2), (px + L / 2, pz), (px + L / 2 - 0.9, pz + W / 2), (px - L / 2, pz + W / 2 - 0.25)]
        else:
            pts_b = [(px - W / 2 + 0.25, pz + L / 2), (px - W / 2, pz - L / 2 + 0.9), (px, pz - L / 2), (px + W / 2, pz - L / 2 + 0.9), (px + W / 2 - 0.25, pz + L / 2)]
        bordo = [p(x, H, z) for x, z in pts_b]
        fondo = [p(x, 0, z) for x, z in pts_b]
        facce = []
        for i in range(len(pts_b)):
            j = (i + 1) % len(pts_b)
            q = [fondo[i], fondo[j], bordo[j], bordo[i]]
            area = sum(q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1] for k in range(4))
            if area > 0:
                facce.append((pts_b[i][0] + pts_b[j][0] + pts_b[i][1] + pts_b[j][1], q))
        for _, q in sorted(facce):
            d.polygon(q, fill=(170, 170, 170), outline=(60, 60, 60))
        d.polygon(bordo, fill=(225, 225, 225), outline=(60, 60, 60))
    scafo(-1.6, 1.6, True)
    scafo(3.2, -3.2, False)


def scafo(d, p, px, pz, lungo_x):
    L, W, H = 4.0, 1.7, 0.75
    if lungo_x:
        pts_b = [(px - L / 2, pz - W / 2 + 0.25), (px + L / 2 - 0.9, pz - W / 2), (px + L / 2, pz), (px + L / 2 - 0.9, pz + W / 2), (px - L / 2, pz + W / 2 - 0.25)]
    else:
        pts_b = [(px - W / 2 + 0.25, pz + L / 2), (px - W / 2, pz - L / 2 + 0.9), (px, pz - L / 2), (px + W / 2, pz - L / 2 + 0.9), (px + W / 2 - 0.25, pz + L / 2)]
    bordo = [p(x, H, z) for x, z in pts_b]
    fondo = [p(x, 0, z) for x, z in pts_b]
    facce = []
    for i in range(len(pts_b)):
        j = (i + 1) % len(pts_b)
        q = [fondo[i], fondo[j], bordo[j], bordo[i]]
        area = sum(q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1] for k in range(4))
        if area > 0:
            facce.append((pts_b[i][0] + pts_b[j][0] + pts_b[i][1] + pts_b[j][1], q))
    for _, q in sorted(facce):
        d.polygon(q, fill=(170, 170, 170), outline=(60, 60, 60))
    d.polygon(bordo, fill=(225, 225, 225), outline=(60, 60, 60))
    # il rematore seduto: una colonnina al centro
    scatola(d, p, px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 0.3, 1.9, 1.0)


def rema_giu(d, p):
    # due fotogrammi, prua verso giù-destra (+x); le barche sono distanti 7 unità lungo lo schermo
    scafo(d, p, -2.5, 2.5, True); scafo(d, p, 2.5, -2.5, True)


def rema_su(d, p):
    scafo(d, p, -2.5, 2.5, False); scafo(d, p, 2.5, -2.5, False)


def bancone(d, p):
    # bancone del bar dentro: 4,5 × 1,1 alto 1,5, con piano che sporge
    scatola(d, p, 0, 0, 4.5, 1.1, 0, 1.4)
    scatola(d, p, -0.15, -0.15, 4.65, 1.25, 1.4, 1.55, 1.05)


if __name__ == '__main__':
    nuova('bar', 1536, 1024, bar, 'origine = angolo dietro (0,0,0) della pianta 6×5')
    nuova('capanno', 1024, 1024, capanno, 'origine = angolo dietro della pianta 4,5×3,5', 0.7)
    nuova('bancarella', 1024, 1024, bancarella, 'origine = angolo dietro del banco 3×1,6', 0.65)
    nuova('barca', 1536, 1024, barca, 'due barche 4×1,7; sinistra prua +x, destra prua -z', 0.75)
    nuova('rema_giu', 1536, 1024, rema_giu, 'due fotogrammi: barca a (-2.5, 2.5) e a (2.5, -2.5), prua +x', 0.8)
    nuova('rema_su', 1536, 1024, rema_su, 'due fotogrammi: barca a (-2.5, 2.5) e a (2.5, -2.5), prua -z', 0.8)
    nuova('bancone', 1536, 1024, bancone, 'origine = angolo dietro del bancone 4,5×1,1', 0.7)
    print(sorted(os.listdir(OUT)))
