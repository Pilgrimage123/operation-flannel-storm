import test from "node:test";
import assert from "node:assert/strict";
import { SpatialGrid } from "./SpatialGrid.ts";

test("SpatialGrid - basic insertion and separation", () => {
  const grid = new SpatialGrid(1000, 32, 50);

  // Mock sprite entities
  const e1 = { x: 100, y: 100 } as any;
  const e2 = { x: 105, y: 100 } as any; // distance 5, limit 20 -> should push apart

  const prevX1 = e1.x;
  const prevX2 = e2.x;

  grid.resolveSeparation([e1, e2], 20, 14);

  assert.ok(e1.x < prevX1, "e1 should be pushed left");
  assert.ok(e2.x > prevX2, "e2 should be pushed right");
  assert.ok(Math.abs(e1.x - e2.x) > 5, "Distance between entities should have increased");
});

test("SpatialGrid - distant entities are unaffected", () => {
  const grid = new SpatialGrid(1000, 32, 50);

  const e1 = { x: 100, y: 100 } as any;
  const e2 = { x: 300, y: 300 } as any; // far away

  grid.resolveSeparation([e1, e2], 20, 14);

  assert.equal(e1.x, 100);
  assert.equal(e1.y, 100);
  assert.equal(e2.x, 300);
  assert.equal(e2.y, 300);
});

test("SpatialGrid - multiple entities in cluster", () => {
  const grid = new SpatialGrid(1000, 32, 50);

  const entities = [
    { x: 100, y: 100 },
    { x: 102, y: 100 },
    { x: 100, y: 102 },
    { x: 104, y: 104 },
  ] as any[];

  grid.resolveSeparation(entities, 15, 10);

  // Entities should spread out
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const dist = Math.hypot(entities[i].x - entities[j].x, entities[i].y - entities[j].y);
      assert.ok(dist > 0, "No two entities should occupy the exact same spot");
    }
  }
});
