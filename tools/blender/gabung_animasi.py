"""
Gabungkan model Wijaya terbaru dengan kerangka dan animasi Mixamo menjadi satu GLB beranimasi (Tahap D).

  blender -b -P tools/blender/gabung_animasi.py -- --model public/models/wijaya.glb \
      --mixamo aset-mentah/mixamo --json tools/blender/wajah.json --keluar public/models/wijaya.glb

Langkah:
  1. impor idle.fbx (kerangka + mesh berkulit lama): kerangka dipakai, bobotnya dipindah ke mesh baru
     (nearest vertex); mesh lama dibuang. Kepala baru (z di atas kepala_z_m) diikat ke tulang Head.
  2. bobot kain di bawah ikat pinggang: 70 persen Hips, sisanya bobot paha yang ada (dari warna base color).
  3. tiap FBX animasi: ambil aksinya saja (mesh With Skin diabaikan), buang gerak root Hips XZ, potong
     klip serangan di sekitar bingkai kontak (laju tangan kanan tertinggi), buat jongkok-diam dari
     jongkok-jalan (pose kedua kaki menapak + napas), siaga dan serang-berat dipotong dari tarung.
  4. ekspor GLB Draco dengan semua aksi sebagai animasi bernama. Ringkasan ke wajah.json "animasi".
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

PRE = "mixamorig:"


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--mixamo", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    return p.parse_args(argv)


def catat(*a):
    print("[animasi]", *a, flush=True)


def pilih_hanya(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def fcurves(act):
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                out.extend(cb.fcurves)
    return out


def hapus_fcurve(act, fc):
    if hasattr(act, "fcurves"):
        act.fcurves.remove(fc)
        return
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                if fc in list(cb.fcurves):
                    cb.fcurves.remove(fc)
                    return


def impor_fbx(path):
    sebelum = set(bpy.data.objects)
    aksi_sebelum = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    baru = [o for o in bpy.data.objects if o not in sebelum]
    aksi = [a for a in bpy.data.actions if a not in aksi_sebelum]
    arm = [o for o in baru if o.type == "ARMATURE"]
    mesh = [o for o in baru if o.type == "MESH"]
    return arm[0] if arm else None, mesh, aksi[0] if aksi else None, baru


def buang_root(act, sumbu=(0, 1)):
    """Buang gerak Hips pada sumbu lokal tulang yang diberi (0 = x, 1 = y, 2 = z); di Mixamo, maju
    mundur dan samping ada di dua sumbu ini, tinggi di sumbu ketiga."""
    for fc in fcurves(act):
        if fc.data_path == f'pose.bones["{PRE}Hips"].location' and fc.array_index in sumbu:
            nilai0 = fc.evaluate(fc.range()[0])
            for kp in fc.keyframe_points:
                kp.co.y = nilai0
                kp.handle_left.y = nilai0
                kp.handle_right.y = nilai0


def potong(act, f0, f1):
    """Sisakan bingkai f0..f1, geser ke mulai 1."""
    for fc in fcurves(act):
        for i in range(len(fc.keyframe_points) - 1, -1, -1):
            kp = fc.keyframe_points[i]
            if kp.co.x < f0 - 0.001 or kp.co.x > f1 + 0.001:
                fc.keyframe_points.remove(kp, fast=True)
        for kp in fc.keyframe_points:
            kp.co.x -= f0 - 1
            kp.handle_left.x -= f0 - 1
            kp.handle_right.x -= f0 - 1
        fc.update()
    act.frame_range = (1, f1 - f0 + 1)
    act.use_frame_range = True


def laju_tangan(arm, act, tulang=PRE + "RightHand"):
    """Laju tangan per bingkai (m/bingkai) sambil aksi dipasang ke kerangka."""
    arm.animation_data.action = act
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    pos = []
    pb = arm.pose.bones[tulang]
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        pos.append((arm.matrix_world @ pb.head).copy())
    laju = [0.0] + [(pos[i] - pos[i - 1]).length for i in range(1, len(pos))]
    return f0, f1, laju


def pose_kaki(arm, act):
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    arm.animation_data.action = act
    hips, lf, rf = arm.pose.bones[PRE + "Hips"], arm.pose.bones[PRE + "LeftFoot"], arm.pose.bones[PRE + "RightFoot"]
    data = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        h = (arm.matrix_world @ hips.head).z
        l, r = arm.matrix_world @ lf.head, arm.matrix_world @ rf.head
        data.append((f, h, (l - r).length, min(l.z, r.z), max(l.z, r.z)))
    return data


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    A = data.setdefault("animasi", {})
    A.setdefault("kepala_z_m", 1.50)
    A.setdefault("kain_hips", 0.7)
    A.setdefault("kain_z_maks_m", 1.05)
    A.setdefault("kain_z_min_m", 0.5)
    A.setdefault("serang_sebelum", 8)
    A.setdefault("serang_sesudah", 10)
    A.setdefault("berat_sebelum", 12)
    A.setdefault("berat_sesudah", 11)
    A.setdefault("jongkok_diam_detik", 3.0)
    A.setdefault("siaga_detik", 2.0)
    folder = os.path.join(akar, a.mixamo)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30

    # 1. Kerangka dan mesh berkulit lama dari idle.fbx.
    arm, mesh_lama_list, act_idle, _ = impor_fbx(os.path.join(folder, "idle.fbx"))
    arm.name = "Kerangka"
    mesh_lama = mesh_lama_list[0]
    pilih_hanya(arm)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    pilih_hanya(mesh_lama)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    catat(f"kerangka {len(arm.data.bones)} tulang; mesh lama {len(mesh_lama.data.vertices)} verteks, {len(mesh_lama.vertex_groups)} grup")

    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.model))
    model = [o for o in bpy.data.objects if o.type == "MESH" and o is not mesh_lama][0]
    model.name = "wijaya"
    pilih_hanya(model)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # periksa kecocokan posisi: jarak rata-rata verteks badan baru ke verteks lama terdekat
    from mathutils.kdtree import KDTree
    kd = KDTree(len(mesh_lama.data.vertices))
    for i, v in enumerate(mesh_lama.data.vertices):
        kd.insert(mesh_lama.matrix_world @ v.co, i)
    kd.balance()
    jar = [kd.find(model.matrix_world @ v.co)[2] for v in model.data.vertices if (model.matrix_world @ v.co).z < 1.4]
    catat(f"jarak badan baru ke mesh berkulit lama: rata {np.mean(jar) * 1000:.1f} mm, maks {np.max(jar) * 1000:.1f} mm")

    # Bobot: Data Transfer nearest vertex dari mesh lama.
    for vg in mesh_lama.vertex_groups:
        model.vertex_groups.new(name=vg.name)
    dt = model.modifiers.new("Bobot", "DATA_TRANSFER")
    dt.object = mesh_lama
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    pilih_hanya(model)
    bpy.ops.object.modifier_apply(modifier="Bobot")

    # Kepala baru: di atas kepala_z_m seluruhnya Head. Di pita leher, bobot hasil transfer dipertahankan.
    vg_head = model.vertex_groups[PRE + "Head"]
    co = np.array([model.matrix_world @ v.co for v in model.data.vertices])
    idx_kepala = [i for i in range(len(co)) if co[i, 2] > A["kepala_z_m"]]
    for vg in model.vertex_groups:
        vg.remove(idx_kepala)
    vg_head.add(idx_kepala, 1.0, "REPLACE")
    catat(f"kepala: {len(idx_kepala)} verteks diikat ke Head")

    # 2. Kain: dari warna base color di UV verteks (gelap/cokelat atau merah = kain).
    mat = model.data.materials[0]
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    img = bsdf.inputs["Base Color"].links[0].from_node.image
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4)
    uv = model.data.uv_layers.active.data
    uv_v = np.zeros((len(co), 2))
    for p in model.data.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            uv_v[vi] = uv[li].uv
    kain = []
    vg_hips = model.vertex_groups[PRE + "Hips"]
    for i in range(len(co)):
        z = co[i, 2]
        if not (A["kain_z_min_m"] < z < A["kain_z_maks_m"]):
            continue
        u, vv = uv_v[i]
        c = px[int(vv * h) % h, int(u * w) % w, :3]
        r, g, b = c
        v = max(c)
        s = 0 if v == 0 else (v - min(c)) / v
        merah = r > 0.3 and r > g * 1.8 and r > b * 1.8
        gelap = v < 0.42 and not (r > 0.45 and g > 0.25)
        if merah or gelap:
            kain.append(i)
    # bobot: Hips = kain_hips, grup lain dikalikan (1 - kain_hips)
    for i in kain:
        v = model.data.vertices[i]
        total = sum(g.weight for g in v.groups) or 1.0
        for g in v.groups:
            model.vertex_groups[g.group].add([i], g.weight / total * (1 - A["kain_hips"]), "REPLACE")
        hips_w = next((g.weight / total * (1 - A["kain_hips"]) for g in v.groups if g.group == vg_hips.index), 0.0)
        vg_hips.add([i], hips_w + A["kain_hips"], "REPLACE")
    catat(f"kain: {len(kain)} verteks, Hips {A['kain_hips']}")

    # Normalisasi dan pasang armature.
    pilih_hanya(model)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    mod = model.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    model.parent = arm
    bpy.data.objects.remove(mesh_lama, do_unlink=True)

    # 3. Aksi.
    aksi = {}
    if arm.animation_data is None:
        arm.animation_data_create()

    def ambil(nama_berkas, nama_aksi):
        path = os.path.join(folder, nama_berkas)
        if not os.path.exists(path):
            catat(f"TIDAK ADA: {nama_berkas}")
            return None
        arm2, mesh2, act, baru = impor_fbx(path)
        for o in baru:
            bpy.data.objects.remove(o, do_unlink=True)
        act.name = nama_aksi
        act.use_fake_user = True
        aksi[nama_aksi] = act
        return act

    def pasang(act):
        arm.animation_data.action = act
        try:
            arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass

    ringkasan = {}
    act_idle.name = "idle"
    act_idle.use_fake_user = True
    aksi["idle"] = act_idle
    pasang(act_idle)
    buang_root(act_idle)
    for nama in ("jalan", "lari", "jongkok-jalan", "tangkis", "hindar", "terkena", "mati", "tarung", "serang-1", "serang-2", "serang-3"):
        ambil(nama + ".fbx", nama)
    # jongkok-diam asli hanya dibandingkan, tidak dipakai kalau menyimpang
    act_jd = ambil("jongkok-diam.fbx", "jongkok-diam-asli")

    for nama in ("jalan", "lari", "jongkok-jalan", "hindar", "terkena", "serang-1", "serang-2", "serang-3", "tarung", "tangkis"):
        if nama in aksi:
            pasang(aksi[nama])
            buang_root(aksi[nama])

    # jongkok-diam: bandingkan
    if act_jd and "jongkok-jalan" in aksi:
        pasang(act_jd)
        d_jd = pose_kaki(arm, act_jd)
        pasang(aksi["jongkok-jalan"])
        d_jj = pose_kaki(arm, aksi["jongkok-jalan"])
        h_jd, h_jj = np.mean([d[1] for d in d_jd]), np.mean([d[1] for d in d_jj])
        k_jd, k_jj = np.mean([d[2] for d in d_jd]), np.mean([d[2] for d in d_jj])
        pakai_asli = abs(h_jd - h_jj) <= 0.10 and k_jd <= k_jj * 1.5
        ringkasan["jongkok_diam"] = {"pinggul_asli": round(float(h_jd), 3), "pinggul_jalan": round(float(h_jj), 3),
                                     "kaki_asli": round(float(k_jd), 3), "kaki_jalan": round(float(k_jj), 3), "pakai_asli": bool(pakai_asli)}
        catat(f"jongkok-diam: pinggul {h_jd:.3f} vs jalan {h_jj:.3f}, jarak kaki {k_jd:.3f} vs {k_jj:.3f} -> {'pakai asli' if pakai_asli else 'dibuat dari jongkok-jalan'}")
        if pakai_asli:
            act_jd.name = "jongkok-diam"
            aksi["jongkok-diam"] = act_jd
        else:
            # bingkai kedua kaki paling rata menapak (selisih tinggi kaki terkecil)
            f_best = min(d_jj, key=lambda d: d[4] - d[3])[0]
            arm.animation_data.action = None
            act_new = bpy.data.actions.new("jongkok-diam")
            act_new.use_fake_user = True
            pasang(aksi["jongkok-jalan"])
            scene.frame_set(f_best)
            # rekam pose ke aksi baru: bingkai 1 dan akhir sama, tengah sedikit napas (dada naik)
            pose = {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in arm.pose.bones}
            arm.animation_data.action = None
            pasang(act_new)
            n = int(A["jongkok_diam_detik"] * 30)
            for f in (1, n // 2, n):
                scene.frame_set(f)
                for pb in arm.pose.bones:
                    loc, rot = pose[pb.name]
                    pb.location = loc
                    pb.rotation_quaternion = rot
                    pb.keyframe_insert("location", frame=f)
                    pb.keyframe_insert("rotation_quaternion", frame=f)
                # napas: Hips naik 1 cm di tengah
                if f == n // 2:
                    hips = arm.pose.bones[PRE + "Hips"]
                    hips.location = pose[hips.name][0] + Vector((0, 0.01, 0))
                    hips.keyframe_insert("location", frame=f)
            act_new.frame_range = (1, n)
            act_new.use_frame_range = True
            aksi["jongkok-diam"] = act_new
        aksi.pop("jongkok-diam-asli", None)
        if act_jd.name == "jongkok-diam-asli":
            arm.animation_data.action = None
            bpy.data.actions.remove(act_jd)

    # serangan: potong di sekitar kontak
    for nama, sb, ss in (("serang-1", A["serang_sebelum"], A["serang_sesudah"]), ("serang-2", A["serang_sebelum"], A["serang_sesudah"]),
                         ("serang-3", A["serang_sebelum"], A["serang_sesudah"])):
        if nama not in aksi:
            continue
        act = aksi[nama]
        f0, f1, laju = laju_tangan(arm, act)
        fc = f0 + int(np.argmax(laju))
        a0, a1 = max(f0, fc - sb), min(f1, fc + ss)
        potong(act, a0, a1)
        ringkasan[nama] = {"kontak_asli": fc, "dipotong": [a0, a1], "bingkai": a1 - a0 + 1, "kontak_baru": fc - a0 + 1}
        catat(f"{nama}: kontak bingkai {fc}, dipotong {a0}-{a1} ({a1 - a0 + 1} bingkai), kontak di bingkai {fc - a0 + 1}")

    # tarung: siaga (jendela laju tangan terendah, siaga_detik) dan serang-berat (jendela laju tertinggi)
    if "tarung" in aksi:
        act = aksi["tarung"]
        f0, f1, laju = laju_tangan(arm, act)
        laju = np.array(laju)
        n_s = int(A["siaga_detik"] * 30)
        jumlah = np.convolve(laju, np.ones(n_s), "valid")
        i_s = int(np.argmin(jumlah))
        n_b = A["berat_sebelum"] + A["berat_sesudah"] + 1
        fc = f0 + int(np.argmax(laju))
        b0, b1 = max(f0, fc - A["berat_sebelum"]), min(f1, fc + A["berat_sesudah"])
        for nama, (x0, x1) in (("siaga", (f0 + i_s, f0 + i_s + n_s - 1)), ("serang-berat", (b0, b1))):
            if not os.path.exists(os.path.join(folder, nama + ".fbx")):
                salin = act.copy()
                salin.name = nama
                salin.use_fake_user = True
                potong(salin, x0, x1)
                aksi[nama] = salin
                ringkasan[nama] = {"dari_tarung": [x0, x1], "bingkai": x1 - x0 + 1}
                catat(f"{nama} dari tarung bingkai {x0}-{x1}")
        if "serang-berat" in ringkasan:
            ringkasan["serang-berat"]["kontak_baru"] = fc - b0 + 1
        del aksi["tarung"]
        arm.animation_data.action = None
        bpy.data.actions.remove(act)

    # 4. NLA: tiap aksi satu track, lalu ekspor.
    arm.animation_data.action = None
    for nama, act in aksi.items():
        tr = arm.animation_data.nla_tracks.new()
        tr.name = nama
        st = tr.strips.new(nama, 1, act)
        st.name = nama
    pilih_hanya(arm)
    model.select_set(True)
    keluar = os.path.join(akar, a.keluar)
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True, export_tangents=False, export_animations=True, export_animation_mode="ACTIONS",
        export_nla_strips=True, export_frame_range=True, export_force_sampling=True, export_optimize_animation_size=True,
        export_skins=True, export_all_influences=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    ringkasan["aksi"] = {n: int(act.frame_range[1] - act.frame_range[0] + 1) for n, act in aksi.items()}
    ringkasan["berkas_mb"] = round(os.path.getsize(keluar) / 1e6, 2)
    A["hasil"] = ringkasan
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {keluar}: {os.path.getsize(keluar) / 1e6:.2f} MB; aksi: {ringkasan['aksi']}")


main()
