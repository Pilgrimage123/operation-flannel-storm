import * as Phaser from "phaser";
import { synth } from "../audio";
import type { Flame, Shell, WeaponId, WState } from "../types";

export interface WeaponContext {
  player: Phaser.Physics.Arcade.Sprite;
  faceX: number;
  dashX: number;
  dashY: number;
  stealth: boolean;
  dashT: number;
  fxGroup: Phaser.GameObjects.Group;
  dmgMul(): number;
  rateMul(): number;
  areaMul(): number;
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
  aoe(x: number, y: number, radius: number, damage: number, knock: number): void;
  explode(x: number, y: number, scale: number): void;
  shakeCam(duration: number, intensity: number): void;
  findNearestEnemy(x: number, y: number, bossOk: boolean): Phaser.Physics.Arcade.Sprite | null;
  getRandomLivingEnemy(): Phaser.Physics.Arcade.Sprite | null;
  delayedCall(delay: number, callback: () => void): void;
}

export class WeaponSystem {
  private ctx: WeaponContext;
  weapons: WState[] = [{ id: "bren", level: 1, timer: 0.15 }];
  shells: Shell[] = [];
  flames: Flame[] = [];

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
  }

  reset() {
    this.weapons = [{ id: "bren", level: 1, timer: 0.15 }];
    this.shells = [];
    this.flames = [];
  }

  has(id: WeaponId) {
    return this.weapons.some((w) => w.id === id);
  }

  wlevel(id: WeaponId) {
    return this.weapons.find((w) => w.id === id)?.level ?? 0;
  }

  resetTimers() {
    for (const w of this.weapons) w.timer = 0;
  }

  tickWeapons(dt: number) {
    if (this.ctx.stealth || this.ctx.dashT > 0) return;
    const rate = this.ctx.rateMul();
    for (const w of this.weapons) {
      w.timer -= dt * rate;
      if (w.timer > 0) continue;
      if (w.id === "bren") {
        w.timer = 0.28 / (1 + (w.level - 1) * 0.14);
        this.fireBren(w.level);
      } else if (w.id === "artillery") {
        w.timer = 3.5 / (1 + (w.level - 1) * 0.1);
        this.dropShellOnCluster(w.level);
      } else if (w.id === "drone") {
        w.timer = 1.9 / (1 + (w.level - 1) * 0.12);
        const n = 1 + Math.floor((w.level - 1) / 2);
        for (let i = 0; i < n; i++) this.launchDrone(w.level, false);
      } else if (w.id === "moto") {
        w.timer = 14 / (1 + (w.level - 1) * 0.08);
        this.ghostBike(w.level);
      } else if (w.id === "mlrs") {
        w.timer = 4.8 / (1 + (w.level - 1) * 0.1);
        this.salvo(w.level);
      }
    }
  }

  tickProjectiles(dt: number) {
    // Tick falling artillery shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i]!;
      sh.life -= dt;
      const p = 1 - Math.max(0, sh.life) / 0.45;
      sh.sprite.setPosition(sh.x, sh.y - (1 - p) * 90);
      if (sh.life <= 0) {
        this.ctx.explode(sh.x, sh.y, 0.9);
        this.ctx.aoe(sh.x, sh.y, sh.r, sh.dmg, 90);
        this.ctx.shakeCam(90, 0.005);
        synth.boom();
        sh.sprite.setActive(false).setVisible(false);
        this.shells.splice(i, 1);
      }
    }

    // Tick thermobaric flame patches
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      f.life -= dt;
      f.tick -= dt;
      f.sprite.setAlpha(Math.max(0, Math.min(1, f.life)));
      if (f.tick <= 0) {
        f.tick = 0.25;
        this.ctx.aoe(f.x, f.y, f.r, f.dps * 0.25, 10);
      }
      if (f.life <= 0) {
        f.sprite.setActive(false).setVisible(false);
        this.flames.splice(i, 1);
      }
    }
  }

  private fireBren(level: number) {
    const target = this.ctx.findNearestEnemy(this.ctx.player.x, this.ctx.player.y, false);
    const ang = target
      ? Math.atan2(target.y - this.ctx.player.y, target.x - this.ctx.player.x)
      : this.ctx.faceX < 0
        ? Math.PI
        : 0;
    const pierce = this.ctx.dmgMul() > 1 ? 12 : 1;
    const dmg = (8 + (level - 1) * 4) * this.ctx.dmgMul();
    this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, ang, 560, dmg, pierce, false, "bullet", 0.7, 0);
    if (level >= 4) {
      this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, ang + 0.12, 560, dmg * 0.8, pierce, false, "bullet", 0.7, 0);
    }
    synth.shoot();
  }

  private dropShellOnCluster(level: number) {
    const pick = this.ctx.getRandomLivingEnemy();
    if (!pick) return;
    const dmg = (26 + (level - 1) * 8) * this.ctx.dmgMul();
    const r = (52 + level * 4) * this.ctx.areaMul();
    this.queueShell(pick.x, pick.y, r, dmg);
  }

  barrage(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("artillery");
    const dmg = (30 + level * 6) * mul;
    const r = 48 * area;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.queueShell(x + Math.cos(a) * 78, y + Math.sin(a) * 78, r, dmg);
    }
  }

  queueShell(x: number, y: number, r: number, dmg: number) {
    const sprite = this.ctx.fxGroup.get(x, y - 80, "shell") as Phaser.GameObjects.Sprite | null;
    if (!sprite) {
      this.ctx.delayedCall(400, () => this.ctx.aoe(x, y, r, dmg, 80));
      return;
    }
    sprite.setActive(true).setVisible(true).setDepth(3500);
    sprite.setScale(0.9);
    this.shells.push({ sprite, life: 0.45, x, y, r, dmg });
  }

  private launchDrone(level: number, turbo: boolean) {
    const ang = Math.random() * Math.PI * 2;
    const dmg = (14 + (level - 1) * 5) * (turbo ? this.ctx.dmgMul() : 1) * (turbo ? 1.3 : 1);
    this.ctx.shoot(
      this.ctx.player.x,
      this.ctx.player.y,
      ang,
      turbo ? 280 : 200,
      dmg,
      1,
      true,
      "drone",
      turbo ? 3.2 : 3.6,
      turbo ? 36 : 0,
    );
  }

  swarm(x: number, y: number, mul: number) {
    const level = this.wlevel("drone");
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      this.ctx.shoot(x, y, ang, 300, (16 + level * 4) * mul, 1, true, "drone", 3.4, 40);
    }
  }

  private ghostBike(level: number) {
    const ang = Math.atan2(this.ctx.dashY, this.ctx.dashX || this.ctx.faceX);
    const dmg = (18 + level * 6) * this.ctx.dmgMul();
    this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, ang, 380, dmg, 20, false, "moto", 1.6, 0);
    synth.moto();
  }

  private salvo(level: number) {
    const n = 3 + level;
    const dmg = (12 + level * 3) * this.ctx.dmgMul();
    for (let i = 0; i < n; i++) {
      const y = this.ctx.player.y + (i - (n - 1) / 2) * 28;
      const ang = this.ctx.faceX < 0 ? Math.PI : 0;
      this.ctx.shoot(this.ctx.player.x - this.ctx.faceX * 20, y, ang, 340, dmg, 3, false, "rocket", 1.5, 28);
    }
    synth.shoot();
  }

  blanket(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("mlrs");
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dist = 30 + (i % 3) * 36;
      const fx = this.ctx.fxGroup.get(x, y, "flame") as Phaser.GameObjects.Sprite | null;
      if (!fx) continue;
      const px = x + Math.cos(a) * dist;
      const py = y + Math.sin(a) * dist;
      fx.setActive(true).setVisible(true).setPosition(px, py).setDepth(6);
      fx.setScale(1.1 * area);
      this.flames.push({
        sprite: fx,
        life: 2.6,
        x: px,
        y: py,
        r: 42 * area,
        dps: (22 + level * 4) * mul,
        tick: 0,
      });
    }
  }
}
