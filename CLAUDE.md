# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (Vite, hot reload)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test runner or linter is configured.

## Architecture

This is a **3D TCG pack opening simulator** — vanilla JavaScript with Three.js (3D rendering) and GSAP (animations). No framework, no TypeScript.

### State Machine (`src/main.js`)

The entire app is driven by a finite state machine:

```
INTRO → IDLE → OPENING → FANNING → IDLE_FAN → REVEALING → REVEALED
```

User interactions (clicks, hover) are only processed when the current state allows them. Raycasting (`THREE.Raycaster`) handles 3D object picking for click and hover detection.

### Module Responsibilities

| File | Responsibility |
|------|---------------|
| `src/main.js` | State machine, input handling, render loop |
| `src/scene.js` | Three.js renderer, camera, lighting setup |
| `src/Pack.js` | Booster pack 3D mesh with shimmer effect |
| `src/Card.js` | Card mesh (front/back textures, optional glow plane for legendaries) |
| `src/Animator.js` | All GSAP timeline animations (pack open, card deal, flip, hover) |
| `src/textureFactory.js` | Canvas-based procedural texture generation for cards and pack |
| `src/cardData.js` | Static card definitions (5 cards with rarity, colors, stats) |

### Texture Generation

Textures are generated at runtime via the Canvas 2D API in `textureFactory.js` — there are no image files. Cards use their `primaryColor`/`secondaryColor`/`accentColor`/`borderColor` fields from `cardData.js` to produce unique visuals per card.

### Card Data Shape

```javascript
{
  id: number,
  name: string,
  type: 'Monster' | 'Spell' | 'Trap',
  rarity: 'legendary' | 'rare' | 'uncommon' | 'common',
  power: number | null,
  description: string,
  primaryColor: hex,
  secondaryColor: hex,
  accentColor: hex,
  borderColor: hex
}
```

Legendary cards get an extra glow plane mesh rendered via `Card.showGlow()`.
