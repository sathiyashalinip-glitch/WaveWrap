// Gesture helpers: smoothing, "pointing" pose and the circle detector.

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Exponential smoothing so the fingertip dot doesn't jitter. */
export class Smoother {
  constructor(alpha) {
    this.alpha = alpha;
    this.p = null;
  }
  update(pt) {
    if (!this.p) this.p = { x: pt.x, y: pt.y };
    else {
      this.p.x += (pt.x - this.p.x) * this.alpha;
      this.p.y += (pt.y - this.p.y) * this.alpha;
    }
    return { x: this.p.x, y: this.p.y };
  }
  reset() {
    this.p = null;
  }
}

/**
 * Is the hand making a "pointing" pose? (index finger out, middle finger curled)
 * Works at any hand rotation by comparing distances to the wrist.
 * `lm` = the 21 MediaPipe landmarks (normalized).
 */
export function isPointing(lm) {
  const extended = (tip, pip) => dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * 1.08;
  return extended(8, 6) && !extended(12, 10);
}

/**
 * Remembers the recent fingertip path and answers: "did the user just draw a circle?"
 * Tries several start points so a stray line before the circle doesn't break it.
 */
export class CircleDetector {
  constructor(cfg) {
    this.cfg = cfg;
    this.pts = [];
  }
  add(p, now) {
    this.pts.push({ x: p.x, y: p.y, t: now });
    while (this.pts.length && now - this.pts[0].t > this.cfg.maxAgeMs) this.pts.shift();
  }
  clear() {
    this.pts = [];
  }
  /** @returns {{x:number,y:number,r:number}|null} centre + radius of the circle */
  detect() {
    const c = this.cfg;
    const n = this.pts.length;
    if (n < c.minPoints) return null;
    for (let start = 0; start <= n - c.minPoints; start += 2) {
      const res = this._test(this.pts.slice(start));
      if (res) return res;
    }
    return null;
  }
  _test(pts) {
    const c = this.cfg;
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;

    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    if (mean < c.minRadius || mean > c.maxRadius) return null;

    const variance = radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length;
    if (Math.sqrt(variance) / mean > c.maxRadiusVar) return null; // not round enough

    const first = pts[0];
    const last = pts[pts.length - 1];
    if (dist(first, last) > c.closeRatio * 2 * mean) return null; // loop not closed

    let sweep = 0; // total angle travelled around the centre
    let prev = Math.atan2(first.y - cy, first.x - cx);
    for (let i = 1; i < pts.length; i++) {
      const a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
      let d = a - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      sweep += d;
      prev = a;
    }
    if (Math.abs(sweep) < (c.minSweepDeg * Math.PI) / 180) return null;

    return { x: cx, y: cy, r: mean };
  }
}
