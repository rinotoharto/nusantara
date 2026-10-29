"""
Ekspor karakter hasil optimasi ke FBX untuk diunggah ke Mixamo (tanpa Draco, tekstur tersemat).

Jalankan dari akar repo:
  blender -b -P tools/blender/ekspor_mixamo.py -- --masuk public/models/wijaya.glb \
      --keluar aset-mentah/mixamo/wijaya-untuk-mixamo.fbx
"""
import argparse
import os
import sys
import tempfile

import bpy


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    masuk = os.path.join(akar, a.masuk)
    keluar = os.path.join(akar, a.keluar)
    os.makedirs(os.path.dirname(keluar), exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-mixamo")
    os.makedirs(tmp, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=masuk)

    # Gambar di dalam GLB tersimpan terkompresi di memori; tulis ke berkas supaya
    # eksporter FBX bisa menyematkannya.
    for img in bpy.data.images:
        if img.size[0] == 0:
            continue
        ekst = ".jpg" if img.file_format == "JPEG" else ".png"
        path = os.path.join(tmp, img.name + ekst)
        img.filepath_raw = path
        img.save()
        if img.packed_file:
            img.unpack(method="REMOVE")
        img.filepath = path
        img.reload()

    obj = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in obj:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj[0]
    bpy.ops.export_scene.fbx(
        filepath=keluar,
        use_selection=True,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        object_types={"MESH"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
        bake_anim=False,
    )
    print(f"[mixamo] {keluar}: {os.path.getsize(keluar) / (1024 * 1024):.2f} MB, "
          f"{len(obj)} mesh, tekstur {[os.path.basename(i.filepath) for i in bpy.data.images if i.size[0]]}", flush=True)


main()
