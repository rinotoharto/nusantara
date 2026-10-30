"""
Titik acuan kepala baru (mata, hidung, mulut, dagu, dahi) dengan mediapipe pada render kepala_render.py,
dikonversi ke satuan GLB kepala dan disimpan di wajah.json blok "kepala.acuan" (venv).

  tools/.venv/bin/python tools/blender/kepala_acuan.py --json tools/blender/wajah.json \
      --render aset-mentah/pratinjau/kepala-baru-depan.png
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wajah_acuan import deteksi, URUTAN, gambar_titik  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--render", required=True)
    a = p.parse_args()
    data = json.load(open(a.json))
    kam = data["kepala"]["kamera"]
    img = cv2.imread(a.render, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 4:
        alpha = img[:, :, 3:4].astype(np.float64) / 255
        img = (img[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
    t = deteksi(img)
    if t is None:
        raise SystemExit("deteksi wajah kepala baru gagal")
    n, o, c = kam["ukuran_px"], kam["ortho_scale"], kam["pusat"]
    acuan_m = {k: [round(c[0] + (u / n - 0.5) * o, 4), round(c[2] - (v / n - 0.5) * o, 4)] for k, (u, v) in t.items()}
    jarak_mata = float(np.hypot(*(np.array(acuan_m["mata_kanan"]) - np.array(acuan_m["mata_kiri"]))))
    data["kepala"]["acuan_px"] = t
    data["kepala"]["acuan"] = acuan_m
    data["kepala"]["jarak_mata"] = round(jarak_mata, 4)
    data["kepala"]["acuan_keterangan"] = "satuan GLB kepala: [x, z]; mata_kiri = kiri pada gambar"
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    tanda = img.copy()
    gambar_titik(tanda, t, (255, 128, 0))
    cv2.imwrite(a.render.replace(".png", "-titik.png"), tanda)
    print(f"[kepala] jarak mata {jarak_mata:.4f}, dagu z {acuan_m['dagu'][1]}, dahi z {acuan_m['dahi'][1]}, "
          f"pusat mata x {(acuan_m['mata_kiri'][0] + acuan_m['mata_kanan'][0]) / 2:.4f}")


main()
