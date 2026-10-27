#!/usr/bin/env python3
"""Il foglio per Jack della prova in stile «nero 1»: il gioco vero accanto alla scena del moodboard (mb_N1_scena.png)
alla stessa scala (il protagonista alto uguale), con le misure; poi altopiano, spiaggia, bar, barca e telefono.
Uscita: concept/_FOGLIO_prova_n1.jpg. Uso: python strumenti/foglio_n1.py"""
import os
from PIL import Image, ImageDraw, ImageFont

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
F = os.path.join(R, 'concept', 'foto')
N1 = os.path.expanduser('~/Desktop/JACK/_GITHUB/marea-stile-personaggio/moodboard/gen/mb_N1_scena.png')
CARTA, INK, GRIGIO = (251, 240, 222), (30, 20, 14), (120, 96, 84)
font = lambda s, b=False: ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', s, index=1 if b else 0)

# misure prese col righello (vedi _MEMORIA §13): px del protagonista nel gioco a 1440×900 e nel riferimento
EROE_GIOCO, EROE_RIF = 118, 170
CENTRO_GIOCO, CENTRO_RIF = (720, 400), (940, 530)  # dove sta il protagonista nelle due immagini
MISURE = [
    'Protagonista: 118 px su 900 = 13,1% dello schermo (regola 13-15%; nel moodboard 170 su 1024 = 16,6%). Testa con capelli 44%, come il modello.',
    'Porta del bar: 185 px = 1,57 volte lui (regola dell\'analisi: 1,6; nel moodboard la porta è più bassa, 1,15).',
    'Barista: 1,15 volte lui (come nel foglio abitanti del moodboard, 1,17). Pescatore seduto sulla cassetta: 0,8 volte lui (1,16 con la canna).',
    'Scala del mondo come l\'analisi: piastrella 1 unità, lui 2,5, porta 3,9, capanno 4,6 di muro, palme 5,5-7,5, alberi 6,4-7,2.',
    'Isola semplificata (26/10 notte): 30 oggetti invece di 95; disegni interi (le basi di palme e alberi erano mozzate dalla griglia), niente tagli dritti, dietro le cose si vede la sagoma.',
]


def ritaglio(im, centro, k, w, h):
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    cx, cy = round(centro[0] * k), round(centro[1] * k)
    x0 = min(max(0, cx - w // 2), im.width - w)
    y0 = min(max(0, cy - h // 2), im.height - h)
    return im.crop((x0, y0, x0 + w, y0 + h))


def apri(nome):
    return Image.open(os.path.join(F, nome + '.png')).convert('RGB')


W = 1660
blocchi = []
gioco, rif = apri('n1_pc_porto'), Image.open(N1).convert('RGB')
# 1) ritaglio 1:1 del gioco accanto al moodboard portato alla stessa misura del protagonista
blocchi.append(('Stessa scala, ritaglio 1:1 (il protagonista è alto uguale)', [
    (ritaglio(gioco, CENTRO_GIOCO, 1, 800, 560), 'il gioco (canvas a 1440×900, pixel veri)'),
    (ritaglio(rif, CENTRO_RIF, EROE_GIOCO / EROE_RIF, 800, 560), 'moodboard «nero 1» (mb_N1_scena), rimpicciolito a 0,69'),
]))
# 2) schermate intere alla stessa scala
k = 0.55
blocchi.append(('Lo schermo intero, stessa scala', [
    (gioco.resize((round(1440 * k), round(900 * k)), Image.LANCZOS), 'il gioco a 1440×900'),
    (rif.resize((round(rif.width * k * EROE_GIOCO / EROE_RIF), round(rif.height * k * EROE_GIOCO / EROE_RIF)), Image.LANCZOS), 'il moodboard'),
]))
blocchi.append(('Altopiano e spiaggia', [(apri(n).resize((800, 500), Image.LANCZOS), t) for n, t in (('n1_pc_altopiano', 'altopiano'), ('n1_pc_spiaggia', 'spiaggia di sotto'))]))
dentro = apri('n1_pc_dentro').crop((220, 0, 1220, 760)).resize((500, 380), Image.LANCZOS)
rema = apri('n1_pc_rema').crop((300, 280, 1100, 888)).resize((500, 380), Image.LANCZOS)
tel = [apri(n).resize((176, 380), Image.LANCZOS) for n in ('n1_tel_porto', 'n1_tel_sagoma', 'n1_tel_dentro')]
blocchi.append(('Dentro il bar, in barca, telefono 390×844', [(dentro, 'dentro il bar'), (rema, 'in barca (voga)'), (tel[0], 'telefono'), (tel[1], 'dietro il capanno'), (tel[2], 'telefono, bar')]))

H = 262 + sum(70 + max(im.height for im, _ in b) + 50 for _, b in blocchi) + 20
fo = Image.new('RGB', (W, H), CARTA)
d = ImageDraw.Draw(fo)
d.text((30, 22), 'MAREA · la prova del porto in stile «nero 1»', fill=INK, font=font(46, True))
for i, m in enumerate(MISURE):
    d.text((30, 92 + i * 32), m, fill=GRIGIO, font=font(22))
y = 262
for titolo, pezzi in blocchi:
    d.text((30, y), titolo, fill=INK, font=font(30, True))
    y += 50
    x = 30
    for im, t in pezzi:
        fo.paste(im, (x, y))
        d.rectangle((x - 1, y - 1, x + im.width, y + im.height), outline=INK, width=2)
        d.text((x, y + im.height + 8), t, fill=GRIGIO, font=font(20))
        x += im.width + 24
    y += max(im.height for im, _ in pezzi) + 70
fo.save(os.path.join(R, 'concept', '_FOGLIO_prova_n1.jpg'), quality=88)
print(fo.size)
