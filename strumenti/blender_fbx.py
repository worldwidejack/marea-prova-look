"""Da glb a FBX con la texture dentro, per caricare un personaggio su Mixamo (auto-rig). Blender da riga di comando.
Il personaggio deve stare a T (o ad A), in piedi, col davanti verso −Y di Blender (la vista «Front» di Mixamo).

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P strumenti/blender_fbx.py -- in.glb out.fbx
"""
import os
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
IN, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
# le texture su disco accanto al FBX: l'FBX le porta dentro con path_mode COPY + embed_textures
cartella = os.path.dirname(os.path.abspath(OUT))
for im in bpy.data.images:
    if im.packed_file or im.source == 'FILE':
        percorso = os.path.join(cartella, (im.name or 'texture') + '.png')
        im.filepath_raw = percorso
        im.file_format = 'PNG'
        im.save()
bpy.ops.export_scene.fbx(filepath=OUT, path_mode='COPY', embed_textures=True, apply_scale_options='FBX_SCALE_ALL', add_leaf_bones=False)
print('SCRITTO', OUT)
