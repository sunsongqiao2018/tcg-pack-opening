import gsap from 'gsap';

const FAN_POSITIONS = [
  { x: -4.0, y: -0.5, z: 0.5, rotZ: 0.12 },
  { x: -2.0, y: 0.0,  z: 0.8, rotZ: 0.05 },
  { x:  0.0, y: 0.2,  z: 1.0, rotZ: 0.0  },
  { x:  2.0, y: 0.0,  z: 0.8, rotZ: -0.05 },
  { x:  4.0, y: -0.5, z: 0.5, rotZ: -0.12 },
];

export function idlePackAnimation(packGroup) {
  return gsap.to(packGroup.rotation, {
    y: Math.PI * 2,
    duration: 7,
    ease: 'none',
    repeat: -1,
  });
}

export function packIntroAnimation(packGroup) {
  return new Promise(resolve => {
    gsap.fromTo(packGroup.position,
      { y: 9, z: 0 },
      { y: 0, z: 0, duration: 1.1, ease: 'back.out(1.4)', onComplete: resolve }
    );
    gsap.fromTo(packGroup.rotation,
      { x: -0.4, y: 0, z: 0.3 },
      { x: 0, y: 0, z: 0, duration: 1.1, ease: 'back.out(1.4)' }
    );
    gsap.fromTo(packGroup.scale,
      { x: 0.15, y: 0.15, z: 0.15 },
      { x: 1, y: 1, z: 1, duration: 1.1, ease: 'back.out(1.7)' }
    );
  });
}

// onExplode(position) is called at the exact moment of the explosion burst
export function openPackAnimation(packGroup, onExplode) {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    // Phase 1: Levitate with a slight mystical tilt
    tl.to(packGroup.position, { y: 1.8, duration: 0.55, ease: 'power2.out' })
      .to(packGroup.rotation, { x: 0.08, y: Math.PI * 0.12, duration: 0.55, ease: 'power2.out' }, '<');

    // Phase 2: Energy buildup — intense side-to-side shake
    tl.to(packGroup.rotation, {
      z: 0.14, duration: 0.05, ease: 'power1.inOut', yoyo: true, repeat: 13,
    });
    tl.to(packGroup.position, {
      x: '+=0.13', duration: 0.04, ease: 'power1.inOut', yoyo: true, repeat: 17,
    }, '<');

    // Phase 3: Power charge pulse
    tl.to(packGroup.scale, { x: 1.25, y: 1.25, z: 1.25, duration: 0.13, ease: 'power3.out' });
    tl.to(packGroup.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.09, ease: 'power2.in' });

    // Fire the explosion callback before the burst
    tl.call(() => onExplode && onExplode(packGroup.position.clone()));

    // Phase 4: BURST — squish flat and expand outward
    tl.to(packGroup.scale, { x: 4.0, y: 0.0, z: 4.0, duration: 0.22, ease: 'power4.in' });
    tl.to(packGroup.rotation, { z: 0.8, duration: 0.22 }, '<');
  });
}

// fromPos: where the pack exploded (cards arc from here)
export function dealCardsAnimation(cards, fromPos = { x: 0, y: 1.8, z: 0 }) {
  return new Promise(resolve => {
    const promises = cards.map((card, i) => {
      return new Promise(cardResolve => {
        const pos = FAN_POSITIONS[i];

        card.group.position.set(fromPos.x, fromPos.y, fromPos.z);
        card.group.rotation.set(0, Math.PI, 0);
        card.group.scale.set(0.05, 0.05, 0.05);

        const delay = i * 0.07;

        // Scale in with bounce
        gsap.to(card.group.scale, {
          x: 1, y: 1, z: 1, duration: 0.4, delay, ease: 'back.out(2.5)',
        });

        // Arc trajectory: burst upward first, then arc down to fan slot
        // Outer cards arc higher since they travel farther
        const arcPeakY = fromPos.y + 3.8 + Math.abs(i - 2) * 0.7;

        const tl = gsap.timeline({ delay });
        tl.to(card.group.position, {
          x: fromPos.x + (pos.x - fromPos.x) * 0.3,
          y: arcPeakY,
          z: pos.z * 0.4,
          duration: 0.28, ease: 'power2.out',
        })
        .to(card.group.position, {
          x: pos.x, y: pos.y, z: pos.z,
          duration: 0.38, ease: 'power3.in',
          onComplete: cardResolve,
        });

        // Double-spin during flight, landing face-down; normalize so reveal flip works correctly
        gsap.to(card.group.rotation, {
          y: Math.PI + Math.PI * 4,
          z: pos.rotZ,
          duration: 0.66, delay, ease: 'power2.inOut',
          onComplete: () => gsap.set(card.group.rotation, { y: Math.PI }),
        });
      });
    });
    Promise.all(promises).then(resolve);
  });
}

export function revealCardAnimation(card) {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });

    // Swoop to center with punch scale
    tl.to(card.group.position, { x: 0, y: 0.5, z: 3.8, duration: 0.38, ease: 'power3.out' })
      .to(card.group.rotation, { z: 0, duration: 0.32, ease: 'power3.out' }, '<')
      .to(card.group.scale, { x: 1.55, y: 1.55, z: 1.55, duration: 0.38, ease: 'back.out(1.8)' }, '<');

    // Punchy flip: fast first half, scale punch at midpoint, fast second half
    tl.to(card.group.rotation, { y: Math.PI * 0.5, duration: 0.15, ease: 'power3.in' })
      .to(card.group.scale, { x: 1.7, y: 1.7, z: 1.7, duration: 0.07, ease: 'power2.out' }, '<0.1')
      .to(card.group.rotation, { y: 0, duration: 0.15, ease: 'power3.out' })
      .to(card.group.scale, { x: 1.55, y: 1.55, z: 1.55, duration: 0.15, ease: 'back.out(2.5)' }, '<');

    if (card.glowPlane) {
      tl.to(card.glowPlane.material, { opacity: 0.65, duration: 0.45, ease: 'power2.out' }, '-=0.25');
    }
  });
}

export function returnCardAnimation(card, index) {
  return new Promise(resolve => {
    const pos = FAN_POSITIONS[index];
    const tl = gsap.timeline({ onComplete: resolve });

    if (card.glowPlane) {
      tl.to(card.glowPlane.material, { opacity: 0, duration: 0.2 });
    }

    tl.to(card.group.position, { x: pos.x, y: pos.y, z: pos.z, duration: 0.4, ease: 'power2.inOut' })
      .to(card.group.rotation, { z: pos.rotZ, duration: 0.3, ease: 'power2.inOut' }, '<')
      .to(card.group.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.inOut' }, '<');
  });
}

export function hoverCardAnimation(card, isHover) {
  gsap.to(card.group.position, {
    y: card.group.position.y + (isHover ? 0.4 : -0.4),
    duration: 0.2,
    ease: 'power2.out',
    overwrite: 'auto',
  });
}
