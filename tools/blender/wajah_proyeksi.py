"""
Proyeksi gambar konsep selaras ke ruang UV model (Tahap 2 perbaikan wajah, Blender).

  blender -b -P tools/blender/wajah_proyeksi.py -- --masuk public/models/wijaya.glb \
      --json tools/blender/wajah.json --konsep aset-mentah/tekstur/wajah-konsep-selaras.png \
      --keluar aset-mentah/tekstur --ukuran 2048

Keluaran di folder --keluar:
  wajah-proyeksi.png   warna konsep yang diproyeksikan dari kamera wajah.json, di UV asli (sRGB)
  wajah-data.png       data topeng, linear: R = normal . arah kamera (0..1), G = tinggi ternormalisasi
                       (0 di z_bawah, 1 di z_atas, lihat wajah.json "topeng"), B = 1 di permukaan (cakupan)
Mesh dan UV asli tidak diubah; UV kedua hanya hidup di sesi Blender ini.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--konsep", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--ukuran", type=int, default=2048)
    p.add_argument("--margin", type=int, default=8)
    p.add_argument("--halus-normal", type=int, default=0,
                   help="iterasi modifier Smooth pada salinan mesh sebelum bake data sudut; 0 = normal asli")
    return p.parse_args(argv)


def catat(*a):
    print("[proyeksi]", *a, flush=True)


def bake_emit(obj, mat, img, margin):
    nt = mat.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    scene = bpy.context.scene
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = True
    bpy.ops.object.bake(type="EMIT")
    nt.nodes.remove(node)


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    kam_json = data["kamera"]
    topeng = data.setdefault("topeng", {
        "sudut_penuh_derajat": 35,
        "sudut_nol_derajat": 65,
        "z_atas_m": 1.44,
        "z_bawah_m": 1.39,
        "keterangan": "bobot proyeksi penuh kalau sudut normal ke kamera < sudut_penuh, nol di atas sudut_nol; "
                      "dikali bobot tinggi: 1 di atas z_atas (leher atas), 0 di bawah z_bawah (tulang selangka)",
    })
    os.makedirs(os.path.join(akar, a.keluar), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    obj = [o for o in bpy.data.objects if o.type == "MESH"][0]
    mesh = obj.data
    nama_uv_asli = mesh.uv_layers.active.name
    mesh.uv_layers.active.active_render = True

    # Kamera persis seperti render Tahap 1.
    kd = bpy.data.cameras.new("KameraWajah")
    kd.type = "ORTHO"
    kd.ortho_scale = kam_json["ortho_scale_m"]
    kam = bpy.data.objects.new("KameraWajah", kd)
    bpy.context.scene.collection.objects.link(kam)
    kam.location = Vector(kam_json["lokasi_m"])
    pusat = Vector(kam_json["pusat_m"])
    kam.rotation_euler = (pusat - kam.location).to_track_quat("-Z", "Z").to_euler()
    bpy.context.scene.camera = kam
    bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = kam_json["ukuran_px"]

    # UV kedua dari proyeksi kamera.
    uv_proj = mesh.uv_layers.new(name="proyeksi")
    mod = obj.modifiers.new("Proyeksi", "UV_PROJECT")
    mod.uv_layer = "proyeksi"
    mod.projector_count = 1
    mod.projectors[0].object = kam
    mod.aspect_x = mod.aspect_y = 1.0
    mod.scale_x = mod.scale_y = 1.0
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Proyeksi")
    mesh.uv_layers.active_index = mesh.uv_layers.find(nama_uv_asli)
    mesh.uv_layers[nama_uv_asli].active_render = True

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"

    # Material bake: emisi dari gambar konsep lewat UV proyeksi.
    mat = bpy.data.materials.new("bake_wajah")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    uvnode = nt.nodes.new("ShaderNodeUVMap")
    uvnode.uv_map = "proyeksi"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(akar, a.konsep))
    tex.image.colorspace_settings.name = "sRGB"
    tex.extension = "CLIP"
    tex.interpolation = "Cubic"
    nt.links.new(uvnode.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], emisi.inputs["Color"])
    mesh.materials.clear()
    mesh.materials.append(mat)

    img_proj = bpy.data.images.new("wajah_proyeksi", a.ukuran, a.ukuran, alpha=False)
    img_proj.colorspace_settings.name = "sRGB"
    bake_emit(obj, mat, img_proj, a.margin)
    path_proj = os.path.join(akar, a.keluar, "wajah-proyeksi.png")
    img_proj.filepath_raw = path_proj
    img_proj.file_format = "PNG"
    img_proj.save()
    catat("proyeksi tersimpan", path_proj)

    # Sudut dihitung dari normal yang dihaluskan supaya lekukan kecil geometri wajah yang meleleh
    # tidak membuat bobot nol di tengah wajah. Hanya untuk bake data; UV tidak berubah.
    if a.halus_normal > 0:
        mod_halus = obj.modifiers.new("Halus", "SMOOTH")
        mod_halus.factor = 0.5
        mod_halus.iterations = a.halus_normal
        bpy.ops.object.modifier_apply(modifier="Halus")
        catat(f"normal dihaluskan: Smooth 0,5 x {a.halus_normal}")

    # Material data: R = normal . arah ke kamera, G = tinggi ternormalisasi, B = 1.
    nt.links.remove(emisi.inputs["Color"].links[0])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    arah = (kam.location - pusat).normalized()
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = tuple(arah)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    jepit = nt.nodes.new("ShaderNodeClamp")
    nt.links.new(dot.outputs["Value"], jepit.inputs["Value"])
    pisah = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], pisah.inputs["Vector"])
    z_norm = nt.nodes.new("ShaderNodeMapRange")
    z_norm.inputs["From Min"].default_value = topeng["z_bawah_m"]
    z_norm.inputs["From Max"].default_value = topeng["z_atas_m"]
    z_norm.clamp = True
    nt.links.new(pisah.outputs["Z"], z_norm.inputs["Value"])
    gabung = nt.nodes.new("ShaderNodeCombineColor")
    nt.links.new(jepit.outputs["Result"], gabung.inputs[0])
    nt.links.new(z_norm.outputs["Result"], gabung.inputs[1])
    gabung.inputs[2].default_value = 1.0
    nt.links.new(gabung.outputs["Color"], emisi.inputs["Color"])

    img_data = bpy.data.images.new("wajah_data", a.ukuran, a.ukuran, alpha=False, float_buffer=True)
    img_data.colorspace_settings.name = "Non-Color"
    bake_emit(obj, mat, img_data, 0)
    path_data = os.path.join(akar, a.keluar, "wajah-data.png")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.color_mode = "RGB"
    img_data.save_render(path_data, scene=scene)
    catat("data topeng tersimpan", path_data)

    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat("selesai; arah kamera", tuple(round(v, 3) for v in arah))


main()
