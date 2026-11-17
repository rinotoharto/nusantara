"""
Gabungkan model diam, kerangka Mixamo, dan animasi Mixamo menjadi satu GLB beranimasi (tahap 5 standar karakter).

Cara per karakter (blok angka sendiri di wajah.json, mis. wijaya_ulang atau prajurit):
  blender -b -P tools/blender/gabung_animasi.py -- --model aset-mentah/wijaya-utuh.glb \
      --rig aset-mentah/mixamo-wijaya-ulang/idle.fbx --mixamo aset-mentah/mixamo \
      --json tools/blender/wajah.json --blok wijaya_ulang --keluar aset-mentah/wijaya-ulang-animasi.glb

  --model   GLB model diam hasil sambung kepala (boleh lebih dari satu mesh, mis. kalung gantung)
  --rig     FBX Mixamo With Skin dari model itu (kerangka, bobot, dan aksi idle); bawaan <mixamo>/idle.fbx
  --mixamo  folder FBX animasi Without Skin (dipakai ulang antarkarakter: nama tulang Mixamo sama)
  --blok    blok karakter di wajah.json; angka di <blok>.animasi, bidang potong leher dari <blok>.tempat,
            zona kain dari <blok>.abu.zona_kain

Langkah (dengan --blok):
  1. kerangka dan bobot Mixamo dari --rig; mesh dan bahan dari --model; bobot dipindah dari verteks terdekat
     (mesh yang sama, jadi persis)
  2. bobot dibatasi per bagian (bobot_per_bagian): kepala penuh ke Head, leher bergradasi di sekitar sambungan,
     kain dan sabuk menurut posisi (Hips kain_hips, sisanya Spine dan UpLeg), lengan hanya rantai lengan, kaki
     hanya rantai kaki, penutup sambungan (bahan berawalan penutup_awalan) mengikuti kulit di bawahnya, mesh
     tambahan (kalung gantung) dari Neck dan Spine2
  3. tiap FBX animasi: ambil aksinya saja, buang gerak root Hips mendatar, potong klip serangan di sekitar bingkai
     kontak, buat jongkok-diam dari jongkok-jalan, siaga dan serang-berat dipotong dari tarung
  4. koreksi rotasi: tetap untuk semua aksi (koreksi_rotasi_derajat, leher) dan per klip (koreksi_klip, mis.
     lengan kiri pada klip Sword And Shield)
  5. ekspor GLB Draco dengan semua aksi sebagai animasi bernama. Ringkasan ke <blok>.animasi.hasil.

Tanpa --blok: cara lama untuk model Wijaya hasil rapikan_leher.py (blok "animasi" dan "leher_rapi" di tingkat
atas wajah.json); tidak dipakai lagi untuk karakter baru.
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

PRE = "mixamorig:"


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--mixamo", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    p.add_argument("--rig", default=None, help="FBX Mixamo With Skin (kerangka dan bobot); bawaan <mixamo>/idle.fbx")
    p.add_argument("--baru", default=None, help="folder klip pengganti (mis. aset-mentah/mixamo/baru); berkas bernama sama di sini didahulukan")
    p.add_argument("--blok", default=None, help="blok karakter di json; tanpa ini: cara lama (Wijaya, leher_rapi)")
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


def halus01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def koordinat_dunia(o):
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    M = np.array(o.matrix_world)
    return co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]


def baca_bobot(obj, nama_tulang):
    """Matriks bobot (verteks x tulang) dari grup verteks yang bernama sama dengan tulang."""
    kolom = {n: j for j, n in enumerate(nama_tulang)}
    peta = {vg.index: kolom[vg.name] for vg in obj.vertex_groups if vg.name in kolom}
    W = np.zeros((len(obj.data.vertices), len(nama_tulang)), dtype=np.float32)
    for v in obj.data.vertices:
        for g in v.groups:
            j = peta.get(g.group)
            if j is not None:
                W[v.index, j] = g.weight
    return W


def tulis_bobot(obj, W, nama_tulang, maks=4, ambang=0.004):
    """Ganti semua grup verteks dengan bobot W: paling banyak `maks` pengaruh per verteks, jumlah 1."""
    for vg in list(obj.vertex_groups):
        obj.vertex_groups.remove(vg)
    grup = [obj.vertex_groups.new(name=n) for n in nama_tulang]
    urut = np.argsort(-W, axis=1)[:, :maks]
    tanpa = 0
    for i in range(len(W)):
        w = W[i, urut[i]].astype(np.float64)
        w[w < ambang] = 0.0
        t = w.sum()
        if t <= 0:
            tanpa += 1
            continue
        for j, wj in zip(urut[i], w / t):
            if wj > 0:
                grup[int(j)].add([i], float(wj), "REPLACE")
    return tanpa


def tetangga_las(obj, co):
    """Tepi pada topologi yang dilas menurut posisi (verteks berimpit di jahitan UV dianggap satu)."""
    _, wid = np.unique(np.round(co / 1e-5).astype(np.int64), axis=0, return_inverse=True)
    wid = wid.ravel()
    e = np.empty(len(obj.data.edges) * 2, dtype=np.int64)
    obj.data.edges.foreach_get("vertices", e)
    e = wid[e.reshape(-1, 2)]
    e = np.unique(np.sort(e[e[:, 0] != e[:, 1]], axis=1), axis=0)
    return wid, e, int(wid.max()) + 1


def haluskan_bobot(W, wid, e, nu, topeng, iterasi, faktor=0.5):
    """Rata-rata bobot dengan tetangga, hanya untuk verteks bertopeng dan hanya lewat tepi di dalam topeng."""
    if iterasi <= 0 or not topeng.any():
        return W
    tu = np.zeros(nu, bool)
    tu[wid[topeng]] = True
    e = e[tu[e[:, 0]] & tu[e[:, 1]]]
    Wu = np.zeros((nu, W.shape[1]), dtype=np.float64)
    hit = np.zeros(nu)
    np.add.at(Wu, wid, W)
    np.add.at(hit, wid, 1)
    Wu /= np.maximum(hit, 1)[:, None]
    for _ in range(iterasi):
        jml = np.zeros_like(Wu)
        cnt = np.zeros(nu)
        np.add.at(jml, e[:, 0], Wu[e[:, 1]])
        np.add.at(jml, e[:, 1], Wu[e[:, 0]])
        np.add.at(cnt, e[:, 0], 1)
        np.add.at(cnt, e[:, 1], 1)
        ada = cnt > 0
        Wu[ada] += faktor * (jml[ada] / cnt[ada][:, None] - Wu[ada])
    out = W.copy()
    out[topeng] = Wu[wid[topeng]]
    return out


def warna_verteks(obj):
    """Warna base color per verteks (rata-rata contoh di UV tiap sudut muka yang memakainya)."""
    me = obj.data
    mat = me.materials[0]
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    img = bsdf.inputs["Base Color"].links[0].from_node.image
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    vi = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", vi)
    c = px[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
    jml = np.zeros((len(me.vertices), 3))
    cnt = np.zeros(len(me.vertices))
    np.add.at(jml, vi, c)
    np.add.at(cnt, vi, 1)
    return jml / np.maximum(cnt, 1)[:, None]


def bobot_per_bagian(arm, rig_meshes, model_meshes, P, A):
    """Bobot Mixamo dipindah ke mesh model, lalu dibatasi per bagian badan. Mengembalikan ringkasan.

    Mixamo menghitung bobot dari jarak ke tulang. Pada pose A tangan menggantung di samping kain, jadi kain
    ikut tulang tangan (serat gelap dari tangan ke kain) dan bobot kain tidak rata (kain pecah pada kuda-kuda
    lebar). Di sini tiap bagian hanya boleh ikut tulang yang masuk akal untuk bagian itu."""
    S, T = P["sambung"], P["tempat"]
    f = S.get("hasil", {}).get("skala_akhir", 1.0)
    G = A.setdefault("bagian", {})
    for k, v in {
        "kain_hips": 0.87, "kain_hips_tepi": 0.45, "kain_pudar_atas_m": 0.04, "kain_tengah_m": 0.10, "kain_halus_iterasi": 8,
        "lutut_gradasi_m": 0.07, "kaki_posisi_di_atas_m": 0.10,
        "leher_bawah_m": 0.015, "leher_atas_m": 0.008, "leher_radius_m": 0.20, "lengan_dari_siku_m": 0.03,
        "penutup_awalan": "emas",
        "mesh_tambahan": {"tulang": ["Neck", "Spine2", "Spine1", "LeftShoulder", "RightShoulder", "Head"], "halus_iterasi": 2},
        "pengaruh_maks": 4,
        "keterangan": "kain_hips: porsi Hips untuk kain dan sabuk setinggi sendi paha ke atas (zona kain dari "
                      "<blok>.abu.zona_kain), sisanya Spine di pinggang dan UpLeg kiri-kanan menurut posisi; porsi Hips turun "
                      "bertahap ke kain_hips_tepi di tepi bawah kain, supaya tepi kain ikut paha (dengan Hips rata 0,87 kain "
                      "kaku dan lutut keluar dari bawahnya dengan kulit tertarik). Kulit paha di bawah kain (dicari dari warna "
                      "dan keterhubungan ke kaki) bukan kain: hanya UpLeg dan Leg, dan porsi Hips kain sudah mencapai "
                      "kain_hips_tepi di tinggi kulit paha teratas supaya paha tidak menembus kain. kain_tengah_m: setengah "
                      "lebar daerah tengah tempat UpLeg kiri dan kanan dicampur (di garis tengah sama rata), supaya kain "
                      "tetap berbentuk sarung. lutut_gradasi_m: setengah panjang gradasi UpLeg ke Leg di sekitar sendi "
                      "lutut. leher_*: gradasi Neck ke Head mulai leher_bawah_m "
                      "di bawah bidang potong badan sampai leher_atas_m di atas bidang potong kepala. "
                      "lengan_dari_siku_m: lengan bawah dan tangan (hanya rantai lengan) mulai sekian sebelum siku. "
                      "penutup_awalan: bahan penutup sambungan di mesh utama mengikuti bobot kulit terdekat. "
                      "mesh_tambahan: mesh lain (kalung gantung) mengikuti kulit terdekat, hanya tulang yang disebut. Dengan Neck dan "
                      "Spine2 saja kalung tenggelam sampai 6 mm saat badan membungkuk, karena kulit di bawahnya juga ikut "
                      "Spine1 dan Shoulder; daftar bawaan memuat semua tulang kulit leher dan dada atas.",
    }.items():
        G.setdefault(k, v)
    nama_tulang = [b.name for b in arm.data.bones]
    ix = {n[len(PRE):]: j for j, n in enumerate(nama_tulang)}
    sendi = {n: np.array(arm.matrix_world @ arm.data.bones[PRE + n].head_local) for n in ix}

    # 1. pindah bobot dari verteks terdekat mesh berkulit yang jumlah verteksnya paling dekat
    Wm = {}
    for m in model_meshes:
        sumber = min(rig_meshes, key=lambda r: abs(len(r.data.vertices) - len(m.data.vertices)))
        co_s, co_m = koordinat_dunia(sumber), koordinat_dunia(m)
        kd = KDTree(len(co_s))
        for i, c in enumerate(co_s):
            kd.insert(c, i)
        kd.balance()
        dekat = [kd.find(c) for c in co_m]
        W_s = baca_bobot(sumber, nama_tulang)
        Wm[m.name] = W_s[[d[1] for d in dekat]]
        jar = np.array([d[2] for d in dekat])
        catat(f"bobot {m.name} dari {sumber.name}: {len(co_m)} verteks, jarak ke verteks sumber rata {jar.mean() * 1000:.2f} mm, maks {jar.max() * 1000:.2f} mm")
    utama = max(model_meshes, key=lambda o: len(o.data.polygons))
    co = koordinat_dunia(utama)
    W = Wm[utama.name].astype(np.float64)
    nv = len(co)
    wid, e, nu = tetangga_las(utama, co)
    lapor = {}

    def batasi(topeng, boleh, cadangan):
        """Bobot verteks bertopeng hanya pada tulang `boleh`; kalau jadi nol, pakai `cadangan` (indeks per verteks)."""
        if not topeng.any():
            return
        kol = np.zeros(W.shape[1], bool)
        kol[[ix[n] for n in boleh if n in ix]] = True
        sub = W[topeng]
        sub[:, ~kol] = 0.0
        kosong = sub.sum(axis=1) < 1e-6
        if kosong.any():
            cad = cadangan[topeng] if isinstance(cadangan, np.ndarray) else np.full(int(topeng.sum()), cadangan)
            sub[np.nonzero(kosong)[0], cad[kosong]] = 1.0
        W[topeng] = sub / sub.sum(axis=1, keepdims=True)

    rantai = lambda sisi, bagian: [sisi + b for b in bagian] + [n for n in ix if n.startswith(sisi + "Hand") and "Hand" in bagian]
    x0 = T["badan"]["x0"] * f
    kiri = co[:, 0] > x0          # sisi kiri tokoh = +X
    ax = np.abs(co[:, 0] - x0)

    # penutup sambungan (bahan berawalan penutup_awalan) dikerjakan terakhir
    mi = np.empty(len(utama.data.polygons), dtype=np.int64)
    utama.data.polygons.foreach_get("material_index", mi)
    penutup = np.zeros(nv, bool)
    idx_bahan = [i for i, m_ in enumerate(utama.data.materials) if m_ and m_.name.startswith(G["penutup_awalan"])]
    if idx_bahan:
        for p_ in utama.data.polygons:
            if p_.material_index in idx_bahan:
                penutup[list(p_.vertices)] = True
    kulit = ~penutup

    # 2a. kepala dan leher: gradasi Neck ke Head di sekitar sambungan
    n = np.array(T["normal"], dtype=float)
    p_b, p_k = np.array(T["bidang_badan_m"]) * f, np.array(T["bidang_kepala_m"]) * f
    d_b = (co - p_b) @ n
    r_ax = np.hypot(co[:, 0] - p_b[0], co[:, 1] - p_b[1])
    h_k = float((p_k - p_b) @ n)
    t = (d_b + G["leher_bawah_m"]) / (h_k + G["leher_atas_m"] + G["leher_bawah_m"])
    s_head = halus01(t) * (r_ax < G["leher_radius_m"])
    leher = kulit & (s_head > 0)
    bawah_leher = kulit & ~leher
    W[bawah_leher, ix["Head"]] = 0.0                 # di bawah gradasi tidak ada pengaruh Head
    W_r = W.copy()
    boleh_leher = ["Neck", "Spine2", "Spine1", "LeftShoulder", "RightShoulder"]
    kol = np.zeros(W.shape[1], bool)
    kol[[ix[b] for b in boleh_leher]] = True
    W_r[:, ~kol] = 0.0
    kosong = W_r.sum(axis=1) < 1e-6
    W_r[kosong, ix["Neck"]] = 1.0
    W_r /= W_r.sum(axis=1, keepdims=True)
    e_head = np.zeros(W.shape[1])
    e_head[ix["Head"]] = 1.0
    W[leher] = (1 - s_head[leher])[:, None] * W_r[leher] + s_head[leher][:, None] * e_head
    kepala = leher & (s_head >= 1.0 - 1e-6)
    lapor["kepala_verteks"] = int(kepala.sum())
    lapor["leher_gradasi_verteks"] = int((leher & ~kepala).sum())

    # 2b. kain dan sabuk menurut posisi
    zk = P.get("abu", {}).get("zona_kain")
    kain = np.zeros(nv, bool)
    kulit_paha = np.zeros(nv, bool)          # kulit kaki yang berada di dalam zona kain (paha di bawah kain)
    if zk:
        z0, z1 = zk["z_m"][0] * f, zk["z_m"][1] * f
        zona = kulit & (co[:, 2] >= z0) & (co[:, 2] <= z1) & (ax <= zk["x_abs_maks_m"] * f)
        z_paha = sendi["LeftUpLeg"][2]
        # Kulit paha di bawah kain: berwarna kulit (lebih dekat ke warna kulit kaki daripada warna kain) dan
        # tersambung lewat tepi mesh ke kulit kaki di bawah zona. Bercak motif kain yang terang tidak tersambung.
        # Calon: di dalam zona, dekat sumbu paha sisinya (jari-jari kaki tepat di bawah zona ditambah kelonggaran)
        # dan tidak lebih dari kaki_naik_maks_m di atas tepi bawah zona; atau berwarna kulit. Lapisan dalam kain
        # yang melebar dari kaki berada lebih jauh dari sumbu.
        warna = warna_verteks(utama)
        bawah_zona = kulit & (co[:, 2] < z0) & (co[:, 2] > sendi["LeftFoot"][2] + 0.1)
        ref_kulit = np.median(warna[bawah_zona], axis=0)
        ref_kain = np.median(warna[zona & (co[:, 2] > z0 + 0.08)], axis=0)
        mirip = np.linalg.norm(warna - ref_kulit, axis=1) < np.linalg.norm(warna - ref_kain, axis=1)
        dekat_sumbu = np.zeros(nv, bool)
        lebih_sumbu = np.full(nv, 1.0)       # jarak ke sumbu paha sisinya, dikurangi jari-jari kaki (m)
        for sisi_, di_ in (("Left", kiri), ("Right", ~kiri)):
            a_, b_ = sendi[sisi_ + "UpLeg"], sendi[sisi_ + "Leg"]
            u_ = (b_ - a_) / np.linalg.norm(b_ - a_)
            rel = co - a_
            jarak_sumbu = np.linalg.norm(rel - np.outer(rel @ u_, u_), axis=1)
            cincin_ = kulit & di_ & (co[:, 2] < z0) & (co[:, 2] > z0 - 0.04)
            r_kaki = float(np.percentile(jarak_sumbu[cincin_], 95)) if cincin_.any() else 0.07
            dekat_sumbu |= di_ & (jarak_sumbu < r_kaki * G.setdefault("kaki_jari_longgar", 1.12))
            lebih_sumbu[di_] = (jarak_sumbu - r_kaki * G["kaki_jari_longgar"])[di_]
        calon_u = np.zeros(nu, bool)
        calon_u[wid[zona & (co[:, 2] < z0 + G.setdefault("kaki_naik_maks_m", 0.07)) & (dekat_sumbu | mirip)]] = True
        sampai_u = np.zeros(nu, bool)
        sampai_u[wid[kulit & (co[:, 2] < z0)]] = True
        e_c = e[(calon_u[e[:, 0]] | sampai_u[e[:, 0]]) & (calon_u[e[:, 1]] | sampai_u[e[:, 1]])]
        for _ in range(200):
            baru = sampai_u.copy()
            baru[e_c[sampai_u[e_c[:, 0]], 1]] = True
            baru[e_c[sampai_u[e_c[:, 1]], 0]] = True
            if (baru == sampai_u).all():
                break
            sampai_u = baru
        kulit_paha = zona & sampai_u[wid] & calon_u[wid]
        kain = zona & ~kulit_paha
        z_kulit_atas = float(co[kulit_paha, 2].max()) if kulit_paha.any() else z0
        lapor["kulit_paha_di_bawah_kain"] = {"verteks": int(kulit_paha.sum()), "z_teratas_m": round(z_kulit_atas, 3)}
        z_hips = sendi["Hips"][2]
        porsi_spine = halus01((co[:, 2] - z_hips) / max(z1 - z_hips, 1e-3))
        # campuran UpLeg kiri-kanan menurut posisi samping: sama rata di garis tengah depan dan belakang, makin
        # ke samping makin condong ke paha sisi itu (kain tetap berbentuk sarung, tidak terbelah seperti celana)
        porsi_kiri = halus01(0.5 + (co[:, 0] - x0) / (2 * G["kain_tengah_m"]))
        W_k = np.zeros_like(W)
        # porsi Hips: kain_hips di sendi paha ke atas, turun ke kain_hips_tepi di tinggi kulit paha teratas (di
        # bawah itu ada paha di dalam kain yang berputar penuh bersama UpLeg; kain harus ikut supaya tidak tertembus)
        ke_tepi = halus01((z_paha - co[:, 2]) / max(z_paha - z_kulit_atas, 1e-3))
        hips_k = G["kain_hips"] + (G["kain_hips_tepi"] - G["kain_hips"]) * ke_tepi
        W_k[:, ix["Hips"]] = hips_k
        sisa = 1.0 - hips_k
        W_k[:, ix["Spine"]] = sisa * porsi_spine
        W_k[:, ix["LeftUpLeg"]] = sisa * (1 - porsi_spine) * porsi_kiri
        W_k[:, ix["RightUpLeg"]] = sisa * (1 - porsi_spine) * (1 - porsi_kiri)
        # Lapisan dalam kain (terowongan yang menempel ke kaki di tepi atas kulit paha): makin dekat ke sumbu paha
        # dan ke tepi kulit, makin murni UpLeg sisinya, supaya tidak ada lembaran yang tertarik dari paha ke kain.
        KD = G.setdefault("kain_dalam", {"jarak_m": 0.04, "naik_m": 0.12})
        if KD["jarak_m"] > 0:
            dalam = halus01(1.0 - lebih_sumbu / KD["jarak_m"]) * halus01(1.0 - (co[:, 2] - z_kulit_atas) / KD["naik_m"])
            W_k *= (1.0 - dalam)[:, None]
            W_k[:, ix["LeftUpLeg"]] += dalam * kiri
            W_k[:, ix["RightUpLeg"]] += dalam * ~kiri
            lapor["kain_dalam_verteks"] = int((kain & (dalam > 0.05)).sum())
        b_ = halus01((z1 - co[:, 2]) / G["kain_pudar_atas_m"])          # memudar ke bobot Mixamo di tepi atas
        batasi(kain, ["Hips", "Spine", "Spine1", "LeftUpLeg", "RightUpLeg"], ix["Hips"])
        W[kain] = b_[kain][:, None] * W_k[kain] + (1 - b_[kain])[:, None] * W[kain]
        W[:] = haluskan_bobot(W, wid, e, nu, kain, G["kain_halus_iterasi"])
        lapor["kain_verteks"] = int(kain.sum())

    # 2c. lengan: lengan bawah dan tangan hanya rantai lengan sisinya; lengan atas boleh ditambah Spine atas
    x_siku = abs(sendi["LeftForeArm"][0] - x0) - G["lengan_dari_siku_m"]
    x_bahu = abs(sendi["LeftArm"][0] - x0)
    # batas tinggi kaki: tepi bawah kain. Lengan pada pose A selalu di atasnya; tanpa syarat tinggi, telapak kaki
    # (yang sama jauhnya dari sumbu badan dengan lengan atas) ikut terhitung lengan.
    z_kaki = (zk["z_m"][0] * f) if zk else sendi["LeftUpLeg"][2] - 0.25
    bukan = ~leher & ~kain & kulit
    atas_kaki = (co[:, 2] > z_kaki) & ~kulit_paha
    for sisi, di_sisi in (("Left", kiri), ("Right", ~kiri)):
        lb = bukan & di_sisi & atas_kaki & (ax > x_siku)
        cad = np.where(co[:, 2] > sendi[sisi + "Hand"][2], ix[sisi + "ForeArm"], ix[sisi + "Hand"])
        batasi(lb, rantai(sisi, ["Arm", "ForeArm", "Hand"]), cad)
        la = bukan & di_sisi & atas_kaki & (ax > x_bahu) & (ax <= x_siku)
        if G.get("lengan_atas_batasi", True):
            batasi(la, rantai(sisi, ["Shoulder", "Arm", "ForeArm"]) + ["Spine1", "Spine2"], ix[sisi + "Arm"])
        lapor[f"lengan_{sisi.lower()}_verteks"] = int(lb.sum() + la.sum())
    lengan = bukan & atas_kaki & (ax > x_bahu)
    # Bobot di sekitar sendi bahu dihaluskan: bobot Mixamo berubah tajam dari badan ke lengan, sehingga bahu
    # menggelembung saat lengan ditarik jauh ke belakang atau menyilang dada.
    BH = G.setdefault("bahu_halus", {"radius_m": 0.14, "iterasi": 0})
    if BH["iterasi"] > 0:
        dekat_bahu = np.zeros(nv, bool)
        for sisi in ("Left", "Right"):
            dekat_bahu |= np.linalg.norm(co - sendi[sisi + "Arm"], axis=1) < BH["radius_m"]
        dekat_bahu &= bukan & atas_kaki
        W[:] = haluskan_bobot(W, wid, e, nu, dekat_bahu, BH["iterasi"])
        lapor["bahu_dihaluskan_verteks"] = int(dekat_bahu.sum())

    # 2d. kulit kaki (di bawah zona kain dan kulit paha di dalam kain): hanya rantai kaki sisinya, tanpa Hips.
    # Dari kaki_posisi_di_atas_m di atas pergelangan kaki ke atas bobotnya ditentukan posisi: UpLeg ke Leg
    # bergradasi halus sepanjang lutut_gradasi_m di kedua sisi sendi lutut (bobot Mixamo di paha dekat kain
    # tercampur Hips dan paha sebelah, sehingga paha mengempis saat kuda-kuda lebar).
    kaki = (bukan & ~lengan & (co[:, 2] < z_kaki)) | kulit_paha
    for sisi, di_sisi in (("Left", kiri), ("Right", ~kiri)):
        kk = kaki & di_sisi
        lutut, pangkal, pergelangan = sendi[sisi + "Leg"], sendi[sisi + "UpLeg"], sendi[sisi + "Foot"]
        atas = kk & (co[:, 2] > pergelangan[2] + G["kaki_posisi_di_atas_m"])
        arah_turun = (lutut - pangkal) / np.linalg.norm(lutut - pangkal)
        t_ = halus01(0.5 + ((co - lutut) @ arah_turun) / (2 * G["lutut_gradasi_m"]))
        W[atas] = 0.0
        W[atas, ix[sisi + "UpLeg"]] = (1 - t_)[atas]
        W[atas, ix[sisi + "Leg"]] = t_[atas]
        bawah = kk & ~atas
        cad = np.where(co[:, 2] > pergelangan[2], ix[sisi + "Leg"], ix[sisi + "Foot"])
        batasi(bawah, [sisi + b for b in ("Leg", "Foot", "ToeBase")], cad)
        lapor[f"kaki_{sisi.lower()}_verteks"] = int(kk.sum())

    # 2e. badan lainnya: tanpa tangan, lengan bawah, betis, kaki, dan kepala
    badan = bukan & ~lengan & ~kaki
    boleh_badan = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "LeftUpLeg", "RightUpLeg"]
    batasi(badan, boleh_badan, ix["Spine1"])

    # 2f. penutup sambungan: bobot kulit terdekat
    W /= np.maximum(W.sum(axis=1, keepdims=True), 1e-9)
    idx_kulit = np.nonzero(kulit)[0]
    kd = KDTree(len(idx_kulit))
    for k_, i in enumerate(idx_kulit):
        kd.insert(co[i], k_)
    kd.balance()
    if penutup.any():
        for i in np.nonzero(penutup)[0]:
            W[i] = W[idx_kulit[kd.find(co[i])[1]]]
        lapor["penutup_verteks"] = int(penutup.sum())
    tanpa = tulis_bobot(utama, W, nama_tulang, G["pengaruh_maks"])

    # 3. mesh tambahan (kalung gantung): kulit terdekat, hanya tulang yang disebut, dihaluskan sepanjang mesh
    Mt = G["mesh_tambahan"]
    utama.data.calc_loop_triangles()
    tri_semua = np.empty(len(utama.data.loop_triangles) * 3, dtype=np.int64)
    utama.data.loop_triangles.foreach_get("vertices", tri_semua)
    tri_kulit = tri_semua.reshape(-1, 3)
    tri_kulit = tri_kulit[kulit[tri_kulit].all(axis=1)]
    bvh_kulit = BVHTree.FromPolygons(co.tolist(), tri_kulit.tolist())
    for m in model_meshes:
        if m is utama:
            continue
        co_m = koordinat_dunia(m)
        # titik terdekat di permukaan kulit, bobot diinterpolasi di dalam segitiganya: kalung bergerak bersama
        # kulit tepat di bawahnya (bobot verteks terdekat bisa berjarak 1 sampai 2 cm dan membuat kalung tenggelam)
        Wt = np.zeros((len(co_m), W.shape[1]))
        for i_, c in enumerate(co_m):
            kena = bvh_kulit.find_nearest(Vector(c.tolist()))
            ta, tb, tc = tri_kulit[kena[2]]
            v0, v1, v2 = co[tb] - co[ta], co[tc] - co[ta], np.array(kena[0][:]) - co[ta]
            d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01
            w1, w2 = ((d11 * d20 - d01 * d21) / den, (d00 * d21 - d01 * d20) / den) if abs(den) > 1e-18 else (0.0, 0.0)
            Wt[i_] = W[ta] * (1 - w1 - w2) + W[tb] * w1 + W[tc] * w2
        kol = np.zeros(W.shape[1], bool)
        kol[[ix[b] for b in Mt["tulang"]]] = True
        Wt[:, ~kol] = 0.0
        kosong = Wt.sum(axis=1) < 1e-6
        Wt[kosong, ix[Mt["tulang"][-1]]] = 1.0
        Wt /= Wt.sum(axis=1, keepdims=True)
        wid_m, e_m, nu_m = tetangga_las(m, co_m)
        Wt = haluskan_bobot(Wt, wid_m, e_m, nu_m, np.ones(len(co_m), bool), Mt["halus_iterasi"])
        Wt /= Wt.sum(axis=1, keepdims=True)
        tulis_bobot(m, Wt, nama_tulang, G["pengaruh_maks"])
        lapor[f"mesh_{m.name}"] = {"verteks": len(co_m), **{b: round(float(Wt[:, ix[b]].mean()), 3) for b in Mt["tulang"]}}
    lapor["verteks_tanpa_bobot"] = tanpa
    catat(f"bobot per bagian: {lapor}")
    return lapor


def putar_kunci(act, arm, nama_tulang, sumbu_dunia, derajat, sumbu_lokal=None):
    """Rotasi tambahan pada semua kunci rotasi satu tulang, di kerangka acuan istirahat tulang (r @ q): setara
    dengan memiringkan tulang terhadap induknya mengelilingi sumbu dunia pada pose istirahat. sumbu_lokal:
    sumbu langsung di kerangka acuan itu (mis. engsel siku, yang tetap terhadap lengan atas)."""
    if not derajat or PRE + nama_tulang not in arm.data.bones:
        return False
    if sumbu_lokal is not None:
        sumbu_tulang = Vector(sumbu_lokal).normalized()
    else:
        sumbu_tulang = arm.data.bones[PRE + nama_tulang].matrix_local.to_3x3().inverted() @ Vector(sumbu_dunia).normalized()
    r = Quaternion(sumbu_tulang, math.radians(derajat))
    jalur = f'pose.bones["{PRE}{nama_tulang}"].rotation_quaternion'
    fc4 = sorted((fc for fc in fcurves(act) if fc.data_path == jalur), key=lambda fc: fc.array_index)
    if len(fc4) != 4 or len({len(fc.keyframe_points) for fc in fc4}) != 1:
        return False
    for k in range(len(fc4[0].keyframe_points)):
        q = r @ Quaternion([fc.keyframe_points[k].co.y for fc in fc4])
        for fc, nilai in zip(fc4, q):
            kp = fc.keyframe_points[k]
            selisih = nilai - kp.co.y
            kp.co.y = nilai
            kp.handle_left.y += selisih
            kp.handle_right.y += selisih
    for fc in fc4:
        fc.update()
    return True


def kurva_rotasi(act, nama_tulang):
    jalur = f'pose.bones["{PRE}{nama_tulang}"].rotation_quaternion'
    fc4 = sorted((fc for fc in fcurves(act) if fc.data_path == jalur), key=lambda fc: fc.array_index)
    if len(fc4) != 4 or len({len(fc.keyframe_points) for fc in fc4}) != 1:
        return None
    return fc4


def pose_genggam(arm, sisi, sudut, jempol):
    """Rotasi tetap tiap ruas jari satu tangan (kerangka acuan istirahat tulang) untuk pose menggenggam:
    tiap ruas menekuk `sudut[ruas]` derajat ke arah telapak pada engselnya (tegak lurus arah jari dan normal
    telapak pada pose istirahat), tanpa merenggang. Jempol menekuk `jempol[ruas]` derajat ke arah pangkal
    jari tengah. Mengembalikan {nama tulang: Quaternion}."""
    B = arm.data.bones
    kepala = lambda n: B[PRE + n].head_local
    tangan = kepala(sisi + "Hand")
    n = (kepala(sisi + "HandIndex1") - tangan).cross(kepala(sisi + "HandPinky1") - tangan).normalized()
    if n.z > 0:                      # pose istirahat Mixamo: telapak menghadap bawah
        n = -n
    out = {}
    for jari in ("Index", "Middle", "Ring", "Pinky", "Thumb"):
        for i in (1, 2, 3):
            nama = f"{sisi}Hand{jari}{i}"
            if PRE + nama not in B:
                continue
            j0, j1 = (i, i + 1) if i < 3 else (i - 1, i)
            d = (kepala(f"{sisi}Hand{jari}{j1}") - kepala(f"{sisi}Hand{jari}{j0}")).normalized()
            if jari == "Thumb":
                t = kepala(sisi + "HandMiddle1") + n * 0.04 - kepala(nama)
                t = (t - d * t.dot(d)).normalized()
                engsel, derajat = d.cross(t).normalized(), jempol[i - 1]
            else:
                engsel, derajat = d.cross(n).normalized(), sudut[i - 1]
            out[nama] = Quaternion(B[PRE + nama].matrix_local.to_3x3().inverted() @ engsel, math.radians(derajat))
    return out


def buat_kurva_rotasi(act, nama_tulang):
    """Buat empat kurva rotasi_quaternion untuk tulang yang tidak punya kunci di aksi ini (klip dari karakter
    berjari dua rantai hanya mengunci jempol dan telunjuk), dengan kunci di awal dan akhir aksi."""
    jalur = f'pose.bones["{PRE}{nama_tulang}"].rotation_quaternion'
    for fc in [fc for fc in fcurves(act) if fc.data_path == jalur]:
        hapus_fcurve(act, fc)
    if hasattr(act, "fcurves"):
        wadah = act.fcurves
    else:
        wadah = act.layers[0].strips[0].channelbags[0].fcurves
    f0, f1 = act.frame_range
    fc4 = []
    for i, nilai in enumerate((1.0, 0.0, 0.0, 0.0)):
        fc = wadah.new(jalur, index=i)
        fc.keyframe_points.insert(f0, nilai)
        if f1 > f0:
            fc.keyframe_points.insert(f1, nilai)
        fc4.append(fc)
    return fc4


def pasang_genggam(act, pose):
    """Timpa semua kunci rotasi ruas jari dengan pose tetap. Mengembalikan jumlah tulang yang ditimpa."""
    n = 0
    for nama, q in pose.items():
        fc4 = kurva_rotasi(act, nama) or buat_kurva_rotasi(act, nama)
        for fc, nilai in zip(fc4, q):
            for kp in fc.keyframe_points:
                kp.co.y = nilai
                kp.handle_left.y = nilai
                kp.handle_right.y = nilai
            fc.update()
        n += 1
    return n


def luruskan_kepala(act, arm, pasang, bagian, maks_derajat):
    """Kembalikan arah kepala ke depan dan tegak (arah pose istirahat, yaitu arah sasaran di game) sebesar
    `bagian` dari simpangannya di tiap kunci, paling banyak maks_derajat, dibagi rata ke Neck dan Head.
    Mengembalikan simpangan kepala terbesar sebelum dan sesudah (derajat), atau None kalau kurva tidak lengkap."""
    fcN, fcH = kurva_rotasi(act, "Neck"), kurva_rotasi(act, "Head")
    if fcN is None or fcH is None or len(fcN[0].keyframe_points) != len(fcH[0].keyframe_points):
        return None
    pbN, pbH = arm.pose.bones[PRE + "Neck"], arm.pose.bones[PRE + "Head"]
    R0 = arm.data.bones[PRE + "Head"].matrix_local.to_quaternion()
    pasang(act)
    tambah, sebelum, sesudah = [], 0.0, 0.0
    for kp in fcH[0].keyframe_points:
        bpy.context.scene.frame_set(int(round(kp.co.x)))
        Mn, Mh = pbN.matrix.to_quaternion(), pbH.matrix.to_quaternion()
        D = Mh @ R0.inverted()
        C = Quaternion().slerp(D.inverted(), bagian)
        if C.angle > math.radians(maks_derajat):
            C = Quaternion(C.axis, math.radians(maks_derajat))
        Ch = Quaternion().slerp(C, 0.5)
        tambah.append((Mn.inverted() @ Ch @ Mn, Mh.inverted() @ Ch @ Mh))
        sebelum = max(sebelum, math.degrees(D.angle))
        sesudah = max(sesudah, math.degrees((C @ D).angle))
    for fc4, kolom in ((fcN, 0), (fcH, 1)):
        for k in range(len(fc4[0].keyframe_points)):
            q = Quaternion([fc.keyframe_points[k].co.y for fc in fc4]) @ tambah[k][kolom]
            for fc, nilai in zip(fc4, q):
                kp = fc.keyframe_points[k]
                selisih = nilai - kp.co.y
                kp.co.y = nilai
                kp.handle_left.y += selisih
                kp.handle_right.y += selisih
        for fc in fc4:
            fc.update()
    return round(sebelum, 1), round(sesudah, 1)


def arah_bilah_keris(arm, koef):
    """Arah bilah keris (dunia) pada pose sekarang, dari kerangka acuan tangan kanan (x garis buku jari ke
    sisi telunjuk, f arah jari, n normal telapak) dan koefisien `koef` (<blok>.animasi.keris.arah_xfn)."""
    B = arm.data.bones
    t0 = B[PRE + "RightHand"].head_local
    tanda = -1.0 if (B[PRE + "RightHandIndex1"].head_local - t0).cross(B[PRE + "RightHandPinky1"].head_local - t0).z > 0 else 1.0
    t, i1, m1, p1 = (arm.matrix_world @ arm.pose.bones[PRE + n].head for n in ("RightHand", "RightHandIndex1", "RightHandMiddle1", "RightHandPinky1"))
    x = (i1 - p1).normalized()
    f = m1 - t
    f = (f - x * f.dot(x)).normalized()
    n = x.cross(f).normalized()
    if n.dot((i1 - t).cross(p1 - t)) * tanda < 0:
        n = -n
    return (x * koef[0] + f * koef[1] + n * koef[2]).normalized()


def koreksi_pergelangan(act, arm, pasang, koef, kontak, K):
    """Putar RightHand (pergelangan) per bingkai supaya bilah keris masuk rentang arah yang diminta di
    sepanjang ayunan: kenaikan dijepit ke K["naik_derajat"] [min, maks] dan, kalau K["serong_maks_derajat"]
    diisi, arah mendatarnya dijepit sejauh itu dari depan tokoh (-Y). Tiap bingkai memakai rotasi terkecil ke
    arah yang sudah dijepit (jepitan menerus, jadi tidak meloncat). Bobot penuh dari K["inti_sebelum"] bingkai
    sebelum kontak sampai K["inti_sesudah"] sesudahnya, memudar halus K["pudar"] bingkai di kedua sisi.
    Mengembalikan kamus hasil atau None."""
    fc4 = kurva_rotasi(act, "RightHand")
    if fc4 is None or kontak is None:
        return None
    pb = arm.pose.bones[PRE + "RightHand"]
    pasang(act)
    sc = bpy.context.scene
    n0, n1 = (math.radians(v) for v in K["naik_derajat"])
    serong = K.get("serong_maks_derajat")
    a0, a1, pudar = kontak - K.get("inti_sebelum", 2), kontak + K.get("inti_sesudah", 2), max(1, K.get("pudar", 4))
    tambah, catatan = {}, {}
    for k in range(len(fc4[0].keyframe_points)):
        f = fc4[0].keyframe_points[k].co.x
        w = 1.0 if a0 <= f <= a1 else float(halus01(1.0 - ((a0 - f) if f < a0 else (f - a1)) / pudar))
        if w <= 0:
            continue
        sc.frame_set(int(round(f)))
        d = arah_bilah_keris(arm, koef)
        M = pb.matrix.to_quaternion()
        naik = math.asin(max(-1.0, min(1.0, d.z)))
        arah = math.atan2(d.x, -d.y)                      # 0 = depan tokoh, positif ke kiri tokoh
        naik_s = min(n1, max(n0, naik))
        arah_s = arah if serong is None else min(math.radians(serong), max(-math.radians(serong), arah))
        sasaran = Vector((math.sin(arah_s) * math.cos(naik_s), -math.cos(arah_s) * math.cos(naik_s), math.sin(naik_s)))
        C = d.rotation_difference(sasaran)
        Cw = Quaternion().slerp(C, w)
        tambah[k] = M.inverted() @ Cw @ M
        catatan[int(round(f))] = {"naik": round(math.degrees(naik)), "serong": round(math.degrees(arah)), "rotasi": round(math.degrees(Cw.angle)), "bobot": round(w, 2)}
    for k, X in tambah.items():
        q = Quaternion([fc.keyframe_points[k].co.y for fc in fc4]) @ X
        for fc, nilai in zip(fc4, q):
            kp = fc.keyframe_points[k]
            selisih = nilai - kp.co.y
            kp.co.y = nilai
            kp.handle_left.y += selisih
            kp.handle_right.y += selisih
    for fc in fc4:
        fc.update()
    sesudah = {}
    for f in catatan:
        sc.frame_set(f)
        d2 = arah_bilah_keris(arm, koef)
        sesudah[f] = [round(math.degrees(math.asin(max(-1.0, min(1.0, d2.z))))), round(math.degrees(math.atan2(d2.x, -d2.y)))]
    return {"kontak": int(kontak), "rotasi_terbesar_derajat": max(c["rotasi"] for c in catatan.values()),
            "rotasi_di_kontak_derajat": catatan.get(int(kontak), {}).get("rotasi"),
            "sebelum_per_bingkai": catatan, "sesudah_naik_serong_per_bingkai": sesudah}


def cari_koreksi_lengan(arm, utama, act, K, kontak):
    """Cari rotasi tambahan terkecil supaya sendi tangan menjauh dari badan: pada bingkai kontak sejauh
    K["sasaran_m"] dan sepanjang klip paling dekat K["terkecil_m"]. Koreksi dibagi ke dua sendi supaya bahu
    tidak menggelembung: lengan atas (dua sumbu dunia pada pose istirahat: sumbu samping = mengayun ke depan,
    sumbu tegak = membuka ke luar; paling banyak lengan_maks_derajat) dan siku (meluruskan lengan bawah pada
    engselnya, paling banyak siku_maks_derajat; dihitung lebih murah daripada rotasi bahu).
    Mengembalikan kamus hasil atau None."""
    sisi = K.get("sisi", "Left")
    nama, nama_b = sisi + "Arm", sisi + "ForeArm"
    pb, pb_b = arm.pose.bones[PRE + nama], arm.pose.bones[PRE + nama_b]
    M_inv = arm.data.bones[PRE + nama].matrix_local.to_3x3().inverted()
    tanda = 1.0 if sisi == "Left" else -1.0
    sumbu = {"depan": M_inv @ Vector((-1.0, 0.0, 0.0)), "buka": M_inv @ Vector((0.0, 0.0, tanda))}
    nama_grup = [vg.name for vg in utama.vertex_groups]
    dominan = np.zeros(len(utama.data.vertices), dtype=np.int64)
    for v in utama.data.vertices:
        if v.groups:
            dominan[v.index] = max(v.groups, key=lambda g_: g_.weight).group
    nm = np.array([n.replace(PRE, "") for n in nama_grup])[dominan]
    badan_set = np.isin(nm, ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftUpLeg", "RightUpLeg", "LeftShoulder", "RightShoulder"])
    utama.data.calc_loop_triangles()
    tri = np.empty(len(utama.data.loop_triangles) * 3, dtype=np.int64)
    utama.data.loop_triangles.foreach_get("vertices", tri)
    tri = tri.reshape(-1, 3)
    tri = tri[badan_set[tri].all(axis=1)]
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    bingkai = list(range(f0, f1 + 1, 2))
    if kontak is not None and kontak not in bingkai:
        bingkai.append(kontak)
    scene = bpy.context.scene
    dunia = lambda n_: arm.matrix_world @ arm.pose.bones[PRE + n_].head
    # permukaan badan per bingkai (tidak bergantung pada rotasi lengan) dan rotasi asli kedua tulang
    data_b = {}
    for fr in bingkai:
        scene.frame_set(fr)
        dg = bpy.context.evaluated_depsgraph_get()
        oe = utama.evaluated_get(dg)
        me = oe.to_mesh()
        c_ = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", c_)
        Mw = np.array(oe.matrix_world)
        c_ = c_.reshape(-1, 3) @ Mw[:3, :3].T + Mw[:3, 3]
        oe.to_mesh_clear()
        data_b[fr] = (BVHTree.FromPolygons(c_.tolist(), tri.tolist()), pb.rotation_quaternion.copy(), pb_b.rotation_quaternion.copy())
    f_k = kontak if kontak is not None else None

    # Engsel siku di kerangka acuan istirahat lengan bawah (tetap terhadap lengan atas): tegak lurus lengan atas
    # dan lengan bawah pada bingkai kontak. Rotasi positif mengelilinginya menambah tekukan; negatif meluruskan.
    scene.frame_set(f_k if f_k is not None else bingkai[len(bingkai) // 2])
    atas_ = (dunia(nama_b) - dunia(nama)).normalized()
    bawah_ = (dunia(sisi + "Hand") - dunia(nama_b)).normalized()
    engsel_dunia = atas_.cross(bawah_)
    engsel = None
    if engsel_dunia.length > 0.15:           # siku cukup tertekuk untuk menentukan engselnya
        engsel_dunia.normalize()
        M_b = (arm.matrix_world @ pb_b.matrix).to_3x3()
        engsel = pb_b.rotation_quaternion.to_matrix() @ M_b.inverted() @ engsel_dunia

    def ukur(a_depan, a_buka, a_siku):
        r = Quaternion(sumbu["buka"], math.radians(a_buka)) @ Quaternion(sumbu["depan"], math.radians(a_depan))
        r_b = Quaternion(engsel, math.radians(-a_siku)) if engsel is not None and a_siku else None
        jar = {}
        for fr in bingkai:
            scene.frame_set(fr)
            pb.rotation_quaternion = r @ data_b[fr][1]
            if r_b is not None:
                pb_b.rotation_quaternion = r_b @ data_b[fr][2]
            bpy.context.view_layer.update()
            p = dunia(sisi + "Hand")
            kena = data_b[fr][0].find_nearest(p)
            d = p - kena[0]
            j = d.length
            jar[fr] = -j if (j > 1e-6 and j < 0.06 and d.dot(kena[1]) / j < -0.5) else j
        return jar

    awal = ukur(0.0, 0.0, 0.0)
    if f_k is None:
        f_k = min(awal, key=awal.get)
    lm, sm = int(K.get("lengan_maks_derajat", 25)), int(K.get("siku_maks_derajat", 40))
    murah = K.get("siku_bobot", 0.5)
    calon = sorted(((math.sqrt(d_ * d_ + b_ * b_ + (murah * s_) ** 2), d_, b_, s_)
                    for d_ in range(0, lm + 1, 5) for b_ in range(-lm, lm + 1, 5)
                    for s_ in (range(0, sm + 1, 10) if engsel is not None else (0,))), key=lambda t: t[0])
    terbaik, terdekat = None, None
    for besar, d_, b_, s_ in calon:
        j = ukur(float(d_), float(b_), float(s_))
        dk, dmin = j[f_k], min(j.values())
        if dk > K.get("maks_m", 0.30):
            continue
        if dk >= K["sasaran_m"] and dmin >= K["terkecil_m"]:
            terbaik = (d_, b_, s_, dk, dmin, True)
            break
        # seberapa dekat ke kedua sasaran, dikurangi besar rotasinya: rotasi besar yang hanya menambah beberapa
        # milimeter tidak dipilih (bahu ikut berubah bentuk)
        nilai = (min(dk / K["sasaran_m"], 1.0) + min(max(dmin, 0.0) / K["terkecil_m"], 1.0)
                 - K.get("cadangan_denda_per_derajat", 0.01) * besar)
        if terdekat is None or nilai > terdekat[0] + 1e-6:
            terdekat = (nilai, (d_, b_, s_, dk, dmin, False))
    scene.frame_set(f0)
    if terbaik is None:
        # tidak ada rotasi dalam batas yang memenuhi kedua sasaran: pakai yang paling mendekati
        if terdekat is None:
            return None
        terbaik = terdekat[1]
    return {"depan": terbaik[0], "buka": terbaik[1], "siku": terbaik[2], "sumbu_depan": [-1.0, 0.0, 0.0], "sumbu_buka": [0.0, 0.0, tanda],
            "engsel_siku": [round(float(v), 4) for v in engsel] if engsel is not None else None, "tulang": nama, "tulang_siku": nama_b,
            "sasaran_tercapai": terbaik[5],
            "sebelum_m": {"kontak": round(awal[f_k], 3), "terkecil": round(min(awal.values()), 3)},
            "sesudah_m": {"kontak": round(terbaik[3], 3), "terkecil": round(terbaik[4], 3)}}


def sudut_leher(arm, act):
    """Rata-rata sudut Neck ke Head terhadap arah Spine2 ke Neck (derajat; positif = kepala lebih maju dari
    arah tulang punggung atas), dan terhadap tegak."""
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    rel, tegak = [], []
    for fr in range(f0, f1 + 1, max(1, (f1 - f0) // 24)):
        bpy.context.scene.frame_set(fr)
        s2, nk, hd = (arm.matrix_world @ arm.pose.bones[PRE + b].head for b in ("Spine2", "Neck", "Head"))
        a_, b_ = (nk - s2).normalized(), (hd - nk).normalized()
        rel.append(math.degrees(a_.angle(b_)) * (1 if (b_ - a_).y < 0 else -1))
        tegak.append(math.degrees(math.atan2(-b_.y, b_.z)))
    return round(float(np.mean(rel)), 1), round(float(np.mean(tegak)), 1)


def bobot_lama(a, akar, data, A, arm, mesh_lama):
    """Cara lama (tanpa --blok): model Wijaya hasil rapikan_leher.py. Bobot dari mesh berkulit lama (nearest
    vertex), kepala dan pita leher menurut leher_rapi.hasil, kain menurut warna base color."""
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.model))
    model = [o for o in bpy.data.objects if o.type == "MESH" and o is not mesh_lama][0]
    model.name = "wijaya"
    pilih_hanya(model)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # periksa kecocokan posisi: jarak rata-rata verteks badan baru ke verteks lama terdekat
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

    # Kepala baru seluruhnya Head. Kalau model berasal dari rapikan_leher.py (wajah.json "leher_rapi.hasil"),
    # kepala = semua verteks di atas permukaan potong bawah rahang (bidang miring yang dibatasi bidang datar);
    # kalau tidak, semua di atas kepala_z_m.
    vg_head = model.vertex_groups[PRE + "Head"]
    co = np.array([model.matrix_world @ v.co for v in model.data.vertices])
    LR = data.get("leher_rapi", {}).get("hasil", {})
    leher = LR.get("pita")
    if leher:
        z0 = leher["z0_m"]
        sx, sy = leher["sumbu_m"]
        r_leher = data["leher_rapi"].get("radius_leher_m", 0.13)
        p0, n_bid, z_dtr = np.array(LR["rahang"]["titik_m"]), np.array(LR["rahang"]["normal"]), LR["rahang"]["z_datar_m"]
        # tinggi permukaan potong di atas (x, y): bidang miring, tidak lebih tinggi dari bidang datar
        z_potong = np.minimum(p0[2] - (n_bid[0] * (co[:, 0] - p0[0]) + n_bid[1] * (co[:, 1] - p0[1])) / n_bid[2], z_dtr)
        kalung = set()
        for p in model.data.polygons:
            if model.data.materials[p.material_index].name.startswith("emas"):
                kalung.update(p.vertices)
        # tinggi bidang potong atas leher badan di (x, y); pita sambungan ada di antara kedua permukaan potong
        pb0, n_b = np.array(LR["potong_badan"]["titik_m"]), np.array(LR["potong_badan"]["normal"])
        z_bawah = pb0[2] - (n_b[0] * (co[:, 0] - pb0[0]) + n_b[1] * (co[:, 1] - pb0[1])) / n_b[2]
        t_leher = (co[:, 2] - z_bawah) / np.maximum(z_potong - z_bawah, 1e-4)
        idx_kepala = [int(i) for i in np.nonzero((t_leher >= 1.0 - 1e-3) & (co[:, 2] > z_bawah))[0] if i not in kalung]
    else:
        idx_kepala = [i for i in range(len(co)) if co[i, 2] > A["kepala_z_m"]]
    for vg in model.vertex_groups:
        vg.remove(idx_kepala)
    vg_head.add(idx_kepala, 1.0, "REPLACE")
    catat(f"kepala: {len(idx_kepala)} verteks diikat ke Head")
    if leher:
        # Pita sambungan (di atas cincin badan, di bawah permukaan potong): bobot hasil transfer di pangkal,
        # beralih ke Head penuh di tepi kepala, supaya leher tidak robek saat kepala bergerak.
        kepala_set = set(idx_kepala)
        n_pita = 0
        for i in range(len(co)):
            if i in kepala_set or i in kalung or co[i, 2] < z_bawah[i] + 5e-4 or math.hypot(co[i, 0] - sx, co[i, 1] - sy) > r_leher:
                continue
            t = float(min(1.0, max(0.0, t_leher[i])))
            s = t * t * (3 - 2 * t)
            v = model.data.vertices[i]
            total = sum(g.weight for g in v.groups) or 1.0
            for g in list(v.groups):
                model.vertex_groups[g.group].add([i], g.weight / total * (1 - s), "REPLACE")
            vg_head.add([i], s, "ADD")
            n_pita += 1
        # Kalung: hanya Neck dan Spine2. Bagian belakang (tinggi, di tengkuk) lebih ke Neck, bagian depan
        # (rendah, di dada) Spine2; gradasi halus menurut tinggi supaya tali tidak patah.
        idx_kalung = sorted(int(i) for i in kalung)
        if idx_kalung:
            zk = co[idx_kalung, 2]
            neck_maks = A.setdefault("kalung_neck_maks", 0.7)
            for vg in model.vertex_groups:
                vg.remove(idx_kalung)
            for i, z in zip(idx_kalung, zk):
                t = (z - zk.min()) / max(zk.max() - zk.min(), 1e-6)
                wn = neck_maks * t * t * (3 - 2 * t)
                model.vertex_groups[PRE + "Neck"].add([i], wn, "REPLACE")
                model.vertex_groups[PRE + "Spine2"].add([i], 1 - wn, "REPLACE")
        catat(f"pita leher: {n_pita} verteks bergradasi ke Head; kalung {len(kalung)} verteks ke Neck (maks {A.get('kalung_neck_maks')}) dan Spine2")
        A["leher"] = {"pita_verteks": n_pita, "kalung_verteks": len(kalung)}

        # Kerangka ikut ditegakkan seperti mesh: sendi Head (dan anak-anaknya) digeser sejauh geser kepala,
        # sendi Neck sejauh geser leher pada tingginya, supaya poros putar kepala tetap di tempat yang sama
        # terhadap kepala. Hanya posisi istirahat; arah tulang dan animasi tidak berubah.
        tg = LR.get("tegak")
        if tg:
            blk = Vector((tg["arah_belakang"][0], tg["arah_belakang"][1], 0.0))
            pilih_hanya(arm)
            z_neck = (arm.matrix_world @ arm.data.bones[PRE + "Neck"].head_local).z
            wz = min(1.0, max(0.0, (z_neck - tg["z_pangkal_m"]) / (z0 - tg["z_pangkal_m"])))
            wz = wz * wz * (3 - 2 * wz)
            bpy.ops.object.mode_set(mode="EDIT")
            eb = arm.data.edit_bones
            kepala_eb = [eb[PRE + "Head"]] + list(eb[PRE + "Head"].children_recursive)
            for b in kepala_eb:
                b.head += blk * tg["geser_kepala_m"]
                b.tail += blk * tg["geser_kepala_m"]
            eb[PRE + "Neck"].head += blk * tg["geser_leher_m"] * wz
            eb[PRE + "Neck"].tail += blk * tg["geser_leher_m"] * wz
            bpy.ops.object.mode_set(mode="OBJECT")
            A["leher"]["sendi_head_geser_m"] = tg["geser_kepala_m"]
            A["leher"]["sendi_neck_geser_m"] = round(tg["geser_leher_m"] * wz, 4)
            catat(f"kerangka: sendi Head digeser {tg['geser_kepala_m'] * 100:.1f} cm, Neck {tg['geser_leher_m'] * wz * 100:.1f} cm ke belakang")

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

    return [model]


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    if a.blok:
        P = data[a.blok]
        A = P.setdefault("animasi", {})
        lama_ = data.get("animasi", {})
        for k in ("serang_sebelum", "serang_sesudah", "berat_sebelum", "berat_sesudah", "jongkok_diam_detik", "siaga_detik", "kontak_manual"):
            if k in lama_:
                A.setdefault(k, json.loads(json.dumps(lama_[k])))     # angka potong klip sama untuk semua karakter
        A.setdefault("koreksi_rotasi_derajat", {"Neck": 0.0, "Head": 0.0})
        A.setdefault("koreksi_klip", {})
    else:
        A = data.setdefault("animasi", {})
        A.setdefault("kepala_z_m", 1.50)
        A.setdefault("kain_hips", 0.85)
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

    # 1. Kerangka, bobot, dan aksi idle dari FBX With Skin.
    arm, rig_meshes, act_idle, _ = impor_fbx(os.path.join(akar, a.rig) if a.rig else os.path.join(folder, "idle.fbx"))
    arm.name = "Kerangka"
    lapor_bobot = None
    if a.blok:
        catat(f"kerangka {len(arm.data.bones)} tulang; mesh berkulit {[(m.name, len(m.data.vertices)) for m in rig_meshes]}")
        sebelum = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.model))
        model_list = [o for o in bpy.data.objects if o not in sebelum and o.type == "MESH"]
        for m in model_list:
            pilih_hanya(m)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # 2. Bobot per bagian (koordinat dunia; kerangka belum diterapkan transformasinya).
        lapor_bobot = bobot_per_bagian(arm, rig_meshes, model_list, P, A)
        for r in rig_meshes:
            bpy.data.objects.remove(r, do_unlink=True)
        pilih_hanya(arm)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for m in model_list:
            mod = m.modifiers.new("Armature", "ARMATURE")
            mod.object = arm
            m.parent = arm
    else:
        mesh_lama = rig_meshes[0]
        pilih_hanya(arm)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        pilih_hanya(mesh_lama)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        catat(f"kerangka {len(arm.data.bones)} tulang; mesh lama {len(mesh_lama.data.vertices)} verteks, {len(mesh_lama.vertex_groups)} grup")
        model_list = bobot_lama(a, akar, data, A, arm, mesh_lama)

    # 3. Aksi.
    aksi = {}
    if arm.animation_data is None:
        arm.animation_data_create()

    folder_baru = os.path.join(akar, a.baru) if a.baru else None
    dari_baru = set()

    def ambil(nama_berkas, nama_aksi, wajib=True):
        path = os.path.join(folder, nama_berkas)
        if nama_aksi in A.get("klip_baru_lewati", []):
            if not wajib:
                return None                                    # klip baru yang tidak dipakai (mis. lari-santai)
        elif folder_baru and os.path.exists(os.path.join(folder_baru, nama_berkas)):
            path = os.path.join(folder_baru, nama_berkas)
            dari_baru.add(nama_aksi)
            catat(f"{nama_aksi}: dari folder klip baru")
        if not os.path.exists(path):
            if wajib:
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
    # klip yang hanya ada kalau disediakan: lari santai dan kencang, serang berat sebagai berkas sendiri
    for nama in ("lari-santai", "lari-kencang", "serang-berat"):
        ambil(nama + ".fbx", nama, wajib=False)
    # jongkok-diam asli hanya dibandingkan, tidak dipakai kalau menyimpang
    act_jd = ambil("jongkok-diam.fbx", "jongkok-diam-asli")

    for nama in ("jalan", "lari", "lari-santai", "lari-kencang", "jongkok-jalan", "hindar", "terkena", "serang-1", "serang-2", "serang-3",
                 "serang-berat", "tarung", "tangkis"):
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
                         ("serang-3", A["serang_sebelum"], A["serang_sesudah"]), ("serang-berat", A["berat_sebelum"], A["berat_sesudah"])):
        if nama not in aksi:
            continue
        act = aksi[nama]
        f0, f1, laju = laju_tangan(arm, act)
        fc = f0 + int(np.argmax(laju))
        # klip dari folder baru punya patokan sendiri (kontak_manual_baru); patokan lama tidak berlaku untuknya
        manual = A.setdefault("kontak_manual_baru" if nama in dari_baru else "kontak_manual", {}).get(nama)
        if manual:
            # kontak dipatok tangan: [bingkai kontak, sebelum, sesudah]; serang-2 otomatis memilih ayunan balik
            # (bingkai 27) saat tangan kiri terbenam di punggung, tebasan sebenarnya di bingkai 16-19.
            fc, sb, ss = manual
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
            if nama not in aksi:
                salin = act.copy()
                salin.name = nama
                salin.use_fake_user = True
                potong(salin, x0, x1)
                aksi[nama] = salin
                ringkasan[nama] = {"dari_tarung": [x0, x1], "bingkai": x1 - x0 + 1}
                catat(f"{nama} dari tarung bingkai {x0}-{x1}")
        if "dari_tarung" in ringkasan.get("serang-berat", {}):
            ringkasan["serang-berat"]["kontak_baru"] = fc - b0 + 1
        del aksi["tarung"]
        arm.animation_data.action = None
        bpy.data.actions.remove(act)

    # Koreksi rotasi tetap pada tulang leher untuk semua aksi (wajah.json "animasi.koreksi_rotasi_derajat",
    # derajat ke belakang): Mixamo sedikit menunduk dan memajukan kepala. Rotasi diterapkan di kerangka acuan
    # istirahat tulang (r @ q), jadi setara dengan memiringkan tulang terhadap induknya.
    koreksi = A.setdefault("koreksi_rotasi_derajat", {"Neck": 0.0, "Head": 5.0})
    arah_depan = data.get("leher_rapi", {}).get("depan", [0.0, -1.0]) if not a.blok else [0.0, -1.0]
    sumbu_dunia = Vector((arah_depan[0], arah_depan[1], 0.0)).cross(Vector((0.0, 0.0, 1.0))).normalized()
    for nama_tulang, derajat in koreksi.items():
        n_aksi = sum(1 for act in aksi.values() if putar_kunci(act, arm, nama_tulang, sumbu_dunia, derajat))
        if derajat:
            catat(f"koreksi rotasi {nama_tulang}: {derajat} derajat ke belakang pada {n_aksi} aksi")

    # Koreksi per klip (wajah.json "<blok>.animasi.koreksi_klip"): {klip: [{"tulang", "sumbu_dunia", "derajat"}, ...]}.
    # Dipakai untuk lengan kiri pada klip Sword And Shield, yang menekuk tangan kiri ke dada (memegang perisai).
    for nama_klip, daftar in A.get("koreksi_klip", {}).items():
        if nama_klip not in aksi:
            continue
        for butir in daftar:
            ok = putar_kunci(aksi[nama_klip], arm, butir["tulang"], butir["sumbu_dunia"], butir["derajat"])
            catat(f"koreksi klip {nama_klip}: {butir['tulang']} {butir['derajat']} derajat mengelilingi {butir['sumbu_dunia']}" + ("" if ok else " (GAGAL: kurva tidak lengkap)"))

    # Koreksi lengan otomatis (wajah.json "<blok>.animasi.koreksi_lengan"): klip Sword And Shield menekuk tangan kiri
    # ke badan seperti memegang perisai. Untuk tiap klip yang disebut, dicari rotasi lengan atas terkecil yang
    # menjauhkan sendi tangan dari badan sampai sasaran, lalu dipasang ke semua kunci klip itu.
    KL = A.get("koreksi_lengan")
    if KL and KL.get("aktif", True) and a.blok:
        utama_ = max(model_list, key=lambda o: len(o.data.polygons))
        ringkasan["koreksi_lengan"] = {}
        for nama_klip in KL["klip"]:
            if nama_klip not in aksi:
                continue
            # klip dari folder baru (bukan Sword And Shield) hanya dikoreksi kalau disebut di klip_baru
            if nama_klip in dari_baru and nama_klip not in KL.get("klip_baru", []):
                catat(f"koreksi lengan {nama_klip}: dilewati (klip baru)")
                continue
            kontak_ = ringkasan.get(nama_klip, {}).get("kontak_baru")
            hasil_k = cari_koreksi_lengan(arm, utama_, aksi[nama_klip], KL, kontak_)
            if hasil_k is None:
                catat(f"koreksi lengan {nama_klip}: TIDAK KETEMU dalam batas rotasi")
                ringkasan["koreksi_lengan"][nama_klip] = None
                continue
            putar_kunci(aksi[nama_klip], arm, hasil_k["tulang"], hasil_k["sumbu_depan"], hasil_k["depan"])
            putar_kunci(aksi[nama_klip], arm, hasil_k["tulang"], hasil_k["sumbu_buka"], hasil_k["buka"])
            if hasil_k["siku"] and hasil_k["engsel_siku"]:
                putar_kunci(aksi[nama_klip], arm, hasil_k["tulang_siku"], None, -hasil_k["siku"], sumbu_lokal=hasil_k["engsel_siku"])
            ringkasan["koreksi_lengan"][nama_klip] = hasil_k
            catat(f"koreksi lengan {nama_klip}: {hasil_k['tulang']} ke depan {hasil_k['depan']} derajat, buka {hasil_k['buka']} derajat, "
                  f"siku diluruskan {hasil_k['siku']} derajat{'' if hasil_k['sasaran_tercapai'] else ' (sasaran TIDAK tercapai penuh dalam batas rotasi)'}; "
                  f"jarak tangan ke badan {hasil_k['sebelum_m']} -> {hasil_k['sesudah_m']}")
        arm.animation_data.action = None

    # Kepala tetap ke depan selama serangan (wajah.json "<blok>.animasi.kepala_lurus"): klip tebasan memiringkan
    # dan memalingkan kepala menjauh dari arah serangan.
    KP = A.get("kepala_lurus")
    if KP and KP.get("aktif", True):
        ringkasan["kepala_lurus"] = {}
        for nama_klip in KP["klip"]:
            if nama_klip not in aksi:
                continue
            hasil_kp = luruskan_kepala(aksi[nama_klip], arm, pasang, KP.get("bagian", 0.8), KP.get("maks_derajat", 50))
            ringkasan["kepala_lurus"][nama_klip] = hasil_kp
            catat(f"kepala lurus {nama_klip}: simpangan terbesar (derajat) sebelum dan sesudah {hasil_kp}")
        arm.animation_data.action = None

    # Koreksi pergelangan per klip (wajah.json "<blok>.animasi.koreksi_pergelangan"): sudut pasang keris tetap
    # satu; di klip yang disebut, pergelangan kanan diputar bertahap di sekitar kontak supaya bilah mendatar.
    KW = A.get("koreksi_pergelangan")
    if KW and KW.get("aktif", True) and "arah_xfn" in A.get("keris", {}):
        ringkasan["koreksi_pergelangan"] = {}
        for nama_klip in KW["klip"]:
            if nama_klip not in aksi:
                continue
            hasil_w = koreksi_pergelangan(aksi[nama_klip], arm, pasang, A["keris"]["arah_xfn"], ringkasan.get(nama_klip, {}).get("kontak_baru"), KW["klip"][nama_klip])
            ringkasan["koreksi_pergelangan"][nama_klip] = hasil_w
            catat(f"koreksi pergelangan {nama_klip}: {hasil_w}")
        arm.animation_data.action = None

    # Genggaman (wajah.json "<blok>.animasi.genggam"): jari ditimpa pose tetap. Klip serang Mixamo membuka
    # telapak dan merenggangkan jari; tangan kanan memegang keris, tangan kiri setengah menggenggam.
    GG = A.get("genggam")
    if GG and GG.get("aktif", True):
        ringkasan["genggam"] = {}
        for sisi, kunci in (("Right", "kanan"), ("Left", "kiri")):
            K_ = GG.get(kunci)
            if not K_:
                continue
            pose_g = pose_genggam(arm, sisi, K_["sudut"], K_["jempol"])
            daftar_g = list(aksi) if K_["klip"] == "semua" else [n_ for n_ in K_["klip"] if n_ in aksi]
            jumlah = {n_: pasang_genggam(aksi[n_], pose_g) for n_ in daftar_g}
            ringkasan["genggam"][kunci] = {"klip": daftar_g, "tulang_per_klip": sorted(set(jumlah.values()))}
            catat(f"genggam {kunci}: {len(daftar_g)} klip, tulang ditimpa per klip {sorted(set(jumlah.values()))}")

    # Sudut leher saat idle dan lari (untuk menilai perlu tidaknya koreksi Neck).
    leher_ukur = {}
    for nama_klip in ("idle", "lari", "siaga"):
        if nama_klip in aksi:
            rel, tegak = sudut_leher(arm, aksi[nama_klip])
            leher_ukur[nama_klip] = {"neck_ke_head_terhadap_punggung_atas": rel, "neck_ke_head_terhadap_tegak": tegak}
    catat(f"sudut leher (derajat, positif = maju): {leher_ukur}")
    ringkasan["leher"] = leher_ukur
    if lapor_bobot is not None:
        ringkasan["bobot"] = lapor_bobot

    # 4. NLA: tiap aksi satu track, lalu ekspor.
    arm.animation_data.action = None
    for nama, act in aksi.items():
        tr = arm.animation_data.nla_tracks.new()
        tr.name = nama
        st = tr.strips.new(nama, 1, act)
        st.name = nama
    pilih_hanya(arm)
    for m in model_list:
        m.select_set(True)
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
    ringkasan["dari_baru"] = sorted(dari_baru)
    ringkasan["berkas_mb"] = round(os.path.getsize(keluar) / 1e6, 2)
    A["hasil"] = ringkasan
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {keluar}: {os.path.getsize(keluar) / 1e6:.2f} MB; aksi: {ringkasan['aksi']}")


main()
