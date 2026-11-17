"""
Kepala ringan dari kepala Tripo (Blender): skala ke meter, rambut dipadatkan, wajah dijaga, bake tekstur.
Umum untuk semua tokoh; angka di wajah.json blok <blok>.kepala.ringan. Titik acuan wajah harus sudah ada
(kepala_render.py lalu kepala_acuan.py dengan --blok yang sama).

  blender -b -P tools/blender/kepala_ringan.py -- --masuk aset-mentah/prajurit-kepala-tripo.glb \
      --keluar aset-mentah/prajurit-kepala.glb --json tools/blender/wajah.json --blok prajurit \
      --tekstur aset-mentah/tekstur --nama prajurit --banding aset-mentah/pratinjau/prajurit-wajah-banding.png

Langkah:
  1. skala: dagu ke puncak kepala tanpa sanggul = tinggi badan / rasio_tinggi (bawaan 7,5)
  2. salinan kerja di-remesh voxel (serabut rambut menyatu jadi satu permukaan), hanya komponen terbesar
     yang dipakai, bahu patung dada dibuang kasar leher_sisa_m di bawah dagu (potongan presisi nanti di
     sambung_kepala.py)
  3. rambut (di atas alis dan belakang kepala) dihaluskan
  4. wajah (jendela depan di bawah alis, sampai tenggorokan): cara "tempel" membagi muka wajah lalu
     menempelkan verteksnya kembali ke permukaan asli Tripo, supaya bibir, kelopak mata, dan lubang hidung
     tidak ikut dihaluskan remesh; cara "remesh" membiarkannya (pembanding)
  5. decimate dua tahap dengan jatah segitiga terpisah untuk wajah dan sisanya, lalu verteks wajah
     ditempel sekali lagi
  6. Smart UV, bake warna dan normal dari mesh asli (selected to active), ekspor GLB
  7. simpangan wajah terhadap mesh asli (mm) dan gambar banding: baris atas asli, baris bawah hasil;
     kolom depan dan tiga perempat
"""
import argparse
import json
import math
import os
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True)
    p.add_argument("--tekstur", required=True, help="folder keluaran PNG hasil bake")
    p.add_argument("--nama", default="karakter")
    p.add_argument("--cara", choices=["tempel", "remesh"], default=None, help="menimpa ringan.cara di json")
    p.add_argument("--banding", default=None, help="PNG gambar banding wajah asli dan hasil")
    p.add_argument("--ukuran", type=int, default=1024)
    p.add_argument("--kualitas-jpeg", type=int, default=88)
    p.add_argument("--tanpa-json", action="store_true", help="uji: jangan tulis hasil ke json")
    return p.parse_args(argv)


def catat(*a):
    print("[ringan]", *a, flush=True)


def halus01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def pilih_hanya(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def koordinat(o):
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def pasang_koordinat(o, co):
    o.data.vertices.foreach_set("co", np.asarray(co, dtype=np.float64).ravel())
    o.data.update()


def tepi(o):
    e = np.empty(len(o.data.edges) * 2, dtype=np.int64)
    o.data.edges.foreach_get("vertices", e)
    return e.reshape(-1, 2)


def segitiga(o):
    o.data.calc_loop_triangles()
    t = np.empty(len(o.data.loop_triangles) * 3, dtype=np.int64)
    o.data.loop_triangles.foreach_get("vertices", t)
    return t.reshape(-1, 3)


def rata_tetangga(nilai, e, n):
    jumlah = np.zeros_like(nilai)
    hit = np.zeros(n)
    np.add.at(jumlah, e[:, 0], nilai[e[:, 1]])
    np.add.at(jumlah, e[:, 1], nilai[e[:, 0]])
    np.add.at(hit, e[:, 0], 1)
    np.add.at(hit, e[:, 1], 1)
    return jumlah / np.maximum(hit, 1)[:, None]


def bvh_dari(co, tri):
    return BVHTree.FromPolygons(co.tolist(), tri.tolist())


def tempel(co, bobot, bvh, ambang=1e-3):
    """Geser verteks ke titik terdekat di permukaan asli, sebanyak bobotnya."""
    hasil = co.copy()
    for i in np.nonzero(bobot > ambang)[0]:
        kena = bvh.find_nearest(Vector(co[i]))
        if kena[0] is not None:
            hasil[i] = co[i] + (np.array(kena[0]) - co[i]) * bobot[i]
    return hasil


def gambar_dari_material(mat, jenis):
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    soket = bsdf.inputs["Base Color"] if jenis == "warna" else bsdf.inputs["Normal"]
    dilihat, tumpukan = set(), [soket]
    while tumpukan:
        s = tumpukan.pop()
        for l in s.links:
            n = l.from_node
            if n.name in dilihat:
                continue
            dilihat.add(n.name)
            if n.type == "TEX_IMAGE":
                return n.image
            tumpukan.extend(n.inputs)
    return None


def material_sumber(mat, img, uv, mode):
    """Material mesh asli untuk bake: 'warna' = emisi base color, 'normal' = Principled dengan normal map."""
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = uv
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    if mode == "warna":
        tex.image.colorspace_settings.name = "sRGB"
        tex.interpolation = "Cubic"
        emisi = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
        nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    else:
        tex.image.colorspace_settings.name = "Non-Color"
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        nt.links.new(bsdf.outputs["BSDF"], keluaran.inputs["Surface"])


def bake_dari_asli(asli, rendah, jenis, img, cage, sinar, margin=8):
    scene = bpy.context.scene
    nt = rendah.data.materials[0].node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.name = "bake_target"
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    asli.select_set(True)
    rendah.select_set(True)
    bpy.context.view_layer.objects.active = rendah
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = cage
    scene.render.bake.max_ray_distance = sinar
    scene.render.bake.margin = margin
    scene.render.bake.use_clear = True
    scene.render.bake.normal_space = "TANGENT"
    bpy.ops.object.bake(type=jenis)
    scene.render.bake.use_selected_to_active = False
    nt.nodes.remove(node)


def peta_posisi(obj, N):
    """Posisi (meter) tiap texel UV mesh rendah, dan topeng texel yang tercakup."""
    scene = bpy.context.scene
    mat_lama = obj.data.materials[0]
    m = bpy.data.materials.new("posisi")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    kali = nt.nodes.new("ShaderNodeVectorMath")
    kali.operation = "MULTIPLY_ADD"                 # (posisi + 1) / 2 supaya tidak negatif
    kali.inputs[1].default_value = (0.5, 0.5, 0.5)
    kali.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(geo.outputs["Position"], kali.inputs[0])
    nt.links.new(kali.outputs["Vector"], emisi.inputs["Color"])
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    img = bpy.data.images.new("posisi", N, N, alpha=True, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    obj.data.materials[0] = m
    pilih_hanya(obj)
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 0
    scene.render.bake.use_clear = True
    bpy.ops.object.bake(type="EMIT")
    px = np.empty(N * N * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(N, N, 4)
    obj.data.materials[0] = mat_lama
    bpy.data.images.remove(img)
    bpy.data.materials.remove(m)
    return px[:, :, :3] * 2.0 - 1.0, px[:, :, :3].max(axis=2) > 1e-5


def warna_telinga(asli, kerja, img_bc, img_asli, uv_asli, bvh_a, co_a, tri_a, am, x_c, G):
    """Tepi daun telinga: sinar bake dari tepi yang tipis meleset dari telinga asli dan mengenai rambut di
    belakangnya (tepi telinga gelap bergerigi). Di kotak sekitar tiap telinga, texel yang hasil bake-nya jauh
    lebih gelap dari warna titik TERDEKAT di permukaan asli diganti dengan warna titik terdekat itu. Rambut
    sungguhan tidak berubah (titik terdekatnya juga rambut). Mengembalikan topeng texel yang diganti."""
    N = img_bc.size[0]
    pos, ada = peta_posisi(kerja, N)
    z_mata = (am["mata_kiri"][1] + am["mata_kanan"][1]) / 2
    z_mulut = (am["mulut_kiri"][1] + am["mulut_kanan"][1]) / 2
    co = koordinat(kerja)
    pita = (co[:, 2] > z_mulut) & (co[:, 2] < z_mata + 0.01)
    zona = np.zeros((N, N), bool)
    for tanda in (1.0, -1.0):
        dx = (co[:, 0] - x_c) * tanda
        luar = pita & (dx > dx[pita].max() - 0.008)
        y_t, z_t = float(co[luar, 1].mean()), float(co[luar, 2].mean())
        zona |= ada & ((pos[:, :, 0] - x_c) * tanda > G["x_min_m"]) & (np.abs(pos[:, :, 1] - y_t) < G["setengah_y_m"]) \
            & (np.abs(pos[:, :, 2] - z_t) < G["setengah_z_m"])
    # warna asli: tekstur dan UV mesh asli
    wa, ha = img_asli.size
    px_a = np.empty(wa * ha * 4, dtype=np.float32)
    img_asli.pixels.foreach_get(px_a)
    px_a = px_a.reshape(ha, wa, 4)
    lt = np.empty(len(asli.data.loop_triangles) * 3, dtype=np.int64)
    asli.data.loop_triangles.foreach_get("loops", lt)
    lt = lt.reshape(-1, 3)
    uv = np.empty(len(asli.data.loops) * 2, dtype=np.float32)
    asli.data.uv_layers[uv_asli].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    px = np.empty(N * N * 4, dtype=np.float32)
    img_bc.pixels.foreach_get(px)
    px = px.reshape(N, N, 4)
    ganti = np.zeros((N, N), bool)
    ys, xs = np.nonzero(zona)
    for y, x in zip(ys, xs):
        kena = bvh_a.find_nearest(Vector(pos[y, x].tolist()), G["jarak_maks_m"])
        if kena[0] is None:
            continue
        t = kena[2]
        a_, b_, c_ = co_a[tri_a[t, 0]], co_a[tri_a[t, 1]], co_a[tri_a[t, 2]]
        v0, v1, v2 = b_ - a_, c_ - a_, np.array(kena[0]) - a_
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-18:
            continue
        w1, w2 = (d11 * d20 - d01 * d21) / den, (d00 * d21 - d01 * d20) / den
        st = uv[lt[t, 0]] * (1 - w1 - w2) + uv[lt[t, 1]] * w1 + uv[lt[t, 2]] * w2
        u_, v_ = int(np.clip(st[0] * wa, 0, wa - 1)), int(np.clip(st[1] * ha, 0, ha - 1))
        warna = px_a[max(v_ - 1, 0):v_ + 2, max(u_ - 1, 0):u_ + 2, :3].reshape(-1, 3).mean(axis=0)
        if warna.mean() - px[y, x, :3].mean() > G["ambang_terang"] and warna.mean() > 0.35:
            px[y, x, :3] = warna
            ganti[y, x] = True
    # margin di sekitar texel yang diganti diisi ulang dari texel tercakup
    dekat = ganti.copy()
    for _ in range(10):
        dekat = dekat | np.roll(dekat, 1, 0) | np.roll(dekat, -1, 0) | np.roll(dekat, 1, 1) | np.roll(dekat, -1, 1)
    warna_ = px[:, :, :3] * ada[:, :, None]
    isi = ada.astype(np.float32)
    for _ in range(8):
        jml, cnt = np.zeros_like(warna_), np.zeros_like(isi)
        for dy, dx_ in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            jml += np.roll(warna_, (dy, dx_), axis=(0, 1))
            cnt += np.roll(isi, (dy, dx_), axis=(0, 1))
        baru = (isi < 0.5) & (cnt > 0.5) & dekat
        warna_[baru] = jml[baru] / cnt[baru][:, None]
        px[:, :, :3][baru] = warna_[baru]
        isi[baru] = 1.0
    img_bc.pixels.foreach_set(px.ravel())
    return ganti, int(zona.sum())


def simpan_png(img, path):
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


def jpeg_dari_png(path_png, path_jpg, nama, ruang, kualitas):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = kualitas
    scene.render.image_settings.color_mode = "RGB"
    src = bpy.data.images.load(path_png)
    src.colorspace_settings.name = ruang
    src.pixels[0]                       # gambar dimuat malas; sentuh piksel sebelum disimpan ulang
    src.scale(src.size[0], src.size[1])
    src.file_format = "JPEG"
    src.filepath_raw = path_jpg
    src.save()
    bpy.data.images.remove(src)
    im = bpy.data.images.load(path_jpg)
    im.name = nama
    im.colorspace_settings.name = ruang
    return im


def siapkan_render(ukuran):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = ukuran
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    latar = scene.world.node_tree.nodes["Background"]
    latar.inputs[0].default_value = (0.78, 0.78, 0.8, 1.0)
    latar.inputs[1].default_value = 0.6
    kd = bpy.data.cameras.new("KameraBanding")
    kd.type = "ORTHO"
    kam = bpy.data.objects.new("KameraBanding", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    for nama, en, rot in (("Kunci", 2.2, (62, 0, -28)), ("Isi", 0.8, (75, 0, 40))):
        l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
        l.data.energy = en
        l.rotation_euler = tuple(math.radians(v) for v in rot)
        scene.collection.objects.link(l)
    return kam


def render_wajah(kam, sasaran, ortho, putar_derajat, path):
    s = math.radians(putar_derajat)
    arah = Vector((-math.sin(s), -math.cos(s), 0.0))       # dari sasaran ke kamera
    kam.location = sasaran + arah * 2.0
    kam.rotation_euler = (sasaran - kam.location).to_track_quat("-Z", "Y").to_euler()
    kam.data.ortho_scale = ortho
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"     # bake dan simpan JPEG mengubah format keluaran
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def susun(paths_baris, path_keluar):
    """Susun ubin PNG (daftar baris, tiap baris daftar path) menjadi satu gambar."""
    baris = []
    for row in paths_baris:
        ubin = []
        for p in row:
            im = bpy.data.images.load(p)
            w, h = im.size
            px = np.empty(w * h * 4, dtype=np.float32)
            im.pixels.foreach_get(px)
            ubin.append(px.reshape(h, w, 4))
            bpy.data.images.remove(im)
        baris.append(np.hstack(ubin))
    semua = np.vstack(baris[::-1])       # piksel Blender dari bawah ke atas
    h, w = semua.shape[:2]
    out = bpy.data.images.new("banding", w, h, alpha=False)
    out.pixels.foreach_set(semua.ravel())
    out.filepath_raw = path_keluar
    out.file_format = "PNG"
    out.save()


def main():
    a = argumen()
    akar = os.getcwd()
    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json))
    P = data.setdefault(a.blok, {})
    K = P["kepala"]
    R = K.setdefault("ringan", {})
    for k, v in {
        "cara": "tempel", "segitiga": 3500, "segitiga_wajah": 1400, "voxel_m": 0.004, "leher_sisa_m": 0.05,
        "puncak_tebal_min": 0.6,
        "halus_rambut_iterasi": 12, "halus_rambut_faktor": 0.5,
        "wajah_sudut_penuh": 55.0, "wajah_sudut_nol": 75.0, "wajah_atas_penuh_m": 0.025, "wajah_atas_nol_m": 0.04,
        "wajah_bagi": 1, "smart_uv_sudut": 66.0, "bake_cage_m": 0.008, "bake_sinar_m": 0.06,
        "keterangan": "meter setelah kepala diskalakan. wajah = jendela depan (sudut dari sumbu tegak kepala: penuh "
                      "sampai wajah_sudut_penuh, nol di wajah_sudut_nol) di bawah mata + wajah_atas_*; rambut = di atas "
                      "itu dan belakang kepala. cara 'tempel': verteks wajah ditempel ke permukaan asli; 'remesh': tidak.",
    }.items():
        R.setdefault(k, v)
    G = R.setdefault("telinga", {"aktif": False, "x_min_m": 0.058, "setengah_y_m": 0.04, "setengah_z_m": 0.045,
                                 "jarak_maks_m": 0.012, "ambang_terang": 0.08})
    cara = a.cara or R["cara"]
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-ringan")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(os.path.join(akar, a.tekstur), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    asli = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.polygons))
    asli.name = "asli"
    pilih_hanya(asli)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # 1. Skala: dagu ke puncak kepala tanpa sanggul. Puncak = irisan tertinggi yang tebalnya (sumbu Y) masih
    # sebagian besar tebal kepala; sanggul di atasnya jauh lebih kecil.
    ac = K["acuan"]
    co = koordinat(asli)
    z_mata_u = (ac["mata_kiri"][1] + ac["mata_kanan"][1]) / 2
    if K.get("puncak_z") is None:
        zs = np.arange(z_mata_u, co[:, 2].max(), 0.005)
        tebal = np.array([np.ptp(co[(co[:, 2] >= z) & (co[:, 2] < z + 0.005), 1]) if ((co[:, 2] >= z) & (co[:, 2] < z + 0.005)).any() else 0.0
                          for z in zs])
        ok = np.nonzero(tebal >= R["puncak_tebal_min"] * tebal.max())[0]
        K["puncak_z"] = round(float(zs[ok.max()] + 0.005), 4)
    tinggi_badan = P.setdefault("tinggi_m", 1.68)
    rasio = K.setdefault("rasio_tinggi", 7.5)
    skala = (tinggi_badan / rasio) / (K["puncak_z"] - ac["dagu"][1])
    asli.scale = (skala, skala, skala)
    bpy.ops.object.transform_apply(scale=True)
    am = {k: [v[0] * skala, v[1] * skala] for k, v in ac.items()}
    z_mata = (am["mata_kiri"][1] + am["mata_kanan"][1]) / 2
    x_c = (am["mata_kiri"][0] + am["mata_kanan"][0]) / 2
    z_dagu = am["dagu"][1]
    co_a = koordinat(asli)
    tri_a = segitiga(asli)
    bvh_a = bvh_dari(co_a, tri_a)
    kena_d = bvh_a.ray_cast(Vector((x_c, -5.0, z_mata)), Vector((0, 1, 0)))
    kena_b = bvh_a.ray_cast(Vector((x_c, 5.0, z_mata)), Vector((0, -1, 0)))
    y_depan, y_belakang = kena_d[0].y, kena_b[0].y
    y_c = (y_depan + y_belakang) / 2
    catat(f"skala {skala:.4f} m per satuan: dagu z {z_dagu:.3f}, mata z {z_mata:.3f}, puncak tanpa sanggul "
          f"{K['puncak_z'] * skala:.3f}, puncak sanggul {co_a[:, 2].max():.3f} m; jarak mata {K['jarak_mata'] * skala * 100:.1f} cm; "
          f"sumbu kepala x {x_c:.3f} y {y_c:.3f}")

    def bobot_wajah(c):
        az = np.degrees(np.arctan2(np.abs(c[:, 0] - x_c), -(c[:, 1] - y_c)))
        w = halus01((R["wajah_sudut_nol"] - az) / (R["wajah_sudut_nol"] - R["wajah_sudut_penuh"]))
        return w * halus01((z_mata + R["wajah_atas_nol_m"] - c[:, 2]) / (R["wajah_atas_nol_m"] - R["wajah_atas_penuh_m"]))

    def bobot_rambut(c):
        atas = halus01((c[:, 2] - (z_mata + R["wajah_atas_penuh_m"])) / 0.015)
        belakang = halus01((c[:, 1] - (y_c + 0.02)) / 0.02) * halus01((c[:, 2] - z_dagu) / 0.02)
        return np.maximum(atas, belakang) * (1 - bobot_wajah(c))

    # Gambar banding: mesh asli dirender dulu, sebelum materialnya diubah untuk bake.
    ubin = {}
    if a.banding:
        kam = siapkan_render(640)
        sasaran = Vector((x_c, y_c, (z_mata + (am["mulut_kiri"][1] + am["mulut_kanan"][1]) / 2) / 2))
        for nama, putar in (("depan", 0.0), ("tigaperempat", 40.0)):
            ubin[("asli", nama)] = os.path.join(tmp, f"asli-{nama}.png")
            render_wajah(kam, sasaran, 0.25, putar, ubin[("asli", nama)])

    # 2. Salinan kerja: remesh voxel, komponen terbesar, buang bahu.
    pilih_hanya(asli)
    bpy.ops.object.duplicate()
    kerja = bpy.context.view_layer.objects.active
    kerja.name = "kepala"
    kerja.data.remesh_voxel_size = R["voxel_m"]
    kerja.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    bm = bmesh.new()
    bm.from_mesh(kerja.data)
    bm.verts.ensure_lookup_table()
    label = [-1] * len(bm.verts)
    ukuran_komp = []
    for v in bm.verts:
        if label[v.index] >= 0:
            continue
        k = len(ukuran_komp)
        tumpuk, n = [v], 0
        label[v.index] = k
        while tumpuk:
            w = tumpuk.pop()
            n += 1
            for e in w.link_edges:
                u = e.other_vert(w)
                if label[u.index] < 0:
                    label[u.index] = k
                    tumpuk.append(u)
        ukuran_komp.append(n)
    terbesar = int(np.argmax(ukuran_komp))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if label[v.index] != terbesar], context="VERTS")
    z_buang = z_dagu - R["leher_sisa_m"]
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6,
                           plane_co=Vector((0, 0, z_buang)), plane_no=Vector((0, 0, 1)), clear_inner=True)
    bm.to_mesh(kerja.data)
    bm.free()
    kerja.data.update()
    catat(f"remesh voxel {R['voxel_m'] * 1000:.1f} mm: {len(ukuran_komp)} komponen (terbesar {max(ukuran_komp)} verteks, "
          f"sisanya dibuang {sum(ukuran_komp) - max(ukuran_komp)}), bahu dibuang di bawah z {z_buang:.3f}; "
          f"{len(segitiga(kerja))} segitiga")

    # 3. Rambut dihaluskan (Laplace berbobot).
    c = koordinat(kerja)
    e = tepi(kerja)
    wr = bobot_rambut(c)
    for _ in range(R["halus_rambut_iterasi"]):
        c = c + (rata_tetangga(c, e, len(c)) - c) * (R["halus_rambut_faktor"] * wr)[:, None]
    pasang_koordinat(kerja, c)
    catat(f"rambut dihaluskan: {(wr > 0.5).sum()} verteks, {R['halus_rambut_iterasi']} iterasi")

    # 4. Wajah: bagi muka di jendela wajah, tempel ke permukaan asli.
    bm = bmesh.new()
    bm.from_mesh(kerja.data)
    if cara == "tempel" and R["wajah_bagi"] > 0:
        bm.verts.ensure_lookup_table()
        ww = bobot_wajah(np.array([v.co[:] for v in bm.verts]))
        tepi_wajah = [ed for ed in bm.edges if ww[ed.verts[0].index] > 0.02 and ww[ed.verts[1].index] > 0.02]
        bmesh.ops.subdivide_edges(bm, edges=tepi_wajah, cuts=R["wajah_bagi"], use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(kerja.data)
    bm.free()
    kerja.data.update()
    c = koordinat(kerja)
    ww = bobot_wajah(c)
    if cara == "tempel":
        c = tempel(c, ww, bvh_a)
        pasang_koordinat(kerja, c)
    catat(f"cara {cara}: verteks wajah {(ww > 0.5).sum()} dari {len(c)}; {len(segitiga(kerja))} segitiga sebelum decimate")

    # 5. Decimate dua tahap. Grup verteks pada Decimate: bobot 1 = boleh diruntuhkan, bobot 0 = dijaga.
    def hitung_wajah():
        t = segitiga(kerja)
        w = bobot_wajah(koordinat(kerja))
        return int((w[t] > 0.5).all(axis=1).sum()), len(t)

    # Daun telinga punya jatah segitiga sendiri (segitiga_telinga, untuk kedua telinga). Tanpa itu telinga ikut
    # diruntuhkan bersama rambut sampai compang-camping, dan rambut gelap di belakangnya tampak di sela-selanya.
    seg_tel = R.get("segitiga_telinga", 0)
    z_mulut_m = (am["mulut_kiri"][1] + am["mulut_kanan"][1]) / 2
    pusat_tel = []
    if seg_tel:
        pita_t = (c[:, 2] > z_mulut_m) & (c[:, 2] < z_mata + 0.01)
        for tanda in (1.0, -1.0):
            dx = (c[:, 0] - x_c) * tanda
            luar = pita_t & (dx > dx[pita_t].max() - 0.008)
            pusat_tel.append((tanda, float(c[luar, 1].mean()), float(c[luar, 2].mean())))

    def topeng_telinga(k_):
        m = np.zeros(len(k_), bool)
        for tanda, y_t, z_t in pusat_tel:
            m |= ((k_[:, 0] - x_c) * tanda > G["x_min_m"]) & (np.abs(k_[:, 1] - y_t) < G["setengah_y_m"]) \
                & (np.abs(k_[:, 2] - z_t) < G["setengah_z_m"])
        return m

    def hitung_telinga():
        t = segitiga(kerja)
        m = topeng_telinga(koordinat(kerja)) & ~(bobot_wajah(koordinat(kerja)) > 0.5)
        return int(m[t].all(axis=1).sum()), len(t)

    g_wajah = kerja.vertex_groups.new(name="wajah")
    g_tel = kerja.vertex_groups.new(name="telinga")
    g_lain = kerja.vertex_groups.new(name="lain")
    keras = ww > 0.5
    tel = topeng_telinga(c) & ~keras
    g_wajah.add(np.nonzero(keras)[0].tolist(), 1.0, "REPLACE")
    if tel.any():
        g_tel.add(np.nonzero(tel)[0].tolist(), 1.0, "REPLACE")
    g_lain.add(np.nonzero(~keras & ~tel)[0].tolist(), 1.0, "REPLACE")

    def decimate(sasaran_total, grup):
        dec = kerja.modifiers.new("Decimate", "DECIMATE")
        dec.decimate_type = "COLLAPSE"
        dec.ratio = min(1.0, sasaran_total / len(segitiga(kerja)))
        dec.use_collapse_triangulate = True
        if grup:
            dec.vertex_group = grup
            dec.vertex_group_factor = 100.0
        pilih_hanya(kerja)
        bpy.ops.object.modifier_apply(modifier="Decimate")

    n_w, n_t = hitung_wajah()
    if R["segitiga_wajah"] and cara == "tempel":
        if n_w > R["segitiga_wajah"]:
            decimate(n_t - (n_w - R["segitiga_wajah"]), "wajah")
        n_e0 = n_e1 = 0
        if seg_tel:
            n_e0, n_te = hitung_telinga()
            if n_e0 > seg_tel:
                decimate(n_te - (n_e0 - seg_tel), "telinga")
            n_e1, _ = hitung_telinga()
        n_w1, n_t1 = hitung_wajah()
        decimate(R["segitiga"], "lain")
        n_w2, n_t2 = hitung_wajah()
        catat(f"decimate dua tahap: wajah {n_w} -> {n_w1} -> {n_w2}; total {n_t} -> {n_t1} -> {n_t2}"
              + (f"; telinga {n_e0} -> {n_e1} -> {hitung_telinga()[0]}" if seg_tel else ""))
    else:
        decimate(R["segitiga"], None)
        n_w2, n_t2 = hitung_wajah()
        catat(f"decimate satu tahap: wajah {n_w} -> {n_w2}; total {n_t} -> {n_t2}")
    if cara == "tempel":
        c = koordinat(kerja)
        pasang_koordinat(kerja, tempel(c, bobot_wajah(c), bvh_a))
    for g in list(kerja.vertex_groups):
        kerja.vertex_groups.remove(g)

    # 6. UV, material, bake dari mesh asli.
    kerja.data.materials.clear()
    mat = bpy.data.materials.new("kepala")
    mat.use_nodes = True
    kerja.data.materials.append(mat)
    for lay in list(kerja.data.uv_layers):
        kerja.data.uv_layers.remove(lay)
    kerja.data.uv_layers.new(name="UVMap")
    pilih_hanya(kerja)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(R["smart_uv_sudut"]), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()

    mat_asli = asli.data.materials[0]
    img_bc_asli, img_n_asli = gambar_dari_material(mat_asli, "warna"), gambar_dari_material(mat_asli, "normal")
    uv_asli = asli.data.uv_layers.active.name
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    N = a.ukuran
    path_bc = os.path.join(akar, a.tekstur, f"{a.nama}-kepala-basecolor.png")
    path_n = os.path.join(akar, a.tekstur, f"{a.nama}-kepala-normal.png")
    material_sumber(mat_asli, img_bc_asli, uv_asli, "warna")
    img_bc = bpy.data.images.new("bake_bc", N, N, alpha=False)
    img_bc.colorspace_settings.name = "sRGB"
    bake_dari_asli(asli, kerja, "EMIT", img_bc, R["bake_cage_m"], R["bake_sinar_m"])
    ganti_telinga = None
    if G.get("aktif"):
        ganti_telinga, n_zona = warna_telinga(asli, kerja, img_bc, img_bc_asli, uv_asli, bvh_a, co_a, tri_a, am, x_c, G)
        catat(f"telinga: {int(ganti_telinga.sum())} dari {n_zona} texel di kotak telinga diganti warna titik terdekat mesh asli")
    simpan_png(img_bc, path_bc)
    material_sumber(mat_asli, img_n_asli, uv_asli, "normal")
    img_n = bpy.data.images.new("bake_n", N, N, alpha=False)
    img_n.colorspace_settings.name = "Non-Color"
    bake_dari_asli(asli, kerja, "NORMAL", img_n, R["bake_cage_m"], R["bake_sinar_m"])
    if ganti_telinga is not None and ganti_telinga.any():
        # di texel itu normal hasil bake berasal dari rambut: dibuat rata
        pn = np.empty(N * N * 4, dtype=np.float32)
        img_n.pixels.foreach_get(pn)
        pn = pn.reshape(N, N, 4)
        pn[ganti_telinga, :3] = (0.5, 0.5, 1.0)
        img_n.pixels.foreach_set(pn.ravel())
    simpan_png(img_n, path_n)
    catat(f"bake warna dan normal {N}px dari mesh asli selesai")

    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = jpeg_dari_png(path_bc, os.path.join(tmp, f"{a.nama}_kepala_basecolor.jpg"), f"{a.nama}_kepala_basecolor", "sRGB", a.kualitas_jpeg)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    texn = nt.nodes.new("ShaderNodeTexImage")
    texn.image = jpeg_dari_png(path_n, os.path.join(tmp, f"{a.nama}_kepala_normal.jpg"), f"{a.nama}_kepala_normal", "Non-Color", a.kualitas_jpeg)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(texn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    # 7. Simpangan wajah: jarak verteks wajah mesh asli ke permukaan hasil (mm).
    co_r, tri_r = koordinat(kerja), segitiga(kerja)
    bvh_r = bvh_dari(co_r, tri_r)
    wa = bobot_wajah(co_a)
    def simpang(topeng):
        idx = np.nonzero(topeng)[0]
        if len(idx) > 6000:
            idx = idx[:: len(idx) // 6000]
        d = np.array([bvh_r.find_nearest(Vector(co_a[i]))[3] for i in idx]) * 1000
        return [round(float(v), 2) for v in (d.mean(), np.percentile(d, 95), d.max())]
    xm = (am["mulut_kiri"][0] + am["mulut_kanan"][0]) / 2
    zm = (am["mulut_kiri"][1] + am["mulut_kanan"][1]) / 2
    lm = abs(am["mulut_kanan"][0] - am["mulut_kiri"][0]) / 2
    depan = (wa > 0.99) & (co_a[:, 1] < y_c)
    daerah = {
        "wajah": depan & (co_a[:, 2] > z_dagu - 0.01),
        "mulut": depan & (np.abs(co_a[:, 0] - xm) < lm + 0.005) & (np.abs(co_a[:, 2] - zm) < 0.012),
        "mata": depan & (np.minimum(np.abs(co_a[:, 0] - am["mata_kiri"][0]), np.abs(co_a[:, 0] - am["mata_kanan"][0])) < 0.018)
                & (np.abs(co_a[:, 2] - z_mata) < 0.010),
        "hidung": depan & (np.abs(co_a[:, 0] - am["ujung_hidung"][0]) < 0.02) & (co_a[:, 2] > am["ujung_hidung"][1] - 0.012)
                  & (co_a[:, 2] < am["ujung_hidung"][1] + 0.010),
        "bawah_dagu": depan & (co_a[:, 2] <= z_dagu - 0.01) & (co_a[:, 2] > z_buang + 0.005),
    }
    sim = {k: simpang(v) for k, v in daerah.items()}
    catat(f"simpangan terhadap mesh asli, mm [rata, p95, maks]: {sim}")

    if a.banding:
        asli.hide_render = True
        mat.node_tree.nodes.active = bsdf
        for nama, putar in (("depan", 0.0), ("tigaperempat", 40.0)):
            ubin[("hasil", nama)] = os.path.join(tmp, f"hasil-{cara}-{nama}.png")
            render_wajah(kam, sasaran, 0.25, putar, ubin[("hasil", nama)])
        path_banding = os.path.join(akar, a.banding)
        os.makedirs(os.path.dirname(path_banding), exist_ok=True)
        susun([[ubin[("asli", "depan")], ubin[("asli", "tigaperempat")]],
               [ubin[("hasil", "depan")], ubin[("hasil", "tigaperempat")]]], path_banding)
        catat("gambar banding (atas asli, bawah hasil):", a.banding)

    bpy.data.objects.remove(asli, do_unlink=True)
    pilih_hanya(kerja)
    keluar = os.path.join(akar, a.keluar)
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True, export_tangents=False, export_animations=False, export_skins=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    R["hasil"] = {
        "cara": cara, "skala_m_per_satuan": round(float(skala), 4), "segitiga": int(n_t2), "segitiga_wajah": int(n_w2),
        "acuan_m": {k: [round(v[0], 4), round(v[1], 4)] for k, v in am.items()},
        "sumbu_m": [round(float(x_c), 4), round(float(y_c), 4)], "y_depan_mata_m": round(float(y_depan), 4),
        "puncak_m": round(float(K["puncak_z"] * skala), 4), "puncak_sanggul_m": round(float(co_a[:, 2].max()), 4),
        "z_bawah_m": round(float(z_buang), 4), "simpangan_mm": sim, "berkas_mb": round(os.path.getsize(keluar) / 1e6, 2),
    }
    if not a.tanpa_json:
        json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {a.keluar}: {os.path.getsize(keluar) / 1e6:.2f} MB, {n_t2} segitiga (wajah {n_w2})")


main()
