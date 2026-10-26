# 🌀 WaveWrap

A webcam hand-gesture game. **Draw a circle in the air** to open a time portal, pick an era with your fingertip, then **catch glowing crystals with your bare hands** before time runs out.

Draw a circle. Wrap time.

Built with plain HTML/CSS/JavaScript and [MediaPipe](https://developers.google.com/mediapipe). No backend, no build step, no image assets.

## How to play

1. ☝️ Point with one finger and **draw a circle** in the air. A portal opens.
2. 🚪 Hold your fingertip on a **door** (Dinosaur Age, Deep Space, Future City).
3. 💎 You are cut out of the camera feed and placed inside that world. Touch crystals with your hands for 30 seconds.
   - Normal crystal: **+10**
   - Golden crystal: **+30 and +2 seconds**
   - Dark spiky orb: **-15 and your combo resets**
   - Chain pickups for a **combo multiplier** (up to x3)
4. 💾 Enter your name for the **Top Wave Wrappers** leaderboard, and take a 📸 photo.

## Run it

Camera access only works on `localhost` or `https`, so you can't just double-click `index.html`.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000 in Chrome
```

(Any static server works: `npx serve`, VS Code Live Server, etc.)

An internet connection is needed the first time, because MediaPipe loads from a CDN.

### Host it free on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.**
3. Open `https://<your-username>.github.io/<repo-name>/` (https, so the camera works).

### No camera? Mouse mode

Open `http://localhost:8000/?mouse=1`. Hold the mouse button and draw a circle; the pointer replaces your fingertip. Handy for developing and debugging.

## Keyboard shortcuts (for the expo operator)

| Key | Action |
| --- | --- |
| `Space` | Open the portal without drawing a circle |
| `1` `2` `3` | Pick an era without using the doors |
| `P` | Save a photo (PNG) |
| `F` | Fullscreen |
| `Esc` | Back to the start screen |
| `Shift + R` | Clear the leaderboard |

## Project structure

```
wavewrap/
├── index.html          page + overlays
├── css/style.css       layout and styling
└── js/
    ├── main.js         webcam, MediaPipe, render loop, UI wiring
    ├── game.js         game states, crystals, scoring, HUD drawing
    ├── gestures.js     smoothing, pointing pose, circle detector
    ├── worlds.js       the 3 procedurally drawn worlds
    ├── audio.js        synthesized sound effects
    ├── leaderboard.js  top-10 scores in localStorage
    └── config.js       all tunable numbers + the list of eras
```

## Tweaking

Everything lives in `js/config.js`:

- Round length, spawn speed, crystal size, chance of gold / hazard
- `circle.*`: how strict the circle gesture is (loosen `maxRadiusVar` and `closeRatio` if it is hard to trigger)
- `smoothing`: lower = steadier fingertip, higher = more responsive
- `modelComplexity`: `0` is fast, `1` is more accurate (needs a stronger laptop)

### Add your own era

1. Add an entry to `ERAS` in `config.js` (id, name, emoji, colors).
2. Add a `buildXxx` and `animXxx` function in `worlds.js` and register them in the `builders` / `animators` maps.
3. Add a door position in `game.js` (`DOORS` is generated from `ERAS`, so 3 to 4 eras fit nicely).

Or replace a world with a photo: in `drawWorld`, draw an `Image` instead of the procedural layer.

## Expo tips

- Light the player from the front, avoid a bright window behind them.
- Leave about 1.5 to 2 m between the player and the camera so both hands fit.
- Use a big screen or projector, Chrome, fullscreen (`F`), and a laptop with a decent CPU/GPU.
- Test at the venue beforehand: lighting changes tracking quality.
- Round length is 30 s, so a queue moves quickly.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "MediaPipe failed to load" | Check the internet connection, refresh |
| Camera doesn't start | Allow camera permission; use `localhost` or `https`; close other apps using the camera |
| Circle is not detected | Use a pointing pose (index out, other fingers curled), draw a bigger, rounder circle, or loosen `circle.*` in config |
| Laggy | Keep `modelComplexity: 0`, close other tabs, use Chrome |
| Person cut-out looks rough | Better lighting and a plain background help |

## Credits

- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) and Selfie Segmentation by Google.

## License

MIT, see [LICENSE](LICENSE).
