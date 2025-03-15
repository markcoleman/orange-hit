/***************************************************
 * GAME STATES & VARIABLES
 ***************************************************/
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STATE = {
  START: 'START',
  GAMEPLAY: 'GAMEPLAY',
  GAMEOVER: 'GAMEOVER',
};

let currentState = STATE.START;
let gameRunning = false;
let score = 0;
let currentLevel = 1;
let keys = {};

// Track Octy's facing: +1 for right, -1 for left
let playerFacing = 1;

// Ink shooting cooldown
let lastShotTime = 0;
const SHOT_COOLDOWN = 300; // milliseconds

// DOM Elements
const uiDiv = document.getElementById('ui');
const scoreDiv = document.getElementById('score');
const levelDiv = document.getElementById('level');
const startScreenDiv = document.getElementById('startScreen');
const gameOverScreenDiv = document.getElementById('gameOverScreen');

/***************************************************
 * ASSET LOADING
 ***************************************************/
// Update paths as needed
const imgDeepOcean = new Image();
imgDeepOcean.src = 'assets/environment/bg_deep_ocean.png';

const imgCoralReef = new Image();
imgCoralReef.src = 'assets/environment/bg_coral_reef.png';

const imgSeaFloor = new Image();
imgSeaFloor.src = 'assets/environment/bg_sea_floor.png';

const imgOcty = new Image();
imgOcty.src = 'assets/player/octy_idle.png';

const imgOrangeSlice = new Image();
imgOrangeSlice.src = 'assets/items/orange_slice.png';

const imgEnemyOrange = new Image();
imgEnemyOrange.src = 'assets/enemy/orange_enemy.png';

const imgBossOrange = new Image();
imgBossOrange.src = 'assets/enemy/orange_boss.png';

const imgSeaweed = new Image();
imgSeaweed.src = 'assets/environment/seaweed.png';

// Optional ink shot image
const imgInk = new Image();
imgInk.src = 'assets/player/ink_shot.png';

/***************************************************
 * EVENT LISTENERS
 ***************************************************/
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Start screen: press ENTER to start
  if (currentState === STATE.START && e.key === 'Enter') {
    startGame();
  }
  // Game Over screen: press ENTER to return to title
  else if (currentState === STATE.GAMEOVER && e.key === 'Enter') {
    goToStartScreen();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

/***************************************************
 * PARALLAX BACKGROUND
 ***************************************************/
class BackgroundLayer {
  constructor(img, speed) {
    this.img = img;
    this.speed = speed;
    this.x = 0;
  }
  update() {
    if (!gameRunning) return;
    this.x -= this.speed;
    if (this.x <= -canvas.width) {
      this.x = 0;
    }
  }
  draw() {
    if (!this.img) return;
    ctx.drawImage(this.img, this.x, 0, canvas.width, canvas.height);
    ctx.drawImage(this.img, this.x + canvas.width, 0, canvas.width, canvas.height);
  }
}

const bgDeepOcean = new BackgroundLayer(imgDeepOcean, 0.2);
const bgCoralReef = new BackgroundLayer(imgCoralReef, 0.5);
const bgSeaFloor = new BackgroundLayer(imgSeaFloor, 1.0);

/***************************************************
 * PLAYER (OCTY)
 ***************************************************/
class Player {
  constructor() {
    this.x = 100;
    this.y = canvas.height / 2;
    this.width = 64;
    this.height = 64;
    this.speed = 3;
  }
  update() {
    if (!gameRunning) return;

    // Vertical movement
    if (keys['ArrowUp'] && this.y > 0) this.y -= this.speed;
    if (keys['ArrowDown'] && this.y + this.height < canvas.height) this.y += this.speed;

    // Horizontal movement and facing
    if (keys['ArrowLeft'] && this.x > 0) {
      this.x -= this.speed;
      playerFacing = -1;
    }
    if (keys['ArrowRight'] && this.x + this.width < canvas.width) {
      this.x += this.speed;
      playerFacing = 1;
    }

    // Shoot Ink (Space bar)
    if (keys[' '] && Date.now() - lastShotTime > SHOT_COOLDOWN) {
      shootInk();
      lastShotTime = Date.now();
    }
  }
  draw() {
    if (imgOcty.complete) {
      // Flip horizontally if facing left
      if (playerFacing < 0) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(imgOcty, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
      } else {
        ctx.drawImage(imgOcty, this.x, this.y, this.width, this.height);
      }
    } else {
      ctx.fillStyle = 'purple';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
const player = new Player();

/***************************************************
 * INK SHOTS
 ***************************************************/
class InkShot {
  constructor(x, y, direction) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.speed = 6;
    this.direction = direction; // +1: right, -1: left
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x += this.speed * this.direction;
    if (this.x < 0 || this.x > canvas.width) this.active = false;
  }
  draw() {
    if (!this.active) return;
    if (imgInk.complete) {
      if (this.direction < 0) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(imgInk, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
      } else {
        ctx.drawImage(imgInk, this.x, this.y, this.width, this.height);
      }
    } else {
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
let inkShots = [];

function shootInk() {
  const shotX = (playerFacing > 0) ? (player.x + player.width) : player.x;
  const shotY = player.y + (player.height / 2) - 8;
  inkShots.push(new InkShot(shotX, shotY, playerFacing));
}

/***************************************************
 * COLLECTIBLE ORANGE SLICES
 ***************************************************/
class Collectible {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 32;
    this.collected = false;
  }
  draw() {
    if (this.collected) return;
    if (imgOrangeSlice.complete) {
      ctx.drawImage(imgOrangeSlice, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'orange';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
let collectibles = [];

/***************************************************
 * ENEMY ORANGES
 ***************************************************/
class Enemy {
  constructor(x, y, speed) {
    this.x = x;
    this.y = y;
    this.width = 48;
    this.height = 48;
    this.speed = speed;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.alive = true;
  }
  update() {
    if (!this.alive || !gameRunning) return;
    this.x += this.speed * this.direction;
    if (this.x < 0 || this.x + this.width > canvas.width) {
      this.direction *= -1;
    }
  }
  draw() {
    if (!this.alive) return;
    if (imgEnemyOrange.complete) {
      ctx.drawImage(imgEnemyOrange, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'orange';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
let enemies = [];

/***************************************************
 * BOSS ORANGE (requires 5 ink shots to defeat)
 ***************************************************/
class Boss {
  constructor(x, y, speed) {
    this.x = x;
    this.y = y;
    this.width = 80;
    this.height = 80;
    this.speed = speed;
    this.direction = 1;
    this.alive = true;
    this.health = 5; // Requires 5 hits (ink shots) to die
  }
  update() {
    if (!this.alive || !gameRunning) return;
    this.x += this.speed * this.direction;
    if (this.x < 0 || this.x + this.width > canvas.width) {
      this.direction *= -1;
    }
  }
  draw() {
    if (!this.alive) return;
    if (imgBossOrange.complete) {
      ctx.drawImage(imgBossOrange, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'darkorange';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
let boss = null;

/***************************************************
 * SEAWEED
 ***************************************************/
class Seaweed {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 64;
  }
  draw() {
    if (imgSeaweed.complete) {
      ctx.drawImage(imgSeaweed, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'green';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
let seaweeds = [];

/***************************************************
 * COLLISION DETECTION
 ***************************************************/
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/***************************************************
 * SAFE SPAWN HELPER
 ***************************************************/
// Returns coordinates that don't overlap with the player.
function getSafeSpawnPosition(objWidth, objHeight) {
  let x, y;
  let attempts = 0;
  const maxAttempts = 100;
  do {
    x = Math.random() * (canvas.width - objWidth);
    y = Math.random() * (canvas.height - objHeight);
    attempts++;
    if (attempts > maxAttempts) break;
  } while (
    isColliding(
      { x, y, width: objWidth, height: objHeight },
      { x: player.x, y: player.y, width: player.width, height: player.height }
    )
  );
  return { x, y };
}

/***************************************************
 * LEVEL INIT
 ***************************************************/
function initLevel(level) {
  collectibles = [];
  enemies = [];
  seaweeds = [];
  inkShots = [];
  boss = null;

  // Spawn collectibles
  for (let i = 0; i < 5 + level; i++) {
    const x = Math.random() * (canvas.width - 32);
    const y = Math.random() * (canvas.height - 100) + 20;
    collectibles.push(new Collectible(x, y));
  }

  // Spawn enemy oranges (using safe spawn)
  for (let i = 0; i < 3 + level; i++) {
    const { x, y } = getSafeSpawnPosition(48, 48);
    const speed = 1 + Math.random();
    enemies.push(new Enemy(x, y, speed));
  }

  // Spawn seaweed (random near bottom)
  for (let i = 0; i < 4; i++) {
    const sx = Math.random() * (canvas.width - 32);
    const sy = canvas.height - 64;
    seaweeds.push(new Seaweed(sx, sy));
  }
}

/***************************************************
 * GAME LOOP
 ***************************************************/
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (!gameRunning) return;

  // Update backgrounds
  bgDeepOcean.update();
  bgCoralReef.update();
  bgSeaFloor.update();

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw backgrounds
  bgDeepOcean.draw();
  bgCoralReef.draw();
  bgSeaFloor.draw();

  // Draw seaweed
  seaweeds.forEach(s => s.draw());

  // Update & draw ink shots
  inkShots.forEach(shot => {
    shot.update();
    shot.draw();
  });

  // Check ink collision with enemies
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    inkShots.forEach(shot => {
      if (shot.active && isColliding(shot, enemy)) {
        shot.active = false;
        enemy.alive = false;
        score += 5;
      }
    });
  });

  // If all enemies are eliminated and boss is not spawned, spawn the boss now.
  if (!boss && enemies.every(e => !e.alive)) {
    const { x: bx, y: by } = getSafeSpawnPosition(80, 80);
    boss = new Boss(bx, by, 1 + currentLevel * 0.5);
  }

  // Check ink collision with boss (if boss exists)
  if (boss && boss.alive) {
    inkShots.forEach(shot => {
      if (shot.active && isColliding(shot, boss)) {
        shot.active = false;
        boss.health -= 1;
        if (boss.health <= 0) {
          boss.alive = false;
          score += 10;
        }
      }
    });
  }

  // Update & draw enemies
  enemies.forEach(e => {
    e.update();
    e.draw();
    if (e.alive && isColliding(player, e)) {
      const hiding = seaweeds.some(s => isColliding(player, s));
      if (!hiding) endGame(false);
    }
  });

  // Update & draw boss
  if (boss && boss.alive) {
    boss.update();
    boss.draw();
    if (isColliding(player, boss)) {
      const hiding = seaweeds.some(s => isColliding(player, s));
      if (!hiding) endGame(false);
    }
  }

  // Update & draw collectibles
  collectibles.forEach(c => {
    c.draw();
    if (!c.collected && isColliding(player, c)) {
      c.collected = true;
      score += 10;
    }
  });

  // Update & draw player
  player.update();
  player.draw();

  // Level complete if all collectibles are collected and boss is defeated
  const allCollected = collectibles.every(c => c.collected);
  const bossDefeated = !boss || !boss.alive;
  if (allCollected && bossDefeated) {
    currentLevel++;
    if (currentLevel > 5) {
      endGame(true); // Victory
    } else {
      initLevel(currentLevel);
    }
  }

  updateUI();
}

/***************************************************
 * UI & GAME FLOW
 ***************************************************/
function updateUI() {
  scoreDiv.innerText = 'Score: ' + score;
  levelDiv.innerText = 'Level: ' + currentLevel;
}

function startGame() {
  currentState = STATE.GAMEPLAY;
  gameRunning = true;
  score = 0;
  currentLevel = 1;
  player.x = 100;
  player.y = canvas.height / 2;

  startScreenDiv.classList.add('hidden');
  gameOverScreenDiv.classList.add('hidden');
  uiDiv.style.display = 'block';

  initLevel(currentLevel);
}

function endGame(win) {
  gameRunning = false;
  currentState = STATE.GAMEOVER;
  gameOverScreenDiv.classList.remove('hidden');
  // Optionally, adjust the game over screen based on win/lose
}

function goToStartScreen() {
  currentState = STATE.START;
  startScreenDiv.classList.remove('hidden');
  gameOverScreenDiv.classList.add('hidden');
  uiDiv.style.display = 'none';
}

function init() {
  goToStartScreen();
  gameLoop(); // Always running; game logic is gated by gameRunning.
}

init();