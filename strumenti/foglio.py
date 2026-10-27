#!/usr/bin/env python3
"""Il foglio per Jack: il gioco vero accanto ai fotogrammi del riferimento, alla stessa scala (personaggio ~13% dell'altezza),
più il telefono e l'interno del bar. Uscita: concept/_FOGLIO_prova_st.jpg"""
import os
from PIL import Image, ImageDraw, ImageFont

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
F = os.path.join(R, 'concept', 'foto')
COPPIE = [
    ('f_pc_spiaggia.png', 't_57.5.jpg', 'Il porto e la spiaggia'),
    ('f_pc_altopiano.png', 't_30.5.jpg', "L'altopiano"),
    ('f_pc_rema.png', 't_47.5.jpg', 'In barca (il riferimento qui è più zoomato: minigioco della pesca)'),
]
ALTO = 640
CARTA, INK = (255, 246, 228), (90, 58, 36)
font = lambda s: ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', s)
righe = []
for g, r, t in COPPIE:
    a, b = Image.open(os.path.join(F, g)).convert('RGB'), Image.open(os.path.join(R, 'rif_studio', r)).convert('RGB')
    righe.append((a.resize((round(a.width * ALTO / a.height), ALTO), Image.LANCZOS), b.resize((round(b.width * ALTO / b.height), ALTO), Image.LANCZOS), t))
W = max(a.width + b.width for a, b, _ in righe) + 60
tel = [Image.open(os.path.join(F, n)).convert('RGB') for n in ('f_tel_spiaggia.png', 'f_tel_dentro.png')]
dentro = Image.open(os.path.join(F, 'f_pc_dentro.png')).convert('RGB')
HT = 760
H = 150 + len(righe) * (ALTO + 70) + HT + 90
fo = Image.new('RGB', (W, H), CARTA)
d = ImageDraw.Draw(fo)
d.text((20, 18), 'MAREA · prova «famiglia Sunny Trails»', fill=INK, font=font(44))
d.text((20, 80), 'A sinistra il gioco vero (1440×900), a destra il trailer di Sunny Trails, alla stessa scala: il personaggio è il 13% dello schermo in entrambi.', fill=INK, font=font(24))
y = 150
for a, b, t in righe:
    d.text((20, y), t, fill=INK, font=font(28))
    d.text((40 + a.width, y + 4), 'Sunny Trails (trailer)', fill=(150, 110, 80), font=font(24))
    fo.paste(a, (20, y + 44)); fo.paste(b, (40 + a.width, y + 44))
    y += ALTO + 70
d.text((20, y), 'Telefono 390×844 (fuori e dentro il bar) · dentro il bar su PC', fill=INK, font=font(28))
x = 20
for im in tel + [dentro]:
    im = im.resize((round(im.width * HT / im.height), HT), Image.LANCZOS)
    fo.paste(im, (x, y + 44)); x += im.width + 20
fo.save(os.path.join(R, 'concept', '_FOGLIO_prova_st.jpg'), quality=88)
print(fo.size)
