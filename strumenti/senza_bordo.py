#!/usr/bin/env python3
"""Toglie il contorno nero esterno da un ritaglio (concept/3d/input/<nome>.png): si sbucciano i pixel scuri sul bordo
della figura finché ce ne sono (al massimo 14 giri), le linee interne restano. Serve a SAM 3: il primo albero tondo,
col suo contorno spesso, l'ha letto come un adesivo piatto (28/10). Il contorno poi lo rifà il motore.
Esce <nome>_senza_bordo.png e la copia su bianco <nome>_senza_bordo_bianco.png.
Uso: <python del venv di fenaki> strumenti/senza_bordo.py albero_rosa albero_arancio
"""
import os
import sys
import cv2
import numpy as np
from PIL import Image

IN = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'concept', '3d', 'input')

for nome in sys.argv[1:]:
    a = np.array(Image.open(os.path.join(IN, nome + '.png')).convert('RGBA'))
    luma = a[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    pieno = a[..., 3] > 128
    via = 0
    for giro in range(14):
        fuori = cv2.dilate((~pieno).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        bordo = pieno & fuori & (luma < 75)
        if not bordo.any():
            break
        pieno &= ~bordo
        via += int(bordo.sum())
    # via i pezzetti rimasti staccati
    n, lab, st, _ = cv2.connectedComponentsWithStats(pieno.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:
            pieno[lab == i] = False
    a[..., 3] = np.where(pieno, 255, 0).astype(np.uint8)
    out = Image.fromarray(a, 'RGBA')
    out.save(os.path.join(IN, nome + '_senza_bordo.png'))
    bianco = Image.new('RGB', out.size, 'white'); bianco.paste(out, mask=out.split()[3])
    bianco.save(os.path.join(IN, nome + '_senza_bordo_bianco.png'))
    print(nome, 'giri', giro, 'pixel tolti', via)
