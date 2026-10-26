// Central place for every number you might want to tweak at the expo.

export const W = 1280; // canvas width  (all game coordinates are in this space)
export const H = 720; // canvas height

export const CONFIG = {
  gameSeconds: 30, // length of one round
  readyMs: 1500, // "GET READY" pause before crystals appear
  dwellMs: 1100, // how long to hold a finger on a door to select it
  portalOpenMs: 900, // portal opening animation
  portalTimeoutMs: 20000, // go back to idle if nobody picks an era
  resultTimeoutMs: 45000, // auto-skip the result screen

  maxCrystals: 5,
  spawnEveryMs: 650,
  crystalLifeMs: 3400,
  crystalRadius: 44,
  hazardChance: 0.14, // dark spiky orbs: -15 points, combo reset
  goldChance: 0.1, // golden crystals: 3x points and +2 seconds

  smoothing: 0.45, // 0..1, lower = smoother but laggier fingertip
  modelComplexity: 0, // MediaPipe Hands: 0 = fast, 1 = more accurate

  // Circle-gesture detection
  circle: {
    minPoints: 16,
    maxAgeMs: 2600, // only the last N ms of finger movement count
    minRadius: 55, // px
    maxRadius: 300, // px
    closeRatio: 0.5, // start/end gap must be < ratio * diameter
    maxRadiusVar: 0.32, // how "round" the shape must be (lower = stricter)
    minSweepDeg: 290, // how much of a full turn must be drawn
  },
};

export const ERAS = [
  {
    id: 'dino',
    name: 'Dinosaur Age',
    emoji: '🦖',
    color: '#ffb347',
    glow: '#ff8c00',
    gold: '#fff2a8',
  },
  {
    id: 'space',
    name: 'Deep Space',
    emoji: '🚀',
    color: '#6df0ff',
    glow: '#18b6ff',
    gold: '#fff2a8',
  },
  {
    id: 'city',
    name: 'Future City',
    emoji: '🌆',
    color: '#ff6fd8',
    glow: '#d11fff',
    gold: '#fff2a8',
  },
];
