// ============================================================
//  GAME SETTINGS  (the only file you may need to edit)
//
//  ADD IMAGES  (the floating squares that chase you):
//    Put pictures in  assets/faces/  and name them  1.jpg  2.jpg  3.png ...
//    Numbers must be in order, no gaps. jpg, jpeg, png, webp or gif, lowercase extension.
//
//  ADD SOUNDS:
//    assets/sounds/start/   -> plays when a round starts   (1.mp3, 2.mp3, ...)
//    assets/sounds/death/   -> plays when YOU die          (1.mp3, 2.mp3, ...)
//    assets/sounds/random/  -> plays randomly during a round
//    A random file from the folder is picked each time. mp3, ogg, wav or m4a.
//
//  That's it. Upload to GitHub and the game finds your files by itself.
// ============================================================
window.GAME_CONFIG = {
  title: "BHAAG BRAINROT 3D",

  roundSeconds: 35,      // length of one round
  lobbySeconds: 10,      // lobby countdown between rounds
  roundsPerGame: 2,      // leaderboard shows this many rounds, then resets
  botCount: 7,           // fake players

  // A different message is shown every time anyone dies (all get used before any repeats).
  // Add or remove lines freely.
  deathMessages: [
    "Ghee khatam",
    "Ghar jake sutti babu",
    "Data khatam khel khatam",
    "Ahmed bhai ki chaat looo",
    "Mistri maan jaooo",
    "Modified hai ji",
    "Aapkke parents apko game khelna nhi sikhate ",
    "Ye le LOL emote wo bhi hayato mode ke saath "
  ],

  sounds: {
    randomChance: 0.6,   // chance (0 to 1) that a "start" sound plays at round start
    randomEveryMin: 8,   // seconds between "random" sounds, minimum
    randomEveryMax: 16   // seconds between "random" sounds, maximum
  },

  botNames: ["Bunty_OP","Sigma_Sonu","PinkyPro","RockyBhai","TinkuGamer","Gullu_Pro","ChintuX","Monu_King","Babli_Queen","Golu_Zone"]
};
