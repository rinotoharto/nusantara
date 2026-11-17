"""
Bake data per texel ke UV model (Blender), untuk skrip tekstur di venv (abu_isi.py dan sejenisnya).

  blender -b -P tools/blender/data_uv.py -- --masuk aset-mentah/prajurit-badan.glb \
      --keluar aset-mentah/tekstur/prajurit-data.png --json tools/blender/wajah.json --blok prajurit \
      [--basecolor-keluar aset-mentah/tekstur/prajurit-basecolor-sebelum.jpg]

Keluaran PNG 16 bit: R = |x| dipetakan ke data_x (m), G = tinggi z dipetakan ke data_z (m),
B = cakupan pulau UV (1 di dalam pulau, 0 di luar; tanpa margin). Rentang data_x dan data_z disimpan
di blok json supaya skrip lain bisa mengembalikannya ke meter. Susunan kanal sama dengan wajah-data.png
(G tinggi, B cakupan), jadi abu_isi.py bisa memakainya langsung.
"""
import argparse
import json
import os
import sys

import bpy
import numpy as np


def argumen():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--masuk", required=True)
    p.add_argument("--keluar", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--blok", required=True, help="blok di json tempat data_x dan data_z disimpan")
    p.add_argument("--ukuran", type=int, default=2048)
    p.add_argument("--basecolor-keluar", default=None, help="simpan base color GLB ke berkas ini (JPEG atau PNG)")
    return p.parse_args(argv)


def catat(*a):
    print("[data]", *a, flush=True)


def main():
    a = argumen()
    akar = os.getcwd()
    data = json.load(open(os.path.join(akar, a.json)))
    blok = data.setdefault(a.blok, {})
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(akar, a.masuk))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    obj = max(meshes, key=lambda o: len(o.data.polygons))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    data_z = blok.setdefault("data_z", [0.0, round(float(co[:, 2].max()) + 0.02, 2)])
    data_x = blok.setdefault("data_x", [0.0, round(float(np.abs(co[:, 0]).max()) + 0.02, 2)])

    scene = bpy.context.scene
    if a.basecolor_keluar:
        mat0 = obj.data.materials[0]
        bsdf = next(n for n in mat0.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        img = bsdf.inputs["Base Color"].links[0].from_node.image
        path = os.path.join(akar, a.basecolor_keluar)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fmt = "PNG" if path.lower().endswith(".png") else "JPEG"
        scene.render.image_settings.file_format = fmt
        scene.render.image_settings.color_mode = "RGB"
        scene.render.image_settings.quality = 92
        img.file_format = fmt
        img.filepath_raw = path
        img.save()
        catat(f"base color {img.size[0]}x{img.size[1]} disimpan ke {a.basecolor_keluar}")

    mat = bpy.data.materials.new("bake_data")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    keluaran = nt.nodes.new("ShaderNodeOutputMaterial")
    emisi = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emisi.outputs["Emission"], keluaran.inputs["Surface"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    pisah = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], pisah.inputs["Vector"])
    mutlak = nt.nodes.new("ShaderNodeMath")
    mutlak.operation = "ABSOLUTE"
    nt.links.new(pisah.outputs["X"], mutlak.inputs[0])
    gabung = nt.nodes.new("ShaderNodeCombineColor")
    for sumber, rentang, kanal in ((mutlak.outputs["Value"], data_x, 0), (pisah.outputs["Z"], data_z, 1)):
        peta = nt.nodes.new("ShaderNodeMapRange")
        peta.inputs["From Min"].default_value, peta.inputs["From Max"].default_value = rentang
        peta.clamp = True
        nt.links.new(sumber, peta.inputs["Value"])
        nt.links.new(peta.outputs["Result"], gabung.inputs[kanal])
    gabung.inputs[2].default_value = 1.0
    nt.links.new(gabung.outputs["Color"], emisi.inputs["Color"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    img_data = bpy.data.images.new("data_uv", a.ukuran, a.ukuran, alpha=False, float_buffer=True)
    img_data.colorspace_settings.name = "Non-Color"
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img_data
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    scene.render.bake.margin = 0
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = True
    bpy.ops.object.bake(type="EMIT")

    path = os.path.join(akar, a.keluar)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.color_mode = "RGB"
    img_data.save_render(path, scene=scene)
    json.dump(data, open(os.path.join(akar, a.json), "w"), indent=2, ensure_ascii=False)
    catat(f"{a.keluar}: {a.ukuran}px, data_x {data_x} m, data_z {data_z} m")


main()
