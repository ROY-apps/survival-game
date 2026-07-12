const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// マップサイズ
const MAP_SIZE = 2000;

// 固定壁の配置
const walls = [
  // 外壁
  { x: -50, y: -50, w: MAP_SIZE + 100, h: 50 },
  { x: -50, y: MAP_SIZE, w: MAP_SIZE + 100, h: 50 },
  { x: -50, y: 0, w: 50, h: MAP_SIZE },
  { x: MAP_SIZE, y: 0, w: 50, h: MAP_SIZE },

  // 内部の壁（Raycasting用の入り組んだ迷路風）
  { x: 300, y: 300, w: 200, h: 100 },
  { x: 300, y: 400, w: 100, h: 300 },
  { x: 700, y: 200, w: 100, h: 400 },
  { x: 500, y: 800, w: 400, h: 100 },
  { x: 200, y: 1100, w: 300, h: 100 },
  { x: 200, y: 1200, w: 100, h: 300 },
  { x: 1200, y: 300, w: 400, h: 100 },
  { x: 1400, y: 400, w: 100, h: 400 },
  { x: 1100, y: 1000, w: 200, h: 200 },
  { x: 1500, y: 1100, w: 300, h: 100 },
  { x: 1500, y: 1200, w: 100, h: 300 },
  { x: 800, y: 1400, w: 400, h: 100 },
  { x: 950, y: 1500, w: 100, h: 300 }
];

const serverStartTime = Date.now();

// ゲーム状態
let gameState = {
  status: 'LOBBY', // LOBBY, SPAWN_SELECTION, START_COUNTDOWN, INGAME, GAMEOVER
  countdown: 10,
  spawnCountdown: 15,
  players: {}, // id: playerInfo
  bullets: [],
  items: [],
  safeZone: {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    r: 1200,
    targetR: 1200
  },
  winner: null
};

// アイテムのスポーン設定
const ITEM_TYPES = ['machinegun', 'shotgun', 'knife', 'ghillie', 'medkit'];
const ITEM_SPAWN_COUNTS = {
  machinegun: 3,
  shotgun: 3,
  knife: 2,
  ghillie: 1, // レアアイテム
  medkit: 4
};

// 武器設定
const WEAPONS = {
  fist: { damage: 20, cooldown: 500, range: 60, speed: 0, spread: 0 },
  machinegun: { damage: 34, cooldown: 150, range: 800, speed: 18, spread: 0.2 },
  shotgun: { damage: 100, cooldown: 1000, range: 160, speed: 22, spread: 0 },
  knife: { damage: 100, cooldown: 1000, range: 35, speed: 0, spread: 0 } // 接触自動発動
};

let countdownInterval = null;
let gameLoopInterval = null;
let safeZoneTimer = 0;

// 壁と衝突しないランダムな位置を取得
function getRandomPosition() {
  let x, y, ok;
  let attempts = 0;
  while (attempts < 200) {
    x = Math.random() * (MAP_SIZE - 200) + 100;
    y = Math.random() * (MAP_SIZE - 200) + 100;
    ok = true;
    for (let wall of walls) {
      let margin = 40;
      if (x > wall.x - margin && x < wall.x + wall.w + margin &&
          y > wall.y - margin && y < wall.y + wall.h + margin) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, y };
    attempts++;
  }
  return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
}

// 円と長方形の衝突判定
function checkCircleRectCollision(circle, rect) {
  let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

  let distanceX = circle.x - closestX;
  let distanceY = circle.y - closestY;
  let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

  if (distanceSquared < circle.r * circle.r) {
    let distance = Math.sqrt(distanceSquared);
    let overlap = circle.r - distance;
    let nx = 0, ny = 0;
    if (distance === 0) {
      nx = 1;
      ny = 0;
      overlap = circle.r;
    } else {
      nx = distanceX / distance;
      ny = distanceY / distance;
    }
    return { nx, ny, overlap };
  }
  return null;
}

// 接続中のアクティブプレイヤー数をカウント
function getActivePlayerCount() {
  return Object.values(gameState.players).filter(p => !p.isSpectator && !p.dead).length;
}

// ロビーにいる全プレイヤーの数をカウント
function getLobbyPlayerCount() {
  return Object.values(gameState.players).filter(p => !p.isSpectator).length;
}

// ゲームスタート
function startGame() {
  gameState.status = 'INGAME';
  gameState.bullets = [];
  gameState.items = [];
  gameState.safeZone = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    r: 1200,
    targetR: 1200
  };
  gameState.winner = null;
  safeZoneTimer = 0;

  // プレイヤーを初期化・スポーン
  for (let id in gameState.players) {
    let p = gameState.players[id];
    if (!p.isSpectator) {
      if (p.spawnTarget) {
        p.x = p.spawnTarget.x;
        p.y = p.spawnTarget.y;
      } else {
        let pos = getRandomPosition();
        p.x = pos.x;
        p.y = pos.y;
      }
      p.hp = 100;
      p.weapon = 'fist';
      p.hasGhillie = false;
      p.dead = false;
      p.lastShotTime = 0;
    }
  }

  // アイテムスポーン
  for (let type of ITEM_TYPES) {
    let count = ITEM_SPAWN_COUNTS[type];
    for (let i = 0; i < count; i++) {
      let pos = getRandomPosition();
      gameState.items.push({
        id: Math.random().toString(36).substr(2, 9),
        x: pos.x,
        y: pos.y,
        type: type
      });
    }
  }

  io.emit('gameStart', {
    safeZone: gameState.safeZone,
    items: gameState.items
  });
}

// ゲーム終了判定
function checkGameOver() {
  if (gameState.status !== 'INGAME') return;

  let alivePlayers = Object.values(gameState.players).filter(p => !p.isSpectator && !p.dead);
  
  // 生存者が1人以下なら終了
  if (alivePlayers.length <= 1) {
    gameState.status = 'GAMEOVER';
    let winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
    gameState.winner = winner ? { id: winner.id, name: winner.name } : null;

    io.emit('gameOver', { winner: gameState.winner });

    // 投票的中判定
    if (winner) {
      for (let id in gameState.players) {
        let p = gameState.players[id];
        if (p.isSpectator && p.voteFor === winner.id) {
          io.to(id).emit('voteSuccess');
        }
      }
    }

    // 自動でのロビー復帰（手動ボタンでの復帰を基本とするが、誰も押さずに放置された場合のフォールバックとして30秒後に強制リセット）
    setTimeout(() => {
      if (gameState.status === 'GAMEOVER') {
        resetToLobby();
      }
    }, 30000);
  }
}

// ロビーへリセット
function resetToLobby() {
  gameState.status = 'LOBBY';
  gameState.countdown = 10;
  gameState.winner = null;
  gameState.bullets = [];
  gameState.items = [];

  for (let id in gameState.players) {
    let p = gameState.players[id];
    p.dead = false;
    p.hp = 100;
    p.weapon = 'fist';
    p.hasGhillie = false;
    p.voteFor = null; // 投票リセット
    p.ready = false; // 準備状態リセット
    // 観戦者として入っていた人はそのまま観戦者、死亡したプレイヤーはプレイヤーに戻る
    if (p.wasSpectator) {
      p.isSpectator = true;
    } else {
      p.isSpectator = false;
    }
  }

  io.emit('lobbyUpdate', {
    status: gameState.status,
    players: gameState.players,
    countdown: gameState.countdown,
    serverStartTime
  });

  startLobbyCountdown();
}

// ロビーカウントダウン開始
function startLobbyCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    let activePlayers = Object.values(gameState.players).filter(p => !p.isSpectator);
    let playerCount = activePlayers.length;
    let allReady = playerCount >= 2 && activePlayers.every(p => p.ready);

    if (allReady) {
      gameState.countdown--;
      io.emit('countdown', gameState.countdown);

      if (gameState.countdown <= 0) {
        clearInterval(countdownInterval);
        startSpawnSelection();
      }
    } else {
      gameState.countdown = 10;
      io.emit('countdown', -1); // 人数不足または準備未完了で待機中
    }
  }, 1000);
}

// スポーン選択開始
function startSpawnSelection() {
  gameState.status = 'SPAWN_SELECTION';
  gameState.spawnCountdown = 15;
  
  // プレイヤーのスポーン選択初期化
  Object.values(gameState.players).forEach(p => {
    p.spawnTarget = null;
  });

  io.emit('spawnSelectionStart', { duration: gameState.spawnCountdown });

  let spawnInterval = setInterval(() => {
    gameState.spawnCountdown--;
    io.emit('spawnCountdown', gameState.spawnCountdown);

    // 全員が選択済みかチェック
    let activePlayers = Object.values(gameState.players).filter(p => !p.isSpectator);
    let allSelected = activePlayers.length > 0 && activePlayers.every(p => p.spawnTarget !== null);

    if (gameState.spawnCountdown <= 0 || allSelected) {
      clearInterval(spawnInterval);
      startFinalCountdown();
    }
  }, 1000);
}

// ゲーム開始前3秒カウントダウン
function startFinalCountdown() {
  gameState.status = 'START_COUNTDOWN';
  let finalCount = 3;
  io.emit('finalCountdownStart', finalCount);

  let finalInterval = setInterval(() => {
    finalCount--;
    io.emit('finalCountdownUpdate', finalCount);
    if (finalCount <= 0) {
      clearInterval(finalInterval);
      startGame();
    }
  }, 1000);
}

// ゲームループ (30fps)
function updateGame() {
  if (gameState.status !== 'INGAME') return;

  safeZoneTimer += 1 / 30;

  // 安全地帯の縮小スケジュール（遅くする）
  if (safeZoneTimer > 180) {
    gameState.safeZone.targetR = 100;
  } else if (safeZoneTimer > 120) {
    gameState.safeZone.targetR = 400;
  } else if (safeZoneTimer > 60) {
    gameState.safeZone.targetR = 800;
  }

  // じわじわ縮小
  if (gameState.safeZone.r > gameState.safeZone.targetR) {
    gameState.safeZone.r -= 0.3; // 毎フレームの縮小スピード
    if (gameState.safeZone.r < gameState.safeZone.targetR) {
      gameState.safeZone.r = gameState.safeZone.targetR;
    }
  }

  // 1. プレイヤー位置更新 & 衝突判定
  for (let id in gameState.players) {
    let p = gameState.players[id];
    if (p.isSpectator || p.dead) continue;

    // 移動処理
    if (p.input && (p.input.force > 0)) {
      let speed = 6; // 基本速度
      let angle = p.input.angle;
      let force = Math.min(p.input.force, 1.0);

      // 移動方向をプレイヤーの向きにする
      p.angle = angle;

      let dx = Math.cos(angle) * force * speed;
      let dy = Math.sin(angle) * force * speed;

      // X, Y 方向移動を適用
      p.x += dx;
      p.y += dy;

      // 壁抜け防止のための反復解決 (3回)
      for(let iter=0; iter<3; iter++) {
        for (let wall of walls) {
          let collision = checkCircleRectCollision({ x: p.x, y: p.y, r: 25 }, wall);
          if (collision) {
            // 中心から遠ざかる方向 (nx, ny) に押し出すため、+= を使うのが正解
            p.x += collision.nx * collision.overlap;
            p.y += collision.ny * collision.overlap;
          }
        }
      }

      // マップ境界内に収める
      p.x = Math.max(25, Math.min(MAP_SIZE - 25, p.x));
      p.y = Math.max(25, Math.min(MAP_SIZE - 25, p.y));
    }

    // 安全地帯ダメージ (1秒=30フレームごとに判定)
    if (Math.floor(safeZoneTimer * 30) % 30 === 0) {
      let distToCenter = Math.hypot(p.x - gameState.safeZone.x, p.y - gameState.safeZone.y);
      if (distToCenter > gameState.safeZone.r) {
        p.hp -= 5; // 安全地帯外ダメージ
        if (p.hp <= 0) {
          p.hp = 0;
          p.dead = true;
          
          if (p.hasGhillie) {
            gameState.items.push({ id: Math.random().toString(36).substr(2, 9), x: p.x, y: p.y, type: 'ghillie' });
          }

          io.emit('playerDeath', { victim: { id: p.id, name: p.name } });
          checkGameOver();
        }
      }
    }

    // ナイフの自動発動衝突判定
    if (p.weapon === 'knife') {
      let now = Date.now();
      let weaponConfig = WEAPONS.knife;
      if (now - p.lastShotTime > weaponConfig.cooldown) {
        for (let otherId in gameState.players) {
          if (otherId === id) continue;
          let other = gameState.players[otherId];
          if (other.isSpectator || other.dead) continue;

          let dist = Math.hypot(p.x - other.x, p.y - other.y);
          if (dist < weaponConfig.range + 25) { // ナイフ射程内(35px) + 相手半径(25px)
            // 自動発動で相手を即死
            other.hp = 0;
            other.dead = true;
            p.lastShotTime = now;
            
            // ナイフは1回使い切りにする（ゲームバランスの調整のため）
            p.weapon = 'fist'; 
            
            if (other.hasGhillie) {
              gameState.items.push({ id: Math.random().toString(36).substr(2, 9), x: other.x, y: other.y, type: 'ghillie' });
            }

            io.emit('shootEffect', { playerId: p.id, weapon: 'knife', x: p.x, y: p.y, angle: p.angle });
            io.emit('playerDeath', {
              victim: { id: other.id, name: other.name },
              attacker: { id: p.id, name: p.name, weapon: 'knife' }
            });
            checkGameOver();
            break; // 1回で1人攻撃
          }
        }
      }
    }

    // アイテム取得判定
    for (let i = gameState.items.length - 1; i >= 0; i--) {
      let item = gameState.items[i];
      let dist = Math.hypot(p.x - item.x, p.y - item.y);
      if (dist < 25 + 15) { // プレイヤー半径(25) + アイテム半径(15)
        if (item.type === 'medkit') {
          // HP回復
          if (p.hp < 100) {
            p.hp = Math.min(100, p.hp + 50);
            gameState.items.splice(i, 1);
            io.emit('itemPicked', { itemId: item.id, type: item.type, playerId: p.id });
          }
        } else if (item.type === 'ghillie') {
          // ギリースーツ取得 (ステータス付与、武器はそのまま)
          p.hasGhillie = true;
          gameState.items.splice(i, 1);
          io.emit('itemPicked', { itemId: item.id, type: item.type, playerId: p.id });
        } else {
          // 武器拾得 (素手、マシンガン、ショットガン、ナイフ)
          p.weapon = item.type;
          gameState.items.splice(i, 1);
          io.emit('itemPicked', { itemId: item.id, type: item.type, playerId: p.id });
        }
      }
    }

    // 攻撃処理（弾丸発射）
    if (p.input && p.input.shoot) {
      let now = Date.now();
      let wName = p.weapon;
      let weaponConfig = WEAPONS[wName];

      if (weaponConfig && weaponConfig.cooldown > 0 && now - p.lastShotTime > weaponConfig.cooldown) {
        p.lastShotTime = now;

        if (wName === 'fist') {
          // 素手攻撃（近接スイング判定）
          let attackAngle = p.angle;
          for (let otherId in gameState.players) {
            if (otherId === id) continue;
            let other = gameState.players[otherId];
            if (other.isSpectator || other.dead) continue;

            let dist = Math.hypot(p.x - other.x, p.y - other.y);
            if (dist < weaponConfig.range + 25) {
              let angleToOther = Math.atan2(other.y - p.y, other.x - p.x);
              let diffAngle = Math.abs(angleToOther - attackAngle);
              if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;

              if (diffAngle < 0.6) { // 約34度以内の扇形
                other.hp -= weaponConfig.damage;
                io.emit('playerHit', { id: other.id, hp: other.hp, attackerId: p.id });
                if (other.hp <= 0) {
                  other.hp = 0;
                  other.dead = true;
                  
                  if (other.hasGhillie) {
                    gameState.items.push({ id: Math.random().toString(36).substr(2, 9), x: other.x, y: other.y, type: 'ghillie' });
                  }

                  io.emit('playerDeath', {
                    victim: { id: other.id, name: other.name },
                    attacker: { id: p.id, name: p.name, weapon: 'fist' }
                  });
                  checkGameOver();
                }
              }
            }
          }
          io.emit('shootEffect', { playerId: p.id, weapon: 'fist', x: p.x, y: p.y, angle: p.angle });
        } else if (wName === 'machinegun' || wName === 'shotgun') {
          // 銃器攻撃
          if (wName === 'machinegun') {
            let angleSpread = (Math.random() - 0.5) * weaponConfig.spread;
            let shotAngle = p.angle + angleSpread;
            gameState.bullets.push({
              id: Math.random().toString(36).substr(2, 9),
              playerId: p.id,
              x: p.x + Math.cos(p.angle) * 22,
              y: p.y + Math.sin(p.angle) * 22,
              vx: Math.cos(shotAngle) * weaponConfig.speed,
              vy: Math.sin(shotAngle) * weaponConfig.speed,
              damage: weaponConfig.damage,
              range: weaponConfig.range,
              startX: p.x,
              startY: p.y
            });
          } else {
            // ショットガン (放射状に散弾を5発発射)
            for (let i = -2; i <= 2; i++) {
              let shotAngle = p.angle + (i * 0.15); // 少しずつ角度をずらす
              gameState.bullets.push({
                id: Math.random().toString(36).substr(2, 9),
                playerId: p.id,
                x: p.x + Math.cos(p.angle) * 22,
                y: p.y + Math.sin(p.angle) * 22,
                vx: Math.cos(shotAngle) * weaponConfig.speed,
                vy: Math.sin(shotAngle) * weaponConfig.speed,
                damage: weaponConfig.damage / 4, // 1発25ダメージ
                range: weaponConfig.range,
                startX: p.x,
                startY: p.y
              });
            }
          }
          io.emit('shootEffect', { playerId: p.id, weapon: wName, x: p.x, y: p.y, angle: p.angle });
        }
      }
    }
  }

  // 2. 弾丸の移動 & 衝突判定
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    let b = gameState.bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    let dist = Math.hypot(b.x - b.startX, b.y - b.startY);
    if (dist > b.range) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    let hitWall = false;
    for (let wall of walls) {
      let collision = checkCircleRectCollision({ x: b.x, y: b.y, r: 2 }, wall);
      if (collision) {
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    let hitPlayer = false;
    for (let id in gameState.players) {
      let p = gameState.players[id];
      if (p.isSpectator || p.dead || p.id === b.playerId) continue;

      let distToPlayer = Math.hypot(b.x - p.x, b.y - p.y);
      if (distToPlayer < 25) {
        p.hp -= b.damage;
        hitPlayer = true;
        
        io.emit('playerHit', { id: p.id, hp: p.hp, attackerId: b.playerId });

        if (p.hp <= 0) {
          p.hp = 0;
          p.dead = true;
          
          if (p.hasGhillie) {
            gameState.items.push({ id: Math.random().toString(36).substr(2, 9), x: p.x, y: p.y, type: 'ghillie' });
          }
          
          let attacker = gameState.players[b.playerId];
          io.emit('playerDeath', {
            victim: { id: p.id, name: p.name },
            attacker: attacker ? { id: attacker.id, name: attacker.name, weapon: attacker.weapon } : null
          });
          checkGameOver();
        }
        break;
      }
    }
    if (hitPlayer) {
      gameState.bullets.splice(i, 1);
    }
  }

  // 3. 同期
  io.emit('sync', {
    players: gameState.players,
    bullets: gameState.bullets,
    items: gameState.items,
    safeZone: gameState.safeZone,
    serverStartTime
  });
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  gameState.players[socket.id] = {
    id: socket.id,
    name: 'GUEST_' + socket.id.substr(0, 4),
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    angle: 0,
    hp: 100,
    weapon: 'fist',
    hasGhillie: false,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
    isSpectator: false,
    wasSpectator: false,
    voteFor: null,
    dead: false,
    ready: false,
    avatar: null,
    input: { angle: 0, force: 0, shoot: false }
  };

  socket.emit('initMap', { walls, mapSize: MAP_SIZE });

  io.emit('lobbyUpdate', {
    status: gameState.status,
    players: gameState.players,
    countdown: gameState.countdown,
    serverStartTime
  });

  if (gameState.status === 'LOBBY') {
    startLobbyCountdown();
  }

  socket.on('joinGame', (data) => {
    let p = gameState.players[socket.id];
    if (!p) return;

    p.name = data.name.trim().substring(0, 12) || 'PLAYER';
    if (data.avatar) {
      p.avatar = data.avatar;
    }
    
    if (data.role === 'spectator') {
      p.isSpectator = true;
      p.wasSpectator = true;
    } else {
      let activeCount = Object.values(gameState.players).filter(pl => !pl.isSpectator).length;
      if (activeCount > 8) {
        p.isSpectator = true;
        p.wasSpectator = true;
        socket.emit('roleAssign', { role: 'spectator', message: 'プレイヤー枠が満員（最大8人）のため観戦者として参加します。' });
      } else {
        p.isSpectator = false;
        p.wasSpectator = false;
        socket.emit('roleAssign', { role: 'player' });
      }
    }

    if (gameState.status === 'INGAME') {
      p.isSpectator = true;
      p.dead = true;
      socket.emit('roleAssign', { role: 'spectator', message: 'ゲームが既に開始されているため、観戦者として参加します。' });
    }

    io.emit('lobbyUpdate', {
      status: gameState.status,
      players: gameState.players,
      countdown: gameState.countdown,
      serverStartTime
    });
  });

  socket.on('vote', (data) => {
    let p = gameState.players[socket.id];
    if (p && p.isSpectator && gameState.status === 'LOBBY') {
      p.voteFor = data.targetPlayerId;
      io.emit('lobbyUpdate', {
        status: gameState.status,
        players: gameState.players,
        countdown: gameState.countdown,
        serverStartTime
      });
    }
  });

  socket.on('input', (data) => {
    let p = gameState.players[socket.id];
    if (p && !p.isSpectator && !p.dead) {
      p.input = data;
    }
  });

  socket.on('selectSpawn', (pos) => {
    let p = gameState.players[socket.id];
    if (p && !p.isSpectator && gameState.status === 'SPAWN_SELECTION') {
      p.spawnTarget = pos;
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete gameState.players[socket.id];

    let activeCount = Object.values(gameState.players).filter(p => !p.isSpectator).length;

    if (gameState.status === 'INGAME') {
      checkGameOver();
    } else if (gameState.status === 'GAMEOVER' && activeCount === 0) {
      // 誰もいなくなったら即座にロビーに戻す
      resetToLobby();
      return;
    }

    io.emit('lobbyUpdate', {
      status: gameState.status,
      players: gameState.players,
      countdown: gameState.countdown,
      serverStartTime
    });
  });

  socket.on('toggleReady', () => {
    let p = gameState.players[socket.id];
    if (p && !p.isSpectator && gameState.status === 'LOBBY') {
      p.ready = !p.ready;
      io.emit('lobbyUpdate', {
        status: gameState.status,
        players: gameState.players,
        countdown: gameState.countdown,
        serverStartTime
      });
    }
  });

  socket.on('returnToLobby', () => {
    if (gameState.status === 'GAMEOVER') {
      resetToLobby();
    }
  });
});

gameLoopInterval = setInterval(updateGame, 1000 / 30);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
