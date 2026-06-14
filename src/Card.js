import * as THREE from 'three';
import { makeCardFrontTexture, makeCardBackTexture } from './textureFactory.js';

const CARD_W = 2.0;
const CARD_H = 2.8;
const CARD_DEPTH = 0.008;

const _backTex = { value: null };
function getBackTex() {
  if (!_backTex.value) _backTex.value = makeCardBackTexture();
  return _backTex.value;
}

export class Card {
  constructor(scene, data, index) {
    this.scene = scene;
    this.data = data;
    this.index = index;
    this.isRevealed = false;
    this.isSelected = false;

    this.group = new THREE.Group();

    const frontTex = makeCardFrontTexture(data);
    const backTex = getBackTex();

    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_DEPTH);

    const isLegendary = data.rarity === 'legendary';

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: isLegendary ? 0.1 : 0.3,
      metalness: isLegendary ? 0.6 : 0.2,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.3,
      metalness: 0.1,
    });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x222244 });

    // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
    this.mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.group.add(this.mesh);

    if (isLegendary) {
      const glowMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(data.accentColor),
        emissive: new THREE.Color(data.accentColor),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.0,
        roughness: 0.0,
      });
      const glowGeo = new THREE.PlaneGeometry(CARD_W + 0.3, CARD_H + 0.3);
      this.glowPlane = new THREE.Mesh(glowGeo, glowMat);
      this.glowPlane.position.z = CARD_DEPTH / 2 + 0.005;
      this.group.add(this.glowPlane);
    }

    scene.add(this.group);
  }

  get meshForRaycasting() {
    return this.mesh;
  }

  showGlow(intensity = 0.4) {
    if (this.glowPlane) {
      this.glowPlane.material.opacity = intensity;
    }
  }

  hideGlow() {
    if (this.glowPlane) {
      this.glowPlane.material.opacity = 0;
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
