const socket = io();

// DOM要素
const startScreen = document.getElementById('startScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const errorScreen = document.getElementById('errorScreen');
const controlsOverlay = document.getElementById('controlsOverlay');

const spawnSelectionScreen = document.getElementById('spawnSelectionScreen');
const spawnTimerText = document.getElementById('spawnSec');
const spawnMapCanvas = document.getElementById('spawnMapCanvas');
const spawnStatusMsg = document.getElementById('spawnStatusMsg');

const bigCountdownScreen = document.getElementById('bigCountdownScreen');
const bigCountdownText = document.getElementById('bigCountdownText');

const bgmVol = document.getElementById('bgmVol');
const sfxVol = document.getElementById('sfxVol');
const sysVol = document.getElementById('sysVol');

const playerNameInput = document.getElementById('playerName');
const joinPlayerBtn = document.getElementById('joinPlayerBtn');
const joinSpectatorBtn = document.getElementById('joinSpectatorBtn');

const lobbyStatus = document.getElementById('lobbyStatus');
const countdownTimer = document.getElementById('countdownTimer');
const countdownSec = document.getElementById('countdownSec');
const lobbyPlayerList = document.getElementById('lobbyPlayerList');
const spectatorVoteSection = document.getElementById('spectatorVoteSection');
const votePlayerOptions = document.getElementById('votePlayerOptions');
const myVoteStatus = document.getElementById('myVoteStatus');
const lobbyPlayerCount = document.getElementById('playerCount');

const gameOverTitle = document.getElementById('gameOverTitle');
const winnerDisplay = document.getElementById('winnerDisplay');
const winnerName = document.getElementById('winnerName');
const spectatorResult = document.getElementById('spectatorResult');
const spectatorResultMsg = document.getElementById('spectatorResultMsg');
const returnToLobbyBtn = document.getElementById('returnToLobbyBtn');

const hpBar = document.getElementById('hpBar');
const hpText = document.getElementById('hpText');
const currentWeaponName = document.getElementById('currentWeaponName');
const spectatorHudInfo = document.getElementById('spectatorHudInfo');
const votedTargetDisplay = document.getElementById('votedTargetDisplay');
const votedTargetName = document.getElementById('votedTargetName');
const aliveCountText = document.getElementById('aliveCount');
const zoneWarning = document.getElementById('zoneWarning');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const openCameraBtn = document.getElementById('openCameraBtn');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const capturePhotoBtn = document.getElementById('capturePhotoBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const avatarPreviewContainer = document.getElementById('avatarPreviewContainer');
const avatarPreview = document.getElementById('avatarPreview');
const readyToggleBtn = document.getElementById('readyToggleBtn');

// ゲームデータ
let mapWalls = [];
let mapSize = 2000;
let currentGameState = null;
let myId = null;
let myRole = 'player'; // 'player' or 'spectator'
let myVoteTarget = null;
let raycaster = null;

let myAvatarBase64 = null;
const avatarImages = {}; // id: Image object
let currentStream = null;
let useFrontCamera = true;

// カメラ設定
let camera = { x: 1000, y: 1000 };
// 観戦者用カメラドラッグ
let isDraggingCamera = false;
let lastMousePos = { x: 0, y: 0 };

// エフェクト & パーティクル
let flashDamageTime = 0; // 被弾時の赤画面フラッシュ
const particles = []; // ヒット火花など
const confettiParticles = []; // 投票的中時の紙吹雪

// 入力状態 (サーバー送信キー)
let inputState = {
  angle: 0,
  force: 0,
  shoot: false
};

// PCデバッグ用キー入力
const keys = { w: false, a: false, s: false, d: false };

// 武器表示名
const WEAPON_LABELS = {
  fist: '素手',
  machinegun: 'マシンガン',
  shotgun: 'ショットガン',
  knife: 'ナイフ',
  ghillie: 'ギリースーツ（隠密）'
};

// 芝生の床の色（ギリースーツの同化色）
const GRASS_COLOR = '#1e331e';

let audioInitialized = false;

// サウンド初期化と設定
function initAudio() {
  if (window.footstepSystem && !audioInitialized) {
    window.footstepSystem.start();
    window.footstepSystem.setVolume('bgm', parseFloat(bgmVol.value));
    window.footstepSystem.setVolume('sfx', parseFloat(sfxVol.value));
    window.footstepSystem.setVolume('sys', parseFloat(sysVol.value));
    
    // ホーム画面（未接続時など）でBGMを流す
    if (!window.footstepSystem.bgmPlaying) {
      window.footstepSystem.playBGM(Date.now() / 1000);
    }
    audioInitialized = true;
  }
}

// ユーザーが画面に触れた初回にAudioContextをアンロックしてBGM開始
const unlockAudio = () => {
  if (!audioInitialized) {
    initAudio();
  }
};
// スマホ（Safari等）ではtouchstartやclickが必須な場合があるため複数登録
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });

// スライダーで音量調整（+ テスト音再生）
bgmVol.addEventListener('input', () => { 
  if(window.footstepSystem) {
    initAudio();
    window.footstepSystem.setVolume('bgm', parseFloat(bgmVol.value));
  }
});
sfxVol.addEventListener('change', () => { 
  if(window.footstepSystem) {
    initAudio();
    window.footstepSystem.setVolume('sfx', parseFloat(sfxVol.value)); 
    // 効果音のテストとして足音（少し大きめ）を鳴らす
    window.footstepSystem.playFootstep(0, 1.0);
  }
});
sysVol.addEventListener('change', () => { 
  if(window.footstepSystem) {
    initAudio();
    window.footstepSystem.setVolume('sys', parseFloat(sysVol.value)); 
    window.footstepSystem.playButtonSound();
  }
});

// すべてのボタンクリック時にシステム音を鳴らす
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
    initAudio();
    if (window.footstepSystem) window.footstepSystem.playButtonSound();
  }
});

// Canvasのリサイズ
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ローカルストレージからの読み込み
window.onload = () => {
  const savedName = localStorage.getItem('playerName');
  const savedAvatar = localStorage.getItem('playerAvatar');
  if (savedName) {
    playerNameInput.value = savedName;
  }
  if (savedAvatar) {
    myAvatarBase64 = savedAvatar;
    avatarPreview.src = myAvatarBase64;
    avatarPreviewContainer.classList.remove('hidden');
  }
};

// 初回ユーザー操作でオーディオ解禁（何度呼ばれてもOK）
const startAudio = () => {
  if (window.footstepSystem) {
    window.footstepSystem.start();
  }
};
document.addEventListener('click', startAudio);
document.addEventListener('touchend', startAudio);

// Socket.IO接続確立
socket.on('connect', () => {
  myId = socket.id;
  errorScreen.classList.add('hidden');
});

socket.on('disconnect', () => {
  errorScreen.classList.remove('hidden');
});

// マップデータ初期化
socket.on('initMap', (data) => {
  mapWalls = data.walls;
  mapSize = data.mapSize;
  raycaster = new Raycaster(mapSize);
  raycaster.init(mapWalls);
});

// 役割割り当て
socket.on('roleAssign', (data) => {
  myRole = data.role;
  if (myRole === 'spectator') {
    controlsOverlay.classList.add('hidden');
    spectatorHudInfo.classList.remove('hidden');
    votedTargetDisplay.classList.remove('hidden');
    if (data.message) {
      alert(data.message);
    }
  } else {
    controlsOverlay.classList.remove('hidden');
    spectatorHudInfo.classList.add('hidden');
    votedTargetDisplay.classList.add('hidden');
  }
});

// ロビー更新
socket.on('lobbyUpdate', (data) => {
  if (data.status !== 'LOBBY') return;
  
  if (window.footstepSystem && window.footstepSystem.bgmPlaying) {
    window.footstepSystem.stopBGM();
  }

  // プレイヤーリスト構築
  lobbyPlayerList.innerHTML = '';
  let count = 0;
  
  // 自分自身の情報を更新
  const me = data.players[myId];
  if (me) {
    myRole = me.isSpectator ? 'spectator' : 'player';
    if (!me.isSpectator) {
      readyToggleBtn.style.display = 'block';
      readyToggleBtn.innerText = me.ready ? '準備完了を解除' : '準備完了にする';
      readyToggleBtn.className = me.ready ? 'secondary-btn' : 'primary-btn';
    } else {
      readyToggleBtn.style.display = 'none';
    }
  }

  // プレイヤーのリスト化
  Object.values(data.players).forEach(p => {
    if (!p.isSpectator) {
      count++;
      const li = document.createElement('li');
      let avatarHtml = p.avatar ? `<img src="${p.avatar}" style="width:24px; height:24px; border-radius:50%; margin-right:8px; vertical-align:middle; object-fit:cover;">` : '<div style="width:24px; height:24px; border-radius:50%; margin-right:8px; display:inline-block; vertical-align:middle; background:rgba(255,255,255,0.2);"></div>';
      li.innerHTML = `<div style="display:flex; align-items:center;">${avatarHtml}<span>${p.name}</span></div> <div style="display:flex; align-items:center;"><span class="badge player-badge">PLAYER</span> ${p.ready ? '<span style="color:#00ff66; margin-left:10px; font-size:0.8rem;">[Ready]</span>' : ''}</div>`;
      lobbyPlayerList.appendChild(li);
    }
    // アバター画像の読み込み
    if (p.avatar && !avatarImages[p.id]) {
      const img = new Image();
      img.src = p.avatar;
      avatarImages[p.id] = img;
    }
  });
  lobbyPlayerCount.innerText = count;

  // 観戦者投票セクションの制御
  if (myRole === 'spectator') {
    spectatorVoteSection.classList.remove('hidden');
    votePlayerOptions.innerHTML = '';

    // プレイヤーへの投票選択肢を生成
    let hasPlayers = false;
    Object.values(data.players).forEach(p => {
      if (!p.isSpectator) {
        hasPlayers = true;
        const btn = document.createElement('button');
        btn.className = `vote-btn ${myVoteTarget === p.id ? 'voted' : ''}`;
        
        // 得票数を集計
        const voteCount = Object.values(data.players).filter(pl => pl.isSpectator && pl.voteFor === p.id).length;

        btn.innerHTML = `<span>${p.name}</span> <span class="vote-count">${voteCount}票</span>`;
        btn.onclick = () => castVote(p.id);
        votePlayerOptions.appendChild(btn);
      }
    });

    if (!hasPlayers) {
      votePlayerOptions.innerHTML = '<p class="vote-instruction">現在プレイヤーがいません。</p>';
    }

    // 自分の投票状態表示
    const myInfo = data.players[myId];
    if (myInfo && myInfo.voteFor) {
      const target = data.players[myInfo.voteFor];
      myVoteTarget = myInfo.voteFor;
      votedTargetName.innerText = target ? target.name : '未投票';
      myVoteStatus.innerText = target ? `${target.name} に投票しました。` : '';
    } else {
      votedTargetName.innerText = '未投票';
      myVoteStatus.innerText = '';
    }
  } else {
    spectatorVoteSection.classList.add('hidden');
  }
});

// ロビーのカウントダウン
socket.on('countdown', (sec) => {
  if (sec === -1) {
    lobbyStatus.innerText = 'プレイヤーを待っています (最低2人以上必要)...';
    countdownTimer.classList.add('hidden');
  } else {
    lobbyStatus.innerText = 'まもなく対戦が開始されます！';
    countdownTimer.classList.remove('hidden');
    countdownSec.innerText = sec;
  }
});

// スポーン選択開始
socket.on('spawnSelectionStart', (data) => {
  startScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  spawnSelectionScreen.classList.remove('hidden');
  spawnTimerText.innerText = data.duration;
  spawnStatusMsg.innerText = 'マップをタップして開始位置を決定！';
  
  if (myRole !== 'player') {
    spawnStatusMsg.innerText = 'プレイヤーが開始位置を選択中です...';
  }
});

socket.on('spawnCountdown', (sec) => {
  spawnTimerText.innerText = sec;
});

// スポーン位置選択(キャンバスクリック)
spawnMapCanvas.addEventListener('click', (e) => {
  if (myRole !== 'player') return;
  const rect = spawnMapCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * mapSize;
  const y = (e.clientY - rect.top) / rect.height * mapSize;
  socket.emit('selectSpawn', { x, y });
  
  // 自分用に選択状態を保存しておく (描画用)
  currentGameState = currentGameState || { players: {} };
  if (!currentGameState.players[myId]) currentGameState.players[myId] = {};
  currentGameState.players[myId].spawnTarget = { x, y };
  
  spawnStatusMsg.innerText = '降下ポイントをセットしました！';
  initAudio(); // 音声コンテキストの開始
  if (window.footstepSystem) window.footstepSystem.playButtonSound();
});

// ゲーム開始前3秒カウントダウン
socket.on('finalCountdownStart', (count) => {
  spawnSelectionScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  startScreen.classList.add('hidden');
  bigCountdownScreen.classList.remove('hidden');
  bigCountdownText.innerText = count;
  initAudio();
  if (window.footstepSystem) window.footstepSystem.playButtonSound();
});

socket.on('finalCountdownUpdate', (count) => {
  bigCountdownText.innerText = count;
  if (window.footstepSystem) window.footstepSystem.playButtonSound();
});

// ゲーム開始
socket.on('gameStart', () => {
  startScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  spawnSelectionScreen.classList.add('hidden');
  bigCountdownScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  if (myRole === 'player') {
    controlsOverlay.classList.remove('hidden');
  } else {
    controlsOverlay.classList.add('hidden');
  }
});

// ダメージ演出
socket.on('playerHit', (data) => {
  if (data.id === myId) {
    flashDamageTime = 8; // 被弾時の赤枠表示
  }
  // ヒットパーティクル生成
  const p = currentGameState?.players[data.id];
  if (p) {
    createHitParticles(p.x, p.y, data.hp <= 0);

    // 素手の殴り音（当たった時のみ鳴らす）
    const attacker = currentGameState?.players[data.attackerId];
    if (window.footstepSystem && attacker && attacker.weapon === 'fist') {
      window.footstepSystem.playWeaponSound('fist', camera, p.x, p.y);
    }
  }
});

// アイテム取得演出
socket.on('itemPicked', (data) => {
  // アイテムが拾われた時の簡単なポップパーティクル
  if (currentGameState) {
    const p = currentGameState.players[data.playerId];
    if (p) {
      createPickedParticles(p.x, p.y, data.type === 'medkit' ? '#00ff66' : '#ffd700');
    }
  }
});

// 攻撃時銃口フラッシュ演出
socket.on('shootEffect', (data) => {
  createShootParticles(data.x, data.y, data.angle, data.weapon);
  
  // 素手以外（マシンガン、ショットガン、ナイフ）は発動時に音を鳴らす
  if (data.weapon !== 'fist') {
    if (window.footstepSystem) {
      window.footstepSystem.playWeaponSound(data.weapon, camera, data.x, data.y);
    }
  }
});

// 死亡通知
socket.on('playerDeath', (data) => {
  const victimName = data.victim.name;
  if (data.victim.id === myId) {
    alert('あなたは敗退しました！観戦モードに移行します。');
    myRole = 'spectator';
    controlsOverlay.classList.add('hidden');
    spectatorHudInfo.classList.remove('hidden');
  }
});

// ゲーム終了
socket.on('gameOver', (data) => {
  if (window.footstepSystem && window.footstepSystem.bgmPlaying) {
    window.footstepSystem.stopBGM();
  }

  hud.classList.add('hidden');
  controlsOverlay.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');

  if (data.winner) {
    winnerDisplay.classList.remove('hidden');
    winnerName.innerText = data.winner.name;
  } else {
    winnerDisplay.classList.add('hidden');
    gameOverTitle.innerText = 'DRAW';
  }

  // 観戦者用投票結果の表示
  if (myRole === 'spectator' && myVoteTarget) {
    spectatorResult.classList.remove('hidden');
    if (data.winner && myVoteTarget === data.winner.id) {
      spectatorResultMsg.innerHTML = '<span style="color:#00ff66;font-size:1.3rem;">🎉 予想的中！おめでとうございます！ 🎉</span>';
    } else {
      spectatorResultMsg.innerText = '予想が外れました。次回また挑戦しましょう！';
    }
  } else {
    spectatorResult.classList.add('hidden');
  }
});

// 投票的中エフェクトの受信
socket.on('voteSuccess', () => {
  // 大量の紙吹雪を生成
  createConfettiShower();
});

// ゲーム状態の同期更新
socket.on('sync', (state) => {
  currentGameState = state;
  
  if (state.serverStartTime && window.footstepSystem) {
    const uptime = Date.now() - state.serverStartTime;
    // BGMの開始 (SPAWN_SELECTION以降は鳴らす)
    // 状態はlobbyUpdateでも来るが、syncで同期している
    // serverStartTimeが来たらBGM鳴らす
    if (!window.footstepSystem.bgmPlaying) {
      window.footstepSystem.playBGM(uptime);
    }
  }
});

// スポーン選択画面の描画ループ
function drawSpawnMap() {
  if (spawnSelectionScreen.classList.contains('hidden')) {
    requestAnimationFrame(drawSpawnMap);
    return;
  }
  
  const ctxSpawn = spawnMapCanvas.getContext('2d');
  const w = spawnMapCanvas.width = spawnMapCanvas.clientWidth;
  const h = spawnMapCanvas.height = spawnMapCanvas.clientHeight;
  const scaleX = w / mapSize;
  const scaleY = h / mapSize;
  
  ctxSpawn.clearRect(0, 0, w, h);
  
  // 壁の描画
  ctxSpawn.fillStyle = '#333';
  mapWalls.forEach(wall => {
    ctxSpawn.fillRect(wall.x * scaleX, wall.y * scaleY, wall.w * scaleX, wall.h * scaleY);
  });
  
  // 自分の選択位置を描画
  if (currentGameState && currentGameState.players && currentGameState.players[myId] && currentGameState.players[myId].spawnTarget) {
    const target = currentGameState.players[myId].spawnTarget;
    ctxSpawn.fillStyle = '#4ade80';
    ctxSpawn.beginPath();
    ctxSpawn.arc(target.x * scaleX, target.y * scaleY, 8, 0, Math.PI * 2);
    ctxSpawn.fill();
    ctxSpawn.strokeStyle = '#fff';
    ctxSpawn.lineWidth = 2;
    ctxSpawn.stroke();
    
    // パルスエフェクト
    const pulseTime = (Date.now() % 1000) / 1000;
    ctxSpawn.strokeStyle = `rgba(74, 222, 128, ${1 - pulseTime})`;
    ctxSpawn.beginPath();
    ctxSpawn.arc(target.x * scaleX, target.y * scaleY, 8 + pulseTime * 15, 0, Math.PI * 2);
    ctxSpawn.stroke();
  }
  
  requestAnimationFrame(drawSpawnMap);
}
drawSpawnMap();

// 投票ボタン押下
function castVote(targetPlayerId) {
  myVoteTarget = targetPlayerId;
  socket.emit('vote', { targetPlayerId });
}

// 参加フォーム送信
joinPlayerBtn.onclick = () => {
  startAudio(); // 確実にAudioContextを再開
  const name = playerNameInput.value.trim() || 'GUEST_' + Math.random().toString(36).substr(2, 4);
  localStorage.setItem('playerName', name);
  startScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  socket.emit('joinGame', { name, role: 'player', avatar: myAvatarBase64 });
};

joinSpectatorBtn.onclick = () => {
  startAudio(); // 確実にAudioContextを再開
  const name = playerNameInput.value.trim() || 'SPECTATOR_' + Math.random().toString(36).substr(2, 4);
  localStorage.setItem('playerName', name);
  startScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  myRole = 'spectator';
  socket.emit('joinGame', { name, role: 'spectator', avatar: myAvatarBase64 });
};

// --- カメラロジック ---
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: useFrontCamera ? 'user' : 'environment' },
      audio: false
    });
    cameraVideo.srcObject = currentStream;
    cameraModal.classList.remove('hidden');
    cameraVideo.style.transform = useFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
  } catch (err) {
    alert('カメラにアクセスできませんでした。');
  }
}

openCameraBtn.onclick = () => startCamera();

switchCameraBtn.onclick = () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
};

closeCameraBtn.onclick = () => {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  cameraModal.classList.add('hidden');
};

capturePhotoBtn.onclick = () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 64;
  tempCanvas.height = 64;
  const tCtx = tempCanvas.getContext('2d');
  
  const size = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
  const startX = (cameraVideo.videoWidth - size) / 2;
  const startY = (cameraVideo.videoHeight - size) / 2;
  
  if (useFrontCamera) {
    tCtx.translate(64, 0);
    tCtx.scale(-1, 1);
  }
  tCtx.drawImage(cameraVideo, startX, startY, size, size, 0, 0, 64, 64);
  
  myAvatarBase64 = tempCanvas.toDataURL('image/jpeg', 0.8);
  avatarPreview.src = myAvatarBase64;
  avatarPreviewContainer.classList.remove('hidden');
  localStorage.setItem('playerAvatar', myAvatarBase64);
  
  closeCameraBtn.click();
};

// --- ボタンロジック ---
readyToggleBtn.onclick = () => socket.emit('toggleReady');
returnToLobbyBtn.onclick = () => {
  // サーバーにゲームオーバーからのリセットを通知
  socket.emit('returnToLobby');
  // タイトル画面に戻るためページをリロードする（通信のためのわずかな猶予を設ける）
  setTimeout(() => location.reload(), 50);
};

const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
if (leaveLobbyBtn) {
  leaveLobbyBtn.onclick = () => {
    // サーバーから切断してタイトル画面へ戻す
    socket.disconnect();
    setTimeout(() => location.reload(), 50);
  };
}

// --- バーチャルジョイスティック初期化 ---
const joystick = new VirtualJoystick(
  'joystickZone',
  'joystickOuter',
  'joystickInner',
  (angle, force) => {
    inputState.angle = angle;
    inputState.force = force;
    sendInputToServer();
  }
);

// エイム・攻撃用ジョイスティック
let aimTimer = null;
const aimJoystick = new VirtualJoystick(
  'aimJoystickZone',
  'aimJoystickOuter',
  'aimJoystickInner',
  (angle, force) => {
    inputState.aimAngle = angle;
    inputState.aimForce = force;

    if (force > 0) {
      // 倒し始め
      if (!aimTimer) {
        inputState.shoot = false;
        // 0.3秒長押しでフルオート連射開始
        aimTimer = setTimeout(() => {
          inputState.shoot = true;
          sendInputToServer();
        }, 300);
      } else if (inputState.shoot) {
        // すでに連射モードなら向きを更新して送信
        sendInputToServer();
      } else {
        // 狙い中（連射はまだ）なら向きだけ送信
        sendInputToServer();
      }
    } else {
      // 指を離した時
      if (aimTimer) {
        clearTimeout(aimTimer);
        aimTimer = null;
      }
      
      if (!inputState.shoot) {
        // まだ連射モードになっていない（＝タップ or 狙って離した）場合は単発発射
        inputState.shoot = true;
        sendInputToServer();
        
        // 直後に発射フラグを解除
        setTimeout(() => {
          inputState.shoot = false;
          inputState.aimAngle = undefined;
          inputState.aimForce = 0;
          sendInputToServer();
        }, 50);
      } else {
        // 連射モード中だった場合は射撃停止
        inputState.shoot = false;
        inputState.aimAngle = undefined;
        inputState.aimForce = 0;
        sendInputToServer();
      }
    }
  }
);

// PCでのデバッグ用キー＆マウスクリック
window.addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
    updateKeyboardInput();
  }
  if (e.code === 'Space') {
    inputState.shoot = true;
    sendInputToServer();
  }
});

window.addEventListener('keyup', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
    updateKeyboardInput();
  }
  if (e.code === 'Space') {
    inputState.shoot = false;
    sendInputToServer();
  }
});

// PCマウスエイム＆射撃
window.addEventListener('mousedown', (e) => {
  // ロビーやスタート画面でのクリックを貫通させない
  if (!startScreen.classList.contains('hidden') || !lobbyScreen.classList.contains('hidden') || !gameOverScreen.classList.contains('hidden')) {
    return;
  }
  if (myRole === 'player' && e.clientX > window.innerWidth / 2) {
    // 画面右半分クリックで射撃
    inputState.shoot = true;
    sendInputToServer();
  }
});

window.addEventListener('mouseup', () => {
  if (myRole === 'player') {
    inputState.shoot = false;
    sendInputToServer();
  }
});

// PCキーボード用移動角計算
function updateKeyboardInput() {
  if (myRole === 'spectator') return;

  let x = 0;
  let y = 0;
  if (keys.w) y -= 1;
  if (keys.s) y += 1;
  if (keys.a) x -= 1;
  if (keys.d) x += 1;

  if (x === 0 && y === 0) {
    inputState.force = 0;
  } else {
    inputState.angle = Math.atan2(y, x);
    inputState.force = 1.0;
  }
  sendInputToServer();
}

// サーバーへ操作情報を送信
function sendInputToServer() {
  if (myRole === 'player') {
    socket.emit('input', inputState);
  }
}

// --- 観戦カメラドラッグ操作 ---
canvas.addEventListener('mousedown', (e) => {
  if (myRole === 'spectator') {
    isDraggingCamera = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDraggingCamera && myRole === 'spectator') {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    camera.x -= dx;
    camera.y -= dy;
    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mouseup', () => {
  isDraggingCamera = false;
});

// スマホタッチでの観戦スクロール
canvas.addEventListener('touchstart', (e) => {
  if (myRole === 'spectator' && e.touches.length === 1) {
    isDraggingCamera = true;
    lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (isDraggingCamera && myRole === 'spectator' && e.touches.length === 1) {
    const dx = e.touches[0].clientX - lastMousePos.x;
    const dy = e.touches[0].clientY - lastMousePos.y;
    camera.x -= dx;
    camera.y -= dy;
    lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

canvas.addEventListener('touchend', () => {
  isDraggingCamera = false;
});

// --- パーティクル・エフェクト生成ロジック ---
function createHitParticles(x, y, isFatal) {
  const count = isFatal ? 30 : 10;
  const color = isFatal ? '#ff0000' : '#ffa500';
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      r: Math.random() * 3 + 2,
      color,
      alpha: 1.0,
      decay: Math.random() * 0.04 + 0.02
    });
  }
}

function createShootParticles(x, y, angle, weapon) {
  const muzzleX = x + Math.cos(angle) * 22;
  const muzzleY = y + Math.sin(angle) * 22;

  // フラッシュの火花
  const count = weapon === 'shotgun' ? 12 : 4;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 5 + 3;
    particles.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: Math.random() * 2 + 1,
      color: '#ffcc00',
      alpha: 1.0,
      decay: 0.05
    });
  }
}

function createPickedParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      r: Math.random() * 4 + 2,
      color: color,
      alpha: 1.0,
      decay: 0.03
    });
  }
}

// 的中祝い紙吹雪シャワー
function createConfettiShower() {
  const colors = ['#ff0055', '#00ff66', '#0099ff', '#ffcc00', '#ff00ff', '#ffffff'];
  const w = window.innerWidth;
  // 画面のあちこち、または上部から大量の紙吹雪を生成
  for (let i = 0; i < 150; i++) {
    confettiParticles.push({
      x: Math.random() * w,
      y: -50 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 4,
      w: Math.random() * 10 + 6,
      h: Math.random() * 15 + 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.1
    });
  }
}

// --- メイン描画ループ (requestAnimationFrame) ---
function draw() {
  requestAnimationFrame(draw);

  // 画面クリア
  ctx.fillStyle = '#0a0d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!currentGameState || currentGameState.status === 'LOBBY') return;

  const players = currentGameState.players;
  const bullets = currentGameState.bullets;
  const items = currentGameState.items;
  const safeZone = currentGameState.safeZone;
  const myPlayer = players[myId];

  // カメラ追従の更新
  if (myRole === 'player' && myPlayer && !myPlayer.dead) {
    // 自プレイヤーに追従
    camera.x = myPlayer.x;
    camera.y = myPlayer.y;
  } else {
    // 死亡時または観戦時は、画面ドラッグで自由に動かす（初期位置はマップ中央）
    if (camera.x === 0 && camera.y === 0) {
      camera.x = mapSize / 2;
      camera.y = mapSize / 2;
    }
  }

  // カメラの座標空間のオフセット
  const offsetX = canvas.width / 2 - camera.x;
  const offsetY = canvas.height / 2 - camera.y;

  // --- 視野制限 (Raycasting Fog-of-War) ---
  let visibilityPolygon = null;
  const useFog = (myRole === 'player' && myPlayer && !myPlayer.dead);

  if (useFog && raycaster) {
    visibilityPolygon = raycaster.getVisiblePolygon({ x: myPlayer.x, y: myPlayer.y });
  }

  // 1. 地面の描画
  // グリッドを背景に敷く
  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 芝生の背景
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, mapSize, mapSize);

  // グリッド線
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = 100;
  for (let x = 0; x <= mapSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, mapSize);
    ctx.stroke();
  }
  for (let y = 0; y <= mapSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(mapSize, y);
    ctx.stroke();
  }
  ctx.restore();

  // 2. 障害物（壁）の描画
  ctx.save();
  ctx.translate(offsetX, offsetY);
  for (let wall of mapWalls) {
    // 3D的な厚みのある壁の表現
    ctx.fillStyle = '#6b7280'; // 視界外の黒と区別できるコンクリートグレー
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    
    // 光沢エッジ
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
  }
  ctx.restore();

  // 3. アイテムの描画 (可視部分のみ、または観戦時すべて)
  ctx.save();
  ctx.translate(offsetX, offsetY);
  for (let item of items) {
    // 視野チェック
    if (useFog && visibilityPolygon && !isPointInPolygon(item, visibilityPolygon)) {
      continue; // 視野外なら見えない
    }

    // アイテム発光円
    ctx.beginPath();
    ctx.arc(item.x, item.y, 16, 0, Math.PI * 2);
    
    let fill = item.type === 'medkit' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 215, 0, 0.15)';
    if (item.type === 'ghillie') fill = 'rgba(0, 200, 150, 0.4)'; // ギリーは特有の濃い緑
    ctx.fillStyle = fill;
    ctx.fill();
    
    let border = item.type === 'medkit' ? '#00ff66' : '#ffd700';
    if (item.type === 'ghillie') border = '#00ffaa'; // シアン/エメラルド系
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // アイテムのアイコン文字
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let icon = '🎁';
    if (item.type === 'machinegun') icon = '🔫';
    if (item.type === 'shotgun') icon = '💥';
    if (item.type === 'knife') icon = '🔪';
    if (item.type === 'ghillie') icon = '🌿';
    if (item.type === 'medkit') icon = '➕';
    ctx.fillText(icon, item.x, item.y);
  }
  ctx.restore();

  // 4. 弾丸の描画
  ctx.save();
  ctx.translate(offsetX, offsetY);
  for (let b of bullets) {
    if (useFog && visibilityPolygon && !isPointInPolygon(b, visibilityPolygon)) {
      continue;
    }
    // 弾丸の軌跡線
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.8, b.y - b.vy * 0.8);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#ff3e3e';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  // 5. プレイヤーの描画
  ctx.save();
  ctx.translate(offsetX, offsetY);
  
  let aliveCount = 0;
  let visibleEnemyCount = 0; // 視界内の敵の数（アラート判定用）
  
  for (let id in players) {
    let p = players[id];
    if (p.isSpectator || p.dead) continue;
    aliveCount++;

    // 視野チェック (自分以外)
    let isVisible = true;
    if (id !== myId && useFog && visibilityPolygon) {
      isVisible = isPointInPolygon(p, visibilityPolygon);
    }

    if (!isVisible) continue;
    
    // 敵が視界に入ったかカウント（観戦時や自分自身は除外）
    if (id !== myId && p.weapon !== 'ghillie' && !p.hasGhillie) {
       // ギリースーツを着ている敵はアラート判定から除外する（見えないため）
       visibleEnemyCount++;
    } else if (id !== myId && p.hasGhillie) {
       // ギリースーツでもかすかに見える設定なので、一応発見扱いにする場合はここに書くが、
       // メタルギア風なら草に見えている間はアラートにならない方が面白い
    }

    const isGhillie = p.hasGhillie;
    const isMe = (id === myId);

    // ギリースーツでのステルス処理
    ctx.save();
    if (isGhillie) {
      if (isMe) {
        ctx.globalAlpha = 0.55; // 自分自身は透過して見えるように
      } else {
        // 他人のギリーは地面と酷似した色にして見つけづらくする
        ctx.globalAlpha = 0.08;
      }
    }

    // プレイヤーの本体丸印またはアバター
    if (avatarImages[id] && !isGhillie) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImages[id], p.x - 25, p.y - 25, 50, 50);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
      ctx.fillStyle = isGhillie ? '#2c5e2e' : p.color;
      ctx.fill();
    }

    // プレイヤーの枠線（ギリー時は薄く）
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
    ctx.strokeStyle = isGhillie ? 'rgba(0,0,0,0.1)' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // プレイヤーの向き（▲）と武器の表示（敵がギリーを着ている時は隠蔽）
    if (isMe || !isGhillie) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.moveTo(32, 0); // 鼻先
      ctx.lineTo(20, 8);
      ctx.lineTo(20, -8);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      // 武器の表示（▲のすぐ横に描画）
      if (p.weapon !== 'fist') {
        ctx.beginPath();
        ctx.arc(36, 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
    
    // エイム（照準）線の描画（自分自身のみ）
    if (isMe && inputState && inputState.aimForce > 0 && inputState.aimAngle !== undefined) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // 長さ500pxのレーザーを描画
      const laserLen = 500;
      ctx.lineTo(p.x + Math.cos(inputState.aimAngle) * laserLen, p.y + Math.sin(inputState.aimAngle) * laserLen);
      ctx.strokeStyle = 'rgba(255, 62, 62, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]); // 点線にする
      ctx.stroke();
      ctx.restore();
    }

    // ギリースーツの場合は他人からHPバーと名前を隠蔽
    const hideUI = isGhillie && (id !== myId);

    if (!hideUI) {
      // HPバー
      const barW = 40;
      const barH = 5;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - barW / 2, p.y - 32, barW, barH);
      ctx.fillStyle = p.hp > 30 ? '#00ff66' : '#ff3e3e';
      ctx.fillRect(p.x - barW / 2, p.y - 32, barW * (p.hp / 100), barH);

      // 名前
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.name, p.x, p.y - 38);
      ctx.shadowBlur = 0; // シャドウリセット
    }
  }
  ctx.restore();

  // 6. 安全地帯（電磁パルスエリア）の描画
  ctx.save();
  ctx.translate(offsetX, offsetY);
  // 安全地帯の外周
  ctx.beginPath();
  ctx.arc(safeZone.x, safeZone.y, safeZone.r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff3e3e';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 境界線を光らせる
  ctx.shadowColor = '#ff3e3e';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(255, 62, 62, 0.4)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.shadowBlur = 0; // リセット
  ctx.restore();

  // 7. Raycasting視野マスク (Among Us視野の黒マスク描画)
  if (useFog && visibilityPolygon) {
    ctx.save();
    // 視野ポリゴンの内側だけ切り抜く
    ctx.beginPath();
    ctx.moveTo(visibilityPolygon[0].x + offsetX, visibilityPolygon[0].y + offsetY);
    for (let i = 1; i < visibilityPolygon.length; i++) {
      ctx.lineTo(visibilityPolygon[i].x + offsetX, visibilityPolygon[i].y + offsetY);
    }
    ctx.closePath();
    ctx.clip(); // 可視領域でクリップ

    // クリップ領域内はそのまま描画。クリップ領域外を暗くするために、
    // 反転した描画をしたいが、一番簡単な方法は画面全体を一度黒く塗りつぶした「マスクCanvas」を
    // クリップされなかった場所に重ねること。
    // そのため、クリップ後にここでは何もせず、全体のマスク合成で処理する。
    // (JavaScript Canvasでは、クリップされていない外側を黒にするため、
    //  最初に画面全体を黒で塗りつぶし、クリップ領域内を `destination-out` で透明にし、
    //  その後に背景やマップを重ねる手順にする。この方がきれいに影が落ちる)
    ctx.restore();

    // 実用的なマスク方法 (2層描画):
    // 暗闇マスクを描画
    ctx.save();
    ctx.beginPath();
    // マップ全体の矩形
    ctx.rect(0, 0, canvas.width, canvas.height);
    
    // くり抜くパス (反時計回りに指定することで奇偶規則により穴があく、またはevenoddルールを使う)
    ctx.moveTo(visibilityPolygon[0].x + offsetX, visibilityPolygon[0].y + offsetY);
    for (let i = 1; i < visibilityPolygon.length; i++) {
      ctx.lineTo(visibilityPolygon[i].x + offsetX, visibilityPolygon[i].y + offsetY);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'; // 暗闇の濃さ (0.95 = ほぼ真っ暗)
    ctx.fill('evenodd');
    ctx.restore();
  }

  // 8. 安全地帯外の濃い赤ガス (クリップ不要の全体オーバーレイ)
  if (myPlayer && !pIsInsideSafeZone(myPlayer, safeZone)) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 9. パーティクル・エフェクトの描画・更新
  ctx.save();
  ctx.translate(offsetX, offsetY);
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 10. 紙吹雪エフェクト (画面上の2D空間での描画)
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    let p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.spin;

    // 画面外に落ちたら消滅
    if (p.y > canvas.height + 20) {
      confettiParticles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }

  // 11. 画面ダメージフラッシュ (被弾時の赤枠)
  if (flashDamageTime > 0) {
    ctx.strokeStyle = `rgba(255, 0, 0, ${flashDamageTime / 8})`;
    ctx.lineWidth = 30;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    flashDamageTime--;
  }

  // HUD UIの更新
  if (myPlayer) {
    hpBar.style.width = `${myPlayer.hp}%`;
    hpText.innerText = `${myPlayer.hp}/100`;
    currentWeaponName.innerText = WEAPON_LABELS[myPlayer.weapon] || '素手';
    
    // 安全地帯アラート
    const inSafe = pIsInsideSafeZone(myPlayer, safeZone);
    if (!inSafe && !myPlayer.dead) {
      zoneWarning.classList.remove('hidden');
    } else {
      zoneWarning.classList.add('hidden');
    }
  }

  // 12. ミニマップ描画 (HUD用)
  if (myPlayer && !myPlayer.dead) { // プレイ中のみ表示
    const mapRenderSize = 120; // ミニマップのサイズ(px)
    const padding = 16;
    const mapScale = mapRenderSize / mapSize;
    
    ctx.save();
    // 画面右上（パディング付き）に配置
    const mapX = canvas.width - mapRenderSize - padding;
    const mapY = padding; // 右上配置なのでYは上詰めでOK

    // ミニマップ背景枠
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(mapX, mapY, mapRenderSize, mapRenderSize);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapRenderSize, mapRenderSize);

    // 障害物
    ctx.fillStyle = 'rgba(100, 110, 120, 0.8)';
    for (let wall of mapWalls) {
      ctx.fillRect(mapX + wall.x * mapScale, mapY + wall.y * mapScale, wall.w * mapScale, wall.h * mapScale);
    }

    // 安全地帯（円）
    ctx.beginPath();
    ctx.arc(mapX + safeZone.x * mapScale, mapY + safeZone.y * mapScale, safeZone.r * mapScale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 62, 62, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 自分の位置
    ctx.beginPath();
    ctx.arc(mapX + myPlayer.x * mapScale, mapY + myPlayer.y * mapScale, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff66';
    ctx.fill();

    ctx.restore();
  }

  // 足音システムの更新（近くの敵の移動を検知して方向付き足音を再生）
  if (window.footstepSystem) {
    window.footstepSystem.update(camera, players, myId);
  }

  aliveCountText.innerText = aliveCount;
}

// プレイヤーが安全地帯内かチェック
function pIsInsideSafeZone(player, safeZone) {
  let dist = Math.hypot(player.x - safeZone.x, player.y - safeZone.y);
  return dist <= safeZone.r;
}

// 点がポリゴン内にあるか判定 (Raycasting視野マスク判定用)
function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x, yi = polygon[i].y;
    let xj = polygon[j].x, yj = polygon[j].y;

    let intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// アニメーションループ開始
requestAnimationFrame(draw);
