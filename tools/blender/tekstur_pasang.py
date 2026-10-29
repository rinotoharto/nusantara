"""
Pasang base color baru ke GLB dan ekspor ulang dengan Draco (mesh, UV, normal map tidak berubah).

  blender -b -P tools/blender/tekstur_pasang.py -- --masuk public/models/wijaya.glb \
      --basecolor aset-mentah/tekstur/wijaya-basecolor-wajah.png --keluar public/models/wijaya.glb [--kualitas-jpeg 85]

Base color disimpan sebagai JPEG di GLB. Dipakai Tahap 2 sampai 4 perbaikan wajah, termasuk
memasang tekstur hasil rapikan tangan (wijaya-basecolor-tangan.png).
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
    p.add_argument("--basecolor", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-tekstur")
    os.makedirs(tmp, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    obj = [o for o in bpy.data.objects if o.type == "MESH"][0]
    mat = obj.data.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = bsdf.inputs["Base Color"].links[0].from_node
    lama = tex.image
    # Simpan ulang sebagai JPEG supaya eksporter menulis JPEG (AUTO mengikuti format berkas sumber).
    baru = bpy.data.images.load(os.path.join(akar, a.basecolor))
    baru.colorspace_settings.name = "sRGB"
    # Blender memuat gambar secara malas; sentuh piksel supaya datanya ada sebelum disimpan ulang.
    if baru.size[0] == 0 or not baru.has_data:
        baru.pixels[0]
    baru.scale(baru.size[0], baru.size[1])
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = a.kualitas_jpeg
    scene.render.image_settings.color_mode = "RGB"
    path_jpg = os.path.join(tmp, "wijaya_basecolor.jpg")
    baru.file_format = "JPEG"
    baru.filepath_raw = path_jpg
    baru.save()
    bpy.data.images.remove(baru)
    jpg = bpy.data.images.load(path_jpg)
    jpg.name = "wijaya_basecolor"
    jpg.colorspace_settings.name = "sRGB"
    tex.image = jpg
    bpy.data.images.remove(lama)

    keluar = os.path.join(akar, a.keluar)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True, export_tangents=False, export_animations=False, export_skins=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print(f"[tekstur] {keluar}: {os.path.getsize(keluar) / (1024 * 1024):.2f} MB, base color {jpg.size[0]}x{jpg.size[1]} "
          f"{os.path.getsize(path_jpg) / (1024 * 1024):.2f} MB", flush=True)


main()
