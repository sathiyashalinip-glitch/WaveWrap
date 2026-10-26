// Glue code: webcam + MediaPipe (hand tracking & person cut-out) -> Game -> canvas.

import { W, H, CONFIG } from './config.js';
import { Game } from './game.js';
import { isPointing } from './gestures.js';
import { sfx } from './audio.js';
import { renderBoard, saveScore, clearScores } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const MOUSE_MODE = params.has('mouse'); // ?mouse=1 -> play with a mouse (no camera), great for testing

const app = $('app');
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const video = $('cam');
const startScreen = $('startScreen');
const startBtn = $('startBtn');
const startMsg = $('startMsg');
const resultScreen = $('resultScreen');
const nameInput = $('nameInput');
const boardList = $('boardList');
const toast = $('toast');

const game = new Game();
let hasCamera = false;

/* ------------------------------------------------------------------ */
/* Person cut-out (camera pixels where a person is, drawn over a world) */
/* ------------------------------------------------------------------ */

const maskCanvas = document.createElement('canvas');
maskCanvas.width = W;
maskCanvas.height = H;
const maskCtx = maskCanvas.getContext('2d');
const personCanvas = document.createElement('canvas');
personCanvas.width = W;
personCanvas.height = H;
const personCtx = personCanvas.getContext('2d');
let hasMask = false;

const media = {
  drawVideo(c) {
    if (hasCamera) {
      c.save();
      c.translate(W, 0);
      c.scale(-1, 1); // mirror so it feels like a mirror
      c.drawImage(video, 0, 0, W, H);
      c.restore();
    } else {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1a1f3a');
      g.addColorStop(1, '#2d1b4e');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
  },
  drawPerson(c) {
    if (!hasCamera || !hasMask) return;
    personCtx.globalCompositeOperation = 'source-over';
    personCtx.clearRect(0, 0, W, H);
    personCtx.drawImage(maskCanvas, 0, 0, W, H);
    personCtx.globalCompositeOperation = 'source-in';
    personCtx.drawImage(video, 0, 0, W, H);
    c.save();
    c.translate(W, 0);
    c.scale(-1, 1);
    c.drawImage(personCanvas, 0, 0);
    c.restore();
  },
};

/* ------------------------------------------------------------------ */
/* Input: MediaPipe hands (or the mouse in ?mouse=1 mode)              */
/* ------------------------------------------------------------------ */

let latestHands = [];
const mouse = { x: W / 2, y: H / 2, down: false, inside: false };

function getHands() {
  if (MOUSE_MODE) {
    if (!mouse.inside) return [];
    const p = { x: mouse.x, y: mouse.y };
    return [{ tips: [p], index: p, palm: p, pointing: mouse.down }];
  }
  return latestHands;
}

function onHandResults(results) {
  const out = [];
  for (const lm of results.multiHandLandmarks || []) {
    const pts = lm.map((p) => ({ x: (1 - p.x) * W, y: p.y * H })); // mirrored, in canvas pixels
    out.push({
      tips: [4, 8, 12, 16, 20].map((i) => pts[i]),
      index: pts[8],
      palm: pts[9],
      pointing: isPointing(lm),
    });
  }
  latestHands = out;
}

if (MOUSE_MODE) {
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) * W) / r.width;
    mouse.y = ((e.clientY - r.top) * H) / r.height;
  };
  canvas.addEventListener('mousemove', (e) => {
    toCanvas(e);
    mouse.inside = true;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.inside = false;
    mouse.down = false;
  });
  canvas.addEventListener('mousedown', () => (mouse.down = true));
  window.addEventListener('mouseup', () => (mouse.down = false));
}

/* ------------------------------------------------------------------ */
/* Camera + MediaPipe setup                                            */
/* ------------------------------------------------------------------ */

let hands = null;
let selfie = null;

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  hasCamera = true;
}

async function setupMediaPipe() {
  if (typeof Hands === 'undefined' || typeof SelfieSegmentation === 'undefined') {
    throw new Error('MediaPipe failed to load. Check your internet connection and refresh.');
  }
  hands = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: CONFIG.modelComplexity,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
  hands.onResults(onHandResults);

  selfie = new SelfieSegmentation({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${f}`,
  });
  selfie.setOptions({ modelSelection: 1 });
  selfie.onResults((r) => {
    maskCtx.clearRect(0, 0, W, H);
    maskCtx.drawImage(r.segmentationMask, 0, 0, W, H);
    hasMask = true;
  });

  await Promise.all([hands.initialize(), selfie.initialize()]);
}

async function trackLoop() {
  for (;;) {
    if (video.readyState >= 2) {
      try {
        if (game.needsPerson()) await selfie.send({ image: video });
        await hands.send({ image: video });
      } catch (err) {
        console.error(err);
      }
    }
    await new Promise(requestAnimationFrame);
  }
}

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */

let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  game.update(dt, getHands(), now);
  game.render(ctx, media);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

let resultTimer = null;

game.onStateChange = (s) => {
  app.dataset.state = s;
  if (s === 'idle') hasMask = false; // don't show a stale cut-out next time
};

game.onEnd = ({ score, era, maxCombo, collected }) => {
  $('resultEra').textContent = `${era.emoji} ${era.name}`;
  $('resultScore').textContent = score;
  $('resultStats').textContent = `${collected} crystals · best combo ${maxCombo}`;
  nameInput.value = '';
  resultScreen.classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 100);
  clearTimeout(resultTimer);
  resultTimer = setTimeout(closeResult, CONFIG.resultTimeoutMs);
};

function closeResult() {
  clearTimeout(resultTimer);
  resultScreen.classList.add('hidden');
  game.reset();
}

function saveAndClose() {
  const name = nameInput.value.trim().slice(0, 16) || 'Traveler';
  saveScore({ name, score: game.score, era: game.era ? game.era.name : '', ts: Date.now() });
  renderBoard(boardList);
  closeResult();
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function takePhoto() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0);
  const label = game.era
    ? `${game.era.emoji} I time-traveled to ${game.era.name}!` + (game.score ? `  ⭐ ${game.score}` : '')
    : '🌀 WaveWrap';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, H - 70, W, 70);
  g.fillStyle = '#fff';
  g.font = "800 30px 'Segoe UI', system-ui, sans-serif";
  g.textBaseline = 'middle';
  g.fillText(label, 24, H - 35);
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wavewrap-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
  game.flash = 0.8;
  sfx.select();
  showToast('📸 Photo saved!');
}

$('saveBtn').addEventListener('click', saveAndClose);
$('skipBtn').addEventListener('click', closeResult);
$('photoResultBtn').addEventListener('click', takePhoto);
$('photoBtn').addEventListener('click', takePhoto);
$('fullBtn').addEventListener('click', toggleFullscreen);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveAndClose();
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else app.requestFullscreen?.();
}

window.addEventListener('keydown', (e) => {
  if (e.target === nameInput) return;
  const k = e.key.toLowerCase();
  if (k === 'p') takePhoto();
  else if (k === 'f') toggleFullscreen();
  else if (k === ' ') {
    e.preventDefault();
    game.openPortal(); // operator fallback: open the portal without the circle gesture
  } else if (['1', '2', '3'].includes(k)) game.chooseEra(Number(k) - 1);
  else if (k === 'escape' && game.state !== 'idle') closeResult();
  else if (k === 'r' && e.shiftKey && confirm('Clear the whole leaderboard?')) {
    clearScores();
    renderBoard(boardList);
  }
});

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

startBtn.addEventListener('click', async () => {
  sfx.unlock();
  startBtn.disabled = true;
  try {
    if (!MOUSE_MODE) {
      startMsg.textContent = 'Starting camera…';
      await setupCamera();
      startMsg.textContent = 'Loading hand-tracking models (first time takes a few seconds)…';
      await setupMediaPipe();
      trackLoop();
    }
    startScreen.classList.add('hidden');
    showToast(MOUSE_MODE ? 'Mouse mode: hold the button and draw a circle' : 'Ready! Draw a circle in the air');
  } catch (err) {
    console.error(err);
    startMsg.textContent = `⚠️ ${err.message || err}. Allow camera access, use Chrome, and open via localhost or https.`;
    startBtn.disabled = false;
  }
});

renderBoard(boardList);
app.dataset.state = 'idle';
if (MOUSE_MODE) startMsg.textContent = 'Mouse mode (no camera): hold the mouse button and draw a circle.';
requestAnimationFrame(frame);
