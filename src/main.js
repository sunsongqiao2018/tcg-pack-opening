import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { createScene } from './scene.js';
import { Pack } from './Pack.js';
import { Card, FOIL_OPACITY } from './Card.js';
import { PACK_CARDS } from './cardData.js';
import {
  WHEEL_RADIUS,
  idlePackAnimation,
  packIntroAnimation,
  openPackAnimation,
  dealCardsAnimation,
  revealCardAnimation,
  returnCardAnimation,
} from './Animator.js';
import {
  resumeAudio,
  playTear,
  playCardSlide,
  playFlip,
  playReveal,
} from './sound.js';

// --- Art image preloader ---
function loadArtImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
const artPromises = PACK_CARDS.map(d => loadArtImage(d.artUrl));

// --- State ---
const STATE = {
  INTRO: 'intro', IDLE: 'idle', OPENING: 'opening',
  FANNING: 'fanning', IDLE_FAN: 'idle_fan', REVEALING: 'revealing', REVEALED: 'revealed',
};

let state = STATE.INTRO;
let pack = null;
let cards = [];
let selectedCard = null;
let idleAnim = null;

// --- DOM ---
const canvas = document.getElementById('canvas');
const hint = document.getElementById('hint');
const flashEl = document.getElementById('flash');
const overlayEl = document.getElementById('overlay');
let overlayVisible = false;

const { renderer, scene, camera } = createScene(canvas);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// --- Camera shake ---
const cameraShake = { x: 0, y: 0 };
function triggerCameraShake() {
  gsap.to(cameraShake, { x: 0.32, duration: 0.04, ease: 'none', yoyo: true, repeat: 9 });
  gsap.to(cameraShake, { y: 0.22, duration: 0.05, ease: 'none', yoyo: true, repeat: 7 });
}

// --- Flash ---
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

// --- Overlay (legendary reveal) ---
function showOverlay() {
  if (overlayVisible) return;
  overlayVisible = true;
  overlayEl.style.display = 'block';
  gsap.fromTo(overlayEl, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
}
function hideOverlay() {
  if (!overlayVisible) return;
  overlayVisible = false;
  gsap.to(overlayEl, {
    opacity: 0, duration: 0.3, ease: 'power2.in',
    onComplete: () => { overlayEl.style.display = 'none'; },
  });
}

// --- Particles ---
const PARTICLE_COUNT = 130;
const pPos = new Float32Array(PARTICLE_COUNT * 3);
const pCol = new Float32Array(PARTICLE_COUNT * 3);
const pVel = [];
const PALETTE = [
  [1.0, 0.85, 0.1], [0.75, 0.3, 1.0], [1.0, 0.5, 0.92],
  [0.2, 0.85, 1.0], [1.0, 1.0, 1.0],  [1.0, 0.55, 0.1],
];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i * 3] = pPos[i * 3 + 1] = pPos[i * 3 + 2] = 0;
  const c = PALETTE[i % PALETTE.length];
  pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2];
  const phi = (i / PARTICLE_COUNT) * Math.PI * 2 + i * 0.37;
  const speed = 2.5 + (i % 7) * 0.9;
  pVel.push({ x: Math.cos(phi) * speed, y: 1.5 + (i % 9) * 0.8, z: Math.sin(phi) * speed * 0.55 });
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particleMat = new THREE.PointsMaterial({
  size: 0.22, vertexColors: true, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
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
  for (let i = 0; i < PARTICLE_COUNT; i++) posAttr.setXYZ(i, origin.x, origin.y, origin.z);
  posAttr.needsUpdate = true;
  particleElapsed = 0;
  particleActive = true;
  particleMat.opacity = 1.0;
}

// --- Pack swipe state ---
let swipeStartX = null;
let isSwiping = false;

// --- Touch tracking for tap detection ---
let touchStartX = 0;
let touchStartY = 0;

// --- Wheel state ---
const wheelState = { angle: 0 };
let isDraggingWheel = false;
let wheelDragStartY = 0;
let wheelDragStartAngle = 0;
let wheelDragTotal = 0;
let frontCardIndex = 0;

function updateWheelPositions() {
  const N = cards.length;
  if (!N) return;

  // Find front card (effective theta closest to 0)
  let minDist = Infinity;
  let fi = 0;
  for (let i = 0; i < N; i++) {
    const theta = (2 * Math.PI / N) * i + wheelState.angle;
    const norm = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const dist = norm > Math.PI ? 2 * Math.PI - norm : norm;
    if (dist < minDist) { minDist = dist; fi = i; }
  }
  frontCardIndex = fi;

  for (let i = 0; i < N; i++) {
    const card = cards[i];
    if (card.isSelected) continue;
    const theta = (2 * Math.PI / N) * i + wheelState.angle;
    const cosT = Math.cos(theta);
    const s = 0.42 + 0.13 * (1 + cosT);
    const extraZ = i === fi ? 0.25 : 0;
    card.group.position.set(
      0,
      WHEEL_RADIUS * Math.sin(theta),
      WHEEL_RADIUS * Math.cos(theta) + extraZ,
    );
    card.group.rotation.x = 0;
    card.group.rotation.y = card.isRevealed ? 0 : Math.PI;
    card.group.scale.set(s, s, s);
  }
}

function snapWheel() {
  const N = cards.length;
  const step = 2 * Math.PI / N;
  const fi = frontCardIndex;
  const theta = step * fi + wheelState.angle;
  const norm = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const deviation = norm > Math.PI ? norm - 2 * Math.PI : norm;
  const targetAngle = wheelState.angle - deviation;

  gsap.to(wheelState, {
    angle: targetAngle,
    duration: 0.4,
    ease: 'power3.out',
    onUpdate: updateWheelPositions,
    overwrite: 'auto',
  });
}

// --- Boot ---
async function boot() {
  pack = new Pack(scene);
  pack.group.position.set(0, 9, 0);
  pack.group.scale.set(0.15, 0.15, 0.15);
  await packIntroAnimation(pack.group);
  state = STATE.IDLE;
  idleAnim = idlePackAnimation(pack.group);
  setHint('Drag across the pack to open');
}

// --- Hint ---
function setHint(text) { hint.textContent = text; hint.classList.remove('hidden'); }
function hideHint() { hint.classList.add('hidden'); }

function getIntersects(e, objects) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects);
}

// --- Pack open ---
async function handlePackOpen() {
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

  pack.dispose(); pack = null;
  state = STATE.FANNING;

  wheelState.angle = 0;
  frontCardIndex = 0;

  const artImages = await Promise.all(artPromises);
  cards = PACK_CARDS.map((data, i) => new Card(scene, data, i, artImages[i]));
  cards.forEach((_, i) => setTimeout(() => playCardSlide(), i * 70));
  await dealCardsAnimation(cards, burstPos);

  // Sync wheel positions (adds front card extraZ offset)
  updateWheelPositions();

  cards.forEach((card, i) => card.showRarityLight(i * 0.07));

  state = STATE.IDLE_FAN;
  setHint('Drag to spin • Click center card to reveal');
}

// --- Card reveal ---
async function handleCardClick(card) {
  if (state !== STATE.IDLE_FAN && state !== STATE.REVEALED) return;

  // Return the already-selected card
  if (card.isSelected) {
    state = STATE.REVEALING;
    card.isSelected = false;
    selectedCard = null;
    if (card.data.rarity === 'legendary') hideOverlay();
    await returnCardAnimation(card, card.index, cards.length, wheelState.angle);
    card.restoreRarityLight();
    updateWheelPositions();
    state = STATE.IDLE_FAN;
    setHint(cards.every(c => c.isRevealed) ? 'All cards revealed! Drag to spin' : 'Drag to spin • Click center card to reveal');
    return;
  }

  // Return any previously selected card first
  if (selectedCard) {
    state = STATE.REVEALING;
    const prev = selectedCard;
    prev.isSelected = false;
    selectedCard = null;
    if (prev.data.rarity === 'legendary') hideOverlay();
    await returnCardAnimation(prev, prev.index, cards.length, wheelState.angle);
    prev.restoreRarityLight();
    updateWheelPositions();
  }

  const wasAlreadyRevealed = card.isRevealed;

  state = STATE.REVEALING;
  card.isSelected = true;
  card.isRevealed = true;
  selectedCard = card;
  card.hideRarityLight();

  const isLegendary = card.data.rarity === 'legendary';

  await revealCardAnimation(card, {
    skipFlip: wasAlreadyRevealed,
    onPreFlip: wasAlreadyRevealed ? null : () => playFlip(card.data.rarity),
    onRevealed: () => {
      if (!wasAlreadyRevealed) {
        playReveal(card.data.rarity);
        if (isLegendary) {
          showOverlay();
          burstParticles(new THREE.Vector3(0, 0.5, 3.8));
          triggerFlash();
        }
      } else if (isLegendary) {
        showOverlay();
      }
      card.showFoil();
    },
  });

  state = STATE.REVEALED;
  setHint('Click card to return it to the wheel');
}

// --- Events ---

canvas.addEventListener('mousedown', (e) => {
  resumeAudio();

  if (state === STATE.IDLE_FAN) {
    wheelDragStartY = e.clientY;
    wheelDragStartAngle = wheelState.angle;
    wheelDragTotal = 0;
    isDraggingWheel = true;
    return;
  }

  if (state !== STATE.IDLE || !pack) return;
  const hits = getIntersects(e, [pack.meshForRaycasting]);
  if (hits.length > 0) {
    swipeStartX = e.clientX;
    isSwiping = true;
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (isDraggingWheel) {
    isDraggingWheel = false;
    if (wheelDragTotal > 8) snapWheel();
    canvas.style.cursor = 'grab';
    return;
  }

  if (!isSwiping) return;
  const dx = e.clientX - (swipeStartX ?? e.clientX);
  isSwiping = false;
  swipeStartX = null;
  if (Math.abs(dx) >= 90 && state === STATE.IDLE && pack) {
    playTear();
    handlePackOpen();
  } else if (pack && state === STATE.IDLE) {
    gsap.to(pack.group.rotation, { z: 0, x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.5)', overwrite: 'auto' });
    gsap.to(pack.group.scale, { y: 1.0, x: 1.0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  }
});

canvas.addEventListener('mouseleave', () => {
  if (isDraggingWheel) {
    isDraggingWheel = false;
    snapWheel();
    canvas.style.cursor = 'default';
    return;
  }
  if (isSwiping && pack && state === STATE.IDLE) {
    isSwiping = false;
    swipeStartX = null;
    gsap.to(pack.group.rotation, { z: 0, x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.5)', overwrite: 'auto' });
    gsap.to(pack.group.scale, { y: 1.0, x: 1.0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  }
});

canvas.addEventListener('mousemove', (e) => {
  // Wheel drag
  if (isDraggingWheel) {
    const dy = e.clientY - wheelDragStartY;
    wheelDragTotal = Math.abs(dy);
    wheelState.angle = wheelDragStartAngle + dy * 0.005;
    updateWheelPositions();
    canvas.style.cursor = 'grabbing';
    return;
  }

  // Pack swipe drag feedback
  if (isSwiping && state === STATE.IDLE && pack) {
    const dx = e.clientX - swipeStartX;
    pack.group.rotation.z = -dx * 0.003;
    pack.group.rotation.x = 0.06;
    const t = Math.min(Math.abs(dx) / 90, 1);
    pack.group.scale.y = 1 - t * 0.12;
    pack.group.scale.x = 1 + t * 0.04;
    canvas.style.cursor = 'grabbing';
    return;
  }

  // Pack hover cursor
  if (state === STATE.IDLE && pack && !isSwiping) {
    const hits = getIntersects(e, [pack.meshForRaycasting]);
    canvas.style.cursor = hits.length > 0 ? 'grab' : 'default';
    return;
  }

  // Mouse parallax on revealed card
  if (state === STATE.REVEALED && selectedCard) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    selectedCard.group.rotation.y = nx * 0.2;
    selectedCard.group.rotation.x = -ny * 0.2;
    if (selectedCard.foilUniforms) {
      const base = FOIL_OPACITY[selectedCard.data.rarity] || FOIL_OPACITY.common;
      const dist = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
      selectedCard.foilUniforms.uOpacity.value = base + dist * 0.18;
    }
  }

  // Wheel cursor: pointer only on front card
  if (state === STATE.IDLE_FAN) {
    const fc = cards[frontCardIndex];
    const hits = fc ? getIntersects(e, [fc.meshForRaycasting]) : [];
    canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    return;
  }

  canvas.style.cursor = 'default';
});

canvas.addEventListener('click', (e) => {
  // Wheel: reveal front card on click (only if it wasn't a drag)
  if (state === STATE.IDLE_FAN) {
    if (wheelDragTotal > 8) { wheelDragTotal = 0; return; }
    const fc = cards[frontCardIndex];
    if (!fc) return;
    const hits = getIntersects(e, [fc.meshForRaycasting]);
    if (hits.length > 0) handleCardClick(fc);
    return;
  }

  // Return revealed card on click
  if (state === STATE.REVEALED) {
    const meshes = cards.map(c => c.meshForRaycasting);
    const hits = getIntersects(e, meshes);
    if (hits.length > 0) {
      const card = cards.find(c => c.meshForRaycasting === hits[0].object);
      if (card) handleCardClick(card);
    }
  }
});

// --- Touch events (mobile support) ---

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  resumeAudio();

  if (state === STATE.IDLE_FAN) {
    wheelDragStartY = touch.clientY;
    wheelDragStartAngle = wheelState.angle;
    wheelDragTotal = 0;
    isDraggingWheel = true;
    return;
  }

  if (state !== STATE.IDLE || !pack) return;
  const hits = getIntersects(touch, [pack.meshForRaycasting]);
  if (hits.length > 0) {
    swipeStartX = touch.clientX;
    isSwiping = true;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];

  if (isDraggingWheel) {
    const dy = touch.clientY - wheelDragStartY;
    wheelDragTotal = Math.abs(dy);
    wheelState.angle = wheelDragStartAngle + dy * 0.005;
    updateWheelPositions();
    return;
  }

  if (isSwiping && state === STATE.IDLE && pack) {
    const dx = touch.clientX - swipeStartX;
    pack.group.rotation.z = -dx * 0.003;
    pack.group.rotation.x = 0.06;
    const t = Math.min(Math.abs(dx) / 90, 1);
    pack.group.scale.y = 1 - t * 0.12;
    pack.group.scale.x = 1 + t * 0.04;
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const movedX = touch.clientX - touchStartX;
  const movedY = touch.clientY - touchStartY;
  const moved = Math.sqrt(movedX * movedX + movedY * movedY);

  if (isDraggingWheel) {
    isDraggingWheel = false;
    if (wheelDragTotal > 8) {
      snapWheel();
      return;
    }
    // wheelDragTotal <= 8 means it was a tap — fall through to tap handling
  }

  if (isSwiping) {
    const dx = touch.clientX - (swipeStartX ?? touch.clientX);
    isSwiping = false;
    swipeStartX = null;
    if (Math.abs(dx) >= 90 && state === STATE.IDLE && pack) {
      playTear();
      handlePackOpen();
    } else if (pack && state === STATE.IDLE) {
      gsap.to(pack.group.rotation, { z: 0, x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.5)', overwrite: 'auto' });
      gsap.to(pack.group.scale, { y: 1.0, x: 1.0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    }
    return;
  }

  // Tap (minimal movement) — acts like a click
  if (moved < 10) {
    if (state === STATE.IDLE_FAN) {
      if (wheelDragTotal > 8) { wheelDragTotal = 0; return; }
      const fc = cards[frontCardIndex];
      if (!fc) return;
      const hits = getIntersects(touch, [fc.meshForRaycasting]);
      if (hits.length > 0) handleCardClick(fc);
      return;
    }
    if (state === STATE.REVEALED) {
      const meshes = cards.map(c => c.meshForRaycasting);
      const hits = getIntersects(touch, meshes);
      if (hits.length > 0) {
        const card = cards.find(c => c.meshForRaycasting === hits[0].object);
        if (card) handleCardClick(card);
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  if (isDraggingWheel) {
    isDraggingWheel = false;
    snapWheel();
    return;
  }
  if (isSwiping && pack && state === STATE.IDLE) {
    isSwiping = false;
    swipeStartX = null;
    gsap.to(pack.group.rotation, { z: 0, x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.5)', overwrite: 'auto' });
    gsap.to(pack.group.scale, { y: 1.0, x: 1.0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  }
});

// --- Render loop ---
let time = 0;
let smoothCamX = 0, smoothCamY = 1.5;

function animate() {
  requestAnimationFrame(animate);
  time += 0.016;

  const inWheelView = state === STATE.IDLE_FAN || state === STATE.REVEALING || state === STATE.REVEALED;
  smoothCamX += ((inWheelView ? 4.0 : 0) - smoothCamX) * 0.05;
  smoothCamY += ((inWheelView ? 2.5 : 1.5) - smoothCamY) * 0.05;

  camera.position.x = smoothCamX + Math.sin(time * 0.15) * 0.3 + cameraShake.x;
  camera.position.y = smoothCamY + Math.sin(time * 0.1) * 0.15 + cameraShake.y;
  camera.lookAt(0, 0, 0);

  if (pack) {
    if (pack.shinePlane) {
      pack.shinePlane.material.opacity = 0.12 + Math.sin(time * 2.5) * 0.1;
      pack.shinePlane.rotation.z = Math.sin(time * 0.5) * 0.02;
    }
    if (pack.glowLight) pack.glowLight.intensity = 4 + Math.sin(time * 2.8) * 2.5;
  }

  for (const card of cards) {
    if (card.foilUniforms) card.foilUniforms.uTime.value = time;
  }

  if (particleActive) {
    particleElapsed += 0.016;
    const t = particleElapsed / PARTICLE_LIFETIME;
    if (t >= 1) {
      particleActive = false; particleMat.opacity = 0;
    } else {
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = pVel[i], te = particleElapsed;
        posAttr.setXYZ(i,
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
