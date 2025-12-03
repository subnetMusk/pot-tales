import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Prende i dati dall'HTML sul modello da caricare
const script = document.querySelector('script[src$="main.js"]');
const modelName = script?.dataset.model || "TEST.glb";
const path = `../../assets/3Dobjs/${modelName}`;
let model;

// Cacate di three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //75mm FOV, simil tele
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;						// Merdascript sminchia le texture, quindi qui vanno risistemate
renderer.toneMapping = THREE.ACESFilmicToneMapping;					// Codice letteralmente copiato dall'editor
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xDCDCDC); 									//BG colore DIOCANEDIOCANEDIOCANE, anche detto gainsboro 
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);	//Rotazione con il mouse
controls.maxPolarAngle = Math.PI / 2;								//Non fa vedere la parte sotto

// Sarò onesto, non so cosa minchia faccia sto pezzo di codice
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// Matte nero
const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = 0;
overlay.style.left = 0;
overlay.style.width = '100vw';
overlay.style.height = '100vh';
overlay.style.backgroundColor = 'black';
overlay.style.opacity = '1';
overlay.style.zIndex = '9999';
overlay.style.transition = 'opacity 2s ease';
overlay.style.pointerEvents = 'none';
document.body.appendChild(overlay);

//Carica il modello
const loader = new GLTFLoader();
loader.load(path, (gltf) => {
  model = gltf.scene;

  //Mette l'oggetto a dimensione finale per impostare la telecamera
  model.scale.set(1, 1, 1);
  const box = new THREE.Box3().setFromObject(model);			//Bounding box
  const center = box.getCenter(new THREE.Vector3());			//Centro del bounding box
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);									//Sposta l'oggetto al centro
  camera.position.set(0, 0, size.length() * 1.5);				//Puntamento iniziale della telecamera

  // Di nuovo, non so che minchia faccia sto pezzo di codice
  model.traverse((child) => {
    if (child.isMesh && child.material && child.material.map) {
      child.material.map.encoding = THREE.sRGBEncoding;
      child.material.needsUpdate = true;
    }
  });

  scene.add(model);

  // Modello caricato, fade out del matte nero
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 2000);
  }, 100);
});

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();

//Controllo per il resize della pagina
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
