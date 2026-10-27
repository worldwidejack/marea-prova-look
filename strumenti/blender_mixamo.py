"""Le mosse di Mixamo in un glb solo, per la prova dei look. Blender da riga di comando.
Cartella di ingresso: il personaggio rigato da Mixamo «con la pelle» (personaggio.fbx) e una clip per file, scaricate
«senza pelle» sullo stesso scheletro (camminata.fbx, corsa.fbx, capriola.fbx, bevi.fbx, fermo.fbx, …): il nome del file
diventa il nome della clip. Le clip vanno sullo scheletro del personaggio; lo spostamento delle anche in orizzontale si
toglie (la strada la fa il codice, come «In Place»), l'altezza resta. Il materiale si riprende dal glb di partenza
(--materiale, quello con la texture già ridotta alla tavolozza): Mixamo tiene le UV.
Esce un glb alto --alto unità, piedi a terra, col davanti verso +Z del gioco.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P strumenti/blender_mixamo.py -- \
       cartella_fbx out.glb --materiale modello.glb [--alto 2.5]
"""
import math
import os
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
CARTELLA, OUT = argv[0], argv[1]
MATERIALE = argv[argv.index('--materiale') + 1] if '--materiale' in argv else None
ALTO = float(argv[argv.index('--alto') + 1]) if '--alto' in argv else 2.5

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(CARTELLA, 'personaggio.fbx'), automatic_bone_orientation=False)
scheletro = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
corpi = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# le clip: ogni file porta il suo scheletro con l'azione; si tiene l'azione, lo scheletro si butta
clip = []
for f in sorted(os.listdir(CARTELLA)):
    if not f.lower().endswith('.fbx') or f == 'personaggio.fbx':
        continue
    prima = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(CARTELLA, f), automatic_bone_orientation=False)
    nuovi = [o for o in bpy.context.scene.objects if o not in prima]
    arm = next((o for o in nuovi if o.type == 'ARMATURE'), None)
    if arm and arm.animation_data and arm.animation_data.action:
        az = arm.animation_data.action
        az.name = os.path.splitext(f)[0]
        az.use_fake_user = True
        clip.append(az)
    for o in nuovi:
        bpy.data.objects.remove(o, do_unlink=True)


def curve(az):
    """Le F-curve di un'azione (Blender 5 ha le azioni a strati: si cercano nei canali di ogni strip)."""
    if hasattr(az, 'fcurves') and len(az.fcurves):
        return list(az.fcurves)
    out = []
    for strato in getattr(az, 'layers', []):
        for strip in strato.strips:
            for cb in strip.channelbags:
                out.extend(cb.fcurves)
    return out


# via lo spostamento orizzontale delle anche (in Mixamo l'asse su delle anche è Y, l'avanti Z: si azzerano X e Z)
for az in clip:
    for fc in curve(az):
        if fc.data_path.endswith('location') and 'Hips' in fc.data_path and fc.array_index in (0, 2):
            v0 = fc.keyframe_points[0].co[1] if len(fc.keyframe_points) else 0
            for k in fc.keyframe_points:
                k.co[1] = v0; k.handle_left[1] = v0; k.handle_right[1] = v0
    print('CLIP', az.name, [round(x) for x in az.frame_range])

# ogni clip su una traccia NLA dello scheletro: l'esportatore glTF le esporta tutte, una per nome
scheletro.animation_data_create()
for az in clip:
    tr = scheletro.animation_data.nla_tracks.new()
    tr.name = az.name
    st = tr.strips.new(az.name, int(az.frame_range[0]), az.action if hasattr(az, 'action') else az)
    st.name = az.name
    tr.mute = True
scheletro.animation_data.action = None

# il materiale del modello di partenza (texture ridotta alla tavolozza)
if MATERIALE:
    prima = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=MATERIALE)
    nuovi_ob = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in corpi]
    mat = next((m for m in bpy.data.materials if m not in prima), None)
    for o in nuovi_ob:
        bpy.data.objects.remove(o, do_unlink=True)
    if mat:
        for o in corpi:
            o.data.materials.clear()
            o.data.materials.append(mat)
        print('MATERIALE', mat.name)

# misura: alto ALTO unità con la posa di riposo, piedi a terra
bpy.context.view_layer.update()
pts = [o.matrix_world @ v.co for o in corpi for v in o.data.vertices]
zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
s = ALTO / (zmax - zmin)
scheletro.scale = scheletro.scale * s
bpy.context.view_layer.update()
pts = [o.matrix_world @ v.co for o in corpi for v in o.data.vertices]
scheletro.location.z -= min(p.z for p in pts)
for o in corpi:
    for p in o.data.polygons:
        p.use_smooth = False

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_yup=True, export_apply=False, export_animations=True,
    export_animation_mode='NLA_TRACKS', export_image_format='WEBP', export_skins=True, export_def_bones=True,
)
print('SCRITTO', OUT, 'clip', [a.name for a in clip])
