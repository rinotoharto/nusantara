import * as THREE from 'three';
import './style.css';

// Uji rantai alat: satu kotak berputar. Diganti dunia sungguhan pada Tahap B.
const kanvas = document.getElementById('kanvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 0, 0);

const kotak = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xb5452b }),
);
scene.add(kotak);

const matahari = new THREE.DirectionalLight(0xffe0b0, 2);
matahari.position.set(3, 5, 2);
scene.add(matahari);
scene.add(new THREE.AmbientLight(0x604030, 1));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const jam = new THREE.Timer();
renderer.setAnimationLoop(() => {
  jam.update();
  const dt = jam.getDelta();
  kotak.rotation.x += dt * 0.7;
  kotak.rotation.y += dt;
  renderer.render(scene, camera);
});
