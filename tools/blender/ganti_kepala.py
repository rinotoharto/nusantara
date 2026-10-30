"""
Ganti kepala model Wijaya dengan kepala Tripo baru (Blender). Langkah:
  1. impor badan (GLB game) dan kepala baru; skala kepala dari jarak mata, posisi dari dagu konsep
     dan pusat leher badan (wajah.json "kepala" dan "acuan")
  2. salinan kepala tinggi disimpan sebagai sumber bake; kepala kerja di-remesh voxel (serabut rambut
     menyatu jadi permukaan), dipotong di z_potong, bagian lepas kecil dibuang, decimate, Smart UV baru
  3. badan dipotong, digabung, lingkar leher dijembatani, jahitan dihaluskan; muka jembatan dapat UV
  4. UV: salin ke "UVBaru", pack ulang tanpa rotasi. Bake A: base color dan normal badan dari UV lama.
     Bake B: base color dan normal kepala (plus jembatan) dari mesh tinggi (selected to active).
     Bake C: data (R indeks bahan 0 badan 1 kepala, G tinggi). Penggabungan A/B lewat C dan koreksi
     warna kulit dilakukan kulit_warna.py (venv), lalu tekstur_pasang.py memasangnya ke GLB.
  5. ekspor GLB Draco dengan tekstur bake A sebagai pengisi sementara

  blender -b -P tools/blender/ganti_kepala.py -- --badan public/models/wijaya.glb \
      --kepala aset-mentah/kepala-tripo.glb --json tools/blender/wajah.json \
      --tekstur aset-mentah/tekstur --keluar public/models/wijaya.glb
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


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--badan", required=True)
    p.add_argument("--kepala", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--tekstur", required=True, help="folder keluaran bake")
    p.add_argument("--keluar", required=True)
    p.add_argument("--ukuran", type=int, default=2048)
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    return p.parse_args(argv)


def catat(*a):
    print("[kepala]", *a, flush=True)


def pilih_hanya(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def mesh_obj(nama=None):
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    return objs if nama is None else [o for o in objs if o.name == nama][0]


def koordinat(o):
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    M = np.array(o.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3]


def potong_bidang(o, z, buang_atas, pusat_xy=None, radius=None):
    """Potong mesh pada bidang z; buang sisi atas (badan) atau bawah (kepala). Lingkar potongan jadi tepi.
    Dengan pusat_xy dan radius, hanya geometri di dalam silinder itu yang dipotong (bahu tidak ikut)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    if radius is None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    else:
        M = o.matrix_world
        def dalam(v):
            w = M @ v.co
            return math.hypot(w.x - pusat_xy[0], w.y - pusat_xy[1]) < radius
        verts = [v for v in bm.verts if dalam(v)]
        vs = set(verts)
        edges = [e for e in bm.edges if all(v in vs for v in e.verts)]
        faces = [f for f in bm.faces if all(v in vs for v in f.verts)]
        geom = verts + edges + faces
    Mi = o.matrix_world.inverted()
    titik = Mi @ Vector((0, 0, z))
    normal = (Mi.to_3x3() @ Vector((0, 0, 1))).normalized()
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=titik, plane_no=normal,
                           clear_outer=buang_atas, clear_inner=not buang_atas)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def jumlah_segitiga(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def bake_emit(obj, img, margin, clear=True):
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.name = "bake_target"
        for n in nt.nodes:
            n.select = False
        node.select = True
        nt.nodes.active = node
    pilih_hanya(obj)
    scene = bpy.context.scene
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = clear
    bpy.ops.object.bake(type="EMIT")
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        nt.nodes.remove(nt.nodes["bake_target"])


def simpan_png(img, path, non_color=False, depth16=False):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "16" if depth16 else "8"
    if depth16:
        img.save_render(path, scene=scene)
    else:
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()


def material_emisi(mat, img_sumber, uv_sumber, mode):
    """Ubah material jadi emisi dari gambar sumber lewat UV sumber: mode 'warna' (sRGB) / 'normal' (data)
    / 'data' (indeks bahan dan tinggi, tanpa gambar)."""
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    if mode in ("warna", "normal"):
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = uv_sumber
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img_sumber
        tex.image.colorspace_settings.name = "sRGB" if mode == "warna" else "Non-Color"
        tex.interpolation = "Cubic"
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
    return emisi


def gambar_dari_material(mat, jenis):
    """Ambil gambar base color / normal dari material Principled hasil impor glTF."""
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


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    K = data.setdefault("kepala", {})
    K.setdefault("z_potong_m", 1.44)
    K.setdefault("dagu_z_m", None)          # diisi dari acuan model kalau None
    K.setdefault("jarak_mata_m", None)
    K.setdefault("segitiga_kepala", 3000)
    K.setdefault("serabut_muka_min", 200)   # bagian lepas dengan muka lebih sedikit dari ini dibuang
    K.setdefault("voxel_m", 0.004)           # ukuran voxel remesh kepala (serabut lebih tipis dari ini hilang)
    K.setdefault("smart_uv_sudut", 66.0)
    K.setdefault("halus_rambut_iterasi", 12)  # Smooth pada daerah rambut (di atas mata atau di belakang telinga)
    K.setdefault("halus_rambut_faktor", 0.5)
    K.setdefault("bake_cage_m", 0.008)
    K.setdefault("bake_sinar_m", 0.06)
    K.setdefault("halus_jahitan_iterasi", 8)
    K.setdefault("pack_margin", 0.004)
    K.setdefault("leher_radius_m", 0.13)     # potongan badan dan pencarian lingkar leher dibatasi silinder ini
    K.setdefault("kepala_skala_uv", 1.8)     # bonus kepadatan texel kepala setelah disetarakan
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-kepala")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(os.path.join(akar, a.tekstur), exist_ok=True)

    # Sasaran dari penyelarasan konsep (Tahap 1): koordinat piksel bingkai 1024 -> meter.
    kam = data["kamera"]
    def px_ke_m(uv):
        n, o, c = kam["ukuran_px"], kam["ortho_scale_m"], kam["pusat_m"]
        return c[0] + (uv[0] / n - 0.5) * o, c[2] - (uv[1] / n - 0.5) * o
    am = data["acuan"]["model"]
    mk, mkn, dg = px_ke_m(am["mata_kiri"]), px_ke_m(am["mata_kanan"]), px_ke_m(am["dagu"])
    jarak_mata_sasaran = K["jarak_mata_m"] or float(np.hypot(mkn[0] - mk[0], mkn[1] - mk[1]))
    dagu_sasaran = K["dagu_z_m"] or dg[1]
    K["jarak_mata_m"], K["dagu_z_m"] = round(jarak_mata_sasaran, 4), round(dagu_sasaran, 4)
    catat(f"sasaran: jarak mata {jarak_mata_sasaran:.4f} m, dagu z {dagu_sasaran:.4f} m")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.badan))
    badan = mesh_obj()[0]
    badan.name = "badan"
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.kepala))
    kepala = [o for o in mesh_obj() if o is not badan][0]
    kepala.name = "kepala"
    for o in (badan, kepala):
        pilih_hanya(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    catat(f"badan {jumlah_segitiga(badan)} segitiga, kepala {jumlah_segitiga(kepala)} segitiga")

    # 1. Skala dan posisi kepala.
    ac = K["acuan"]
    skala = jarak_mata_sasaran / K["jarak_mata"]
    kepala.scale = (skala, skala, skala)
    pilih_hanya(kepala)
    bpy.ops.object.transform_apply(scale=True)
    co_k = koordinat(kepala)
    dz = dagu_sasaran - ac["dagu"][1] * skala
    kepala.location.z += dz
    bpy.ops.object.transform_apply(location=True)
    # Pusat leher: lingkar badan dan kepala pada z_potong disamakan (x dan y).
    zp = K["z_potong_m"]
    co_b = koordinat(badan)
    co_k = koordinat(kepala)
    cincin_b = co_b[np.abs(co_b[:, 2] - zp) < 0.01]
    cincin_k = co_k[np.abs(co_k[:, 2] - zp) < 0.01]
    pb = (cincin_b.min(0) + cincin_b.max(0)) / 2
    pk = (cincin_k.min(0) + cincin_k.max(0)) / 2
    kepala.location.x += pb[0] - pk[0]
    kepala.location.y += pb[1] - pk[1]
    bpy.ops.object.transform_apply(location=True)
    lebar_b, lebar_k = cincin_b[:, 0].ptp() if hasattr(cincin_b[:, 0], "ptp") else np.ptp(cincin_b[:, 0]), np.ptp(cincin_k[:, 0])
    catat(f"skala kepala {skala:.4f}; leher badan lebar {lebar_b:.3f} m, leher kepala {lebar_k:.3f} m di z {zp}; "
          f"puncak kepala z {koordinat(kepala)[:, 2].max():.3f}")
    K["hasil"] = {"skala": round(float(skala), 4), "leher_badan_m": round(float(lebar_b), 3), "leher_kepala_m": round(float(lebar_k), 3)}

    # 2. Kepala tinggi disimpan utuh sebagai sumber bake; kepala kerja di-remesh voxel supaya serabut
    # rambut menyatu jadi permukaan, lalu dipotong, dibersihkan, dan di-decimate.
    pilih_hanya(kepala)
    bpy.ops.object.duplicate()
    tinggi = bpy.context.view_layer.objects.active
    tinggi.name = "kepala_tinggi"
    pilih_hanya(kepala)
    kepala.data.remesh_voxel_size = K["voxel_m"]
    kepala.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    catat(f"remesh voxel {K['voxel_m']} m: kepala {jumlah_segitiga(kepala)} segitiga")
    # Kepala lama: semua muka yang seluruhnya di atas kepala_lama_z_m dibuang (telinga, rambut di luar
    # silinder leher), lalu leher dipotong rapi di bidang zp hanya di dalam silinder (bahu tidak terpotong).
    K.setdefault("kepala_lama_z_m", 1.50)
    bm = bmesh.new()
    bm.from_mesh(badan.data)
    hapus = [f for f in bm.faces if min(v.co.z for v in f.verts) > K["kepala_lama_z_m"]]
    bmesh.ops.delete(bm, geom=hapus, context="FACES")
    bm.to_mesh(badan.data)
    bm.free()
    badan.data.update()
    potong_bidang(badan, zp, buang_atas=True, pusat_xy=(float(pb[0]), float(pb[1])), radius=K["leher_radius_m"])
    potong_bidang(kepala, zp, buang_atas=False)
    co_b2 = koordinat(badan)
    catat(f"badan setelah potong: z maks {co_b2[:, 2].max():.3f} (bahu tetap), verteks di atas {zp}: {(co_b2[:, 2] > zp + 1e-4).sum()}")
    catat(f"setelah potong: badan {jumlah_segitiga(badan)}, kepala {jumlah_segitiga(kepala)} segitiga")

    # Bagian lepas kecil (sisa serabut yang selamat dari remesh) dibuang.
    pilih_hanya(kepala)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    bagian = [o for o in mesh_obj() if o.name.startswith("kepala") and o is not tinggi]
    bagian.sort(key=lambda o: len(o.data.polygons), reverse=True)
    utama = bagian[0]
    dibuang = 0
    for o in bagian[1:]:
        if len(o.data.polygons) < K["serabut_muka_min"]:
            bpy.data.objects.remove(o, do_unlink=True)
            dibuang += 1
    sisa = [o for o in mesh_obj() if o.name.startswith("kepala") and o is not tinggi]
    pilih_hanya(utama)
    for o in sisa:
        o.select_set(True)
    bpy.ops.object.join()
    kepala = bpy.context.view_layer.objects.active
    kepala.name = "kepala"
    catat(f"bagian lepas dibuang: {dibuang}; kepala {jumlah_segitiga(kepala)} segitiga, {len(sisa)} bagian disatukan")

    # Rambut dihaluskan: verteks di atas garis mata atau di belakang pusat kepala (bukan wajah).
    if K["halus_rambut_iterasi"] > 0:
        z_mata = (ac["mata_kiri"][1] + ac["mata_kanan"][1]) / 2 * skala + dz + 0.03
        co_k2 = koordinat(kepala)
        y_tengah = (co_k2[:, 1].min() + co_k2[:, 1].max()) / 2
        bm = bmesh.new()
        bm.from_mesh(kepala.data)
        M = kepala.matrix_world
        rambut = [v for v in bm.verts if (M @ v.co).z > z_mata or (M @ v.co).y > y_tengah]
        for _ in range(K["halus_rambut_iterasi"]):
            bmesh.ops.smooth_vert(bm, verts=rambut, factor=K["halus_rambut_faktor"], use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bm.to_mesh(kepala.data)
        bm.free()
        kepala.data.update()
        catat(f"rambut dihaluskan: {len(rambut)} verteks di atas z {z_mata:.3f} atau y > {y_tengah:.3f}")

    # Decimate kepala, lalu UV baru dengan Smart UV Project (UV Tripo tidak dipakai).
    dec = kepala.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = K["segitiga_kepala"] / jumlah_segitiga(kepala)
    dec.use_collapse_triangulate = True
    pilih_hanya(kepala)
    bpy.ops.object.modifier_apply(modifier="Decimate")
    if not kepala.data.uv_layers:
        kepala.data.uv_layers.new(name="UVMap")
    kepala.data.uv_layers[0].name = "UVMap"
    kepala.data.materials.clear()
    kepala.data.materials.append(bpy.data.materials.new("kepala_baru"))
    kepala.data.materials[0].use_nodes = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(K["smart_uv_sudut"]), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    catat(f"kepala setelah decimate: {jumlah_segitiga(kepala)} segitiga, UV Smart Project")

    # 3. Gabung dan jembatani lingkar leher.
    nama_mat_kepala = kepala.data.materials[0].name
    nama_mat_badan = badan.data.materials[0].name
    pilih_hanya(badan)
    kepala.select_set(True)
    bpy.ops.object.join()
    model = bpy.context.view_layer.objects.active
    model.name = "wijaya"
    bm = bmesh.new()
    bm.from_mesh(model.data)
    tepi = [e for e in bm.edges if e.is_boundary]
    # hanya tepi di sekitar z_potong (lubang lain, mis. mata/mulut, dibiarkan)
    tepi = [e for e in tepi if all(abs(v.co.z - zp) < 0.02 and math.hypot(v.co.x - pb[0], v.co.y - pb[1]) < K["leher_radius_m"] for v in e.verts)]
    catat(f"tepi lingkar leher: {len(tepi)}")
    hasil = bmesh.ops.bridge_loops(bm, edges=tepi, use_pairs=False, use_cyclic=False, use_merge=False)
    muka_jembatan = hasil.get("faces", [])
    idx_kepala = [i for i, m in enumerate(model.data.materials) if m.name == nama_mat_kepala][0]
    for f in muka_jembatan:
        f.material_index = idx_kepala   # di-bake dari leher mesh tinggi bersama kepala
        f.smooth = True
        f.select = True
    # haluskan jahitan: verteks dekat bidang potong
    verts_jahit = [v for v in bm.verts if abs(v.co.z - zp) < 0.025]
    bmesh.ops.smooth_vert(bm, verts=verts_jahit, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for _ in range(K["halus_jahitan_iterasi"] - 1):
        bmesh.ops.smooth_vert(bm, verts=verts_jahit, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for f in bm.faces:
        if f not in muka_jembatan:
            f.select = False
    bmesh.ops.triangulate(bm, faces=muka_jembatan)
    bm.to_mesh(model.data)
    bm.free()
    model.data.update()
    # UV muka jembatan: Smart UV Project hanya pada muka terpilih (jembatan).
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(K["smart_uv_sudut"]), island_margin=0.01)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    catat(f"model gabungan: {jumlah_segitiga(model)} segitiga, jembatan {len(muka_jembatan)} muka")

    # 4. UV baru: salin lalu pack tanpa rotasi.
    uv_lama = model.data.uv_layers.active.name
    uv_baru = model.data.uv_layers.new(name="UVBaru", do_init=True)
    model.data.uv_layers.active_index = model.data.uv_layers.find("UVBaru")
    pilih_hanya(model)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")
    # bonus kepadatan kepala: skala UV muka kepala (dan jembatan) sebelum pack
    bm = bmesh.new()
    bm.from_mesh(model.data)
    lay = bm.loops.layers.uv["UVBaru"]
    f_uv = K["kepala_skala_uv"]
    for f in bm.faces:
        if f.material_index == idx_kepala:
            for l in f.loops:
                l[lay].uv = l[lay].uv * f_uv
    bm.to_mesh(model.data)
    bm.free()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=False, margin=K["pack_margin"])
    bpy.ops.object.mode_set(mode="OBJECT")
    model.data.uv_layers["UVBaru"].active_render = True
    catat("UV dipack ulang")

    # Bake A: badan dari UV lama (emisi). Material kepala ikut (isinya tidak dipakai, ditimpa bake B).
    mat_badan = bpy.data.materials[nama_mat_badan]
    mat_kepala = bpy.data.materials[nama_mat_kepala]
    mat_tinggi = tinggi.data.materials[0]
    img_bc_badan, img_n_badan = gambar_dari_material(mat_badan, "warna"), gambar_dari_material(mat_badan, "normal")
    img_bc_tinggi, img_n_tinggi = gambar_dari_material(mat_tinggi, "warna"), gambar_dari_material(mat_tinggi, "normal")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    N = a.ukuran
    tinggi.hide_render = False
    tinggi.hide_viewport = False
    material_emisi(mat_badan, img_bc_badan, uv_lama, "warna")
    material_emisi(mat_kepala, img_bc_badan, uv_lama, "warna")
    img_a_bc = bpy.data.images.new("bake_a_basecolor", N, N, alpha=False)
    img_a_bc.colorspace_settings.name = "sRGB"
    bake_emit(model, img_a_bc, 8)
    path_a_bc = os.path.join(akar, a.tekstur, "kepala-A-basecolor.png")
    simpan_png(img_a_bc, path_a_bc)
    material_emisi(mat_badan, img_n_badan, uv_lama, "normal")
    material_emisi(mat_kepala, img_n_badan, uv_lama, "normal")
    img_a_n = bpy.data.images.new("bake_a_normal", N, N, alpha=False)
    img_a_n.colorspace_settings.name = "Non-Color"
    bake_emit(model, img_a_n, 8)
    path_a_n = os.path.join(akar, a.tekstur, "kepala-A-normal.png")
    simpan_png(img_a_n, path_a_n, non_color=True)
    catat("bake A (badan) selesai")

    # Bake B: kepala dan jembatan dari mesh tinggi (selected to active). Emisi tekstur tinggi untuk warna,
    # normal geometri tinggi (termasuk normal map-nya) untuk normal.
    def bake_dari_tinggi(jenis, img, margin):
        for slot in model.material_slots:
            nt = slot.material.node_tree
            node = nt.nodes.new("ShaderNodeTexImage")
            node.image = img
            node.name = "bake_target"
            for n in nt.nodes:
                n.select = False
            node.select = True
            nt.nodes.active = node
        bpy.ops.object.select_all(action="DESELECT")
        tinggi.select_set(True)
        model.select_set(True)
        bpy.context.view_layer.objects.active = model
        scene.render.bake.use_selected_to_active = True
        scene.render.bake.cage_extrusion = K["bake_cage_m"]
        scene.render.bake.max_ray_distance = K["bake_sinar_m"]
        scene.render.bake.margin = margin
        scene.render.bake.use_clear = True
        scene.render.bake.normal_space = "TANGENT"
        bpy.ops.object.bake(type=jenis)
        scene.render.bake.use_selected_to_active = False
        for slot in model.material_slots:
            nt = slot.material.node_tree
            nt.nodes.remove(nt.nodes["bake_target"])
    uv_tinggi = tinggi.data.uv_layers.active.name
    material_emisi(mat_tinggi, img_bc_tinggi, uv_tinggi, "warna")
    img_b_bc = bpy.data.images.new("bake_b_basecolor", N, N, alpha=False)
    img_b_bc.colorspace_settings.name = "sRGB"
    bake_dari_tinggi("EMIT", img_b_bc, 8)
    path_b_bc = os.path.join(akar, a.tekstur, "kepala-B-basecolor.png")
    simpan_png(img_b_bc, path_b_bc)
    # normal: material tinggi kembali Principled dengan normal map Tripo
    nt = mat_tinggi.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], keluaran.inputs["Surface"])
    if img_n_tinggi is not None:
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = uv_tinggi
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img_n_tinggi
        tex.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    img_b_n = bpy.data.images.new("bake_b_normal", N, N, alpha=False)
    img_b_n.colorspace_settings.name = "Non-Color"
    bake_dari_tinggi("NORMAL", img_b_n, 8)
    path_b_n = os.path.join(akar, a.tekstur, "kepala-B-normal.png")
    simpan_png(img_b_n, path_b_n, non_color=True)
    catat("bake B (kepala dari mesh tinggi) selesai")

    # Bake C: data. R = indeks bahan (0 badan, 1 kepala dan jembatan), G = tinggi absolut pada data_z, B = 1.
    z0, z1 = data.get("data_z", [1.2, 1.8])
    for mat in model.data.materials:
        idx = 1 if mat.name == nama_mat_kepala else 0
        emisi = material_emisi(mat, None, None, "data")
        nt = mat.node_tree
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        pisah = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], pisah.inputs["Vector"])
        zr = nt.nodes.new("ShaderNodeMapRange")
        zr.inputs["From Min"].default_value, zr.inputs["From Max"].default_value = z0, z1
        zr.clamp = True
        nt.links.new(pisah.outputs["Z"], zr.inputs["Value"])
        gab = nt.nodes.new("ShaderNodeCombineColor")
        gab.inputs[0].default_value = float(idx)
        nt.links.new(zr.outputs["Result"], gab.inputs[1])
        gab.inputs[2].default_value = 1.0
        nt.links.new(gab.outputs["Color"], emisi.inputs["Color"])
    img_d = bpy.data.images.new("bake_data", N, N, alpha=False, float_buffer=True)
    img_d.colorspace_settings.name = "Non-Color"
    bake_emit(model, img_d, 0)
    path_d = os.path.join(akar, a.tekstur, "kepala-data.png")
    simpan_png(img_d, path_d, non_color=True, depth16=True)
    bpy.data.objects.remove(tinggi, do_unlink=True)
    path_bc, path_n = path_a_bc, path_a_n
    catat("bake C (data) selesai:", path_d)

    # 5. Material akhir dan ekspor (base color belum dikoreksi; kulit_warna.py + tekstur_pasang.py menyusul).
    model.data.uv_layers.remove(model.data.uv_layers[uv_lama])
    model.data.materials.clear()
    mat = bpy.data.materials.new("karakter")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.0
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = a.kualitas_jpeg
    scene.render.image_settings.color_mode = "RGB"
    for nama, path_png, soket, cs in (("wijaya_basecolor", path_bc, "Base Color", "sRGB"), ("wijaya_normal", path_n, None, "Non-Color")):
        # Gambar bake sudah dilepas buffernya setelah disimpan; muat ulang PNG lalu simpan sebagai JPEG.
        pj = os.path.join(tmp, nama + ".jpg")
        src = bpy.data.images.load(path_png)
        src.colorspace_settings.name = cs
        src.pixels[0]
        src.scale(src.size[0], src.size[1])
        src.file_format = "JPEG"
        src.filepath_raw = pj
        src.save()
        bpy.data.images.remove(src)
        im = bpy.data.images.load(pj)
        im.name = nama
        im.colorspace_settings.name = cs
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = im
        if soket:
            nt.links.new(tex.outputs["Color"], bsdf.inputs[soket])
        else:
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    model.data.materials.append(mat)
    pilih_hanya(model)
    keluar = os.path.join(akar, a.keluar)
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True, export_tangents=False, export_animations=False, export_skins=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    co = koordinat(model)
    K["hasil"].update({"segitiga_model": jumlah_segitiga(model), "tinggi_m": round(float(np.ptp(co[:, 2])), 3),
                       "berkas_mb": round(os.path.getsize(keluar) / 1e6, 2)})
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {keluar}: {os.path.getsize(keluar) / 1e6:.2f} MB, {jumlah_segitiga(model)} segitiga, tinggi {np.ptp(co[:, 2]):.3f} m")


main()
