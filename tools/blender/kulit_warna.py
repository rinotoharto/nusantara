"""
Gabungkan bake A (badan) dan B (kepala) lewat data C, lalu koreksi warna kulit (venv, OpenCV).
Urutan warna sesuai permintaan: kulit badan digeser ke warna kulit gambar konsep (cokelat hangat),
lalu kulit kepala disamakan ke statistik badan hasil itu. Hanya piksel kulit (bukan kain, ikat kepala,
perhiasan, rambut). Angka di wajah.json blok "kulit".

  tools/.venv/bin/python tools/blender/kulit_warna.py --json tools/blender/wajah.json \
      --tekstur aset-mentah/tekstur --keluar-basecolor aset-mentah/tekstur/wijaya-basecolor-kepala.png \
      --keluar-normal aset-mentah/tekstur/wijaya-normal-kepala.png
"""
import argparse
import json
import os

import cv2
import numpy as np


def halus(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def topeng_kulit(bgr, K):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    rona = halus(1 - np.abs(h - K["rona_pusat"]) / K["rona_lebar"])
    sat = halus((s - K["sat_min"]) / 0.12) * halus((K["sat_maks"] - s) / 0.15)
    terang = halus((v - K["v_min"]) / 0.15)
    return rona * sat * terang


def statistik(lab, bobot):
    b = bobot[..., None]
    n = b.sum()
    rata = (lab * b).sum(axis=(0, 1)) / n
    simpang = np.sqrt((((lab - rata) ** 2) * b).sum(axis=(0, 1)) / n)
    return rata, simpang


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--tekstur", required=True)
    p.add_argument("--keluar-basecolor", required=True)
    p.add_argument("--keluar-normal", required=True)
    p.add_argument("--normal-kepala-rata", action="store_true", help="uji: normal map kepala dibuat rata")
    a = p.parse_args()
    data = json.load(open(a.json))
    K = data.setdefault("kulit", {
        "sasaran_lab_badan": [128, 146, 154],
        "rona_pusat": 10, "rona_lebar": 14, "sat_min": 0.18, "sat_maks": 0.85, "v_min": 0.2,
        "batas_rasio_simpang": [0.7, 1.4],
        "keterangan": "Lab skala OpenCV (L 0..255, a/b 128 netral). Kulit badan digeser ke sasaran "
                      "(rata-rata saja, sebaran tetap); kulit kepala disamakan rata-rata dan sebarannya ke badan.",
    })
    t = a.tekstur
    A = cv2.imread(os.path.join(t, "kepala-A-basecolor.png"))
    B = cv2.imread(os.path.join(t, "kepala-B-basecolor.png"))
    An = cv2.imread(os.path.join(t, "kepala-A-normal.png"))
    Bn = cv2.imread(os.path.join(t, "kepala-B-normal.png"))
    d16 = cv2.imread(os.path.join(t, "kepala-data.png"), cv2.IMREAD_UNCHANGED).astype(np.float32)
    d = d16 / (65535.0 if d16.max() > 255 else 255.0)
    kepala = d[:, :, 2] > 0.5   # R = indeks bahan
    cakupan = d[:, :, 0] > 0.5
    # Pulau kepala di bake A berisi sampah; ambil dari B. Margin: dilate topeng kepala 4 px.
    kepala_m = cv2.dilate(kepala.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=6) > 0
    # Texel kepala yang sinar bake-nya meleset (hitam pekat) dan pita leher di bawah dagu (tekstur Tripo
    # di situ daerah tak terlihat) diisi dari tetangga. Isian memakai sumber sesuai konteks: tetangga gelap
    # (rambut) atau tetangga terang (kulit), supaya rambut tidak diisi warna kulit dan sebaliknya.
    z0, z1 = data.get("data_z", [1.2, 1.8])
    z_abs = z0 + d[:, :, 1] * (z1 - z0)
    zp = data["kepala"]["z_potong_m"]
    pita = K.setdefault("pita_leher_m", 0.05)
    dagu = data["kepala"]["dagu_z_m"]
    hsv0 = cv2.cvtColor(B, cv2.COLOR_BGR2HSV)
    # Lubang: sinar meleset (hitam), pita leher di atas potongan, dan texel gelap di bawah dagu (bayangan
    # dagu yang terbakar di tekstur Tripo; leher asli tidak sehitam itu).
    gelap_leher = (z_abs < dagu - 0.005) & (hsv0[:, :, 2] < K.setdefault("leher_v_min", 0.4) * 255)
    lubang = kepala_m & ((B.max(axis=2) < 6) | ((z_abs < zp + pita) & (z_abs > zp - 0.02)) | gelap_leher)
    if lubang.any():
        hsv = cv2.cvtColor(B, cv2.COLOR_BGR2HSV)
        gelap = (hsv[:, :, 2] < 90) & kepala_m & ~lubang
        terang = kepala_m & ~lubang & ~gelap
        f_gelap = cv2.blur((gelap).astype(np.float32), (31, 31))
        f_semua = cv2.blur((kepala_m & ~lubang).astype(np.float32), (31, 31))
        lubang_rambut = lubang & (f_gelap > 0.5 * np.maximum(f_semua, 1e-6))
        lubang_kulit = lubang & ~lubang_rambut
        B1 = cv2.inpaint(B, (lubang_rambut | terang).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
        B2 = cv2.inpaint(B, (lubang_kulit | gelap).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
        B = np.where(lubang_rambut[..., None], B1, np.where(lubang_kulit[..., None], B2, B))
        Bn[lubang] = (255, 128, 128)   # BGR: normal rata (128,128,255)
    print(f"[kulit] texel kepala diisi: {lubang.sum()} (rambut {int(lubang_rambut.sum()) if lubang.any() else 0})")
    if a.normal_kepala_rata:
        Bn[kepala_m] = (255, 128, 128)
    bc = np.where(kepala_m[..., None], B, A)
    nm = np.where(kepala_m[..., None], Bn, An)
    # Margin seragam: texel di luar cakupan diisi dari texel tercakup terdekat (8 px), menimpa margin bake
    # yang bisa saling tumpang tindih antar pulau dan menimbulkan garis di batas pulau.
    def dilate_warna(img, cov, langkah):
        img = img.astype(np.float32).copy()
        c = cov.astype(np.float32).copy()
        for _ in range(langkah):
            sm = cv2.blur(img * c[..., None], (3, 3))
            cc = cv2.blur(c, (3, 3))
            baru = (cc > 1e-6) & (c < 0.5)
            img[baru] = sm[baru] / cc[baru][:, None]
            c[baru] = 1.0
        return np.clip(img, 0, 255).astype(np.uint8)
    bc = dilate_warna(bc, cakupan, K.setdefault("margin_px", 8))
    nm = dilate_warna(nm, cakupan, K["margin_px"])
    print(f"[kulit] texel kepala {kepala.sum()}, badan {(cakupan & ~kepala).sum()}")

    lab = cv2.cvtColor(bc, cv2.COLOR_BGR2LAB).astype(np.float32)
    kulit = topeng_kulit(bc, K)
    w_badan = kulit * (~kepala_m) * cakupan
    w_kepala = kulit * kepala_m * cakupan
    rata_b, simpang_b = statistik(lab, w_badan)
    sasaran = np.array(K["sasaran_lab_badan"], dtype=np.float32)
    geser = sasaran - rata_b
    lab_baru = lab + geser * (w_badan)[..., None]
    rata_b2, simpang_b2 = statistik(lab_baru, w_badan)
    rata_k, simpang_k = statistik(lab, w_kepala)
    lo, hi = K["batas_rasio_simpang"]
    rasio = np.clip(simpang_b2 / np.maximum(simpang_k, 1e-3), lo, hi)
    lab_k = (lab - rata_k) * rasio + rata_b2
    lab_baru = lab_baru * (1 - w_kepala[..., None]) + lab_k * w_kepala[..., None]
    hasil = cv2.cvtColor(np.clip(lab_baru, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    K["hasil"] = {
        "badan_sebelum": [round(float(v), 1) for v in rata_b], "badan_sesudah": [round(float(v), 1) for v in rata_b2],
        "kepala_sebelum": [round(float(v), 1) for v in rata_k], "kepala_simpang": [round(float(v), 1) for v in simpang_k],
        "badan_simpang": [round(float(v), 1) for v in simpang_b2], "rasio_kepala": [round(float(v), 2) for v in rasio],
    }
    print(f"[kulit] badan Lab {np.round(rata_b, 1)} -> {np.round(rata_b2, 1)}; kepala {np.round(rata_k, 1)} -> {np.round(rata_b2, 1)} rasio {np.round(rasio, 2)}")
    cv2.imwrite(a.keluar_basecolor, hasil)
    cv2.imwrite(a.keluar_normal, nm)
    cv2.imwrite(os.path.join(t, "topeng-kulit.png"), (kulit * 255).astype(np.uint8))
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    print("[kulit] tersimpan", a.keluar_basecolor, a.keluar_normal)


main()
