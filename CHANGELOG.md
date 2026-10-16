# Changelog

All notable changes to **Operation: Flannel Storm** are documented in this file.

## [Unreleased] - 2026-10-16

### Architecture & Modularity
- **Subsystem Decomposition**: Refactored monolithic `GameScene.ts` (~1,828 lines) into dedicated, cohesive subsystems:
  - `src/game/systems/EnemySystem.ts`: Encapsulates AI behaviors for all 8 enemy types, spawner progression, riot shield mechanics, combat hit registration, and enemy death drops.
  - `src/game/systems/WeaponSystem.ts`: Manages weapon cooldowns, volleys (Bren guns, artillery barrage, drone swarms, motorcycle charge, MLRS rockets), thermobaric flame patches, and ambush attack multipliers.
  - `src/game/systems/LootSystem.ts`: Handles dog tag and pilsner keg drops, magnetic attraction curves, XP calculation, level-up choices, and NAFO Shiba companion behavior.
  - `src/game/systems/FxSystem.ts`: Manages canvas procedural texture synthesis, visual explosion/smoke lifecycles, and a pre-allocated pool of 40 floating combat damage numbers.
  - `src/game/GameScene.ts`: Streamlined into a lean scene orchestrator (~820 lines) coordinating Phaser lifecycle events, input translation, camera tracking, and collision bindings.

### Performance & Algorithms
- **2D Spatial Hash Grid**: Introduced `src/game/spatial/SpatialGrid.ts` replacing the $O(N^2)$ nested pairwise distance checks with an $O(N)$ bucketed spatial index ($C = 32\text{px}$).
  - Uses symmetrical forward neighbor cell checks `(1, 0), (-1, 1), (0, 1), (1, 1)` and center cell to prevent duplicate checks.
  - Zero per-frame heap allocations using pre-allocated `Int32Array` linked lists (`head` and `next`) and an `activeCells` tracking buffer.
  - Added automated unit tests in `src/game/spatial/SpatialGrid.test.ts` verifying cluster separation and distance invariants.

### Type Safety & Audio Polish
- **Strongly Typed Event Bus**: Updated `BusMap["select-upgrade"]` in `src/game/eventBus.ts` and `GameApp.tsx` from raw strings to strongly-typed `UpgradeId`.
- **Audio Lifecycle Management**: Added timer tracking (`timers: number[]`) to `Synth` in `src/game/audio.ts` with `stop()` and `setMuted(m)` to cleanly clear pending Web Audio timeouts when muted or destroyed.
- **Defensive Persistence**: Hardened `loadSave()`, `recordRun()`, and `writeSave()` in `src/game/save.ts` with finite number sanitization (`sanitizeNum`) and error handling for storage quota / private browsing environments.
- **HUD Normalization**: Normalized Article 5 Overcharge gauge calculation dynamically in `GameApp.tsx`.
