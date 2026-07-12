class VirtualJoystick {
  constructor(zoneId, outerId, innerId, onChange) {
    this.zone = document.getElementById(zoneId);
    this.outer = document.getElementById(outerId);
    this.inner = document.getElementById(innerId);
    this.onChange = onChange; // callback when input changes: (angle, force)

    this.active = false;
    this.dragStart = { x: 0, y: 0 };
    this.touchId = null;
    this.maxRadius = 50; // 外枠から内枠が動く最大距離

    // 初期状態では画面中央付近に半透明で配置
    this.resetJoystick();
    this.setupEvents();
  }

  resetJoystick() {
    this.active = false;
    this.touchId = null;
    this.inner.style.transform = `translate(0px, 0px)`;
    this.outer.style.opacity = '0.4';
    
    // スティックを初期位置に戻す（CSSに任せるか、絶対座標をクリアする）
    this.outer.style.position = 'absolute';
    this.outer.style.left = 'calc(50% - 60px)';
    this.outer.style.top = 'calc(50% - 60px)';

    if (this.onChange) {
      this.onChange(0, 0);
    }
  }

  setupEvents() {
    // タッチイベント
    this.zone.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });

    // デバッグ用のマウスイベント (PCデバッグ用)
    this.zone.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }

  handleStart(clientX, clientY) {
    this.active = true;
    
    // タッチした場所にジョイスティック外枠を移動
    const rect = this.zone.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    this.outer.style.left = `${relativeX - 60}px`;
    this.outer.style.top = `${relativeY - 60}px`;
    this.outer.style.opacity = '0.8';

    this.dragStart = { x: clientX, y: clientY };
  }

  handleMove(clientX, clientY) {
    if (!this.active) return;

    let dx = clientX - this.dragStart.x;
    let dy = clientY - this.dragStart.y;
    let dist = Math.hypot(dx, dy);

    // 角度の計算
    let angle = Math.atan2(dy, dx);
    // 入力強度の計算（0.0 〜 1.0）
    let force = Math.min(dist / this.maxRadius, 1.0);

    // インナー位置の制限
    if (dist > this.maxRadius) {
      dx = Math.cos(angle) * this.maxRadius;
      dy = Math.sin(angle) * this.maxRadius;
    }

    this.inner.style.transform = `translate(${dx}px, ${dy}px)`;

    if (this.onChange) {
      this.onChange(angle, force);
    }
  }

  handleEnd() {
    if (!this.active) return;
    this.resetJoystick();
  }

  // タッチイベントハンドラ
  onTouchStart(e) {
    e.preventDefault();
    if (this.active) return; // すでにアクティブなら何もしない

    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this.handleStart(touch.clientX, touch.clientY);
  }

  onTouchMove(e) {
    if (!this.active) return;

    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.touchId) {
        e.preventDefault();
        this.handleMove(e.touches[i].clientX, e.touches[i].clientY);
        break;
      }
    }
  }

  onTouchEnd(e) {
    if (!this.active) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.handleEnd();
        break;
      }
    }
  }

  // マウスイベントハンドラ (PCデバッグ用)
  onMouseDown(e) {
    // タッチが既に動作している場合は無視
    if (this.touchId !== null) return;
    this.handleStart(e.clientX, e.clientY);
  }

  onMouseMove(e) {
    if (!this.active || this.touchId !== null) return;
    this.handleMove(e.clientX, e.clientY);
  }

  onMouseUp(e) {
    if (!this.active || this.touchId !== null) return;
    this.handleEnd();
  }
}

// グローバルに登録
window.VirtualJoystick = VirtualJoystick;
