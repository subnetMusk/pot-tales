import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //75mm FOV, simil tele

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xDCDCDC); 								//BG colore DIOCANEDIOCANEDIOCANE, anche detto gainsboro
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);	//Rotazione con il mouse
controls.maxPolarAngle = Math.PI / 2;

scene.add(new THREE.AmbientLight(0xffffff, 0.02));					//Illuminazione ambientale leggera
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);			//Luce direzionale per dare le ombre al modello
dirLight.position.set(5, 10, 7.5);									//Posizione molto arbitraria
scene.add(dirLight);

let model;		//

const loader = new GLTFLoader();
loader.load("../../assets/3Dobjs/obj1/DEFO.glb", (gltf) => {	//C
  model = gltf.scene;
  model.scale.set(0.1, 0.1, 0.1);			//Riscala il modello
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);			//Bounding box
  const center = box.getCenter(new THREE.Vector3());			//Centro del bounding box
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);									//Sposta l'oggetto al centro
  camera.position.set(0, 0, size.length() * 1.5);				//Puntamento iniziale della telecamera
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
