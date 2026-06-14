import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { createScene } from './scene.js';
import { Pack } from './Pack.js';
import { Card } from './Card.js';
import { PACK_CARDS } from './cardData.js';
import {
  idlePackAnimation,
  packIntroAnimation,
  openPackAnimation,
  dealCardsAnimation,
  revealCardAnimation,
  returnCardAnimation,
  hoverCardAnimation,
} from './Animator.js';

// --- State ---
const STATE = {
  INTRO: 'intro',
  IDLE: 'idle',
  OPENING: 'opening',
  FANNING: 'fanning',
  IDLE_FAN: 'idle_fan',
  REVEALING: 'revealing',
  REVEALED: 'revealed',
};

let state = STATE.INTRO;
let pack = null;
let cards = [];
let selectedCard = null;
let idleAnim = null;
let hoveredCard = null;

// --- Setup ---
const canvas = document.getElementById('canvas');
const hint = document.getElementById('hint');
const flashEl = document.getElementById('flash');
const { renderer, scene, camera } = createScene(canvas);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// --- Camera shake ---
const cameraShake = { x: 0, y: 0 };

function triggerCameraShake() {
  gsap.to(cameraShake, { x: 0.32, duration: 0.04, ease: 'none', yoyo: true, repeat: 9 });
  gsap.to(cameraShake, { y: 0.22, duration: 0.05, ease: 'none', yoyo: true, repeat: 7 });
}

// --- Flash overlay ---
function triggerFlash() {
  flashEl.style.display = 'block';
  gsap.set(flashEl, { opacity: 0 });
  gsap.to(flashEl, {
    opacity: 1, duration: 0.07, ease: 'power2.out',
    onComplete: () => gsap.to(flashEl, {
      opacity: 0, duration: 0.35, ease: 'power2.in',
      onComplete: () => { flashEl.style.display = 'none'; },
    }),
  });
}

// --- Particle burst system ---
const PARTICLE_COUNT = 130;
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors = new Float32Array(PARTICLE_COUNT * 3);
const pVelocities = [];

const PALETTE = [
  [1.0, 0.85, 0.1],   // gold
  [0.75, 0.3, 1.0],   // purple
  [1.0, 0.5, 0.92],   // pink
  [0.2, 0.85, 1.0],   // cyan
  [1.0, 1.0, 1.0],    // white
  [1.0, 0.55, 0.1],   // orange
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPositions[i * 3] = 0;
  pPositions[i * 3 + 1] = 0;
  pPositions[i * 3 + 2] = 0;
  const c = PALETTE[i % PALETTE.length];
  pColors[i * 3] = c[0];
  pColors[i * 3 + 1] = c[1];
  pColors[i * 3 + 2] = c[2];
  const phi = (i / PARTICLE_COUNT) * Math.PI * 2 + (i * 0.37);
  const speed = 2.5 + (i % 7) * 0.9;
  pVelocities.push({
    x: Math.cos(phi) * speed,
    y: 1.5 + (i % 9) * 0.8,
    z: Math.sin(phi) * speed * 0.55,
  });
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

const particleMat = new THREE.PointsMaterial({
  size: 0.22,
  vertexColors: true,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});

const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);

let particleActive = false;
let particleElapsed = 0;
const PARTICLE_LIFETIME = 2.2;
const particleOrigin = new THREE.Vector3();

function burstParticles(origin) {
  particleOrigin.set(origin.x, origin.y, origin.z);
  const posAttr = particleGeo.attributes.position;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    posAttr.setXYZ(i, origin.x, origin.y, origin.z);
  }
  posAttr.needsUpdate = true;
  particleElapsed = 0;
  particleActive = true;
  particleMat.opacity = 1.0;
}

// --- Boot ---
async function boot() {
  pack = new Pack(scene);
  pack.group.position.set(0, 9, 0);
  pack.group.scale.set(0.15, 0.15, 0.15);

  await packIntroAnimation(pack.group);

  state = STATE.IDLE;
  idleAnim = idlePackAnimation(pack.group);
  setHint('Click the pack to open');
}

// --- Interaction ---
function setHint(text) {
  hint.textContent = text;
  hint.classList.remove('hidden');
}

function hideHint() {
  hint.classList.add('hidden');
}

function getIntersects(event, objects) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects);
}

async function handlePackClick() {
  if (state !== STATE.IDLE) return;
  state = STATE.OPENING;
  hideHint();

  if (idleAnim) { idleAnim.kill(); idleAnim = null; }

  let burstPos = { x: 0, y: 1.8, z: 0 };

  await openPackAnimation(pack.group, (pos) => {
    burstPos = { x: pos.x, y: pos.y, z: pos.z };
    triggerFlash();
    triggerCameraShake();
    burstParticles(pos);
  });

  pack.dispose();
  pack = null;

  state = STATE.FANNING;

  cards = PACK_CARDS.map((data, i) => new Card(scene, data, i));
  await dealCardsAnimation(cards, burstPos);

  state = STATE.IDLE_FAN;
  setHint('Click a card to reveal');
}

async function handleCardClick(card) {
  if (state !== STATE.IDLE_FAN && state !== STATE.REVEALED) return;

  if (card.isSelected) {
    state = STATE.REVEALING;
    card.isSelected = false;
    selectedCard = null;
    await returnCardAnimation(card, card.index);
    state = STATE.IDLE_FAN;
    const allRevealed = cards.every(c => c.isRevealed);
    setHint(allRevealed ? 'All cards revealed!' : 'Click a card to reveal');
    return;
  }

  if (selectedCard) {
    state = STATE.REVEALING;
    const prev = selectedCard;
    prev.isSelected = false;
    selectedCard = null;
    await returnCardAnimation(prev, prev.index);
  }

  state = STATE.REVEALING;
  card.isSelected = true;
  card.isRevealed = true;
  selectedCard = card;

  await revealCardAnimation(card, card.index);

  state = STATE.REVEALED;
  setHint('Click card again to return');
}

// --- Events ---
canvas.addEventListener('click', (e) => {
  if (state === STATE.IDLE && pack) {
    const hits = getIntersects(e, [pack.meshForRaycasting]);
    if (hits.length > 0) handlePackClick();
    return;
  }

  if (state === STATE.IDLE_FAN || state === STATE.REVEALED) {
    const meshes = cards.map(c => c.meshForRaycasting);
    const hits = getIntersects(e, meshes);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const card = cards.find(c => c.meshForRaycasting === hitMesh);
      if (card) handleCardClick(card);
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (state === STATE.IDLE && pack) {
    const hits = getIntersects(e, [pack.meshForRaycasting]);
    canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    return;
  }

  if (state !== STATE.IDLE_FAN) {
    if (hoveredCard) { hoverCardAnimation(hoveredCard, false); hoveredCard = null; }
    canvas.style.cursor = 'default';
    return;
  }

  const meshes = cards.map(c => c.meshForRaycasting);
  const hits = getIntersects(e, meshes);
  const newHovered = hits.length > 0
    ? cards.find(c => c.meshForRaycasting === hits[0].object) || null
    : null;

  if (newHovered !== hoveredCard) {
    if (hoveredCard && !hoveredCard.isSelected) hoverCardAnimation(hoveredCard, false);
    if (newHovered && !newHovered.isSelected) hoverCardAnimation(newHovered, true);
    hoveredCard = newHovered;
  }

  canvas.style.cursor = newHovered ? 'pointer' : 'default';
});

// --- Render loop ---
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.016;

  // Camera drift + shake
  camera.position.x = Math.sin(time * 0.15) * 0.3 + cameraShake.x;
  camera.position.y = 2 + Math.sin(time * 0.1) * 0.15 + cameraShake.y;
  camera.lookAt(0, 0, 0);

  // Pack shimmer + glow pulse
  if (pack) {
    if (pack.shinePlane) {
      pack.shinePlane.material.opacity = 0.12 + Math.sin(time * 2.5) * 0.1;
      pack.shinePlane.rotation.z = Math.sin(time * 0.5) * 0.02;
    }
    if (pack.glowLight) {
      pack.glowLight.intensity = 4 + Math.sin(time * 2.8) * 2.5;
    }
  }

  // Particle system update
  if (particleActive) {
    particleElapsed += 0.016;
    const t = particleElapsed / PARTICLE_LIFETIME;
    if (t >= 1) {
      particleActive = false;
      particleMat.opacity = 0;
    } else {
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = pVelocities[i];
        const te = particleElapsed;
        posAttr.setXYZ(
          i,
          particleOrigin.x + v.x * te,
          particleOrigin.y + v.y * te - 4.5 * te * te,
          particleOrigin.z + v.z * te,
        );
      }
      posAttr.needsUpdate = true;
      particleMat.opacity = t < 0.25 ? 1.0 : Math.max(0, 1 - (t - 0.25) / 0.75);
    }
  }

  renderer.render(scene, camera);
}

animate();
boot();
