"""
Render kepala model dari depan dengan kamera ortografis (Tahap 1 perbaikan wajah).

  blender -b -P tools/blender/wajah_render.py -- --masuk public/models/wijaya.glb \
      --keluar aset-mentah/pratinjau/wajah-model-depan.png --json tools/blender/wajah.json

Kamera disimpan ke wajah.json (blok "kamera") supaya Tahap 2 memakai kamera yang sama persis.
Pencahayaan rata (world saja, tanpa bayangan) supaya warna tekstur terlihat apa adanya.
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--ukuran", type=int, default=1024)
    p.add_argument("--bagian-kepala", type=float, default=0.16,
                   help="tinggi kepala sebagai pecahan tinggi model (untuk batas bawah bingkai, di leher)")
    p.add_argument("--rata", action="store_true", help="tanpa pencahayaan terarah: emisi base color saja")
    p.add_argument("--netral", action="store_true", help="cahaya netral: tiga matahari lemah tanpa bayangan")
    p.add_argument("--sudut", choices=["depan", "tigaperempat", "samping", "badan", "badan-tigaperempat",
                                       "badan-samping", "badan-belakang", "tangan", "kaki",
                                       "leher-depan", "leher-samping", "leher-tigaperempat", "leher-bawah", "leher-dialog"], default="depan",
                   help="depan juga menyimpan kamera ke wajah.json; sudut lain hanya pratinjau")
    p.add_argument("--aksi", default=None, help="nama animasi di GLB (misalnya lari); model dirender berpose")
    p.add_argument("--bingkai", type=int, default=1, help="bingkai animasi untuk --aksi")
    p.add_argument("--toleh", type=float, default=0.0, help="uji leher: putar tulang Head sekian derajat")
    p.add_argument("--garis-bahu", action="store_true",
                   help="garis vertikal bantu merah lewat sendi bahu (GLB berkerangka), untuk menilai tegaknya leher")
    p.add_argument("--tanpa-normal", action="store_true", help="uji: normal map dilepas (shading dari normal mesh saja)")
    p.add_argument("--matahari", default=None, help="uji: satu matahari 'azimut,elevasi' derajat (azimut dari depan, "
                   "positif ke kanan tokoh) dengan ambien lemah, meniru cahaya game")
    p.add_argument("--normal-warna", action="store_true",
                   help="uji: keluarkan normal dunia sebagai warna (n * 0,5 + 0,5), dengan atau tanpa normal map")
    return p.parse_args(argv)


def main():
    a = argumen()
    akar = os.getcwd()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    # GLB berkerangka membawa mesh bantu (bentuk tulang) dari pengimpor; modelnya mesh terbesar.
    o = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    for lain in bpy.data.objects:
        if lain.type == "MESH" and lain is not o:
            lain.hide_render = True
    co = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    z_min, z_max = co[:, 2].min(), co[:, 2].max()
    tinggi = z_max - z_min
    # Bingkai: dari puncak kepala (plus sedikit ruang) sampai leher, persegi.
    atas = z_max + tinggi * 0.02
    bawah = z_max - tinggi * a.bagian_kepala
    sisi = atas - bawah
    # Pusat x dari verteks di area kepala.
    kepala = co[co[:, 2] > bawah]
    x_pusat = float((kepala[:, 0].max() + kepala[:, 0].min()) / 2)
    pusat = Vector((x_pusat, 0.0, (atas + bawah) / 2))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = a.ukuran
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("Dunia")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    mat = o.data.materials[0]
    if a.tanpa_normal:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                for l in list(n.inputs["Normal"].links):
                    mat.node_tree.links.remove(l)
    if a.normal_warna:
        nt = mat.node_tree
        nmap = next((n for n in nt.nodes if n.type == "NORMAL_MAP"), None)
        if a.tanpa_normal or nmap is None:
            sumber = nt.nodes.new("ShaderNodeNewGeometry").outputs["Normal"]
        else:
            sumber = nmap.outputs["Normal"]
        skala = nt.nodes.new("ShaderNodeVectorMath")
        skala.operation = "MULTIPLY_ADD"
        skala.inputs[1].default_value = (0.5, 0.5, 0.5)
        skala.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(sumber, skala.inputs[0])
        emisi = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(skala.outputs["Vector"], emisi.inputs["Color"])
        nt.links.new(emisi.outputs["Emission"], next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL").inputs["Surface"])
        scene.view_settings.view_transform = "Raw"
    elif a.rata:
        # Emisi base color: tanpa bayangan dan tanpa normal map, warna tekstur apa adanya.
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        tex = bsdf.inputs["Base Color"].links[0].from_node
        keluaran = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        emisi = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
        nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])

    kd = bpy.data.cameras.new("KameraWajah")
    kd.type = "ORTHO"
    kd.ortho_scale = sisi
    kd.clip_start = 0.01
    kam = bpy.data.objects.new("KameraWajah", kd)
    scene.collection.objects.link(kam)
    scene.camera = kam
    jarak = tinggi * 2
    arah = {"depan": (0, -1, 0), "tigaperempat": (-0.7071, -0.7071, 0), "samping": (-1, 0, 0),
            "badan": (0, -1, 0), "badan-tigaperempat": (-0.7071, -0.7071, 0), "badan-samping": (1, 0, 0),
            "badan-belakang": (0, 1, 0), "tangan": (0, -1, 0), "kaki": (0, -1, 0),
            "leher-depan": (0, -1, 0), "leher-samping": (-1, 0, 0), "leher-tigaperempat": (-0.7071, -0.7071, 0),
            "leher-bawah": (-0.35, -0.72, -0.6), "leher-dialog": (-0.42, -0.9, 0.08)}[a.sudut]
    if a.sudut.startswith("badan"):
        pusat = Vector((0.0, 0.0, (z_min + z_max) / 2))
        kd.ortho_scale = tinggi * 1.15 * 1.5
        scene.render.resolution_y = int(a.ukuran * 1.5)
        jarak = tinggi * 4
    elif a.sudut == "tangan":
        # Tangan kanan model (sisi -X dilihat dari depan): bingkai 0,45 m di sekitar pergelangan dan jari.
        tangan = co[(co[:, 2] < tinggi * 0.58) & (co[:, 2] > tinggi * 0.38) & (co[:, 0] < -tinggi * 0.18)]
        pusat = Vector((float(tangan[:, 0].mean()), 0.0, float(tangan[:, 2].mean())))
        kd.ortho_scale = tinggi * 0.27
    elif a.sudut == "kaki":
        pusat = Vector((0.0, 0.0, z_min + tinggi * 0.1))
        kd.ortho_scale = tinggi * 0.35
    elif a.sudut.startswith("leher"):
        pusat = Vector((0.0, 0.0, z_max - tinggi * 0.17))
        kd.ortho_scale = tinggi * 0.2
    kam.location = pusat + Vector(arah) * jarak
    # Kamera mendatar: X 90 derajat membuat kamera memandang +Y; yaw dihitung dari arah pandang (dx, dy).
    dx, dy = -arah[0], -arah[1]
    kam.rotation_euler = (math.radians(90), 0.0, math.atan2(-dx, dy))
    if arah[2] != 0:
        # Kamera mendongak atau menunduk (sudut kamera dialog dari bawah dagu): bidik pusat langsung.
        kam.rotation_euler = (-Vector(arah)).to_track_quat("-Z", "Y").to_euler()
    kerangka = next((ob for ob in bpy.data.objects if ob.type == "ARMATURE"), None)
    if kerangka:
        # GLB beranimasi: tanpa --aksi model dirender pada pose diam (semua track NLA dilepas).
        if kerangka.animation_data is None:
            kerangka.animation_data_create()
        for tr in list(kerangka.animation_data.nla_tracks):
            kerangka.animation_data.nla_tracks.remove(tr)
        kerangka.animation_data.action = None
        for pb in kerangka.pose.bones:
            pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
        if a.aksi:
            aksi = bpy.data.actions[a.aksi]
            kerangka.animation_data.action = aksi
            try:
                kerangka.animation_data.action_slot = aksi.slots[0]
            except Exception:
                pass
            scene.frame_set(a.bingkai)
        kepala = next((pb for pb in kerangka.pose.bones if pb.name.endswith("Head")), None)
        if a.toleh and kepala:
            # Uji menoleh: tulang Head diputar pada sumbu panjangnya (kalau ada aksi, ditimpa di bingkai ini).
            kepala.rotation_mode = "XYZ"
            kepala.rotation_euler = (0.0, math.radians(a.toleh), 0.0)
        bpy.context.view_layer.update()
        if kepala and (a.aksi or a.toleh) and a.sudut.startswith("leher"):
            # Bingkai berpose: kamera leher mengikuti posisi tulang Head.
            pusat = kerangka.matrix_world @ kepala.head + Vector((0.0, 0.0, -0.02))
            kam.location = pusat + Vector(arah) * jarak

    if a.matahari:
        az, el = (math.radians(float(v)) for v in a.matahari.split(","))
        ke_matahari = Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
        l = bpy.data.objects.new("Matahari", bpy.data.lights.new("Matahari", "SUN"))
        l.data.energy = 3.0
        l.data.use_shadow = False
        l.rotation_euler = ke_matahari.to_track_quat("Z", "Y").to_euler()
        scene.collection.objects.link(l)
        scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
    elif a.netral:
        for nama, en, rot in (("Depan", 1.4, (80, 0, 0)), ("Kiri", 1.0, (70, 0, -60)), ("Kanan", 1.0, (70, 0, 60))):
            l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
            l.data.energy = en
            l.data.use_shadow = False
            l.rotation_euler = tuple(np.radians(v) for v in rot)
            scene.collection.objects.link(l)
        scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    elif not a.rata:
        for nama, en, rot in (("Kunci", 2.0, (70, 0, -20)), ("Isi", 1.2, (75, 0, 25))):
            l = bpy.data.objects.new(nama, bpy.data.lights.new(nama, "SUN"))
            l.data.energy = en
            l.data.angle = 0.5
            l.rotation_euler = tuple(np.radians(v) for v in rot)
            scene.collection.objects.link(l)

    if a.garis_bahu and kerangka:
        # Sisi yang menghadap kamera; garis ditaruh di antara kamera dan badan supaya tidak tertutup.
        sisi = "Left" if arah[0] >= 0 else "Right"
        bahu = next(pb for pb in kerangka.pose.bones if pb.name.endswith(sisi + "Arm"))
        pb_w = kerangka.matrix_world @ bahu.head
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pb_w.x + arah[0] * 0.35, pb_w.y + arah[1] * 0.35, (z_min + z_max) / 2 + 0.25))
        garis = bpy.context.active_object
        garis.scale = (0.003, 0.003, tinggi * 0.75)
        bahan = bpy.data.materials.new("GarisBahu")
        bahan.use_nodes = True
        nt_g = bahan.node_tree
        em = nt_g.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (1.0, 0.05, 0.05, 1.0)
        nt_g.links.new(em.outputs["Emission"], next(n for n in nt_g.nodes if n.type == "OUTPUT_MATERIAL").inputs["Surface"])
        garis.data.materials.append(bahan)

    keluar = os.path.join(akar, a.keluar)
    os.makedirs(os.path.dirname(keluar), exist_ok=True)
    scene.render.filepath = keluar
    bpy.ops.render.render(write_still=True)

    path_json = os.path.join(akar, a.json)
    data = json.load(open(path_json)) if os.path.exists(path_json) else {}
    if a.sudut != "depan":
        print(f"[wajah] render {keluar} ({a.sudut})", flush=True)
        return
    data["kamera"] = {
        "jenis": "ortografis",
        "ukuran_px": a.ukuran,
        "ortho_scale_m": sisi,
        "pusat_m": [pusat.x, pusat.y, pusat.z],
        "lokasi_m": list(kam.location),
        "arah": "dari -Y (depan model) ke +Y",
        "tinggi_model_m": float(tinggi),
        "keterangan": "piksel (u, v) dari kiri atas; x_m = pusat.x + (u/ukuran - 0.5) * ortho_scale; z_m = pusat.z - (v/ukuran - 0.5) * ortho_scale",
    }
    json.dump(data, open(path_json, "w"), indent=2, ensure_ascii=False)
    print(f"[wajah] render {keluar}; kamera ortho {sisi:.3f} m, pusat {tuple(round(v, 3) for v in pusat)}", flush=True)


main()
