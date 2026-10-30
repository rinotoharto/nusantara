"""
Render kepala model dari depan dengan kamera ortografis (Tahap 1 perbaikan wajah).

  blender -b -P tools/blender/wajah_render.py -- --masuk public/models/wijaya.glb \
      --keluar aset-mentah/pratinjau/wajah-model-depan.png --json tools/blender/wajah.json

Kamera disimpan ke wajah.json (blok "kamera") supaya Tahap 2 memakai kamera yang sama persis.
Pencahayaan rata (world saja, tanpa bayangan) supaya warna tekstur terlihat apa adanya.
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
    p.add_argument("--bagian-kepala", type=float, default=0.16,
                   help="tinggi kepala sebagai pecahan tinggi model (untuk batas bawah bingkai, di leher)")
    p.add_argument("--rata", action="store_true", help="tanpa pencahayaan terarah: emisi base color saja")
    p.add_argument("--netral", action="store_true", help="cahaya netral: tiga matahari lemah tanpa bayangan")
    p.add_argument("--sudut", choices=["depan", "tigaperempat", "samping", "badan", "badan-tigaperempat",
                                       "badan-samping", "badan-belakang", "tangan", "kaki"], default="depan",
                   help="depan juga menyimpan kamera ke wajah.json; sudut lain hanya pratinjau")
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
    z_min, z_max = co[:, 2].min(), co[:, 2].max()
    tinggi = z_max - z_min
    # Bingkai: dari puncak kepala (plus sedikit ruang) sampai leher, persegi.
    atas = z_max + tinggi * 0.02
    bawah = z_max - tinggi * a.bagian_kepala
    sisi = atas - bawah
    # Pusat x dari verteks di area kepala.
    kepala = co[co[:, 2] > bawah]
    x_pusat = float((kepala[:, 0].max() + kepala[:, 0].min()) / 2)
    pusat = Vector((x_pusat, 0.0, (atas + bawah) / 2))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = a.ukuran
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    mat = o.data.materials[0]
    if a.rata:
        # Emisi base color: tanpa bayangan dan tanpa normal map, warna tekstur apa adanya.
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        tex = bsdf.inputs["Base Color"].links[0].from_node
        keluaran = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        emisi = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
        nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])

    kd = bpy.data.cameras.new("KameraWajah")
    kd.type = "ORTHO"
    kd.ortho_scale = sisi
    kd.clip_start = 0.01
    kam = bpy.data.objects.new("KameraWajah", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    jarak = tinggi * 2
    arah = {"depan": (0, -1, 0), "tigaperempat": (-0.7071, -0.7071, 0), "samping": (-1, 0, 0),
            "badan": (0, -1, 0), "badan-tigaperempat": (-0.7071, -0.7071, 0), "badan-samping": (1, 0, 0),
            "badan-belakang": (0, 1, 0), "tangan": (0, -1, 0), "kaki": (0, -1, 0)}[a.sudut]
    if a.sudut.startswith("badan"):
        pusat = Vector((0.0, 0.0, (z_min + z_max) / 2))
        kd.ortho_scale = tinggi * 1.15 * 1.5
        scene.render.resolution_y = int(a.ukuran * 1.5)
        jarak = tinggi * 4
    elif a.sudut == "tangan":
        # Tangan kanan model (sisi -X dilihat dari depan): bingkai 0,45 m di sekitar pergelangan dan jari.
        tangan = co[(co[:, 2] < tinggi * 0.58) & (co[:, 2] > tinggi * 0.38) & (co[:, 0] < -tinggi * 0.18)]
        pusat = Vector((float(tangan[:, 0].mean()), 0.0, float(tangan[:, 2].mean())))
        kd.ortho_scale = tinggi * 0.27
    elif a.sudut == "kaki":
        pusat = Vector((0.0, 0.0, z_min + tinggi * 0.1))
        kd.ortho_scale = tinggi * 0.35
    kam.location = pusat + Vector(arah) * jarak
    # Kamera mendatar: X 90 derajat membuat kamera memandang +Y; yaw dihitung dari arah pandang (dx, dy).
    dx, dy = -arah[0], -arah[1]
    kam.rotation_euler = (math.radians(90), 0.0, math.atan2(-dx, dy))

    if a.netral:
        for nama, en, rot in (("Depan", 1.4, (80, 0, 0)), ("Kiri", 1.0, (70, 0, -60)), ("Kanan", 1.0, (70, 0, 60))):
            l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
            l.data.energy = en
            l.data.use_shadow = False
            l.rotation_euler = tuple(np.radians(v) for v in rot)
            scene.collection.objects.link(l)
        scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    elif not a.rata:
        for nama, en, rot in (("Kunci", 2.0, (70, 0, -20)), ("Isi", 1.2, (75, 0, 25))):
            l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
            l.data.energy = en
            l.data.angle = 0.5
            l.rotation_euler = tuple(np.radians(v) for v in rot)
            scene.collection.objects.link(l)

    keluar = os.path.join(akar, a.keluar)
    os.makedirs(os.path.dirname(keluar), exist_ok=True)
    scene.render.filepath = keluar
    bpy.ops.render.render(write_still=True)

    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json)) if os.path.exists(path_json) else {}
    if a.sudut != "depan":
        print(f"[wajah] render {keluar} ({a.sudut})", flush=True)
        return
    data["kamera"] = {
        "jenis": "ortografis",
        "ukuran_px": a.ukuran,
        "ortho_scale_m": sisi,
        "pusat_m": [pusat.x, pusat.y, pusat.z],
        "lokasi_m": list(kam.location),
        "arah": "dari -Y (depan model) ke +Y",
        "tinggi_model_m": float(tinggi),
        "keterangan": "piksel (u, v) dari kiri atas; x_m = pusat.x + (u/ukuran - 0.5) * ortho_scale; z_m = pusat.z - (v/ukuran - 0.5) * ortho_scale",
    }
    json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    print(f"[wajah] render {keluar}; kamera ortho {sisi:.3f} m, pusat {tuple(round(v, 3) for v in pusat)}", flush=True)


main()
