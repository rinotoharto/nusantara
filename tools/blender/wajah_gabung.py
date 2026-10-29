"""
Gabungkan proyeksi wajah ke base color (Tahap 2 perbaikan wajah, Python venv dengan OpenCV).

  tools/.venv/bin/python tools/blender/wajah_gabung.py --json tools/blender/wajah.json \
      --lama aset-mentah/tekstur/wijaya-basecolor-sebelum.jpg --proyeksi aset-mentah/tekstur/wajah-proyeksi.png \
      --data aset-mentah/tekstur/wajah-data.png --keluar aset-mentah/tekstur/wijaya-basecolor-wajah.png \
      --pratinjau aset-mentah/pratinjau

Topeng campuran w = sudut(normal ke kamera) x tinggi (di atas tulang selangka) x bukan latar putih konsep,
dihaluskan. Warna kulit proyeksi disamakan dengan kulit lama di kepala (rata-rata dan sebaran L, a, b),
hanya pada piksel yang berwarna kulit. Detail halus tekstur lama ditambahkan tipis. Setelah campur,
warna di tepi pulau UV didilate 8 piksel. Angka ada di wajah.json blok "topeng" dan "gabung".
"""
import argparse
import json
import os

import cv2
import numpy as np


def argumen():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--lama", required=True)
    p.add_argument("--proyeksi", required=True)
    p.add_argument("--data", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--pratinjau", required=True)
    return p.parse_args()


def halus(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def topeng_kulit(bgr):
    """Bobot 0..1 seberapa 'kulit' sebuah piksel: rona merah-jingga, saturasi sedang, cukup terang."""
    hsv = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    rona = halus(1 - np.abs(h - 10) / 14)        # puncak di rona 10 (jingga), nol di luar 0..24
    sat = halus((s - 0.18) / 0.12) * halus((0.85 - s) / 0.15)
    terang = halus((v - 0.25) / 0.15)
    return rona * sat * terang


def statistik_lab(lab, bobot):
    b = bobot[..., None]
    jumlah = b.sum()
    rata = (lab * b).sum(axis=(0, 1)) / jumlah
    simpang = np.sqrt((((lab - rata) ** 2) * b).sum(axis=(0, 1)) / jumlah)
    return rata, simpang


def perluas_skalar(nilai, cakupan, langkah):
    """Isi piksel di luar cakupan dengan rata-rata tetangga tercakup, berulang; supaya blur dan closing
    di tepi pulau UV tidak menghisap nilai nol dari luar pulau (menimbulkan garis jahitan)."""
    v = nilai.astype(np.float32).copy()
    cov = cakupan.astype(np.float32).copy()
    for _ in range(langkah):
        s = cv2.blur(v * cov, (3, 3))
        c = cv2.blur(cov, (3, 3))
        baru = (c > 1e-6) & (cov < 0.5)
        v[baru] = s[baru] / c[baru]
        cov[baru] = 1.0
    return v


def dilate_warna(img, cakupan, daerah, langkah):
    """Isi piksel di luar cakupan (dalam `daerah`) dengan rata-rata tetangga tercakup, berulang `langkah` kali."""
    img = img.copy()
    cov = cakupan.astype(np.float32)
    for _ in range(langkah):
        s = cv2.blur(img * cov[..., None], (3, 3))
        c = cv2.blur(cov, (3, 3))
        baru = (c > 1e-6) & (cov < 0.5) & daerah
        img[baru] = s[baru] / c[baru][:, None]
        cov[baru] = 1.0
    return img


def main():
    a = argumen()
    data = json.load(open(a.json))
    topeng = data["topeng"]
    gabung = data.setdefault("gabung", {
        "latar_putih_min": 215, "latar_putih_maks": 245,
        "halus_topeng_px": 5,
        "tutup_lubang_px": 25,
        "kekuatan_detail": 0.5, "sigma_detail_px": 2.5,
        "batas_rasio_simpang": [0.7, 1.4],
        "dilate_px": 8,
        "keterangan": "latar putih konsep (kanal minimum di atas ambang) dibuang dari topeng; detail = lama - blur(lama)",
    })

    lama = cv2.imread(a.lama, cv2.IMREAD_COLOR).astype(np.float32)
    proj = cv2.imread(a.proyeksi, cv2.IMREAD_COLOR).astype(np.float32)
    d16 = cv2.imread(a.data, cv2.IMREAD_UNCHANGED).astype(np.float32)
    d = d16 / (65535.0 if d16.max() > 255 else 255.0)
    dot, z_norm, cakupan = d[:, :, 2], d[:, :, 1], d[:, :, 0]   # BGR: R=dot, G=z, B=cakupan
    tinggi_px, lebar_px = lama.shape[:2]
    assert proj.shape[:2] == (tinggi_px, lebar_px) == d.shape[:2], "ukuran gambar tidak sama"

    # 1. Topeng.
    sudut = np.degrees(np.arccos(np.clip(dot, 0, 1)))
    w_sudut = halus((topeng["sudut_nol_derajat"] - sudut) / (topeng["sudut_nol_derajat"] - topeng["sudut_penuh_derajat"]))
    z0, z1 = data.get("data_z", [1.2, 1.8])
    z_abs = z0 + z_norm * (z1 - z0)
    w_tinggi = halus((z_abs - topeng["z_bawah_m"]) / (topeng["z_atas_m"] - topeng["z_bawah_m"]))
    kanal_min = proj.min(axis=2)
    w_latar = 1 - halus((kanal_min - gabung["latar_putih_min"]) / (gabung["latar_putih_maks"] - gabung["latar_putih_min"]))
    tercakup = cakupan > 0.5
    w = w_sudut * w_tinggi * w_latar
    # Perluas ke luar pulau dulu supaya closing dan blur tidak menghisap nol dari sela pulau UV.
    r = gabung.get("tutup_lubang_px", 0)
    k = gabung["halus_topeng_px"]
    w = perluas_skalar(w, tercakup, r + 3 * k + 2)
    # Lubang di tengah wajah (normal menghadap samping pada lekukan geometri yang meleleh) ditutup:
    # closing morfologis hanya mengisi lubang yang dikelilingi bobot tinggi, batas luar tetap.
    if r > 0:
        inti = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
        w = np.maximum(w, cv2.morphologyEx(w, cv2.MORPH_CLOSE, inti))
    w = cv2.GaussianBlur(w, (0, 0), k)
    w = np.clip(w, 0, 1) * tercakup
    print(f"[gabung] piksel topeng > 0,5: {(w > 0.5).sum()}, > 0,05: {(w > 0.05).sum()}")

    # Rambut gelap di tekstur lama tidak boleh ditimpa latar terang konsep (sanggul).
    hsv_lama = cv2.cvtColor(np.clip(lama, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32) / 255
    hsv_proj = cv2.cvtColor(np.clip(proj, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32) / 255
    rambut = (hsv_lama[:, :, 2] < gabung["rambut_v_maks"]) & (hsv_proj[:, :, 2] > gabung["latar_terang_v_min"])
    w = w * (1 - cv2.GaussianBlur(rambut.astype(np.float32), (0, 0), 3))
    w = np.clip(w, 0, 1)

    # 2. Penyesuaian warna di Lab, hanya piksel kulit. Statistik diambil dari pita batas (w sedang),
    # tempat kedua tekstur saling bertemu, supaya warnanya pas tepat di batas.
    kulit_proj = topeng_kulit(proj)
    kulit_lama = topeng_kulit(lama)
    lab_proj = cv2.cvtColor(np.clip(proj, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_lama = cv2.cvtColor(np.clip(lama, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    pita = ((w > gabung["pita_w"][0]) & (w < gabung["pita_w"][1])).astype(np.float32)
    pita_ada = (pita * kulit_proj * kulit_lama).sum() > 2000
    bobot_a = kulit_proj * (pita if pita_ada else (w > 0.5))
    bobot_b = kulit_lama * (pita if pita_ada else ((z_abs > topeng["z_atas_m"]) * (cakupan > 0.5)))
    rata_a, simpang_a = statistik_lab(lab_proj, bobot_a)
    rata_b, simpang_b = statistik_lab(lab_lama, bobot_b)
    lo, hi = gabung["batas_rasio_simpang"]
    rasio = np.clip(simpang_b / np.maximum(simpang_a, 1e-3), lo, hi)
    lab_cocok = (lab_proj - rata_a) * rasio + rata_b
    kekuatan = kulit_proj[..., None]
    lab_hasil = lab_proj * (1 - kekuatan) + lab_cocok * kekuatan
    # Koreksi lokal frekuensi rendah: selisih lama - proyeksi di pita batas (kulit di keduanya) diblur
    # lebar di ruang UV, lalu ditambahkan paling kuat di pita dan melemah ke tengah wajah.
    m = pita * kulit_proj * kulit_lama * (cakupan > 0.5)
    sig_l = gabung["sigma_lokal_px"]
    num = cv2.GaussianBlur((lab_lama - lab_hasil) * m[..., None], (0, 0), sig_l)
    den = cv2.GaussianBlur(m, (0, 0), sig_l)[..., None]
    selisih = np.where(den > 1e-4, num / np.maximum(den, 1e-4), 0.0)
    k_pita = gabung["lokal_tengah"] + (1 - gabung["lokal_tengah"]) * (1 - halus((w - gabung["pita_w"][0]) / (1 - gabung["pita_w"][0])))
    lab_hasil = lab_hasil + selisih * (k_pita * kulit_proj)[..., None]
    data["gabung"]["warna"] = data["gabung"].get("warna", {})
    data["gabung"]["warna"]["selisih_lokal_maks_L"] = round(float(np.abs(selisih[..., 0]).max()), 1)
    proj_cocok = cv2.cvtColor(np.clip(lab_hasil, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    data["gabung"]["warna"] = data["gabung"].get("warna", {})
    data["gabung"]["warna"].update({
        "lab_konsep_rata": [round(float(v), 1) for v in rata_a], "lab_konsep_simpang": [round(float(v), 1) for v in simpang_a],
        "lab_lama_rata": [round(float(v), 1) for v in rata_b], "lab_lama_simpang": [round(float(v), 1) for v in simpang_b],
        "rasio_dipakai": [round(float(v), 2) for v in rasio],
        "catatan": "L 0..255, a dan b 128 = netral (skala OpenCV)",
    })
    print(f"[gabung] Lab konsep {np.round(rata_a, 1)} +- {np.round(simpang_a, 1)}; lama {np.round(rata_b, 1)} +- {np.round(simpang_b, 1)}; rasio {np.round(rasio, 2)}")

    # 3. Detail halus dari tekstur lama.
    sig = gabung["sigma_detail_px"]
    detail = lama - cv2.GaussianBlur(lama, (0, 0), sig)
    proj_detail = proj_cocok + gabung["kekuatan_detail"] * detail * kulit_lama[..., None]

    # 4. Campur dan dilate di tepi pulau.
    baru = lama * (1 - w[..., None]) + proj_detail * w[..., None]
    daerah = cv2.dilate((w > 0.01).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=gabung["dilate_px"] + 2) > 0
    baru = dilate_warna(baru, cakupan > 0.5, daerah, gabung["dilate_px"])
    baru = np.clip(baru, 0, 255).astype(np.uint8)
    cv2.imwrite(a.keluar, baru)

    # Pratinjau topeng dan potongan pulau wajah sebelum/sesudah.
    os.makedirs(a.pratinjau, exist_ok=True)
    cv2.imwrite(os.path.join(os.path.dirname(a.keluar), "topeng-wajah.png"), (w * 255).astype(np.uint8))
    ys, xs = np.where(w > 0.05)
    y0, y1, x0, x1 = max(ys.min() - 40, 0), min(ys.max() + 40, tinggi_px), max(xs.min() - 40, 0), min(xs.max() + 40, lebar_px)
    potong = np.hstack([lama[y0:y1, x0:x1].astype(np.uint8), baru[y0:y1, x0:x1],
                        cv2.cvtColor((w[y0:y1, x0:x1] * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)])
    if potong.shape[1] > 2400:
        potong = cv2.resize(potong, None, fx=2400 / potong.shape[1], fy=2400 / potong.shape[1], interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(a.pratinjau, "wajah-tekstur-sebelum-sesudah.png"), potong)
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    print("[gabung] tersimpan", a.keluar)


main()
