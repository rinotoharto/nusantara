"""
Bercak abu-abu di base color (Tahap 3 perbaikan wajah, Python venv dengan OpenCV).

  tools/.venv/bin/python tools/blender/abu_isi.py --json tools/blender/wajah.json \
      --masuk aset-mentah/tekstur/wijaya-basecolor-wajah.png --data aset-mentah/tekstur/wajah-data.png \
      --keluar aset-mentah/tekstur/wijaya-basecolor-abu.png --tekstur aset-mentah/tekstur [--hanya-deteksi]

Deteksi: piksel bersaturasi rendah (abu-abu) di dalam pulau UV, per komponen terhubung. Komponen yang
cincin sekelilingnya didominasi kulit diisi otomatis (inpainting Telea per pulau, sumber hanya piksel
pulau itu sendiri) lalu diberi detail halus dari kulit sekitar. Komponen yang menyentuh kain, gelang
emas, atau tepi pulau UV tidak diisi; ditandai di topeng terpisah untuk dirapikan tangan.
Keluaran: topeng-abu.png (merah = diisi otomatis, kuning = untuk tangan), topeng-abu-tangan.png
(putih = perlu tangan), dan base color baru. Angka di wajah.json blok "abu".
"""
import argparse
import json
import os

import cv2
import numpy as np


def argumen():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--masuk", required=True)
    p.add_argument("--data", required=True, help="wajah-data.png: kanal B = cakupan pulau UV")
    p.add_argument("--keluar", required=True)
    p.add_argument("--tekstur", required=True, help="folder keluaran topeng")
    p.add_argument("--topeng-wajah", default=None, help="topeng-wajah.png Tahap 2: daerah ini tidak disentuh")
    p.add_argument("--hanya-deteksi", action="store_true")
    p.add_argument("--isi-tepi", action="store_true", help="isi juga komponen yang menyentuh tepi pulau (bawaan: tangan)")
    return p.parse_args()


def halus(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def kelas_warna(bgr, abu):
    """Topeng kulit, kain, emas, abu-abu. Abu-abu dari kroma rendah di Lab (bercak Tripo kelabu kebiruan,
    a dan b dekat 128), kulit/kain/emas dari HSV (OpenCV: H 0..179, S dan V 0..255)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    kroma = np.hypot(lab[:, :, 1] - 128, lab[:, :, 2] - 128)
    kulit = (h >= 0) & (h <= abu["kulit_rona_maks"]) & (s >= abu["kulit_sat_min"]) & (s <= 0.85) & (v >= 0.3)
    emas = (h >= abu["emas_rona"][0]) & (h <= abu["emas_rona"][1]) & (s >= 0.45) & (v >= 0.5) & ~kulit
    # Kain: gelap tapi berwarna (cokelat), atau merah. Rambut: gelap dan nyaris tanpa warna.
    gelap = v < abu["kain_v_maks"]
    rambut = gelap & (kroma <= abu["rambut_kroma_maks"])
    kain = (gelap & ~rambut) | (((h >= 160) | (h <= 6)) & (s > 0.5) & (v < 0.6))
    r0, r1 = abu["abu_rona_biru"]
    biru_kelabu = (h >= r0) & (h <= r1) & (s <= abu["abu_sat_biru_maks"])
    kelabu_terang = ((kroma <= abu["abu_kroma_maks"]) | biru_kelabu) & (v >= abu["abu_v_min"]) & (v <= abu["abu_v_maks"])
    # Abu-abu gelap (bercak hitam di atas bahu): kroma rendah, gelap. Kelas terpisah dengan syarat ketat
    # (komponen kecil, di bawah dagu, cincin separuh kulit) karena warnanya sama dengan rambut dan bayangan.
    kelabu_gelap = (kroma <= abu["gelap_kroma_maks"]) & (v >= abu["abu_gelap_v_min"]) & (v < abu["abu_v_min"])
    # Cokelat gelap (bayangan rambut terproyeksi di bahu): rona kulit tapi jauh lebih gelap dari kulit sekitar.
    cokelat_gelap = (h <= abu["kulit_rona_maks"]) & (s >= 0.3) & (v >= abu["abu_gelap_v_min"]) & (v < abu["cokelat_v_maks"])
    return kulit, emas, kain, kelabu_terang, rambut, kelabu_gelap, cokelat_gelap


def main():
    a = argumen()
    data = json.load(open(a.json))
    abu = data.setdefault("abu", {
        "abu_kroma_maks": 14, "abu_rona_biru": [85, 135], "abu_sat_biru_maks": 0.40,
        "abu_v_min": 0.30, "abu_v_maks": 0.92, "lebar_topeng_px": 2,
        "kulit_rona_maks": 22, "kulit_sat_min": 0.25,
        "emas_rona": [18, 40], "kain_v_maks": 0.25, "jarak_kain_emas_px": 6,
        "abu_gelap_v_min": 0.06, "gelap_kroma_maks": 20, "rambut_kroma_maks": 12, "wajah_z_min_m": 1.45,
        "gelap_kulit_cincin_min": 0.6, "gelap_luas_maks_px": 20000,
        "cokelat_v_maks": 0.40, "cokelat_luas_min_px": 1500,
        "cincin_px": 6, "kulit_cincin_min": 0.3, "kulit_cincin_abaikan": 0.12,
        "tepi_px": 2, "komponen_min_px": 12, "isi_tepi": True, "dilate_margin_px": 8,
        "inpaint_radius": 5, "sigma_detail_px": 2.0, "kekuatan_detail": 0.6,
        "keterangan": "piksel abu-abu (kroma Lab <= abu_kroma_maks) diisi otomatis kecuali dalam jarak_kain_emas_px "
                      "dari kain/emas, atau komponennya punya cincin kulit < kulit_cincin_min, atau (kalau isi_tepi "
                      "false) menyentuh tepi pulau; sisanya ke topeng tangan",
    })
    img = cv2.imread(a.masuk, cv2.IMREAD_COLOR)
    d16 = cv2.imread(a.data, cv2.IMREAD_UNCHANGED).astype(np.float32)
    d = d16 / (65535.0 if d16.max() > 255 else 255.0)
    h, w = img.shape[:2]
    cakupan = d[:, :, 0] > 0.5   # persis; margin atlas Tripo berwarna biru-kelabu dan tidak boleh jadi sumber

    kulit, emas, kain, kelabu, rambut, kelabu_gelap, cokelat_gelap = kelas_warna(img, abu)
    kelabu &= cakupan
    z0, z1 = data.get("data_z", [1.2, 1.8])
    z_abs = z0 + d[:, :, 1] * (z1 - z0)
    if a.topeng_wajah and os.path.exists(a.topeng_wajah):
        # Hanya wajah di atas dagu (z absolut) yang dikecualikan; leher tetap masuk deteksi.
        wajah = (cv2.imread(a.topeng_wajah, 0) > 128) & (z_abs > abu["wajah_z_min_m"])
        kelabu &= ~wajah
        print(f"[abu] daerah wajah Tahap 2 dikecualikan: {wajah.sum()} piksel")
    # Lebarkan sedikit supaya piksel peralihan setengah abu-abu ikut diganti, bukan jadi sumber.
    inti_lebar = np.ones((3, 3), np.uint8)
    kelabu = (cv2.dilate(kelabu.astype(np.uint8), inti_lebar, iterations=abu["lebar_topeng_px"]) > 0) & cakupan & ~kain & ~emas
    dekat_kain_emas = cv2.dilate((kain | emas).astype(np.uint8), inti_lebar, iterations=abu["jarak_kain_emas_px"]) > 0
    isi_tepi = a.isi_tepi or abu.get("isi_tepi", False)
    # Tepi pulau: piksel tercakup yang dekat dengan piksel tak tercakup.
    inti3 = np.ones((3, 3), np.uint8)
    luar_dekat = cv2.dilate((~cakupan).astype(np.uint8), inti3, iterations=abu["tepi_px"]) > 0
    tepi = cakupan & luar_dekat

    n, label, stat, _ = cv2.connectedComponentsWithStats(kelabu.astype(np.uint8), connectivity=8)
    otomatis = np.zeros((h, w), bool)
    tangan = np.zeros((h, w), bool)
    alasan = {"kecil": 0, "otomatis": 0, "tepi": 0, "bukan_kulit": 0, "diabaikan": 0, "gelap": 0, "gelap_dilewati": 0}
    piksel_dekat_kain_emas = 0
    inti_cincin = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * abu["cincin_px"] + 1,) * 2)
    for i in range(1, n):
        x, y, bw, bh, luas = stat[i]
        if luas < abu["komponen_min_px"]:
            alasan["kecil"] += 1
            continue
        y0, y1 = max(y - abu["cincin_px"] - 1, 0), min(y + bh + abu["cincin_px"] + 1, h)
        x0, x1 = max(x - abu["cincin_px"] - 1, 0), min(x + bw + abu["cincin_px"] + 1, w)
        komp = label[y0:y1, x0:x1] == i
        cincin = (cv2.dilate(komp.astype(np.uint8), inti_cincin) > 0) & ~komp & cakupan[y0:y1, x0:x1]
        if cincin.sum() == 0:
            alasan["bukan_kulit"] += 1
            tangan[y0:y1, x0:x1] |= komp
            continue
        f_kulit = kulit[y0:y1, x0:x1][cincin].mean()
        sentuh_tepi = (komp & tepi[y0:y1, x0:x1]).any()
        if f_kulit < abu["kulit_cincin_abaikan"]:
            alasan["diabaikan"] += 1   # sorotan kain, mata, gigi: bukan bercak di kulit
        elif f_kulit < abu["kulit_cincin_min"]:
            alasan["bukan_kulit"] += 1
            tangan[y0:y1, x0:x1] |= komp
        elif sentuh_tepi and not isi_tepi:
            alasan["tepi"] += 1
            tangan[y0:y1, x0:x1] |= komp
        else:
            alasan["otomatis"] += 1
            # Bagian komponen yang dekat kain atau emas tetap untuk tangan; sisanya diisi.
            dekat = komp & dekat_kain_emas[y0:y1, x0:x1]
            piksel_dekat_kain_emas += int(dekat.sum())
            tangan[y0:y1, x0:x1] |= dekat
            otomatis[y0:y1, x0:x1] |= komp & ~dekat
    # Bercak gelap: komponen kecil di bawah dagu yang cincinnya separuh kulit (bukan rambut, bukan bayangan luas).
    kg = (kelabu_gelap | cokelat_gelap) & cakupan & ~kelabu
    if a.topeng_wajah and os.path.exists(a.topeng_wajah):
        kg &= ~wajah
    n_g, label_g, stat_g, _ = cv2.connectedComponentsWithStats(kg.astype(np.uint8), connectivity=8)
    for i in range(1, n_g):
        x, y, bw, bh, luas = stat_g[i]
        komp_cokelat = cokelat_gelap[label_g == i].mean() > 0.5 if luas >= abu["komponen_min_px"] else False
        luas_min = abu["cokelat_luas_min_px"] if komp_cokelat else abu["komponen_min_px"]   # puting dan pusar kecil, dibiarkan
        if luas < luas_min or luas > abu["gelap_luas_maks_px"]:
            alasan["gelap_dilewati"] += 1
            continue
        y0, y1 = max(y - abu["cincin_px"] - 1, 0), min(y + bh + abu["cincin_px"] + 1, h)
        x0, x1 = max(x - abu["cincin_px"] - 1, 0), min(x + bw + abu["cincin_px"] + 1, w)
        komp = label_g[y0:y1, x0:x1] == i
        cincin = (cv2.dilate(komp.astype(np.uint8), inti_cincin) > 0) & ~komp & cakupan[y0:y1, x0:x1]
        if cincin.sum() == 0 or kulit[y0:y1, x0:x1][cincin].mean() < abu["gelap_kulit_cincin_min"]:
            alasan["gelap_dilewati"] += 1
            continue
        alasan["gelap"] += 1
        otomatis[y0:y1, x0:x1] |= komp & ~dekat_kain_emas[y0:y1, x0:x1]
    print(f"[abu] piksel abu-abu di pulau: {kelabu.sum()}; komponen {n - 1}; {alasan}; "
          f"piksel dekat kain/emas ke tangan: {piksel_dekat_kain_emas}")
    print(f"[abu] piksel diisi otomatis: {otomatis.sum()}, untuk tangan: {tangan.sum()}")

    os.makedirs(a.tekstur, exist_ok=True)
    tampil = img.copy()
    tampil[otomatis] = (0, 0, 255)
    tampil[tangan] = (0, 255, 255)
    cv2.imwrite(os.path.join(a.tekstur, "topeng-abu.png"), tampil)
    cv2.imwrite(os.path.join(a.tekstur, "topeng-abu-tangan.png"), (tangan * 255).astype(np.uint8))
    data["abu"]["hasil"] = {"otomatis_px": int(otomatis.sum()), "tangan_px": int(tangan.sum()), "komponen": alasan}
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    if a.hanya_deteksi:
        return

    # Topeng isian diperluas ke piksel bukan-kulit (peralihan setengah kelabu) dalam radius cincin di
    # sekitar bercak, supaya sumber inpainting benar-benar kulit; kain dan emas tidak ikut.
    sekitar = cv2.dilate(otomatis.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=abu["cincin_px"]) > 0
    isi_semua = otomatis | (sekitar & ~kulit & ~rambut & ~kain & ~emas & cakupan & ~tangan)
    print(f"[abu] piksel isian termasuk peralihan: {isi_semua.sum()}")

    # Isi per pulau: sumber inpainting hanya piksel pulau yang sama.
    n_p, label_p, stat_p, _ = cv2.connectedComponentsWithStats(cakupan.astype(np.uint8), connectivity=8)
    hasil = img.copy()
    pulau_diisi = 0
    for i in range(1, n_p):
        x, y, bw, bh, _ = stat_p[i]
        pad = abu["inpaint_radius"] + 2
        y0, y1 = max(y - pad, 0), min(y + bh + pad, h)
        x0, x1 = max(x - pad, 0), min(x + bw + pad, w)
        pulau = label_p[y0:y1, x0:x1] == i
        isi = isi_semua[y0:y1, x0:x1] & pulau
        if not isi.any():
            continue
        # Piksel cadangan tangan ikut di-mask supaya abu-abunya tidak jadi sumber, tapi tidak ditulis balik.
        topeng = (isi | tangan[y0:y1, x0:x1] | ~pulau).astype(np.uint8) * 255
        potong = cv2.inpaint(hasil[y0:y1, x0:x1], topeng, abu["inpaint_radius"], cv2.INPAINT_TELEA)
        hasil[y0:y1, x0:x1][isi] = potong[isi]
        pulau_diisi += 1
    print(f"[abu] pulau diisi: {pulau_diisi}")

    # Detail halus dari kulit sekitar: lapisan frekuensi tinggi kulit digeser beberapa piksel
    # (supaya tidak menyalin struktur di tempat yang sama), ditempel pada piksel yang diisi.
    sig = abu["sigma_detail_px"]
    f = hasil.astype(np.float32)
    detail = f - cv2.GaussianBlur(f, (0, 0), sig)
    kulit2 = kelas_warna(hasil, abu)[0]
    otomatis = isi_semua
    sumber = kulit2 & ~otomatis
    tambah = np.zeros_like(f)
    ada = np.zeros((h, w), bool)
    rng = np.random.default_rng(7)
    for dy, dx in ((9, 13), (-11, 7), (14, -9), (-8, -12)):
        dgeser = np.roll(detail, (dy, dx), axis=(0, 1))
        sgeser = np.roll(sumber, (dy, dx), axis=(0, 1))
        pakai = otomatis & sgeser & ~ada
        tambah[pakai] = dgeser[pakai]
        ada |= pakai
    sisa = otomatis & ~ada
    if sisa.any():
        simpang = float(detail[sumber].std()) if sumber.any() else 2.0
        tambah[sisa] = rng.normal(0, simpang, (int(sisa.sum()), 3)).astype(np.float32)
    f = f + abu["kekuatan_detail"] * tambah * otomatis[..., None]
    # Dilate warna ke margin di sekitar isian supaya tepi pulau tidak menyisakan pinggiran abu-abu saat render.
    daerah = cv2.dilate(otomatis.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=abu["dilate_margin_px"] + 2) > 0
    cov = cakupan.astype(np.float32).copy()
    for _ in range(abu["dilate_margin_px"]):
        sm = cv2.blur(f * cov[..., None], (3, 3))
        c = cv2.blur(cov, (3, 3))
        baru = (c > 1e-6) & (cov < 0.5) & daerah
        f[baru] = sm[baru] / c[baru][:, None]
        cov[baru] = 1.0
    hasil = np.clip(f, 0, 255).astype(np.uint8)
    cv2.imwrite(a.keluar, hasil)
    print("[abu] tersimpan", a.keluar)


main()
