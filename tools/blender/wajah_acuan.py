"""
Titik acuan wajah pada gambar konsep dan render model, transformasi penyelaras, dan gambar tumpang
(Tahap 1 perbaikan wajah). Dijalankan dengan Python venv, bukan Blender:

  tools/.venv/bin/python tools/blender/wajah_acuan.py --json tools/blender/wajah.json \
      --konsep docs/referensi/wijaya-konsep-01.png --model aset-mentah/pratinjau/wajah-model-depan.png \
      --pratinjau aset-mentah/pratinjau

Titik acuan dicari dengan mediapipe Face Mesh. Kalau deteksi gagal (wajah model meleleh), titik
yang ada di wajah.json dipakai apa adanya; koreksi dengan tangan di blok "acuan" lalu jalankan ulang
dengan --tanpa-deteksi. Koordinat piksel (u, v) dari kiri atas gambar masing-masing.
"""
import argparse
import json
import os

import cv2
import numpy as np

# Indeks landmark Face Mesh (468 titik).
TITIK = {
    "mata_kiri": [33, 133, 160, 158, 144, 153],   # kiri pada gambar (kanan orangnya)
    "mata_kanan": [362, 263, 387, 385, 380, 373],
    "ujung_hidung": [1],
    "mulut_kiri": [61],
    "mulut_kanan": [291],
    "dagu": [152],
    "dahi": [10],
}
URUTAN = ["mata_kiri", "mata_kanan", "ujung_hidung", "mulut_kiri", "mulut_kanan", "dagu", "dahi"]


def argumen():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--konsep", required=True)
    p.add_argument("--model", required=True)
    p.add_argument("--pratinjau", required=True)
    p.add_argument("--tekstur", default="aset-mentah/tekstur", help="folder keluaran konsep selaras")
    p.add_argument("--tanpa-deteksi", action="store_true", help="pakai titik di wajah.json tanpa mendeteksi ulang")
    p.add_argument("--konsep-potong", type=float, nargs=4, metavar=("U0", "V0", "U1", "V1"), default=None,
                   help="area kepala di gambar konsep (piksel); bawaan: dari deteksi, atau dari wajah.json")
    return p.parse_args()


def deteksi_sekali(gambar_bgr):
    import mediapipe as mp
    rgb = cv2.cvtColor(gambar_bgr, cv2.COLOR_BGR2RGB)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True,
                                         min_detection_confidence=0.2) as fm:
        hasil = fm.process(rgb)
    if not hasil.multi_face_landmarks:
        return None
    lm = hasil.multi_face_landmarks[0].landmark
    h, w = gambar_bgr.shape[:2]
    titik = {}
    for nama, idx in TITIK.items():
        pts = np.array([[lm[i].x * w, lm[i].y * h] for i in idx])
        titik[nama] = [float(v) for v in pts.mean(axis=0)]
    return titik


def deteksi(gambar_bgr):
    """Coba gambar utuh; kalau wajah terlalu kecil (gambar seluruh badan), potong bagian atas dan perbesar."""
    h, w = gambar_bgr.shape[:2]
    percobaan = [(0, 0, w, h, 1.0)]
    for tinggi_potong in (0.35, 0.25, 0.18):
        hp = int(h * tinggi_potong)
        x0, x1 = int(w * 0.2), int(w * 0.8)
        percobaan.append((x0, 0, x1, hp, 2.0))
        percobaan.append((x0, 0, x1, hp, 4.0))
    for x0, y0, x1, y1, skala in percobaan:
        potong = gambar_bgr[y0:y1, x0:x1]
        if skala != 1.0:
            potong = cv2.resize(potong, None, fx=skala, fy=skala, interpolation=cv2.INTER_CUBIC)
        t = deteksi_sekali(potong)
        if t is not None:
            return {n: [round(u / skala + x0, 1), round(v / skala + y0, 1)] for n, (u, v) in t.items()}
    return None


def ke_array(titik):
    return np.array([titik[n] for n in URUTAN], dtype=np.float64)


def gambar_titik(img, titik, warna, label=True):
    for nama in URUTAN:
        u, v = titik[nama]
        cv2.circle(img, (int(round(u)), int(round(v))), 5, warna, 2)
        if label:
            cv2.putText(img, nama, (int(u) + 7, int(v) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, warna, 1, cv2.LINE_AA)


def main():
    a = argumen()
    data = json.load(open(a.json)) if os.path.exists(a.json) else {}
    acuan = data.setdefault("acuan", {})
    konsep = cv2.imread(a.konsep, cv2.IMREAD_COLOR)
    model = cv2.imread(a.model, cv2.IMREAD_UNCHANGED)
    if model.shape[2] == 4:
        alpha = model[:, :, 3:4].astype(np.float64) / 255
        model_bgr = (model[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
    else:
        model_bgr = model

    catatan = {}
    for nama, img in (("konsep", konsep), ("model", model_bgr)):
        if a.tanpa_deteksi and nama in acuan:
            catatan[nama] = "dari wajah.json"
            continue
        t = deteksi(img)
        if t is None:
            catatan[nama] = "deteksi gagal" + (", pakai wajah.json" if nama in acuan else ", TIDAK ADA TITIK")
            continue
        acuan[nama] = t
        catatan[nama] = "mediapipe"
    for nama, ket in catatan.items():
        print(f"[acuan] {nama}: {ket}")
    if "konsep" not in acuan or "model" not in acuan:
        json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
        raise SystemExit("titik acuan belum lengkap; isi blok 'acuan' di wajah.json dengan tangan")

    # Transformasi kemiripan (geser, skala, putar) konsep -> model dari semua titik.
    src = ke_array(acuan["konsep"]).astype(np.float32)
    dst = ke_array(acuan["model"]).astype(np.float32)
    M, inlier = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    skala = float(np.hypot(M[0, 0], M[0, 1]))
    putar = float(np.degrees(np.arctan2(M[0, 1], M[0, 0])))
    sisa = np.linalg.norm((cv2.transform(src[None], M)[0] - dst), axis=1)
    data["transformasi"] = {
        "matriks_konsep_ke_model": M.tolist(),
        "skala": round(skala, 4),
        "putar_derajat": round(putar, 2),
        "geser_px": [round(float(M[0, 2]), 1), round(float(M[1, 2]), 1)],
        "sisa_px_per_titik": {n: round(float(s), 1) for n, s in zip(URUTAN, sisa)},
        "keterangan": "u_model = M00*u_konsep + M01*v_konsep + M02; v_model = M10*u_konsep + M11*v_konsep + M12",
    }
    print(f"[acuan] skala {skala:.4f}, putar {putar:.2f} derajat, geser {M[0,2]:.1f}, {M[1,2]:.1f}; "
          f"sisa rata {sisa.mean():.1f} px, maks {sisa.max():.1f} px")

    # Potongan kepala konsep: dari titik dahi dan dagu dengan margin, atau dari argumen/json.
    if a.konsep_potong:
        potong = [int(v) for v in a.konsep_potong]
    elif "konsep_potong" in data:
        potong = data["konsep_potong"]
    else:
        k = acuan["konsep"]
        tinggi_wajah = k["dagu"][1] - k["dahi"][1]
        cx = (k["mata_kiri"][0] + k["mata_kanan"][0]) / 2
        cy = (k["dahi"][1] + k["dagu"][1]) / 2 - tinggi_wajah * 0.15
        sisi = tinggi_wajah * 2.2
        potong = [int(cx - sisi / 2), int(cy - sisi / 2), int(cx + sisi / 2), int(cy + sisi / 2)]
    potong = [max(0, potong[0]), max(0, potong[1]), min(konsep.shape[1], potong[2]), min(konsep.shape[0], potong[3])]
    data["konsep_potong"] = potong
    kepala = konsep[potong[1]:potong[3], potong[0]:potong[2]]
    os.makedirs(a.pratinjau, exist_ok=True)
    cv2.imwrite(os.path.join(a.pratinjau, "wajah-konsep-kepala.png"), kepala)

    # Gambar tumpang: konsep diwarp ke bingkai render, 50 persen di atas render model.
    h, w = model_bgr.shape[:2]
    konsep_warp = cv2.warpAffine(konsep, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))
    tumpang = cv2.addWeighted(model_bgr, 0.5, konsep_warp, 0.5, 0)
    gambar_titik(tumpang, acuan["model"], (0, 0, 255))
    titik_konsep_warp = {n: cv2.transform(np.array([[acuan["konsep"][n]]], dtype=np.float32), M)[0, 0].tolist() for n in URUTAN}
    gambar_titik(tumpang, titik_konsep_warp, (255, 128, 0), label=False)
    cv2.putText(tumpang, "merah: model   biru: konsep (diselaraskan)", (10, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 30, 30), 1, cv2.LINE_AA)
    cv2.imwrite(os.path.join(a.pratinjau, "wajah-tumpang.png"), tumpang)
    # Konsep selaras tanpa campuran: sumber proyeksi Tahap 2, di bingkai kamera yang sama.
    os.makedirs(a.tekstur, exist_ok=True)
    cv2.imwrite(os.path.join(a.tekstur, "wajah-konsep-selaras.png"), konsep_warp)
    # Juga versi berdampingan dengan titik, untuk mengecek deteksi di tiap gambar.
    k_tanda = kepala.copy()
    k_titik = {n: [acuan["konsep"][n][0] - potong[0], acuan["konsep"][n][1] - potong[1]] for n in URUTAN}
    gambar_titik(k_tanda, k_titik, (255, 128, 0))
    k_tanda = cv2.resize(k_tanda, (h, h))
    m_tanda = model_bgr.copy()
    gambar_titik(m_tanda, acuan["model"], (0, 0, 255))
    cv2.imwrite(os.path.join(a.pratinjau, "wajah-titik.png"), np.hstack([k_tanda, m_tanda]))
    json.dump(data, open(a.json, "w"), indent=2, ensure_ascii=False)
    print("[acuan] tersimpan:", a.json, "dan", os.path.join(a.pratinjau, "wajah-tumpang.png"))


main()
