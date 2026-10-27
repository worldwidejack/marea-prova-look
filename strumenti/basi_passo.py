#!/usr/bin/env python3
"""Basi per i disegni del passo: per ogni direzione una tela 1536x1024 magenta con la stessa vista del modello (contorno nero)
ripetuta in 5 colonne, tutte alla stessa misura e sulla stessa linea dei piedi. ChatGPT la riceve come PRIMA immagine
(«Edit the FIRST image…»): la prima figura resta ferma, le altre 4 diventano il passo. Così testa e proporzioni non cambiano.
Uso: python strumenti/basi_passo.py → concept/n1/base/passo_<S|SE|E|NE|N>.png"""
import os
from PIL import Image

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
B = os.path.join(R, 'concept', 'n1', 'base')
W, H, ALTO, PIEDI = 1536, 1024, 540, 830
for n in ['S', 'SE', 'E', 'NE', 'N']:
    v = Image.open(os.path.join(B, f'vista_{n}.png'))
    k = ALTO / v.height
    v = v.resize((round(v.width * k), ALTO), Image.LANCZOS)
    tela = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    for i in range(5):
        cx = round(W / 5 * (i + 0.5))
        tela.alpha_composite(v, (cx - v.width // 2, PIEDI - v.height))
    tela.convert('RGB').save(os.path.join(B, f'passo_{n}.png'))
    print(n, v.size)
