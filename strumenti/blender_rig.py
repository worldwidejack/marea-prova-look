"""Uno scheletro Mixamo (25 ossa, nomi mixamorig:*) fatto da codice su un personaggio a proporzioni da cartone, quando
l'auto-rig di Mixamo si ferma («Unknown error while generating motion»: F3, testa al 45 %, 28/10). Blender da riga di
comando:
1. i punti del corpo si misurano sulla mesh (in piedi, davanti verso −Y): inguine (dove le gambe si staccano), caviglie
   (dove la sezione si allunga nella scarpa), punta dei piedi, braccia ad A (gruppi laterali delle sezioni, retta fino
   alla punta della mano), collo (sezione più stretta sotto la testa);
2. le ossa si mettono lì, coi nomi e la gerarchia dello scheletro di Mixamo; pelle coi pesi automatici di Blender;
3. le braccia salgono a T e quella diventa la posa di riposo (come il segnaposto rigato da Mixamo): così le mosse
   scaricate da Mixamo per il segnaposto valgono anche qui (strumenti/blender_retarget.py) o Mixamo lo prende già rigato.

Uso: Blender -b --factory-startup -P strumenti/blender_rig.py -- modello.glb uscita.fbx [--blend uscita.blend] [--anteprima a.png]
"""
import math
import sys
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
IN, OUT = argv[0], argv[1]
BLEND = argv[argv.index('--blend') + 1] if '--blend' in argv else None
ANTEPRIMA = argv[argv.index('--anteprima') + 1] if '--anteprima' in argv else None
P = 'mixamorig:'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
me_ob = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me_ob.data.transform(me_ob.matrix_world)
me_ob.matrix_world = Matrix.Identity(4)
me_ob.parent = None
# pelle unica e liscia (i pesi automatici vogliono una superficie chiusa)
bm = bmesh.new(); bm.from_mesh(me_ob.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(me_ob.data); bm.free()
for p in me_ob.data.polygons:
    p.use_smooth = True
V = np.array([v.co[:] for v in me_ob.data.vertices])
# nuvola fitta di punti sulla superficie (la mesh low-poly ha pochi vertici: le sezioni per vertici sono rumorose)
me_ob.data.calc_loop_triangles()
T = np.array([V[list(t.vertices)] for t in me_ob.data.loop_triangles])
aree = np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1) / 2
rng = np.random.default_rng(3)
scelti = rng.choice(len(T), 250000, p=aree / aree.sum())
u, w = rng.random(250000), rng.random(250000)
fuori = u + w > 1
u[fuori], w[fuori] = 1 - u[fuori], 1 - w[fuori]
tri = T[scelti]
Q = tri[:, 0] + (tri[:, 1] - tri[:, 0]) * u[:, None] + (tri[:, 2] - tri[:, 0]) * w[:, None]
x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
H = V[:, 2].max()
print('ALTO', round(H, 3), 'vertici', len(V), 'punti', len(Q))

# ---------- punti del corpo ----------
# inguine: il punto più basso della superficie sulla linea di mezzo (sotto ci sono solo le due gambe)
mezzo = (np.abs(x) < 0.01) & (z > 0.12 * H)
z_ing = z[mezzo].min()


def gruppi_x(sel, passo=0.02):
    """intervalli in x dei punti selezionati, divisi dove c'è un buco più largo di passo."""
    xs = np.sort(x[sel])
    if len(xs) == 0:
        return []
    tagli = np.where(np.diff(xs) > passo)[0]
    return [(p.min(), p.max()) for p in np.split(xs, tagli + 1)]


# gambe: centro di ogni gamba, caviglia (dove la scarpa allunga la sezione in y, nel quarto basso), punta del piede
gambe = {}
for lato, s in (('Left', 1), ('Right', -1)):
    sel = (s * x > 0.004) & (z < z_ing)
    righe = []
    for zz in np.arange(0.005, z_ing - 0.01, 0.005):
        b = sel & (np.abs(z - zz) < 0.004)
        if b.sum() > 20:
            righe.append((zz, np.median(x[b]), y[b].min(), y[b].max()))
    righe = np.array(righe)
    lung = righe[:, 3] - righe[:, 2]
    stinco = np.median(lung[(righe[:, 0] > 0.3 * z_ing) & (righe[:, 0] < 0.6 * z_ing)])
    basso = righe[righe[:, 0] < 0.3 * z_ing]
    scarpa = basso[(basso[:, 3] - basso[:, 2]) > 1.4 * stinco]
    z_cav = scarpa[:, 0].max() if len(scarpa) else 0.06 * H
    piede = sel & (z < z_cav)
    punta = Q[piede][np.argmin(y[piede])]
    x_gamba = np.median(righe[(righe[:, 0] > z_cav + 0.02) & (righe[:, 0] < z_ing - 0.02), 1])
    y_cav = float(np.median((righe[np.abs(righe[:, 0] - (z_cav + 0.02)) < 0.01, 2] + righe[np.abs(righe[:, 0] - (z_cav + 0.02)) < 0.01, 3]) / 2))
    gambe[lato] = dict(x=x_gamba, z_cav=z_cav, punta=punta, y_cav=y_cav)
    print('GAMBA', lato, 'x', round(x_gamba, 3), 'caviglia', round(z_cav, 3), 'stinco y', round(stinco, 3), 'punta', np.round(punta, 3))

# busto: a ogni quota sopra l'inguine i gruppi in x; il centrale è il busto (con le braccia attaccate alle spalle)
busto = []
for zz in np.arange(z_ing + 0.01, H, 0.005):
    sel = np.abs(z - zz) < 0.004
    g = gruppi_x(sel)
    if not g:
        continue
    c = min(g, key=lambda p: abs((p[0] + p[1]) / 2))
    busto.append((zz, c[0], c[1], len(g)))
busto = np.array(busto)
larg = busto[:, 2] - busto[:, 1]
# collo: la sezione più stretta fra il 45 % e il 75 % dell'altezza; la testa comincia lì sopra
fascia = (busto[:, 0] > 0.45 * H) & (busto[:, 0] < 0.75 * H)
i_collo = int(np.argmin(np.where(fascia, larg, 9)))
z_collo, l_collo = busto[i_collo, 0], larg[i_collo]
# petto: sotto il collo, dove il busto è separato dalle braccia (3 gruppi); spalle: dove le braccia si attaccano
sep = busto[(busto[:, 0] < z_collo) & (busto[:, 3] >= 3)]
z_attacco = sep[:, 0].max() if len(sep) else z_collo - 0.08
petto = float(np.median(larg[(busto[:, 0] > z_attacco - 0.08) & (busto[:, 0] < z_attacco)]))
z_spalla = (z_attacco + z_collo) / 2
mezza_spalla = petto / 2
print('BUSTO inguine', round(z_ing, 3), 'attacco braccia', round(z_attacco, 3), 'collo', round(z_collo, 3), 'largo collo', round(l_collo, 3), 'petto', round(petto, 3))

braccia = {}
for lato, s in (('Left', 1), ('Right', -1)):
    sel = (s * x > mezza_spalla * 1.05) & (z > z_ing - 0.1) & (z < z_collo)
    punta = Q[sel][np.argmax(s * x[sel])]
    spalla = np.array([s * mezza_spalla * 0.8, float(np.median(y[np.abs(z - z_spalla) < 0.01])), z_spalla])
    d = punta - spalla
    lun = np.linalg.norm(d)
    d /= lun
    polso = spalla + d * lun * 0.8
    gomito = spalla + d * lun * 0.45
    braccia[lato] = dict(spalla=spalla, gomito=gomito, polso=polso, punta=punta)
    ang = math.degrees(math.atan2(-(punta[2] - spalla[2]), abs(punta[0] - spalla[0])))
    print('BRACCIO', lato, 'spalla', np.round(spalla, 3), 'punta', np.round(punta, 3), 'giù di', round(ang, 1), 'gradi')

y_c = float(np.median(y[(z > z_ing) & (z < z_collo) & (np.abs(x) < mezza_spalla)]))  # piano del corpo (avanti-dietro)

# ---------- ossa ----------
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm = bpy.context.object
arm.name = 'Armature'
arm.data.name = 'Armature'
eb = arm.data.edit_bones
eb.remove(eb[0])


def osso(nome, testa, coda, padre=None):
    b = eb.new(P + nome)
    b.head = Vector(testa); b.tail = Vector(coda)
    if padre:
        b.parent = eb[P + padre]
        b.use_connect = False
    return b


z_anca = z_ing + 0.035 * H
osso('Hips', (0, y_c, z_anca), (0, y_c, z_anca + 0.04 * H))
z_sp = np.linspace(z_anca + 0.04 * H, z_collo - 0.01, 4)
osso('Spine', (0, y_c, z_sp[0]), (0, y_c, z_sp[1]), 'Hips')
osso('Spine1', (0, y_c, z_sp[1]), (0, y_c, z_sp[2]), 'Spine')
osso('Spine2', (0, y_c, z_sp[2]), (0, y_c, z_sp[3]), 'Spine1')
osso('Neck', (0, y_c, z_sp[3]), (0, y_c, z_collo + 0.015), 'Spine2')
z_testa = z_collo + 0.015
osso('Head', (0, y_c, z_testa), (0, y_c, z_testa + (H - z_testa) * 0.6), 'Neck')
osso('HeadTop_End', (0, y_c, z_testa + (H - z_testa) * 0.6), (0, y_c, H), 'Head')
for lato, s in (('Left', 1), ('Right', -1)):
    b = braccia[lato]
    osso(lato + 'Shoulder', (s * 0.04, y_c, z_spalla - 0.01), b['spalla'], 'Spine2')
    osso(lato + 'Arm', b['spalla'], b['gomito'], lato + 'Shoulder')
    osso(lato + 'ForeArm', b['gomito'], b['polso'], lato + 'Arm')
    osso(lato + 'Hand', b['polso'], b['punta'], lato + 'ForeArm')
    g = gambe[lato]
    anca = (s * max(g['x'], 0.04), y_c, z_ing + 0.01)
    cav = (g['x'], g['y_cav'], g['z_cav'])
    gin = ((anca[0] + cav[0]) / 2, y_c - 0.01, (anca[2] + cav[2]) / 2)
    pt = g['punta']
    base = (pt[0], (cav[1] + pt[1]) / 2 - 0.01, 0.02)
    osso(lato + 'UpLeg', anca, gin, 'Hips')
    osso(lato + 'Leg', gin, cav, lato + 'UpLeg')
    osso(lato + 'Foot', cav, base, lato + 'Leg')
    osso(lato + 'ToeBase', base, (pt[0], pt[1], 0.02), lato + 'Foot')
    osso(lato + 'Toe_End', (pt[0], pt[1], 0.02), (pt[0], pt[1] - 0.04, 0.02), lato + 'ToeBase')
# rotazione delle ossa: asse z locale verso l'avanti (−Y), come fa Mixamo con le sue
for b in eb:
    b.align_roll(Vector((0, -1, 0)))
bpy.ops.object.mode_set(mode='OBJECT')
print('OSSA', len(arm.data.bones))

# ---------- pelle: pesi automatici ----------
bpy.ops.object.select_all(action='DESELECT')
me_ob.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
senza = sum(1 for v in me_ob.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('PELLE gruppi', len(me_ob.vertex_groups), 'vertici senza peso', senza)

# ---------- braccia a T: la posa diventa il riposo ----------
bpy.ops.object.mode_set(mode='POSE')
for lato, s in (('Left', 1), ('Right', -1)):
    pb = arm.pose.bones[P + lato + 'Arm']
    b = braccia[lato]
    d = Vector(b['punta'] - b['spalla']).normalized()
    voluto = Vector((s, 0, 0))
    # rotazione nel mondo che porta la direzione del braccio sull'orizzontale, espressa nello spazio dell'osso
    q = d.rotation_difference(voluto)
    mw = arm.matrix_world @ pb.bone.matrix_local
    loc = mw.to_quaternion().inverted() @ q @ mw.to_quaternion()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = loc
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
# la pelle prende la posa (modificatore applicato), poi la posa diventa il riposo e la pelle si rilega
bpy.context.view_layer.objects.active = me_ob
mod = next(m for m in me_ob.modifiers if m.type == 'ARMATURE')
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
m2 = me_ob.modifiers.new('Armature', 'ARMATURE')
m2.object = arm
print('A T', 'fatto')

if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.fbx(filepath=OUT, path_mode='COPY', embed_textures=True, add_leaf_bones=False,
                         apply_scale_options='FBX_SCALE_ALL', bake_anim=False)
print('SCRITTO', OUT)

if ANTEPRIMA:
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sc.display.shading.light = 'FLAT'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 700, 600
    sc.render.film_transparent = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.2
    cam.location = (0, -6, H / 2)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam
    sc.render.filepath = ANTEPRIMA
    bpy.ops.render.render(write_still=True)
    print('ANTEPRIMA', ANTEPRIMA)
