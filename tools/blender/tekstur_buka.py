"""
Buka Blender (dengan jendela) berisi model dan base color PNG, siap mode Texture Paint untuk merapikan
sisa bercak dengan tangan. Jalankan TANPA -b:

  /Applications/Blender.app/Contents/MacOS/Blender -P tools/blender/tekstur_buka.py -- \
      --masuk public/models/wijaya.glb --basecolor aset-mentah/tekstur/wijaya-basecolor-abu.png \
      --topeng aset-mentah/tekstur/topeng-abu-tangan.png

Yang disiapkan: GLB diimpor, gambar base color PNG dipasang ke material (menggantikan JPEG dari GLB),
topeng tangan dimuat sebagai gambar terpisah (lihat di Image Editor), objek masuk mode Texture Paint.
Simpan hasil lewat Image > Save As ke aset-mentah/tekstur/wijaya-basecolor-tangan.png.
"""
import argparse
import os
import sys

import bpy


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--basecolor", required=True)
    p.add_argument("--topeng", default=None)
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    obj = [o for o in bpy.data.objects if o.type == "MESH"][0]
    mat = obj.data.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = bsdf.inputs["Base Color"].links[0].from_node
    img = bpy.data.images.load(os.path.join(akar, a.basecolor))
    img.colorspace_settings.name = "sRGB"
    tex.image = img
    for n in nt.nodes:
        n.select = False
    tex.select = True
    nt.nodes.active = tex
    if a.topeng:
        bpy.data.images.load(os.path.join(akar, a.topeng))

    # Lampu dan kamera sederhana supaya viewport tidak gelap.
    lampu = bpy.data.objects.new("Matahari", bpy.data.lights.new("Matahari", "SUN"))
    lampu.data.energy = 3.0
    lampu.rotation_euler = (0.9, 0.0, -0.6)
    bpy.context.scene.collection.objects.link(lampu)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.mode_set(mode="TEXTURE_PAINT")
        bpy.context.scene.tool_settings.image_paint.mode = "MATERIAL"
    except Exception as e:  # tanpa jendela (mis. -b) mode paint tidak tersedia
        print("[buka] mode Texture Paint belum aktif:", e)
    print("[buka] siap:", a.basecolor)


main()
