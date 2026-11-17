"""
Tumpangkan siluet render model dengan gambar konsep, diskalakan ke tinggi yang sama (venv, OpenCV).
Dipakai untuk mengecek proporsi: tinggi kepala, tinggi dagu dan bahu, lebar leher terhadap rahang dan bahu
(depan), kemiringan leher dan lekuk bawah dagu (samping).

  tools/.venv/bin/python tools/blender/tumpang_konsep.py --render <siluet.png RGBA> \
      --konsep docs/referensi/prajurit-kediri-konsep-01.png --keluar aset-mentah/pratinjau/prajurit-tumpang-konsep-depan.png

Render: PNG berlatar transparan dari kamera ortografis (sambung_kepala.py tahap tempat, atau render lain).
Konsep: latar putih. Kedua siluet disamakan tingginya (puncak sanggul sampai telapak kaki), alas kaki dan
tengah kotak pembatasnya diimpitkan. Keluaran tiga panel: seluruh badan dengan garis tepi (merah = konsep,
biru = model), perbesaran kepala sampai bahu dengan garis tepi, dan perbesaran yang sama dengan gambar
konsep ditumpangkan setengah tembus pandang.
"""
import argparse

import cv2
import numpy as np


def kotak(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def terbesar(m):
    n, label, stat, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    if n <= 1:
        return m
    return label == (1 + np.argmax(stat[1:, cv2.CC_STAT_AREA]))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--render", required=True)
    p.add_argument("--konsep", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--cermin", action="store_true", help="balik konsep kiri-kanan")
    p.add_argument("--atas", type=float, default=0.30, help="bagian atas siluet yang diperbesar (pecahan tinggi)")
    p.add_argument("--putih-min", type=int, default=238)
    a = p.parse_args()

    r = cv2.imread(a.render, cv2.IMREAD_UNCHANGED)
    alpha = r[:, :, 3].astype(np.float32) / 255
    rgb = (r[:, :, :3] * alpha[..., None] + 235 * (1 - alpha[..., None])).astype(np.uint8)
    # Semua bagian model dipakai (kepala dan badan bisa belum tersambung), kecuali bintik kecil.
    n_m, label_m, stat_m, _ = cv2.connectedComponentsWithStats((alpha > 0.5).astype(np.uint8), connectivity=8)
    m_model = np.isin(label_m, [i for i in range(1, n_m) if stat_m[i, cv2.CC_STAT_AREA] >= 200])
    k = cv2.imread(a.konsep, cv2.IMREAD_COLOR)
    if a.cermin:
        k = k[:, ::-1].copy()
    m_k = k.min(axis=2) < a.putih_min
    m_k = cv2.morphologyEx(m_k.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    m_k = terbesar(m_k)

    mx0, my0, mx1, my1 = kotak(m_model)
    kx0, ky0, kx1, ky1 = kotak(m_k)
    skala = (my1 - my0) / (ky1 - ky0)
    # Peta konsep ke bingkai render: tinggi sama, alas dan tengah berimpit.
    tx = (mx0 + mx1) / 2 - skala * (kx0 + kx1) / 2
    ty = my1 - skala * ky1
    M = np.array([[skala, 0, tx], [0, skala, ty]], dtype=np.float64)
    h, w = rgb.shape[:2]
    k_s = cv2.warpAffine(k, M, (w, h), flags=cv2.INTER_AREA if skala < 1 else cv2.INTER_LINEAR, borderValue=(255, 255, 255))
    mk_s = cv2.warpAffine(m_k.astype(np.uint8) * 255, M, (w, h), flags=cv2.INTER_LINEAR) > 127

    def tepi(m, tebal):
        c, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        return c, tebal

    garis = rgb.copy()
    cv2.drawContours(garis, tepi(m_model, 1)[0], -1, (200, 90, 0), 2)
    cv2.drawContours(garis, tepi(mk_s, 1)[0], -1, (0, 0, 230), 2)
    campur = cv2.addWeighted(rgb, 0.5, k_s, 0.5, 0)
    cv2.drawContours(campur, tepi(m_model, 1)[0], -1, (200, 90, 0), 1)

    # Perbesaran bagian atas: kepala sampai bahu.
    t_atas = int((my1 - my0) * a.atas)
    cy0, cy1 = max(my0 - 12, 0), my0 + t_atas
    setengah = int((cy1 - cy0) * 0.5)
    cxm = (mx0 + mx1) // 2
    cx0, cx1 = max(cxm - setengah, 0), min(cxm + setengah, w)
    f = h / (cy1 - cy0)
    besar = lambda im: cv2.resize(im[cy0:cy1, cx0:cx1], (int((cx1 - cx0) * f), h), interpolation=cv2.INTER_CUBIC)
    # Seluruh badan dipotong ke kotak siluet supaya panel tidak lebar kosong.
    px0, px1 = max(min(mx0, int(skala * kx0 + tx)) - 20, 0), min(max(mx1, int(skala * kx1 + tx)) + 20, w)
    hasil = np.hstack([garis[:, px0:px1], besar(garis), besar(campur)])
    cv2.imwrite(a.keluar, hasil)
    # Angka kasar untuk laporan: lebar siluet per tinggi (pecahan dari puncak), model dan konsep.
    def lebar_pada(m, y0, y1, f_):
        y = int(y0 + (y1 - y0) * f_)
        xs = np.nonzero(m[y])[0]
        return (xs.max() - xs.min() + 1) if len(xs) else 0
    tinggi_px = my1 - my0
    baris = []
    for f_ in (0.04, 0.08, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22):
        baris.append(f"{f_:.2f}: model {lebar_pada(m_model, my0, my1, f_) / tinggi_px * 100:.1f} konsep {lebar_pada(mk_s, my0, my1, f_) / tinggi_px * 100:.1f}")
    print(f"[tumpang] skala konsep {skala:.3f}; lebar siluet (persen tinggi) pada pecahan tinggi dari puncak: " + "; ".join(baris))
    print("[tumpang] tersimpan", a.keluar)


main()
