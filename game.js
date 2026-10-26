// Game logic + rendering. It knows nothing about cameras or MediaPipe:
// it just receives "hands" (fingertip positions in canvas pixels) every frame.
//
// hands = [{ tips: [{x,y}...], index: {x,y}, palm: {x,y}, pointing: boolean }]
//
// States:  idle -> portal -> playing -> result -> idle

import { W, H, CONFIG, ERAS } from './config.js';
import { drawWorld } from './worlds.js';
import { sfx } from './audio.js';
import { Smoother, CircleDetector } from './gestures.js';

const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const DOORS = ERAS.map((era, i) => ({ era, x: W * (0.2 + 0.3 * i), y: H * 0.5, r: 95 }));

const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const rand = (a, b) => a + Math.random() * (b - a);

export class Game {
  constructor() {
    this.smoother = new Smoother(CONFIG.smoothing);
    this.detector = new CircleDetector(CONFIG.circle);
    this.onEnd = null; // ({score, era, maxCombo, collected}) => void
    this.onStateChange = null; // (state) => void
    this.hands = [];
    this.t = 0; // seconds since page load (for animations)
    this.shake = 0;
    this.flash = 0;
    this.reset();
  }

  /* ---------------------------------------------------------------- */
  /* state management                                                  */
  /* ---------------------------------------------------------------- */

  _setState(s) {
    this.state = s;
    this.stateMs = 0;
    if (this.onStateChange) this.onStateChange(s);
  }

  reset() {
    this.era = null;
    this.trail = [];
    this.crystals = [];
    this.particles = [];
    this.texts = [];
    this.dwell = DOORS.map(() => 0);
    this.portal = { x: W / 2, y: H / 2, r: 100 };
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.collected = 0;
    this.smoother.reset();
    this.detector.clear();
    this._setState('idle');
  }

  /** True when the camera cut-out of the person should be shown on top of a world. */
  needsPerson() {
    return this.state !== 'idle';
  }

  openPortal(c = { x: W / 2, y: H / 2, r: 120 }) {
    if (this.state !== 'idle') return;
    this.portal = { x: c.x, y: c.y, r: c.r };
    this.trail = [];
    this.detector.clear();
    this.dwell = DOORS.map(() => 0);
    sfx.portal();
    this._setState('portal');
  }

  chooseEra(i) {
    if (this.state !== 'portal' || !ERAS[i]) return;
    this.era = ERAS[i];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.collected = 0;
    this.crystals = [];
    this.particles = [];
    this.texts = [];
    this.readyMs = CONFIG.readyMs;
    this.timeLeft = CONFIG.gameSeconds * 1000;
    this.spawnMs = 0;
    this.sinceCollect = 0;
    this.lastTickSec = -1;
    this.flash = 1;
    sfx.select();
    this._setState('playing');
  }

  /* ---------------------------------------------------------------- */
  /* update                                                            */
  /* ---------------------------------------------------------------- */

  update(dt, hands, now) {
    this.t += dt / 1000;
    this.stateMs += dt;
    this.hands = hands;
    this.shake = Math.max(0, this.shake - dt / 400);
    this.flash = Math.max(0, this.flash - dt / 500);

    if (this.state === 'idle') this._updateIdle(now);
    else if (this.state === 'portal') this._updatePortal(dt);
    else if (this.state === 'playing') this._updatePlaying(dt);
    this._updateFx(dt);
  }

  _updateIdle(now) {
    const pointer = this.hands.find((h) => h.pointing);
    if (pointer) {
      const s = this.smoother.update(pointer.index);
      this.detector.add(s, now);
      this.trail.push({ x: s.x, y: s.y, t: now });
    } else {
      this.smoother.reset();
      this.detector.clear();
    }
    while (this.trail.length && now - this.trail[0].t > CONFIG.circle.maxAgeMs) this.trail.shift();
    const circle = this.detector.detect();
    if (circle) this.openPortal(circle);
  }

  _updatePortal(dt) {
    if (this.stateMs > CONFIG.portalTimeoutMs) return this.reset();
    if (this.stateMs < CONFIG.portalOpenMs) return;
    DOORS.forEach((d, i) => {
      const hit = this.hands.some((h) => Math.hypot(h.index.x - d.x, h.index.y - d.y) < d.r);
      this.dwell[i] = hit ? this.dwell[i] + dt : Math.max(0, this.dwell[i] - dt * 2);
    });
    const picked = this.dwell.findIndex((v) => v >= CONFIG.dwellMs);
    if (picked >= 0) this.chooseEra(picked);
  }

  _updatePlaying(dt) {
    if (this.readyMs > 0) {
      this.readyMs -= dt;
      return;
    }
    this.timeLeft -= dt;
    this.sinceCollect += dt;
    if (this.sinceCollect > 2200 && this.combo) this.combo = 0;

    const sec = Math.ceil(this.timeLeft / 1000);
    if (sec <= 5 && sec > 0 && sec !== this.lastTickSec) {
      this.lastTickSec = sec;
      sfx.tick();
    }

    // spawn
    this.spawnMs += dt;
    if (this.spawnMs >= CONFIG.spawnEveryMs && this.crystals.length < CONFIG.maxCrystals) {
      this.spawnMs = 0;
      this._spawn();
    }

    // collisions
    const points = [];
    for (const h of this.hands) {
      points.push(...h.tips, h.palm);
    }
    for (const c of this.crystals) {
      c.age += dt;
      const r = this._radius(c) + 12;
      if (points.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < r)) {
        c.dead = true;
        this._hit(c);
      }
    }
    this.crystals = this.crystals.filter((c) => !c.dead && c.age < CONFIG.crystalLifeMs);

    if (this.timeLeft <= 0) this._finish();
  }

  _updateFx(dt) {
    const s = dt / 1000;
    for (const p of this.particles) {
      p.life -= s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vy += 500 * s;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const tx of this.texts) {
      tx.life -= s;
      tx.y -= 60 * s;
    }
    this.texts = this.texts.filter((tx) => tx.life > 0);
  }

  _radius(c) {
    const pop = Math.min(1, c.age / 200);
    const left = CONFIG.crystalLifeMs - c.age;
    const shrink = left < 600 ? Math.max(0, left / 600) : 1;
    return CONFIG.crystalRadius * easeOut(pop) * shrink * (c.kind === 'gold' ? 1.15 : 1);
  }

  _spawn() {
    const roll = Math.random();
    const kind = roll < CONFIG.hazardChance ? 'hazard' : roll < CONFIG.hazardChance + CONFIG.goldChance ? 'gold' : 'normal';
    for (let tries = 0; tries < 10; tries++) {
      const x = rand(90, W - 90);
      const y = rand(150, H - 90);
      if (this.crystals.every((c) => Math.hypot(c.x - x, c.y - y) > 130)) {
        this.crystals.push({ x, y, kind, age: 0, spin: rand(0, 6) });
        return;
      }
    }
  }

  _hit(c) {
    const era = this.era;
    if (c.kind === 'hazard') {
      this.score = Math.max(0, this.score - 15);
      this.combo = 0;
      this.shake = 1;
      sfx.hazard();
      this._burst(c.x, c.y, '#ff3b3b', 22);
      this._text(c.x, c.y, '-15', '#ff6b6b');
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.sinceCollect = 0;
    this.collected++;
    const mult = Math.min(3, 1 + Math.floor(this.combo / 5));
    if (c.kind === 'gold') {
      const pts = 30 * mult;
      this.score += pts;
      this.timeLeft += 2000;
      sfx.gold();
      this._burst(c.x, c.y, era.gold, 26);
      this._text(c.x, c.y, `+${pts}  +2s`, era.gold);
    } else {
      const pts = 10 * mult;
      this.score += pts;
      sfx.collect(this.combo);
      this._burst(c.x, c.y, era.color, 14);
      this._text(c.x, c.y, `+${pts}`, '#ffffff');
    }
    if (this.combo > 0 && this.combo % 5 === 0) this._text(c.x, c.y - 40, `COMBO x${mult}!`, '#ffd34d');
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(120, 420);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rand(0.4, 0.9), color });
    }
  }

  _text(x, y, str, color) {
    this.texts.push({ x, y, str, color, life: 0.9 });
  }

  _finish() {
    this.timeLeft = 0;
    sfx.end();
    this._setState('result');
    if (this.onEnd) {
      this.onEnd({ score: this.score, era: this.era, maxCombo: this.maxCombo, collected: this.collected });
    }
  }

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{drawVideo:(ctx)=>void, drawPerson:(ctx)=>void}} media
   */
  render(ctx, media) {
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake * 12, rand(-1, 1) * this.shake * 12);

    if (this.state === 'idle') this._renderIdle(ctx, media);
    else if (this.state === 'portal') this._renderPortal(ctx, media);
    else this._renderWorld(ctx, media);

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _renderIdle(ctx, media) {
    media.drawVideo(ctx);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(10,5,30,0)');
    vg.addColorStop(1, 'rgba(10,5,30,0.7)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // faint spinning dashed circle to hint at the gesture
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(this.t * 0.6);
    ctx.setLineDash([16, 14]);
    ctx.strokeStyle = 'rgba(140,220,255,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // glowing trail of the finger
    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = 24;
      for (let i = 1; i < this.trail.length; i++) {
        const a = i / this.trail.length;
        ctx.strokeStyle = `rgba(125,249,255,${a})`;
        ctx.lineWidth = 3 + a * 9;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    this._text2(ctx, '🌀 WAVEWRAP', W / 2, 70, 54, '#ffffff', true);
    const pulse = 0.75 + Math.sin(this.t * 3) * 0.25;
    ctx.globalAlpha = pulse;
    this._text2(ctx, '☝️ Point one finger and draw a CIRCLE in the air', W / 2, H - 60, 34, '#bff6ff', true);
    ctx.globalAlpha = 1;
    this._cursors(ctx, false);
  }

  _renderPortal(ctx, media) {
    media.drawVideo(ctx);
    const openT = easeOut(this.stateMs / CONFIG.portalOpenMs);
    const maxR = Math.hypot(W, H);
    const R = this.portal.r + (maxR - this.portal.r) * openT;
    const { x, y } = this.portal;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.clip();
    const bg = ctx.createRadialGradient(x, y, 0, x, y, R);
    bg.addColorStop(0, '#000010');
    bg.addColorStop(0.55, '#1a0b4d');
    bg.addColorStop(1, '#4b1d9c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.shadowBlur = 22;
    for (let k = 0; k < 6; k++) {
      const col = k % 2 ? '#ff3fd0' : '#3ff2ff';
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let r = 8; r < R; r += 14) {
        const a = this.t * 1.6 + (k * Math.PI) / 3 + r * 0.011;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (r === 8) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#9ff7ff';
    ctx.shadowColor = '#3ff2ff';
    ctx.shadowBlur = 40;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    media.drawPerson(ctx);

    if (openT > 0.85) {
      ctx.globalAlpha = Math.min(1, (openT - 0.85) / 0.15);
      this._text2(ctx, 'Choose your era', W / 2, 90, 52, '#ffffff', true);
      this._text2(ctx, 'Hold your fingertip on a door ✨', W / 2, 140, 28, '#d6c9ff', true);
      DOORS.forEach((d, i) => this._renderDoor(ctx, d, this.dwell[i] / CONFIG.dwellMs));
      ctx.globalAlpha = 1;
    }
    this._cursors(ctx, false);
  }

  _renderDoor(ctx, d, progress) {
    const pulse = 1 + Math.sin(this.t * 3 + d.x) * 0.03 + progress * 0.12;
    const r = d.r * pulse;
    ctx.save();
    ctx.shadowColor = d.era.glow;
    ctx.shadowBlur = 35;
    const g = ctx.createRadialGradient(d.x, d.y, 8, d.x, d.y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(10,5,40,0.8)');
    ctx.fillStyle = g;
    ctx.strokeStyle = d.era.color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.font = `72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(d.era.emoji, d.x, d.y + 4);
    this._text2(ctx, d.era.name, d.x, d.y + r + 38, 30, '#ffffff', true);

    if (progress > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderWorld(ctx, media) {
    drawWorld(ctx, this.era.id, this.t);
    media.drawPerson(ctx);

    if (this.state === 'playing' && this.readyMs <= 0) {
      for (const c of this.crystals) this._renderCrystal(ctx, c);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      this._text2(ctx, tx.str, tx.x, tx.y, 36, tx.color, true);
    }
    ctx.globalAlpha = 1;

    this._renderHud(ctx);

    if (this.state === 'playing' && this.readyMs > 0) {
      const n = Math.ceil(this.readyMs / 500);
      this._text2(ctx, n > 1 ? 'GET READY!' : 'GO!', W / 2, H / 2, 110, '#ffffff', true);
      this._text2(ctx, 'Touch the crystals · avoid the dark spiky orbs', W / 2, H / 2 + 80, 32, '#ffe9a8', true);
    }
    if (this.state === 'result') {
      this._text2(ctx, "TIME'S UP!", W / 2, 230, 110, '#ffffff', true);
    }
    this._cursors(ctx, true);
  }

  _renderCrystal(ctx, c) {
    const r = this._radius(c);
    if (r < 1) return;
    const era = this.era;
    ctx.save();
    ctx.translate(c.x, c.y);

    if (c.kind === 'hazard') {
      const pulse = 1 + Math.sin(this.t * 8 + c.spin) * 0.08;
      ctx.rotate(this.t * 1.5 + c.spin);
      ctx.shadowColor = '#ff2d2d';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#1b0610';
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const rad = (i % 2 ? r * 0.62 : r * 1.12) * pulse;
        const a = (i / 16) * Math.PI * 2;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const color = c.kind === 'gold' ? '#ffd34d' : era.color;
      const sx = 0.55 + 0.45 * Math.abs(Math.cos(this.t * 2.5 + c.spin)); // spin effect
      ctx.shadowColor = c.kind === 'gold' ? '#ffb300' : era.glow;
      ctx.shadowBlur = 32;
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, color);
      g.addColorStop(1, c.kind === 'gold' ? '#c78a00' : era.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(r * 0.75 * sx, 0);
      ctx.lineTo(0, r * 1.15);
      ctx.lineTo(-r * 0.75 * sx, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(0, r * 1.15);
      ctx.moveTo(-r * 0.75 * sx, 0);
      ctx.lineTo(r * 0.75 * sx, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderHud(ctx) {
    const era = this.era;
    ctx.fillStyle = 'rgba(8,4,28,0.55)';
    ctx.fillRect(0, 0, W, 86);

    ctx.textAlign = 'left';
    this._text2(ctx, `${era.emoji} ${era.name}`, 28, 44, 32, '#ffffff', false, 'left');

    const secs = Math.max(0, this.timeLeft / 1000);
    const low = secs <= 5 && this.state === 'playing';
    this._text2(ctx, secs.toFixed(1) + 's', W / 2, 40, 48, low ? '#ff6b6b' : '#ffffff', false);
    const frac = Math.min(1, secs / CONFIG.gameSeconds);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(W / 2 - 160, 66, 320, 8);
    ctx.fillStyle = low ? '#ff6b6b' : era.color;
    ctx.fillRect(W / 2 - 160, 66, 320 * frac, 8);

    this._text2(ctx, `⭐ ${this.score}`, W - 28, 44, 44, '#ffe066', false, 'right');

    if (this.combo >= 2 && this.state === 'playing') {
      const mult = Math.min(3, 1 + Math.floor(this.combo / 5));
      this._text2(ctx, `🔥 ${this.combo} combo  x${mult}`, 28, H - 40, 38, '#ffb347', true, 'left');
    }
  }

  _cursors(ctx, small) {
    for (const h of this.hands) {
      const pts = small ? h.tips : [h.index];
      for (const p of pts) {
        ctx.save();
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 18;
        ctx.fillStyle = small ? 'rgba(255,255,255,0.9)' : '#ffffff';
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, small ? 9 : 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _text2(ctx, str, x, y, size, color, shadow = false, align = 'center') {
    ctx.save();
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
}
