#!/usr/bin/env python3
"""Foglio di confronto: il gioco accanto ai fotogrammi del riferimento, alla stessa altezza (stessa scala del personaggio).

Uso: python strumenti/confronto.py uscita.jpg gioco1.png:rif1.jpg [gioco2.png:rif2.jpg ...] [--titolo "..."]
"""
import sys
from PIL import Image, ImageDraw, ImageFont

ALTO = 720
args = [a for a in sys.argv[2:] if not a.startswith('--')]
righe = []
for coppia in args:
    g, r = coppia.split(':')
    a, b = Image.open(g).convert('RGB'), Image.open(r).convert('RGB')
    a = a.resize((round(a.width * ALTO / a.height), ALTO), Image.LANCZOS)
    b = b.resize((round(b.width * ALTO / b.height), ALTO), Image.LANCZOS)
    righe.append((a, b))
W = max(a.width + b.width for a, b in righe) + 60
H = sum(ALTO + 60 for _ in righe) + 20
fo = Image.new('RGB', (W, H), (255, 246, 228))
d = ImageDraw.Draw(fo)
try: font = ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', 26)
except Exception: font = ImageFont.load_default()
y = 20
for a, b in righe:
    d.text((20, y), 'MAREA, il gioco vero', fill=(90, 58, 36), font=font)
    d.text((40 + a.width, y), 'Sunny Trails (trailer)', fill=(90, 58, 36), font=font)
    fo.paste(a, (20, y + 36)); fo.paste(b, (40 + a.width, y + 36))
    y += ALTO + 60
fo.save(sys.argv[1], quality=90)
print(sys.argv[1], fo.size)
