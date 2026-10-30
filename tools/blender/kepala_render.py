"""
Render kepala baru (GLB Tripo) dari depan dengan kamera ortografis yang memuat seluruh kepala,
simpan parameter kamera ke wajah.json blok "kepala.kamera" (ganti kepala, langkah ukur).

  blender -b -P tools/blender/kepala_render.py -- --masuk aset-mentah/kepala-tripo.glb \
      --keluar aset-mentah/pratinjau/kepala-baru-depan.png --json tools/blender/wajah.json
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--ukuran", type=int, default=1024)
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    o = [o for o in bpy.data.objects if o.type == "MESH"][0]
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mn, mx = co.min(0), co.max(0)
    sisi = float(max(mx[0] - mn[0], mx[2] - mn[2]) * 1.1)
    pusat = Vector((float((mn[0] + mx[0]) / 2), 0.0, float((mn[2] + mx[2]) / 2)))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = a.ukuran
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    kd = bpy.data.cameras.new("K")
    kd.type = "ORTHO"
    kd.ortho_scale = sisi
    kam = bpy.data.objects.new("K", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    jarak = float(mx[1] - mn[1]) * 3 + 1.0
    kam.location = Vector((pusat.x, pusat.y - jarak, pusat.z))
    kam.rotation_euler = (math.radians(90), 0.0, 0.0)
    for nama, en, rot in (("Kunci", 2.0, (70, 0, -20)), ("Isi", 1.2, (75, 0, 25))):
        l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
        l.data.energy = en
        l.rotation_euler = tuple(math.radians(v) for v in rot)
        scene.collection.objects.link(l)
    keluar = os.path.join(akar, a.keluar)
    scene.render.filepath = keluar
    bpy.ops.render.render(write_still=True)
    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json)) if os.path.exists(path_json) else {}
    data.setdefault("kepala", {})["kamera"] = {
        "ukuran_px": a.ukuran, "ortho_scale": sisi, "pusat": [pusat.x, pusat.y, pusat.z],
        "bbox_min": [float(v) for v in mn], "bbox_max": [float(v) for v in mx],
        "keterangan": "satuan GLB kepala (tinggi 1,0). x = pusat.x + (u/ukuran - 0,5) * ortho; z = pusat.z - (v/ukuran - 0,5) * ortho",
    }
    json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    print(f"[kepala] render {keluar}; ortho {sisi:.3f}, pusat {tuple(round(v, 3) for v in pusat)}, bbox {mn.round(3)} {mx.round(3)}", flush=True)


main()
