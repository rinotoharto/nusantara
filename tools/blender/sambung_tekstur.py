"""
Tekstur sesudah sambung_kepala.py (venv, OpenCV): bercak kelabu di bawah dagu, tali lukis lama di dada,
warna kulit badan disamakan ke kepala, peralihan warna di pita sambungan, tali leher, margin pulau.

  tools/.venv/bin/python tools/blender/sambung_tekstur.py --json tools/blender/wajah.json --blok prajurit \
      --tekstur aset-mentah/tekstur --nama prajurit [--konsep docs/referensi/prajurit-kediri-konsep-01.png]

Masukan dari sambung_kepala.py di folder --tekstur: <nama>-sambung-A-basecolor.png, -A-normal.png, -data1.png
(R bagian: 0 badan, 0,25 tali, 0,5 pita, 0,65 tambal, 1 kepala; G jarak bertanda ke bidang tengah sambungan +-0,1 m;
B 0,55 + 0,45 * normal z, texel kosong 0) dan -data2.png (R sudut keliling sumbu leher, G tinggi z pada data_z,
B jari-jari mendatar dari sumbu leher pada data_r).

Texel yang diganti (bawah dagu, bercak, tali lukis) diisi dari medan warna kulit 3D: warna kulit yang baik
dirata-ratakan per voxel di ruang model lalu dihaluskan, sehingga isian mengikuti nada kulit di sekitarnya
di permukaan, bukan di atlas (pulau UV yang bertetangga di atlas belum tentu bertetangga di badan).
Keluaran: <nama>-basecolor-sambung.png dan <nama>-normal-sambung.png; pasang dengan tekstur_pasang.py.
Angka di blok <blok>.tekstur. Lab memakai skala OpenCV (L 0..255, a dan b 128 netral).
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kulit_warna import halus, statistik, topeng_kulit  # noqa: E402


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


def medan3d(lab, bobot_sumber, xyz, sasaran, voxel, sigma):
    """Warna Lab untuk texel `sasaran` dari medan 3D: rata-rata berbobot texel sumber per voxel, dihaluskan
    Gauss (skala kecil dulu, lalu makin besar untuk voxel yang jauh dari sumber), dibaca trilinear."""
    S_ = bobot_sumber > 0.05
    if not S_.any() or not sasaran.any():
        return None
    ps, pt = xyz[S_], xyz[sasaran]
    lo = np.minimum(ps.min(0), pt.min(0)) - 4 * voxel
    dims = (np.ceil((np.maximum(ps.max(0), pt.max(0)) - lo) / voxel).astype(int) + 5)
    datar = np.ravel_multi_index(((ps - lo) / voxel).astype(int).T, dims)
    w = bobot_sumber[S_].astype(np.float64)
    n = int(np.prod(dims))
    cnt = np.bincount(datar, weights=w, minlength=n).reshape(dims)
    acc = np.stack([np.bincount(datar, weights=w * lab[S_][:, c], minlength=n).reshape(dims) for c in range(3)], axis=-1)
    F = np.zeros(tuple(dims) + (3,))
    terisi = np.zeros(dims, bool)
    for sg in (sigma, 2 * sigma, 4 * sigma, 8 * sigma):
        c = ndimage.gaussian_filter(cnt, sg)
        ok = (c > 0.3) & ~terisi
        if ok.any():
            for k in range(3):
                F[..., k][ok] = ndimage.gaussian_filter(acc[..., k], sg)[ok] / c[ok]
            terisi |= ok
    rata = (acc.reshape(-1, 3).sum(0) / cnt.sum())
    F[~terisi] = rata
    g = ((pt - lo) / voxel - 0.5).T
    return np.stack([ndimage.map_coordinates(ndimage.gaussian_filter(F[..., k], 0.8), g, order=1, mode="nearest") for k in range(3)], axis=1)


def baur(topeng, cak, sigma):
    """Topeng 0..1 dengan tepi dibaurkan, tetap 1 di dalam topeng dan 0 di luar pulau."""
    return np.where(topeng, 1.0, cv2.GaussianBlur(topeng.astype(np.float32), (0, 0), sigma) * cak)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True)
    p.add_argument("--tekstur", required=True)
    p.add_argument("--nama", required=True)
    p.add_argument("--konsep", default=None, help="gambar konsep seluruh badan, untuk laporan warna kulit")
    a = p.parse_args()
    data = json.load(open(a.json))
    P = data[a.blok]
    S, T = P["sambung"], P["tempat"]
    X = P.setdefault("tekstur", {})
    for k, v in {
        "kulit": {"rona_pusat": 10, "rona_lebar": 14, "sat_min": 0.18, "sat_maks": 0.85, "v_min": 0.2},
        "peralihan_m": 0.03, "peralihan_pudar_m": 0.01, "peralihan_kuat": 0.85, "sektor": 48,
        "kelabu": {"kroma_maks": 14, "v_min": 0.45, "atas_dagu_m": 0.03, "lebar_px": 2},
        "bawah_dagu": {"nz_penuh": -0.45, "nz_nol": -0.15, "atas_dagu_m": 0.02, "sudut_derajat": [90.0, 115.0]},
        "pucat_rasio": 0.72, "medan": {"voxel_m": 0.006, "sigma": 1.5, "derau_L": 1.5},
        "tali_lukis": {"aktif": True, "bawah_potong_m": 0.14, "x_abs_maks_m": 0.24, "ambang_L": 20.0, "kulit_min": 0.35, "lebar_px": 3,
                       "normal_kuat": 0.3},
        "separuh_wajah": {"ambang_L": 6.0, "sudut_derajat": [15.0, 60.0]},
        "margin_px": 8,
        "keterangan": "peralihan_m: tinggi pita peralihan warna dari kulit badan (bawah) ke kulit kepala (atas), berpusat "
                      "di bidang tengah sambungan. tali_lukis: texel dada atas (sampai bawah_potong_m di bawah potongan) "
                      "yang lebih gelap ambang_L dari kulit sekitarnya atau bukan kulit diisi kulit (tali konsep yang "
                      "ikut tercetak Tripo). kelabu: bercak tanpa warna di bawah dagu kepala.",
    }.items():
        X.setdefault(k, v)
    rng = np.random.default_rng(11)
    t = a.tekstur
    f = lambda akhiran: os.path.join(t, f"{a.nama}-sambung-{akhiran}.png")
    bc = cv2.imread(f("A-basecolor"))
    nm = cv2.imread(f("A-normal"))
    d1 = cv2.imread(f("data1"), cv2.IMREAD_UNCHANGED).astype(np.float32) / 65535
    d2 = cv2.imread(f("data2"), cv2.IMREAD_UNCHANGED).astype(np.float32) / 65535
    cak = d1[:, :, 0] > 0.05
    nz = (d1[:, :, 0] - 0.55) / 0.45
    bagian = d1[:, :, 2]
    jarak = d1[:, :, 1] * 0.2 - 0.1
    sudut = d2[:, :, 2] * 2 * np.pi - np.pi
    z = P["data_z"][0] + d2[:, :, 1] * (P["data_z"][1] - P["data_z"][0])
    jari = P["data_r"][0] + d2[:, :, 0] * (P["data_r"][1] - P["data_r"][0])
    xyz = np.stack([jari * np.cos(sudut), jari * np.sin(sudut), z], axis=-1)
    x_abs = np.abs(xyz[:, :, 0])
    M_ = X["medan"]
    badan = cak & (bagian < 0.12)
    tali = cak & (bagian >= 0.12) & (bagian < 0.37)
    pita = cak & (bagian >= 0.37) & (bagian < 0.58)
    tambal = cak & (bagian >= 0.58) & (bagian < 0.75)      # tambalan kantong lipatan di badan
    kepala = cak & (bagian >= 0.75)
    print(f"[tekstur] texel badan {badan.sum()}, kepala {kepala.sum()}, pita {pita.sum()}, tali {tali.sum()}")
    lapor = {}
    # Kain menurut posisi (opsional): kain cokelat atau merah berona sama dengan kulit, jadi tanpa ini ikut terhitung
    # sebagai kulit badan dan ikut digeser warnanya.
    zk = X.get("zona_kain")
    kain_zona = np.zeros_like(cak)
    if zk:
        kain_zona = badan & (z >= zk["z_m"][0]) & (z <= zk["z_m"][1]) & (x_abs <= zk["x_abs_maks_m"])
        print(f"[tekstur] zona kain menurut posisi: {kain_zona.sum()} texel tidak dihitung sebagai kulit")

    def kelas(img):
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        return topeng_kulit(img, X["kulit"]), hsv[:, :, 2] / 255, np.hypot(lab[:, :, 1] - 128, lab[:, :, 2] - 128), lab

    depan = -np.pi / 2
    selisih_sudut = np.angle(np.exp(1j * (sudut - depan)))
    dagu = S["dagu_z_m"]

    def ganti_dengan_medan(img, bobot, sumber, nama):
        """Texel berbobot > 0 dicampur ke medan warna kulit 3D dari texel `sumber`."""
        lab_ = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        sasaran = bobot > 0.01
        nilai = medan3d(lab_, sumber.astype(np.float32), xyz, sasaran, M_["voxel_m"], M_["sigma"])
        if nilai is None:
            print(f"[tekstur] {nama}: tidak ada sumber kulit atau sasaran")
            return img
        nilai[:, 0] += rng.normal(0, M_["derau_L"], len(nilai))
        b = bobot[sasaran][:, None]
        lab_[sasaran] = lab_[sasaran] * (1 - b) + nilai * b
        return cv2.cvtColor(np.clip(lab_, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

    # 1a. Bawah dagu dan leher kepala. Permukaan bawah dagu (menghadap bawah) tidak terlihat di gambar konsep
    # kepala, jadi tekstur Tripo di sana mosaik pucat dan gelap: seluruhnya diganti medan warna kulit dari
    # tepi rahang dan tenggorokan. Di luar itu hanya bercak kelabu dan pucat yang diganti.
    kulit, v, kroma, lab = kelas(bc)
    G, D_ = X["kelabu"], X["bawah_dagu"]
    leher_k = kepala & (z < dagu + G["atas_dagu_m"])
    kroma_med = float(np.median(kroma[kepala & (kulit > 0.6)]))
    L_med_k = float(np.median(lab[:, :, 0][leher_k & (kulit > 0.6)]))
    buruk = leher_k & (((kroma <= G["kroma_maks"]) & (v >= G["v_min"])) | ((kroma < X["pucat_rasio"] * kroma_med) & (lab[:, :, 0] > L_med_k - 10)))
    buruk = (cv2.dilate(buruk.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=G["lebar_px"]) > 0) & leher_k
    a0, a1 = np.radians(D_["sudut_derajat"])
    rak = halus((D_["nz_nol"] - nz) / (D_["nz_nol"] - D_["nz_penuh"])) * halus((a1 - np.abs(selisih_sudut)) / (a1 - a0)) \
        * halus((dagu + D_["atas_dagu_m"] - z) / 0.012) * kepala
    bobot_k = np.maximum(rak, baur(buruk, kepala, 1.5))
    sumber_k = kepala & (z < dagu + 0.05) & (kulit > 0.6) & ~buruk & (rak < 0.05) & (kroma >= 0.8 * kroma_med)
    bc = ganti_dengan_medan(bc, bobot_k, sumber_k, "bawah dagu")
    lapor["bawah_dagu"] = {"texel_rak": int((rak > 0.5).sum()), "texel_bercak": int(buruk.sum()), "kroma_median_kulit": round(kroma_med, 1)}
    print(f"[tekstur] bawah dagu: {int((rak > 0.5).sum())} texel permukaan menghadap bawah diganti medan kulit, "
          f"{int(buruk.sum())} texel bercak kelabu atau pucat di leher kepala")

    # 1b. Dada atas, pangkal leher, punggung atas (badan): tali lukis lama, coretan gelap, dan bercak pucat.
    L_ = X["tali_lukis"]
    hapus = np.zeros_like(cak)
    daerah = np.zeros_like(cak)
    if L_["aktif"]:
        kulit, v, kroma, lab = kelas(bc)
        # Batas bawah menurut tinggi z (kanal jarak hanya berlaku sampai 0,1 m dari bidang tengah).
        daerah = badan & (z > T["bidang_badan_m"][2] - L_["bawah_potong_m"]) & (x_abs < L_["x_abs_maks_m"])
        baik = daerah & (kulit > 0.6)
        L_med, kroma_med_b = float(np.median(lab[:, :, 0][baik])), float(np.median(kroma[baik]))
        hapus = daerah & ((lab[:, :, 0] < L_med - L_["ambang_L"]) | (kulit < L_["kulit_min"]) | (kroma < X["pucat_rasio"] * kroma_med_b))
        hapus = (cv2.dilate(hapus.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=L_["lebar_px"]) > 0) & daerah
        sumber_b = badan & (z > T["bidang_badan_m"][2] - L_["bawah_potong_m"] - 0.05) & (x_abs < L_["x_abs_maks_m"] + 0.05) \
            & (kulit > 0.6) & ~hapus & (kroma >= 0.8 * kroma_med_b)
        bc = ganti_dengan_medan(bc, np.maximum(baur(hapus, badan, 2.0), tambal), sumber_b, "dada atas")
        badan = badan | tambal          # tambalan selanjutnya diperlakukan sebagai kulit badan
        lapor["tali_lukis"] = {"texel": int(hapus.sum()), "daerah_texel": int(daerah.sum()), "L_median": round(L_med, 1),
                               "kroma_median": round(kroma_med_b, 1)}
        print(f"[tekstur] dada atas dan pangkal leher: {hapus.sum()} dari {daerah.sum()} texel (tali lukis, coretan gelap, "
              f"bercak pucat) diganti medan kulit; L median {L_med:.1f}, kroma median {kroma_med_b:.1f}")

    # 2. Warna kulit: badan digeser ke rata-rata kulit kepala (sebaran badan tetap).
    kulit, v, kroma, lab = kelas(bc)
    w_badan, w_kepala = kulit * badan * ~kain_zona, kulit * kepala
    rata_b, simpang_b = statistik(lab, w_badan)
    rata_k, simpang_k = statistik(lab, w_kepala)
    lab = lab + (rata_k - rata_b) * w_badan[..., None]
    lapor["kulit"] = {"badan_sebelum": [round(float(x), 1) for x in rata_b], "kepala": [round(float(x), 1) for x in rata_k],
                      "badan_simpang": [round(float(x), 1) for x in simpang_b], "kepala_simpang": [round(float(x), 1) for x in simpang_k]}
    if a.konsep:
        kn = cv2.imread(a.konsep)
        wk = topeng_kulit(kn, X["kulit"]) * (kn.min(axis=2) < 235)
        rata_kn, _ = statistik(cv2.cvtColor(kn, cv2.COLOR_BGR2LAB).astype(np.float32), wk)
        lapor["kulit"]["konsep"] = [round(float(x), 1) for x in rata_kn]
    print(f"[tekstur] kulit Lab: badan {np.round(rata_b, 1)} -> kepala {np.round(rata_k, 1)}"
          + (f"; konsep {lapor['kulit']['konsep']}" if a.konsep else ""))

    # 3. Peralihan di pita sambungan: medan warna per sudut, dari kulit badan tepat di bawah pita peralihan ke
    # kulit kepala tepat di atasnya.
    h_ = X["peralihan_m"] / 2
    ns = X["sektor"]
    sek = np.clip(((sudut + np.pi) / (2 * np.pi) * ns).astype(int), 0, ns - 1)
    def medan(topeng_w):
        out = np.full((ns, 3), np.nan, dtype=np.float32)
        for s_ in range(ns):
            m = topeng_w * (sek == s_)
            if m.sum() > 30:
                out[s_] = statistik(lab, m)[0]
        ada = ~np.isnan(out[:, 0])
        if not ada.any():
            return None
        idx = np.arange(ns)
        for c in range(3):      # isi sektor kosong (melingkar), lalu ratakan
            out[:, c] = np.interp(idx, np.concatenate([idx[ada] - ns, idx[ada], idx[ada] + ns]), np.tile(out[ada, c], 3))
        return (out + np.roll(out, 1, axis=0) + np.roll(out, -1, axis=0)) / 3
    kul = topeng_kulit(cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR), X["kulit"])
    Cb = medan(kul * badan * (jarak < -h_) * (jarak > -h_ - 0.02))
    Ck = medan(kul * kepala * (jarak > h_) * (jarak < h_ + 0.02))
    if Cb is None or Ck is None:
        raise SystemExit("medan warna sambungan kosong: cek data1 dan bidang potong")
    # interpolasi antar sektor
    fs = (sudut + np.pi) / (2 * np.pi) * ns - 0.5
    s0 = np.floor(fs).astype(int)
    fr = (fs - s0)[..., None]
    ambil = lambda C: C[s0 % ns] * (1 - fr) + C[(s0 + 1) % ns] * fr
    campur = halus((jarak + h_) / (2 * h_))[..., None]
    sasaran = ambil(Cb) * (1 - campur) + ambil(Ck) * campur
    kuat = halus((h_ + X["peralihan_pudar_m"] - np.abs(jarak)) / X["peralihan_pudar_m"]) * X["peralihan_kuat"]
    kuat = kuat * kul * (badan | kepala)
    lab = lab * (1 - kuat[..., None]) + sasaran * kuat[..., None]
    lab[pita] = sasaran[pita] + rng.normal(0, 1.5, (int(pita.sum()), 1)).astype(np.float32) * np.array([1.0, 0.15, 0.15], dtype=np.float32)
    lapor["peralihan"] = {"texel_kulit_diubah": int((kuat > 0.05).sum()), "texel_pita": int(pita.sum()),
                          "lab_badan_rata": [round(float(x), 1) for x in Cb.mean(axis=0)],
                          "lab_kepala_rata": [round(float(x), 1) for x in Ck.mean(axis=0)],
                          "selisih_L_per_sektor_maks": round(float(np.abs(Cb[:, 0] - Ck[:, 0]).max()), 1)}
    print(f"[tekstur] peralihan {X['peralihan_m'] * 100:.0f} cm: kulit leher badan Lab {np.round(Cb.mean(0), 1)}, kulit leher kepala "
          f"{np.round(Ck.mean(0), 1)}, selisih L per sektor maks {lapor['peralihan']['selisih_L_per_sektor_maks']}")

    # 4. Setengah wajah lebih gelap? Bandingkan L pipi kiri dan kanan (sudut dari depan).
    W = X["separuh_wajah"]
    z_mulut, z_mata = dagu + 0.035, T["kepala"]["mata_z_m"]
    pipi = kepala * kul * (z > z_mulut) * (z < z_mata - 0.01)
    a0, a1 = np.radians(W["sudut_derajat"])
    kiri = pipi * (selisih_sudut < -a0) * (selisih_sudut > -a1)
    kanan = pipi * (selisih_sudut > a0) * (selisih_sudut < a1)
    L_kiri, L_kanan = float(statistik(lab, kiri)[0][0]), float(statistik(lab, kanan)[0][0])
    beda = L_kiri - L_kanan
    diratakan = False
    if abs(beda) > W["ambang_L"]:
        # koreksi halus: L sisi terang turun dan sisi gelap naik setengah selisih, memudar ke tengah wajah
        bobot = halus(np.abs(selisih_sudut) / a0) * np.sign(selisih_sudut) * kepala * kul * (z > dagu) * (np.abs(selisih_sudut) < np.radians(110))
        lab[:, :, 0] += bobot * (beda / 2)
        diratakan = True
    lapor["separuh_wajah"] = {"L_sisi_a": round(L_kiri, 1), "L_sisi_b": round(L_kanan, 1), "selisih_L": round(beda, 1), "diratakan": diratakan}
    print(f"[tekstur] pipi: L {L_kiri:.1f} dan {L_kanan:.1f}, selisih {beda:+.1f} (ambang {W['ambang_L']}): "
          + ("diratakan" if diratakan else "tidak perlu diratakan"))

    hasil = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    # 5. Tali leher: warna tetap dengan sedikit variasi.
    r, g, b = S["tali"]["warna_srgb"]
    hasil[tali] = np.clip(np.array([b, g, r], dtype=np.float32) + rng.normal(0, 5, (int(tali.sum()), 1)), 0, 255).astype(np.uint8)
    # 6. Margin pulau dan normal map: pita, tali, dan texel yang dihapus dibuat rata.
    hasil = dilate_warna(hasil, cak, X["margin_px"])
    rata = np.array([255, 128, 128], dtype=np.uint8)       # BGR dari (128, 128, 255)
    nm[pita | tali | tambal] = rata
    if L_["aktif"]:
        # Di daerah pangkal leher yang mesh-nya dihaluskan, normal map (yang masih memuat tonjolan tali lama)
        # dilemahkan ke normal_kuat; texel tali yang dihapus dibuat rata penuh.
        lemah = (daerah.astype(np.float32) * (1 - L_["normal_kuat"]))
        lembut = np.maximum(cv2.GaussianBlur(hapus.astype(np.float32), (0, 0), 2.0), cv2.GaussianBlur(lemah, (0, 0), 3.0))[..., None]
        nm = (nm * (1 - lembut) + rata * lembut).astype(np.uint8)
    nm = dilate_warna(nm, cak, X["margin_px"])
    out_bc, out_n = os.path.join(t, f"{a.nama}-basecolor-sambung.png"), os.path.join(t, f"{a.nama}-normal-sambung.png")
    cv2.imwrite(out_bc, hasil)
    cv2.imwrite(out_n, nm)
    X["hasil"] = lapor
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    print("[tekstur] tersimpan", out_bc, out_n)


if __name__ == "__main__":
    main()
