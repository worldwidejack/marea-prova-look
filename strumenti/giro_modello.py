"""Il giro giusto di un modello 3D: quello che, dalla camera del gioco (girata di 45°, alta 30°), fa la sagoma più simile
al disegno da cui è nato. SAM 3 non sa da che parte guardava il disegno; la parte davanti è quella copiata meglio, e la
camera del gioco deve vedere quella. Prova un giro ogni 5° e confronta le sagome (intersezione / unione, a misura
uguale). Esce il giro migliore e un'immagine: disegno | modello al giro migliore | modello a +30° e −30°.

Uso: Blender -b --factory-startup -P strumenti/giro_modello.py -- public/modelli/palma.glb public/sprite/palma.webp out.png
"""
import math
import sys
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, SPRITE, OUT = argv[0], argv[1], argv[2]
PASSO = 5

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
co = np.array([tuple(o.matrix_world @ v.co) for o in mesh for v in o.data.vertices])
mn, mx = co.min(0), co.max(0)
sc = bpy.context.scene
try:
    sc.render.engine = 'BLENDER_WORKBENCH'
except TypeError:
    pass
sc.display.shading.light = 'FLAT'
sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = sc.render.resolution_y = 256
sc.render.film_transparent = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = float(np.linalg.norm(mx - mn)) * 1.05
sc.camera = cam
mezzo = Vector(((mn + mx) / 2).tolist())


def foto(giro, lato=256):
    # il modello girato di «giro» attorno alla verticale = la camera girata di −giro
    sc.render.resolution_x = sc.render.resolution_y = lato
    az = math.radians(45 - giro)
    d = Vector((math.cos(math.radians(30)) * math.sin(az), -math.cos(math.radians(30)) * math.cos(az), math.sin(math.radians(30))))
    cam.location = mezzo + d * 60
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = '/tmp/_giro.png'
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load('/tmp/_giro.png', check_existing=False)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(lato, lato, 4)[::-1]
    bpy.data.images.remove(im)
    return px


def ritaglio(px, n=96):
    """la figura ritagliata al suo rettangolo e portata a n×n (proporzioni tenute, in basso al centro), RGBA"""
    ys, xs = np.nonzero(px[..., 3] > 0.5)
    p = px[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = p.shape[:2]
    s = n / max(h, w)
    yi = np.minimum((np.arange(int(h * s)) / s).astype(int), h - 1)
    xi = np.minimum((np.arange(int(w * s)) / s).astype(int), w - 1)
    q = p[yi][:, xi]
    out = np.zeros((n, n, 4), np.float32)
    oy, ox = n - q.shape[0], (n - q.shape[1]) // 2
    out[oy:oy + q.shape[0], ox:ox + q.shape[1]] = q
    return out


def caselle(q, k=12):
    """colore medio di ogni casella (k×k) dove c'è la figura, e quali caselle sono piene"""
    c = q.shape[0] // k
    a = (q[..., 3] > 0.5).astype(np.float32)
    somma = (q[..., :3] * a[..., None]).reshape(k, c, k, c, 3).sum((1, 3))
    peso = a.reshape(k, c, k, c).sum((1, 3))
    return somma / np.maximum(peso, 1)[..., None], peso > c * c * 0.3


# colori veri nella foto (niente curva del «view transform»): si confrontano con quelli del disegno
try:
    sc.view_settings.view_transform = 'Standard'
except TypeError:
    pass
sp = bpy.data.images.load(SPRITE, check_existing=False)
w, h = sp.size
spx = np.array(sp.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
rif = ritaglio(spx)
rifC, rifP = caselle(rif)
punti = []
for g in range(0, 360, PASSO):
    m = ritaglio(foto(g))
    sag = (rif[..., 3] > 0.5), (m[..., 3] > 0.5)
    iou = (sag[0] & sag[1]).sum() / max(1, (sag[0] | sag[1]).sum())
    # la sagoma da sola non decide per gli alberi tondi (quasi uguale da ogni lato): conta anche dove stanno luci e ombre
    mC, mP = caselle(m)
    entrambe = rifP & mP
    colore = float(np.linalg.norm(rifC[entrambe] - mC[entrambe], axis=1).mean()) if entrambe.any() else 1.0
    punti.append((iou - colore, g, iou, colore))
punti.sort(reverse=True)
migliore = punti[0][1]
print('GIRO', migliore, 'sagoma', round(float(punti[0][2]), 3), 'colore', round(punti[0][3], 3),
      'poi', [(g, round(float(v), 3)) for v, g, *_ in punti[1:6]])

# il foglio: disegno | giro migliore | +30 | −30 (la camera del gioco gira di ±30°)
lato = 360
pezzi = [spx]
for g in (migliore, migliore - 30, migliore + 30):
    pezzi.append(foto(g, lato))
tela = np.ones((lato, lato * 4, 4), np.float32) * np.array([0.84, 0.86, 0.82, 1], np.float32)
for i, p in enumerate(pezzi):
    a = p[..., 3:4]
    ys, xs = np.nonzero(p[..., 3] > 0.05)
    p = p[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    hh, ww = p.shape[:2]
    s = (lato - 20) / max(hh, ww)
    yi = np.minimum((np.arange(int(hh * s)) / s).astype(int), hh - 1)
    xi = np.minimum((np.arange(int(ww * s)) / s).astype(int), ww - 1)
    q = p[yi][:, xi]
    oy, ox = lato - 10 - q.shape[0], i * lato + (lato - q.shape[1]) // 2
    zona = tela[oy:oy + q.shape[0], ox:ox + q.shape[1]]
    zona[..., :3] = zona[..., :3] * (1 - q[..., 3:4]) + q[..., :3] * q[..., 3:4]
im = bpy.data.images.new('foglio', lato * 4, lato, alpha=True)
im.pixels.foreach_set(tela[::-1].ravel())
im.filepath_raw = OUT
im.file_format = 'PNG'
im.save()
print('FOGLIO', OUT)
