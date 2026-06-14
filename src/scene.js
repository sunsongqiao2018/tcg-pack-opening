import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d22);
  scene.fog = new THREE.FogExp2(0x090d22, 0.015);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x2244bb, 3.5);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 5.5);
  keyLight.position.set(5, 10, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4488ff, 2.5);
  fillLight.position.set(-5, 2, -4);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xaa44ff, 8, 22);
  rimLight.position.set(0, 5, -4);
  scene.add(rimLight);

  const rimLight2 = new THREE.PointLight(0x0066ff, 4, 20);
  rimLight2.position.set(-5, 6, 6);
  scene.add(rimLight2);

  const underLight = new THREE.PointLight(0x8800ff, 5, 16);
  underLight.position.set(0, -3, 2);
  scene.add(underLight);

  const tableGeo = new THREE.PlaneGeometry(30, 30);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x141428,
    roughness: 0.75,
    metalness: 0.15,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -2.0;
  table.receiveShadow = true;
  scene.add(table);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera };
}
