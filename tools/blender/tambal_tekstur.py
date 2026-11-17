"""
Tambal setempat base color dengan warna kulit sekitar (venv), untuk sisa kecil yang lolos dari abu_isi.py.

  tools/.venv/bin/python tools/blender/tambal_tekstur.py --json tools/blender/wajah.json --blok prajurit \
      --masuk aset-mentah/tekstur/prajurit-basecolor-sambung.png --data <data_uv dari model utuh>.png \
      --keluar aset-mentah/tekstur/prajurit-basecolor-tambal.png [--pratinjau <berkas>.png]

Data per texel dari data_uv.py pada model yang sama (R = |x|, G = z, B = cakupan). Daftar tambalan di
<blok>.tambal.daerah: tiap daerah punya kotak posisi (x_abs_m, z_m) dan `pilih`: "bukan_kulit" (semua texel yang
bukan warna kulit) atau "kelabu" (kroma rendah, b di bawah `b_maks`). Texel terpilih diganti rata-rata Gauss
warna kulit di sekitarnya (hanya texel kulit di luar tambalan), tepinya dibaurkan.
"""
import argparse
import json

import cv2
import numpy as np

p = argparse.ArgumentParser()
for n in ("json", "blok", "masuk", "data", "keluar"):
    p.add_argument("--" + n, required=True)
p.add_argument("--pratinjau", default=None)
a = p.parse_args()
data = json.load(open(a.json))
B = data[a.blok]
T = B.setdefault("tambal", {})
T.setdefault("kulit_a_min", 6)
T.setdefault("kulit_b_min", 10)
T.setdefault("sigma_px", 14)
T.setdefault("lebar_px", 3)
T.setdefault("margin_px", 10)
D = cv2.imread(a.data, cv2.IMREAD_UNCHANGED).astype(np.float64) / 65535
P = cv2.imread(a.masuk)
x, z, cak = D[..., 2] * B["data_x"][1], D[..., 1] * B["data_z"][1], D[..., 0] > 0.5
lab = cv2.cvtColor(P, cv2.COLOR_BGR2LAB).astype(np.float64)
ca, cb = lab[..., 1] - 128, lab[..., 2] - 128
kulit = cak & (ca > T["kulit_a_min"]) & (cb > T["kulit_b_min"])
topeng = np.zeros(cak.shape, bool)
hasil = {}
for d in T.get("daerah", []):
    kotak = cak & (x >= d["x_abs_m"][0]) & (x <= d["x_abs_m"][1]) & (z >= d["z_m"][0]) & (z <= d["z_m"][1])
    m = kotak & (~kulit if d["pilih"] == "bukan_kulit" else (cb < d.get("b_maks", 8)))
    hasil[d["nama"]] = int(m.sum())
    topeng |= m
inti = np.ones((2 * T["lebar_px"] + 1,) * 2, np.uint8)
lebar = cv2.dilate(topeng.astype(np.uint8), inti).astype(bool) & cak
# margin pulau UV di sebelah tambalan ikut diganti; kalau tidak, warna lama merembes di jahitan
inti_m = np.ones((2 * T["margin_px"] + 1,) * 2, np.uint8)
lebar |= cv2.dilate(topeng.astype(np.uint8), inti_m).astype(bool) & ~cak
sumber = (kulit & ~lebar).astype(np.float64)
isi = np.zeros(P.shape, np.float64)
bobot = np.zeros(cak.shape, np.float64)
for s in (T["sigma_px"], T["sigma_px"] * 3):          # skala kecil dulu, skala besar untuk bagian tengah tambalan
    w = cv2.GaussianBlur(sumber, (0, 0), s)
    c = cv2.GaussianBlur(P.astype(np.float64) * sumber[..., None], (0, 0), s)
    pakai = (bobot < 1e-3) & (w > 1e-3)
    isi[pakai] = c[pakai] / w[pakai][:, None]
    bobot[pakai] = w[pakai]
alfa = cv2.GaussianBlur(lebar.astype(np.float64), (0, 0), 1.2)[..., None] * (bobot > 0)[..., None]
alfa[lebar] = np.maximum(alfa[lebar], (bobot[lebar] > 0)[:, None] * 1.0)
out = np.clip(P * (1 - alfa) + isi * alfa, 0, 255).astype(np.uint8)
cv2.imwrite(a.keluar, out)
T["hasil"] = {"texel_per_daerah": hasil, "texel_ditambal": int(lebar.sum())}
json.dump(data, open(a.json, "w"), ensure_ascii=False, indent=2)
print("[tambal]", T["hasil"])
if a.pratinjau:
    ys, xs = np.nonzero(lebar)
    potong = []
    for lbl in range(1, cv2.connectedComponents(lebar.astype(np.uint8))[0]):
        pass
    n_, L_, st, _ = cv2.connectedComponentsWithStats(lebar.astype(np.uint8), 8)
    for i in np.argsort(-st[1:, 4])[:4] + 1:
        x0, y0, w_, h_ = st[i][:4]
        k = (slice(max(0, y0 - 40), y0 + h_ + 40), slice(max(0, x0 - 40), x0 + w_ + 40))
        pasangan = np.hstack([P[k], out[k]])
        potong.append(cv2.resize(pasangan, (480, round(480 * pasangan.shape[0] / pasangan.shape[1])), interpolation=cv2.INTER_NEAREST))
    if potong:
        cv2.imwrite(a.pratinjau, np.vstack(potong))
