"""
Dua karakter berdiri berdampingan pada skala yang sama (Blender): seluruh badan dari depan dan samping, dan
badan atas dari depan. Untuk membandingkan tinggi, lebar bahu, dan ukuran kepala, misalnya Wijaya dengan
prajurit Kediri di CEK C dan CEK F.

  blender -b -P tools/blender/banding_karakter.py -- --kiri aset-mentah/wijaya-utuh.glb \
      --kanan aset-mentah/prajurit-utuh.glb --keluar aset-mentah/pratinjau --nama wijaya-ulang

Keluaran: <nama>-banding-depan.png, -samping.png, -dekat.png. Angka yang dicetak: tinggi, puncak bahu, jarak
antarsendi bahu dan lebar bahu terluar 3 cm di bawah puncak bahu (cara ukur sama dengan sambung_kepala.py).
"""
import argparse
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--kiri", required=True, help="GLB karakter di kiri gambar")
    p.add_argument("--kanan", required=True, help="GLB karakter pembanding di kanan gambar")
    p.add_argument("--keluar", required=True, help="folder gambar")
    p.add_argument("--nama", default="karakter")
    p.add_argument("--jarak", type=float, default=0.95, help="jarak antarkarakter (m)")
    return p.parse_args(argv)


def impor(path):
    sebelum = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    baru = [o for o in bpy.data.objects if o not in sebelum and o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in baru:
        o.select_set(True)
    bpy.context.view_layer.objects.active = baru[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return baru


def mesh_gabung(objs):
    """Koordinat dan segitiga semua mesh (indeks digeser)."""
    semua_co, semua_tri, awal = [], [], 0
    for o in objs:
        co = np.empty(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get("co", co)
        o.data.calc_loop_triangles()
        t = np.empty(len(o.data.loop_triangles) * 3, dtype=np.int64)
        o.data.loop_triangles.foreach_get("vertices", t)
        semua_co.append(co.reshape(-1, 3))
        semua_tri.append(t.reshape(-1, 3) + awal)
        awal += len(o.data.vertices)
    return np.vstack(semua_co), np.vstack(semua_tri)


def irisan(co, tri, z):
    """Titik-titik potong mesh dengan bidang mendatar setinggi z."""
    d = co[:, 2] - z
    dt = d[tri]
    m = (dt.min(1) < 0) & (dt.max(1) >= 0)
    t, dd = tri[m], dt[m]
    pts = []
    for i, j in ((0, 1), (1, 2), (2, 0)):
        c = (dd[:, i] < 0) != (dd[:, j] < 0)
        f = dd[c, i] / (dd[c, i] - dd[c, j])
        pts.append(co[t[c, i]] + f[:, None] * (co[t[c, j]] - co[t[c, i]]))
    return np.vstack(pts) if pts else np.zeros((0, 3))


def ukur(co, tri):
    """Tinggi, puncak bahu, dan sendi bahu; cara ukur sama dengan ukur_badan di sambung_kepala.py."""
    tinggi = float(co[:, 2].max() - co[:, 2].min())
    x0 = float((co[:, 0].min() + co[:, 0].max()) / 2)
    zs = np.arange(1.20 * tinggi / 1.68, tinggi * 0.86, 0.005)
    setengah = []
    for z in zs:
        p = irisan(co, tri, z)
        setengah.append(np.abs(p[:, 0] - x0).max() if len(p) else 0.0)
    setengah = np.array(setengah)
    z_bahu = float(zs[np.nonzero(setengah >= 0.8 * setengah.max())[0].max()])
    p = irisan(co, tri, z_bahu - 0.03)
    x_luar = float(np.abs(p[:, 0] - x0).max())
    return {"tinggi": tinggi, "z_bahu": z_bahu, "sendi": 2 * (x_luar - 0.045), "lebar_bahu": 2 * x_luar}


def main():
    a = argumen()
    akar = os.getcwd()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kiri = impor(os.path.join(akar, a.kiri))
    kanan = impor(os.path.join(akar, a.kanan))
    uk = {"kiri": ukur(*mesh_gabung(kiri)), "kanan": ukur(*mesh_gabung(kanan))}
    for sisi, berkas in (("kiri", a.kiri), ("kanan", a.kanan)):
        u = uk[sisi]
        print(f"[banding] {sisi} {os.path.basename(berkas)}: tinggi {u['tinggi']:.3f} m, puncak bahu {u['z_bahu']:.3f} m, "
              f"jarak antarsendi bahu {u['sendi'] * 100:.1f} cm, lebar bahu terluar {u['lebar_bahu'] * 100:.1f} cm", flush=True)
    print(f"[banding] bahu kiri terhadap kanan: sendi {(uk['kiri']['sendi'] / uk['kanan']['sendi'] - 1) * 100:+.1f} persen, "
          f"terluar {(uk['kiri']['lebar_bahu'] / uk['kanan']['lebar_bahu'] - 1) * 100:+.1f} persen", flush=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    latar = scene.world.node_tree.nodes["Background"]
    latar.inputs[0].default_value = (0.8, 0.8, 0.82, 1.0)
    latar.inputs[1].default_value = 0.7
    kd = bpy.data.cameras.new("Kamera")
    kd.type = "ORTHO"
    kam = bpy.data.objects.new("Kamera", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    for nama, en, rot in (("Kunci", 2.0, (60, 0, -30)), ("Isi", 1.0, (70, 0, 60)), ("Belakang", 0.6, (65, 0, 170))):
        l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
        l.data.energy = en
        l.rotation_euler = tuple(math.radians(v) for v in rot)
        scene.collection.objects.link(l)
    # lantai tipis sebagai garis acuan kaki
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, -0.002))
    lantai = bpy.context.active_object
    lantai.scale = (6.0, 6.0, 1.0)

    def geser(objs, dx, dy):
        for o in objs:
            o.location = Vector((dx, dy, 0.0))

    def render(nama, sasaran, arah, ortho, ukuran):
        scene.render.resolution_x, scene.render.resolution_y = ukuran
        kam.location = Vector(sasaran) + Vector(arah).normalized() * 6.0
        kam.rotation_euler = (Vector(sasaran) - kam.location).to_track_quat("-Z", "Y").to_euler()
        kam.data.ortho_scale = ortho
        path = os.path.join(akar, a.keluar, f"{a.nama}-banding-{nama}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("[banding]", path, flush=True)

    os.makedirs(os.path.join(akar, a.keluar), exist_ok=True)
    t = max(uk["kiri"]["tinggi"], uk["kanan"]["tinggi"])
    # depan: pembanding di kanan gambar
    geser(kanan, a.jarak, 0.0)
    render("depan", (a.jarak / 2, 0.0, t / 2), (0, -1, 0), 2.1, (1400, 1260))
    # badan atas dari depan, lebih rapat
    geser(kanan, 0.72, 0.0)
    render("dekat", (0.36, 0.0, t - 0.33), (0, -1, 0), 1.36, (1400, 800))
    # samping: pembanding di belakang (kanan gambar), keduanya menghadap kiri
    geser(kanan, 0.0, 0.75)
    render("samping", (0.0, 0.375, t / 2), (1, 0, 0), 2.1, (1400, 1260))


main()
