import * as THREE from 'three';
import './style.css';
import { buatDunia } from './world';

const kanvas = document.getElementById('kanvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

const dunia = buatDunia(scene);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Sementara (Tahap B): kamera berputar pelan mengelilingi desa untuk melihat medan.
// Diganti pengendali pemain dan kamera orang ketiga pada Tahap C.
const jam = new THREE.Timer();
let sudut = 0;
renderer.setAnimationLoop(() => {
  jam.update();
  sudut += jam.getDelta() * 0.08;
  const jari = 110;
  camera.position.set(Math.sin(sudut) * jari, 45 + dunia.tinggiMedan(0, 0), Math.cos(sudut) * jari);
  camera.lookAt(0, 4, 0);
  renderer.render(scene, camera);
});
