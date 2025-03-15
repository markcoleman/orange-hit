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
let playerFacing = 1; // +1 for right, -1 for left

// For ink shooting cooldown
let lastShotTime = 0;
const SHOT_COOLDOWN = 300; // ms between shots

// DOM Elements
const uiDiv = document.getElementById('ui');
const scoreDiv = document.getElementById('score');
const levelDiv = document.getElementById('level');
const startScreenDiv = document.getElementById('startScreen');
const gameOverScreenDiv = document.getElementById('gameOverScreen');

/***************************************************
 * ASSET LOADING
 ***************************************************/
// Adjust paths to match your folder structure
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

// Optional: If you have an ink sprite
const imgInk = new Image();
imgInk.src = 'assets/player/ink_shot.png';

/***************************************************
 * EVENT LISTENERS
 ***************************************************/
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Start screen -> Press Enter to start
  if (currentState === STATE.START && e.key === 'Enter') {
    startGame();
  }
  // Game Over screen -> Press Enter to return to title
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

    // Movement
    if (keys['ArrowUp'] && this.y > 0) this.y -= this.speed;
    if (keys['ArrowDown'] && this.y + this.height < canvas.height) this.y += this.speed;

    // Track horizontal facing
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
      // If we want to flip Octy when facing left, we can do so with canvas transforms:
      if (playerFacing < 0) {
        // Flip horizontally
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(imgOcty, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
      } else {
        // Normal draw
        ctx.drawImage(imgOcty, this.x, this.y, this.width, this.height);
      }
    } else {
      // Fallback
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
    this.direction = direction; // +1 for right, -1 for left
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x += this.speed * this.direction;
    // Deactivate if off-screen
    if (this.x < 0 || this.x > canvas.width) {
      this.active = false;
    }
  }
  draw() {
    if (!this.active) return;
    if (imgInk.complete) {
      // Similar flipping if facing left
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
      // Fallback: small black circle
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
let inkShots = [];

// Helper function to shoot
function shootInk() {
  // Create a new shot from player's position
  const shotX = playerFacing > 0 ? player.x + player.width : player.x;
  const shotY = player.y + player.height / 2 - 8; // center the shot
  const newShot = new InkShot(shotX, shotY, playerFacing);
  inkShots.push(newShot);
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
 * BOSS ORANGE
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
 * LEVEL INIT
 ***************************************************/
function initLevel(level) {
  collectibles = [];
  enemies = [];
  seaweeds = [];
  inkShots = [];
  boss = null;

  // Place collectibles
  for (let i = 0; i < 5 + level; i++) {
    const x = Math.random() * (canvas.width - 32);
    const y = Math.random() * (canvas.height - 100) + 20;
    collectibles.push(new Collectible(x, y));
  }

  // Place enemies
  for (let i = 0; i < 3 + level; i++) {
    const x = Math.random() * (canvas.width - 48);
    const y = Math.random() * (canvas.height - 120) + 50;
    const speed = 1 + Math.random();
    enemies.push(new Enemy(x, y, speed));
  }

  // Place seaweed
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * (canvas.width - 32);
    const y = canvas.height - 64;
    seaweeds.push(new Seaweed(x, y));
  }

  // Boss
  boss = new Boss(
    canvas.width - 100,
    Math.random() * (canvas.height - 100) + 50,
    1 + level * 0.5
  );
}

/***************************************************
 * GAME LOOP
 ***************************************************/
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (!gameRunning) return; // If we're on start or game over, skip logic

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
  seaweeds.forEach((s) => s.draw());

  // Update & draw ink shots
  inkShots.forEach((shot) => {
    shot.update();
    shot.draw();
  });

  // Check ink collision with enemies
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    inkShots.forEach((shot) => {
      if (shot.active && isColliding(shot, enemy)) {
        shot.active = false;
        enemy.alive = false;
        score += 5; // points for killing an enemy
      }
    });
  });

  // Check ink collision with boss
  if (boss && boss.alive) {
    inkShots.forEach((shot) => {
      if (shot.active && isColliding(shot, boss)) {
        shot.active = false;
        boss.alive = false;
        score += 10; // more points for killing the boss
      }
    });
  }

  // Update & draw enemies
  enemies.forEach((e) => {
    e.update();
    e.draw();
    // If colliding with player (and alive)
    if (e.alive && isColliding(player, e)) {
      // Check if hiding behind seaweed
      let hiding = seaweeds.some((s) => isColliding(player, s));
      if (!hiding) {
        endGame(false);
      }
    }
  });

  // Update & draw boss
  if (boss && boss.alive) {
    boss.update();
    boss.draw();
    if (isColliding(player, boss)) {
      let hiding = seaweeds.some((s) => isColliding(player, s));
      if (!hiding) {
        endGame(false);
      }
    }
  }

  // Update & draw collectibles
  collectibles.forEach((c) => {
    c.draw();
    if (!c.collected && isColliding(player, c)) {
      c.collected = true;
      score += 10;
    }
  });

  // Update & draw player
  player.update();
  player.draw();

  // Check if level complete (all collectibles) and boss not alive
  const allCollected = collectibles.every((c) => c.collected);
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
  // If you want a separate “You Win!” screen, you can swap out the image or add logic here.
}

function goToStartScreen() {
  currentState = STATE.START;
  startScreenDiv.classList.remove('hidden');
  gameOverScreenDiv.classList.add('hidden');
  uiDiv.style.display = 'none';
}

function init() {
  goToStartScreen();
  gameLoop();
}

init();