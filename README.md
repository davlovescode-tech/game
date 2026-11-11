# Bhaag Brainrot

3D chase game. Floating faces hunt you. Hang out in the lobby, grab snacks from the stalls, outlive the bots.
Plain HTML + three.js (loaded from a CDN), no build step.

## How it plays
- **Title page** -> press PLAY -> you land in the **lobby** and stay there until the round starts (20 s).
- **Lobby:** explore freely. Visit **Ganne ka Juice** (+speed at round start) and **Ahmed Bhai ki Chaat** (a one-hit shield). Press **E** (or the on-screen button) near a stall. **Daviccino** watches over everything and pops up whenever he feels like it.
- **Round:** about 35 s. Touch a floating face and you are out. Survive longer = more points. Daviccino may throw random events at you.
- **Camera:** drag to orbit, scroll or pinch to zoom, Q / R to rotate. Works in the lobby and during the round.
- **Controls:** WASD / arrows or the on-screen joystick, Space or JUMP, E to interact.
- After 2 rounds the leaderboard crowns a winner and resets.

## Add your own images and sounds
Name files with numbers, in order, no gaps, lowercase extension. The game finds them by itself.

| Folder | What it is |
|---|---|
| `assets/faces/` (`1.jpg`, `2.png` ...) | the floating faces that chase you |
| `assets/daviccino/` (`1.jpg`) | Daviccino's face and popup picture |
| `assets/sounds/start/` | plays when a round starts |
| `assets/sounds/death/` | plays when you die |
| `assets/sounds/random/` | plays now and then during a round |
| `assets/sounds/daviccino/` | plays whenever Daviccino pops up |

Images: jpg, jpeg, png, webp, gif. Sounds: mp3, ogg, wav, m4a. A random file is picked each time.
Keep images small (a few hundred KB) so phones load fast.

## Edit text and settings
`config.js` holds the death messages, Daviccino's lines, round/lobby length, number of rounds, bot count and the Instagram handle.

## Put it online with GitHub Pages
Repo **Settings > Pages**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
