// Tiny sound-effects engine. No audio files needed: everything is synthesized.

let ac = null;

function getCtx() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ac = new A();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur = 0.15, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  const a = getCtx();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  unlock() {
    getCtx(); // must be called from a click to allow audio
  },
  collect(combo = 0) {
    const bump = Math.min(combo, 10) * 40;
    tone(660 + bump, 0.12, 'triangle', 0.14);
    tone(990 + bump, 0.1, 'triangle', 0.08, null, 0.05);
  },
  gold() {
    [880, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'sine', 0.14, null, i * 0.07));
  },
  hazard() {
    tone(150, 0.35, 'sawtooth', 0.16, 60);
  },
  portal() {
    tone(200, 0.9, 'sine', 0.14, 900);
    tone(300, 0.9, 'triangle', 0.08, 1200);
  },
  select() {
    tone(520, 0.1, 'square', 0.07);
    tone(780, 0.15, 'square', 0.07, null, 0.08);
  },
  tick() {
    tone(1000, 0.05, 'square', 0.05);
  },
  end() {
    [784, 659, 523, 392].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, null, i * 0.14));
  },
};
