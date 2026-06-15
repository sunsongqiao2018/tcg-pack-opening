import gsap from 'gsap';
import { playLegendaryBuildUp } from './sound.js';

export const WHEEL_RADIUS = 3.0;

const RARITY_OPTS = {
  common:    { scale: 1.55, pause: 0,   flipDuration: 0.15, approachDuration: 0.38 },
  uncommon:  { scale: 1.55, pause: 0,   flipDuration: 0.15, approachDuration: 0.38 },
  rare:      { scale: 1.75, pause: 0.3, flipDuration: 0.2,  approachDuration: 0.45 },
  legendary: { scale: 2.0,  pause: 0.9, flipDuration: 0.25, approachDuration: 0.6  },
};

// Scale based on wheel position: front=0.68, back=0.42
function slotScale(theta) {
  return 0.42 + 0.13 * (1 + Math.cos(theta));
}

export function idlePackAnimation(packGroup) {
  return gsap.to(packGroup.position, {
    y: '+=0.2', duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: -1,
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

    // Swoop pack toward camera and slide down
    tl.to(packGroup.position, { y: -0.8, z: 4.5, duration: 0.38, ease: 'power3.inOut' });
    tl.to(packGroup.rotation, { x: 0.18, y: 0, z: 0, duration: 0.38, ease: 'power2.inOut' }, '<');
    tl.to(packGroup.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.38, ease: 'power2.out' }, '<');

    // Fire burst at the close position, then pack vanishes
    tl.call(() => onExplode && onExplode(packGroup.position.clone()));
    tl.to(packGroup.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.2, ease: 'power3.in' });
  });
}

export function dealCardsAnimation(cards, fromPos = { x: 0, y: 1.8, z: 0 }) {
  return new Promise(resolve => {
    const N = cards.length;
    const promises = cards.map((card, i) => new Promise(cardResolve => {
      const theta = (2 * Math.PI / N) * i;
      const ty = WHEEL_RADIUS * Math.sin(theta);
      const tz = WHEEL_RADIUS * Math.cos(theta);
      const s = slotScale(theta);

      card.group.position.set(fromPos.x, fromPos.y, fromPos.z);
      card.group.rotation.set(0, Math.PI, 0);
      card.group.scale.set(0.05, 0.05, 0.05);

      const delay = i * 0.09;

      // Punch overshoot then settle — feels like card bursting out of the pack
      gsap.to(card.group.scale, { x: s * 1.2, y: s * 1.2, z: s * 1.2, duration: 0.2, delay, ease: 'power3.out' });
      gsap.to(card.group.scale, { x: s, y: s, z: s, duration: 0.38, delay: delay + 0.2, ease: 'back.out(2)' });

      const tl = gsap.timeline({ delay });
      tl.to(card.group.position, {
        x: 0, y: fromPos.y + 3.5, z: tz * 0.4,
        duration: 0.28, ease: 'power2.out',
      })
      .to(card.group.position, {
        x: 0, y: ty, z: tz,
        duration: 0.38, ease: 'power3.in', onComplete: cardResolve,
      });

      gsap.to(card.group.rotation, {
        y: Math.PI * 4 + Math.PI,
        duration: 0.66, delay, ease: 'power2.inOut',
        onComplete: () => gsap.set(card.group.rotation, { x: 0, y: Math.PI }),
      });
    }));
    Promise.all(promises).then(resolve);
  });
}

export function revealCardAnimation(card, options = {}) {
  const defaults = RARITY_OPTS[card.data.rarity] || RARITY_OPTS.common;
  const {
    scale            = defaults.scale,
    pause            = defaults.pause,
    flipDuration     = defaults.flipDuration,
    approachDuration = defaults.approachDuration,
    onPreFlip        = null,
    onRevealed       = null,
    skipFlip         = false,
  } = options;

  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    const approachRot = skipFlip
      ? { x: 0, y: 0, z: 0, duration: approachDuration * 0.84, ease: 'power3.out' }
      : { x: 0, z: 0, duration: approachDuration * 0.84, ease: 'power3.out' };

    tl.to(card.group.position, { x: 0, y: 0.5, z: 3.8, duration: approachDuration, ease: 'power3.out' })
      .to(card.group.rotation, approachRot, '<')
      .to(card.group.scale, { x: scale, y: scale, z: scale, duration: approachDuration, ease: 'back.out(1.8)' }, '<');

    if (!skipFlip) {
      if (pause > 0) {
        let stopBuildUp = null;
        if (card.data.rarity === 'legendary') {
          tl.call(() => { stopBuildUp = playLegendaryBuildUp(); });
        }
        tl.to({}, { duration: pause });
        tl.call(() => { if (stopBuildUp) stopBuildUp(); });
      }

      if (onPreFlip) tl.call(onPreFlip);

      const punch = scale * 1.097;
      tl.to(card.group.rotation, { y: Math.PI * 0.5, duration: flipDuration, ease: 'power3.in' })
        .to(card.group.scale, { x: punch, y: punch, z: punch, duration: flipDuration * 0.47, ease: 'power2.out' }, `<${flipDuration * 0.67}`)
        .to(card.group.rotation, { y: 0, duration: flipDuration, ease: 'power3.out' })
        .to(card.group.scale, { x: scale, y: scale, z: scale, duration: flipDuration, ease: 'back.out(2.5)' }, '<');
    }

    if (onRevealed) tl.call(onRevealed);

    if (card.glowPlane) {
      tl.to(card.glowPlane.material, { opacity: 0.65, duration: 0.45, ease: 'power2.out' }, '-=0.25');
    }
  });
}

export function returnCardAnimation(card, index, total, wheelAngle) {
  const theta = (2 * Math.PI / total) * index + wheelAngle;
  const s = slotScale(theta);

  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    tl.to(card.group.position, {
      x: 0,
      y: WHEEL_RADIUS * Math.sin(theta),
      z: WHEEL_RADIUS * Math.cos(theta),
      duration: 0.4, ease: 'power2.inOut',
    })
    .to(card.group.rotation, { x: 0, y: 0, z: 0, duration: 0.3, ease: 'power2.inOut' }, '<')
    .to(card.group.scale, { x: s, y: s, z: s, duration: 0.3, ease: 'power2.inOut' }, '<');
  });
}
