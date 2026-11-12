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


## Bigger arena, 10+ squares, per-square sounds
- There are always at least 10 different squares (8 at round start, growing to 14). Change `squaresStart`, `squaresMax`, `squaresRampEvery` in `config.js`.
- Square N uses `assets/faces/N.jpg` and its own death sound `assets/sounds/faces/N.mp3` (mp3/ogg/wav/m4a). Missing face = emoji placeholder; missing sound = a unique synth blip.

## Multiplayer (room code)
1. One player types a name and taps **CREATE ROOM** -> gets a 5-letter code (tap the ROOM chip to copy an invite link).
2. Others type the code (or open the `?room=CODE` link) and tap **JOIN**.
- Up to 8 humans per room, plus `mpBots` fake players. The host's browser runs the game; if the host leaves, the room ends.
- Joining mid-round waits for the next lobby. Uses the free public PeerJS server (WebRTC); players on very strict networks may need a TURN server (`iceServers` in `config.js`).
- Admin commands only work for the host.
