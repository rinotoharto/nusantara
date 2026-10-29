"""
Optimasi karakter dari GLB mentah (Tripo) menjadi GLB siap game.

Jalankan dari akar repo:
  blender -b -P tools/blender/optimasi_karakter.py -- \
      --masuk aset-mentah/wijaya-tripo.glb --keluar public/models/wijaya.glb \
      --segitiga 15000 --tekstur 2048 --tinggi 1.7 --pratinjau aset-mentah/pratinjau --nama wijaya

Langkah:
  1. impor, gabung verteks berdekatan, hapus verteks lepas, perbaiki normal
  2. salin mesh tinggi, kurangi salinan rendah dengan Decimate (Collapse)
  3. bake normal dari mesh tinggi ke mesh rendah (atau pakai normal map asal: --normal asal)
  4. skala ke tinggi target, titik pusat di antara kaki di lantai, putar kalau perlu (--putar derajat)
  5. tekstur diperkecil (base color dan normal ke --tekstur, metallic-roughness ke setengahnya)
  6. ekspor GLB dengan Draco, cetak ringkasan
  7. render pratinjau 4 sudut sebelum dan sesudah (kalau --pratinjau diberi)
"""
import argparse
import math
import os
import sys
import tempfile
import time

import bpy
import numpy as np
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--segitiga", type=int, default=15000)
    p.add_argument("--tekstur", type=int, default=2048)
    p.add_argument("--tinggi", type=float, default=1.7)
    p.add_argument("--putar", type=float, default=0.0, help="putaran sumbu tegak, derajat")
    p.add_argument("--normal", choices=["bake", "asal"], default="bake")
    p.add_argument("--normal-dari", default=None, help="pakai normal map PNG hasil bake sebelumnya, tanpa bake ulang")
    p.add_argument("--ukuran-normal", type=int, default=None, help="ukuran normal map, bawaan sama dengan --tekstur")
    p.add_argument("--format-normal", choices=["png", "jpeg"], default="jpeg")
    p.add_argument("--pratinjau", default=None, help="folder render pembanding")
    p.add_argument("--nama", default="karakter", help="awalan nama berkas pratinjau")
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    return p.parse_args(argv)


def catat(*a):
    print("[optimasi]", *a, flush=True)


def objek_mesh():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def jumlah_segitiga(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def pilih_hanya(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def node_gambar(mat, jenis):
    """Cari node Image Texture yang terhubung ke masukan `jenis` Principled: 'base', 'rm', 'normal'."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if jenis == "base":
        soket = bsdf.inputs["Base Color"]
    elif jenis == "rm":
        soket = bsdf.inputs["Roughness"]
    else:
        soket = bsdf.inputs["Normal"]
    dilihat = set()
    tumpukan = [soket]
    while tumpukan:
        s = tumpukan.pop()
        for link in s.links:
            n = link.from_node
            if n.name in dilihat:
                continue
            dilihat.add(n.name)
            if n.type == "TEX_IMAGE":
                return n
            tumpukan.extend(n.inputs)
    return None


def simpan_gambar(img, path, format_, kualitas):
    """Simpan gambar (yang mungkin terkompresi di dalam GLB) ke berkas lalu muat ulang sebagai gambar baru."""
    scene = bpy.context.scene
    scene.render.image_settings.file_format = format_
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = kualitas
    scene.render.image_settings.compression = 50
    ruang_warna = img.colorspace_settings.name
    img.file_format = format_
    img.filepath_raw = path
    img.save()
    baru = bpy.data.images.load(path)
    baru.colorspace_settings.name = ruang_warna
    return baru


def siapkan_gpu():
    prefs = bpy.context.preferences.addons.get("cycles")
    if not prefs:
        return "CPU"
    cp = prefs.preferences
    for jenis in ("METAL", "CUDA", "OPTIX", "HIP", "ONEAPI"):
        try:
            cp.compute_device_type = jenis
            cp.get_devices()
            ada = False
            for d in cp.devices:
                if d.type == jenis:
                    d.use = True
                    ada = True
                elif d.type == "CPU":
                    d.use = False
            if ada:
                bpy.context.scene.cycles.device = "GPU"
                return jenis
        except TypeError:
            continue
    return "CPU"


def bake_normal(tinggi, rendah, ukuran, path_png):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    perangkat = siapkan_gpu()
    scene.cycles.samples = 4
    scene.cycles.use_denoising = False
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.008
    scene.render.bake.max_ray_distance = 0.02
    scene.render.bake.margin = 16
    scene.render.bake.normal_space = "TANGENT"
    scene.render.bake.use_clear = True

    mat = rendah.data.materials[0]
    nt = mat.node_tree
    img = bpy.data.images.new("bake_normal", ukuran, ukuran, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.generated_color = (0.5, 0.5, 1.0, 1.0)
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.name = "bake_normal"
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node

    bpy.ops.object.select_all(action="DESELECT")
    tinggi.select_set(True)
    rendah.select_set(True)
    bpy.context.view_layer.objects.active = rendah
    t0 = time.time()
    bpy.ops.object.bake(type="NORMAL")
    lama = time.time() - t0
    catat(f"bake normal {ukuran}px di {perangkat}: {lama:.1f} s")

    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 50
    img.file_format = "PNG"
    img.filepath_raw = path_png
    img.save()
    nt.nodes.remove(node)
    baru = bpy.data.images.load(path_png)
    baru.colorspace_settings.name = "Non-Color"
    bpy.data.images.remove(img)
    return baru, lama


def siapkan_render(obj, tinggi_model):
    """Kamera ortografis potret yang memuat seluruh badan, lampu sederhana, latar polos."""
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        try:
            scene.render.engine = "BLENDER_EEVEE"
        except TypeError:
            scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1152
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"

    if scene.world is None:
        scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    latar = scene.world.node_tree.nodes.get("Background")
    if latar:
        latar.inputs[0].default_value = (0.35, 0.35, 0.38, 1.0)
        latar.inputs[1].default_value = 1.0

    kam_data = bpy.data.cameras.new("KameraPratinjau")
    kam_data.type = "ORTHO"
    kam_data.ortho_scale = tinggi_model * 1.15 * 1.5  # sumbu panjang (tinggi) = 1.5 x sumbu pendek
    kam = bpy.data.objects.new("KameraPratinjau", kam_data)
    scene.collection.objects.link(kam)
    scene.camera = kam

    matahari = bpy.data.objects.new("Matahari", bpy.data.lights.new("Matahari", "SUN"))
    matahari.data.energy = 3.0
    matahari.rotation_euler = (math.radians(55), 0, math.radians(-35))
    scene.collection.objects.link(matahari)
    isi = bpy.data.objects.new("Isi", bpy.data.lights.new("Isi", "SUN"))
    isi.data.energy = 1.0
    isi.rotation_euler = (math.radians(70), 0, math.radians(140))
    scene.collection.objects.link(isi)
    return kam


def render_sudut(kam, pusat, tinggi_model, folder, awalan):
    """Empat sudut: depan (dari -Y), samping (dari +X), belakang (dari +Y), tiga perempat."""
    os.makedirs(folder, exist_ok=True)
    jarak = tinggi_model * 4
    sudut = {
        "depan": (0.0, -1.0),
        "samping": (1.0, 0.0),
        "belakang": (0.0, 1.0),
        "tigaperempat": (-0.7071, -0.7071),
    }
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    for nama, (dx, dy) in sudut.items():
        kam.location = Vector((pusat.x + dx * jarak, pusat.y + dy * jarak, pusat.z))
        arah = pusat - kam.location
        kam.rotation_euler = arah.to_track_quat("-Z", "Y").to_euler()
        path = os.path.join(folder, f"{awalan}-{nama}.png")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        catat("pratinjau", path)


def ukuran_mb(path):
    return os.path.getsize(path) / (1024 * 1024)


def main():
    a = argumen()
    akar = os.getcwd()
    masuk = os.path.join(akar, a.masuk)
    keluar = os.path.join(akar, a.keluar)
    os.makedirs(os.path.dirname(keluar), exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-optimasi")
    os.makedirs(tmp, exist_ok=True)
    ukuran_normal = a.ukuran_normal or a.tekstur

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=masuk)
    meshes = objek_mesh()
    if not meshes:
        raise SystemExit("tidak ada mesh di berkas masuk")
    if len(meshes) > 1:
        pilih_hanya(meshes[0])
        for o in meshes[1:]:
            o.select_set(True)
        bpy.ops.object.join()
    tinggi = objek_mesh()[0]
    tinggi.name = "tinggi"
    pilih_hanya(tinggi)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    segitiga_awal = jumlah_segitiga(tinggi)
    catat(f"masuk: {segitiga_awal} segitiga, {len(tinggi.data.vertices)} verteks")

    # Ukuran dan pusat sebelum diubah, untuk pratinjau "sebelum".
    co = np.array([v.co[:] for v in tinggi.data.vertices])
    tinggi_asal = float(co[:, 2].max() - co[:, 2].min())
    pusat_asal = Vector(((co[:, 0].max() + co[:, 0].min()) / 2, (co[:, 1].max() + co[:, 1].min()) / 2,
                         (co[:, 2].max() + co[:, 2].min()) / 2))
    if a.putar:
        tinggi.rotation_euler.z = math.radians(a.putar)
        bpy.ops.object.transform_apply(rotation=True)

    kam = None
    if a.pratinjau:
        kam = siapkan_render(tinggi, tinggi_asal)
        render_sudut(kam, pusat_asal, tinggi_asal, os.path.join(akar, a.pratinjau), f"{a.nama}-sebelum")

    # 1. rapikan mesh tinggi
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.00005)
    bpy.ops.mesh.delete_loose()
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    catat(f"setelah rapi: {jumlah_segitiga(tinggi)} segitiga, {len(tinggi.data.vertices)} verteks")

    # 2. salinan rendah
    bpy.ops.object.duplicate()
    rendah = bpy.context.view_layer.objects.active
    rendah.name = "rendah"
    rendah.data.name = "rendah"
    mat_asal = tinggi.data.materials[0]
    mat = mat_asal.copy()
    mat.name = "karakter"
    rendah.data.materials[0] = mat
    dec = rendah.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = a.segitiga / jumlah_segitiga(rendah)
    dec.use_collapse_triangulate = True
    pilih_hanya(rendah)
    bpy.ops.object.modifier_apply(modifier="Decimate")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    segitiga_akhir = jumlah_segitiga(rendah)
    catat(f"rendah: {segitiga_akhir} segitiga, {len(rendah.data.vertices)} verteks")

    # 3. normal map
    n_base = node_gambar(mat, "base")
    n_rm = node_gambar(mat, "rm")
    n_normal = node_gambar(mat, "normal")
    lama_bake = None
    path_bake = os.path.join(tmp, f"{a.nama}_normal_bake.png")
    if a.normal_dari:
        img_normal = bpy.data.images.load(os.path.join(akar, a.normal_dari))
        img_normal.colorspace_settings.name = "Non-Color"
        catat("normal map dari", a.normal_dari)
    elif a.normal == "bake":
        tinggi.hide_render = False
        img_normal, lama_bake = bake_normal(tinggi, rendah, ukuran_normal, path_bake)
        catat("normal map hasil bake disimpan di", path_bake)
    else:
        img_normal = n_normal.image
    if img_normal.size[0] != ukuran_normal:
        img_normal.scale(ukuran_normal, ukuran_normal)
    ekst, fmt = (".jpg", "JPEG") if a.format_normal == "jpeg" else (".png", "PNG")
    img_normal = simpan_gambar(img_normal, os.path.join(tmp, f"{a.nama}_normal{ekst}"), fmt, a.kualitas_jpeg)
    if n_normal is None:
        n_normal = mat.node_tree.nodes.new("ShaderNodeTexImage")
        nm = mat.node_tree.nodes.new("ShaderNodeNormalMap")
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        mat.node_tree.links.new(n_normal.outputs["Color"], nm.inputs["Color"])
        mat.node_tree.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    n_normal.image = img_normal
    n_normal.image.colorspace_settings.name = "Non-Color"

    # mesh tinggi tidak dipakai lagi (kecuali sudah dirender)
    bpy.data.objects.remove(tinggi, do_unlink=True)

    # 4. skala dan titik pusat
    pilih_hanya(rendah)
    co = np.array([v.co[:] for v in rendah.data.vertices])
    skala = a.tinggi / float(co[:, 2].max() - co[:, 2].min())
    rendah.scale = (skala, skala, skala)
    bpy.ops.object.transform_apply(scale=True)
    co = np.array([v.co[:] for v in rendah.data.vertices])
    z_min = co[:, 2].min()
    kaki = co[co[:, 2] < z_min + 0.05 * a.tinggi / 1.7]
    geser = Vector((-float(kaki[:, 0].mean()), -float(kaki[:, 1].mean()), -float(z_min)))
    rendah.location = geser
    bpy.ops.object.transform_apply(location=True)
    co = np.array([v.co[:] for v in rendah.data.vertices])
    catat(f"ukuran akhir: lebar {np.ptp(co[:,0]):.3f} tebal {np.ptp(co[:,1]):.3f} tinggi {np.ptp(co[:,2]):.3f} m, "
          f"z min {co[:,2].min():.4f}")

    # 5. tekstur base color dan metallic-roughness
    if n_base and n_base.image:
        img = n_base.image
        img.scale(a.tekstur, a.tekstur)
        n_base.image = simpan_gambar(img, os.path.join(tmp, f"{a.nama}_basecolor.jpg"), "JPEG", a.kualitas_jpeg)
        n_base.image.colorspace_settings.name = "sRGB"
    if n_rm and n_rm.image:
        img = n_rm.image
        img.scale(a.tekstur // 2, a.tekstur // 2)
        n_rm.image = simpan_gambar(img, os.path.join(tmp, f"{a.nama}_rm.jpg"), "JPEG", a.kualitas_jpeg)
        n_rm.image.colorspace_settings.name = "Non-Color"

    # material: buram, tanpa volume
    for atr, nilai in (("blend_method", "OPAQUE"), ("surface_render_method", "DITHERED")):
        try:
            setattr(mat, atr, nilai)
        except Exception:
            pass
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for nama_soket in ("Alpha",):
        s = bsdf.inputs[nama_soket]
        for l in list(s.links):
            mat.node_tree.links.remove(l)
        s.default_value = 1.0
    keluaran = next(n for n in mat.node_tree.nodes if n.type == "OUTPUT_MATERIAL")
    for l in list(keluaran.inputs["Volume"].links):
        mat.node_tree.links.remove(l)

    # 6. ekspor
    pilih_hanya(rendah)
    bpy.ops.export_scene.gltf(
        filepath=keluar,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True,
        export_tangents=False,
        export_animations=False,
        export_skins=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    catat("=== RINGKASAN ===")
    catat(f"segitiga: {segitiga_awal} -> {segitiga_akhir}")
    catat(f"berkas: {ukuran_mb(masuk):.2f} MB -> {ukuran_mb(keluar):.2f} MB ({keluar})")
    for n, label in ((n_base, "base color"), (n_rm, "metallic-roughness"), (n_normal, "normal")):
        if n and n.image:
            catat(f"tekstur {label}: {n.image.size[0]}x{n.image.size[1]} {os.path.basename(n.image.filepath)} "
                  f"{ukuran_mb(n.image.filepath):.2f} MB")
    if lama_bake is not None:
        catat(f"bake normal: {lama_bake:.1f} s")

    # 7. pratinjau sesudah
    if a.pratinjau:
        pusat = Vector(((co[:, 0].max() + co[:, 0].min()) / 2, (co[:, 1].max() + co[:, 1].min()) / 2,
                        (co[:, 2].max() + co[:, 2].min()) / 2))
        kam.data.ortho_scale = a.tinggi * 1.15 * 1.5
        render_sudut(kam, pusat, a.tinggi, os.path.join(akar, a.pratinjau), f"{a.nama}-sesudah")


main()
