import * as THREE from 'three';
import gsap from 'gsap';
import { makeCardFrontTexture, makeCardBackTexture } from './textureFactory.js';

const CARD_W = 2.0;
const CARD_H = 2.8;
const CARD_DEPTH = 0.008;

const RARITY_LIGHT = {
  legendary: { color: 0xaa44ff, intensity: 7, distance: 7 },
  rare:      { color: 0x44aaff, intensity: 3.5, distance: 5 },
  uncommon:  { color: 0x44ff88, intensity: 2,   distance: 4 },
  common:    { color: 0x4477ff, intensity: 1,   distance: 3 },
};

// Base opacity for foil per rarity (tweened to after reveal)
export const FOIL_OPACITY = {
  legendary: 0.14,
  rare: 0.18,
  uncommon: 0.10,
  common: 0.07,
};

const _backTex = { value: null };
function getBackTex() {
  if (!_backTex.value) _backTex.value = makeCardBackTexture();
  return _backTex.value;
}

const FOIL_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

const FOIL_FRAG = /* glsl */`
uniform float uTime;
uniform float uOpacity;
uniform float uIsLegendary;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

vec3 hue2rgb(float h) {
  h = fract(h);
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float ndotv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
  float fresnel = 1.0 - ndotv;

  // Art-area mask: UV y 0.48–0.90 = art box in card texture.
  // Non-legendary (Pokemon holo rare): foil only in art area → text stays crisp.
  // Legendary (Pokemon full-art / secret rare): foil covers entire card.
  float artMask = smoothstep(0.46, 0.50, vUv.y) * smoothstep(0.92, 0.88, vUv.y);
  float mask = mix(artMask, 1.0, uIsLegendary);

  // Fine diagonal rainbow bands (Pokemon TCG prismatic foil)
  float diag = vUv.x * 0.7 + vUv.y * 0.9;
  float stripe1 = sin(diag * 14.0 + uTime * 1.8) * 0.5 + 0.5;
  float stripe2 = sin(diag * 5.0 - uTime * 1.0 + vUv.x * 2.5) * 0.5 + 0.5;

  // Hue from UV position + time + tilt
  float hue = diag * 0.45 + uTime * 0.035 + fresnel * 0.65;
  vec3 rainbow = hue2rgb(hue);

  // Star sparkles (Pokemon TCG style — small bright twinkling points)
  vec2 grid = vUv * 20.0;
  vec2 cell = floor(grid);
  vec2 cellUv = fract(grid) - 0.5;
  float h = hash21(cell);
  float pulse = max(0.0, cos(uTime * (0.6 + h * 1.5) + h * 6.28));
  float sparkle = step(0.75, h) * pulse * max(0.0, 1.0 - length(cellUv) * 8.0);

  // Color: rainbow bands + bright sparkle flashes + edge glimmer on tilt
  vec3 col = rainbow * (0.5 + stripe1 * 0.3 + stripe2 * 0.08);
  col += vec3(sparkle * 2.0);
  col += vec3(pow(fresnel, 2.5) * 0.35);

  // Alpha: subtle at rest, boosted by sparkle and tilt; masked to art zone
  float alpha = uOpacity * (0.55 + stripe1 * 0.28 + fresnel * 0.45);
  alpha += sparkle * uOpacity * 1.2;
  alpha *= mask;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.80));
}
`;

export class Card {
  constructor(scene, data, index, artImage = null) {
    this.scene = scene;
    this.data = data;
    this.index = index;
    this.isRevealed = false;
    this.isSelected = false;

    this.group = new THREE.Group();

    const frontTex = makeCardFrontTexture(data, artImage);
    const backTex = getBackTex();
    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_DEPTH);

    const isLegendary = data.rarity === 'legendary';

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: isLegendary ? 0.1 : 0.3,
      metalness: isLegendary ? 0.6 : 0.2,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex, roughness: 0.3, metalness: 0.1,
    });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x222244 });

    this.mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Legendary inner glow plane
    if (isLegendary) {
      const glowMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(data.accentColor),
        emissive: new THREE.Color(data.accentColor),
        emissiveIntensity: 0.6,
        transparent: true, opacity: 0.0, roughness: 0.0,
      });
      const glowGeo = new THREE.PlaneGeometry(CARD_W + 0.3, CARD_H + 0.3);
      this.glowPlane = new THREE.Mesh(glowGeo, glowMat);
      this.glowPlane.position.z = CARD_DEPTH / 2 + 0.005;
      this.group.add(this.glowPlane);
    }

    // Rarity edge glow light — behind back face
    const lightCfg = RARITY_LIGHT[data.rarity] || RARITY_LIGHT.common;
    this.rarityLight = new THREE.PointLight(lightCfg.color, 0, lightCfg.distance);
    this.rarityLight.position.set(0, 0, -(CARD_DEPTH / 2 + 0.3));
    this._rarityLightMax = lightCfg.intensity;
    this.group.add(this.rarityLight);

    // Holographic foil plane with GLSL iridescent shader
    this.foilUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uIsLegendary: { value: isLegendary ? 1.0 : 0.0 },
    };
    const foilMat = new THREE.ShaderMaterial({
      uniforms: this.foilUniforms,
      vertexShader: FOIL_VERT,
      fragmentShader: FOIL_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.foilPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W - 0.05, CARD_H - 0.05),
      foilMat,
    );
    this.foilPlane.position.z = CARD_DEPTH / 2 + 0.008;
    this.group.add(this.foilPlane);

    scene.add(this.group);
  }

  get meshForRaycasting() { return this.mesh; }

  showRarityLight(delay = 0) {
    gsap.to(this.rarityLight, {
      intensity: this._rarityLightMax,
      duration: 0.6, delay, ease: 'power2.out',
    });
  }

  hideRarityLight() {
    gsap.to(this.rarityLight, { intensity: 0, duration: 0.25, ease: 'power2.in' });
  }

  restoreRarityLight() {
    gsap.to(this.rarityLight, {
      intensity: this._rarityLightMax,
      duration: 0.5, ease: 'power2.out',
    });
  }

  showFoil() {
    const targetOpacity = FOIL_OPACITY[this.data.rarity] || FOIL_OPACITY.common;
    gsap.to(this.foilUniforms.uOpacity, { value: targetOpacity, duration: 0.5, ease: 'power2.out' });
  }

  hideFoil() {
    gsap.to(this.foilUniforms.uOpacity, { value: 0, duration: 0.25, ease: 'power2.in' });
  }

  showGlow(intensity = 0.4) {
    if (this.glowPlane) this.glowPlane.material.opacity = intensity;
  }

  hideGlow() {
    if (this.glowPlane) this.glowPlane.material.opacity = 0;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
