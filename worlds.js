// Three procedurally drawn worlds. No image downloads needed, so it works offline.
// Each world = a static layer (drawn once and cached) + a small animated layer.

import { W, H } from './config.js';

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLayer() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')];
}

function glow(g, x, y, r, color, alpha = 1) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function vGradient(g, stops) {
  const grd = g.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => grd.addColorStop(o, c));
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------------ */
/* DINOSAUR AGE                                                        */
/* ------------------------------------------------------------------ */

function palm(g, x, y, h, lean, color) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + lean * 0.5, y - h * 0.6, x + lean, y - h);
  g.stroke();
  g.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5;
    const tx = x + lean + Math.cos(a) * 90;
    const ty = y - h + Math.sin(a) * 60 + 40;
    g.beginPath();
    g.moveTo(x + lean, y - h);
    g.quadraticCurveTo(x + lean + Math.cos(a) * 50, y - h + Math.sin(a) * 70 - 15, tx, ty);
    g.stroke();
  }
}

function brontosaurus(g, x, y, s, color) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.beginPath(); // body
  g.ellipse(0, -60, 90, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 30; // neck
  g.beginPath();
  g.moveTo(60, -80);
  g.quadraticCurveTo(130, -120, 120, -210);
  g.stroke();
  g.beginPath(); // head
  g.ellipse(132, -218, 24, 15, -0.25, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 26; // tail
  g.beginPath();
  g.moveTo(-70, -55);
  g.quadraticCurveTo(-160, -40, -210, -10);
  g.stroke();
  g.lineWidth = 22; // legs
  for (const lx of [-45, -15, 35, 62]) {
    g.beginPath();
    g.moveTo(lx, -40);
    g.lineTo(lx, 0);
    g.stroke();
  }
  g.restore();
}

function buildDino() {
  const [c, g] = makeLayer();
  const r = rng(11);
  vGradient(g, [
    [0, '#2b1055'],
    [0.42, '#c2456f'],
    [0.72, '#ff9a52'],
    [1, '#ffd27a'],
  ]);
  glow(g, W * 0.78, H * 0.4, 260, 'rgba(255,230,170,0.9)');
  g.fillStyle = '#fff3cf';
  g.beginPath();
  g.arc(W * 0.78, H * 0.4, 62, 0, Math.PI * 2);
  g.fill();

  // far hills
  g.fillStyle = '#4a1f46';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.66 + Math.sin(x * 0.006) * 34 + Math.sin(x * 0.017) * 10);
  g.lineTo(W, H);
  g.fill();

  // volcano
  g.fillStyle = '#2a1420';
  g.beginPath();
  g.moveTo(90, H * 0.8);
  g.lineTo(320, 275);
  g.lineTo(372, 258);
  g.lineTo(424, 275);
  g.lineTo(670, H * 0.8);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ff5a1f'; // lava streams
  g.lineWidth = 5;
  g.lineCap = 'round';
  [[372, 262, 340, 380], [380, 262, 420, 360], [366, 262, 380, 330]].forEach(([x1, y1, x2, y2]) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) / 2 + 8, (y1 + y2) / 2, x2, y2);
    g.stroke();
  });

  // near ground
  g.fillStyle = '#2d1a2e';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.82 + Math.sin(x * 0.01 + 1) * 18);
  g.lineTo(W, H);
  g.fill();

  brontosaurus(g, W * 0.7, H * 0.86, 1.05, '#24122a');
  brontosaurus(g, W * 0.9, H * 0.79, 0.55, '#3a1d3d');
  palm(g, 80, H * 0.97, 260, 40, '#1d0f23');
  palm(g, 220, H * 0.99, 200, -30, '#1d0f23');
  palm(g, W - 60, H, 300, -50, '#1d0f23');
  palm(g, 560, H * 0.98, 160, 25, '#2a1530');

  for (let i = 0; i < 40; i++) {
    // ash specks
    g.fillStyle = `rgba(255,200,150,${0.1 + r() * 0.2})`;
    g.fillRect(r() * W, r() * H * 0.7, 2, 2);
  }
  return c;
}

function animDino(g, t) {
  const pulse = 0.6 + Math.sin(t * 3) * 0.25;
  glow(g, 372, 262, 90 + pulse * 20, 'rgba(255,110,30,0.9)', pulse);
  for (let i = 0; i < 6; i++) {
    // smoke puffs rising from the crater
    const p = (t * 0.18 + i / 6) % 1;
    const x = 372 + Math.sin(p * 6 + i) * 30 + p * 90;
    const y = 255 - p * 230;
    g.fillStyle = `rgba(70,45,60,${0.55 * (1 - p)})`;
    g.beginPath();
    g.arc(x, y, 22 + p * 55, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#1c0e22'; // pterodactyls
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const x = ((t * (40 + i * 18) + i * 420) % (W + 200)) - 100;
    const y = 120 + i * 55 + Math.sin(t + i) * 14;
    const flap = Math.sin(t * 7 + i) * 10;
    g.beginPath();
    g.moveTo(x - 28, y + flap);
    g.quadraticCurveTo(x - 12, y - 8, x, y);
    g.quadraticCurveTo(x + 12, y - 8, x + 28, y + flap);
    g.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* DEEP SPACE                                                          */
/* ------------------------------------------------------------------ */

const spaceStars = (() => {
  const r = rng(5);
  return Array.from({ length: 140 }, () => ({
    x: r() * W,
    y: r() * H,
    s: 0.6 + r() * 1.8,
    ph: r() * 6.28,
    sp: 1 + r() * 3,
  }));
})();

function buildSpace() {
  const [c, g] = makeLayer();
  vGradient(g, [
    [0, '#020108'],
    [1, '#120536'],
  ]);
  glow(g, W * 0.25, H * 0.3, 380, 'rgba(120,60,200,0.45)');
  glow(g, W * 0.8, H * 0.7, 420, 'rgba(0,140,200,0.35)');
  glow(g, W * 0.55, H * 0.15, 260, 'rgba(255,80,160,0.25)');

  const r = rng(9);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
    g.fillRect(r() * W, r() * H, 1.5, 1.5);
  }

  // ringed planet
  const px = W * 0.2;
  const py = H * 0.7;
  const pr = 150;
  g.save();
  g.translate(px, py);
  g.rotate(-0.35);
  g.strokeStyle = 'rgba(255,220,170,0.35)'; // ring (back half)
  g.lineWidth = 26;
  g.beginPath();
  g.ellipse(0, 0, pr * 1.9, pr * 0.5, 0, Math.PI, Math.PI * 2);
  g.stroke();
  g.restore();
  const body = g.createRadialGradient(px - 50, py - 60, 20, px, py, pr);
  body.addColorStop(0, '#ffd7a0');
  body.addColorStop(0.5, '#e08a52');
  body.addColorStop(1, '#5a2a3a');
  g.fillStyle = body;
  g.beginPath();
  g.arc(px, py, pr, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(px, py, pr, 0, Math.PI * 2);
  g.clip();
  g.globalAlpha = 0.18;
  g.fillStyle = '#5a2a3a';
  for (let i = 0; i < 5; i++) g.fillRect(px - pr, py - pr + 40 + i * 52, pr * 2, 14 + (i % 2) * 10);
  g.restore();
  g.save();
  g.translate(px, py);
  g.rotate(-0.35);
  g.strokeStyle = 'rgba(255,230,190,0.55)'; // ring (front half)
  g.lineWidth = 26;
  g.beginPath();
  g.ellipse(0, 0, pr * 1.9, pr * 0.5, 0, 0, Math.PI);
  g.stroke();
  g.restore();

  // moon
  const moon = g.createRadialGradient(W * 0.84 - 12, H * 0.2 - 12, 4, W * 0.84, H * 0.2, 54);
  moon.addColorStop(0, '#ffffff');
  moon.addColorStop(1, '#8a93b8');
  g.fillStyle = moon;
  g.beginPath();
  g.arc(W * 0.84, H * 0.2, 54, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(70,80,120,0.35)';
  [[-15, -8, 11], [14, 12, 8], [8, -20, 6]].forEach(([dx, dy, rad]) => {
    g.beginPath();
    g.arc(W * 0.84 + dx, H * 0.2 + dy, rad, 0, Math.PI * 2);
    g.fill();
  });
  return c;
}

function animSpace(g, t) {
  for (const s of spaceStars) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.ph));
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.fillRect(s.x, s.y, s.s, s.s);
  }
  const cycle = (t % 5) / 5; // shooting star every 5 s
  if (cycle < 0.18) {
    const p = cycle / 0.18;
    const x = W * 0.9 - p * 520;
    const y = H * 0.08 + p * 260;
    const grd = g.createLinearGradient(x, y, x + 110, y - 55);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grd;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 110, y - 55);
    g.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* FUTURE CITY                                                         */
/* ------------------------------------------------------------------ */

function skyline(g, r, baseY, minH, maxH, color, windowChance, neon) {
  let x = -20;
  while (x < W) {
    const w = 60 + r() * 90;
    const h = minH + r() * (maxH - minH);
    g.fillStyle = color;
    g.fillRect(x, baseY - h, w, h + 400);
    for (let wy = baseY - h + 14; wy < baseY - 10; wy += 20) {
      for (let wx = x + 8; wx < x + w - 10; wx += 16) {
        if (r() < windowChance) {
          g.fillStyle = r() < 0.7 ? 'rgba(255,230,140,0.85)' : 'rgba(110,240,255,0.85)';
          g.fillRect(wx, wy, 7, 10);
        }
      }
    }
    if (neon && r() < 0.5) {
      const col = r() < 0.5 ? '#ff3fd0' : '#3ff2ff';
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 18;
      g.fillStyle = col;
      g.fillRect(x + 6, baseY - h + 4, w - 12, 5);
      g.restore();
    }
    x += w + 4 + r() * 12;
  }
}

const cityAntennas = [150, 420, 700, 930, 1180].map((x, i) => ({ x, y: 250 + (i % 3) * 40 }));

function buildCity() {
  const [c, g] = makeLayer();
  const r = rng(21);
  vGradient(g, [
    [0, '#070a24'],
    [0.5, '#4a2a86'],
    [0.85, '#ff6fb5'],
    [1, '#ffb7d9'],
  ]);
  glow(g, W * 0.5, H * 0.62, 480, 'rgba(255,120,200,0.45)');
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(W * 0.14, H * 0.2, 44, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`;
    g.fillRect(r() * W, r() * H * 0.4, 1.5, 1.5);
  }
  skyline(g, r, H * 0.82, 120, 330, '#1c1450', 0.25, false);
  skyline(g, r, H * 0.95, 160, 420, '#0b0924', 0.35, true);
  // street glow
  const road = g.createLinearGradient(0, H * 0.93, 0, H);
  road.addColorStop(0, 'rgba(63,242,255,0.0)');
  road.addColorStop(1, 'rgba(63,242,255,0.45)');
  g.fillStyle = road;
  g.fillRect(0, H * 0.93, W, H * 0.07);
  return c;
}

function animCity(g, t) {
  for (const a of cityAntennas) {
    const on = Math.sin(t * 3 + a.x) > 0;
    glow(g, a.x, a.y, on ? 26 : 10, 'rgba(255,60,60,0.95)', on ? 1 : 0.4);
  }
  const lanes = [
    { y: 150, sp: 140, col: '#3ff2ff', n: 3 },
    { y: 215, sp: -90, col: '#ff3fd0', n: 3 },
    { y: 285, sp: 200, col: '#fff2a8', n: 2 },
  ];
  for (const ln of lanes) {
    for (let i = 0; i < ln.n; i++) {
      const raw = (t * ln.sp + i * 480) % (W + 300);
      const x = ln.sp > 0 ? raw - 150 : W + 150 - (((-t * ln.sp + i * 480) % (W + 300)));
      const dir = ln.sp > 0 ? -1 : 1;
      const grd = g.createLinearGradient(x, 0, x + dir * 120, 0);
      grd.addColorStop(0, ln.col);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.shadowColor = ln.col;
      g.shadowBlur = 14;
      g.fillStyle = grd;
      g.fillRect(Math.min(x, x + dir * 120), ln.y, 120, 5);
      g.fillStyle = '#fff';
      g.fillRect(x - 5, ln.y - 3, 10, 11);
      g.restore();
    }
  }
}

/* ------------------------------------------------------------------ */

const builders = { dino: buildDino, space: buildSpace, city: buildCity };
const animators = { dino: animDino, space: animSpace, city: animCity };
const cache = {};

/** Draw a world onto `ctx`. `t` is time in seconds. */
export function drawWorld(ctx, id, t) {
  if (!cache[id]) cache[id] = builders[id]();
  ctx.drawImage(cache[id], 0, 0);
  animators[id](ctx, t);
}
