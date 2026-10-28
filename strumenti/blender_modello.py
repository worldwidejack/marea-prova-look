"""Un modello 3D dall'AI (Hunyuan LowPoly da Higgsfield) pronto per la prova dei look, in Blender da riga di comando:
- una mesh sola, vertici saldati (niente crepe lungo le cuciture), girata (--giro, gradi attorno alla verticale),
  portata alla misura (--alto H oppure --piede X Z, in unità di mondo), base a terra e centro della pianta nell'origine;
- texture ridotta alla tavolozza del disegno nero 1 da cui nasce (--tavolozza file.json di strumenti/tavolozza.py):
  ogni pixel prende il colore più vicino (in Lab), così restano tinte piatte e linee e ombre le fa il motore;
- texture a --tex px (512 di serie), glb con texture WebP.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P strumenti/blender_modello.py -- \
       in.glb out.glb --tavolozza concept/3d/tavolozze/bar.json --piede 6 5 [--giro 0] [--tex 512] [--anteprima a.png]
"""
import json
import math
import sys
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
IN, OUT = argv[0], argv[1]


def opz(nome, n=1, tipo=float, base=None):
    if nome not in argv:
        return base
    i = argv.index(nome)
    v = [tipo(x) for x in argv[i + 1:i + 1 + n]]
    return v if n > 1 else v[0]


TAVOLOZZA = opz('--tavolozza', tipo=str)
GIRO = opz('--giro', base=0.0)
ALTO = opz('--alto')
PIEDE = opz('--piede', 2)
TEX = int(opz('--tex', base=512))
TRI = opz('--tri', tipo=int)            # triangoli voluti (Decimate): per i modelli densi (SAM 3 arriva a 24.000)
INCLINA = opz('--inclina', base=0.0)    # gradi attorno a x: raddrizza un modello nato da un disegno visto dall'alto
ANTEPRIMA = opz('--anteprima', tipo=str)


def lab(rgb):
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(np.maximum(xyz, 0)), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# tutto in una mesh, con le trasformazioni dentro i vertici (transform_apply da script a volte non gira: si usa la matrice)
for o in mesh:
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT')
for o in mesh:
    o.select_set(True)
bpy.context.view_layer.objects.active = mesh[0]
if len(mesh) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in list(bpy.context.scene.objects):
    if o != ob:
        bpy.data.objects.remove(o, do_unlink=True)
me = ob.data

# saldatura dei vertici doppi (le cuciture UV restano: le UV stanno sugli angoli delle facce, non sui vertici)
bm = bmesh.new()
bm.from_mesh(me)
prima = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(me)
bm.free()

# meno triangoli (dopo la saldatura, se no le cuciture si aprono)
if TRI:
    tri0 = sum(len(p.vertices) - 2 for p in me.polygons)
    if tri0 > TRI:
        mod = ob.modifiers.new('meno', 'DECIMATE')
        mod.ratio = TRI / tri0
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print('DECIMATE', tri0, '→', sum(len(p.vertices) - 2 for p in me.polygons))

# inclinazione, giro, misura, base a terra (Blender: z in su; il glb esce con y in su)
if INCLINA:
    me.transform(Matrix.Rotation(math.radians(INCLINA), 4, 'X'))
me.transform(Matrix.Rotation(math.radians(GIRO), 4, 'Z'))
co = np.array([v.co[:] for v in me.vertices])
mn, mx = co.min(0), co.max(0)
dim = mx - mn
if ALTO:
    s = ALTO / dim[2]
elif PIEDE:
    # piede in unità di mondo: x del gioco = x di Blender, z del gioco = −y di Blender (stessa misura)
    s = min(PIEDE[0] / dim[0], PIEDE[1] / dim[1])
else:
    s = 1.0
centro = Vector(((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]))
me.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-centro))
me.update()
for p in me.polygons:
    p.use_smooth = False  # faccette piatte: una faccia, un tono

# la texture: più piccola e ridotta alla tavolozza
immagini = {n.image for m in me.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
colori = None
if TAVOLOZZA:
    colori = np.array(json.load(open(TAVOLOZZA))['colori'], dtype=np.float64) / 255.0
    colori_lab = lab(colori)
for im in immagini:
    if TEX and (im.size[0] > TEX or im.size[1] > TEX):
        im.scale(TEX, TEX)
    if colori is None:
        continue
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    # le texture dell'AI escono più spente dei disegni: prima si allargano i livelli (luminanza dal 2° al 98° percentile
    # portata da quella più scura a quella più chiara della tavolozza, stessa scala sui tre canali: la tinta non cambia)
    lum = px[:, :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lo, hi = np.percentile(lum, [2, 98])
    lumP = colori @ np.array([0.299, 0.587, 0.114])
    loP, hiP = float(np.percentile(lumP, 5)), float(lumP.max())
    if hi - lo > 0.05:
        px[:, :3] = np.clip((px[:, :3] - lo) * ((hiP - loP) / (hi - lo)) + loP, 0, 1)
    l = lab(px[:, :3].astype(np.float64))
    # più vicino in Lab, a pezzi (la tabella intera non sta in memoria comoda)
    scelta = np.empty(len(l), dtype=np.int32)
    for a in range(0, len(l), 65536):
        d = ((l[a:a + 65536, None, :] - colori_lab[None]) ** 2).sum(2)
        scelta[a:a + 65536] = d.argmin(1)
    px[:, :3] = colori[scelta]
    im.pixels.foreach_set(px.ravel())
    im.update()
    uso = np.bincount(scelta, minlength=len(colori)) / len(scelta)
    print('TAVOLOZZA', im.name, w, h, 'colori usati', int((uso > 0.002).sum()), 'di', len(colori))

# materiali: niente metallo, ruvido pieno (il motore usa solo il colore)
for m in me.materials:
    if not m or not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Metallic'].default_value = 0.0
            n.inputs['Roughness'].default_value = 1.0

tri = sum(len(p.vertices) - 2 for p in me.polygons)
co = np.array([v.co[:] for v in me.vertices])
print('MODELLO', ob.name, 'vertici', prima, '→', len(me.vertices), 'triangoli', tri, 'misura', np.round(co.max(0) - co.min(0), 2).tolist())

formati = [i.identifier for i in bpy.ops.export_scene.gltf.get_rna_type().properties['export_image_format'].enum_items]
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True,
    export_image_format='WEBP' if 'WEBP' in formati else 'AUTO', export_animations=False, export_normals=True,
)
print('SCRITTO', OUT)

if ANTEPRIMA:
    # anteprima veloce: Workbench, colore della texture, luce piatta, camera isometrica come il gioco
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sc.display.shading.light = 'FLAT'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 600
    sc.render.film_transparent = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    co = np.array([v.co[:] for v in me.vertices])
    cam.data.ortho_scale = float((co.max(0) - co.min(0)).max()) * 1.6
    # gioco: camera da +x +z (alto 30°, girata 45°) → Blender: da +x −y, alta 30°
    d = Vector((math.cos(math.radians(30)) * math.sin(math.radians(45)), -math.cos(math.radians(30)) * math.cos(math.radians(45)), math.sin(math.radians(30))))
    mezzo = Vector((0, 0, (co.max(0)[2]) / 2))
    cam.location = mezzo + d * 40
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = ANTEPRIMA
    bpy.ops.render.render(write_still=True)
    print('ANTEPRIMA', ANTEPRIMA)
