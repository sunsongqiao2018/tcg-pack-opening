import * as THREE from 'three';
import { makePackTexture } from './textureFactory.js';

const CARD_W = 2.0;
const CARD_H = 2.8;
const PACK_DEPTH = 0.18;

export class Pack {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    const frontTex = makePackTexture();

    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x2d0a6e, roughness: 0.4, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x2d0a6e, roughness: 0.4, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x2d0a6e, roughness: 0.4, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x2d0a6e, roughness: 0.4, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.3, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.3, metalness: 0.2 }),
    ];

    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, PACK_DEPTH);
    this.mesh = new THREE.Mesh(geo, materials);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    const shineTex = makePackTexture();
    shineTex.offset.set(0.1, 0.1);
    const shineMat = new THREE.MeshStandardMaterial({
      map: shineTex,
      transparent: true,
      opacity: 0.15,
      roughness: 0.0,
      metalness: 1.0,
      side: THREE.FrontSide,
    });
    const shineGeo = new THREE.PlaneGeometry(CARD_W - 0.05, CARD_H - 0.05);
    this.shinePlane = new THREE.Mesh(shineGeo, shineMat);
    this.shinePlane.position.z = PACK_DEPTH / 2 + 0.01;
    this.group.add(this.shinePlane);

    this.glowLight = new THREE.PointLight(0xaa44ff, 4, 9);
    this.glowLight.position.set(0, 0, 1.2);
    this.group.add(this.glowLight);

    scene.add(this.group);
  }

  get meshForRaycasting() {
    return this.mesh;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
