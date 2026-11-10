# Bhaag Brainrot 3D

Run from the floating squares. Last one standing wins. Plain HTML + three.js, no build step.

## Add your images
Drop pictures into `assets/faces/` and name them `1.jpg`, `2.jpg`, `3.png` ... in order, no gaps.
(jpg, jpeg, png, webp or gif, lowercase extension.) With none added, built-in cartoon faces are used.

## Add your sounds
| Folder | When it plays |
|---|---|
| `assets/sounds/start/` | round starts |
| `assets/sounds/death/` | you die |
| `assets/sounds/random/` | now and then during a round |

Name files `1.mp3`, `2.mp3` ... in order, no gaps (mp3, ogg, wav or m4a). A random one is picked each time.

## Death messages and settings
Edit `config.js` (messages, round length, number of rounds, bots).

## Put it online with GitHub Pages
1. Create a repo and upload everything in this folder (keep the `assets` folders).
2. Repo **Settings > Pages > Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
3. Open the link GitHub shows after a minute.

Vercel also works: import the repo, no settings needed.
