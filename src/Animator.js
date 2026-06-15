import gsap from 'gsap';
import { playLegendaryBuildUp } from './sound.js';

// 1-column × 10-row layout — clear vertical stack, no overlap
const FAN_POSITIONS = [
  { x: 0, y:  6.75, z: 0, rotZ: 0 },
  { x: 0, y:  5.25, z: 0, rotZ: 0 },
  { x: 0, y:  3.75, z: 0, rotZ: 0 },
  { x: 0, y:  2.25, z: 0, rotZ: 0 },
  { x: 0, y:  0.75, z: 0, rotZ: 0 },
  { x: 0, y: -0.75, z: 0, rotZ: 0 },
  { x: 0, y: -2.25, z: 0, rotZ: 0 },
  { x: 0, y: -3.75, z: 0, rotZ: 0 },
  { x: 0, y: -5.25, z: 0, rotZ: 0 },
  { x: 0, y: -6.75, z: 0, rotZ: 0 },
];

const RARITY_OPTS = {
  common:    { scale: 1.55, pause: 0,   flipDuration: 0.15, approachDuration: 0.38 },
  uncommon:  { scale: 1.55, pause: 0,   flipDuration: 0.15, approachDuration: 0.38 },
  rare:      { scale: 1.75, pause: 0.3, flipDuration: 0.2,  approachDuration: 0.45 },
  legendary: { scale: 2.0,  pause: 0.9, flipDuration: 0.25, approachDuration: 0.6  },
};

export function idlePackAnimation(packGroup) {
  return gsap.to(packGroup.rotation, {
    y: Math.PI * 2, duration: 7, ease: 'none', repeat: -1,
  });
}

export function packIntroAnimation(packGroup) {
  return new Promise(resolve => {
    gsap.fromTo(packGroup.position, { y: 9, z: 0 }, { y: 0, z: 0, duration: 1.1, ease: 'back.out(1.4)', onComplete: resolve });
    gsap.fromTo(packGroup.rotation, { x: -0.4, y: 0, z: 0.3 }, { x: 0, y: 0, z: 0, duration: 1.1, ease: 'back.out(1.4)' });
    gsap.fromTo(packGroup.scale, { x: 0.15, y: 0.15, z: 0.15 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'back.out(1.7)' });
  });
}

export function openPackAnimation(packGroup, onExplode) {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    tl.to(packGroup.position, { y: 1.8, duration: 0.55, ease: 'power2.out' })
      .to(packGroup.rotation, { x: 0.08, y: Math.PI * 0.12, duration: 0.55, ease: 'power2.out' }, '<');

    tl.to(packGroup.rotation, { z: 0.14, duration: 0.05, ease: 'power1.inOut', yoyo: true, repeat: 13 });
    tl.to(packGroup.position, { x: '+=0.13', duration: 0.04, ease: 'power1.inOut', yoyo: true, repeat: 17 }, '<');

    tl.to(packGroup.scale, { x: 1.25, y: 1.25, z: 1.25, duration: 0.13, ease: 'power3.out' });
    tl.to(packGroup.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.09, ease: 'power2.in' });

    tl.call(() => onExplode && onExplode(packGroup.position.clone()));
    tl.to(packGroup.scale, { x: 4.0, y: 0.0, z: 4.0, duration: 0.22, ease: 'power4.in' });
    tl.to(packGroup.rotation, { z: 0.8, duration: 0.22 }, '<');
  });
}

export function dealCardsAnimation(cards, fromPos = { x: 0, y: 1.8, z: 0 }) {
  return new Promise(resolve => {
    const promises = cards.map((card, i) => new Promise(cardResolve => {
      const pos = FAN_POSITIONS[i];

      card.group.position.set(fromPos.x, fromPos.y, fromPos.z);
      card.group.rotation.set(0, Math.PI, 0);
      card.group.scale.set(0.05, 0.05, 0.05);

      const delay = i * 0.07;
      gsap.to(card.group.scale, { x: 0.48, y: 0.48, z: 0.48, duration: 0.4, delay, ease: 'back.out(2.5)' });

      const arcPeakY = fromPos.y + 3.5;
      const tl = gsap.timeline({ delay });
      tl.to(card.group.position, {
        x: fromPos.x + (pos.x - fromPos.x) * 0.3, y: arcPeakY, z: pos.z * 0.4,
        duration: 0.28, ease: 'power2.out',
      })
      .to(card.group.position, {
        x: pos.x, y: pos.y, z: pos.z,
        duration: 0.38, ease: 'power3.in', onComplete: cardResolve,
      });

      gsap.to(card.group.rotation, {
        y: Math.PI + Math.PI * 4, z: pos.rotZ,
        duration: 0.66, delay, ease: 'power2.inOut',
        onComplete: () => gsap.set(card.group.rotation, { y: Math.PI }),
      });
    }));
    Promise.all(promises).then(resolve);
  });
}

// options can override rarity defaults; onPreFlip fires before flip, onRevealed fires after
export function revealCardAnimation(card, options = {}) {
  const defaults = RARITY_OPTS[card.data.rarity] || RARITY_OPTS.common;
  const {
    scale           = defaults.scale,
    pause           = defaults.pause,
    flipDuration    = defaults.flipDuration,
    approachDuration = defaults.approachDuration,
    onPreFlip       = null,
    onRevealed      = null,
  } = options;

  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    // Approach: reset parallax tilt (x) and fan tilt (z), leave y alone for flip
    tl.to(card.group.position, { x: 0, y: 0.5, z: 3.8, duration: approachDuration, ease: 'power3.out' })
      .to(card.group.rotation, { x: 0, z: 0, duration: approachDuration * 0.84, ease: 'power3.out' }, '<')
      .to(card.group.scale, { x: scale, y: scale, z: scale, duration: approachDuration, ease: 'back.out(1.8)' }, '<');

    // Dramatic pause with build-up for legendary/rare
    if (pause > 0) {
      let stopBuildUp = null;
      if (card.data.rarity === 'legendary') {
        tl.call(() => { stopBuildUp = playLegendaryBuildUp(); });
      }
      tl.to({}, { duration: pause });
      tl.call(() => { if (stopBuildUp) stopBuildUp(); });
    }

    if (onPreFlip) tl.call(onPreFlip);

    // Punchy flip
    const punch = scale * 1.097;
    tl.to(card.group.rotation, { y: Math.PI * 0.5, duration: flipDuration, ease: 'power3.in' })
      .to(card.group.scale, { x: punch, y: punch, z: punch, duration: flipDuration * 0.47, ease: 'power2.out' }, `<${flipDuration * 0.67}`)
      .to(card.group.rotation, { y: 0, duration: flipDuration, ease: 'power3.out' })
      .to(card.group.scale, { x: scale, y: scale, z: scale, duration: flipDuration, ease: 'back.out(2.5)' }, '<');

    if (onRevealed) tl.call(onRevealed);

    if (card.glowPlane) {
      tl.to(card.glowPlane.material, { opacity: 0.65, duration: 0.45, ease: 'power2.out' }, '-=0.25');
    }
  });
}

export function returnCardAnimation(card, index) {
  return new Promise(resolve => {
    const pos = FAN_POSITIONS[index];
    const tl = gsap.timeline({ onComplete: resolve });

    if (card.glowPlane) tl.to(card.glowPlane.material, { opacity: 0, duration: 0.2 });
    if (card.foilUniforms) tl.to(card.foilUniforms.uOpacity, { value: 0, duration: 0.2 }, '<');

    tl.to(card.group.position, { x: pos.x, y: pos.y, z: pos.z, duration: 0.4, ease: 'power2.inOut' })
      .to(card.group.rotation, { x: 0, z: pos.rotZ, duration: 0.3, ease: 'power2.inOut' }, '<')
      .to(card.group.scale, { x: 0.48, y: 0.48, z: 0.48, duration: 0.3, ease: 'power2.inOut' }, '<');
  });
}

export function hoverCardAnimation(card, isHover) {
  gsap.to(card.group.position, {
    y: card.group.position.y + (isHover ? 0.4 : -0.4),
    duration: 0.2, ease: 'power2.out', overwrite: 'auto',
  });
}
