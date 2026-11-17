"""
Sambung kepala Tripo ke badan Tripo dengan potongan di tengah leher (Blender). Umum untuk semua tokoh.

  blender -b -P tools/blender/sambung_kepala.py -- --badan aset-mentah/prajurit-badan.glb \
      --kepala aset-mentah/prajurit-kepala.glb --json tools/blender/wajah.json --blok prajurit \
      --tahap tempat --pratinjau aset-mentah/pratinjau --nama prajurit
  ... --tahap sambung --tekstur aset-mentah/tekstur --keluar aset-mentah/prajurit-sambung.glb

Masukan: badan hasil optimasi_karakter.py (meter, kaki di z 0, menghadap -Y) dan kepala hasil
kepala_ringan.py (meter, skala sudah tinggi badan / 7,5, menghadap -Y). Angka di blok <blok>.sambung;
hasil ukur dan penempatan di <blok>.tempat.

Prinsip (pelajaran dari leher Wijaya):
  1. bawah rahang, dagu, dan setengah atas leher dipertahankan dari kepala Tripo
  2. kedua mesh dipotong di tengah leher dengan dua bidang sejajar yang sedikit miring (lebih rendah
     di depan); kepala di bidang atas, badan di bidang bawah, berjarak celah_m
  3. atas leher badan dirampingkan dan ditegakkan bertahap (bobot 0 di pangkal leher, 1 di garis
     potong) sampai penampangnya sama dengan cincin kepala; kepala hanya diskalakan lewat skala_kepala
  4. kedua cincin disamakan jumlah verteksnya lalu dijembatani dengan cincin perantara; hanya pita
     sambungan yang dihaluskan; tidak ada fill holes atau merge pada seluruh mesh
  5. tali leher menutup garis sambungan

Tahap "tempat": ukur, hitung skala dan posisi kepala, render tumpang depan dan samping (kepala baru
semi transparan di atas badan, garis potong, garis tegak sendi bahu) dan render siluet untuk
tumpang_konsep.py. Tahap "sambung": potong, sambung, ekspor.
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
    p.add_argument("--badan", required=True)
    p.add_argument("--kepala", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True)
    p.add_argument("--tahap", choices=["tempat", "sambung"], required=True)
    p.add_argument("--pratinjau", default=None, help="folder render tumpang (tahap tempat)")
    p.add_argument("--nama", default="karakter")
    p.add_argument("--keluar", default=None, help="GLB hasil (tahap sambung); di tahap tempat: GLB sementara badan dan "
                                                  "kepala yang sudah ditempatkan tetapi belum disambung (untuk banding_karakter.py)")
    p.add_argument("--tekstur", default=None, help="folder keluaran bake (tahap sambung)")
    return p.parse_args(argv)


def catat(*a):
    print("[sambung]", *a, flush=True)


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


def segitiga(o):
    o.data.calc_loop_triangles()
    t = np.empty(len(o.data.loop_triangles) * 3, dtype=np.int64)
    o.data.loop_triangles.foreach_get("vertices", t)
    return t.reshape(-1, 3)


def impor(path, nama):
    sebelum = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    baru = [o for o in bpy.data.objects if o not in sebelum and o.type == "MESH"]
    o = max(baru, key=lambda o: len(o.data.polygons))
    o.name = nama
    pilih_hanya(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def irisan(co, tri, p0, n):
    """Titik-titik potong mesh dengan bidang (p0, n)."""
    d = (co - p0) @ n
    dt = d[tri]
    m = (dt.min(1) < 0) & (dt.max(1) >= 0)
    t, dd = tri[m], dt[m]
    pts = []
    for i, j in ((0, 1), (1, 2), (2, 0)):
        c = (dd[:, i] < 0) != (dd[:, j] < 0)
        f = dd[c, i] / (dd[c, i] - dd[c, j])
        pts.append(co[t[c, i]] + f[:, None] * (co[t[c, j]] - co[t[c, i]]))
    return np.vstack(pts) if pts else np.zeros((0, 3))


def penampang(co, tri, p0, n, radius, pusat=None, ulang=0):
    """Lebar (x), tebal (y), dan pusat irisan bidang (p0, n) di sekitar `pusat` (bawaan p0) dalam radius
    mendatar. ulang > 0: pusat penyaring dipindah ke pusat hasil lalu diukur lagi (mencari leher)."""
    semua = irisan(co, tri, p0, n)
    c = np.array(p0[:2] if pusat is None else pusat[:2], dtype=float)
    hasil = None
    for _ in range(ulang + 1):
        p = semua[np.hypot(semua[:, 0] - c[0], semua[:, 1] - c[1]) < radius]
        if len(p) < 3:
            break
        hasil = {"lebar": float(np.ptp(p[:, 0])), "tebal": float(np.ptp(p[:, 1])),
                 "pusat": [float((p[:, 0].min() + p[:, 0].max()) / 2), float((p[:, 1].min() + p[:, 1].max()) / 2),
                           float(p[:, 2].mean())], "jari_maks": float(np.hypot(p[:, 0] - c[0], p[:, 1] - c[1]).max())}
        c = np.array(hasil["pusat"][:2])
    return hasil


def bulat(d):
    return {k: (round(v, 4) if not isinstance(v, list) else [round(x, 4) for x in v]) for k, v in d.items()}


def normal_bidang(miring_derajat):
    """Bidang potong miring: lebih rendah di depan (-Y)."""
    t = math.radians(miring_derajat)
    return np.array([0.0, -math.sin(t), math.cos(t)])


def bawaan(S):
    for k, v in {
        "dagu_z_m": 1.455, "skala_kepala": 1.0, "telinga_maju_m": 0.0, "geser_x_m": 0.0,
        "potong_bawah_dagu_m": 0.016, "miring_derajat": 8.0, "celah_m": 0.014,
        "radius_leher_m": 0.105, "pangkal_m": 0.055, "warp_radius_penuh_m": 0.11, "warp_radius_nol_m": 0.19,
        "lanjut_sumbu": 0.5,
        "keterangan": "dagu_z_m: tinggi ujung dagu kepala baru di badan. potong_bawah_dagu_m: bidang potong kepala di "
                      "sumbu leher sekian di bawah dagu; miring_derajat: bidang lebih rendah di depan; celah_m: jarak ke "
                      "bidang potong badan (tinggi pita sambungan). pangkal_m: perampingan leher badan mulai sekian di "
                      "bawah bidang potong badan (bobot 0) sampai bidang potong (bobot 1). telinga_maju_m: kepala "
                      "digeser maju dari posisi telinga tepat di atas sendi bahu.",
    }.items():
        S.setdefault(k, v)


def ukur_badan(co, tri, bvh):
    """Sumbu simetri, tinggi dan posisi sendi bahu, profil depan leher."""
    x0 = float((co[:, 0].min() + co[:, 0].max()) / 2)
    zs = np.arange(1.20 * co[:, 2].max() / 1.68, co[:, 2].max() * 0.86, 0.005)
    setengah = []
    for z in zs:
        p = irisan(co, tri, np.array([0, 0, z]), np.array([0, 0, 1.0]))
        setengah.append(np.abs(p[:, 0] - x0).max() if len(p) else 0.0)
    setengah = np.array(setengah)
    # Bahu teratas: irisan tertinggi yang masih selebar bahu (80 persen setengah lebar terbesar).
    lebar_bahu = setengah.max()
    z_bahu = float(zs[np.nonzero(setengah >= 0.8 * lebar_bahu)[0].max()])
    # Sendi bahu: tengah penampang pangkal lengan, 3 cm di bawah puncak bahu, 7 cm terluar.
    p = irisan(co, tri, np.array([0, 0, z_bahu - 0.03]), np.array([0, 0, 1.0]))
    luar = p[np.abs(p[:, 0] - x0) > np.abs(p[:, 0] - x0).max() - 0.07]
    y_bahu = float((luar[:, 1].min() + luar[:, 1].max()) / 2)
    x_bahu = float(np.abs(luar[:, 0] - x0).max() - 0.045)
    return {"x0": x0, "z_bahu": z_bahu, "y_bahu": y_bahu, "x_bahu": x_bahu, "setengah_lebar_bahu": float(lebar_bahu)}


def ukur_kepala(co, R):
    """Telinga: verteks terluar (sumbu X) antara mulut dan mata."""
    am = R["acuan_m"]
    x_c = (am["mata_kiri"][0] + am["mata_kanan"][0]) / 2
    z_mata = (am["mata_kiri"][1] + am["mata_kanan"][1]) / 2
    z_mulut = (am["mulut_kiri"][1] + am["mulut_kanan"][1]) / 2
    pita = (co[:, 2] > z_mulut) & (co[:, 2] < z_mata + 0.01)
    dx = np.abs(co[:, 0] - x_c)
    telinga = pita & (dx > dx[pita].max() - 0.008)
    return {"x_c": float(x_c), "z_mata": float(z_mata), "z_dagu": float(am["dagu"][1]),
            "telinga": [float(co[telinga, 1].mean()), float(co[telinga, 2].mean())],
            "lebar_telinga": float(2 * dx[pita].max()),
            "lebar_rahang": float(2 * dx[(co[:, 2] > am["dagu"][1] + 0.025) & (co[:, 2] < z_mulut)].max())}


def rapikan_tengkuk(kepala, S, y_telinga):
    """Serpihan helai rambut di garis rambut bawah dan lipatan di belakang rahang dibuka (telinga tidak disentuh).
    Mengubah penampang kepala di tengkuk: helai rambut yang menjuntai sampai bidang potong ikut menyusut."""
    Tk = topologi_las(kepala)
    co_k = koordinat(kepala)
    pos_k = np.zeros((Tk["nu"], 3))
    pos_k[Tk["wid"]] = co_k

    def wilayah_tengkuk(c):
        # belakang rahang di bawah telinga, dan garis rambut di belakang telinga
        bawah = (c[:, 2] < S["dagu_z_m"] + S.setdefault("tengkuk_atas_dagu_m", 0.035)) & (c[:, 1] > y_telinga - S.setdefault("tengkuk_depan_telinga_m", 0.0))
        rambut = (c[:, 2] < S["dagu_z_m"] + S.setdefault("garis_rambut_atas_dagu_m", 0.085)) & \
                 (c[:, 1] > y_telinga + S.setdefault("garis_rambut_belakang_telinga_m", 0.018))
        return bawah | rambut

    wil = np.zeros(Tk["nu"], bool)
    wil[Tk["wid"]] = wilayah_tengkuk(co_k)
    pos_k, awal_k, sisa_k = buka_lipatan(pos_k, Tk, wil)
    pasang_koordinat(kepala, pos_k[Tk["wid"]])
    dibalik_k, sisa_k = perbaiki_arah(kepala, wilayah_tengkuk)
    return awal_k, dibalik_k, sisa_k


def tempatkan(badan, kepala, P):
    """Skala dan posisi kepala; bidang potong; sasaran perampingan leher badan. Mengisi P['tempat']."""
    S = P.setdefault("sambung", {})
    bawaan(S)
    R = P["kepala"]["ringan"]["hasil"]
    co_b, tri_b = koordinat(badan), segitiga(badan)
    bvh_b = BVHTree.FromPolygons(co_b.tolist(), tri_b.tolist())
    B = ukur_badan(co_b, tri_b, bvh_b)
    co_k = koordinat(kepala)
    Kp = ukur_kepala(co_k, R)

    s = S["skala_kepala"]
    geser = np.array([B["x0"] + S["geser_x_m"] - Kp["x_c"] * s,
                      B["y_bahu"] - S["telinga_maju_m"] - Kp["telinga"][0] * s,
                      S["dagu_z_m"] - Kp["z_dagu"] * s])
    kepala.scale = (s, s, s)
    kepala.location = Vector(geser)
    pilih_hanya(kepala)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lapor_t = None
    if S.get("tengkuk_dulu"):
        # Tengkuk dirapikan sebelum cincin kepala diukur, supaya leher badan dibentuk ke penampang kepala yang
        # sebenarnya dipotong (kalau sesudahnya, selisih tebal cincin bisa melewati 10 persen).
        lapor_t = rapikan_tengkuk(kepala, S, float(Kp["telinga"][0] * s + geser[1]))
        catat(f"tengkuk kepala dirapikan sebelum ukur: muka terbalik {lapor_t[0]}, dibalik {lapor_t[1]}, sisa {lapor_t[2]}")
    co_k, tri_k = koordinat(kepala), segitiga(kepala)

    # Bidang potong kepala: lewat sumbu leher kepala, potong_bawah_dagu_m di bawah dagu.
    n = normal_bidang(S["miring_derajat"])
    z_pk = S["dagu_z_m"] - S["potong_bawah_dagu_m"] * s
    datar = np.array([0, 0, 1.0])
    kasar = penampang(co_k, tri_k, np.array([B["x0"], geser[1] + 0.015, z_pk]), datar, S["radius_leher_m"])
    p0_k = np.array([kasar["pusat"][0], kasar["pusat"][1], z_pk])
    cincin_k = penampang(co_k, tri_k, p0_k, n, S["radius_leher_m"])
    atas = penampang(co_k, tri_k, p0_k + np.array([0, 0, 0.012]), n, S["radius_leher_m"])
    u_k = np.array(atas["pusat"]) - np.array(cincin_k["pusat"])
    u_k /= np.linalg.norm(u_k)
    u = datar * (1 - S["lanjut_sumbu"]) + u_k * S["lanjut_sumbu"]
    u /= np.linalg.norm(u)
    # Bidang potong badan: sejajar, celah_m di bawahnya; pusat sasaran cincin badan = lanjutan sumbu leher.
    c_k = np.array(cincin_k["pusat"])
    c_t = c_k - u * (S["celah_m"] / float(u @ n))
    p0_b = c_t.copy()
    # Leher badan sendiri (bisa condong jauh dari sasaran): cari mulai dari depan sendi bahu.
    cincin_b = penampang(co_b, tri_b, p0_b, n, 0.13, pusat=[B["x0"], B["y_bahu"] - 0.05], ulang=5)
    asal_terukur = dict(cincin_b)
    T = {
        "geser_m": [round(float(v), 4) for v in geser], "skala_kepala": s,
        "normal": [round(float(v), 5) for v in n],
        "bidang_kepala_m": [round(float(v), 4) for v in p0_k], "bidang_badan_m": [round(float(v), 4) for v in p0_b],
        "arah_sumbu": [round(float(v), 4) for v in u],
        "cincin_kepala": bulat(cincin_k), "cincin_badan_terukur": bulat(asal_terukur), "cincin_badan_asal": dict(cincin_b),
        "badan": {k: round(v, 4) for k, v in B.items()},
        "kepala": {"telinga_m": [round(float(Kp["telinga"][0] * s + geser[1]), 4), round(float(Kp["telinga"][1] * s + geser[2]), 4)],
                   "lebar_rahang_m": round(Kp["lebar_rahang"] * s, 4), "lebar_telinga_m": round(Kp["lebar_telinga"] * s, 4),
                   "puncak_m": round(float(R["puncak_m"] * s + geser[2]), 4),
                   "puncak_sanggul_m": round(float(co_k[:, 2].max()), 4), "mata_z_m": round(float(Kp["z_mata"] * s + geser[2]), 4)},
    }
    P["tempat"] = T
    if lapor_t is not None:
        T["tengkuk"] = [int(v) for v in lapor_t]
    # Penampang hasil perampingan disamakan ke cincin kepala: parameter "asal" dikoreksi beberapa kali, karena
    # verteks yang digeser mendatar memotong bidang miring di tempat lain.
    Tp = topologi_las(badan)
    for _ in range(6):
        co_w, _lapor = bentuk_leher(co_b, Tp, S, T)
        m = penampang(co_w, tri_b, p0_b, n, S["radius_leher_m"])
        if m is None:
            break
        A = T["cincin_badan_asal"]
        sx, sy = cincin_k["lebar"] / A["lebar"], cincin_k["tebal"] / A["tebal"]
        A["pusat"] = [A["pusat"][0] + (m["pusat"][0] - p0_b[0]) / sx, A["pusat"][1] + (m["pusat"][1] - p0_b[1]) / sy, A["pusat"][2]]
        A["lebar"] *= m["lebar"] / cincin_k["lebar"]
        A["tebal"] *= m["tebal"] / cincin_k["tebal"]
    T["cincin_badan_asal"] = bulat(T["cincin_badan_asal"])
    return S, T, B, Tp


def warp_leher(co, S, T):
    """Atas leher badan dirampingkan dan digeser bertahap: bobot 0 di pangkal_m di bawah bidang potong badan,
    1 di bidang potong dan di atasnya. Penampang di bidang potong menjadi sama dengan cincin kepala."""
    n = np.array(T["normal"])
    p0 = np.array(T["bidang_badan_m"])
    cb, ck = T["cincin_badan_asal"], T["cincin_kepala"]
    pusat_b = np.array(cb["pusat"])
    d = (co - p0) @ n
    w = halus01((d + S["pangkal_m"]) / S["pangkal_m"])
    r = np.hypot(co[:, 0] - (pusat_b[0] + p0[0]) / 2, co[:, 1] - (pusat_b[1] + p0[1]) / 2)
    w *= 1 - halus01((r - S["warp_radius_penuh_m"]) / (S["warp_radius_nol_m"] - S["warp_radius_penuh_m"]))
    sasaran = co.copy()
    sasaran[:, 0] = p0[0] + (co[:, 0] - pusat_b[0]) * (ck["lebar"] / cb["lebar"])
    sasaran[:, 1] = p0[1] + (co[:, 1] - pusat_b[1]) * (ck["tebal"] / cb["tebal"])
    return co + w[:, None] * (sasaran - co), w


def topologi_las(obj):
    """Topologi yang dilas menurut posisi (verteks berimpit di jahitan UV dianggap satu), tanpa me-merge mesh."""
    co = koordinat(obj)
    _, wid = np.unique(np.round(co / 1e-5).astype(np.int64), axis=0, return_inverse=True)
    wid = wid.ravel()
    nu = int(wid.max()) + 1
    e = np.empty(len(obj.data.edges) * 2, dtype=np.int64)
    obj.data.edges.foreach_get("vertices", e)
    e = np.unique(np.sort(wid[e.reshape(-1, 2)], axis=1), axis=0)
    e = e[e[:, 0] != e[:, 1]]
    hit = np.zeros(nu)
    np.add.at(hit, e[:, 0], 1)
    np.add.at(hit, e[:, 1], 1)
    poli = np.empty(len(obj.data.loop_triangles), dtype=np.int64)
    obj.data.loop_triangles.foreach_get("polygon_index", poli)
    return {"wid": wid, "nu": nu, "e": e, "hit": np.maximum(hit, 1)[:, None], "tri": wid[segitiga(obj)], "poli": poli}


def muka_arah_salah(pos, Tp, wilayah, ambang=0.1):
    """Muka yang menghadap berlawanan dengan permukaan sekitarnya DAN urutan verteksnya tidak konsisten dengan
    tetangganya (tepi yang sama dilalui searah oleh dua muka). Itu bukan lipatan geometri tetapi muka yang
    terbalik urutannya (sisa decimate pada tonjolan tipis); relaksasi tidak bisa memperbaikinya, harus dibalik.
    Mengembalikan indeks poligon."""
    wt = Tp["tri"]
    pt = pos[wt]
    fn = np.cross(pt[:, 1] - pt[:, 0], pt[:, 2] - pt[:, 0])
    luas = np.linalg.norm(fn, axis=1)
    vn = np.zeros_like(pos)
    for c in range(3):
        np.add.at(vn, wt[:, c], fn)
    for _ in range(8):
        vn = vn / np.maximum(np.linalg.norm(vn, axis=1), 1e-20)[:, None]
        vn = 0.5 * vn + 0.5 * rata_tet(vn, Tp)
    ref = vn[wt].sum(axis=1)
    buruk = (np.einsum("ij,ij->i", fn, ref) < ambang * luas * np.linalg.norm(ref, axis=1)) & (luas > 1e-12) & wilayah[wt].any(axis=1)
    arah = np.stack([wt[:, [0, 1]], wt[:, [1, 2]], wt[:, [2, 0]]], axis=1)          # tepi berarah tiap muka
    kunci = arah[:, :, 0] * Tp["nu"] + arah[:, :, 1]
    _, balik, jml = np.unique(kunci.ravel(), return_inverse=True, return_counts=True)
    searah = (jml[balik].reshape(-1, 3) >= 2).sum(axis=1)       # tepi yang juga dilalui searah oleh muka lain
    return Tp["poli"][buruk & (searah >= 2)], int(buruk.sum())


def balik_muka(obj, indeks):
    if len(indeks) == 0:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.reverse_faces(bm, faces=[bm.faces[int(i)] for i in set(indeks.tolist())])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def muka_terbalik(pos, Tp, wilayah, ambang=0.1):
    """Topeng segitiga yang menghadap berlawanan dengan permukaan sekitarnya (medan normal dihaluskan)."""
    wt = Tp["tri"]
    pt = pos[wt]
    fn = np.cross(pt[:, 1] - pt[:, 0], pt[:, 2] - pt[:, 0])
    luas = np.linalg.norm(fn, axis=1)
    vn = np.zeros_like(pos)
    for c in range(3):
        np.add.at(vn, wt[:, c], fn)
    for _ in range(8):
        vn = vn / np.maximum(np.linalg.norm(vn, axis=1), 1e-20)[:, None]
        vn = 0.5 * vn + 0.5 * rata_tet(vn, Tp)
    ref = vn[wt].sum(axis=1)
    ref /= np.maximum(np.linalg.norm(ref, axis=1), 1e-20)[:, None]
    return (np.einsum("ij,ij->i", fn, ref) < ambang * luas) & (luas > 1e-11) & wilayah[wt].any(axis=1)


def tambal_kantong(obj, wilayah_fn, i_tambal, tepi_m=0.007, putaran=3):
    """Kantong lipatan (gugus segitiga terbalik yang tidak bisa dibuka dengan relaksasi, misalnya sisa simpul
    tali yang tercetak di dada) dibuang bersama muka di sekitarnya, lalu lubangnya ditutup kipas segitiga baru
    berbahan `tambal` dengan UV sendiri; warnanya diisi sambung_tekstur.py dari kulit sekitar. Las hanya di
    sekitar lubang. Mengembalikan daftar tambalan."""
    lapor = []
    for _ in range(putaran):
        Tp = topologi_las(obj)
        co = koordinat(obj)
        pos = np.zeros((Tp["nu"], 3))
        pos[Tp["wid"]] = co
        wil = np.zeros(Tp["nu"], bool)
        wil[Tp["wid"]] = wilayah_fn(co)
        buruk = muka_terbalik(pos, Tp, wil)
        if not buruk.any():
            break
        wt = Tp["tri"]
        idx = np.nonzero(buruk)[0]
        induk = {int(v): int(v) for v in np.unique(wt[idx])}

        def akar(x):
            while induk[x] != x:
                induk[x] = induk[induk[x]]
                x = induk[x]
            return x
        for i in idx:
            a_ = akar(int(wt[i][0]))
            induk[akar(int(wt[i][1]))] = a_
            induk[akar(int(wt[i][2]))] = a_
        gugus = {}
        for v in induk:
            gugus.setdefault(akar(v), []).append(v)
        # gugus yang berdekatan disatukan lewat jari-jari
        bola = []
        for vs in gugus.values():
            c = pos[vs].mean(axis=0)
            bola.append([c, float(np.linalg.norm(pos[vs] - c, axis=1).max()) + tepi_m])
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        lay = bm.loops.layers.uv.active
        for c, r in bola:
            cV = Vector(c)
            dekat = [v for v in bm.verts if (v.co - cV).length < r + 0.04]
            bmesh.ops.remove_doubles(bm, verts=dekat, dist=2e-5)
            buang = [f for f in bm.faces if any((v.co - cV).length < r for v in f.verts)]
            if not buang:
                continue
            calon = {v for f in buang for v in f.verts}
            bmesh.ops.delete(bm, geom=buang, context="FACES")
            tepi_v = {v for v in calon if v.is_valid}
            es = [e for e in bm.edges if e.is_boundary and e.verts[0] in tepi_v and e.verts[1] in tepi_v]
            tet = {}
            for e in es:
                for v in e.verts:
                    tet.setdefault(v, []).append(e)
            sisa_e = set(es)
            while sisa_e:
                e = sisa_e.pop()
                v0, v = e.verts
                urut, tertutup = [v0, v], False
                while True:
                    lanjut = [x for x in tet[v] if x in sisa_e]
                    if not lanjut:
                        break
                    e2 = lanjut[0]
                    sisa_e.discard(e2)
                    v = e2.other_vert(v)
                    if v is v0:
                        tertutup = True
                        break
                    urut.append(v)
                if not tertutup or len(urut) < 3:
                    lapor.append({"pusat_m": [round(float(x), 3) for x in c], "gagal": f"tepi lubang tidak tertutup ({len(urut)} verteks)"})
                    continue
                ref = Vector()
                for v in urut:
                    for f in v.link_faces:
                        ref += f.normal * f.calc_area()
                ref.normalize()
                tengah = sum((v.co for v in urut), Vector()) / len(urut)
                vt = bm.verts.new(tengah)
                t1 = ref.orthogonal().normalized()
                t2 = ref.cross(t1)
                geser = (6.0 + 0.3 * len(lapor), 6.0)
                uv_ = lambda p_: (geser[0] + (p_ - tengah).dot(t1), geser[1] + (p_ - tengah).dot(t2))
                for i in range(len(urut)):
                    a_, b_ = urut[i], urut[(i + 1) % len(urut)]
                    f = bm.faces.new((a_, b_, vt))
                    f.normal_update()
                    if f.normal.dot(ref) < 0:
                        f.normal_flip()
                    f.material_index = i_tambal
                    f.smooth = True
                    for l in f.loops:
                        l[lay].uv = uv_(l.vert.co)
                lapor.append({"pusat_m": [round(float(x), 3) for x in c], "jari_m": round(r, 3), "muka_dibuang": len(buang),
                              "tepi_verteks": len(urut), "segitiga_baru": len(urut)})
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    return lapor


def perbaiki_arah(obj, wilayah_fn, putaran=4):
    """Balik muka yang urutannya salah di wilayah (fungsi koordinat -> bool per verteks), beberapa putaran karena
    membalik satu muka bisa memperlihatkan tetangganya. Mengembalikan (jumlah dibalik, sisa menghadap terbalik)."""
    dibalik, sisa = 0, 0
    for _ in range(putaran):
        Tp = topologi_las(obj)
        co = koordinat(obj)
        pos = np.zeros((Tp["nu"], 3))
        pos[Tp["wid"]] = co
        wil = np.zeros(Tp["nu"], bool)
        wil[Tp["wid"]] = wilayah_fn(co)
        salah, sisa = muka_arah_salah(pos, Tp, wil)
        if len(salah) == 0:
            break
        balik_muka(obj, salah)
        dibalik += len(set(salah.tolist()))
    return dibalik, sisa


def rata_tet(nilai, Tp):
    jumlah = np.zeros_like(nilai)
    np.add.at(jumlah, Tp["e"][:, 0], nilai[Tp["e"][:, 1]])
    np.add.at(jumlah, Tp["e"][:, 1], nilai[Tp["e"][:, 0]])
    return jumlah / Tp["hit"]


def buka_lipatan(pos, Tp, wilayah, putaran=4, ambang=0.1, runtuh=6):
    """Segitiga yang arahnya berlawanan dengan permukaan di sekitarnya (lipatan, kantong kecil sisa tonjolan
    tali atau helai rambut yang sudah diratakan) dibuka: verteksnya dan dua lingkar tetangganya direlaksasi
    (Laplace). Kantong yang tetap terlipat diruntuhkan: ketiga verteks segitiga terbalik dipindah ke titik
    tengahnya (segitiga berluas nol, tidak terlihat), tanpa mengubah topologi. Mengembalikan posisi baru,
    jumlah muka terbalik di awal, dan sisanya."""
    wt = Tp["tri"]
    e = Tp["e"]

    def terbalik():
        pt = pos[wt]
        fn = np.cross(pt[:, 1] - pt[:, 0], pt[:, 2] - pt[:, 0])
        luas = np.linalg.norm(fn, axis=1)
        vn = np.zeros_like(pos)
        for c in range(3):
            np.add.at(vn, wt[:, c], fn)
        for _ in range(8):      # medan normal dihaluskan: arah permukaan secara umum
            vn = vn / np.maximum(np.linalg.norm(vn, axis=1), 1e-20)[:, None]
            vn = 0.5 * vn + 0.5 * rata_tet(vn, Tp)
        ref = vn[wt].sum(axis=1)
        ref /= np.maximum(np.linalg.norm(ref, axis=1), 1e-20)[:, None]
        return (np.einsum("ij,ij->i", fn, ref) < ambang * luas) & (luas > 1e-11) & wilayah[wt].any(axis=1), fn, luas, ref

    def lingkar(kena, n):
        for _ in range(n):
            baru_ = kena.copy()
            baru_[e[kena[e[:, 0]], 1]] = True
            baru_[e[kena[e[:, 1]], 0]] = True
            kena = baru_
        return kena & wilayah

    awal = None
    for r in range(putaran + runtuh):
        buruk, fn, luas, ref = terbalik()
        sisa = int(buruk.sum())
        if awal is None:
            awal = sisa
        if not sisa:
            break
        kena = np.zeros(Tp["nu"], bool)
        kena[wt[buruk].ravel()] = True
        if r < putaran:
            bebas = lingkar(kena, 2)
            for _ in range(20):
                pos[bebas] += 0.5 * (rata_tet(pos, Tp)[bebas] - pos[bebas])
        else:
            # Runtuhkan tiap gugus muka terbalik (terhubung lewat verteks) ke satu titik.
            idx = np.nonzero(buruk)[0]
            induk = {int(v): int(v) for v in np.unique(wt[idx])}

            def akar(x):
                while induk[x] != x:
                    induk[x] = induk[induk[x]]
                    x = induk[x]
                return x
            for i in idx:
                a_, b_, c_ = (akar(int(v)) for v in wt[i])
                induk[b_] = a_
                induk[akar(int(wt[i][2]))] = a_
            gugus = {}
            for v in induk:
                gugus.setdefault(akar(v), []).append(v)
            for vs in gugus.values():
                pos[vs] = pos[vs].mean(axis=0)
            bebas = lingkar(kena, 2) & ~kena
            for _ in range(6):
                pos[bebas] += 0.5 * (rata_tet(pos, Tp)[bebas] - pos[bebas])
    buruk, fn, luas, ref = terbalik()
    sisa = int(buruk.sum())
    if sisa and os.environ.get("SAMBUNG_DEBUG"):
        # valensi tepi (jumlah muka per tepi las) dari muka yang masih terbalik
        ee = np.sort(np.stack([wt[:, [0, 1]], wt[:, [1, 2]], wt[:, [2, 0]]], axis=1), axis=2)
        kunci = ee[:, :, 0] * Tp["nu"] + ee[:, :, 1]
        unik, balik, jml = np.unique(kunci.ravel(), return_inverse=True, return_counts=True)
        val = jml[balik].reshape(-1, 3)
        for i in np.nonzero(buruk)[0]:
            c = pos[wt[i]].mean(0)
            print(f"[sambung] terbalik: luas {luas[i] / 2 * 1e6:.1f} mm2, valensi tepi {val[i].tolist()}, pusat {np.round(c, 3).tolist()}, "
                  f"cos {float(fn[i] @ ref[i]) / luas[i]:+.2f}", flush=True)
    return pos, awal, sisa


def haluskan_pangkal(co, Tp, S, T):
    """Pangkal leher dan dada atas badan dihaluskan (Taubin, tanpa menyusut) pada topologi yang dilas menurut
    posisi, lalu lipatan dibuka. Badan Tripo membawa tali konsep sebagai tonjolan mesh dan lipatan tajam di
    sekitar leher; setelah decimate dan perampingan leher itu menjadi segitiga kusut dan serpihan terbalik.
    Mesh tidak di-merge: verteks yang berimpit hanya digerakkan bersama."""
    H = S.setdefault("halus_pangkal", {})
    for k, v in {"aktif": True, "bawah_m": 0.19, "penuh_m": 0.15, "atas_m": 0.03, "x_penuh_m": 0.15, "x_nol_m": 0.21,
                 "iterasi": 40, "lambda": 0.5, "mu": -0.53, "laplace_iterasi": 3, "laplace_faktor": 0.4}.items():
        H.setdefault(k, v)
    if not H["aktif"]:
        return co, {}
    n, p0 = np.array(T["normal"]), np.array(T["bidang_badan_m"])
    d = (co - p0) @ n
    w = halus01((d + H["bawah_m"]) / (H["bawah_m"] - H["penuh_m"])) * (1 - halus01((d - H["atas_m"]) / 0.02))
    w *= 1 - halus01((np.abs(co[:, 0] - T["badan"]["x0"]) - H["x_penuh_m"]) / (H["x_nol_m"] - H["x_penuh_m"]))
    wid = Tp["wid"]
    pos = np.zeros((Tp["nu"], 3))
    pos[wid] = co
    ww = np.zeros(Tp["nu"])
    np.maximum.at(ww, wid, w)
    for _ in range(H["iterasi"]):
        for faktor in (H["lambda"], H["mu"]):
            pos += faktor * ww[:, None] * (rata_tet(pos, Tp) - pos)
    pos, awal, sisa = buka_lipatan(pos, Tp, ww > 0.3, runtuh=0)     # kantong yang tersisa ditambal (tambal_kantong)
    for _ in range(H["laplace_iterasi"]):       # sedikit Laplace polos: lipatan di tengkuk dan lekuk simpul melunak
        pos += H["laplace_faktor"] * ww[:, None] * (rata_tet(pos, Tp) - pos)
    return pos[wid], {"posisi": int((ww > 0.05).sum()), "muka_terbalik": awal, "muka_terbalik_sisa": sisa}


def wilayah_pangkal(co, S, T):
    """Verteks badan di daerah pangkal leher yang dihaluskan (untuk perbaikan arah muka)."""
    H = S["halus_pangkal"]
    d = (co - np.array(T["bidang_badan_m"])) @ np.array(T["normal"])
    return (d > -H["bawah_m"]) & (d < H["atas_m"]) & (np.abs(co[:, 0] - T["badan"]["x0"]) < H["x_nol_m"])


def bentuk_leher(co, Tp, S, T):
    """Leher badan: dirampingkan dan ditegakkan (warp_leher), lalu pangkalnya dihaluskan."""
    co1, w = warp_leher(co, S, T)
    co2, lapor = haluskan_pangkal(co1, Tp, S, T)
    lapor["verteks_digeser"] = int((w > 0.01).sum())
    return co2, lapor


def potong_badan(badan, S, T):
    """Potong leher badan di bidang potong badan; buang kepala lama (semua muka di atas bidang yang
    tersambung ke puncak kepala). Las posisi hanya dipakai untuk menelusuri sambungan muka."""
    n = Vector(T["normal"])
    p0 = Vector(T["bidang_badan_m"])
    bm = bmesh.new()
    bm.from_mesh(badan.data)
    dekat = [v for v in bm.verts if math.hypot(v.co.x - p0.x, v.co.y - p0.y) < S["warp_radius_nol_m"]]
    vs = set(dekat)
    geom = dekat + [e for e in bm.edges if e.verts[0] in vs and e.verts[1] in vs] + \
        [f for f in bm.faces if all(v in vs for v in f.verts)]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=p0, plane_no=n, clear_inner=False, clear_outer=False)
    # Muka di atas bidang, ditelusuri dari verteks tertinggi lewat posisi yang dilas.
    kunci = lambda v: (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
    di_atas = [f for f in bm.faces if (f.calc_center_median() - p0).dot(n) > 1e-7]
    muka_di = {}
    for f in di_atas:
        for v in f.verts:
            muka_di.setdefault(kunci(v), []).append(f)
    puncak = max(di_atas, key=lambda f: f.calc_center_median().z)
    hapus, tumpuk = {puncak}, [puncak]
    while tumpuk:
        f = tumpuk.pop()
        for v in f.verts:
            for g in muka_di[kunci(v)]:
                if g not in hapus:
                    hapus.add(g)
                    tumpuk.append(g)
    bmesh.ops.delete(bm, geom=list(hapus), context="FACES")
    bm.to_mesh(badan.data)
    bm.free()
    badan.data.update()
    return len(hapus), len(di_atas)


def potong_kepala(kepala, T):
    n = Vector(T["normal"])
    p0 = Vector(T["bidang_kepala_m"])
    bm = bmesh.new()
    bm.from_mesh(kepala.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=p0, plane_no=n,
                           clear_inner=True, clear_outer=False)
    bm.to_mesh(kepala.data)
    bm.free()
    kepala.data.update()


# ---------- render ----------

def siapkan_render(ukuran, transparan=False):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = ukuran
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparan
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparan else "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Dunia")
        scene.world.use_nodes = True
        latar = scene.world.node_tree.nodes["Background"]
        latar.inputs[0].default_value = (0.8, 0.8, 0.82, 1.0)
        latar.inputs[1].default_value = 0.7
    if scene.camera is None:
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
    return scene.camera


def render(kam, sasaran, arah, ortho, path):
    """arah: vektor dari sasaran ke kamera. ortho: panjang sisi terpanjang bingkai (m)."""
    scene = bpy.context.scene
    kam.location = Vector(sasaran) + Vector(arah).normalized() * 4.0
    kam.rotation_euler = (Vector(sasaran) - kam.location).to_track_quat("-Z", "Y").to_euler()
    kam.data.ortho_scale = ortho
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def bahan_garis(nama, warna):
    mat = bpy.data.materials.new(nama)
    mat.use_nodes = True
    nt = mat.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    emisi.inputs["Color"].default_value = (*warna, 1.0)
    emisi.inputs["Strength"].default_value = 1.0
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    return mat


def garis(nama, titik, mat, tebal=0.0012, tutup=False):
    cu = bpy.data.curves.new(nama, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = tebal
    sp = cu.splines.new("POLY")
    sp.points.add(len(titik) - 1)
    for p, t in zip(sp.points, titik):
        p.co = (*t, 1.0)
    sp.use_cyclic_u = tutup
    o = bpy.data.objects.new(nama, cu)
    o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    return o


def lingkar_bidang(p0, n, radius, k=48):
    a = np.linspace(0, 2 * np.pi, k, endpoint=False)
    x, y = p0[0] + radius * np.cos(a), p0[1] + radius * np.sin(a)
    z = p0[2] - (n[0] * (x - p0[0]) + n[1] * (y - p0[1])) / n[2]
    return np.stack([x, y, z], axis=1).tolist()


def muat_px(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)


def simpan_px(px, path):
    h, w = px.shape[:2]
    out = bpy.data.images.new("gabung", w, h, alpha=False)
    out.pixels.foreach_set(px.astype(np.float32).ravel())
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


def tahap_tempat(a, akar, data, P, badan, kepala):
    S, T, B, Tp = tempatkan(badan, kepala, P)
    n, p0_k, p0_b = np.array(T["normal"]), np.array(T["bidang_kepala_m"]), np.array(T["bidang_badan_m"])
    ck, cb = T["cincin_kepala"], T["cincin_badan_terukur"]
    catat(f"badan: sumbu x {B['x0']:.3f}, puncak bahu z {B['z_bahu']:.3f}, sendi bahu y {B['y_bahu']:.3f} (x +-{B['x_bahu']:.3f})")
    catat(f"kepala: skala {T['skala_kepala']}, geser {T['geser_m']}; dagu z {S['dagu_z_m']:.3f}, mata z {T['kepala']['mata_z_m']:.3f}, "
          f"puncak tanpa sanggul {T['kepala']['puncak_m']:.3f}, dengan sanggul {T['kepala']['puncak_sanggul_m']:.3f} m; "
          f"tinggi kepala {T['kepala']['puncak_m'] - S['dagu_z_m']:.3f} m")
    catat(f"telinga y {T['kepala']['telinga_m'][0]:.3f} z {T['kepala']['telinga_m'][1]:.3f}; sendi bahu y {B['y_bahu']:.3f}; "
          f"lebar rahang {T['kepala']['lebar_rahang_m'] * 100:.1f} cm, lebar di telinga {T['kepala']['lebar_telinga_m'] * 100:.1f} cm")
    catat(f"bidang potong kepala lewat {T['bidang_kepala_m']} (miring {S['miring_derajat']} derajat): cincin lebar "
          f"{ck['lebar'] * 100:.1f} tebal {ck['tebal'] * 100:.1f} cm, pusat y {ck['pusat'][1]:.3f}")
    catat(f"bidang potong badan lewat {T['bidang_badan_m']}: cincin badan asal lebar {cb['lebar'] * 100:.1f} tebal "
          f"{cb['tebal'] * 100:.1f} cm, pusat y {cb['pusat'][1]:.3f}; selisih lebar {(cb['lebar'] / ck['lebar'] - 1) * 100:+.0f} persen, "
          f"tebal {(cb['tebal'] / ck['tebal'] - 1) * 100:+.0f} persen, pusat geser {(p0_b[1] - cb['pusat'][1]) * 100:+.1f} cm")

    tmp = os.path.join(tempfile.gettempdir(), "nusantara-sambung")
    os.makedirs(tmp, exist_ok=True)
    folder = os.path.join(akar, a.pratinjau) if a.pratinjau else tmp
    os.makedirs(folder, exist_ok=True)
    kam = siapkan_render((900, 900))
    merah, kuning, hijau = bahan_garis("merah", (1, 0.05, 0.05)), bahan_garis("kuning", (1, 0.85, 0)), bahan_garis("hijau", (0, 0.8, 0.2))
    bantu = [
        garis("potong_kepala", lingkar_bidang(p0_k, n, 0.085), merah, tutup=True),
        garis("potong_badan", lingkar_bidang(p0_b, n, 0.085), kuning, tutup=True),
        garis("tegak_bahu", [(0.6, B["y_bahu"], 1.15), (0.6, B["y_bahu"], 1.80)], merah),
        garis("telinga", [(0.6, T["kepala"]["telinga_m"][0] - 0.012, T["kepala"]["telinga_m"][1]),
                          (0.6, T["kepala"]["telinga_m"][0] + 0.012, T["kepala"]["telinga_m"][1])], hijau, tebal=0.002),
        garis("pangkal", lingkar_bidang(p0_b - n * S["pangkal_m"], n, 0.12), hijau, tutup=True),
    ]
    # Dua lapis: badan (kepala lama masih ada) dengan garis, lalu kepala baru sendiri; kepala baru ditumpangkan
    # 55 persen supaya tidak tertutup kepala lama.
    sasaran = (B["x0"], B["y_bahu"], S["dagu_z_m"])
    scene = bpy.context.scene
    for nama, arah in (("depan", (0, -1, 0)), ("samping", (1, 0, 0))):
        path = os.path.join(folder, f"{a.nama}-tumpang-{nama}.png")
        la, lb = os.path.join(tmp, f"lapis-badan-{nama}.png"), os.path.join(tmp, f"lapis-kepala-{nama}.png")
        kepala.hide_render = True
        scene.render.film_transparent = False
        scene.render.image_settings.color_mode = "RGB"
        render(kam, sasaran, arah, 0.72, la)
        kepala.hide_render, badan.hide_render = False, True
        for o in bantu:
            o.hide_render = True
        scene.render.film_transparent = True
        scene.render.image_settings.color_mode = "RGBA"
        render(kam, sasaran, arah, 0.72, lb)
        badan.hide_render = False
        for o in bantu:
            o.hide_render = False
        A_, B_ = muat_px(la), muat_px(lb)
        al = B_[:, :, 3:4] * 0.55
        gab = A_.copy()
        gab[:, :, :3] = A_[:, :, :3] * (1 - al) + B_[:, :, :3] * al
        gab[:, :, 3] = 1.0
        simpan_px(gab, path)
        catat("tumpang", path)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    for o in bantu:
        o.hide_render = True

    # Siluet untuk tumpang_konsep.py: leher badan dirampingkan, kepala lama dibuang, kepala baru dipotong.
    co_b, lapor_leher = bentuk_leher(koordinat(badan), Tp, S, T)
    pasang_koordinat(badan, co_b)
    perbaiki_arah(badan, lambda c: wilayah_pangkal(c, S, T))
    cb2 = penampang(koordinat(badan), segitiga(badan), p0_b, n, S["radius_leher_m"])
    dibuang, di_atas = potong_badan(badan, S, T)
    potong_kepala(kepala, T)
    T["cincin_badan"] = bulat(cb2)
    T["selisih_persen"] = {"lebar": round((cb2["lebar"] / ck["lebar"] - 1) * 100, 1), "tebal": round((cb2["tebal"] / ck["tebal"] - 1) * 100, 1)}
    # Sumbu leher dari samping: pusat irisan badan 3 cm di bawah bidang potong badan ke pusat cincin kepala.
    bawah = penampang(koordinat(badan), segitiga(badan), p0_b - np.array([0, 0, 0.03]), np.array([0, 0, 1.0]), S["radius_leher_m"] + 0.02)
    if bawah:
        dy, dz = ck["pusat"][1] - bawah["pusat"][1], ck["pusat"][2] - bawah["pusat"][2]
        T["sumbu_leher_derajat"] = round(math.degrees(math.atan2(-dy, dz)), 1)     # positif = condong ke depan
    T["telinga_dari_bahu_m"] = round(T["kepala"]["telinga_m"][0] - B["y_bahu"], 4)
    catat(f"setelah leher badan dirampingkan ({lapor_leher['verteks_digeser']} verteks): cincin badan lebar {cb2['lebar'] * 100:.1f} tebal "
          f"{cb2['tebal'] * 100:.1f} cm; selisih terhadap cincin kepala {T['selisih_persen']} persen; "
          f"muka kepala lama dibuang {dibuang} dari {di_atas} di atas bidang")
    catat(f"sumbu leher {T.get('sumbu_leher_derajat')} derajat dari tegak (positif = ke depan); telinga "
          f"{T['telinga_dari_bahu_m'] * 100:+.1f} cm dari garis sendi bahu (negatif = di depan)")
    tinggi = float(max(koordinat(kepala)[:, 2].max(), koordinat(badan)[:, 2].max()))
    T["tinggi_total_m"] = round(tinggi, 4)
    kam = siapkan_render((1000, 1400), transparan=True)
    ortho = 1.4 * tinggi * 1.06 / 1.4
    for nama, arah in (("depan", (0, -1, 0)), ("samping", (1, 0, 0))):
        path = os.path.join(tmp, f"{a.nama}-siluet-{nama}.png")
        render(kam, (B["x0"], 0.03, tinggi / 2), arah, ortho, path)
        catat("siluet", path)
    T["siluet"] = {"ortho_m": round(ortho, 4), "tinggi_px": 1400, "folder": tmp}
    catat(f"tinggi total {tinggi:.3f} m")
    if a.keluar:
        bpy.ops.object.select_all(action="DESELECT")
        badan.select_set(True)
        kepala.select_set(True)
        bpy.context.view_layer.objects.active = badan
        bpy.ops.export_scene.gltf(filepath=os.path.join(akar, a.keluar), export_format="GLB", use_selection=True, export_apply=True,
                                  export_yup=True, export_materials="EXPORT", export_animations=False, export_skins=False)
        catat(f"model sementara (belum disambung) diekspor ke {a.keluar}")
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)


# ---------- sambung ----------

def bawaan_sambung(S):
    for k, v in {
        "tepi_min_m": 0.006, "cocok_derajat": 2.5, "ruas": 3, "singgung": 0.33, "sudut_singgung_maks": 35.0,
        "halus_pita_iterasi": 2, "halus_pita_faktor": 0.5,
        "kepala_skala_uv": 1.8, "pack_margin": 0.004, "ukuran": 2048,
        "tali": {"aktif": True, "segmen": 44, "sisi": 8, "tinggi_m": 0.007, "tebal_m": 0.0032, "celah_m": 0.0008,
                 "halus_iterasi": 3, "warna_srgb": [58, 40, 28]},
        "tinggi_akhir_m": 1.68,
    }.items():
        S.setdefault(k, v)


def cincin_di_bidang(bm, p0, n, tol=2e-5):
    """Cincin tepi terbuka yang verteksnya terletak di bidang (p0, n): daftar loop, tiap loop daftar verteks berurutan."""
    di = lambda v: abs((v.co - p0).dot(n)) < tol
    es = [e for e in bm.edges if e.is_boundary and di(e.verts[0]) and di(e.verts[1])]
    tet = {}
    for e in es:
        for v in e.verts:
            tet.setdefault(v, []).append(e)
    sisa, loops = set(es), []
    while sisa:
        e = sisa.pop()
        v0, v = e.verts
        urut, tertutup = [v0, v], False
        while True:
            lanjut = [x for x in tet[v] if x in sisa]
            if not lanjut:
                break
            e2 = lanjut[0]
            sisa.discard(e2)
            v = e2.other_vert(v)
            if v is v0:
                tertutup = True
                break
            urut.append(v)
        loops.append((urut, tertutup))
    return loops


def tepi_terbuka(bm, pusat, n, radius=0.13, tebal=0.045):
    """Tepi yang hanya dipakai satu muka pada topologi las posisi, di sekitar sambungan: (jumlah, daftar titik
    tengah). Dipakai untuk memastikan tidak ada lubang yang tertinggal."""
    hit = {}
    for f in bm.faces:
        c = f.calc_center_median()
        if abs((c - pusat).dot(n)) > tebal or math.hypot(c.x - pusat.x, c.y - pusat.y) > radius:
            continue
        ks = [(round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5)) for v in f.verts]
        for i in range(len(ks)):
            a_, b_ = ks[i], ks[(i + 1) % len(ks)]
            if a_ != b_:
                k = (a_, b_) if a_ < b_ else (b_, a_)
                hit[k] = hit.get(k, 0) + 1
    buka = [k for k, v in hit.items() if v == 1]
    # tepi di batas daerah pemeriksaan bukan lubang: hanya yang kedua ujungnya jauh di dalam daerah
    dalam = []
    for a_, b_ in buka:
        m = (Vector(a_) + Vector(b_)) / 2
        if abs((m - pusat).dot(n)) < tebal - 0.012 and math.hypot(m.x - pusat.x, m.y - pusat.y) < radius - 0.03:
            dalam.append([round(x, 4) for x in m])
    return len(dalam), dalam


def ukuran_cincin(vs):
    c = np.array([v.co[:] for v in vs])
    return {"verteks": len(vs), "lebar": float(np.ptp(c[:, 0])), "tebal": float(np.ptp(c[:, 1])),
            "pusat": [float((c[:, 0].min() + c[:, 0].max()) / 2), float((c[:, 1].min() + c[:, 1].max()) / 2), float(c[:, 2].mean())]}


def urutkan(vs, pusat):
    """Urutan berlawanan jarum jam dilihat dari atas, sudut naik dari -pi."""
    c = np.array([v.co[:] for v in vs])
    x, y = c[:, 0] - pusat[0], c[:, 1] - pusat[1]
    if 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y) < 0:
        vs, x, y = vs[::-1], x[::-1], y[::-1]
    sudut = np.arctan2(y, x)
    mulai = int(np.argmin(sudut))
    return vs[mulai:] + vs[:mulai], np.roll(sudut, -mulai)


def rapikan_cincin(bm, vs, pj_min, pusat=None):
    """Gabung verteks cincin yang berjarak kurang dari pj_min (hanya di tepi potongan). Bawaan: di titik tengah.
    Dengan `pusat` (cara "luar"): di verteks yang lebih jauh dari pusat cincin, supaya rentetan verteks rapat (ujung
    helai rambut di tengkuk) tidak memotong sudut dan mengecilkan penampang."""
    vs = list(vs)
    berubah = True
    while berubah and len(vs) > 12:
        berubah = False
        for i in range(len(vs)):
            va, vb = vs[i], vs[(i + 1) % len(vs)]
            if (va.co - vb.co).length < pj_min:
                if pusat is None:
                    di = (va.co + vb.co) / 2
                else:
                    ja = math.hypot(va.co.x - pusat[0], va.co.y - pusat[1])
                    jb = math.hypot(vb.co.x - pusat[0], vb.co.y - pusat[1])
                    di = (va.co if ja >= jb else vb.co).copy()
                bmesh.ops.pointmerge(bm, verts=[va, vb], merge_co=di)
                vs.pop((i + 1) % len(vs))
                berubah = True
                break
    return vs


def pasangkan(bm, ra, rb, pusat_a, pusat_b, tol):
    """Samakan kedua cincin: tiap verteks satu cincin mendapat pasangan di cincin lain pada sudut yang sama
    (verteks yang sudah ada dalam tol dipakai; kalau tidak ada, verteks baru disisipkan di tepi cincin, tanpa
    mengubah bentuknya). ra dan rb sudah terurut keliling (urutkan). Mengembalikan dua daftar verteks sama
    panjang, terurut menurut sudut."""
    def daftar_sudut(vs, c):
        # sudut naik sepanjang urutan cincin; lekuk kecil yang membuat sudut mundur dijepit supaya tetap naik
        out, sebelum = [], -1e9
        for v in vs:
            th = max(math.atan2(v.co.y - c[1], v.co.x - c[0]), sebelum + 1e-4)
            out.append([th, v])
            sebelum = th
        return out

    def beda(a_, b_):
        return abs(math.atan2(math.sin(a_ - b_), math.cos(a_ - b_)))

    def sisip(daftar, c, th):
        sd = [t for t, _ in daftar]
        k = int(np.searchsorted(sd, th))
        v0, v1 = daftar[k - 1][1], daftar[k % len(daftar)][1]
        e = bm.edges.get((v0, v1))
        d = (math.cos(th), math.sin(th))
        px, py = v0.co.x - c[0], v0.co.y - c[1]
        qx, qy = v1.co.x - v0.co.x, v1.co.y - v0.co.y
        penyebut = qx * d[1] - qy * d[0]
        t = -(px * d[1] - py * d[0]) / penyebut if abs(penyebut) > 1e-12 else 0.5
        _e, baru = bmesh.utils.edge_split(e, v0, min(max(t, 0.03), 0.97))
        bmesh.ops.triangulate(bm, faces=[f for f in baru.link_faces if len(f.verts) > 3])
        daftar.insert(k, [th, baru])
        return baru

    da, db = daftar_sudut(ra, pusat_a), daftar_sudut(rb, pusat_b)
    asal_a, asal_b = list(da), list(db)
    kolom, terpakai, tanpa = [], set(), []
    for th, va in asal_a:
        calon = min(asal_b, key=lambda x: beda(x[0], th))
        if beda(calon[0], th) < tol and calon[1] not in terpakai:
            terpakai.add(calon[1])
            kolom.append((th, va, calon[1]))
        else:
            tanpa.append((th, va))
    for th, va in tanpa:
        kolom.append((th, va, sisip(db, pusat_b, th)))
    for th, vb in asal_b:
        if vb not in terpakai:
            kolom.append((th, sisip(da, pusat_a, th), vb))
    # Urutan kolom diambil dari urutan cincin a sesudah penyisipan; pasangannya dari peta kolom.
    pasangan = {k[1]: k[2] for k in kolom}
    ra2 = [v for _, v in da]
    rb2 = [pasangan[v] for v in ra2]
    urut_b = {v: i for i, (_, v) in enumerate(db)}
    lompat = sum(1 for i in range(len(rb2)) if (urut_b[rb2[(i + 1) % len(rb2)]] - urut_b[rb2[i]]) % len(rb2) != 1)
    return ra2, rb2, lompat


def singgung(vs, di_cincin, arah_bawaan, ke_atas, batas_derajat):
    """Arah permukaan di tiap verteks cincin (menuju sambungan untuk badan, menjauhi untuk kepala),
    diratakan sepanjang cincin dan dibatasi sudutnya dari arah sumbu."""
    t = []
    for v in vs:
        tet = [e.other_vert(v).co for e in v.link_edges if e.other_vert(v) not in di_cincin]
        if tet:
            rata = sum(tet, Vector()) / len(tet)
            d = (v.co - rata) if ke_atas else (rata - v.co)
            t.append(np.array(d.normalized()[:]) if d.length > 1e-9 else arah_bawaan)
        else:
            t.append(arah_bawaan)
    t = np.array(t)
    for _ in range(2):
        t = (t + np.roll(t, 1, axis=0) + np.roll(t, -1, axis=0)) / 3
    t /= np.linalg.norm(t, axis=1)[:, None]
    cos_b = math.cos(math.radians(batas_derajat))
    for i in range(len(t)):
        c = float(t[i] @ arah_bawaan)
        if c < cos_b:       # terlalu miring: tarik ke kerucut batas
            tegak = t[i] - c * arah_bawaan
            tegak /= max(np.linalg.norm(tegak), 1e-9)
            t[i] = cos_b * arah_bawaan + math.sqrt(1 - cos_b * cos_b) * tegak
    return t


def bahan_emisi(mat, mode, img=None, uv=None, warna=(0.5, 0.5, 0.5)):
    """'gambar': emisi dari gambar lewat UV lama; 'tetap': warna tetap. Mengembalikan (nt, emisi)."""
    mat.use_nodes = True
    nt = mat.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    if mode == "gambar":
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = uv
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Cubic"
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
    else:
        emisi.inputs["Color"].default_value = (*warna, 1.0)
    return nt, emisi


def gambar_bahan(mat, jenis):
    nt = mat.node_tree
    bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
    soket = bsdf.inputs["Base Color"] if jenis == "warna" else bsdf.inputs["Normal"]
    dilihat, tumpukan = set(), [soket]
    while tumpukan:
        sk = tumpukan.pop()
        for l in sk.links:
            nd = l.from_node
            if nd.name in dilihat:
                continue
            dilihat.add(nd.name)
            if nd.type == "TEX_IMAGE":
                return nd.image
            tumpukan.extend(nd.inputs)
    return None


def bake_emit(obj, img, margin):
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.name = "bake_target"
        for nd in nt.nodes:
            nd.select = False
        node.select = True
        nt.nodes.active = node
    pilih_hanya(obj)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = True
    bpy.ops.object.bake(type="EMIT")
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        nt.nodes.remove(nt.nodes["bake_target"])


def simpan_png(img, path, enam_belas=False):
    scene = bpy.context.scene
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "16" if enam_belas else "8"
    if enam_belas:
        img.save_render(path, scene=scene)
    else:
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
    scene.render.image_settings.color_depth = "8"


def jpeg_dari_png(path_png, path_jpg, nama, ruang, kualitas=88):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = kualitas
    scene.render.image_settings.color_mode = "RGB"
    src = bpy.data.images.load(path_png)
    src.colorspace_settings.name = ruang
    src.pixels[0]
    src.scale(src.size[0], src.size[1])
    src.file_format = "JPEG"
    src.filepath_raw = path_jpg
    src.save()
    bpy.data.images.remove(src)
    im = bpy.data.images.load(path_jpg)
    im.name = nama
    im.colorspace_settings.name = ruang
    return im


def normal_las(obj, tol=1e-5):
    """Normal halus per posisi (verteks yang berimpit di jahitan UV dianggap satu), dipasang sebagai normal
    khusus. Hasilnya sama dengan shade smooth pada mesh yang dilas, tanpa me-merge mesh."""
    me = obj.data
    co = koordinat(obj)
    vi = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", vi)
    tri = vi.reshape(-1, 3)
    pt = co[tri]
    fn = np.cross(pt[:, 1] - pt[:, 0], pt[:, 2] - pt[:, 0])
    pj = np.linalg.norm(fn, axis=1)
    fn = fn / np.maximum(pj, 1e-20)[:, None]
    _, wid = np.unique(np.round(co / tol).astype(np.int64), axis=0, return_inverse=True)
    wid = wid.ravel()
    acc = np.zeros((wid.max() + 1, 3))
    for c in range(3):
        e1 = pt[:, (c + 1) % 3] - pt[:, c]
        e2 = pt[:, (c + 2) % 3] - pt[:, c]
        cs = np.einsum("ij,ij->i", e1, e2) / np.maximum(np.linalg.norm(e1, axis=1) * np.linalg.norm(e2, axis=1), 1e-20)
        # segitiga berluas hampir nol (hasil gabung verteks atau lipatan yang diruntuhkan) tidak ikut: arah
        # normalnya acak dan akan menggelapkan muka di sekitarnya
        sudut = np.arccos(np.clip(cs, -1, 1)) * (pj > 2e-8)
        np.add.at(acc, wid[tri[:, c]], fn * sudut[:, None])
    acc /= np.maximum(np.linalg.norm(acc, axis=1), 1e-20)[:, None]
    me.normals_split_custom_set(acc[wid[vi]].tolist())
    me.update()


def bahan_logam(nama, warna_srgb, metallic, roughness):
    mat = bpy.data.materials.new(nama)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*[(c / 255) ** 2.2 for c in warna_srgb], 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def kalung_gantung(model, G, T, f, mat):
    """Kalung gantung sebagai objek mesh terpisah: tabung tipis yang rebah di kulit. Dari depan bentuknya mengikuti
    gambar konsep: parabola dari titik terendah di dada (z_depan_m) naik ke kedua sisi sampai (x_atas_m, z_atas_m),
    lalu melingkar lewat pangkal leher ke tengkuk (z_belakang_m, sedikit di bawah pita penutup sambungan).
    Angka dalam meter pada model akhir. Titik jalur dicari dengan sinar ke kulit (bahan pertama saja)."""
    me = model.data
    co, tri = koordinat(model), segitiga(model)
    pi_ = np.empty(len(me.loop_triangles), dtype=np.int64)
    me.loop_triangles.foreach_get("polygon_index", pi_)
    mi = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get("material_index", mi)
    bvh = BVHTree.FromPolygons(co.tolist(), tri[mi[pi_] == 0].tolist())
    x0, y_ax = T["badan"]["x0"] * f, T["bidang_badan_m"][1] * f
    z_f, z_t, z_b, x_t = G["z_depan_m"], G["z_atas_m"], G["z_belakang_m"], G["x_atas_m"]
    nf, nb = 25, 24
    depan = []
    for i in range(nf):
        x = -x_t + 2 * x_t * i / (nf - 1)
        z = z_f + (z_t - z_f) * (abs(x) / x_t) ** G.get("pangkat", 2.0)
        kena = bvh.ray_cast(Vector((x0 + x, -1.0, z)), Vector((0, 1, 0)), 2.0)
        if kena[0] is None:
            raise SystemExit(f"kalung gantung: sinar depan meleset di x {x:.3f} z {z:.3f}")
        depan.append(np.array(kena[0][:]))

    def belakang(tanda, P_t, sampai):
        th_t = math.atan2(abs(P_t[0] - x0), -(P_t[1] - y_ax))
        hasil_ = []
        for j in range(1, sampai + 1):
            u_ = j / nb
            th = th_t + (math.pi - th_t) * u_
            # naik cepat ke tinggi tengkuk (dalam pecahan `naik` pertama busur), lalu tetap: di samping dan belakang
            # kalung merapat ke pangkal leher, tidak melebar ke atas otot bahu
            v_ = min(1.0, u_ / G.get("naik", 0.3))
            z = z_t + (z_b - z_t) * v_ * v_ * (3 - 2 * v_)
            d = np.array([tanda * math.sin(th), -math.cos(th), 0.0])
            kena = bvh.ray_cast(Vector(np.array([x0, y_ax, z]) + d * 0.35), Vector(-d), 0.35)
            if kena[0] is not None:
                hasil_.append(np.array(kena[0][:]))
        return hasil_

    kanan = belakang(1.0, depan[-1], nb)            # termasuk tengkuk
    kiri = belakang(-1.0, depan[0], nb - 1)
    jalur = np.array(depan + kanan + kiri[::-1])
    # sampel ulang berjarak sama sepanjang jalur tertutup
    K = G["segmen"]
    tutup = np.vstack([jalur, jalur[:1]])
    pj = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(tutup, axis=0), axis=1))])
    s_ = np.linspace(0, pj[-1], K, endpoint=False)
    titik = np.stack([np.interp(s_, pj, tutup[:, k]) for k in range(3)], axis=1)
    for _ in range(G.get("halus_iterasi", 2)):
        titik = (np.roll(titik, 1, axis=0) + 2 * titik + np.roll(titik, -1, axis=0)) / 4
    # tempel ke kulit, lalu angkat sejauh jari-jari tabung dan celah
    kulit, nrm = np.zeros_like(titik), np.zeros_like(titik)
    for i in range(K):
        kena = bvh.find_nearest(Vector(titik[i].tolist()))
        kulit[i], nrm[i] = np.array(kena[0][:]), np.array(kena[1][:])
    for _ in range(3):
        nrm = np.roll(nrm, 1, axis=0) + 2 * nrm + np.roll(nrm, -1, axis=0)
        nrm /= np.linalg.norm(nrm, axis=1)[:, None]
    r = G["jari_m"]
    pusat = kulit + nrm * (r + G["celah_m"])
    for _ in range(1):
        pusat = (np.roll(pusat, 1, axis=0) + 2 * pusat + np.roll(pusat, -1, axis=0)) / 4
    # titik yang sesudah dihaluskan terlalu dekat ke kulit didorong keluar lagi
    for i in range(K):
        kena = bvh.find_nearest(Vector(pusat[i].tolist()))
        arah_ = pusat[i] - np.array(kena[0][:])
        jarak = float(np.linalg.norm(arah_))
        luar = arah_ / jarak if jarak > 1e-6 and arah_ @ np.array(kena[1][:]) > 0 else np.array(kena[1][:])
        if jarak < r + G["celah_m"] * 0.5 or arah_ @ np.array(kena[1][:]) <= 0:
            pusat[i] = np.array(kena[0][:]) + luar * (r + G["celah_m"])
    sisi = G["sisi"]
    bm = bmesh.new()
    cincin = []
    for i in range(K):
        t = pusat[(i + 1) % K] - pusat[i - 1]
        t /= np.linalg.norm(t)
        nn = nrm[i] - (nrm[i] @ t) * t
        nn /= np.linalg.norm(nn)
        bb = np.cross(t, nn)
        cincin.append([bm.verts.new((pusat[i] + r * (math.cos(2 * math.pi * q / sisi) * nn + math.sin(2 * math.pi * q / sisi) * bb)).tolist())
                       for q in range(sisi)])
    for i in range(K):
        i2 = (i + 1) % K
        for q in range(sisi):
            q2 = (q + 1) % sisi
            f_ = bm.faces.new((cincin[i][q], cincin[i2][q], cincin[i2][q2], cincin[i][q2]))
            f_.smooth = True
    bm.normal_update()
    tengah_ = Vector(pusat.mean(axis=0).tolist())
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me_k = bpy.data.meshes.new(G.get("nama", "kalung_gantung"))
    bm.to_mesh(me_k)
    bm.free()
    me_k.materials.append(mat)
    ob = bpy.data.objects.new(G.get("nama", "kalung_gantung"), me_k)
    bpy.context.scene.collection.objects.link(ob)
    for p_ in me_k.polygons:
        p_.use_smooth = True
    panjang = float(np.linalg.norm(np.diff(np.vstack([pusat, pusat[:1]]), axis=0), axis=1).sum())
    lapor = {"segitiga": len(me_k.polygons), "panjang_m": round(panjang, 3),
             "z_depan_m": round(float(pusat[:, 2].min()), 4), "z_belakang_m": round(float(pusat[np.argmax(pusat[:, 1]), 2]), 4),
             "lebar_m": round(float(np.ptp(pusat[:, 0])), 4), "y_depan_m": round(float(pusat[:, 1].min()), 4)}
    return ob, lapor


def tahap_sambung(a, akar, data, P, badan, kepala):
    S, T, B, Tp = tempatkan(badan, kepala, P)
    bawaan_sambung(S)
    nV, p0_k, p0_b = Vector(T["normal"]), Vector(T["bidang_kepala_m"]), Vector(T["bidang_badan_m"])
    n = np.array(T["normal"])
    u = np.array(T["arah_sumbu"])
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-sambung")
    os.makedirs(tmp, exist_ok=True)
    folder_t = os.path.join(akar, a.tekstur)
    os.makedirs(folder_t, exist_ok=True)

    co_w, lapor_leher = bentuk_leher(koordinat(badan), Tp, S, T)
    pasang_koordinat(badan, co_w)
    lapor_leher["muka_dibalik"], _sisa = perbaiki_arah(badan, lambda c: wilayah_pangkal(c, S, T))
    mat_tambal = bpy.data.materials.new("tambal")
    badan.data.materials.append(mat_tambal)
    lapor_leher["tambalan"] = tambal_kantong(badan, lambda c: wilayah_pangkal(c, S, T), len(badan.data.materials) - 1)
    catat(f"leher badan: {lapor_leher}")
    # Tengkuk kepala: serpihan helai rambut di garis rambut bawah dan lipatan di belakang rahang dibuka (kalau
    # tengkuk_dulu, sudah dikerjakan di tempatkan sebelum cincin kepala diukur).
    if not S.get("tengkuk_dulu"):
        awal_k, dibalik_k, sisa_k = rapikan_tengkuk(kepala, S, T["kepala"]["telinga_m"][0])
        catat(f"tengkuk kepala: muka terbalik {awal_k}, dibalik {dibalik_k}, sisa {sisa_k}")
    else:
        awal_k, dibalik_k, sisa_k = T["tengkuk"]
    # Sumbu leher dari samping (pusat irisan badan 3 cm di bawah bidang potong badan ke pusat cincin kepala) dan
    # letak telinga terhadap garis tegak sendi bahu, dicatat juga di tahap ini.
    bawah = penampang(koordinat(badan), segitiga(badan), np.array(p0_b[:]) - np.array([0, 0, 0.03]), np.array([0, 0, 1.0]),
                      S["radius_leher_m"] + 0.02)
    if bawah:
        ck_ = T["cincin_kepala"]
        T["sumbu_leher_derajat"] = round(math.degrees(math.atan2(-(ck_["pusat"][1] - bawah["pusat"][1]), ck_["pusat"][2] - bawah["pusat"][2])), 1)
    T["telinga_dari_bahu_m"] = round(T["kepala"]["telinga_m"][0] - B["y_bahu"], 4)
    T["tinggi_total_m"] = round(float(max(koordinat(kepala)[:, 2].max(), koordinat(badan)[:, 2].max())), 4)
    dibuang, _ = potong_badan(badan, S, T)
    potong_kepala(kepala, T)
    for o in (badan, kepala):
        o.data.uv_layers[0].name = "UVMap"
    mat_badan, mat_kepala = badan.data.materials[0], kepala.data.materials[0]
    img = {"badan": (gambar_bahan(mat_badan, "warna"), gambar_bahan(mat_badan, "normal")),
           "kepala": (gambar_bahan(mat_kepala, "warna"), gambar_bahan(mat_kepala, "normal"))}
    seg_badan, seg_kepala = len(segitiga(badan)), len(segitiga(kepala))
    pilih_hanya(badan)
    kepala.select_set(True)
    bpy.ops.object.join()
    model = bpy.context.view_layer.objects.active
    model.name = a.nama
    mat_pita, mat_tali = bpy.data.materials.new("pita"), bpy.data.materials.new("tali")
    model.data.materials.append(mat_pita)
    model.data.materials.append(mat_tali)
    idx = {m.name: i for i, m in enumerate(model.data.materials)}
    i_badan, i_kepala, i_pita, i_tali = idx[mat_badan.name], idx[mat_kepala.name], idx["pita"], idx["tali"]

    bm = bmesh.new()
    bm.from_mesh(model.data)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    lay = bm.loops.layers.uv["UVMap"]
    # Las hanya verteks di kedua bidang potong (pecahan jahitan UV), supaya tiap cincin jadi satu loop tertutup.
    for p0 in (p0_b, p0_k):
        vs = [v for v in bm.verts if abs((v.co - p0).dot(nV)) < 2e-5]
        bmesh.ops.remove_doubles(bm, verts=vs, dist=2e-5)
    hasil = {}
    cincin = {}
    p_mid_awal = (p0_b + p0_k) / 2
    if os.environ.get("SAMBUNG_DEBUG"):
        catat(f"tepi terbuka sesudah potong dan las cincin: {tepi_terbuka(bm, p_mid_awal, nV)[0]}")
    for nama, p0 in (("badan", p0_b), ("kepala", p0_k)):
        loops = cincin_di_bidang(bm, p0, nV)
        loops.sort(key=lambda t: -len(t[0]))
        hasil[f"loop_{nama}"] = [{"verteks": len(l), "tertutup": t} for l, t in loops]
        if not loops or not loops[0][1]:
            raise SystemExit(f"cincin {nama} tidak tertutup: {hasil[f'loop_{nama}']}")
        if len(loops) > 1:
            catat(f"PERINGATAN: bidang potong {nama} menghasilkan {len(loops)} loop: {hasil[f'loop_{nama}']}; dipakai yang terbesar")
        cincin[nama] = loops[0][0]
    uk_b0, uk_k0 = ukuran_cincin(cincin["badan"]), ukuran_cincin(cincin["kepala"])
    # Cincin dirapikan (verteks yang terlalu rapat digabung), lalu disamakan: setiap kolom punya verteks di
    # kedua cincin pada sudut yang sama.
    luar_ = S.setdefault("gabung_cincin", "tengah") == "luar"
    rb0, _ = urutkan(rapikan_cincin(bm, cincin["badan"], S["tepi_min_m"], uk_b0["pusat"] if luar_ else None), uk_b0["pusat"])
    rk0, _ = urutkan(rapikan_cincin(bm, cincin["kepala"], S["tepi_min_m"], uk_k0["pusat"] if luar_ else None), uk_k0["pusat"])
    n_b1, n_k1 = len(rb0), len(rk0)
    if os.environ.get("SAMBUNG_DEBUG"):
        catat(f"tepi terbuka sesudah cincin dirapikan: {tepi_terbuka(bm, p_mid_awal, nV)[0]} (cincin {n_b1} + {n_k1})")
    rb, rk, lompat = pasangkan(bm, rb0, rk0, uk_b0["pusat"], uk_k0["pusat"], math.radians(S["cocok_derajat"]))
    if os.environ.get("SAMBUNG_DEBUG"):
        catat(f"tepi terbuka sesudah dipasangkan: {tepi_terbuka(bm, p_mid_awal, nV)[0]} (cincin 2 x {len(rb)})")
    N = len(rb)
    if lompat:
        catat(f"PERINGATAN: {lompat} kolom urutannya tidak sama di kedua cincin (pita bisa bersilang)")
    sb = np.array([math.atan2(v.co.y - uk_b0["pusat"][1], v.co.x - uk_b0["pusat"][0]) for v in rb])
    sk = np.array([math.atan2(v.co.y - uk_k0["pusat"][1], v.co.x - uk_k0["pusat"][0]) for v in rk])
    beda_maks = float(np.degrees(np.abs(np.angle(np.exp(1j * (sb - sk)))).max()))
    # Cincin perantara: kurva Bezier dari cincin badan ke cincin kepala, menyinggung kedua permukaan.
    set_b, set_k = set(rb), set(rk)
    tb = singgung(rb, set_b, u, True, S["sudut_singgung_maks"])
    tk = singgung(rk, set_k, u, False, S["sudut_singgung_maks"])
    ruas = S["ruas"]
    baris = [rb]
    for j in range(1, ruas):
        t = j / ruas
        vs = []
        for i in range(N):
            P0, P3 = np.array(rb[i].co[:]), np.array(rk[i].co[:])
            L = np.linalg.norm(P3 - P0)
            P1, P2 = P0 + tb[i] * L * S["singgung"], P3 - tk[i] * L * S["singgung"]
            pt = (1 - t) ** 3 * P0 + 3 * (1 - t) ** 2 * t * P1 + 3 * (1 - t) * t * t * P2 + t ** 3 * P3
            vs.append(bm.verts.new(pt.tolist()))
        baris.append(vs)
    baris.append(rk)
    keliling = sum((rb[i].co - rb[(i + 1) % N].co).length for i in range(N))
    tinggi_pita = float(np.mean([(rk[i].co - rb[i].co).length for i in range(N)]))
    muka_pita = []
    for j in range(ruas):
        for i in range(N):
            i2 = (i + 1) % N
            f = bm.faces.new((baris[j][i], baris[j][i2], baris[j + 1][i2], baris[j + 1][i]))
            f.material_index = i_pita
            f.smooth = True
            for l, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                l[lay].uv = (2.0 + ii / N * keliling, 2.0 + jj / ruas * tinggi_pita)
            muka_pita.append(f)
    # Arah muka pita: keluar dari sumbu.
    pusat_pita = (Vector(uk_b0["pusat"]) + Vector(uk_k0["pusat"])) / 2
    bm.normal_update()
    keluar = sum(1 for f in muka_pita if f.normal.dot(f.calc_center_median() - pusat_pita) > 0)
    if keluar < len(muka_pita) / 2:
        bmesh.ops.reverse_faces(bm, faces=muka_pita)
    # Haluskan hanya cincin perantara.
    tengah = [v for vs in baris[1:-1] for v in vs]
    for _ in range(S["halus_pita_iterasi"]):
        baru = {}
        for v in tengah:
            tet = [e.other_vert(v).co for e in v.link_edges]
            baru[v] = v.co.lerp(sum(tet, Vector()) / len(tet), S["halus_pita_faktor"])
        for v, c in baru.items():
            v.co = c
    # Muka di dekat sambungan yang menghadap ke dalam (terhadap arah keluar dari sumbu leher): penggabungan dan
    # penyisipan verteks cincin bisa membalik segitiga tipis di sebelahnya. Verteks bebasnya (bukan verteks
    # cincin atau pita) direlaksasi; yang tetap terbalik dilaporkan.
    set_tetap = set(rb) | set(rk) | set(tengah)
    p_mid = (p0_b + p0_k) / 2

    def menghadap_dalam():
        # dibandingkan dengan muka-muka tetangganya (bukan arah radial: bawah dagu memang menghadap bawah)
        out = []
        for f in bm.faces:
            if f.material_index == i_pita:
                continue
            c = f.calc_center_median()
            if abs((c - p_mid).dot(nV)) > 0.03 or math.hypot(c.x - p_mid.x, c.y - p_mid.y) > 0.12 or f.calc_area() < 1e-9:
                continue
            f.normal_update()
            ref = Vector()
            for v in f.verts:
                for g in v.link_faces:
                    if g is not f:
                        ref += g.normal * g.calc_area()
            if ref.length > 1e-12 and f.normal.dot(ref.normalized()) < 0.15:
                out.append(f)
        return out
    dalam_awal = len(menghadap_dalam())
    kunci_v = lambda v: (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
    for _ in range(8):
        buruk_f = menghadap_dalam()
        if not buruk_f:
            break
        # Verteks yang berimpit (pecahan jahitan UV) digerakkan bersama sebagai satu kelompok, supaya jahitan
        # tidak retak menjadi lubang.
        zona = [v for v in bm.verts if abs((v.co - p_mid).dot(nV)) < 0.05 and math.hypot(v.co.x - p_mid.x, v.co.y - p_mid.y) < 0.14]
        per_kunci = {}
        for v in zona:
            per_kunci.setdefault(kunci_v(v), []).append(v)
        kelompok = list(per_kunci.values())
        gid = {v: i for i, vs in enumerate(kelompok) for v in vs}
        tetap_g = {gid[v] for v in set_tetap if v in gid}
        tet_g = lambda g: {gid[e.other_vert(v)] for v in kelompok[g] for e in v.link_edges if e.other_vert(v) in gid} - {g}
        bebas_g = {gid[v] for f in buruk_f for v in f.verts if v in gid} - tetap_g
        bebas_g |= {t_ for g in list(bebas_g) for t_ in tet_g(g)} - tetap_g
        tet_bebas = {g: list(tet_g(g)) for g in bebas_g}
        for _ in range(6):
            baru_co = {g: kelompok[g][0].co.lerp(sum((kelompok[t_][0].co for t_ in ts), Vector()) / len(ts), 0.5)
                       for g, ts in tet_bebas.items() if ts}
            for g, c in baru_co.items():
                for v in kelompok[g]:
                    v.co = c
    dalam_akhir = menghadap_dalam()
    if os.environ.get("SAMBUNG_DEBUG"):
        for f in dalam_akhir:
            catat(f"menghadap dalam: bahan {f.material_index}, luas {f.calc_area() * 1e6:.1f} mm2, pusat {[round(x, 3) for x in f.calc_center_median()]}, "
                  f"verteks tetap {sum(1 for v in f.verts if v in set_tetap)}, jarak bidang {[round((v.co - p_mid).dot(nV) * 1000, 1) for v in f.verts]} mm")
    uk_b, uk_k = ukuran_cincin(rb), ukuran_cincin(rk)
    n_buka, titik_buka = tepi_terbuka(bm, p_mid, nV)
    hasil["tepi_terbuka_dekat_sambungan"] = n_buka
    if n_buka:
        catat(f"PERINGATAN: {n_buka} tepi terbuka (lubang) di dekat sambungan: {titik_buka[:8]}")
    hasil["muka_menghadap_dalam_dekat_sambungan"] = [dalam_awal, len(dalam_akhir)]
    hasil.update({
        "cincin_badan": {"verteks_asal": uk_b0["verteks"], "verteks_dirapikan": n_b1, "verteks": N, "lebar_m": round(uk_b["lebar"], 4), "tebal_m": round(uk_b["tebal"], 4)},
        "cincin_kepala": {"verteks_asal": uk_k0["verteks"], "verteks_dirapikan": n_k1, "verteks": N, "lebar_m": round(uk_k["lebar"], 4), "tebal_m": round(uk_k["tebal"], 4)},
        "selisih_persen": {"lebar": round((uk_b["lebar"] / uk_k["lebar"] - 1) * 100, 1), "tebal": round((uk_b["tebal"] / uk_k["tebal"] - 1) * 100, 1)},
        "pita": {"kolom": N, "cincin_perantara": ruas - 1, "segitiga": 2 * N * ruas, "tinggi_m": round(tinggi_pita, 4),
                 "keliling_m": round(keliling, 4), "beda_sudut_pasangan_maks_derajat": round(beda_maks, 1)},
        "kepala_lama_muka_dibuang": dibuang, "leher_badan": lapor_leher, "tengkuk_kepala_muka_terbalik": [awal_k, sisa_k],
    })
    catat(f"cincin badan {uk_b0['verteks']} verteks (dirapikan {n_b1}), cincin kepala {uk_k0['verteks']} verteks (dirapikan {n_k1}) "
          f"-> disamakan {N}; "
          f"badan lebar {uk_b['lebar'] * 100:.1f} tebal {uk_b['tebal'] * 100:.1f} cm, kepala lebar {uk_k['lebar'] * 100:.1f} tebal "
          f"{uk_k['tebal'] * 100:.1f} cm; selisih {hasil['selisih_persen']} persen; pita {ruas - 1} cincin perantara, tinggi "
          f"{tinggi_pita * 100:.1f} cm, beda sudut pasangan maks {beda_maks:.1f} derajat; muka menghadap dalam di dekat "
          f"sambungan {dalam_awal} -> {len(dalam_akhir)}")

    # Tali leher: pita lonjong mengikuti permukaan di bidang tengah sambungan.
    L_ = S["tali"]
    if L_["aktif"]:
        bm.normal_update()
        bvh = BVHTree.FromBMesh(bm)
        p_tengah = (np.array(p0_b[:]) + np.array(p0_k[:])) / 2
        K = L_["segmen"]
        pipih = L_.get("bentuk") == "pita"
        setengah_t = L_["tinggi_m"] / 2
        arah, jari, jari_a, jari_b = [], [], [], []

        def jari_di(pusat_, d_):
            kena_ = bvh.ray_cast(Vector(pusat_ + d_ * 0.3), Vector(-d_), 0.3)
            return (np.array(kena_[0][:]) - pusat_) @ d_ if kena_[0] is not None else np.nan

        for i in range(K):
            th = -math.pi / 2 + 2 * math.pi * i / K
            d = np.array([math.cos(th), math.sin(th), 0.0])
            d = d - (d @ n) * n
            d /= np.linalg.norm(d)
            arah.append(d)
            jari.append(jari_di(p_tengah, d))
            if pipih:
                jari_a.append(jari_di(p_tengah + n * setengah_t, d))
                jari_b.append(jari_di(p_tengah - n * setengah_t, d))

        def rapikan_jari(j_):
            j_ = np.array(j_)
            j_[np.isnan(j_)] = np.nanmean(j_)
            for _ in range(L_["halus_iterasi"]):
                j_ = np.maximum(j_, (j_ + np.roll(j_, 1) + np.roll(j_, -1)) / 3)   # tidak pernah masuk ke kulit
            return j_

        jari = rapikan_jari(jari)
        sisi = L_["sisi"]
        cincin_tali = []
        if pipih:
            # Pita pipih: sumbu tingginya mengikuti kemiringan kulit di antara tepi atas dan tepi bawah pita (di bawah
            # dagu kulit condong ke depan), supaya tepi pita tidak tenggelam atau melayang.
            jari_a, jari_b = rapikan_jari(jari_a), rapikan_jari(jari_b)
            for i in range(K):
                P_a = p_tengah + n * setengah_t + arah[i] * max(jari_a[i], jari[i] - 0.004)
                P_b = p_tengah - n * setengah_t + arah[i] * max(jari_b[i], jari[i] - 0.004)
                sumbu = (P_a - P_b) / np.linalg.norm(P_a - P_b)
                luar = arah[i] - (arah[i] @ sumbu) * sumbu
                luar /= np.linalg.norm(luar)
                tengah_kulit = np.maximum((P_a + P_b) / 2 @ luar, (p_tengah + arah[i] * jari[i]) @ luar)
                pusat = (P_a + P_b) / 2 + luar * (tengah_kulit - (P_a + P_b) / 2 @ luar + L_["celah_m"] + L_["tebal_m"] / 2)
                vs = []
                for q in range(sisi):
                    ph = 2 * math.pi * (q + 0.5) / sisi
                    cs, sn = math.cos(ph), math.sin(ph)
                    cs, sn = math.copysign(abs(cs) ** 0.3, cs), math.copysign(abs(sn) ** 0.3, sn)
                    vs.append(bm.verts.new((pusat + luar * (L_["tebal_m"] / 2) * cs + sumbu * setengah_t * sn).tolist()))
                cincin_tali.append(vs)
        else:
            for i in range(K):
                pusat = p_tengah + arah[i] * (jari[i] + L_["celah_m"] + L_["tebal_m"] / 2)
                vs = []
                for q in range(sisi):
                    ph = 2 * math.pi * q / sisi
                    vs.append(bm.verts.new((pusat + arah[i] * (L_["tebal_m"] / 2) * math.cos(ph) + n * (L_["tinggi_m"] / 2) * math.sin(ph)).tolist()))
                cincin_tali.append(vs)
        kel_tali = 2 * math.pi * float(np.mean(jari))
        kel_sisi = math.pi * (L_["tinggi_m"] + L_["tebal_m"]) / 2 * 2
        muka_tali = []
        for i in range(K):
            i2 = (i + 1) % K
            for q in range(sisi):
                q2 = (q + 1) % sisi
                f = bm.faces.new((cincin_tali[i][q], cincin_tali[i2][q], cincin_tali[i2][q2], cincin_tali[i][q2]))
                f.material_index = i_tali
                f.smooth = True
                for l, (ii, qq) in zip(f.loops, ((i, q), (i + 1, q), (i + 1, q + 1), (i, q + 1))):
                    l[lay].uv = (4.0 + ii / K * kel_tali, 4.0 + qq / sisi * kel_sisi)
                muka_tali.append(f)
        bm.normal_update()
        if sum(1 for f in muka_tali if f.normal.dot(f.calc_center_median() - Vector(p_tengah)) > 0) < len(muka_tali) / 2:
            bmesh.ops.reverse_faces(bm, faces=muka_tali)
        hasil["tali"] = {"segitiga": 2 * K * sisi, "jari_dari_sumbu_m": [round(float(jari.min()), 4), round(float(jari.max()), 4)],
                         "z_depan_m": round(float((p_tengah + arah[0] * jari[0])[2]), 4),
                         "z_belakang_m": round(float((p_tengah + arah[K // 2] * jari[K // 2])[2]), 4)}
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(model.data)
    bm.free()
    model.data.update()

    # Atlas baru: UV disalin, kepadatan disetarakan, kepala diberi bonus, pack tanpa rotasi.
    me = model.data
    me.uv_layers.new(name="UVBaru", do_init=True)
    me.uv_layers.active_index = me.uv_layers.find("UVBaru")
    pilih_hanya(model)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")
    bm = bmesh.new()
    bm.from_mesh(me)
    lay2 = bm.loops.layers.uv["UVBaru"]
    for f in bm.faces:
        if f.material_index in (i_kepala, i_pita):
            for l in f.loops:
                l[lay2].uv = l[lay2].uv * S["kepala_skala_uv"]
    bm.to_mesh(me)
    bm.free()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=False, margin=S["pack_margin"])
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers["UVBaru"].active_render = True

    # Bake A: warna dan normal lama ke atlas baru. Pita dan tali diberi warna tetap; warna akhirnya dari sambung_tekstur.py.
    Nn = S["ukuran"]
    tali_lin = tuple((c / 255) ** 2.2 for c in S["tali"]["warna_srgb"])
    path = lambda akhiran: os.path.join(folder_t, f"{a.nama}-sambung-{akhiran}.png")
    for jenis, ruang, tetap_pita, tetap_tali in (("warna", "sRGB", (0.45, 0.25, 0.16), tali_lin), ("normal", "Non-Color", (0.5, 0.5, 1.0), (0.5, 0.5, 1.0))):
        k_ = 0 if jenis == "warna" else 1
        for mat, bagian in ((mat_badan, "badan"), (mat_kepala, "kepala")):
            img[bagian][k_].colorspace_settings.name = ruang
            bahan_emisi(mat, "gambar", img[bagian][k_], "UVMap")
        bahan_emisi(mat_pita, "tetap", warna=tetap_pita)
        bahan_emisi(mat_tambal, "tetap", warna=tetap_pita)
        bahan_emisi(mat_tali, "tetap", warna=tetap_tali)
        out = bpy.data.images.new(f"bake_{jenis}", Nn, Nn, alpha=False)
        out.colorspace_settings.name = ruang
        bake_emit(model, out, 8)
        simpan_png(out, path("A-basecolor" if jenis == "warna" else "A-normal"))
        bpy.data.images.remove(out)
    # Data untuk sambung_tekstur.py (PNG 16 bit):
    #   data1: R bagian (0 badan, 0,25 tali, 0,5 pita, 0,65 tambal, 1 kepala), G jarak bertanda ke bidang tengah (+-0,1 m),
    #          B 0,55 + 0,45 * normal z (menghadap bawah < 0,55; texel kosong 0)
    #   data2: R sudut keliling sumbu leher (-pi..pi), G tinggi z (data_z), B jari-jari mendatar dari sumbu leher (data_r)
    p_tengah = (np.array(p0_b[:]) + np.array(p0_k[:])) / 2
    data_z, data_r = P.setdefault("data_z", [0.0, 1.8]), P.setdefault("data_r", [0.0, 0.6])
    bagian_nilai = {mat_badan.name: 0.0, "tali": 0.25, "pita": 0.5, "tambal": 0.65, mat_kepala.name: 1.0}
    for ke in (1, 2):
        for mat in model.data.materials:
            nt, emisi = bahan_emisi(mat, "tetap")
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            gab = nt.nodes.new("ShaderNodeCombineColor")
            def peta(sumber, a0, a1):
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = a0, a1
                mr.clamp = True
                nt.links.new(sumber, mr.inputs["Value"])
                return mr.outputs["Result"]
            pisah = nt.nodes.new("ShaderNodeSeparateXYZ")
            nt.links.new(geo.outputs["Position"], pisah.inputs["Vector"])
            if ke == 1:
                gab.inputs[0].default_value = bagian_nilai[mat.name]
                kurang = nt.nodes.new("ShaderNodeVectorMath")
                kurang.operation = "SUBTRACT"
                kurang.inputs[1].default_value = tuple(p_tengah)
                nt.links.new(geo.outputs["Position"], kurang.inputs[0])
                dot = nt.nodes.new("ShaderNodeVectorMath")
                dot.operation = "DOT_PRODUCT"
                dot.inputs[1].default_value = tuple(n)
                nt.links.new(kurang.outputs["Vector"], dot.inputs[0])
                nt.links.new(peta(dot.outputs["Value"], -0.1, 0.1), gab.inputs[1])
                nz = nt.nodes.new("ShaderNodeSeparateXYZ")
                nt.links.new(geo.outputs["Normal"], nz.inputs["Vector"])
                nzm = nt.nodes.new("ShaderNodeMath")
                nzm.operation = "MULTIPLY_ADD"
                nzm.inputs[1].default_value = 0.45
                nzm.inputs[2].default_value = 0.55
                nt.links.new(nz.outputs["Z"], nzm.inputs[0])
                nt.links.new(nzm.outputs["Value"], gab.inputs[2])
            else:
                def kurangi(sumber, nilai):
                    m_ = nt.nodes.new("ShaderNodeMath")
                    m_.operation = "SUBTRACT"
                    m_.inputs[1].default_value = nilai
                    nt.links.new(sumber, m_.inputs[0])
                    return m_.outputs["Value"]
                dx, dy = kurangi(pisah.outputs["X"], float(p_tengah[0])), kurangi(pisah.outputs["Y"], float(p_tengah[1]))
                at = nt.nodes.new("ShaderNodeMath")
                at.operation = "ARCTAN2"
                nt.links.new(dy, at.inputs[0])
                nt.links.new(dx, at.inputs[1])
                nt.links.new(peta(at.outputs["Value"], -math.pi, math.pi), gab.inputs[0])
                nt.links.new(peta(pisah.outputs["Z"], data_z[0], data_z[1]), gab.inputs[1])
                kw = [nt.nodes.new("ShaderNodeMath") for _ in range(4)]
                kw[0].operation = kw[1].operation = "MULTIPLY"
                kw[2].operation, kw[3].operation = "ADD", "SQRT"
                nt.links.new(dx, kw[0].inputs[0])
                nt.links.new(dx, kw[0].inputs[1])
                nt.links.new(dy, kw[1].inputs[0])
                nt.links.new(dy, kw[1].inputs[1])
                nt.links.new(kw[0].outputs["Value"], kw[2].inputs[0])
                nt.links.new(kw[1].outputs["Value"], kw[2].inputs[1])
                nt.links.new(kw[2].outputs["Value"], kw[3].inputs[0])
                nt.links.new(peta(kw[3].outputs["Value"], data_r[0], data_r[1]), gab.inputs[2])
            nt.links.new(gab.outputs["Color"], emisi.inputs["Color"])
        out = bpy.data.images.new(f"data{ke}", Nn, Nn, alpha=False, float_buffer=True)
        out.colorspace_settings.name = "Non-Color"
        bake_emit(model, out, 0)
        simpan_png(out, path(f"data{ke}"), enam_belas=True)
        bpy.data.images.remove(out)
    catat("bake warna, normal, dan data ke atlas baru selesai")

    # Material akhir (tekstur bake A sebagai pengisi; warna akhir dipasang tekstur_pasang.py), skala akhir, normal.
    me.uv_layers.remove(me.uv_layers["UVMap"])
    me.uv_layers[0].name = "UVMap"
    mi_lama = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get("material_index", mi_lama)
    muka_tali = mi_lama == i_tali
    me.materials.clear()
    mat = bpy.data.materials.new("karakter")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = jpeg_dari_png(path("A-basecolor"), os.path.join(tmp, f"{a.nama}_basecolor.jpg"), f"{a.nama}_basecolor", "sRGB")
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    texn = nt.nodes.new("ShaderNodeTexImage")
    texn.image = jpeg_dari_png(path("A-normal"), os.path.join(tmp, f"{a.nama}_normal.jpg"), f"{a.nama}_normal", "Non-Color")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(texn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    me.materials.append(mat)
    for poly in me.polygons:
        poly.material_index = 0
    # Penutup sambungan dari logam (kalung emas): bahan kedua dengan nama tetap, bukan warna di atlas. Nama berawalan
    # "emas" dikenali gabung_animasi.py (bobot Neck dan Spine2) dan model-wijaya.ts (pantulan lingkungan logam).
    mat_logam = None
    if S["tali"]["aktif"] and S["tali"].get("bahan"):
        mat_logam = bahan_logam(S["tali"]["bahan"], S["tali"]["warna_srgb"], S["tali"].get("metallic", 1.0), S["tali"].get("roughness", 0.35))
        me.materials.append(mat_logam)
        for i_ in np.nonzero(muka_tali)[0]:
            me.polygons[int(i_)].material_index = 1
    co = koordinat(model)
    tinggi = float(co[:, 2].max() - co[:, 2].min())
    f_akhir = S["tinggi_akhir_m"] / tinggi if S["tinggi_akhir_m"] else 1.0
    co = co * f_akhir
    co[:, 2] -= co[:, 2].min()
    pasang_koordinat(model, co)
    normal_las(model)
    ob_kalung = None
    Gk = S.get("kalung_gantung")
    if Gk and Gk.get("aktif"):
        if mat_logam is None:
            mat_logam = bahan_logam(Gk.get("bahan", "emas_kalung"), Gk.get("warna_srgb", [201, 160, 74]), 1.0, 0.35)
        ob_kalung, hasil["kalung_gantung"] = kalung_gantung(model, Gk, T, f_akhir, mat_logam)
        catat(f"kalung gantung: {hasil['kalung_gantung']}")
    hasil.update({"segitiga": len(segitiga(model)) + (hasil.get("kalung_gantung", {}).get("segitiga", 0)),
                  "segitiga_badan": seg_badan, "segitiga_kepala": seg_kepala,
                  "tinggi_sebelum_skala_m": round(tinggi, 4), "skala_akhir": round(f_akhir, 5),
                  "tinggi_kepala_akhir_m": round((T["kepala"]["puncak_m"] - S["dagu_z_m"]) * f_akhir, 4)})
    pilih_hanya(model)
    if ob_kalung is not None:
        ob_kalung.select_set(True)
    keluar = os.path.join(akar, a.keluar)
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=88,
        export_normals=True, export_tangents=False, export_animations=False, export_skins=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    hasil["berkas_mb"] = round(os.path.getsize(keluar) / 1e6, 2)
    S["hasil"] = hasil
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {a.keluar}: {hasil['segitiga']} segitiga (badan {seg_badan}, kepala {seg_kepala}, pita {hasil['pita']['segitiga']}, "
          f"tali {hasil.get('tali', {}).get('segitiga', 0)}, kalung gantung {hasil.get('kalung_gantung', {}).get('segitiga', 0)}), tinggi {tinggi:.3f} -> {S['tinggi_akhir_m']} m (skala {f_akhir:.4f}), "
          f"{hasil['berkas_mb']} MB")


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    P = data[a.blok]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    badan = impor(os.path.join(akar, a.badan), "badan")
    kepala = impor(os.path.join(akar, a.kepala), "kepala")
    if a.tahap == "tempat":
        tahap_tempat(a, akar, data, P, badan, kepala)
    else:
        tahap_sambung(a, akar, data, P, badan, kepala)


main()
