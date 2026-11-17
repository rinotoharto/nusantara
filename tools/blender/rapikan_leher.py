"""
Rapikan sambungan kepala dan leher dari berkas yang sudah disambung manual di Blender (langkah 2
"Prosedur sambung kepala" di aset-mentah/README.md). Umum: dipakai untuk Wijaya, prajurit, dan tokoh lain.

  blender -b -P tools/blender/rapikan_leher.py -- --masuk aset-mentah/wijaya-leher-rapi.glb \\
      --z-potong 1.48 --json tools/blender/wajah.json --tekstur aset-mentah/tekstur --nama wijaya \\
      --keluar /tmp/wijaya-leher.glb

Masukan: satu mesh, kepala dan badan terpisah (tidak tersambung), bawah kepala dipotong rata di sekitar
--z-potong, leher badan diekstrusi naik masuk ke kepala (pita leher lama). Mesh boleh terpecah di jahitan UV
(hasil ekspor glTF): semua pencarian tepi memakai peta las posisi; yang benar-benar di-merge hanya duplikat
persis di cincin sambungan dan di badan bawah.

Langkah (angka di wajah.json blok "leher_rapi"):
  1. cari cincin terbuka di sekitar leher (tepi bawah kepala, tepi atas pita lama); laporkan; pita lama dibuang;
  2. tegakkan leher ("tegak"): kepala digeser ke belakang, pangkal leher badan digeser bertahap dari
     z_pangkal_m (bobot 0) sampai cincin atas badan (bobot 1); sudut sumbu leher diukur sebelum dan sesudah;
  3. potong ulang bawah kepala dengan bidang miring ("rahang"): lewat bawah dagu dan naik ke belakang, supaya
     garis sambungan mengikuti bawah rahang dari dagu ke belakang telinga, bukan bidang datar;
  4. sambungan sungguhan: cincin tepi kepala dan cincin atas leher badan dijahit lewat beberapa cincin
     perantara (jumlah verteks berbeda dijahit zig-zag menurut sudut), satu permukaan dengan kepala dan badan;
     bawah dagu melandai (sudut_bawah_dagu_derajat), ada tonjolan otot tipis dari belakang telinga ke selangka;
  5. kalung ("kalung"): tali bulat tipis mengikuti permukaan leher dan bahu, lebih rendah di depan, dengan
     liontin pipih; material emas terpisah;
  6. badan di bawah decimate_z_maks_m diringankan sampai jumlah segitiga <= segitiga_maks;
  7. normal: normal asli dipertahankan; sudut baru dan cincin sambungan dihitung halus melintasi sambungan;
  8. tekstur: pulau UV pita di kotak kosong atlas, warna beralih dari kulit leher badan ke kulit rahang di
     ruang Lab, peralihan diteruskan ke kepala; normal map diratakan di pita dekat sambungan dan dilemahkan di
     kulit kepala; kalung lukis di dada dihapus (diisi kulit sekitarnya); margin pulau dibangun ulang; emas
     lukis gelang lengan lewat topeng posisi dan warna ke tekstur metallic-roughness;
  9. ekspor GLB Draco tanpa kerangka. Lanjutkan dengan gabung_animasi.py --model <keluaran ini>.
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

BADAN, KEPALA, PITA, KALUNG, LIONTIN = 0, 1, 2, 4, 5

BAWAAN = {
    "z_potong_m": 1.48,
    "radius_leher_m": 0.13,
    "jendela_z_m": 0.08,
    "las_m": 1e-4,
    "las_cincin_m": 5e-4,
    "depan": [0.0, -1.0],
    "tegak": {"geser_kepala_m": 0.025, "geser_leher_m": 0.035, "z_pangkal_m": 1.375,
              "radius_penuh_m": 0.10, "radius_nol_m": 0.16, "ukur_z_m": [1.38, 1.47]},
    "potong_badan": {"turun_depan_m": 0.037, "turun_belakang_m": 0.002},
    "rahang": {"sudut_derajat": 16.0, "angkat_m": 0.004, "naik_maks_m": 0.03, "halus_iterasi": 2, "halus_faktor": 0.5},
    "ruas": 5,
    "kolom": 40,
    "sudut_bawah_dagu_derajat": 38.0,
    "pangkat_maks": 4.0,
    "cekung_m": 0.002,
    "otot_m": 0.003,
    "otot_sudut_derajat": [25.0, 105.0],
    "otot_lebar_derajat": 18.0,
    "halus_iterasi": 2,
    "halus_faktor": 0.5,
    "halus_pangkal_iterasi": 6,
    "halus_pangkal_m": 0.025,
    "kalung": {
        "aktif": True, "segmen": 36, "sisi": 6, "jari_m": 0.0025, "celah_m": 0.0025, "naik_belakang_m": 0.004,
        "turun_depan_m": 0.05, "halus_iterasi": 4, "liontin_m": [0.006, 0.0012, 0.009],
        "warna_srgb": [201, 160, 74], "metallic": 1.0, "roughness": 0.35,
    },
    "segitiga_maks": 16500,
    "decimate_z_maks_m": 1.38,
    "las_badan_z_m": 1.40,
    "lindung_radius_m": 0.03,
    "normal_sudut_min_cos": 0.3,
    "uv_pita_px": [384, 80],
    "margin_px": 8,
    "contoh_leher_m": 0.035,
    "rahang_tebal_m": 0.02,
    "kuat_rahang": 0.6,
    "batas_rahang_L": 8.0,
    "peralihan_m": 0.025,
    "normal_rata_m": 0.015,
    "normal_kulit_kepala": 0.45,
    "kalung_lukis": {"aktif": True, "tinggi_m": 0.13, "radius_m": 0.13, "ambang_L": 8.0, "ambang_lokal_L": 2.0, "jendela_px": 9,
                     "kulit_min": 0.3, "lebar_px": 2, "ambang_kuat_L": 12.0, "ratakan_radius_m": 0.018,
                     "ratakan_iterasi": 15, "ratakan_faktor": 0.5, "normal_dada": 0.25},
    "emas": {
        "aktif": True, "ukuran_px": 1024, "x_abs_m": [0.17, 0.27], "z_m": [1.19, 1.30], "rona_derajat": [27.5, 45],
        "sat_min": 0.55, "v_min": 0.45, "kulit_maks": 1.01, "roughness_emas": 0.4, "roughness_lain": 0.8,
        "metallic_emas": 0.65,
    },
}


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--z-potong", type=float, default=None, help="tinggi potongan bawah kepala (m)")
    p.add_argument("--tekstur", default="aset-mentah/tekstur")
    p.add_argument("--nama", default="wijaya")
    p.add_argument("--kualitas-jpeg", type=int, default=85)
    return p.parse_args(argv)


def catat(*a):
    print("[leher]", *a, flush=True)


def isi_bawaan(d, bawaan):
    for k, v in bawaan.items():
        if isinstance(v, dict):
            isi_bawaan(d.setdefault(k, {}), v)
        else:
            d.setdefault(k, v)


def halus01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def las(co, tol):
    """Indeks las: verteks dengan posisi sama (dalam tol) mendapat nomor yang sama. Mesh tidak diubah."""
    kunci = np.round(np.asarray(co, dtype=np.float64) / tol).astype(np.int64)
    _, inv = np.unique(kunci, axis=0, return_inverse=True)
    return inv.ravel()


def komponen(n, pasangan):
    induk = list(range(n))

    def cari(x):
        while induk[x] != x:
            induk[x] = induk[induk[x]]
            x = induk[x]
        return x
    for a, b in pasangan:
        ra, rb = cari(a), cari(b)
        if ra != rb:
            induk[ra] = rb
    return np.array([cari(i) for i in range(n)])


def loop_batas(muka_w):
    """Tepi yang hanya dipakai satu muka (pada topologi las), dikelompokkan jadi loop."""
    hitung = {}
    for vs in muka_w:
        for a, b in zip(vs, vs[1:] + vs[:1]):
            if a != b:
                k = (a, b) if a < b else (b, a)
                hitung[k] = hitung.get(k, 0) + 1
    tetangga = {}
    for (a, b), n in hitung.items():
        if n == 1:
            tetangga.setdefault(a, []).append(b)
            tetangga.setdefault(b, []).append(a)
    sudah, loops = set(), []
    for s in tetangga:
        if s in sudah:
            continue
        tumpuk, isi = [s], []
        sudah.add(s)
        while tumpuk:
            x = tumpuk.pop()
            isi.append(x)
            for y in tetangga[x]:
                if y not in sudah:
                    sudah.add(y)
                    tumpuk.append(y)
        sederhana = all(len(tetangga[i]) == 2 for i in isi)
        if sederhana:   # urutkan dengan menyusuri loop
            urut, sebelum, kini = [isi[0]], None, isi[0]
            while True:
                t = [y for y in tetangga[kini] if y != sebelum]
                nxt = t[0] if t else tetangga[kini][0]
                if nxt == urut[0]:
                    break
                urut.append(nxt)
                sebelum, kini = kini, nxt
                if len(urut) > len(isi):
                    break
            isi = urut
        loops.append({"w": isi, "sederhana": sederhana, "cabang": [(i, len(tetangga[i])) for i in isi if len(tetangga[i]) != 2],
                      "tetangga": {i: list(tetangga[i]) for i in isi}})
    return loops, hitung


def luas_xy(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def contoh_radial(P, pusat, sudut):
    """Titik pada poligon tertutup P (n x 3) yang dipotong sinar dari pusat (xy) ke arah sudut."""
    d = np.array([math.cos(sudut), math.sin(sudut)])
    A, B = P, np.roll(P, -1, axis=0)
    e = (B - A)[:, :2]
    ac = A[:, :2] - pusat[:2]
    penyebut = d[0] * e[:, 1] - d[1] * e[:, 0]
    with np.errstate(divide="ignore", invalid="ignore"):
        s = (ac[:, 0] * e[:, 1] - ac[:, 1] * e[:, 0]) / penyebut
        u = (ac[:, 0] * d[1] - ac[:, 1] * d[0]) / penyebut
    sah = (np.abs(penyebut) > 1e-12) & (u >= -1e-6) & (u <= 1 + 1e-6) & (s > 0)
    if not sah.any():
        sd = np.arctan2(ac[:, 1], ac[:, 0])
        i = int(np.argmin(np.abs(np.angle(np.exp(1j * (sd - sudut))))))
        return A[i].copy()
    i = int(np.argmax(np.where(sah, s, -1)))
    return A[i] + np.clip(u[i], 0, 1) * (B[i] - A[i])


# ---------- warna ----------
_M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
_PUTIH = np.array([0.95047, 1.0, 1.08883])


def srgb_ke_lab(c):
    c = np.asarray(c, dtype=np.float64)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ _M.T / _PUTIH
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_ke_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], axis=-1)
    xyz = np.where(f > 0.206893, f ** 3, (f - 16 / 116) / 7.787) * _PUTIH
    lin = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def hsv(rgb):
    """Rona derajat 0..360, saturasi dan nilai 0..1."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(axis=-1)
    c = v - rgb.min(axis=-1)
    s = np.where(v > 0, c / np.maximum(v, 1e-9), 0)
    cc = np.maximum(c, 1e-9)
    h = np.where(v == r, ((g - b) / cc) % 6, np.where(v == g, (b - r) / cc + 2, (r - g) / cc + 4)) * 60
    return np.where(c > 0, h, 0), s, v


def topeng_kulit(rgb, K):
    """Sama dengan kulit_warna.py (rona K dalam skala OpenCV, setengah derajat)."""
    h, s, v = hsv(rgb)
    h = h / 2
    rona = halus01(1 - np.abs(h - K.get("rona_pusat", 10)) / K.get("rona_lebar", 14))
    sat = halus01((s - K.get("sat_min", 0.18)) / 0.12) * halus01((K.get("sat_maks", 0.85) - s) / 0.15)
    return rona * sat * halus01((v - K.get("v_min", 0.2)) / 0.15)


def jumlah_kotak(m, r):
    """Jumlah dalam jendela (2r+1) x (2r+1) lewat gambar integral."""
    H, W = m.shape
    p = np.pad(m.astype(np.float64), r, mode="constant")
    S = np.zeros((H + 2 * r + 1, W + 2 * r + 1))
    S[1:, 1:] = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return S[k:, k:] - S[:-k, k:] - S[k:, :-k] + S[:-k, :-k]


def cari_kotak(terisi, w, h):
    """Kiri-bawah kotak w x h yang kosong seluruhnya, atau None."""
    H, W = terisi.shape
    S = np.zeros((H + 1, W + 1))
    S[1:, 1:] = terisi.astype(np.float64).cumsum(0).cumsum(1)
    jml = S[h:, w:] - S[:-h, w:] - S[h:, :-w] + S[:-h, :-w]
    idx = np.argwhere(jml == 0)
    if not len(idx):
        return None
    y, x = idx[0]
    return int(x), int(y)


def raster(uv_px, atr, W, H):
    """Raster segitiga UV (n x 3 x 2, piksel) dengan atribut per sudut (n x 3 x k)."""
    k = atr.shape[2]
    out = np.zeros((H, W, k), dtype=np.float32)
    isi = np.zeros((H, W), dtype=bool)
    for t in range(len(uv_px)):
        (x0, y0), (x1, y1), (x2, y2) = uv_px[t]
        xa, xb = max(int(math.floor(min(x0, x1, x2))), 0), min(int(math.ceil(max(x0, x1, x2))), W - 1)
        ya, yb = max(int(math.floor(min(y0, y1, y2))), 0), min(int(math.ceil(max(y0, y1, y2))), H - 1)
        if xb < xa or yb < ya:
            continue
        d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(d) < 1e-12:
            continue
        X, Y = np.meshgrid(np.arange(xa, xb + 1) + 0.5, np.arange(ya, yb + 1) + 0.5)
        a = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / d
        b = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / d
        c = 1 - a - b
        m = (a >= -0.02) & (b >= -0.02) & (c >= -0.02)
        if not m.any():
            continue
        nilai = a[..., None] * atr[t, 0] + b[..., None] * atr[t, 1] + c[..., None] * atr[t, 2]
        sub = out[ya:yb + 1, xa:xb + 1]
        sub[m] = nilai[m]
        isi[ya:yb + 1, xa:xb + 1] |= m
    return out, isi


def simpan_gambar(nama, px, path_png, path_jpg, ruang, kualitas):
    """Simpan PNG (arsip) dan, kalau diminta, JPEG untuk GLB; kembalikan gambar yang dimuat dari berkas."""
    H, W = px.shape[:2]
    img = bpy.data.images.new(nama + "_tmp", W, H, alpha=False)
    img.colorspace_settings.name = ruang
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    img.file_format = "PNG"
    img.filepath_raw = path_png
    img.save()
    path = path_png
    if path_jpg:
        s = bpy.context.scene.render.image_settings
        s.file_format, s.quality, s.color_mode = "JPEG", kualitas, "RGB"
        img.file_format = "JPEG"
        img.filepath_raw = path_jpg
        img.save()
        path = path_jpg
    bpy.data.images.remove(img)
    hasil = bpy.data.images.load(path)
    hasil.name = nama
    hasil.colorspace_settings.name = ruang
    return hasil


def topologi(bm, tol):
    """Topologi las dari keadaan bmesh sekarang: komponen, loop batas, dan verteks per posisi las."""
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    co = np.array([v.co[:] for v in bm.verts])
    wid = las(co, tol)
    nw = int(wid.max()) + 1
    wco = np.zeros((nw, 3))
    wco[wid] = co
    muka_w = [[int(wid[v.index]) for v in f.verts] for f in bm.faces]
    komp = komponen(nw, [(vs[k], vs[(k + 1) % len(vs)]) for vs in muka_w for k in range(len(vs))])
    loops, _ = loop_batas(muka_w)
    for lp in loops:
        lp["pusat"], lp["komp"] = wco[lp["w"]].mean(0), komp[lp["w"][0]]
    v_dari_w = {}
    for v in bm.verts:
        v_dari_w.setdefault(int(wid[v.index]), []).append(v)
    return {"co": co, "wid": wid, "wco": wco, "muka_w": muka_w, "komp": komp, "loops": loops, "v_dari_w": v_dari_w}


def garis_tengah(bm, z, x0, lebar, radius, pusat):
    """Titik depan dan belakang garis tengah (irisan tepi mesh dengan bidang z, |x - x0| < lebar)."""
    ys = []
    for e in bm.edges:
        a, b = e.verts[0].co, e.verts[1].co
        if (a.z - z) * (b.z - z) > 0 or a.z == b.z:
            continue
        t = (z - a.z) / (b.z - a.z)
        x, y = a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t
        if abs(x - x0) < lebar and math.hypot(x - pusat[0], y - pusat[1]) < radius:
            ys.append(y)
    return (min(ys), max(ys)) if len(ys) > 1 else None


def sudut_sumbu(bm, za, zb, x0, radius, pusat, depan):
    """Kemiringan sumbu leher (pusat garis tengah di za ke zb) terhadap vertikal; positif = condong ke depan."""
    a, b = garis_tengah(bm, za, x0, 0.02, radius, pusat), garis_tengah(bm, zb, x0, 0.02, radius, pusat)
    if not a or not b:
        return None
    ca, cb = (a[0] + a[1]) / 2, (b[0] + b[1]) / 2
    return math.degrees(math.atan2((cb - ca) * depan[1], zb - za))


def jahit(baris_a, baris_b):
    """Segitiga antara dua cincin dengan jumlah verteks berbeda. Tiap baris: daftar (verteks, sudut, t) urut
    sudut naik; a di bawah, b di atas. Hasil: daftar tiga (verteks, sudut tak-terlipat, t), menghadap luar."""
    na, nb = len(baris_a), len(baris_b)

    def ambil(baris, n, i):
        v, s, t = baris[i % n]
        return v, s + (2 * math.pi if i >= n else 0.0), t
    i = j = 0
    out = []
    while i < na or j < nb:
        a0, b0 = ambil(baris_a, na, i), ambil(baris_b, nb, j)
        if j >= nb or (i < na and ambil(baris_a, na, i + 1)[1] <= ambil(baris_b, nb, j + 1)[1]):
            out.append((a0, ambil(baris_a, na, i + 1), b0))
            i += 1
        else:
            out.append((a0, ambil(baris_b, nb, j + 1), b0))
            j += 1
    return out


def main():
    a = argumen()
    akar = os.getcwd()
    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json)) if os.path.exists(path_json) else {}
    L = data.setdefault("leher_rapi", {})
    isi_bawaan(L, BAWAAN)
    if a.z_potong is not None:
        L["z_potong_m"] = a.z_potong
    zp, tol = L["z_potong_m"], L["las_m"]
    depan = np.array(L["depan"], dtype=float)
    depan /= np.linalg.norm(depan)
    blk = -depan
    sudut_depan = math.atan2(depan[1], depan[0])
    hasil = {}

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    obj = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.name = a.nama
    me = obj.data
    me.calc_loop_triangles()
    hasil["segitiga_masuk"] = len(me.loop_triangles)

    # Normal asli per sudut disimpan di lapisan sendiri; sudut baru (nol) dihitung ulang di akhir.
    n_asli = np.empty(len(me.loops) * 3, dtype=np.float32)
    me.corner_normals.foreach_get("vector", n_asli)
    n_asli = n_asli.reshape(-1, 3)
    bm = bmesh.new()
    bm.from_mesh(me)
    lay_n = bm.loops.layers.float_vector.new("n_asli")
    lay_b = bm.faces.layers.int.new("bagian")
    lay_r = bm.verts.layers.int.new("ringan")
    lay_uv = bm.loops.layers.uv.active
    i = 0
    for f in bm.faces:
        for l in f.loops:
            l[lay_n] = n_asli[i]
            i += 1
    lepas = [v for v in bm.verts if not v.link_faces]
    if lepas:
        bmesh.ops.delete(bm, geom=lepas, context="VERTS")
    # Las hanya duplikat persis (jahitan UV) pada badan bawah, supaya Decimate tidak membuka jahitan.
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.z < L["las_badan_z_m"]], dist=1e-5)
    catat(f"verteks lepas dibuang {len(lepas)}; duplikat jahitan UV badan bawah dilas {n0 - len(bm.verts)}")

    def nolkan(v):
        for l in v.link_loops:
            l[lay_n] = (0.0, 0.0, 0.0)

    def buang_yatim():
        yatim = [v for v in bm.verts if not v.link_faces]
        if yatim:
            bmesh.ops.delete(bm, geom=yatim, context="VERTS")

    def haluskan_las(bobot_fn, iterasi, faktor):
        """Penghalusan Laplace pada posisi las (duplikat jahitan UV bergerak bersama). bobot_fn(w, posisi, T)
        mengembalikan bobot 0..1 atau None kalau posisi itu tidak ikut."""
        T = topologi(bm, tol)
        tetangga_w = {}
        for vs in T["muka_w"]:
            for k in range(len(vs)):
                tetangga_w.setdefault(vs[k], set()).update((vs[k - 1], vs[(k + 1) % len(vs)]))
        pw = T["wco"].copy()
        bobot = {}
        for w in tetangga_w:
            b = bobot_fn(w, pw[w], T)
            if b:
                bobot[w] = b
        for _ in range(iterasi):
            baru_p = {w: np.mean([pw[x] for x in tetangga_w[w] if x != w], axis=0) for w in bobot}
            for w, b in bobot.items():
                pw[w] += faktor * b * (baru_p[w] - pw[w])
        # Pengaman: penghalusan di lipatan sempit bisa membalik muka. Muka yang normalnya berbalik dikembalikan
        # dengan memulihkan posisi verteksnya.
        bm.normal_update()
        muka_kena = {f for w in bobot for v in T["v_dari_w"][w] for f in v.link_faces}
        n_lama = {f: f.normal.copy() for f in muka_kena}
        asal = {w: T["wco"][w].copy() for w in bobot}
        for w in bobot:
            for v in T["v_dari_w"][w]:
                v.co = pw[w]
        for _ in range(4):
            bm.normal_update()
            pulih = {int(T["wid"][v.index]) for f in muka_kena if f.normal.dot(n_lama[f]) < 0.0 for v in f.verts} & set(asal)
            pulih = {w for w in pulih if tuple(T["v_dari_w"][w][0].co) != tuple(asal[w])}
            if not pulih:
                break
            for w in pulih:
                for v in T["v_dari_w"][w]:
                    v.co = asal[w]
        for w in bobot:
            for v in T["v_dari_w"][w]:
                nolkan(v)
        return len(bobot)

    def satukan(T, ws):
        """Duplikat persis pada posisi las `ws` dijadikan satu verteks (UV per sudut tidak berubah)."""
        n = 0
        for w in ws:
            vs = T["v_dari_w"][w]
            if len(vs) > 1:
                bmesh.ops.pointmerge(bm, verts=vs, merge_co=vs[0].co.copy())
                n += len(vs) - 1
        return n

    # ----- 1. topologi las, komponen, cincin terbuka; pita lama dibuang -----
    T = topologi(bm, tol)
    co, wid, komp = T["co"], T["wid"], T["komp"]
    k_badan, k_kepala = komp[wid[int(np.argmin(co[:, 2]))]], komp[wid[int(np.argmax(co[:, 2]))]]
    if k_badan == k_kepala:
        raise SystemExit("[leher] kepala dan badan tersambung; skrip ini butuh kepala terpisah dari badan")
    for f, vs in zip(bm.faces, T["muka_w"]):
        f[lay_b] = KEPALA if komp[vs[0]] == k_kepala else BADAN
    kandidat = [lp for lp in T["loops"] if lp["komp"] == k_kepala and abs(lp["pusat"][2] - zp) < L["jendela_z_m"]]
    if not kandidat:
        raise SystemExit("[leher] tidak ada tepi terbuka di bawah kepala dekat --z-potong")
    sumbu = max(kandidat, key=lambda lp: len(lp["w"]))["pusat"].copy()
    dekat = [lp for lp in T["loops"] if abs(lp["pusat"][2] - zp) < L["jendela_z_m"]
             and np.hypot(*(lp["pusat"][:2] - sumbu[:2])) < L["radius_leher_m"]]
    hasil["cincin_terbuka"] = [{"bagian": "kepala" if lp["komp"] == k_kepala else "badan", "verteks": len(lp["w"]),
                                "z_m": round(float(lp["pusat"][2]), 4)} for lp in sorted(dekat, key=lambda lp: -len(lp["w"]))]
    catat(f"cincin terbuka di sekitar leher: {len(dekat)} -> {hasil['cincin_terbuka']}")
    kandidat_b = [lp for lp in dekat if lp["komp"] == k_badan and lp["sederhana"]]
    if not kandidat_b:
        raise SystemExit("[leher] tepi atas pita leher badan bukan cincin sederhana")
    atas_w = set(max(kandidat_b, key=lambda lp: len(lp["w"]))["w"])
    muka_pita = [f for f, vs in zip(bm.faces, T["muka_w"]) if komp[vs[0]] == k_badan and any(w in atas_w for w in vs)]
    bawah_w = sorted({w for f in muka_pita for w in (int(wid[v.index]) for v in f.verts)} - atas_w)
    z0 = float(np.median(T["wco"][bawah_w][:, 2]))
    pusat_awal = T["wco"][bawah_w].mean(0)
    x0 = float(sumbu[0])
    catat(f"pita lama: {len(muka_pita)} muka dibuang, pangkal z {z0:.4f} m")
    uk = L["tegak"]["ukur_z_m"]
    sudut_awal = sudut_sumbu(bm, uk[0], uk[1], x0, L["radius_leher_m"], pusat_awal, depan)
    sudut_awal_pangkal = sudut_sumbu(bm, uk[0], z0 - 0.002, x0, L["radius_leher_m"], pusat_awal, depan)
    bmesh.ops.delete(bm, geom=muka_pita, context="FACES")
    # Sekat dalam: muka datar yang menutup leher badan tepat di pangkal pita (sisa Bisect dengan Fill); kalau
    # dibiarkan, cincin atas badan bukan tepi terbuka dan tidak bisa disambung.
    sekat = [f for f in bm.faces if f[lay_b] == BADAN and all(abs(v.co.z - z0) < 0.0015 and
             math.hypot(v.co.x - pusat_awal[0], v.co.y - pusat_awal[1]) < L["radius_leher_m"] for v in f.verts)]
    if sekat:
        bmesh.ops.delete(bm, geom=sekat, context="FACES")
    hasil["sekat_dalam_muka"] = len(sekat)
    catat(f"sekat dalam di pangkal pita: {len(sekat)} muka dibuang")
    buang_yatim()

    # Kalung lama juga tercetak sebagai tonjolan tipis di mesh dada. Posisi 3D garisnya diambil dari texel
    # tekstur yang jelas gelap atau bukan kulit, lalu verteks badan di sekitarnya dihaluskan (tetangga las).
    Kl = L["kalung_lukis"]
    if Kl["aktif"]:
        from mathutils import Vector as _V
        from mathutils.kdtree import KDTree
        img0 = next(n for n in me.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].links[0].from_node.image
        W0, H0 = img0.size
        px0 = np.empty(W0 * H0 * 4, dtype=np.float32)
        img0.pixels.foreach_get(px0)
        px0 = px0.reshape(H0, W0, 4)
        tri_uv, tri_p = [], []
        for f in bm.faces:
            if f[lay_b] != BADAN:
                continue
            cz = f.calc_center_median()
            if not (z0 - Kl["tinggi_m"] - 0.02 < cz.z < z0 + 0.002) or math.hypot(cz.x - pusat_awal[0], cz.y - pusat_awal[1]) > Kl["radius_m"] + 0.02:
                continue
            ls_f = list(f.loops)
            for k in range(1, len(ls_f) - 1):
                tiga = (ls_f[0], ls_f[k], ls_f[k + 1])
                tri_uv.append([(l[lay_uv].uv.x * W0, l[lay_uv].uv.y * H0) for l in tiga])
                tri_p.append([l.vert.co[:] for l in tiga])
        pos0, isi0 = raster(np.array(tri_uv), np.array(tri_p), W0, H0)
        P0 = pos0[isi0].astype(np.float64)
        rgb0 = px0[..., :3][isi0].astype(np.float64)
        kulit0, L0 = topeng_kulit(rgb0, data.get("kulit", {})), srgb_ke_lab(rgb0)[:, 0]
        dz0 = z0 - P0[:, 2]
        dada0 = (dz0 > 0.01) & (dz0 < Kl["tinggi_m"]) & (np.hypot(P0[:, 0] - pusat_awal[0], P0[:, 1] - pusat_awal[1]) < Kl["radius_m"]) \
            & (((P0[:, :2] - pusat_awal[:2]) @ depan) > -0.02)
        kuat = dada0 & ((kulit0 < Kl["kulit_min"]) | (L0 < np.median(L0[dada0 & (kulit0 > 0.5)]) - Kl["ambang_kuat_L"]))
        garis = P0[kuat]
        n_rata = 0
        if len(garis) > 50:
            garis = garis[:: max(1, len(garis) // 6000)]
            kd = KDTree(len(garis))
            for k, q in enumerate(garis):
                kd.insert(_V(q), k)
            kd.balance()
            n_rata = haluskan_las(
                lambda w, q, T: 1.0 if q[2] < z0 - 0.004 and all(f[lay_b] == BADAN for f in T["v_dari_w"][w][0].link_faces)
                and kd.find(_V(q))[2] < Kl["ratakan_radius_m"] else None, Kl["ratakan_iterasi"], Kl["ratakan_faktor"])
        hasil["kalung_lukis_mesh"] = {"texel_garis": int(kuat.sum()), "verteks_diratakan": n_rata,
                                      "z_garis_m": [round(float(garis[:, 2].min()), 3), round(float(garis[:, 2].max()), 3)] if len(garis) else None}
        catat(f"tonjolan kalung lama di mesh diratakan: {hasil['kalung_lukis_mesh']}")

    # ----- 2. tegakkan leher: kepala ke belakang, pangkal leher badan bertahap -----
    Tg = L["tegak"]
    for v in bm.verts:
        if v.link_faces[0][lay_b] == KEPALA:
            g = Tg["geser_kepala_m"]
        else:
            wz = float(halus01((v.co.z - Tg["z_pangkal_m"]) / (z0 - Tg["z_pangkal_m"])))
            if wz <= 0:
                continue
            r = math.hypot(v.co.x - pusat_awal[0], v.co.y - pusat_awal[1])
            g = Tg["geser_leher_m"] * wz * (1 - float(halus01((r - Tg["radius_penuh_m"]) / (Tg["radius_nol_m"] - Tg["radius_penuh_m"]))))
        v.co.x += blk[0] * g
        v.co.y += blk[1] * g

    # ----- 2b. potong ulang atas leher badan dengan bidang miring -----
    # Atas leher badan hasil Tripo masih membawa sisa bawah dagu kepala lama (muka menghadap ke bawah di depan).
    # Bidang potong turun ke depan: di belakang tepat di bawah cincin lama, di depan turun_depan_m lebih rendah.
    Pb = L["potong_badan"]
    pusat_s = np.array([pusat_awal[0] + blk[0] * Tg["geser_leher_m"], pusat_awal[1] + blk[1] * Tg["geser_leher_m"]])
    s_cincin = [(np.array(v.co[:2]) - pusat_s) @ blk for v in bm.verts if v.link_faces[0][lay_b] == BADAN and abs(v.co.z - z0) < 0.0015
                and math.hypot(v.co.x - pusat_s[0], v.co.y - pusat_s[1]) < L["radius_leher_m"]]
    s_dp, s_blk = min(s_cincin), max(s_cincin)
    z_dp, z_blk = z0 - Pb["turun_depan_m"], z0 - Pb["turun_belakang_m"]
    k_b = (z_blk - z_dp) / (s_blk - s_dp)
    pb0 = np.array([pusat_s[0] + blk[0] * s_dp, pusat_s[1] + blk[1] * s_dp, z_dp])
    n_b = np.array([-k_b * blk[0], -k_b * blk[1], 1.0])
    n_b /= np.linalg.norm(n_b)

    def muka_leher_badan():
        return [f for f in bm.faces if f[lay_b] == BADAN and f.calc_center_median().z > z_dp - 0.03
                and math.hypot(f.calc_center_median().x - pusat_s[0], f.calc_center_median().y - pusat_s[1]) < L["radius_leher_m"]]
    muka_b = muka_leher_badan()
    geom = list({v for f in muka_b for v in f.verts}) + list({e for f in muka_b for e in f.edges}) + muka_b
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=tuple(pb0), plane_no=tuple(n_b), clear_inner=False, clear_outer=False)
    buang_b = [f for f in muka_leher_badan() if (np.array(f.calc_center_median()) - pb0) @ n_b > 1e-7]
    bmesh.ops.delete(bm, geom=buang_b, context="FACES")
    buang_yatim()
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.link_faces[0][lay_b] == BADAN and abs((np.array(v.co) - pb0) @ n_b) < 2e-5
                                        and math.hypot(v.co.x - pusat_s[0], v.co.y - pusat_s[1]) < L["radius_leher_m"]], dist=2e-5)
    hasil["potong_badan"] = {"titik_m": [round(float(v), 4) for v in pb0], "normal": [round(float(v), 4) for v in n_b],
                             "z_depan_m": round(z_dp, 4), "z_belakang_m": round(z_blk, 4), "muka_dibuang": len(buang_b)}
    catat(f"atas leher badan dipotong miring: depan z {z_dp:.3f}, belakang z {z_blk:.3f} m, {len(buang_b)} muka dibuang")

    # ----- 3. potong ulang bawah kepala dengan bidang miring mengikuti bawah rahang -----
    Rh = L["rahang"]
    T = topologi(bm, tol)
    wb = {}
    for f, vs in zip(bm.faces, T["muka_w"]):
        for w in vs:
            wb[w] = f[lay_b]
    tepi_lama = max((lp for lp in T["loops"] if wb[lp["w"][0]] == KEPALA and abs(lp["pusat"][2] - zp) < L["jendela_z_m"]),
                    key=lambda lp: len(lp["w"]))
    P = T["wco"][tepi_lama["w"]]
    c = P.mean(0)
    i_dp = int(np.argmax((P[:, :2] - c[:2]) @ depan))
    p0 = np.array([c[0], P[i_dp, 1], P[:, 2].min() + Rh["angkat_m"]])
    tg = math.tan(math.radians(Rh["sudut_derajat"]))
    n_bid = np.array([-tg * blk[0], -tg * blk[1], 1.0])
    n_bid /= np.linalg.norm(n_bid)
    muka_k = [f for f in bm.faces if f[lay_b] == KEPALA]
    geom = list({v for f in muka_k for v in f.verts}) + list({e for f in muka_k for e in f.edges}) + muka_k
    n_k0 = len(muka_k)
    # Permukaan potong = bidang miring, tetapi tidak naik lebih dari naik_maks_m (bidang datar di belakang
    # telinga, supaya rambut tengkuk tidak terpotong terlalu tinggi). Yang dibuang: di bawah kedua bidang.
    z_dtr = float(p0[2] + Rh["naik_maks_m"])

    def di_atas_potong(p):
        """Tinggi di atas permukaan potong (positif = bagian kepala yang dipertahankan)."""
        p = np.asarray(p, dtype=float)
        return np.maximum((p - p0) @ n_bid, p[..., 2] - z_dtr)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=tuple(p0), plane_no=tuple(n_bid), clear_inner=False, clear_outer=False)
    muka_k = [f for f in bm.faces if f[lay_b] == KEPALA]
    geom = list({v for f in muka_k for v in f.verts}) + list({e for f in muka_k for e in f.edges}) + muka_k
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0.0, 0.0, z_dtr), plane_no=(0.0, 0.0, 1.0), clear_inner=False, clear_outer=False)
    buang = [f for f in bm.faces if f[lay_b] == KEPALA and di_atas_potong(f.calc_center_median()) < -1e-7]
    bmesh.ops.delete(bm, geom=buang, context="FACES")
    buang_yatim()
    di_bidang = [v for v in bm.verts if v.link_faces[0][lay_b] == KEPALA and abs(di_atas_potong(v.co)) < 2e-5]
    bmesh.ops.remove_doubles(bm, verts=di_bidang, dist=2e-5)
    hasil["rahang"] = {"titik_m": [round(float(v), 4) for v in p0], "normal": [round(float(v), 4) for v in n_bid],
                       "z_datar_m": round(z_dtr, 4), "muka_dibuang": len(buang)}
    catat(f"bawah kepala dipotong bidang miring {Rh['sudut_derajat']} derajat lewat {np.round(p0, 3)}: {len(buang)} muka dibuang "
          f"(kepala {n_k0} muka sebelum potong)")

    def cincin(T, bagian):
        wb = {}
        for f, vs in zip(bm.faces, T["muka_w"]):
            for w in vs:
                wb[w] = f[lay_b]
        ada = [lp for lp in T["loops"] if wb[lp["w"][0]] == bagian and abs(lp["pusat"][2] - zp) < L["jendela_z_m"]
               and np.hypot(*(lp["pusat"][:2] - c[:2])) < L["radius_leher_m"]]
        if not ada:
            if os.environ.get("LEHER_DEBUG"):
                for x in sorted(T["loops"], key=lambda x: -len(x["w"]))[:12]:
                    print("[leher] loop", len(x["w"]), "bagian", wb[x["w"][0]], np.round(x["pusat"], 3), x["sederhana"], flush=True)
            raise SystemExit(f"[leher] cincin sambungan bagian {bagian} tidak ditemukan")
        lp = max(ada, key=lambda lp: len(lp["w"]))
        if not lp["sederhana"] and os.environ.get("LEHER_DEBUG"):
            for w, n in lp["cabang"]:
                print("[leher] cabang", n, np.round(T["wco"][w], 4), "sudut", round(math.degrees(math.atan2(T["wco"][w][1] - c[1], T["wco"][w][0] - c[0]))), flush=True)
        if not lp["sederhana"]:
            raise SystemExit(f"[leher] cincin sambungan bagian {bagian} bukan loop sederhana ({len(lp['w'])} verteks)")
        return lp, [(len(x["w"]), round(float(x["pusat"][2]), 3)) for x in ada]

    # Verteks tepi yang nyaris berimpit (sisa potongan dan jahitan garis tengah, selisih di bawah las_cincin_m)
    # dilas dulu: hanya verteks yang ada di tepi terbuka sekitar leher, bukan seluruh kepala atau badan.
    T = topologi(bm, tol)
    wb = {}
    for f, vs in zip(bm.faces, T["muka_w"]):
        for w in vs:
            wb[w] = f[lay_b]
    n_tepi = len(bm.verts)
    for bagian in (KEPALA, BADAN):   # tiap bagian sendiri, supaya kepala dan badan tidak pernah saling dilas
        tepi_v = [v for lp in T["loops"] if wb[lp["w"][0]] == bagian and abs(lp["pusat"][2] - zp) < L["jendela_z_m"]
                  and np.hypot(*(lp["pusat"][:2] - c[:2])) < L["radius_leher_m"] for w in lp["w"] for v in T["v_dari_w"][w]]
        bmesh.ops.remove_doubles(bm, verts=tepi_v, dist=L["las_cincin_m"])
    n_tepi -= len(bm.verts)
    # duplikat persis di kedua cincin disatukan, lalu cincin diambil ulang (satu verteks per posisi)
    T = topologi(bm, tol)
    n_sat = satukan(T, cincin(T, KEPALA)[0]["w"])
    T = topologi(bm, tol)
    n_sat += satukan(T, cincin(T, BADAN)[0]["w"])
    T = topologi(bm, tol)
    lp_k, semua_k = cincin(T, KEPALA)
    lp_b, semua_b = cincin(T, BADAN)
    catat(f"cincin sambungan: kepala {len(lp_k['w'])} verteks (loop kepala di sekitar leher: {semua_k}), "
          f"badan {len(lp_b['w'])} verteks; {n_sat + n_tepi} duplikat disatukan")

    def urut(lp):
        ws = list(lp["w"])
        Pp = T["wco"][ws]
        if luas_xy(Pp) < 0:
            ws.reverse()
        return [T["v_dari_w"][w][0] for w in ws]
    vt, vb = urut(lp_k), urut(lp_b)
    # tepi kepala dihaluskan ringan sepanjang cincin (sisa gerigi potongan lama di atas bidang)
    R = np.array([v.co[:] for v in vt])
    R0 = R.copy()
    for _ in range(Rh["halus_iterasi"]):
        R = R + Rh["halus_faktor"] * (0.5 * (np.roll(R, 1, 0) + np.roll(R, -1, 0)) - R)
    for v, p in zip(vt, R):
        v.co = p
    hasil["rahang"]["geser_tepi_maks_mm"] = round(float(np.linalg.norm(R - R0, axis=1).max()) * 1000, 1)
    for v in vt + vb:
        nolkan(v)
    Bq = np.array([v.co[:] for v in vb])
    c_t, c_b = R.mean(0), Bq.mean(0)

    # ----- 4. sambungan: cincin perantara, lalu jahit baris demi baris -----
    K, N = L["kolom"], L["ruas"]

    def baris_cincin(verts, Pp, pusat, t):
        s = np.arctan2(Pp[:, 1] - pusat[1], Pp[:, 0] - pusat[0])
        k0 = int(np.argmin(s))
        s, verts = np.roll(s, -k0), verts[k0:] + verts[:k0]
        s = np.maximum.accumulate(s)
        return [(v, float(x), t) for v, x in zip(verts, s)]
    sdt = -math.pi + 2 * math.pi * (np.arange(K) + 0.5) / K
    arah = np.stack([np.cos(sdt), np.sin(sdt)], axis=1)
    bawahP = np.array([contoh_radial(Bq, c_b, s) for s in sdt])
    atasP = np.array([contoh_radial(R, c_t, s) for s in sdt])
    r_b = np.linalg.norm(bawahP[:, :2] - c_b[:2], axis=1)
    r_t = np.linalg.norm(atasP[:, :2] - c_t[:2], axis=1)
    tinggi = np.maximum(atasP[:, 2] - bawahP[:, 2], 1e-4)
    dr = r_t - r_b
    # kolom yang melebar ke atas (dagu, rambut tengkuk): tetap ramping lalu membuka dengan kemiringan
    # sudut_bawah_dagu_derajat di tepi kepala; kolom yang menyempit: lurus
    tan_a = math.tan(math.radians(L["sudut_bawah_dagu_derajat"]))
    pangkat = np.where(dr > 1e-4, np.clip(tinggi / (tan_a * np.maximum(dr, 1e-4)), 1.0, L["pangkat_maks"]), 1.0)
    phi = np.arccos(np.clip(arah @ depan, -1, 1))
    o0, o1 = (math.radians(v) for v in L["otot_sudut_derajat"])
    G = np.zeros((N + 1, K, 3))
    for i in range(N + 1):
        t = i / N
        pusat_i = c_b[:2] + (c_t[:2] - c_b[:2]) * t
        r = r_b + dr * t ** pangkat - L["cekung_m"] * math.sin(math.pi * t)
        r += L["otot_m"] * math.sin(math.pi * t) * np.exp(-0.5 * ((phi - (o0 + (o1 - o0) * t)) / math.radians(L["otot_lebar_derajat"])) ** 2)
        G[i, :, :2] = pusat_i + arah * r[:, None]
        G[i, :, 2] = bawahP[:, 2] + (atasP[:, 2] - bawahP[:, 2]) * t
    G[0], G[N] = bawahP, atasP
    for _ in range(L["halus_iterasi"]):
        rata = (np.roll(G, 1, 1) + np.roll(G, -1, 1) + np.roll(G, 1, 0) + np.roll(G, -1, 0)) / 4
        G[1:N] += L["halus_faktor"] * (rata[1:N] - G[1:N])
    if os.environ.get("LEHER_DEBUG"):
        for nama, sd_uji in (("depan", sudut_depan), ("samping", sudut_depan + math.pi / 2), ("belakang", sudut_depan + math.pi)):
            j = int(np.argmin(np.abs(np.angle(np.exp(1j * (sdt - sd_uji))))))
            print(f"[leher] profil {nama}: r_b {r_b[j]:.3f} r_t {r_t[j]:.3f} pangkat {pangkat[j]:.2f} | " + " ".join(
                f"(r {np.linalg.norm(G[i, j, :2] - (c_b[:2] + (c_t[:2] - c_b[:2]) * i / N)):.3f} y {G[i, j, 1]:+.3f} z {G[i, j, 2]:.3f})" for i in range(N + 1)), flush=True)
        print("[leher] pusat c_b", np.round(c_b, 3), "c_t", np.round(c_t, 3), flush=True)
    baris = [baris_cincin(vb, Bq, c_b, 0.0)]
    for i in range(1, N):
        baris.append([(bm.verts.new(G[i, j]), float(sdt[j]), i / N) for j in range(K)])
    baris.append(baris_cincin(vt, R, c_t, 1.0))
    U_MAKS = 1.06
    muka_baru = []
    for ba, bb in zip(baris[:-1], baris[1:]):
        for tiga in jahit(ba, bb):
            vs = [x[0] for x in tiga]
            if len(set(vs)) < 3:
                continue
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            for l, (_, s, t) in zip(f.loops, tiga):
                l[lay_uv].uv = ((s + math.pi) / (2 * math.pi) / U_MAKS, t)
            f[lay_b], f.smooth, f.material_index = PITA, True, 0
            muka_baru.append(f)
    bm.normal_update()
    pusat_m = (c_b[:2] + c_t[:2]) / 2
    if np.mean([(np.array(f.calc_center_median()[:2]) - pusat_m) @ np.array(f.normal[:2]) for f in muka_baru]) < 0:
        bmesh.ops.reverse_faces(bm, faces=muka_baru)
    if os.environ.get("LEHER_DEBUG"):
        bm.normal_update()
        for v in vb:
            rad = np.array([v.co.x - c_b[0], v.co.y - c_b[1]])
            rad /= np.linalg.norm(rad)
            aneh = [(f[lay_b], round(float(np.array(f.normal[:2]) @ rad), 2), round(f.normal.z, 2), round(f.calc_area() * 1e4, 2)) for f in v.link_faces
                    if np.array(f.normal[:2]) @ rad < 0.2]
            tepi = [len(e.link_faces) for e in v.link_edges if len(e.link_faces) != 2]
            if aneh or tepi:
                print("[leher] cincin badan", np.round(v.co, 3), "muka aneh (bagian, n.radial, n.z, luas cm2):", aneh, "tepi bukan 2 muka:", tepi, flush=True)
    # Pangkal sambungan dihaluskan (cincin badan dan badan sampai halus_pangkal_m di bawahnya, memudar ke bawah).
    def bobot_pangkal(w, q, T):
        if math.hypot(q[0] - c_b[0], q[1] - c_b[1]) > L["radius_leher_m"] + 0.02:
            return None
        if any(f[lay_b] not in (BADAN, PITA) for f in T["v_dari_w"][w][0].link_faces):
            return None
        dalam = -float((q - pb0) @ n_b)
        return float(halus01(1 - dalam / L["halus_pangkal_m"])) if -0.001 < dalam < L["halus_pangkal_m"] else None
    n_pangkal = haluskan_las(bobot_pangkal, L["halus_pangkal_iterasi"], L["halus_faktor"])
    bm.normal_update()
    sudut_akhir = sudut_sumbu(bm, uk[0], uk[1], x0, L["radius_leher_m"], c_b, depan)
    sudut_akhir_pangkal = sudut_sumbu(bm, uk[0], z0 - 0.002, x0, L["radius_leher_m"], c_b, depan)
    bulat = lambda v: None if v is None else round(v, 1)
    hasil["tegak"] = {"sumbu_derajat_sebelum": bulat(sudut_awal), "sumbu_derajat_sesudah": bulat(sudut_akhir),
                      "pangkal_derajat_sebelum": bulat(sudut_awal_pangkal), "pangkal_derajat_sesudah": bulat(sudut_akhir_pangkal),
                      "geser_kepala_m": Tg["geser_kepala_m"], "geser_leher_m": Tg["geser_leher_m"],
                      "z_pangkal_m": Tg["z_pangkal_m"], "arah_belakang": [float(blk[0]), float(blk[1])]}
    hasil["pita"] = {"z0_m": round(z0, 4), "sumbu_m": [round(float(v), 4) for v in c_b[:2]], "segitiga": len(muka_baru),
                     "verteks_pangkal_dihaluskan": n_pangkal,
                     "kolom": K, "ruas": N, "cincin_kepala": len(vt), "cincin_badan": len(vb),
                     "tinggi_m": [round(float(tinggi.min()), 3), round(float(tinggi.max()), 3)]}
    catat(f"sambungan: {len(muka_baru)} segitiga, tinggi {hasil['pita']['tinggi_m']} m; sumbu leher {hasil['tegak']}")

    # ----- 5. kalung -----
    Kg = L["kalung"]
    if Kg["aktif"]:
        from mathutils import Vector
        from mathutils.bvhtree import BVHTree
        bvh = BVHTree.FromBMesh(bm)
        S, jr, jarak = Kg["segmen"], Kg["jari_m"], Kg["jari_m"] + Kg["celah_m"]
        sd = -math.pi + 2 * math.pi * np.arange(S) / S
        Pk, luar = [], []

        def tembak(s, z):
            d = np.array([math.cos(s), math.sin(s)])
            asal = Vector((c_b[0] + d[0] * 0.5, c_b[1] + d[1] * 0.5, z))
            ke = Vector((-d[0], -d[1], 0.0))
            loc, nrm, _, _ = bvh.ray_cast(asal, ke, 0.7)
            if loc is None:
                return None, None
            if nrm.dot(ke) > 0:
                nrm = -nrm
            return np.array(loc), np.array(nrm)
        for s in sd:
            f_dp = (1 + math.cos(s - sudut_depan)) / 2
            loc, nrm = tembak(s, z0 + Kg["naik_belakang_m"] - Kg["turun_depan_m"] * f_dp)
            if loc is None:
                raise SystemExit("[leher] sinar kalung tidak mengenai badan")
            Pk.append(loc + nrm * jarak)
            luar.append(nrm)
        Pk, luar = np.array(Pk), np.array(luar)
        for _ in range(Kg["halus_iterasi"]):
            Pk = 0.5 * Pk + 0.25 * (np.roll(Pk, 1, 0) + np.roll(Pk, -1, 0))
            for k in range(S):   # kembalikan ke jarak tetap dari kulit
                loc, nrm, _, _ = bvh.find_nearest(Vector(Pk[k]))
                d = Pk[k] - np.array(loc)
                pj = np.linalg.norm(d)
                o = d / pj if pj > 1e-6 and d @ np.array(nrm) > 0 else np.array(nrm)
                Pk[k], luar[k] = np.array(loc) + o * jarak, o
        sisi = Kg["sisi"]
        cincin_k = []
        for k in range(S):
            tg_k = Pk[(k + 1) % S] - Pk[k - 1]
            tg_k /= np.linalg.norm(tg_k)
            n1 = luar[k] - (luar[k] @ tg_k) * tg_k
            n1 /= np.linalg.norm(n1)
            n2 = np.cross(tg_k, n1)
            cincin_k.append([bm.verts.new(Pk[k] + jr * (math.cos(q) * n1 + math.sin(q) * n2))
                             for q in 2 * math.pi * np.arange(sisi) / sisi])
        muka_kalung = []
        for k in range(S):
            k1 = (k + 1) % S
            for q in range(sisi):
                q1 = (q + 1) % sisi
                muka_kalung.append(bm.faces.new((cincin_k[k][q], cincin_k[k1][q], cincin_k[k1][q1], cincin_k[k][q1])))
        bmesh.ops.recalc_face_normals(bm, faces=muka_kalung)
        for f in muka_kalung:
            f[lay_b], f.smooth, f.material_index = KALUNG, True, 1
        # liontin: oktahedron pipih menempel ke dada di bawah titik terdepan
        k_dp = int(np.argmax((Pk[:, :2] - c_b[:2]) @ depan))
        lx, ly, lz = Kg["liontin_m"]
        loc, nrm = tembak(sudut_depan, Pk[k_dp, 2] - jr - lz - 0.002)
        muka_liontin = []
        if loc is not None:
            atas = np.array([0, 0, 1.0]) - nrm[2] * nrm
            atas /= np.linalg.norm(atas)
            smp = np.cross(nrm, atas)
            pusat_l = loc + nrm * (ly + 0.0015)
            v6 = [bm.verts.new(pusat_l + d) for d in (smp * lx, -smp * lx, nrm * ly, -nrm * ly, atas * lz, -atas * lz)]
            for sx in (0, 1):
                for sy in (2, 3):
                    for sz in (4, 5):
                        muka_liontin.append(bm.faces.new((v6[sx], v6[sy], v6[sz])))
            bmesh.ops.recalc_face_normals(bm, faces=muka_liontin)
            for f in muka_liontin:
                f[lay_b], f.smooth, f.material_index = LIONTIN, False, 1
        for f in muka_kalung + muka_liontin:
            for l in f.loops:
                l[lay_uv].uv = (0.0, 0.0)
        hasil["kalung"] = {"segitiga": len(muka_kalung) * 2 + len(muka_liontin),
                           "z_belakang_m": round(float(Pk[:, 2].max()), 4), "z_depan_m": round(float(Pk[:, 2].min()), 4),
                           "jari_dari_sumbu_m": [round(float(v), 3) for v in (np.linalg.norm(Pk[:, :2] - c_b[:2], axis=1).min(),
                                                                             np.linalg.norm(Pk[:, :2] - c_b[:2], axis=1).max())]}
        catat(f"kalung: {hasil['kalung']}")

    for v in bm.verts:
        v[lay_r] = int(v.co.z < L["decimate_z_maks_m"] and all(f[lay_b] == BADAN for f in v.link_faces))
    bm.to_mesh(me)
    bm.free()
    if Kg["aktif"]:
        emas = bpy.data.materials.new("emas")
        emas.use_nodes = True
        b = next(n for n in emas.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        srgb = np.array(Kg["warna_srgb"]) / 255.0
        lin = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
        b.inputs["Base Color"].default_value = (*[float(v) for v in lin], 1.0)
        b.inputs["Metallic"].default_value = Kg["metallic"]
        b.inputs["Roughness"].default_value = Kg["roughness"]
        me.materials.append(emas)

    # ----- 6. ringankan badan bawah sampai anggaran segitiga -----
    def segitiga():
        me.calc_loop_triangles()
        return len(me.loop_triangles)

    def posisi():
        p = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", p)
        return p.reshape(-1, 3)

    def atribut_int(nama, n):
        x = np.empty(n, dtype=np.int32)
        me.attributes[nama].data.foreach_get("value", x)
        return x
    from mathutils import Vector as _V2
    from mathutils.kdtree import KDTree as _KD
    img_bc = next(n for n in me.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].links[0].from_node.image
    Wb, Hb = img_bc.size
    px_bc = np.empty(Wb * Hb * 4, dtype=np.float32)
    img_bc.pixels.foreach_get(px_bc)
    px_bc = px_bc.reshape(Hb, Wb, 4)

    def kulit_muka():
        """Per segitiga badan bawah: titik tengah dan apakah warna tekstur di tengah UV-nya kulit."""
        me.calc_loop_triangles()
        n = len(me.loop_triangles)
        tl_ = np.empty(n * 3, dtype=np.int32)
        me.loop_triangles.foreach_get("loops", tl_)
        tl_ = tl_.reshape(-1, 3)
        lv_ = np.empty(len(me.loops), dtype=np.int32)
        me.loops.foreach_get("vertex_index", lv_)
        uv_ = np.empty(len(me.loops) * 2)
        me.uv_layers.active.data.foreach_get("uv", uv_)
        uv_ = uv_.reshape(-1, 2)
        tengah = posisi()[lv_[tl_]].mean(1)
        ut = uv_[tl_].mean(1)
        warna = px_bc[np.clip((ut[:, 1] * Hb).astype(int), 0, Hb - 1), np.clip((ut[:, 0] * Wb).astype(int), 0, Wb - 1), :3]
        m = tengah[:, 2] < L["decimate_z_maks_m"] + 0.02
        return tengah[m], topeng_kulit(warna[m].astype(np.float64), data.get("kulit", {}))
    def muka_janggal():
        """Muka badan yang normal mukanya berlawanan dengan rata-rata normal semua muka di sedikitnya dua pertiga
        sudutnya (posisi las): [(indeks, titik tengah)]."""
        nf_ = len(me.polygons)
        lt_ = np.empty(nf_, dtype=np.int32)
        me.polygons.foreach_get("loop_total", lt_)
        fn_, fc_, fa_ = np.empty(nf_ * 3), np.empty(nf_ * 3), np.empty(nf_)
        me.polygons.foreach_get("normal", fn_)
        me.polygons.foreach_get("center", fc_)
        me.polygons.foreach_get("area", fa_)
        fn_, fc_ = fn_.reshape(-1, 3), fc_.reshape(-1, 3)
        mdl_ = np.repeat(np.arange(nf_), lt_)
        lv2 = np.empty(len(me.loops), dtype=np.int32)
        me.loops.foreach_get("vertex_index", lv2)
        _, kid2 = np.unique(las(posisi(), tol)[lv2], return_inverse=True)
        akum2 = np.zeros((kid2.max() + 1, 3))
        np.add.at(akum2, kid2, (fn_ * fa_[:, None])[mdl_])
        rata2 = akum2[kid2]
        rata2 /= np.maximum(np.linalg.norm(rata2, axis=1, keepdims=True), 1e-12)
        lawan = np.zeros(nf_)
        np.add.at(lawan, mdl_, (np.einsum("ij,ij->i", rata2, fn_[mdl_]) < -0.5).astype(float))
        idx = np.nonzero((lawan >= np.ceil(lt_ * 2 / 3)) & (atribut_int("bagian", nf_) == BADAN) & (fc_[:, 2] < z0) & (fa_ > 1e-8))[0]
        return [(int(i), fc_[i]) for i in idx]
    n_tri = segitiga()
    hasil["segitiga_sebelum_ringan"] = n_tri
    janggal_sebelum = muka_janggal()
    kd_j = _KD(max(len(janggal_sebelum), 1))
    for k, (_, q) in enumerate(janggal_sebelum):
        kd_j.insert(_V2(q), k)
    kd_j.balance()
    tengah0, kulit0_m = kulit_muka()
    kd0 = _KD(len(tengah0))
    for k, q in enumerate(tengah0):
        kd0.insert(_V2(q), k)
    kd0.balance()

    def muka_rusak():
        """Muka yang sebelum Decimate bertekstur kulit tetapi sesudahnya tidak: UV-nya terlempar ke pulau lain."""
        tengah, kulit_m = kulit_muka()
        out = []
        for q, kk in zip(tengah, kulit_m):
            if kk < 0.3:
                _, idx, jarak = kd0.find(_V2(q))
                if jarak < 0.02 and kulit0_m[idx] > 0.6:
                    out.append(q)
        return np.array(out).reshape(-1, 3)
    atas_sebelum = int((atribut_int("ringan", len(me.vertices)) == 0).sum())
    hasil["decimate_ulang"] = 0
    if n_tri > L["segitiga_maks"]:
        for percobaan in range(6):
            cadangan = me.copy()
            putaran = 0
            while n_tri > L["segitiga_maks"] and putaran < 4:
                grup = obj.vertex_groups.new(name="ringan")
                grup.add([int(i) for i in np.nonzero(atribut_int("ringan", len(me.vertices)) == 1)[0]], 1.0, "REPLACE")
                mod = obj.modifiers.new("Ringan", "DECIMATE")
                mod.decimate_type = "COLLAPSE"
                mod.ratio = (L["segitiga_maks"] - 20) / n_tri
                mod.vertex_group = "ringan"
                mod.use_collapse_triangulate = True
                bpy.ops.object.modifier_apply(modifier="Ringan")
                obj.vertex_groups.remove(obj.vertex_groups["ringan"])
                n_tri = segitiga()
                putaran += 1
            rusak = muka_rusak()
            if os.environ.get("LEHER_DEBUG"):
                print("[leher] rusak sesudah decimate:", np.round(rusak, 2).tolist(), flush=True)
            if not len(rusak):
                bpy.data.meshes.remove(cadangan)
                break
            # Decimate merentangkan UV beberapa muka melintasi pulau: kembali ke cadangan, lindungi verteks di
            # sekitar muka itu, ulangi.
            catat(f"decimate percobaan {percobaan + 1}: {len(rusak)} muka dengan UV rusak, diulang dengan daerah itu dilindungi")
            lama_me = obj.data
            obj.data = cadangan
            bpy.data.meshes.remove(lama_me)
            me = obj.data
            kd = _KD(len(rusak))
            for k, q in enumerate(rusak):
                kd.insert(_V2(q), k)
            kd.balance()
            ring = atribut_int("ringan", len(me.vertices))
            pv = posisi()
            for i in np.nonzero(ring == 1)[0]:
                if kd.find(_V2(pv[i]))[2] < L["lindung_radius_m"]:
                    ring[i] = 0
            me.attributes["ringan"].data.foreach_set("value", ring)
            atas_sebelum = int((ring == 0).sum())
            n_tri = segitiga()
            hasil["decimate_ulang"] = percobaan + 1
        else:
            raise SystemExit("[leher] decimate terus merusak UV; naikkan segitiga_maks atau matikan peringanan")
    atas_sesudah = int((atribut_int("ringan", len(me.vertices)) == 0).sum())
    hasil["segitiga"] = n_tri
    catat(f"segitiga {hasil['segitiga_sebelum_ringan']} -> {n_tri} (decimate badan di bawah {L['decimate_z_maks_m']} m, "
          f"diulang {hasil['decimate_ulang']} kali); verteks di luar daerah itu {atas_sebelum} -> {atas_sesudah}")
    if atas_sesudah != atas_sebelum:
        raise SystemExit("[leher] decimate menyentuh verteks di luar daerah yang boleh diringankan; hentikan")
    me.attributes.remove(me.attributes["ringan"])

    # Decimate kadang membalik arah muka di lipatan (ketiak, kain). Muka seperti itu tampak gelap (atau berlubang
    # di game), jadi arah putarnya dibalik lagi. Yang dibalik hanya muka yang janggal SESUDAH decimate dan tidak
    # janggal sebelumnya (dibandingkan lewat titik tengah), supaya keadaan asli mesh tidak ikut diubah.
    janggal_sesudah = muka_janggal()
    terbalik = [i for i, q in janggal_sesudah if not len(janggal_sebelum) or kd_j.find(_V2(q))[2] > 0.004]
    if len(terbalik):
        bm2 = bmesh.new()
        bm2.from_mesh(me)
        bm2.faces.ensure_lookup_table()
        bmesh.ops.reverse_faces(bm2, faces=[bm2.faces[int(i)] for i in terbalik])
        bm2.to_mesh(me)
        bm2.free()
    hasil["muka_dibalik"] = int(len(terbalik))
    catat(f"muka terbalik akibat decimate dibetulkan: {len(terbalik)} (janggal sebelum decimate {len(janggal_sebelum)}, sesudah {len(janggal_sesudah)})")

    # ----- data per sudut dari mesh akhir -----
    nl, nf = len(me.loops), len(me.polygons)
    lv = np.empty(nl, dtype=np.int32)
    me.loops.foreach_get("vertex_index", lv)
    lt = np.empty(nf, dtype=np.int32)
    me.polygons.foreach_get("loop_total", lt)
    muka_dari_loop = np.repeat(np.arange(nf), lt)
    bag = atribut_int("bagian", nf)
    bag_l = bag[muka_dari_loop]
    co = posisi()
    fn, fa = np.empty(nf * 3), np.empty(nf)
    me.polygons.foreach_get("normal", fn)
    me.polygons.foreach_get("area", fa)
    fn = fn.reshape(-1, 3)

    # ----- 7. normal: asli dipertahankan; sudut baru dihitung halus per posisi las, melintasi sambungan -----
    Nrm = np.empty(nl * 3, dtype=np.float32)
    me.attributes["n_asli"].data.foreach_get("vector", Nrm)
    Nrm = Nrm.reshape(-1, 3).astype(np.float64)
    pj = np.linalg.norm(Nrm, axis=1)
    baru = pj < 0.5
    Nrm[~baru] /= pj[~baru, None]
    # Normal asli yang menyimpang jauh dari arah mukanya (hasil interpolasi Decimate) dihitung ulang juga;
    # kalau dibiarkan muka itu tampak gelap saat disinari.
    menyimpang = ~baru & (np.einsum("ij,ij->i", Nrm, fn[muka_dari_loop]) < L["normal_sudut_min_cos"])
    hasil["normal_menyimpang"] = int(menyimpang.sum())
    baru |= menyimpang
    kelompok = np.where(bag_l <= PITA, 0, bag_l)   # badan, kepala, dan pita satu permukaan
    _, kid = np.unique(las(co, tol)[lv].astype(np.int64) * 8 + kelompok, return_inverse=True)
    akum = np.zeros((kid.max() + 1, 3))
    np.add.at(akum, kid, (fn * fa[:, None])[muka_dari_loop])
    halusN = akum[kid]
    halusN /= np.maximum(np.linalg.norm(halusN, axis=1, keepdims=True), 1e-12)
    Nrm[baru] = halusN[baru]
    Nrm[bag_l == LIONTIN] = fn[muka_dari_loop][bag_l == LIONTIN]
    me.attributes.remove(me.attributes["n_asli"])
    me.normals_split_custom_set([tuple(v) for v in Nrm])
    catat(f"normal: {int(baru.sum())} sudut dihitung ulang dari {nl} ({hasil['normal_menyimpang']} karena menyimpang dari arah muka)")

    # ----- 8. tekstur -----
    mat = me.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex_bc = bsdf.inputs["Base Color"].links[0].from_node
    nmap = next((n for n in nt.nodes if n.type == "NORMAL_MAP"), None)
    tex_n = nmap.inputs["Color"].links[0].from_node if nmap else None

    def piksel(img):
        w, h = img.size
        p = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(p)
        return p.reshape(h, w, 4)
    px = piksel(tex_bc.image)
    H, W = px.shape[:2]
    uvl = me.uv_layers.active.data
    uv = np.empty(nl * 2)
    uvl.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    nt3 = len(me.loop_triangles)
    tl, tp = np.empty(nt3 * 3, dtype=np.int32), np.empty(nt3, dtype=np.int32)
    me.loop_triangles.foreach_get("loops", tl)
    me.loop_triangles.foreach_get("polygon_index", tp)
    tl = tl.reshape(-1, 3)
    lama = bag[tp] <= KEPALA
    atr = np.concatenate([co[lv[tl[lama]]], bag[tp[lama]][:, None, None].repeat(3, 1).astype(float) + 1], axis=2)
    peta, isi = raster(uv[tl[lama]] * [W, H], atr, W, H)
    pos, bagian_px = peta[..., :3].astype(np.float64), np.rint(peta[..., 3]).astype(int) - 1   # -1 = kosong
    mg = L["margin_px"]
    terisi = jumlah_kotak(isi, mg) > 0

    def tempat(w, h):
        skala = 1.0
        while skala > 0.3:
            ww, hh = int(w * skala), int(h * skala)
            xy = cari_kotak(terisi, ww + 2 * mg, hh + 2 * mg)
            if xy:
                terisi[xy[1]:xy[1] + hh + 2 * mg, xy[0]:xy[0] + ww + 2 * mg] = True
                return xy[0] + mg, xy[1] + mg, ww, hh
            skala *= 0.85
        raise SystemExit("[leher] atlas UV tidak punya ruang kosong untuk pulau baru")
    px_pita = tempat(*L["uv_pita_px"])
    hasil["uv"] = {"pita_px": list(px_pita)}
    m = bag_l == PITA
    uv[m] = (np.array(px_pita[:2]) + uv[m] * px_pita[2:]) / [W, H]
    uvl.foreach_set("uv", uv.ravel())

    Kk = data.get("kulit", {})
    rgb = px[..., :3].astype(np.float64)
    kulit = topeng_kulit(rgb, Kk)
    lab = srgb_ke_lab(rgb)
    lab_baru = lab.copy()
    ubah = np.zeros((H, W), dtype=bool)
    NT = 128
    badan_px, kepala_px = isi & (bagian_px == BADAN), isi & (bagian_px == KEPALA)

    def kolom_sudut(pusat):
        th = np.arctan2(pos[..., 1] - pusat[1], pos[..., 0] - pusat[0])
        return np.clip(((th + math.pi) / (2 * math.pi) * NT).astype(int), 0, NT - 1)

    def rata_sudut(m, kol, min_n):
        """Rata-rata Lab per sudut dari texel `m`; kolom kosong diisi tetangga (melingkar) dan dihaluskan."""
        jml, cnt = np.zeros((NT, 3)), np.zeros(NT)
        np.add.at(jml, kol[m], lab[m])
        np.add.at(cnt, kol[m], 1)
        ada = cnt >= min_n
        if not ada.any():
            return None, ada
        g = np.where(ada[:, None], jml / np.maximum(cnt[:, None], 1), 0)
        tahu = ada.astype(float)
        for _ in range(NT):
            if tahu.min() > 0:
                break
            sj = np.roll(g * tahu[:, None], 1, 0) + np.roll(g * tahu[:, None], -1, 0)
            sa = np.roll(tahu, 1) + np.roll(tahu, -1)
            kosong = (tahu == 0) & (sa > 0)
            g[kosong] = sj[kosong] / sa[kosong][:, None]
            tahu[kosong] = 1
        for _ in range(6):
            g = (2 * g + np.roll(g, 1, 0) + np.roll(g, -1, 0)) / 4
        return g, ada
    kol_b, kol_k = kolom_sudut(c_b), kolom_sudut(c_t)
    r_px = np.hypot(pos[..., 0] - c_b[0], pos[..., 1] - c_b[1])
    dz_b = -((pos - pb0) @ n_b)                          # kedalaman di bawah bidang potong leher badan
    dp_k = di_atas_potong(pos)                           # tinggi di atas permukaan potong kepala
    leher_px = badan_px & (dz_b >= -0.008) & (r_px < L["radius_leher_m"] + 0.02)   # cincin sedikit bergeser saat dihaluskan
    # Kalung lukis di dada (dan garis gelap tipis lain di kulit dada atas) dihapus dulu: texel yang gelap
    # terhadap median dada, gelap terhadap rata-rata kulit di sekitarnya, atau bukan kulit, diisi dari kulit
    # sekitarnya. Warna leher untuk sambungan diukur sesudahnya.
    Kl = L["kalung_lukis"]
    hapus = np.zeros((H, W), dtype=bool)
    if Kl["aktif"]:
        dada = badan_px & (dz_b >= 0) & (dz_b < Kl["tinggi_m"]) & (r_px < Kl["radius_m"]) \
            & (((pos[..., :2] - c_b[:2]) @ depan) > -0.02)
        Lk = lab[..., 0]
        m_kulit = badan_px & (kulit > 0.5)
        L_med = float(np.median(Lk[dada & (kulit > 0.5)]))
        cnt = jumlah_kotak(m_kulit, Kl["jendela_px"])
        L_lokal = jumlah_kotak(Lk * m_kulit, Kl["jendela_px"]) / np.maximum(cnt, 1)
        inti = dada & ((Lk < L_med - Kl["ambang_L"]) | (kulit < Kl["kulit_min"])
                       | ((cnt > 20) & (Lk < L_lokal - Kl["ambang_lokal_L"])))
        hapus = (jumlah_kotak(inti, Kl["lebar_px"]) > 0) & dada
        # Isian dari medan warna kulit di ruang (sudut, kedalaman) dada, bukan dari tetangga di atlas: atlas
        # terpecah ratusan pulau kecil, jadi isian per pulau akan belang.
        NZ = max(4, int(round(Kl["tinggi_m"] / 0.01)))
        brs = np.clip((dz_b / Kl["tinggi_m"] * NZ).astype(int), 0, NZ - 1)
        sumber = dada & ~hapus & (kulit > 0.5)
        jml, cnt2 = np.zeros((NZ, NT, 3)), np.zeros((NZ, NT))
        np.add.at(jml, (brs[sumber], kol_b[sumber]), lab[sumber])
        np.add.at(cnt2, (brs[sumber], kol_b[sumber]), 1)
        medan = np.where(cnt2[..., None] >= 3, jml / np.maximum(cnt2[..., None], 1), 0)
        tahu = (cnt2 >= 3).astype(float)
        for _ in range(NT):
            if tahu.min() > 0:
                break
            sj, sa = np.zeros_like(medan), np.zeros_like(tahu)
            for geser, sumbu_g in ((1, 1), (-1, 1), (1, 0), (-1, 0)):
                mm, tt = np.roll(medan * tahu[..., None], geser, sumbu_g), np.roll(tahu, geser, sumbu_g)
                if sumbu_g == 0:   # kedalaman tidak melingkar
                    tepi = 0 if geser > 0 else -1
                    mm[tepi], tt[tepi] = 0, 0
                sj, sa = sj + mm, sa + tt
            kosong = (tahu == 0) & (sa > 0)
            medan[kosong] = sj[kosong] / sa[kosong][:, None]
            tahu[kosong] = 1
        for _ in range(3):
            atas_m, bwh_m = np.vstack([medan[:1], medan[:-1]]), np.vstack([medan[1:], medan[-1:]])
            medan = (2 * medan + np.roll(medan, 1, 1) + np.roll(medan, -1, 1) + atas_m + bwh_m) / 6
        lab_baru[hapus] = medan[brs[hapus], kol_b[hapus]]
        # isian dihaluskan sedikit di dalam pulau supaya batas sel medan tidak terlihat
        for _ in range(3):
            cnt_h = jumlah_kotak(badan_px, 1)
            for k in range(3):
                rata = jumlah_kotak(lab_baru[..., k] * badan_px, 1) / np.maximum(cnt_h, 1)
                lab_baru[..., k][hapus] = rata[hapus]
        ubah |= hapus
        zz = pos[..., 2][inti]
        hasil["kalung_lukis"] = {"texel": int(hapus.sum()), "L_median_dada": round(L_med, 1),
                                 "z_m": [round(float(zz.min()), 3), round(float(zz.max()), 3)] if len(zz) else None}
        catat(f"kalung lukis dihapus: {hasil['kalung_lukis']}")
        lab = lab_baru.copy()
        kulit = np.where(hapus, 1.0, kulit)
    Nl, _ = rata_sudut(leher_px & (dz_b < L["contoh_leher_m"]) & (kulit > 0.5), kol_b, 5)
    if Nl is None:
        raise SystemExit("[leher] texel kulit leher badan di bawah sambungan terlalu sedikit")
    Jr, ada_rahang = rata_sudut(kepala_px & (dp_k >= 0) & (dp_k < L["rahang_tebal_m"]) & (kulit > 0.5), kol_k, 5)
    bobot_rahang = ada_rahang.astype(float)
    for _ in range(3):
        bobot_rahang = (2 * bobot_rahang + np.roll(bobot_rahang, 1) + np.roll(bobot_rahang, -1)) / 4
    if Jr is None:
        Jr = Nl.copy()
    # warna rahang sasaran: sebagian menuju warna leher, selisih terang dibatasi (bayangan dagu tercetak)
    Js = Nl + (Jr - Nl) * L["kuat_rahang"]
    Js[:, 0] = Nl[:, 0] + np.clip(Js[:, 0] - Nl[:, 0], -L["batas_rahang_L"], L["batas_rahang_L"])
    hasil["warna"] = {"lab_leher": [round(float(v), 1) for v in Nl.mean(0)],
                      "lab_rahang": [round(float(v), 1) for v in Jr[ada_rahang].mean(0)] if ada_rahang.any() else None,
                      "lab_rahang_sasaran": [round(float(v), 1) for v in Js[ada_rahang].mean(0)] if ada_rahang.any() else None,
                      "sudut_rahang_kulit": int(ada_rahang.sum())}
    # peralihan ke atas: kulit kepala dalam peralihan_m dari sambungan digeser ke warna sasaran
    m = kepala_px & (dp_k >= -0.002) & (dp_k < L["peralihan_m"]) & (kulit > 0.2)
    w = (1 - halus01(dp_k[m] / L["peralihan_m"])) * kulit[m] * bobot_rahang[kol_k[m]]
    lab_baru[m] += (Js - Jr)[kol_k[m]] * w[:, None]
    ubah |= m
    # peralihan ke bawah: kulit leher badan dalam peralihan_m dari sambungan digeser ke rata-rata per sudut
    Nb, ada_b = rata_sudut(leher_px & (dz_b < L["peralihan_m"]) & (kulit > 0.5), kol_b, 5)
    m = leher_px & (dz_b < L["peralihan_m"]) & (kulit > 0.5)
    w = 1 - halus01(np.maximum(dz_b[m], 0) / L["peralihan_m"])
    lab_baru[m] += (Nl[kol_b[m]] - lab_baru[m]) * (w * 0.85)[:, None]   # di cincin nyaris sama dengan warna pita
    ubah |= m

    px[..., :3][ubah] = lab_ke_srgb(lab_baru[ubah])
    rgb = px[..., :3].astype(np.float64)

    # normal map: rata di dekat sambungan dan di texel yang dihapus, dilemahkan di kulit kepala
    nrm_px = piksel(tex_n.image) if tex_n else None
    if nrm_px is not None and nrm_px.shape[:2] == (H, W):
        F = np.ones((H, W))
        F[kepala_px] = 1 - (1 - L["normal_kulit_kepala"]) * kulit[kepala_px]
        m = kepala_px & (dp_k < L["normal_rata_m"])
        F[m] *= halus01(np.maximum(dp_k[m], 0) / L["normal_rata_m"])
        m = leher_px & (dz_b < L["normal_rata_m"])
        F[m] *= halus01(np.maximum(dz_b[m], 0) / L["normal_rata_m"])
        if Kl["aktif"]:
            F[dada] *= Kl["normal_dada"]
        F[hapus] = 0
        m = F < 1
        datar = np.array([0.5, 0.5, 1.0])
        nrm_px[..., :3][m] = datar + (nrm_px[..., :3][m] - datar) * F[m][:, None]

    def bangun_margin(img):
        """Margin pulau diisi ulang dari texel pulau terdekat, supaya tepi pulau tidak bergaris."""
        tahu = isi.copy()
        for _ in range(mg):
            cnt = jumlah_kotak(tahu, 1)
            baru_m = ~tahu & (cnt > 0)
            for k in range(3):
                img[..., k][baru_m] = (jumlah_kotak(img[..., k] * tahu, 1)[baru_m] / cnt[baru_m])
            tahu |= baru_m
    bangun_margin(px)
    if nrm_px is not None and nrm_px.shape[:2] == (H, W):
        bangun_margin(nrm_px)

    # pulau pita: warna leher di bawah, beralih ke warna rahang sasaran di atas
    x, y, wp, hp = px_pita
    ii, rr = np.arange(-mg, wp + mg), np.arange(-mg, hp + mg)
    u = (np.clip(ii, 0, wp - 1) + 0.5) / wp * U_MAKS
    t = (np.clip(rr, 0, hp - 1) + 0.5) / hp
    kk = np.clip(((u % 1.0) * NT).astype(int), 0, NT - 1)
    s = halus01(t)[:, None] * bobot_rahang[kk][None, :]
    warna = lab_ke_srgb(Nl[kk][None, :, :] + (Js - Nl)[kk][None, :, :] * s[..., None])
    px[y - mg:y - mg + len(rr), x - mg:x - mg + len(ii), :3] = warna
    px[y - mg:y - mg + len(rr), x - mg:x - mg + len(ii), 3] = 1
    if nrm_px is not None:
        sx, sy = nrm_px.shape[1] / W, nrm_px.shape[0] / H
        nrm_px[int((y - mg) * sy):int((y - mg + len(rr)) * sy) + 1, int((x - mg) * sx):int((x - mg + len(ii)) * sx) + 1, :3] = (0.5, 0.5, 1.0)
    catat(f"pulau UV pita {px_pita}; warna {hasil['warna']}")

    tmp = os.path.join(tempfile.gettempdir(), "nusantara-tekstur")
    os.makedirs(tmp, exist_ok=True)
    folder = os.path.join(akar, a.tekstur)
    lama_bc = tex_bc.image
    tex_bc.image = simpan_gambar(f"{a.nama}_basecolor", px, os.path.join(folder, f"{a.nama}-basecolor-leher.png"),
                                 os.path.join(tmp, f"{a.nama}_basecolor.jpg"), "sRGB", a.kualitas_jpeg)
    bpy.data.images.remove(lama_bc)
    if tex_n:
        lama_n = tex_n.image
        tex_n.image = simpan_gambar(f"{a.nama}_normal", nrm_px, os.path.join(folder, f"{a.nama}-normal-leher.png"),
                                    os.path.join(tmp, f"{a.nama}_normal.jpg"), "Non-Color", a.kualitas_jpeg)
        bpy.data.images.remove(lama_n)

    # emas lukis (gelang lengan): topeng posisi lengan dan warna -> tekstur metallic-roughness
    E = L["emas"]
    if E["aktif"]:
        h_, s_, v_ = hsv(rgb)
        kotak = badan_px & (np.abs(pos[..., 0] - x0) >= E["x_abs_m"][0]) & (np.abs(pos[..., 0] - x0) <= E["x_abs_m"][1]) \
            & (pos[..., 2] >= E["z_m"][0]) & (pos[..., 2] <= E["z_m"][1])
        m_emas = kotak & (h_ >= E["rona_derajat"][0]) & (h_ <= E["rona_derajat"][1]) & (s_ >= E["sat_min"]) \
            & (v_ >= E["v_min"]) & (kulit < E["kulit_maks"])
        m_emas = (jumlah_kotak(m_emas, 1) >= 4) & kotak   # mayoritas 3 x 3: buang bintik, tutup lubang kecil
        if os.environ.get("LEHER_DEBUG"):
            for h0 in range(14, 50, 2):
                mm = kotak & (h_ >= h0) & (h_ < h0 + 2)
                if mm.sum():
                    print(f"[leher] rona {h0:2d}-{h0 + 2:2d}: {int(mm.sum()):6d} texel, sat {s_[mm].mean():.2f}, v {v_[mm].mean():.2f}, "
                          f"z {pos[..., 2][mm].mean():.3f} +- {pos[..., 2][mm].std():.3f}", flush=True)
        hasil["emas"] = {"texel_kotak": int(kotak.sum()), "texel_emas": int(m_emas.sum()),
                         "rona_p10_p50_p90": [round(float(v), 0) for v in np.percentile(h_[kotak], [10, 50, 90])] if kotak.any() else None,
                         "rona_emas_p10_p50_p90": [round(float(v), 0) for v in np.percentile(h_[m_emas], [10, 50, 90])] if m_emas.any() else None}
        catat(f"emas lukis: {hasil['emas']}")
        fk = W // E["ukuran_px"]
        isi_f = isi.astype(float)
        if fk > 1:
            bagi = isi_f.reshape(H // fk, fk, W // fk, fk).sum((1, 3))
            kecil = (m_emas & isi).reshape(H // fk, fk, W // fk, fk).sum((1, 3)) / np.maximum(bagi, 1)
        else:
            kecil = m_emas.astype(float)
        mr = np.ones((kecil.shape[0], kecil.shape[1], 4), dtype=np.float32)
        mr[..., 1] = E["roughness_lain"] + (E["roughness_emas"] - E["roughness_lain"]) * kecil
        mr[..., 2] = kecil * E["metallic_emas"]   # tidak penuh: sebagian warna lukis tetap terlihat
        img_mr = simpan_gambar(f"{a.nama}_mr", mr, os.path.join(folder, f"{a.nama}-mr-leher.png"), None, "Non-Color", 90)
        tex_mr = nt.nodes.new("ShaderNodeTexImage")
        tex_mr.image = img_mr
        pisah = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex_mr.outputs["Color"], pisah.inputs["Color"])
        nt.links.new(pisah.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(pisah.outputs["Blue"], bsdf.inputs["Metallic"])

    # ----- 9. ekspor -----
    me.attributes.remove(me.attributes["bagian"])
    keluar = os.path.join(akar, a.keluar) if not os.path.isabs(a.keluar) else a.keluar
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=keluar, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO", export_jpeg_quality=a.kualitas_jpeg,
        export_normals=True, export_tangents=False, export_animations=False, export_skins=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    hasil["berkas_mb"] = round(os.path.getsize(keluar) / 1e6, 2)
    L["hasil"] = hasil
    json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    catat(f"ekspor {keluar}: {hasil['berkas_mb']} MB, {hasil['segitiga']} segitiga")


main()
