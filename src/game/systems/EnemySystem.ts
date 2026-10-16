import * as Phaser from "phaser";
import { synth } from "../audio";
import { SpatialGrid } from "../spatial/SpatialGrid";
import type { BData, EData, Kind } from "../types";

export interface EnemyContext {
  player: Phaser.Physics.Arcade.Sprite;
  decoy: Phaser.Physics.Arcade.Sprite;
  stealth: boolean;
  dashT: number;
  alive: boolean;
  timeSurvived: number;
  cam: Phaser.Cameras.Scene2D.Camera;
  shakeCam(duration: number, intensity: number): void;
  hurtPlayer(amount: number, throughStealth?: boolean, honorIFrame?: boolean): void;
  aoe(x: number, y: number, radius: number, damage: number, knock: number): void;
  shoot(
    x: number,
    y: number,
    ang: number,
    speed: number,
    dmg: number,
    pierce: number,
    homing: boolean,
    key: string,
    life: number,
    aoe: number,
    friendly?: boolean,
  ): Phaser.Physics.Arcade.Sprite | null;
  dress(sprite: Phaser.Physics.Arcade.Sprite, key: string, height: number, hit: number): void;
  floater(x: number, y: number, text: string, color: string): void;
  explode(x: number, y: number, scale: number): void;
  recycle(sprite: Phaser.Physics.Arcade.Sprite): void;
  spawnGem(x: number, y: number, value: number, keg?: boolean): void;
  onKilled(): void;
  delayedCall(delay: number, callback: () => void): void;
}

const KIND_TEX: Record<Kind, string> = {
  conscript: "conscript",
  tiktok: "tiktok",
  cart: "cart",
  turtle: "turtle",
  boss: "boss",
  riot: "riot",
  kamikaze: "kamikaze",
  dog: "k9",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export class EnemySystem {
  private ctx: EnemyContext;
  enemies: Phaser.Physics.Arcade.Group;
  private shields: Phaser.GameObjects.Group;
  private loots: Phaser.GameObjects.Group;
  private spatialGrid: SpatialGrid;

  private spawnAcc = 0;
  private swarmAcc = 9;
  private squadAcc = 16;
  nextBoss = 180;
  bossCount = 0;
  private eid = 1;

  constructor(
    ctx: EnemyContext,
    enemies: Phaser.Physics.Arcade.Group,
    shields: Phaser.GameObjects.Group,
    loots: Phaser.GameObjects.Group,
  ) {
    this.ctx = ctx;
    this.enemies = enemies;
    this.shields = shields;
    this.loots = loots;
    this.spatialGrid = new SpatialGrid(3600, 32, 260);
  }

  reset() {
    this.spawnAcc = 0;
    this.swarmAcc = 9;
    this.squadAcc = 16;
    this.nextBoss = 180;
    this.bossCount = 0;
    this.eid = 1;
    this.spatialGrid.clear();
  }

  ed(s: Phaser.Physics.Arcade.Sprite): EData {
    let d = s.getData("ed") as EData | undefined;
    if (!d) {
      d = {
        kind: "conscript",
        hp: 1,
        max: 1,
        speed: 40,
        touch: 6,
        id: 0,
        axis: "h",
        face: 1,
        shoot: 1,
        vx: 1,
        vy: 0,
        aim: 0,
        hitCd: 0,
      };
      s.setData("ed", d);
    }
    return d;
  }

  activeCount() {
    let n = 0;
    for (const s of this.enemies.getChildren()) if ((s as Phaser.GameObjects.Sprite).active) n++;
    return n;
  }

  living() {
    return (this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]).filter((s) => s.active);
  }

  nearest(x: number, y: number, bossOk: boolean) {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestD = Infinity;
    const living = this.living();
    for (const s of living) {
      if (!bossOk && this.ed(s).kind === "boss" && living.length > 1) {
        continue;
      }
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  toughest() {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let hp = -1;
    for (const s of this.living()) {
      const e = this.ed(s);
      if (e.hp > hp) {
        hp = e.hp;
        best = s;
      }
    }
    return best;
  }

  pressure() {
    return 1 + this.ctx.timeSurvived / 90;
  }

  rollKind(): Kind {
    const t = this.ctx.timeSurvived;
    const bag: Kind[] = ["conscript", "conscript", "conscript", "conscript"];
    if (t > 12) bag.push("tiktok", "conscript");
    if (t > 24) bag.push("dog", "riot", "conscript");
    if (t > 45) bag.push("cart", "tiktok", "dog");
    if (t > 75) bag.push("turtle", "riot", "kamikaze", "conscript");
    if (t > 130) bag.push("turtle", "dog", "riot");
    if (t > 200) bag.push("kamikaze", "cart", "turtle");
    return bag[Math.floor(Math.random() * bag.length)]!;
  }

  spawnEnemy(kind: Kind) {
    const cam = this.ctx.cam;
    const dist = (Math.max(cam.width, cam.height) * 0.62) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    let x = this.ctx.player.x + Math.cos(ang) * dist;
    let y = this.ctx.player.y + Math.sin(ang) * dist;
    x = clamp(x, 120, 3600 - 120);
    y = clamp(y, 120, 3600 - 120);
    if (Math.hypot(x - this.ctx.player.x, y - this.ctx.player.y) < 140) {
      x = clamp(this.ctx.player.x + (Math.random() < 0.5 ? -1 : 1) * 260, 120, 3600 - 120);
      y = clamp(this.ctx.player.y + (Math.random() < 0.5 ? -1 : 1) * 260, 120, 3600 - 120);
    }
    this.birth(kind, x, y);
  }

  spawnBoss() {
    this.bossCount += 1;
    const cam = this.ctx.cam;
    const dist = (Math.max(cam.width, cam.height) * 0.58) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    const x = clamp(this.ctx.player.x + Math.cos(ang) * dist, 160, 3600 - 160);
    const y = clamp(this.ctx.player.y + Math.sin(ang) * dist, 160, 3600 - 160);
    this.birth("boss", x, y);
    this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 70, "WARNING: INFLATABLE S-400 DEPLOYED", "#ff3333");
  }

  birth(kind: Kind, x: number, y: number) {
    const s = this.enemies.get(x, y, KIND_TEX[kind]) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return;
    s.enableBody(true, x, y, true, true);
    s.clearTint();
    const pressure = this.pressure();
    const hp =
      kind === "boss"
        ? Math.round((280 + this.bossCount * 220) * (1 + this.ctx.timeSurvived * 0.005))
        : kind === "turtle"
          ? 48 * pressure
          : kind === "riot"
            ? 34 * pressure
            : kind === "cart"
              ? 18 * pressure
              : kind === "kamikaze"
                ? 12 * pressure
                : kind === "dog"
                  ? 16 * pressure
                  : kind === "tiktok"
                    ? 18 * pressure
                    : 14 * pressure;
    const height =
      kind === "boss"
        ? 120
        : kind === "turtle"
          ? 76
          : kind === "cart"
            ? 70
            : kind === "riot"
              ? 72
              : kind === "kamikaze"
                ? 54
                : kind === "dog"
                  ? 60
                  : 64;
    this.ctx.dress(s, KIND_TEX[kind], height, kind === "boss" ? 0.42 : kind === "kamikaze" ? 0.5 : 0.36);
    const e = this.ed(s);
    e.kind = kind;
    e.hp = hp;
    e.max = hp;
    e.speed =
      kind === "boss"
        ? 36
        : kind === "turtle"
          ? 44
          : kind === "riot"
            ? 34
            : kind === "cart"
              ? 145
              : kind === "kamikaze"
                ? 188
                : kind === "dog"
                  ? 118
                  : kind === "tiktok"
                    ? 64
                    : 78;
    const touchBase =
      kind === "boss"
        ? 30
        : kind === "turtle"
          ? 22
          : kind === "riot"
            ? 20
            : kind === "cart"
              ? 20
              : kind === "kamikaze"
                ? 36
                : kind === "dog"
                  ? 22
                  : kind === "tiktok"
                    ? 14
                    : 16;
    e.touch = touchBase * pressure;
    e.id = this.eid++;
    e.axis = Math.random() < 0.5 ? "h" : "v";
    e.face = Math.random() < 0.5 ? -1 : 1;
    e.shoot = 0.45 + Math.random() * 0.6;
    e.hitCd = 0;
    const dir = Math.atan2(this.ctx.player.y - y, this.ctx.player.x - x);
    e.aim = dir;
    e.vx = Math.cos(dir) * e.speed;
    e.vy = Math.sin(dir) * e.speed;
    s.setData("loot", null);
    if (kind === "riot") this.attachShield(s);
    else this.dropShield(s);
    s.setDepth(y);
    s.setFlipX(false);
    s.setRotation(0);
  }

  private turnToward(current: number, desired: number, maxStep: number) {
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + clamp(diff, -maxStep, maxStep);
  }

  private attachShield(enemy: Phaser.Physics.Arcade.Sprite) {
    let shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (shield?.active) return;
    shield = this.shields.get(enemy.x, enemy.y, "shield") as Phaser.GameObjects.Sprite | null;
    if (!shield) return;
    shield.setTexture("shield");
    shield.setActive(true).setVisible(true);
    shield.setScale(36 / Math.max(1, shield.height));
    enemy.setData("shield", shield);
  }

  private dropShield(enemy: Phaser.Physics.Arcade.Sprite) {
    const shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (!shield) return;
    shield.setActive(false).setVisible(false);
    enemy.setData("shield", null);
  }

  private placeShield(enemy: Phaser.Physics.Arcade.Sprite, data: EData) {
    if (data.kind !== "riot") return;
    let shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (!shield?.active) {
      this.attachShield(enemy);
      shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    }
    if (!shield?.active) return;
    shield.setPosition(enemy.x + Math.cos(data.aim) * 26, enemy.y + Math.sin(data.aim) * 26);
    shield.setRotation(data.aim);
    shield.setDepth(enemy.depth + 2);
  }

  tickSpawns(dt: number) {
    if (this.ctx.timeSurvived >= this.nextBoss) {
      this.nextBoss += 180;
      this.spawnBoss();
    }
    this.spawnAcc += dt;
    const interval = clamp(0.72 - this.ctx.timeSurvived * 0.00215, 0.11, 0.72);
    const cap = Math.min(168, 16 + Math.floor(this.ctx.timeSurvived / 3));
    if (this.spawnAcc >= interval && this.activeCount() < cap) {
      this.spawnAcc = 0;
      this.spawnEnemy(this.rollKind());
      if (this.ctx.timeSurvived > 8 && this.activeCount() < cap) this.spawnEnemy("conscript");
      if (this.ctx.timeSurvived > 28 && Math.random() < 0.7 && this.activeCount() < cap) {
        this.spawnEnemy("conscript");
      }
      if (this.ctx.timeSurvived > 70 && Math.random() < 0.5 && this.activeCount() < cap) {
        this.spawnEnemy(this.rollKind());
      }
      if (this.ctx.timeSurvived > 140 && Math.random() < 0.45 && this.activeCount() < cap) {
        this.spawnEnemy("conscript");
      }
    }
    this.swarmAcc -= dt;
    if (this.swarmAcc <= 0) {
      this.swarmAcc = clamp(10.5 - this.ctx.timeSurvived * 0.016, 3.6, 10.5);
      if (this.ctx.timeSurvived > 22) {
        const n = 3 + Math.floor(this.ctx.timeSurvived / 65);
        for (let i = 0; i < n && this.activeCount() < cap; i++) this.spawnEnemy("kamikaze");
      }
    }
    this.squadAcc -= dt;
    if (this.squadAcc <= 0) {
      this.squadAcc = clamp(15 - this.ctx.timeSurvived * 0.018, 7, 15);
      if (this.ctx.timeSurvived > 18) {
        const n = this.ctx.timeSurvived > 110 ? 5 : 3;
        for (let i = 0; i < n && this.activeCount() < cap; i++) this.spawnEnemy("riot");
      }
    }
  }

  tickEnemies(dt: number) {
    const lure = this.ctx.decoy.active;
    const kids = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const active: Phaser.Physics.Arcade.Sprite[] = [];

    for (const s of kids) {
      if (!s.active) continue;
      active.push(s);
      const e = this.ed(s);
      const tx = lure ? this.ctx.decoy.x : this.ctx.player.x;
      const ty = lure ? this.ctx.decoy.y : this.ctx.player.y;
      let vx = 0;
      let vy = 0;
      const bonus = lure ? (e.kind === "conscript" ? 1.5 : 1.35) : 1;

      if (e.kind === "cart" && !lure) {
        vx = e.vx;
        vy = e.vy;
      } else if (e.kind === "turtle") {
        const dx = tx - s.x;
        const dy = ty - s.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          e.axis = "h";
          e.face = dx < 0 ? -1 : 1;
          vx = e.face * e.speed * bonus;
          vy = 0;
        } else {
          e.axis = "v";
          e.face = dy === 0 ? e.face : 1;
          vx = 0;
          vy = Math.sign(dy || 1) * e.speed * bonus;
        }
      } else if (e.kind === "tiktok" && !lure) {
        e.shoot -= dt;
        if (e.shoot > 0.45) {
          const dx = tx - s.x;
          const dy = ty - s.y;
          const len = Math.hypot(dx, dy) || 1;
          vx = (dx / len) * e.speed;
          vy = (dy / len) * e.speed;
        } else if (e.shoot <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const shot = this.ctx.shoot(s.x, s.y, ang, 190, 13 * this.pressure(), 1, false, "bullet", 1.4, 0, false);
          shot?.setTint(0xff5a36);
          e.shoot = 0.85 + Math.random() * 0.9;
        }
      } else if (e.kind === "riot") {
        const desired = Math.atan2(ty - s.y, tx - s.x);
        e.aim = this.turnToward(e.aim, desired, 0.72 * dt);
        const pace = lure ? 1.12 : 1;
        vx = Math.cos(e.aim) * e.speed * pace;
        vy = Math.sin(e.aim) * e.speed * pace;
        e.face = vx < 0 ? -1 : 1;
      } else if (e.kind === "dog") {
        const desired = Math.atan2(this.ctx.player.y - s.y, this.ctx.player.x - s.x);
        const turn = this.ctx.stealth ? 0.65 : 2.6;
        e.aim = this.turnToward(e.aim, desired, turn * dt);
        const spd = e.speed * (this.ctx.stealth ? 0.5 : 1);
        vx = Math.cos(e.aim) * spd;
        vy = Math.sin(e.aim) * spd;
        e.face = vx < 0 ? -1 : 1;
      } else if (e.kind === "kamikaze") {
        const wob = Math.sin(this.ctx.timeSurvived * 10 + e.id) * 0.22;
        const ang = Math.atan2(ty - s.y, tx - s.x) + wob;
        const pace = lure ? 1.3 : 1;
        vx = Math.cos(ang) * e.speed * pace;
        vy = Math.sin(ang) * e.speed * pace;
        e.aim = ang;
        e.face = vx < 0 ? -1 : 1;
      } else {
        const dx = tx - s.x;
        const dy = ty - s.y;
        const len = Math.hypot(dx, dy) || 1;
        vx = (dx / len) * e.speed * bonus;
        vy = (dy / len) * e.speed * bonus;
        e.face = vx < 0 ? -1 : 1;
        e.aim = Math.atan2(vy, vx);
      }

      if (e.kind === "boss") {
        e.shoot -= dt;
        if (e.shoot <= 0) {
          e.shoot = 1.55;
          const ang = Math.atan2(this.ctx.player.y - s.y, this.ctx.player.x - s.x);
          const shot = this.ctx.shoot(s.x, s.y, ang, 150, 22 * this.pressure(), 1, true, "rocket", 5, 0, false);
          shot?.setTint(0xff5533);
        }
      }

      if (e.hitCd > 0) e.hitCd -= dt;
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(vx, vy);
      if (e.kind === "kamikaze") {
        s.setFlipX(false);
        s.setRotation(e.aim);
      } else {
        s.setFlipX(e.face < 0 && e.kind !== "boss");
        s.setRotation(0);
      }
      s.setDepth(s.y);
      this.placeShield(s, e);

      const loot = s.getData("loot") as Phaser.GameObjects.Sprite | undefined;
      const showLoot = lure && e.kind !== "dog";
      const showSniff = e.kind === "dog" && this.ctx.stealth;
      if (showLoot || showSniff) {
        const key = showSniff ? "sniff" : "loot";
        let icon = loot;
        if (!icon || !icon.active || icon.texture.key !== key) {
          if (icon?.active) icon.setActive(false).setVisible(false);
          icon = (this.loots.get(s.x, s.y - 36, key) as Phaser.GameObjects.Sprite | null) ?? undefined;
          if (icon) {
            icon.setTexture(key);
            icon.setActive(true).setVisible(true).setDepth(3600);
            s.setData("loot", icon);
          }
        }
        icon?.setPosition(s.x, s.y - s.displayHeight * 0.55);
      } else if (loot?.active) {
        loot.setActive(false).setVisible(false);
        s.setData("loot", null);
      }
    }

    // High performance O(N) Spatial Hash Grid separation
    const limit = lure ? 13 : 20;
    this.spatialGrid.resolveSeparation(active, limit, 14);
  }

  touchEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active || !this.ctx.alive) return;
    const e = this.ed(enemy);
    if (e.kind === "boss" && this.ctx.stealth) {
      this.popBoss(enemy);
      return;
    }
    if (e.kind === "kamikaze") {
      const dmg = e.touch;
      const x = enemy.x;
      const y = enemy.y;
      this.killEnemy(enemy, false);
      if (Math.hypot(this.ctx.player.x - x, this.ctx.player.y - y) < 46) {
        this.ctx.hurtPlayer(dmg, false, false);
      }
      return;
    }
    if (e.hitCd > 0) return;
    if (e.kind === "dog") {
      if (this.ctx.dashT > 0) return;
      e.hitCd = 0.55;
      this.ctx.hurtPlayer(e.touch, true, true);
      this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 30, "CHOMP", "#ffd6a0");
      return;
    }
    if (this.ctx.stealth || this.ctx.dashT > 0) return;
    e.hitCd = 0.45;
    this.ctx.hurtPlayer(e.touch);
  }

  touchDecoy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.ctx.decoy.active || !enemy.active) return;
    const e = this.ed(enemy);
    if (e.kind !== "cart" && e.kind !== "kamikaze") return;
    this.killEnemy(enemy, false);
  }

  damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, amount: number, kx = 0, ky = 0) {
    if (!enemy.active) return;
    const e = this.ed(enemy);
    e.hp -= amount;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    const len = Math.hypot(kx, ky);
    if (len > 0.01 && e.kind !== "boss") {
      const push = e.kind === "turtle" ? 30 : 65;
      body.setVelocity(body.velocity.x + (kx / len) * push, body.velocity.y + (ky / len) * push);
    }
    enemy.setTint(0xffffff);
    this.ctx.delayedCall(70, () => {
      if (enemy.active) enemy.clearTint();
    });
    if (amount >= 12) {
      this.ctx.floater(enemy.x, enemy.y - 20, `${Math.round(amount)}`, "#ffe66d");
    }
    if (e.hp <= 0) this.killEnemy(enemy, false);
  }

  killEnemy(enemy: Phaser.Physics.Arcade.Sprite, popped: boolean) {
    if (!enemy.active) return;
    const e = this.ed(enemy);
    const x = enemy.x;
    const y = enemy.y;
    const kind = e.kind;
    const loot = enemy.getData("loot") as Phaser.GameObjects.Sprite | null;
    if (loot?.active) loot.setActive(false).setVisible(false);
    this.dropShield(enemy);
    this.ctx.recycle(enemy);
    this.ctx.explode(x, y, kind === "boss" ? 2.2 : 0.9);
    synth.boom();
    this.ctx.onKilled();

    if (kind === "cart") this.ctx.aoe(x, y, 64, 18, 80);
    if (kind === "kamikaze") this.ctx.aoe(x, y, 74, 16, 100);
    if (kind === "boss") {
      for (let i = 0; i < 8; i++) {
        this.ctx.spawnGem(x + (Math.random() - 0.5) * 40, y, 8);
      }
      this.ctx.spawnGem(x, y + 20, 0, true);
      this.ctx.spawnGem(x, y - 20, 0, true);
      if (popped) synth.pop();
    } else {
      this.ctx.spawnGem(x, y, kind === "turtle" || kind === "riot" ? 6 : 4);
      if (Math.random() < (kind === "turtle" || kind === "riot" ? 0.16 : 0.05)) {
        this.ctx.spawnGem(x, y, 0, true);
      }
    }
  }

  popBoss(enemy: Phaser.Physics.Arcade.Sprite) {
    this.ctx.floater(enemy.x, enemy.y - 40, "POP!", "#7af0ff");
    this.killEnemy(enemy, true);
    this.ctx.aoe(enemy.x, enemy.y, 130, 20, 160);
    this.ctx.shakeCam(180, 0.01);
  }

  onFriendlyHit(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !enemy.active) return;
    const b = bullet.getData("bd") as BData;
    const e = this.ed(enemy);
    if (b.hit.includes(e.id)) return;
    b.hit.push(e.id);
    let dmg = b.dmg;
    if (e.kind === "turtle") {
      const fromBehind = (bullet.x - enemy.x) * e.face < 0;
      if (fromBehind) dmg *= 2.2;
      else dmg *= 0.45;
    }
    if (e.kind === "riot") {
      const into = b.vx * Math.cos(e.aim) + b.vy * Math.sin(e.aim);
      if (into <= 0) {
        this.ctx.floater(enemy.x + Math.cos(e.aim) * 18, enemy.y + Math.sin(e.aim) * 18, "BLOCK", "#9ad7ff");
        this.ctx.recycle(bullet);
        return;
      }
      dmg *= 2.15;
    }
    this.damageEnemy(enemy, dmg, b.vx, b.vy);
    if (b.aoe > 0) this.ctx.aoe(enemy.x, enemy.y, b.aoe, b.dmg * 0.45, 30);
    if (b.hit.length >= b.pierce) this.ctx.recycle(bullet);
  }
}
