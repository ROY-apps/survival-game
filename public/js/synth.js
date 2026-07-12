// 足音オーディオシステム
// 近くの敵の移動を検知し、方向と距離に応じた足音を再生する
// ギリースーツ着用者は無音

class FootstepAudio {
  constructor() {
    this.audioCtx = null;
    this.isReady = false;
    this.lastPositions = {}; // 前フレームの敵の位置
    this.lastStepTime = {};  // 各敵の最後の足音再生時刻
    this.HEARING_RANGE = 350; // 足音が聞こえる最大距離(px)
    this.STEP_INTERVAL = 320; // 足音の間隔(ms)
    
    // 音量設定
    this.bgmVol = 0.5;
    this.sfxVol = 0.8;
    this.sysVol = 0.6;
    
    // BGM状態
    this.bgmPlaying = false;
    this.bgmOscillators = [];
    this.bgmInterval = null;
  }

  init() {
    if (this.audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AC();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.audioCtx.destination);
    this.isReady = true;
  }

  // ユーザー操作から呼ばれる（何度でもOK）
  start() {
    this.init();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  setVolume(type, val) {
    if (type === 'bgm') this.bgmVol = val;
    if (type === 'sfx') this.sfxVol = val;
    if (type === 'sys') this.sysVol = val;
  }

  playButtonSound() {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;
    const now = this.audioCtx.currentTime;
    
    // ピピっというシステム音
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(this.sysVol * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // サーバー時間と同期したBGM
  playBGM(serverUptime) {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;

    // サイバーパンク風のループシーケンス
    const bpm = 120;
    const beatDuration = 60 / bpm; // 0.5s per beat
    const loopDuration = beatDuration * 8; // 4 seconds loop
    
    // サーバーの稼働時間(ms)から、現在ループのどこにいるかを計算
    // serverUptimeは秒に変換
    const uptimeSec = serverUptime / 1000;
    const currentLoopPos = uptimeSec % loopDuration;
    let nextLoopStart = this.audioCtx.currentTime + (loopDuration - currentLoopPos);
    
    const scheduleLoop = (startTime) => {
      if (!this.bgmPlaying) return;
      
      const sequence = [
        { time: 0, freq: 55, dur: 0.2 },       // A1
        { time: 0.5, freq: 55, dur: 0.2 },
        { time: 1.0, freq: 65.41, dur: 0.2 },  // C2
        { time: 1.5, freq: 65.41, dur: 0.2 },
        { time: 2.0, freq: 73.42, dur: 0.2 },  // D2
        { time: 2.5, freq: 73.42, dur: 0.2 },
        { time: 3.0, freq: 49.00, dur: 0.2 },  // G1
        { time: 3.5, freq: 49.00, dur: 0.2 },
      ];
      
      // ベースライン
      sequence.forEach(note => {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note.freq;
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, startTime + note.time);
        filter.frequency.exponentialRampToValueAtTime(100, startTime + note.time + note.dur);
        
        const gain = this.audioCtx.createGain();
        // BGMボリュームを反映
        gain.gain.setValueAtTime(this.bgmVol * 0.15, startTime + note.time);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.time + note.dur);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(startTime + note.time);
        osc.stop(startTime + note.time + note.dur);
        
        // オシレーターを保存しておく(ストップ用)
        this.bgmOscillators.push(osc);
      });
      
      // ハイハット的なノイズ（チッチッチ） - 音量を0.1から0.02へ大幅ダウン
      for(let i = 0; i < 8; i++) {
        const time = startTime + i * beatDuration;
        this.addNoiseBurst(time, 0.05, this.bgmVol * 0.02, 4000, 10000, this.masterGain);
      }

      // 未来的な電子楽器のメロディー (シンセリード)
      // Aマイナー・ペンタトニック的なアルペジオ
      const melodySequence = [
        { time: 0.0, freq: 440.00, dur: 0.1 },  // A4
        { time: 0.5, freq: 523.25, dur: 0.1 },  // C5
        { time: 1.0, freq: 659.25, dur: 0.1 },  // E5
        { time: 1.5, freq: 880.00, dur: 0.1 },  // A5
        { time: 2.0, freq: 783.99, dur: 0.1 },  // G5
        { time: 2.5, freq: 659.25, dur: 0.1 },  // E5
        { time: 3.0, freq: 523.25, dur: 0.1 },  // C5
        { time: 3.5, freq: 587.33, dur: 0.1 },  // D5
      ];
      
      melodySequence.forEach(note => {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'square'; // 8bit/未来的な電子音感
        osc.frequency.value = note.freq;
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, startTime + note.time);
        filter.frequency.exponentialRampToValueAtTime(500, startTime + note.time + note.dur);
        
        const gain = this.audioCtx.createGain();
        // メロディのボリューム
        gain.gain.setValueAtTime(this.bgmVol * 0.05, startTime + note.time);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.time + note.dur * 1.5);
        
        // ちょっとしたディレイ感を出すためにステレオパンを振る
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * 0.8; // 左右に散らす
        
        osc.connect(filter);
        filter.connect(panner);
        panner.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(startTime + note.time);
        osc.stop(startTime + note.time + note.dur * 1.5);
        
        this.bgmOscillators.push(osc);
      });
      
      // 古いオシレーターのクリーンアップ (メロディ分増えたので余裕をもたせる)
      setTimeout(() => {
        this.bgmOscillators = this.bgmOscillators.slice(24);
      }, loopDuration * 1000 + 1000);
    };

    // 最初のループを途中から再生するのは複雑なので、次のループ開始まで待ってからスケジューリング開始
    this.bgmInterval = setInterval(() => {
      if (this.audioCtx.currentTime >= nextLoopStart - 0.1) {
        scheduleLoop(nextLoopStart);
        nextLoopStart += loopDuration;
      }
    }, 100);
  }
  
  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;
    this.bgmOscillators.forEach(osc => {
      try { osc.stop(now); } catch(e) {}
    });
    this.bgmOscillators = [];
  }

  // 足音を1回鳴らす（低い「ドスッ」という音）
  playFootstep(pan, volume) {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    const now = this.audioCtx.currentTime;

    // パンナー（左右の方向）
    const panner = this.audioCtx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    // 音量
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume * this.sfxVol, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    // 低い「ドスッ」という足音（2つの周波数を重ねる）
    // 低音部分
    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    // アタック部分（短いノイズ）
    const noiseLen = Math.floor(this.audioCtx.sampleRate * 0.04);
    const noiseBuf = this.audioCtx.createBuffer(1, noiseLen, this.audioCtx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
    }
    const noiseSrc = this.audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    // ノイズ用フィルタ（中低域のみ通す）
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 1.5;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // 接続: osc1 -> gainNode -> panner -> master
    osc1.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.masterGain);

    // 接続: noise -> filter -> noiseGain -> panner
    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(panner);

    osc1.start(now);
    osc1.stop(now + 0.15);
    noiseSrc.start(now);
  }

  // 毎フレーム呼ばれる：敵の位置から足音を計算
  update(listener, players, myId) {
    if (!this.isReady || !this.audioCtx || this.audioCtx.state !== 'running') return;
    if (!listener) return;

    const now = Date.now();

    for (let id in players) {
      if (id === myId) continue;
      const enemy = players[id];
      if (!enemy || enemy.dead || enemy.isSpectator) continue;

      // ギリースーツ着用者は足音なし
      if (enemy.hasGhillie) {
        delete this.lastPositions[id];
        continue;
      }

      // 距離を計算
      const dx = enemy.x - listener.x;
      const dy = enemy.y - listener.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 聞こえる範囲外ならスキップ
      if (dist > this.HEARING_RANGE) {
        delete this.lastPositions[id];
        continue;
      }

      // 移動しているか判定（前フレームとの差分）
      const prev = this.lastPositions[id];
      let isMoving = false;
      if (prev) {
        const moveDx = enemy.x - prev.x;
        const moveDy = enemy.y - prev.y;
        const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
        isMoving = moveDist > 0.5; // 微動を除外
      }
      this.lastPositions[id] = { x: enemy.x, y: enemy.y };

      if (!isMoving) continue;

      // 足音の間隔チェック
      const lastStep = this.lastStepTime[id] || 0;
      if (now - lastStep < this.STEP_INTERVAL) continue;
      this.lastStepTime[id] = now;

      // パン（左右の方向）を計算：画面の左右位置に基づく
      const pan = Math.max(-1, Math.min(1, dx / dist));

      // 音量（距離に反比例）
      const volume = Math.max(0.05, 0.7 * (1 - dist / this.HEARING_RANGE));

      this.playFootstep(pan, volume);
    }

    // 切断した敵のデータをクリーンアップ
    for (let id in this.lastPositions) {
      if (!players[id]) {
        delete this.lastPositions[id];
        delete this.lastStepTime[id];
      }
    }
  }

  // ========== 武器サウンド（方向・距離付き） ==========

  // パンと音量を座標から計算するヘルパー
  calcSpatial(listener, sx, sy) {
    const dx = sx - listener.x;
    const dy = sy - listener.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.HEARING_RANGE * 1.5) return null; // 遠すぎる
    const pan = Math.max(-1, Math.min(1, dx / dist));
    const volume = Math.max(0.05, 1.0 * (1 - dist / (this.HEARING_RANGE * 1.5))) * this.sfxVol;
    return { pan, volume };
  }

  // 攻撃音を再生（イベントから呼ばれる）
  playWeaponSound(weapon, listener, sx, sy) {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;
    const sp = this.calcSpatial(listener, sx, sy);
    if (!sp) return;

    switch (weapon) {
      case 'fist':     this.playPunchSound(sp.pan, sp.volume); break;
      case 'machinegun': this.playMachinegunSound(sp.pan, sp.volume); break;
      case 'shotgun':  this.playShotgunSound(sp.pan, sp.volume); break;
      case 'knife':    this.playKnifeSound(sp.pan, sp.volume); break;
    }
  }

  // 素手：殴り音（低い「ドン」+ 短いノイズ）
  playPunchSound(pan, vol) {
    const now = this.audioCtx.currentTime;
    const panner = this.audioCtx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.masterGain);

    // 低い衝撃音
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol * 0.8, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(g); g.connect(panner);
    osc.start(now); osc.stop(now + 0.15);

    // 「バチッ」というノイズ
    this.addNoiseBurst(now, 0.06, vol * 0.5, 200, 1500, panner);
  }

  // マシンガン：軽い銃声（「タタタ」）
  playMachinegunSound(pan, vol) {
    const now = this.audioCtx.currentTime;
    const panner = this.audioCtx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.masterGain);

    // 高めのアタック音
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol * 0.4, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(g); g.connect(panner);
    osc.start(now); osc.stop(now + 0.06);

    // 短いノイズバースト
    this.addNoiseBurst(now, 0.04, vol * 0.35, 1000, 8000, panner);
  }

  // ショットガン：重い大きな銃声（「ドカン」）
  playShotgunSound(pan, vol) {
    const now = this.audioCtx.currentTime;
    const panner = this.audioCtx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.masterGain);

    // 重い低音
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol * 1.0, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(g); g.connect(panner);
    osc.start(now); osc.stop(now + 0.35);

    // 大きなノイズ（爆発的）
    this.addNoiseBurst(now, 0.15, vol * 0.7, 300, 4000, panner);

    // 高い余韻
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(500, now);
    osc2.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    const g2 = this.audioCtx.createGain();
    g2.gain.setValueAtTime(vol * 0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(g2); g2.connect(panner);
    osc2.start(now); osc2.stop(now + 0.25);
  }

  // ナイフ：切れる音（「シャキン」）
  playKnifeSound(pan, vol) {
    const now = this.audioCtx.currentTime;
    const panner = this.audioCtx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.masterGain);

    // 高い金属音
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol * 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(g); g.connect(panner);
    osc.start(now); osc.stop(now + 0.1);

    // 「シュッ」というノイズ（切り裂く風切り音）
    this.addNoiseBurst(now, 0.1, vol * 0.4, 2000, 10000, panner);

    // 低い「ザシュ」という衝撃
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(150, now + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    const g2 = this.audioCtx.createGain();
    g2.gain.setValueAtTime(vol * 0.5, now + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc2.connect(g2); g2.connect(panner);
    osc2.start(now + 0.03); osc2.stop(now + 0.15);
  }

  // ヘルパー：ノイズバースト生成
  addNoiseBurst(time, duration, vol, freqLow, freqHigh, dest) {
    const len = Math.floor(this.audioCtx.sampleRate * duration);
    const buf = this.audioCtx.createBuffer(1, len, this.audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    const flt = this.audioCtx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = (freqLow + freqHigh) / 2;
    flt.Q.value = 0.5;
    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + duration);
    src.connect(flt); flt.connect(g); g.connect(dest);
    src.start(time);
  }
}

window.footstepSystem = new FootstepAudio();
