export type Positionable = { x: number; y: number };

/**
 * 2D Spatial Hash Grid for high-performance entity separation and neighborhood queries.
 * Converts O(N^2) pairwise distance checks into O(N * k) with zero per-frame heap allocations.
 */
export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private head: Int32Array;
  private next: Int32Array;
  private activeCells: number[] = [];

  constructor(worldSize = 3600, cellSize = 32, initialCapacity = 300) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(initialCapacity).fill(-1);
  }

  clear() {
    for (let i = 0; i < this.activeCells.length; i++) {
      this.head[this.activeCells[i]!] = -1;
    }
    this.activeCells.length = 0;
  }

  insert(idx: number, x: number, y: number) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
    const cellIdx = cy * this.cols + cx;
    if (this.head[cellIdx] === -1) {
      this.activeCells.push(cellIdx);
    }
    this.next[idx] = this.head[cellIdx];
    this.head[cellIdx] = idx;
  }

  /**
   * Resolves entity clumping / separation in O(N) by checking only adjacent grid cells.
   */
  resolveSeparation<T extends Positionable>(
    entities: T[],
    limit: number,
    pushFactor = 14,
  ) {
    const count = entities.length;
    if (count < 2) return;

    if (this.next.length < count) {
      this.next = new Int32Array(count * 2).fill(-1);
    }

    this.clear();
    for (let i = 0; i < count; i++) {
      const e = entities[i]!;
      this.insert(i, e.x, e.y);
    }

    const limitSq = limit * limit;
    const invLimit = 1 / limit;

    // Symmetrical forward neighbor offsets: (1, 0), (-1, 1), (0, 1), (1, 1)
    const offsets = [
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];

    for (let c = 0; c < this.activeCells.length; c++) {
      const cellIdx = this.activeCells[c]!;
      const cx = cellIdx % this.cols;
      const cy = Math.floor(cellIdx / this.cols);

      // 1. Within same cell:
      let i = this.head[cellIdx];
      while (i !== -1) {
        let j = this.next[i];
        while (j !== -1) {
          this.applyPush(entities[i]!, entities[j]!, limitSq, limit, invLimit, pushFactor);
          j = this.next[j];
        }
        i = this.next[i];
      }

      // 2. Across adjacent neighbor cells:
      for (let o = 0; o < offsets.length; o++) {
        const nx = cx + offsets[o]![0]!;
        const ny = cy + offsets[o]![1]!;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
          const neighborIdx = ny * this.cols + nx;
          let aIdx = this.head[cellIdx];
          while (aIdx !== -1) {
            let bIdx = this.head[neighborIdx];
            while (bIdx !== -1) {
              this.applyPush(entities[aIdx]!, entities[bIdx]!, limitSq, limit, invLimit, pushFactor);
              bIdx = this.next[bIdx];
            }
            aIdx = this.next[aIdx];
          }
        }
      }
    }
  }

  private applyPush(
    a: Positionable,
    b: Positionable,
    limitSq: number,
    limit: number,
    invLimit: number,
    pushFactor: number,
  ) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 4 && d2 < limitSq) {
      const d = Math.sqrt(d2);
      const push = ((limit - d) * invLimit) * pushFactor;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}
