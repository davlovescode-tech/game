// ============================================================
//  GAME SETTINGS  (the only file you may need to edit)
//
//  ADD IMAGES  (the floating squares that chase you):
//    Put pictures in  assets/faces/  named  1.jpg  2.jpg  3.png ...  (in order, no gaps)
//
//  DAVICCINO'S FACE (optional):
//    Put ONE picture in  assets/daviccino/  named  1.jpg  (or png/webp). It becomes
//    his face in the lobby and his picture in the popups.
//
//  ADD SOUNDS  (mp3, ogg, wav or m4a, named 1.mp3  2.mp3 ... in order):
//    assets/sounds/start/      plays when a round starts
//    assets/sounds/death/      plays when YOU die
//    assets/sounds/random/     plays now and then during a round
//    assets/sounds/daviccino/  plays whenever Daviccino pops up
//    A random file from the folder is picked each time.
//
//  Upload to GitHub and the game finds your files by itself.
// ============================================================
window.GAME_CONFIG = {
  title: "BHAAG BRAINROT",
  insta: "lowkeytuffdav",     // shown on the title page and in-game

  roundSeconds: 35,           // length of one round
  lobbySeconds: 40,           // time everyone hangs out in the lobby before each round
  roundsPerGame: 3,           // leaderboard shows this many rounds, then resets
  botCount: 7,                // fake players

  // A different message is shown every time anyone dies (all get used before any repeats).
  deathMessages: [
    "Ghee khatam",
    "Ghar jake sutti babu",
    "Data khatam khel khatam",
    "Ahmed bhai ki chaat looo",
    "Mistri maan jaooo",
    "Modified hai ji",
    "Aapkke parents apko game khelna nhi sikhate ",
    "Ye le LOL emote wo bhi hayato mode ke saath ",
    "Jad buddhi" 
  ],

  // Daviccino pops up with these at random (in the lobby and on the title page).
  daviccinoLines: [
    "I am Daviccino. I see everything. 👁️",
    "Aura check: you have none 💀",
    "R stands for Rizz 😎",
    "Bro really thought he could outrun me",
    "Ganne ka juice peelo, speed badhegi 🥤",
    "Ahmed bhai ki chaat = shield, trust me 🛡️",
    "Skill issue detected. Daviccino disapproves.",
    "Sigma grindset: don't touch the squares",
    "Follow @lowkeytuffdav or the squares get faster",
    "Main hi hoon Daviccino, sab meri maaya hai 🌀"
  ],

  daviccinoEvents: true,      // random almighty events during rounds (freeze, extra chasers, blessings...)

  sounds: {
    randomChance: 0.6,        // chance (0 to 1) that a "start" sound plays at round start
    randomEveryMin: 8,        // seconds between "random" sounds, minimum
    randomEveryMax: 16        // seconds between "random" sounds, maximum
  },

  botNames: ["Bunty_OP","Sigma_Sonu","PinkyPro","RockyBhai","TinkuGamer","Gullu_Pro","ChintuX","Monu_King","Babli_Queen","Golu_Zone"]
};
