"""
Pratinjau dan ukuran GLB beranimasi hasil gabung_animasi.py (Blender): bingkai kontak serangan, kuda-kuda
terlebar, lari, jongkok, dan wajah dari sudut kamera dialog; plus angka per klip untuk hal yang sulit dilihat.

  blender -b -P tools/blender/pratinjau_animasi.py -- --masuk aset-mentah/wijaya-ulang-animasi.glb \
      --json tools/blender/wajah.json --blok wijaya_ulang --keluar aset-mentah/pratinjau --nama wijaya-ulang

Ukuran per klip (dicetak dan disimpan di <blok>.animasi.ukur):
  tangan_kiri_m     jarak sendi tangan kiri ke permukaan badan (bertanda; negatif = di dalam badan), terkecil
                    sepanjang klip dan pada bingkai kontak
  tembus_tangan_m   jarak bertanda terkecil verteks tangan kiri ke permukaan badan (negatif = menembus)
  kalung_m          jarak bertanda terkecil verteks mesh tambahan (kalung gantung) ke kulit, dan pecahan
                    verteks yang berada di dalam kulit pada bingkai terburuk
  kain_regang       regangan tepi kain terhadap pose istirahat (persentil 99 dan terbesar); kain yang pecah
                    tampak sebagai regangan besar
  kaki_m            jarak antarkaki terbesar (kuda-kuda terlebar) dan bingkainya

Gambar: <nama>-anim-serang.png (bingkai kontak serang-1, 2, 3 dari depan dan samping), -anim-gerak.png (tangkis,
lari, jongkok-jalan), -anim-lebar.png (kuda-kuda terlebar serang-1 dan tangkis, serang-berat, siaga),
-anim-dialog.png (idle dari sudut kamera dialog game, dengan perbesaran wajah). Pencahayaan: satu matahari
dan langit lemah seperti di game. --hanya-ukur melewati render.
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
from mathutils.bvhtree import BVHTree

PRE = "mixamorig:"


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--nama", default="karakter")
    p.add_argument("--hanya-ukur", action="store_true")
    p.add_argument("--lembar", default=None, help="hanya lembar ini, dipisah koma: serang,gerak,lebar,kaki,bahu,lain,kalung,dialog")
    p.add_argument("--klip-ukur", default=None, help="ukur hanya klip ini (dipisah koma); bawaan semua")
    p.add_argument("--lain", default="jalan:8,hindar:20,terkena:10,jongkok-diam:0",
                   help="lembar tambahan <nama>-anim-lain.png: daftar klip:bingkai dipisah koma")
    p.add_argument("--tanpa-json", action="store_true", help="jangan tulis ukuran ke json (untuk membandingkan model lain)")
    return p.parse_args(argv)


def catat(*a):
    print("[anim]", *a, flush=True)


def main():
    a = argumen()
    akar = os.getcwd()
    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json))
    P = data[a.blok]
    A = P.setdefault("animasi", {})
    f_skala = P.get("sambung", {}).get("hasil", {}).get("skala_akhir", 1.0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    scene = bpy.context.scene
    scene.render.fps = 30
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.find_armature() is arm]
    utama = max(meshes, key=lambda o: len(o.data.polygons))
    tambahan = [o for o in meshes if o is not utama]
    ad = arm.animation_data
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    aksi = {act.name: act for act in bpy.data.actions}
    catat(f"{a.masuk}: mesh utama {utama.name} ({len(utama.data.polygons)} muka), tambahan {[o.name for o in tambahan]}, aksi {sorted(aksi)}")

    def pasang(nama, bingkai=None):
        act = aksi[nama]
        ad.action = act
        try:
            ad.action_slot = act.slots[0]
        except Exception:
            pass
        if bingkai is not None:
            scene.frame_set(int(bingkai))
        return act

    # --- bagian mesh pada pose istirahat ---
    nv = len(utama.data.vertices)
    nama_grup = [vg.name for vg in utama.vertex_groups]
    dominan = np.zeros(nv, dtype=np.int64)
    for v in utama.data.vertices:
        if v.groups:
            g = max(v.groups, key=lambda g_: g_.weight)
            dominan[v.index] = g.group
    nm = np.array([n.replace(PRE, "") for n in nama_grup])[dominan]
    badan_set = np.isin(nm, ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftUpLeg", "RightUpLeg", "LeftShoulder", "RightShoulder"])
    tangan_kiri = np.char.startswith(nm, "LeftHand")
    lengan_bawah_kiri = nm == "LeftForeArm"
    utama.data.calc_loop_triangles()
    tri = np.empty(len(utama.data.loop_triangles) * 3, dtype=np.int64)
    utama.data.loop_triangles.foreach_get("vertices", tri)
    tri = tri.reshape(-1, 3)
    pi = np.empty(len(utama.data.loop_triangles), dtype=np.int64)
    utama.data.loop_triangles.foreach_get("polygon_index", pi)
    mi = np.empty(len(utama.data.polygons), dtype=np.int64)
    utama.data.polygons.foreach_get("material_index", mi)
    bahan_penutup = [i for i, m in enumerate(utama.data.materials) if m and m.name.startswith(A.get("bagian", {}).get("penutup_awalan", "emas"))]
    tri_kulit = tri[~np.isin(mi[pi], bahan_penutup)]
    tri_badan = tri_kulit[badan_set[tri_kulit].all(axis=1)]

    def posisi(obj):
        dg = bpy.context.evaluated_depsgraph_get()
        oe = obj.evaluated_get(dg)
        me = oe.to_mesh()
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        M = np.array(oe.matrix_world)
        co = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
        oe.to_mesh_clear()
        return co

    arm.data.pose_position = "REST"
    scene.frame_set(1)
    co0 = posisi(utama)
    arm.data.pose_position = "POSE"
    x0 = float((co0[:, 0].min() + co0[:, 0].max()) / 2)
    zk = P.get("abu", {}).get("zona_kain")
    e = np.empty(len(utama.data.edges) * 2, dtype=np.int64)
    utama.data.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    if zk:
        kain = (co0[:, 2] >= zk["z_m"][0] * f_skala) & (co0[:, 2] <= zk["z_m"][1] * f_skala) & (np.abs(co0[:, 0] - x0) <= zk["x_abs_maks_m"] * f_skala)
        e_kain = e[kain[e].all(axis=1)]
        pj0 = np.linalg.norm(co0[e_kain[:, 0]] - co0[e_kain[:, 1]], axis=1)
        e_kain, pj0 = e_kain[pj0 > 0.004], pj0[pj0 > 0.004]
    else:
        e_kain, pj0 = np.zeros((0, 2), dtype=np.int64), np.zeros(0)

    # Lingkar kaki: cincin bahan yang sama (irisan mendatar pada pose istirahat lewat segitiga kulit kaki satu
    # sisi), diukur ulang panjangnya pada tiap bingkai. Kulit kaki = verteks yang bobotnya hanya UpLeg dan Leg sisinya.
    Wv = np.zeros((nv, len(nama_grup)))
    for v in utama.data.vertices:
        for g in v.groups:
            Wv[v.index, g.group] = g.weight
    kol = {n.replace(PRE, ""): j for j, n in enumerate(nama_grup)}
    arm.data.pose_position = "REST"
    scene.frame_set(1)
    bpy.context.view_layer.update()
    sendi0 = {n: np.array(arm.matrix_world @ arm.pose.bones[PRE + n].head) for n in ("LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg", "LeftFoot")}
    arm.data.pose_position = "POSE"
    cincin = {}
    for sisi in ("Left", "Right"):
        w_kaki = Wv[:, kol[sisi + "UpLeg"]] + Wv[:, kol[sisi + "Leg"]]
        kulit_kaki = w_kaki > 0.98
        # segitiga yang dilewati irisan boleh menyentuh pangkal lapisan dalam kain (bobot kaki di atas separuh);
        # lingkarnya baru dipakai kalau hampir semua titik potongnya di kulit kaki murni
        tk = tri_kulit[(w_kaki > 0.5)[tri_kulit].all(axis=1)]
        z_lutut = float(sendi0[sisi + "Leg"][2])
        z_atas = float(co0[kulit_kaki, 2].max()) if kulit_kaki.any() else z_lutut
        def iris(z):
            """Irisan mendatar lewat segitiga kulit kaki: daftar ruas, dan apakah ruasnya membentuk lingkar tertutup
            (tiap tepi yang terpotong dipakai tepat dua ruas)."""
            d = co0[:, 2] - z
            seg, pakai = [], {}
            for t in tk:
                pts = []
                for i, j in ((0, 1), (1, 2), (2, 0)):
                    if (d[t[i]] < 0) != (d[t[j]] < 0):
                        pts.append((int(t[i]), int(t[j]), float(d[t[i]] / (d[t[i]] - d[t[j]]))))
                if len(pts) == 2:
                    seg.append(pts)
                    for p_ in pts:
                        k_ = (min(p_[0], p_[1]), max(p_[0], p_[1]))
                        pakai[k_] = pakai.get(k_, 0) + 1
            murni = np.mean([kulit_kaki[i] and kulit_kaki[j] for i, j in pakai]) if pakai else 0.0
            return seg, bool(seg) and all(n == 2 for n in pakai.values()) and murni >= 0.9

        nama_sisi = "kiri" if sisi == "Left" else "kanan"
        cincin[f"lutut_{nama_sisi}"] = (iris(z_lutut)[0], round(z_lutut, 3))
        # paha: lingkar kulit utuh yang paling tinggi di bawah tepi kain (di atasnya paha menyatu dengan lapisan
        # dalam kain, jadi tidak ada lingkar paha tengah yang terpisah di mesh ini)
        z = z_atas - 0.005
        seg, utuh = iris(z)
        while not utuh and z > z_lutut + 0.02:
            z -= 0.005
            seg, utuh = iris(z)
        cincin[f"paha_{nama_sisi}"] = (seg, round(z, 3))

    def panjang_cincin(co, seg):
        titik = lambda p_: co[p_[0]] + p_[2] * (co[p_[1]] - co[p_[0]])
        return float(sum(np.linalg.norm(titik(a_) - titik(b_)) for a_, b_ in seg))

    lingkar0 = {k: panjang_cincin(co0, seg) for k, (seg, _z) in cincin.items()}
    catat("lingkar pose istirahat (m): " + ", ".join(f"{k} {v:.3f} (z {cincin[k][1]})" for k, v in lingkar0.items()))

    def bertanda(bvh, p):
        """Jarak ke permukaan; negatif kalau titik jelas di balik muka terdekat dan dekat (kurang dari 6 cm).
        Permukaan badan terbuka di pangkal lengan dan kaki, jadi tanda untuk titik yang jauh tidak dipercaya."""
        kena = bvh.find_nearest(Vector(p.tolist()))
        d = np.array(p) - np.array(kena[0][:])
        j = float(np.linalg.norm(d))
        di_balik = j > 1e-6 and j < 0.06 and (d @ np.array(kena[1][:])) / j < -0.5
        return -j if di_balik else j

    def tulang(nama):
        return np.array(arm.matrix_world @ arm.pose.bones[PRE + nama].head)

    hasil_klip = A.get("hasil", {})
    ukur = {}
    pilih_klip = set(a.klip_ukur.split(",")) if a.klip_ukur else None
    for nama in sorted(aksi):
        if pilih_klip and nama not in pilih_klip:
            continue
        act = pasang(nama)
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        langkah = 1 if f1 - f0 <= 70 else 3
        baris = []
        for fr in range(f0, f1 + 1, langkah):
            scene.frame_set(fr)
            co = posisi(utama)
            bvh_badan = BVHTree.FromPolygons(co.tolist(), tri_badan.tolist())
            d_sendi = bertanda(bvh_badan, tulang("LeftHand"))
            idx_t = np.nonzero(tangan_kiri)[0]
            d_tangan = min(bertanda(bvh_badan, co[i]) for i in idx_t[:: max(1, len(idx_t) // 60)]) if len(idx_t) else float("nan")
            d_kalung, dalam = float("nan"), 0.0
            if tambahan:
                bvh_kulit = BVHTree.FromPolygons(co.tolist(), tri_kulit.tolist())
                dk = []
                for o in tambahan:
                    dk.extend(bertanda(bvh_kulit, c) for c in posisi(o))
                dk = np.array(dk)
                d_kalung, dalam = float(dk.min()), float((dk < 0).mean())
            regang = np.linalg.norm(co[e_kain[:, 0]] - co[e_kain[:, 1]], axis=1) / pj0 if len(pj0) else np.ones(1)
            kaki = float(np.linalg.norm(tulang("LeftFoot") - tulang("RightFoot")))
            rasio = [panjang_cincin(co, cincin[k][0]) / lingkar0[k] if lingkar0[k] > 0 else 1.0 for k in sorted(cincin)]
            baris.append((fr, d_sendi, d_tangan, d_kalung, dalam, float(np.percentile(regang, 99)), float(regang.max()), kaki, *rasio))
        b = np.array(baris)
        kontak = hasil_klip.get(nama, {}).get("kontak_baru")
        kontak = f0 + kontak - 1 if kontak else None          # kontak_baru dihitung dari 1; aksi GLB mulai di f0
        i_k = int(np.argmin(np.abs(b[:, 0] - kontak))) if kontak is not None else None
        i_tk, i_kl, i_kk = int(np.argmin(b[:, 1])), int(np.nanargmin(b[:, 3])) if tambahan else 0, int(np.argmax(b[:, 7]))
        ukur[nama] = {
            "bingkai": [f0, f1],
            "tangan_kiri_m": {"terkecil": round(float(b[i_tk, 1]), 3), "bingkai": int(b[i_tk, 0]), **({"kontak": round(float(b[i_k, 1]), 3), "bingkai_kontak": int(b[i_k, 0])} if i_k is not None else {})},
            "tembus_tangan_m": round(float(b[:, 2].min()), 3),
            "kalung_m": {"terkecil": round(float(b[i_kl, 3]), 4), "bingkai": int(b[i_kl, 0]), "di_dalam_kulit": round(float(b[i_kl, 4]), 2)} if tambahan else None,
            "kain_regang": {"p99": round(float(b[:, 5].max()), 2), "terbesar": round(float(b[:, 6].max()), 2)},
            "kaki_m": {"terlebar": round(float(b[i_kk, 7]), 3), "bingkai": int(b[i_kk, 0])},
            # lingkar terhadap pose istirahat: terkecil sepanjang klip, dan pada bingkai kuda-kuda terlebar
            "lingkar": {k: {"terkecil": round(float(b[:, 8 + n].min()), 3), "kuda_kuda_terlebar": round(float(b[i_kk, 8 + n]), 3)}
                        for n, k in enumerate(sorted(cincin))},
        }
        u = ukur[nama]
        catat(f"{nama:14s} tangan kiri {u['tangan_kiri_m']}, tembus tangan {u['tembus_tangan_m']}, kalung {u['kalung_m']}, kain regang {u['kain_regang']}, kaki {u['kaki_m']}")
        catat(f"{'':14s} lingkar (terkecil / kuda-kuda terlebar): " + ", ".join(f"{k} {v['terkecil']:.2f} / {v['kuda_kuda_terlebar']:.2f}" for k, v in u["lingkar"].items()))
    if not a.tanpa_json and not pilih_klip:
        A["ukur"] = ukur
        json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    if a.hanya_ukur:
        return

    # --- render ---
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    latar = scene.world.node_tree.nodes["Background"]
    latar.inputs[0].default_value = (0.8, 0.8, 0.82, 1.0)
    latar.inputs[1].default_value = 0.45
    kd = bpy.data.cameras.new("Kamera")
    kam = bpy.data.objects.new("Kamera", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    mth = bpy.data.objects.new("Matahari", bpy.data.lights.new("Matahari", "SUN"))
    mth.data.energy = 3.2
    scene.collection.objects.link(mth)
    tmp = os.path.join(tempfile.gettempdir(), "nusantara-anim")
    os.makedirs(tmp, exist_ok=True)

    def render(path, sasaran, arah, ukuran, ortho=None, fov=None, jarak=6.0, posisi_kam=None):
        scene.render.resolution_x, scene.render.resolution_y = ukuran
        if ortho:
            kd.type = "ORTHO"
            kd.ortho_scale = ortho
            kam.location = Vector(sasaran) + Vector(arah).normalized() * jarak
        else:
            kd.type = "PERSP"
            kd.sensor_fit = "VERTICAL"
            kd.angle_y = math.radians(fov)
            kam.location = Vector(posisi_kam)
        kam.rotation_euler = (Vector(sasaran) - kam.location).to_track_quat("-Z", "Y").to_euler()
        # matahari dari depan-kiri atas terhadap arah pandang, supaya sisi yang dilihat terang seperti siang di game
        d = (Vector(sasaran) - kam.location).normalized()
        sinar = (d + Vector((0.45 * d.y, -0.45 * d.x, -0.75))).normalized()
        mth.rotation_euler = sinar.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    def muat(path):
        im = bpy.data.images.load(path)
        w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        bpy.data.images.remove(im)
        return px.reshape(h, w, 4)

    def simpan(px, path):
        h, w = px.shape[:2]
        out = bpy.data.images.new("lembar", w, h, alpha=False)
        out.pixels.foreach_set(np.ascontiguousarray(px, dtype=np.float32).ravel())
        out.filepath_raw = path
        out.file_format = "PNG"
        out.save()
        bpy.data.images.remove(out)

    def ubin(nama, bingkai):
        """Dua ubin (depan, samping) satu klip pada satu bingkai."""
        pasang(nama, bingkai)
        h = tulang("Hips")
        pusat = (float(h[0]), float(h[1]), 0.90)
        out = []
        for sudut, arah in (("depan", (0, -1, 0)), ("samping", (1, 0, 0))):
            path = os.path.join(tmp, f"{nama}-{bingkai}-{sudut}.png")
            render(path, pusat, arah, (520, 760), ortho=2.25)
            out.append(muat(path))
        return np.hstack(out)

    def lembar(daftar, akhiran):
        px = np.hstack([ubin(n, fr) for n, fr in daftar])
        path = os.path.join(akar, a.keluar, f"{a.nama}-anim-{akhiran}.png")
        simpan(px, path)
        catat(f"{path}: " + ", ".join(f"{n} bingkai {fr}" for n, fr in daftar))

    os.makedirs(os.path.join(akar, a.keluar), exist_ok=True)
    mau = lambda nama_l: (a.lembar is None) or (nama_l in a.lembar.split(","))
    kontak = lambda n: ukur[n]["tangan_kiri_m"].get("bingkai_kontak", ukur[n]["kaki_m"]["bingkai"])
    lebar = lambda n: ukur[n]["kaki_m"]["bingkai"]
    if mau("serang"):
        lembar([("serang-1", kontak("serang-1")), ("serang-2", kontak("serang-2")), ("serang-3", kontak("serang-3"))], "serang")
    if mau("gerak"):
        lembar([("tangkis", lebar("tangkis")), ("lari", lebar("lari")), ("jongkok-jalan", lebar("jongkok-jalan"))], "gerak")
    if mau("lebar"):
        lain = [("serang-1", lebar("serang-1")), ("serang-berat", kontak("serang-berat"))]
        if "siaga" in aksi:
            lain.append(("siaga", (ukur["siaga"]["bingkai"][0] + ukur["siaga"]["bingkai"][1]) // 2))
        lembar(lain, "lebar")

    # Pinggang ke kaki, lebih besar: tiap klip satu baris (depan, samping, belakang).
    def lembar_kaki(daftar, akhiran):
        baris_px = []
        for n, fr in daftar:
            pasang(n, fr)
            h_ = tulang("Hips")
            ubin_ = []
            for sudut, arah in (("depan", (0, -1, 0)), ("samping", (1, 0, 0)), ("belakang", (0, 1, 0))):
                path = os.path.join(tmp, f"kaki-{n}-{fr}-{sudut}.png")
                render(path, (float(h_[0]), float(h_[1]), 0.56), arah, (720, 720), ortho=1.30)
                ubin_.append(muat(path))
            baris_px.append(np.hstack(ubin_))
        path = os.path.join(akar, a.keluar, f"{a.nama}-anim-{akhiran}.png")
        simpan(np.vstack(baris_px[::-1]), path)            # piksel Blender dari bawah ke atas
        catat(f"{path} (baris dari atas; depan, samping, belakang): " + ", ".join(f"{n} bingkai {fr}" for n, fr in daftar))

    tengah = lambda n: (ukur[n]["bingkai"][0] + ukur[n]["bingkai"][1]) // 2
    if mau("kaki"):
        lembar_kaki([("lari", lebar("lari")), ("tangkis", lebar("tangkis")), ("serang-1", lebar("serang-1"))], "kaki-1")
        lembar_kaki([("serang-berat", lebar("serang-berat")), ("jongkok-jalan", lebar("jongkok-jalan"))] + ([("siaga", tengah("siaga"))] if "siaga" in aksi else []), "kaki-2")

    # Bahu kiri dari belakang tokoh pada bingkai kontak serangan.
    ubin_b = []
    for n in (("serang-1", "serang-2", "serang-3") if mau("bahu") else ()):
        pasang(n, kontak(n))
        ki, ka = tulang("LeftArm"), tulang("RightArm")
        belakang = np.cross(np.array([0.0, 0.0, 1.0]), ki - ka)
        belakang /= np.linalg.norm(belakang)
        pusat = (ki + ka) / 2 + (ki - ka) * 0.15 - np.array([0.0, 0.0, 0.08])
        path = os.path.join(tmp, f"bahu-{n}.png")
        render(path, tuple(float(v) for v in pusat), tuple(float(v) for v in belakang + np.array([0, 0, 0.15])), (720, 720), ortho=0.85)
        ubin_b.append(muat(path))
    if ubin_b:
        path = os.path.join(akar, a.keluar, f"{a.nama}-anim-bahu.png")
        simpan(np.hstack(ubin_b), path)
        catat(f"{path}: bahu kiri dari belakang pada kontak serang-1, serang-2, serang-3")

    lain = [(n, int(fr)) for n, fr in (b.split(":") for b in a.lain.split(",") if b) if n in aksi]
    if lain and mau("lain"):
        lembar(lain, "lain")

    # Kalung (mesh tambahan) dari dekat pada bingkai terdalamnya di klip yang membungkuk.
    if tambahan and mau("kalung"):
        ubin_k = []
        ket = []
        for n in ("serang-3", "jongkok-jalan"):
            if n not in aksi or not ukur[n]["kalung_m"]:
                continue
            fr = ukur[n]["kalung_m"]["bingkai"]
            pasang(n, fr)
            ck = np.vstack([posisi(o) for o in tambahan]).mean(axis=0)
            depan = ck - tulang("Spine2")
            depan[2] = 0.0
            depan = depan / max(np.linalg.norm(depan), 1e-6)
            samping = np.array([depan[1], -depan[0], 0.0])
            for nama_s, arah in (("depan", depan + np.array([0, 0, 0.25])), ("serong", depan * 0.75 + samping * 0.66 + np.array([0, 0, 0.25]))):
                path = os.path.join(tmp, f"kalung-{n}-{nama_s}.png")
                render(path, tuple(float(v) for v in ck), tuple(float(v) for v in arah), (640, 640), ortho=0.42)
                ubin_k.append(muat(path))
            ket.append(f"{n} bingkai {fr} (jarak terkecil ke kulit {ukur[n]['kalung_m']['terkecil'] * 1000:.1f} mm)")
        if ubin_k:
            path = os.path.join(akar, a.keluar, f"{a.nama}-anim-kalung.png")
            simpan(np.hstack(ubin_k), path)
            catat(f"{path}: " + "; ".join(ket))

    # Sudut kamera dialog game (src/dialog/sinematik.ts): kamera 2,1 m di belakang dan 0,9 m di kanan lawan bicara
    # (yang berdiri 1,5 m di depan tokoh), tinggi 1,8 m, memandang kepala tokoh; sudut pandang tegak 60 derajat.
    if not mau("dialog"):
        return
    pasang("idle", 1)
    h = tulang("Hips")
    kepala = tulang("Head")
    p_dialog = os.path.join(tmp, "dialog.png")
    render(p_dialog, (float(h[0]) + 0.25, float(h[1]), 1.45), None, (1920, 1080), fov=60.0, posisi_kam=(float(h[0]) + 0.9, float(h[1]) - 3.6, 1.8))
    luas = muat(p_dialog)
    # perbesaran wajah: kamera yang sama arahnya, sudut pandang sempit ke kepala
    p_wajah = os.path.join(tmp, "dialog-wajah.png")
    render(p_wajah, (float(kepala[0]), float(kepala[1]), float(kepala[2]) + 0.02), None, (1080, 1080), fov=11.0, posisi_kam=(float(h[0]) + 0.9, float(h[1]) - 3.6, 1.8))
    path = os.path.join(akar, a.keluar, f"{a.nama}-anim-dialog.png")
    simpan(np.hstack([luas, muat(p_wajah)]), path)
    catat(f"{path}: idle bingkai 1 dari sudut kamera dialog, dan perbesaran wajah")


main()
