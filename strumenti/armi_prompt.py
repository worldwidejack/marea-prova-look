#!/usr/bin/env python3
"""Prova delle armi a strati e dell'onda energetica (29/10): i prompt per Codex, uno per vista, in concept/armi/lavori.txt.

Ogni foglio = una vista, 4 colonne × 3 righe: camminata con l'arma leggera, camminata con l'arma pesante in spalla, onda
energetica. L'arma e la palla d'energia sono segnaposto di ciano puro (#00FFFF): armi.py li legge (presa, angolo, cosa sta
davanti) e li toglie; il gioco ci mette il modello 3D dell'arma o l'effetto. Allegati: la vista (o le due viste) del
modello di F3, il disegno approvato e, per ultimo, il foglio a pixel approvato della stessa vista (camminata, capriola,
pozione): così la camminata nuova è quella di prima e il disegnatore è «lo stesso».

Uso: python strumenti/armi_prompt.py   poi   <fenaki-python> <marea>/tools/sprite/genera.py concept/armi
"""
import os
import sys

QUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# la cartella di MAREA (serve tools/sprite e assets/concept/personaggio): $MAREA, sennò ../marea accanto a questa
MAREA = os.environ.get('MAREA') or next((p for p in (os.path.join(os.path.dirname(QUI), 'marea'),
                                                     os.path.expanduser('~/Desktop/JACK/_GITHUB/marea/.claude/worktrees/prova-armi'))
                                         if os.path.exists(os.path.join(p, 'tools', 'sprite', 'pixel.py'))), '')
if not MAREA:
    sys.exit('manca MAREA: clona worldwidejack/marea accanto a questa cartella (../marea) o dai MAREA=<cartella di marea>')
sys.path.insert(0, os.path.join(MAREA, 'tools', 'sprite'))
from comune import CODICI, GIRO2, VISTE_MODELLO  # noqa: E402
from prompt import DALL_ALTO, FRASE, STILE  # noqa: E402

PERS = os.path.join(MAREA, 'assets', 'concept', 'personaggio')
DESC = ('side-swept dark-brown hair with pointed locks, the big head about 45 % of his height on a short body, light tan '
        'skin, plain white T-shirt, deep-teal shorts, brick-red sneakers with cream soles')

CIANO = ('THE CYAN PLACEHOLDERS: pure flat cyan #00FFFF is used ONLY for the placeholder rod and the placeholder ball '
         'described in the rows, always ONE solid colour with no outline, no shading, no highlight and no glow; cyan appears '
         'nowhere else in the image. Draw the body correctly around them: the fists closed around the rod, and the parts of '
         'the rod that are behind his body simply not drawn.')
RIGHE = [
    'ROW 1 = WALK CYCLE CARRYING A ONE-HANDED WEAPON, 4 frames: exactly the same walking legs as the walk of the last '
    'attached sheet (right foot forward contact, passing pose with the legs together, left foot forward contact, passing pose '
    'with the legs together), the left arm swinging, while his RIGHT fist holds a straight rigid cyan rod like the hilt of a '
    'sword: 2 pixels thick, about as long as his legs, it starts inside his right fist and points forward and DOWN at about '
    '45 degrees, nothing of it sticks out on the other side of the fist; the right arm hangs relaxed and keeps the rod steady.',
    'ROW 2 = WALK CYCLE CARRYING A HEAVY TWO-HANDED WEAPON ON THE SHOULDER, 4 frames: the same walking legs as row 1, while '
    'BOTH fists, close together in front of his chest, hold the LOWER end of a straight rigid cyan rod 2 pixels thick and about '
    'as long as his whole body; the rod rests on his RIGHT shoulder and points UP and BACKWARD past his head; the arms stay '
    'still holding it while the legs walk.',
    'ROW 3 = ENERGY WAVE ATTACK like a famous anime energy blast, 4 frames: 1) feet wide apart in a low stance, both hands '
    'cupped together at his right hip with a small solid cyan ball (about 4 pixels) between the palms; 2) deeper crouch, '
    'body twisted back, hair blown upward by the power, the cyan ball between the cupped hands bigger (about 7 pixels); 3) '
    'thrusting both arms straight forward, palms open and pushed together, the cyan ball (about 7 pixels) right at the '
    'palms; 4) holding the push leaning forward, front knee bent, the cyan ball at the palms. Only the ball, no beam, no rays, '
    'no sparks: the effect is added later.',
]


def riga(vista):
    if vista in VISTE_MODELLO:
        rif = [os.path.join(PERS, f'F3_vista_{vista}.jpg')]
        view = f'VIEW: {FRASE[vista].format(he="he", his="his")}, {DALL_ALTO} (the FIRST image shows this view).'
    else:
        rif = [os.path.join(PERS, f'F3_vista_{v}.jpg') for v in GIRO2[vista][0]]
        view = f'VIEW: {FRASE[vista].format(he="he", his="his")}, {DALL_ALTO}.'
    rif += [os.path.join(PERS, 'F3_design.jpg'), os.path.join(QUI, 'concept', 'sprite_pixel', f'pixel_{vista}.png')]
    chi = (f'{len(rif)} images are attached: first the character model seen from the needed angle(s), then the approved '
           f'character design, and LAST the approved pixel art sheet of this SAME character in this SAME view (rows: walk, '
           f'dash with a roll, drinking a potion). Copy EXACTLY the last sheet: the same character ({DESC}), the same pixel '
           'size, palette, 1-pixel dark outline, head size, proportions and figure size; it must look drawn by the same artist.')
    layout = ('LAYOUT: one image, a grid of 4 columns x 3 rows = 12 frames on a flat pure magenta background #FF00FF (no floor, '
              'no shadow, no text, no grid lines), each frame the same size, the character the same size in every frame and '
              'his feet on the same baseline in every cell of a row, nothing touching the cell borders, a wide empty magenta '
              'gap between the rows (no hair, rod or foot crosses into another row).')
    fine = 'All 12 frames in the SAME view and the same pixel scale as the last attached sheet.'
    testo = ' '.join([STILE, view, chi, layout, CIANO] + RIGHE + [fine])
    return f"{vista}_leggera-pesante-onda|{','.join(rif)}|{testo}"


def main():
    dove = os.path.join(QUI, 'concept', 'armi')
    os.makedirs(os.path.join(dove, 'fogli'), exist_ok=True)
    viste = sys.argv[1].split(',') if len(sys.argv) > 1 else CODICI
    righe = [riga(v) for v in viste]
    for r in righe:
        for f in r.split('|')[1].split(','):
            assert os.path.exists(f), f
    with open(os.path.join(dove, 'lavori.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(righe) + '\n')
    print(len(righe), 'fogli in', os.path.join(dove, 'lavori.txt'))


if __name__ == '__main__':
    main()
