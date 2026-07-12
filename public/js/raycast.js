class Raycaster {
  constructor(mapSize) {
    this.mapSize = mapSize;
    this.segments = [];
    this.uniquePoints = [];
  }

  // 壁データから線分と頂点を生成
  init(walls) {
    this.segments = [];
    this.uniquePoints = [];

    // マップ外周の線分
    this.segments.push({ p1: { x: 0, y: 0 }, p2: { x: this.mapSize, y: 0 } });
    this.segments.push({ p1: { x: this.mapSize, y: 0 }, p2: { x: this.mapSize, y: this.mapSize } });
    this.segments.push({ p1: { x: this.mapSize, y: this.mapSize }, p2: { x: 0, y: this.mapSize } });
    this.segments.push({ p1: { x: 0, y: this.mapSize }, p2: { x: 0, y: 0 } });

    // 各壁の4辺と頂点
    for (let wall of walls) {
      // 画面外（枠線など）はスキップし、内部壁のみセグメント化
      if (wall.x < 0 || wall.y < 0 || wall.x >= this.mapSize || wall.y >= this.mapSize) {
        continue;
      }
      
      const p1 = { x: wall.x, y: wall.y };
      const p2 = { x: wall.x + wall.w, y: wall.y };
      const p3 = { x: wall.x + wall.w, y: wall.y + wall.h };
      const p4 = { x: wall.x, y: wall.y + wall.h };

      // 4つの線分
      this.segments.push({ p1: p1, p2: p2 });
      this.segments.push({ p1: p2, p2: p3 });
      this.segments.push({ p1: p3, p2: p4 });
      this.segments.push({ p1: p4, p2: p1 });
    }

    // 頂点のユニークリストを作成（重複排除）
    const points = [];
    for (let seg of this.segments) {
      points.push(seg.p1);
      points.push(seg.p2);
    }
    
    const seen = new Set();
    for (let p of points) {
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      if (!seen.has(key)) {
        seen.add(key);
        this.uniquePoints.push(p);
      }
    }
  }

  // レイと線分の交点計算
  getIntersection(ray, segment) {
    const r_px = ray.a.x;
    const r_py = ray.a.y;
    const r_dx = ray.b.x - ray.a.x;
    const r_dy = ray.b.y - ray.a.y;

    const s_px = segment.p1.x;
    const s_py = segment.p1.y;
    const s_dx = segment.p2.x - segment.p1.x;
    const s_dy = segment.p2.y - segment.p1.y;

    // 平行チェック用
    const r_mag = Math.hypot(r_dx, r_dy);
    const s_mag = Math.hypot(s_dx, s_dy);
    if (r_mag === 0 || s_mag === 0) return null;
    
    if (Math.abs((r_dx / r_mag) * (s_dy / s_mag) - (r_dy / r_mag) * (s_dx / s_mag)) < 1e-7) {
      return null; // 平行
    }

    const denominator = r_dx * s_dy - r_dy * s_dx;
    if (Math.abs(denominator) < 1e-7) return null;

    const T2 = (r_dx * (r_py - s_py) + r_dy * (s_px - r_px)) / denominator;
    
    // 0で除算するのを防ぐ
    let T1;
    if (Math.abs(r_dx) > 1e-7) {
      T1 = (s_px + s_dx * T2 - r_px) / r_dx;
    } else {
      T1 = (s_py + s_dy * T2 - r_py) / r_dy;
    }

    // 線分上（T2が0~1の間）かつレイの前方（T1 >= 0）
    if (T1 >= 0 && T2 >= 0 && T2 <= 1) {
      return {
        x: r_px + r_dx * T1,
        y: r_py + r_dy * T1,
        param: T1
      };
    }

    return null;
  }

  // 可視領域ポリゴンの頂点を取得
  getVisiblePolygon(origin) {
    const angles = [];
    
    // すべての頂点に対する角度を取得
    for (let p of this.uniquePoints) {
      const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
      // 角の裏へ回り込む影を作るため、微小の角度オフセットを追加
      angles.push(angle - 0.0001);
      angles.push(angle);
      angles.push(angle + 0.0001);
    }

    // マップの4隅へのレイも強制的に追加して、全体をカバー
    const corners = [
      Math.atan2(0 - origin.y, 0 - origin.x),
      Math.atan2(0 - origin.y, this.mapSize - origin.x),
      Math.atan2(this.mapSize - origin.y, this.mapSize - origin.x),
      Math.atan2(this.mapSize - origin.y, 0 - origin.x)
    ];
    angles.push(...corners);

    const intersects = [];
    for (let angle of angles) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const ray = {
        a: origin,
        b: { x: origin.x + dx, y: origin.y + dy }
      };

      let closestIntersect = null;
      for (let segment of this.segments) {
        const intersect = this.getIntersection(ray, segment);
        if (!intersect) continue;
        if (!closestIntersect || intersect.param < closestIntersect.param) {
          closestIntersect = intersect;
        }
      }

      if (closestIntersect) {
        closestIntersect.angle = angle;
        intersects.push(closestIntersect);
      }
    }

    // 角度でソートしてポリゴンを描画可能にする
    intersects.sort((a, b) => a.angle - b.angle);
    return intersects;
  }
}

// グローバルに登録
window.Raycaster = Raycaster;
