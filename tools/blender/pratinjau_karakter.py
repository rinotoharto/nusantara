"""
Pratinjau model diam (Blender): seluruh badan dari depan, samping, tiga perempat; leher dari dekat (depan,
samping, tiga perempat setinggi wajah, dan dari bawah dagu); siluet berlatar transparan untuk tumpang_konsep.py.

  blender -b -P tools/blender/pratinjau_karakter.py -- --masuk aset-mentah/prajurit-sambung.glb \
      --json tools/blender/wajah.json --blok prajurit --keluar aset-mentah/pratinjau --nama prajurit

Posisi dagu dan sumbu leher diambil dari blok <blok>.tempat dan skala akhir dari <blok>.sambung.hasil.
Pencahayaan leher dekat: satu matahari dan cahaya langit lemah seperti di game, supaya sambungan yang
tertutup cahaya rata tetap kelihatan.
"""
import argparse
import json
import math
import os
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--nama", default="karakter")
    p.add_argument("--hanya", default=None, help="daftar sudut dipisah koma (bawaan: semua)")
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    P = json.load(open(os.path.join(akar, a.json)))[a.blok]
    S, T = P["sambung"], P["tempat"]
    f = S.get("hasil", {}).get("skala_akhir", 1.0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    obj = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.polygons))
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) @ np.array(obj.matrix_world)[:3, :3].T + np.array(obj.matrix_world)[:3, 3]
    tinggi = float(co[:, 2].max())
    x0 = T["badan"]["x0"] * f
    dagu = S["dagu_z_m"] * f
    leher = Vector((x0, T["bidang_kepala_m"][1] * f, (T["bidang_kepala_m"][2] + T["bidang_badan_m"][2]) / 2 * f))
    wajah_z = T["kepala"]["mata_z_m"] * f

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    latar = scene.world.node_tree.nodes["Background"]
    kd = bpy.data.cameras.new("Kamera")
    kd.type = "ORTHO"
    kam = bpy.data.objects.new("Kamera", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    lampu = {}
    for nama, rot in (("Kunci", (60, 0, -30)), ("Isi", (70, 0, 60)), ("Belakang", (65, 0, 170)), ("Matahari", (52, 0, -40))):
        l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
        l.rotation_euler = tuple(math.radians(v) for v in rot)
        scene.collection.objects.link(l)
        lampu[nama] = l

    def cahaya(mode):
        if mode == "rata":
            energi, langit = {"Kunci": 2.0, "Isi": 1.0, "Belakang": 0.6, "Matahari": 0.0}, 0.7
        else:           # game: satu matahari, langit lemah
            energi, langit = {"Kunci": 0.0, "Isi": 0.0, "Belakang": 0.0, "Matahari": 3.2}, 0.45
        for k, e in energi.items():
            lampu[k].data.energy = e
        latar.inputs[0].default_value = (0.8, 0.8, 0.82, 1.0)
        latar.inputs[1].default_value = langit

    def render(nama, sasaran, arah, ortho, ukuran, mode="rata", transparan=False, folder=None):
        cahaya(mode)
        scene.render.resolution_x, scene.render.resolution_y = ukuran
        scene.render.film_transparent = transparan
        scene.render.image_settings.color_mode = "RGBA" if transparan else "RGB"
        kam.location = Vector(sasaran) + Vector(arah).normalized() * 4.0
        kam.rotation_euler = (Vector(sasaran) - kam.location).to_track_quat("-Z", "Y").to_euler()
        kam.data.ortho_scale = ortho
        path = os.path.join(folder or os.path.join(akar, a.keluar), f"{a.nama}-{nama}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("[pratinjau]", path, flush=True)

    tmp = os.path.join(tempfile.gettempdir(), "nusantara-sambung")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(os.path.join(akar, a.keluar), exist_ok=True)
    tengah = (x0, 0.03, tinggi / 2)
    penuh = tinggi * 1.06
    s45 = math.sqrt(0.5)
    daftar = {
        "utuh-depan": (tengah, (0, -1, 0), penuh, (700, 1050), "rata", False, None),
        "utuh-samping": (tengah, (1, 0, 0), penuh, (700, 1050), "rata", False, None),
        "utuh-tigaperempat": (tengah, (-s45, -s45, 0), penuh, (700, 1050), "rata", False, None),
        "leher-depan": ((leher.x, leher.y, leher.z + 0.03), (0, -1, 0), 0.40, (800, 800), "game", False, None),
        "leher-samping": ((leher.x, leher.y, leher.z + 0.03), (1, 0, 0), 0.40, (800, 800), "game", False, None),
        # kamera setinggi wajah, agak ke samping, melihat leher
        "leher-dekat": ((leher.x, leher.y, leher.z + 0.02), (-0.55, -1.0, (wajah_z - leher.z) / 1.6), 0.30, (800, 800), "game", False, None),
        "leher-bawah-dagu": ((leher.x, leher.y - 0.02, leher.z + 0.02), (0.25, -1.0, -0.75), 0.30, (800, 800), "game", False, None),
        "siluet-depan": (tengah, (0, -1, 0), penuh, (1000, 1400), "rata", True, tmp),
        "siluet-samping": (tengah, (1, 0, 0), penuh, (1000, 1400), "rata", True, tmp),
    }
    pilih = a.hanya.split(",") if a.hanya else list(daftar)
    for nama in pilih:
        render(nama, *daftar[nama][:4], mode=daftar[nama][4], transparan=daftar[nama][5], folder=daftar[nama][6])


main()
