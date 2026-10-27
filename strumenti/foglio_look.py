#!/usr/bin/env python3
"""Il foglio della prova dei look, tutto alla stessa scala (il protagonista alto uguale in ogni riquadro):
in alto il moodboard nero 1 e il 2.5D di oggi, sotto le tre versioni (inchiostro, pixel, pixel col protagonista
disegnato), poi i primi piani del protagonista e, sotto ogni versione, ore, disegni e crediti.
Le foto vengono dal gioco (window.prova.foto, concept/foto/look_<look>.png a 1440×900 ×2) col protagonista nello stesso
punto; i costi da concept/costi.json.

Uso: <python del venv di fenaki> strumenti/foglio_look.py [uscita.jpg]
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(QUI, '..')
FOTO = os.path.join(R, 'concept', 'foto')
MOOD = os.path.expanduser('~/Desktop/JACK/_GITHUB/marea-stile-personaggio/moodboard/gen/mb_N1_scena.png')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'concept', '_FOGLIO_prova_look.jpg')
costi = json.load(open(os.path.join(R, 'concept', 'costi.json')))

# scala comune: il protagonista alto ALTO px (nel gioco a 1440×900 ×2 è alto 2,5 × 100,8 = 252 px: ×0,5 → 126)
ALTO = 126
PW, PH = 860, 560          # riquadro grande
ZW, ZH = 300, 330          # primo piano (×2 della scala comune)
CARTA, INCH, GRIGIO = (251, 241, 228), (32, 22, 16), (110, 96, 86)


def font(n, grassetto=False):
    for f in (['/System/Library/Fonts/Supplemental/Avenir Next.ttc'] if True else []):
        try:
            return ImageFont.truetype(f, n, index=8 if grassetto else 0)
        except Exception:
            pass
    return ImageFont.load_default()


F_T, F_S, F_P = font(46, True), font(26, True), font(21)


def gioco(look):
    im = Image.open(os.path.join(FOTO, f'look_{look}.png')).convert('RGB')
    s = ALTO / 252
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    cx, cy = im.width // 2, im.height // 2 - 40   # il protagonista è al centro (la camera lo segue), un po' più su
    grande = im.crop((cx - PW // 2, cy - PH // 2, cx + PW // 2, cy + PH // 2))
    vicino = im.crop((cx - ZW // 4, cy - 10 - ZH // 4 - 20, cx + ZW // 4, cy - 10 + ZH // 4 - 20)).resize((ZW, ZH), Image.NEAREST)
    return grande, vicino


def moodboard():
    im = Image.open(MOOD).convert('RGB')
    s = ALTO / 150                                  # nel moodboard lui è alto ~150 px su 1024
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    cx, cy = round(945 * s), round(535 * s)
    grande = im.crop((cx - PW // 2, cy - PH // 2, cx + PW // 2, cy + PH // 2))
    vicino = im.crop((cx - ZW // 4, cy - ZH // 4 - 20, cx + ZW // 4, cy + ZH // 4 - 20)).resize((ZW, ZH), Image.LANCZOS)
    return grande, vicino


def main():
    righe = [[('moodboard nero 1 (immagine AI, 26/10)', *moodboard(), None),
              ('il 2.5D di oggi (tutto disegnato)', *gioco('disegni'), costi.get('disegni'))],
             [('inchiostro (3D, contorni neri)', *gioco('inchiostro'), costi.get('inchiostro')),
              ('pixel (3D a pixel fini)', *gioco('pixel'), costi.get('pixel')),
              ('pixel + protagonista disegnato (Riccardo)', *gioco('sprite'), costi.get('sprite'))]]
    M, TESTO = 40, 230
    W = M + 3 * (PW + M)
    H = 170 + 2 * (60 + PH + 20 + TESTO) + 40
    fo = Image.new('RGB', (W, H), CARTA)
    d = ImageDraw.Draw(fo)
    d.text((M, 30), 'MAREA · la prova dei look: lo stesso porto, tre motori', font=F_T, fill=INCH)
    d.text((M, 96), costi.get('sottotitolo', ''), font=F_P, fill=GRIGIO)
    y = 170
    for riga in righe:
        x = M
        for titolo, grande, vicino, c in riga:
            d.text((x, y), titolo, font=F_S, fill=INCH)
            fo.paste(grande, (x, y + 44))
            d.rectangle((x - 1, y + 43, x + PW, y + 44 + PH), outline=INCH, width=2)
            # primo piano in basso a destra dentro il riquadro
            fo.paste(vicino, (x + PW - ZW - 10, y + 44 + PH - ZH - 10))
            d.rectangle((x + PW - ZW - 11, y + 44 + PH - ZH - 11, x + PW - 10, y + 44 + PH - 10), outline=INCH, width=3)
            ty = y + 44 + PH + 14
            for r in (c or {}).get('righe', []):
                d.text((x, ty), r, font=F_P, fill=INCH if r.startswith('·') is False else GRIGIO)
                ty += 30
            x += PW + M
        y += 60 + PH + 20 + TESTO
    fo.save(OUT, quality=88)
    print(OUT, fo.size)


main()
