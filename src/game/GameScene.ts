import * as Phaser from "phaser";
import { synth } from "./audio";
import { PASSIVES, WEAPONS, offerFor, PASSIVE_MAX_RANK, WEAPON_MAX_RANK } from "./catalog";
import { bus } from "./eventBus";
import type { PassiveId, Stats, UpgradeOffer, WeaponId } from "./types";

const WORLD = 3600;

type Kind = "conscript" | "tiktok" | "cart" | "turtle" | "boss" | "riot" | "kamikaze" | "dog";

type EData = {
  kind: Kind;
  hp: number;
  max: number;
  speed: number;
  touch: number;
  id: number;
  axis: "h" | "v";
  face: number;
  shoot: number;
  vx: number;
  vy: number;
  aim: number;
  hitCd: number;
};

type BData = {
  dmg: number;
  life: number;
  pierce: number;
  homing: boolean;
  speed: number;
  vx: number;
  vy: number;
  friendly: boolean;
  hit: number[];
  aoe: number;
  tick: number;
};

type WState = { id: WeaponId; level: number; timer: number };

type Shell = {
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  x: number;
  y: number;
  r: number;
  dmg: number;
};

type Flame = {
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  x: number;
  y: number;
  r: number;
  dps: number;
  tick: number;
};

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

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private hostile!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private fx!: Phaser.GameObjects.Group;
  private loots!: Phaser.GameObjects.Group;
  private shields!: Phaser.GameObjects.Group;
  private decoy!: Phaser.Physics.Arcade.Sprite;
  private beacon!: Phaser.GameObjects.Sprite;
  private dog!: Phaser.GameObjects.Sprite;
  private bg!: Phaser.GameObjects.TileSprite;
  private blocks: Phaser.Physics.Arcade.Image[] = [];
  private floaters: Phaser.GameObjects.Text[] = [];
  private shells: Shell[] = [];
  private flames: Flame[] = [];
  private cursors!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private injected = new Set<string>();
  private held = new Set<string>();
  private joy = { x: 0, y: 0 };
  private spaceWas = false;
  private alive = true;
  private choosing = false;
  private timeSurvived = 0;
  private kills = 0;
  private level = 1;
  private xp = 0;
  private xpNeed = 36;
  private hp = 110;
  private maxHp = 110;
  private battery = 5;
  private maxBattery = 5;
  private recharge = 0.8;
  private stealth = false;
  private stacks = 0;
  private overAcc = 0;
  private ambushT = 0;
  private ambushStacks = 0;
  private dashT = 0;
  private dashTick = 0;
  private dashX = 1;
  private dashY = 0;
  private faceX = 1;
  private iFrame = 0;
  private spawnAcc = 0;
  private swarmAcc = 9;
  private squadAcc = 16;
  private nextBoss = 180;
  private bossCount = 0;
  private statsAcc = 0;
  private shakeOn = true;
  private eid = 1;
  private weapons: WState[] = [{ id: "bren", level: 1, timer: 0.15 }];
  private ranks: Record<PassiveId, number> = { lumberjack: 0, pilsner: 0, nafo: 0 };
  private brickT = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super("game");
  }

  init() {
    this.alive = true;
    this.choosing = false;
    this.timeSurvived = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 36;
    this.hp = 110;
    this.maxHp = 110;
    this.battery = 5;
    this.maxBattery = 5;
    this.recharge = 0.8;
    this.stealth = false;
    this.stacks = 0;
    this.overAcc = 0;
    this.ambushT = 0;
    this.ambushStacks = 0;
    this.dashT = 0;
    this.dashTick = 0;
    this.dashX = 1;
    this.dashY = 0;
    this.faceX = 1;
    this.iFrame = 0;
    this.spawnAcc = 0;
    this.swarmAcc = 9;
    this.squadAcc = 16;
    this.nextBoss = 180;
    this.bossCount = 0;
    this.statsAcc = 0;
    this.eid = 1;
    this.weapons = [{ id: "bren", level: 1, timer: 0.15 }];
    this.ranks = { lumberjack: 0, pilsner: 0, nafo: 0 };
    this.brickT = 0;
    this.shells = [];
    this.flames = [];
    this.blocks = [];
    this.joy = { x: 0, y: 0 };
    this.spaceWas = false;
    this.injected = new Set();
    this.held.clear();
  }

  preload() {
    const files = [
      "pavel-loud",
      "pavel-stealth",
      "conscript",
      "tiktok",
      "cart",
      "turtle",
      "boss",
      "washer",
      "toilet",
      "dogtag",
      "keg",
      "boom0",
      "boom1",
      "boom2",
      "boom3",
      "drone",
      "bullet",
      "shell",
      "rocket",
      "church",
      "ruin",
      "tree",
      "flowers",
      "shiba",
      "moto",
      "riot",
      "kamikaze",
      "k9",
    ];
    for (const key of files) this.load.image(key, `/sprites/${key}.png`);
    this.load.image("ground", "/sprites/ground.jpg");
  }

  create() {
    this.paintFx();
    this.bg = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-50);

    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD, WORLD);
    cam.setZoom(this.scale.height < 460 ? 0.92 : 1.08);
    this.scale.on("resize", this.onResize, this);

    this.scatterProps();

    this.enemies = this.physics.add.group({ maxSize: 180, runChildUpdate: false });
    this.bullets = this.physics.add.group({ maxSize: 260, runChildUpdate: false });
    this.hostile = this.physics.add.group({ maxSize: 140, runChildUpdate: false });
    this.gems = this.physics.add.group({ maxSize: 160, runChildUpdate: false });
    this.fx = this.add.group({ maxSize: 64, classType: Phaser.GameObjects.Sprite });
    this.loots = this.add.group({ maxSize: 120, classType: Phaser.GameObjects.Sprite });
    this.shields = this.add.group({ maxSize: 70, classType: Phaser.GameObjects.Sprite });

    this.player = this.physics.add.sprite(WORLD / 2, WORLD / 2, "pavel-loud");
    this.dress(this.player, "pavel-loud", 78, 0.34);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    cam.startFollow(this.player, true, 0.14, 0.14);

    this.decoy = this.physics.add.sprite(-400, -400, "washer");
    this.decoy.setActive(false).setVisible(false);
    (this.decoy.body as Phaser.Physics.Arcade.Body).enable = false;
    this.beacon = this.add.sprite(-400, -400, "ring").setVisible(false).setDepth(4);

    this.dog = this.add.sprite(this.player.x, this.player.y, "shiba").setVisible(false).setDepth(9);
    this.dressImage(this.dog, "shiba", 48);

    this.floaters = [];
    for (let i = 0; i < 40; i++) {
      const t = this.add
        .text(0, 0, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffe66d",
          stroke: "#140e06",
          strokeThickness: 4,
        })
        .setActive(false)
        .setVisible(false)
        .setDepth(4000)
        .setOrigin(0.5, 1);
      this.floaters.push(t);
    }

    const keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE",
    ) as GameScene["cursors"];
    this.cursors = keys;
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
    window.addEventListener("keydown", this.onWinKeyDown, true);
    window.addEventListener("keyup", this.onWinKeyUp, true);
    window.addEventListener("blur", this.onWinBlur);

    this.physics.add.overlap(this.bullets, this.enemies, (a, b) => {
      this.onFriendlyHit(a as Phaser.Physics.Arcade.Sprite, b as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.hostile, this.player, (a) => {
      const shot = a as Phaser.Physics.Arcade.Sprite;
      const bd = shot.getData("bd") as BData;
      this.hurtPlayer(bd?.dmg ?? 8);
      this.recycle(shot);
    });
    this.physics.add.overlap(this.enemies, this.player, (enemy) => {
      this.touchEnemy(enemy as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.enemies, this.decoy, (enemy) => {
      this.touchDecoy(enemy as Phaser.Physics.Arcade.Sprite);
    });
    for (const block of this.blocks) this.physics.add.collider(this.player, block);

    this.bindBus();
    this.exposeProbe();
    this.events.once("shutdown", () => this.teardown());
    this.pushStats();
    this.banner("DEPLOYED — HOLD THE FIELD", "#ffd60a");
  }

  update(_time: number, deltaMs: number) {
    if (!this.alive) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.timeSurvived += dt;
    this.bg.setSize(this.scale.width, this.scale.height);
    const cam = this.cameras.main;
    this.bg.tilePositionX = cam.scrollX;
    this.bg.tilePositionY = cam.scrollY;

    this.readMove(dt);
    this.tickStealth(dt);
    this.tickWeapons(dt);
    this.tickEnemies(dt);
    this.tickBullets(dt, this.bullets);
    this.tickBullets(dt, this.hostile);
    this.tickGems(dt);
    this.tickFx(dt);
    this.tickFloaters(dt);
    this.tickDog(dt);
    this.tickPlayerLook();

    if (this.timeSurvived >= this.nextBoss) {
      this.nextBoss += 180;
      this.spawnBoss();
    }
    this.spawnAcc += dt;
    const interval = clamp(0.72 - this.timeSurvived * 0.00215, 0.11, 0.72);
    const cap = Math.min(168, 16 + Math.floor(this.timeSurvived / 3));
    if (this.spawnAcc >= interval && this.activeCount(this.enemies) < cap) {
      this.spawnAcc = 0;
      this.spawnEnemy(this.rollKind());
      if (this.timeSurvived > 8 && this.activeCount(this.enemies) < cap) this.spawnEnemy("conscript");
      if (this.timeSurvived > 28 && Math.random() < 0.7 && this.activeCount(this.enemies) < cap) {
        this.spawnEnemy("conscript");
      }
      if (this.timeSurvived > 70 && Math.random() < 0.5 && this.activeCount(this.enemies) < cap) {
        this.spawnEnemy(this.rollKind());
      }
      if (this.timeSurvived > 140 && Math.random() < 0.45 && this.activeCount(this.enemies) < cap) {
        this.spawnEnemy("conscript");
      }
    }
    this.swarmAcc -= dt;
    if (this.swarmAcc <= 0) {
      this.swarmAcc = clamp(10.5 - this.timeSurvived * 0.016, 3.6, 10.5);
      if (this.timeSurvived > 22) {
        const n = 3 + Math.floor(this.timeSurvived / 65);
        for (let i = 0; i < n && this.activeCount(this.enemies) < cap; i++) this.spawnEnemy("kamikaze");
      }
    }
    this.squadAcc -= dt;
    if (this.squadAcc <= 0) {
      this.squadAcc = clamp(15 - this.timeSurvived * 0.018, 7, 15);
      if (this.timeSurvived > 18) {
        const n = this.timeSurvived > 110 ? 5 : 3;
        for (let i = 0; i < n && this.activeCount(this.enemies) < cap; i++) this.spawnEnemy("riot");
      }
    }

    this.statsAcc += dt;
    if (this.statsAcc >= 0.25) {
      this.statsAcc = 0;
      this.pushStats();
    }
  }

  private bindBus() {
    const onToggle = () => {
      if (!this.choosing && this.alive) this.toggleStealth();
    };
    const onJoy = (v: { x: number; y: number }) => {
      this.joy.x = v.x;
      this.joy.y = v.y;
    };
    const onUp = (id: string) => this.pickUpgrade(id);
    const onMute = (m: boolean) => {
      synth.muted = m;
    };
    const onShake = (s: boolean) => {
      this.shakeOn = s;
    };
    const onPause = () => {
      if (this.choosing || !this.alive) return;
      this.scene.pause();
      this.physics.pause();
    };
    const onResume = () => {
      if (this.choosing || !this.alive) return;
      this.scene.resume();
      this.physics.resume();
    };
    this.unsubs = [
      bus.on("toggle-stealth", onToggle),
      bus.on("joystick-move", onJoy),
      bus.on("select-upgrade", onUp),
      bus.on("set-muted", onMute),
      bus.on("set-shake", onShake),
      bus.on("pause-game", onPause),
      bus.on("resume-game", onResume),
    ];
  }

  private onResize = () => {
    if (!this.cameras?.main) return;
    this.cameras.main.setZoom(this.scale.height < 460 ? 0.92 : 1.08);
  };

  private teardown() {
    this.scale.off("resize", this.onResize, this);
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onWinKeyDown, true);
      window.removeEventListener("keyup", this.onWinKeyUp, true);
      window.removeEventListener("blur", this.onWinBlur);
      delete window.__controlsTest;
      delete window.__flannel;
    }
  }

  private onWinKeyDown = (event: KeyboardEvent) => {
    this.held.add(event.code);
  };

  private onWinKeyUp = (event: KeyboardEvent) => {
    this.held.delete(event.code);
  };

  private onWinBlur = () => {
    this.held.clear();
    this.spaceWas = false;
  };

  private exposeProbe() {
    const self = this;
    window.__controlsTest = {
      getYaw: () => Math.atan2(self.dashY, self.dashX),
      getSpeed: () => {
        const b = self.player.body as Phaser.Physics.Arcade.Body;
        return Math.hypot(b.velocity.x, b.velocity.y);
      },
      getX: () => self.player.x,
      getY: () => self.player.y,
      setKeys: (codes: string[]) => {
        self.injected = new Set(codes);
      },
      setSteer: () => {},
    };
    window.__flannel = {
      grantXp: (n: number) => self.addXp(n),
      dump: () => ({
        x: self.player.x,
        y: self.player.y,
        hp: self.hp,
        level: self.level,
        kills: self.kills,
        stealth: self.stealth,
      }),
    };
  }

  private paintFx() {
    const paint = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      draw(ctx);
      this.textures.addCanvas(key, c);
    };
    paint("loot", 54, 18, (ctx) => {
      ctx.fillStyle = "#fff6d8";
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 3;
      ctx.font = "bold 12px Courier New";
      ctx.strokeText("LOOT!", 2, 14);
      ctx.fillText("LOOT!", 2, 14);
    });
    paint("ring", 96, 96, (ctx) => {
      ctx.strokeStyle = "#7ad0ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(48, 48, 36, 0, Math.PI * 2);
      ctx.stroke();
    });
    paint("brick", 18, 12, (ctx) => {
      ctx.fillStyle = "#c44536";
      ctx.fillRect(0, 0, 18, 12);
      ctx.strokeStyle = "#1a0d0a";
      ctx.strokeRect(0.5, 0.5, 17, 11);
    });
    paint("flame", 48, 48, (ctx) => {
      ctx.fillStyle = "#ff7b00";
      ctx.beginPath();
      ctx.arc(24, 28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd60a";
      ctx.beginPath();
      ctx.arc(24, 26, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    paint("tire", 18, 8, (ctx) => {
      ctx.fillStyle = "rgba(20,16,10,0.85)";
      ctx.fillRect(0, 2, 18, 4);
    });
    paint("sniff", 70, 18, (ctx) => {
      ctx.fillStyle = "#ffd6a0";
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 3;
      ctx.font = "bold 12px Courier New";
      ctx.strokeText("SNIFF", 2, 14);
      ctx.fillText("SNIFF", 2, 14);
    });
    paint("shield", 48, 30, (ctx) => {
      ctx.fillStyle = "#1d4e89";
      ctx.strokeStyle = "#071018";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 3);
      ctx.lineTo(42, 3);
      ctx.quadraticCurveTo(46, 15, 42, 27);
      ctx.lineTo(6, 27);
      ctx.quadraticCurveTo(2, 15, 6, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd60a";
      ctx.fillRect(8, 13, 32, 4);
    });
  }

  private scatterProps() {
    const center = WORLD / 2;
    for (let i = 0; i < 46; i++) {
      const x = 140 + Math.random() * (WORLD - 280);
      const y = 140 + Math.random() * (WORLD - 280);
      if (Math.hypot(x - center, y - center) < 240) continue;
      const roll = Math.random();
      const key = roll < 0.34 ? "tree" : roll < 0.55 ? "flowers" : roll < 0.78 ? "ruin" : "church";
      const solid = key === "church" || key === "ruin";
      if (solid) {
        const s = this.physics.add.staticImage(x, y, key);
        const target = key === "church" ? 150 : 130;
        s.setScale(target / s.height);
        s.setDepth(y);
        const body = s.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(s.width * 0.34, s.height * 0.28);
        body.setOffset(s.width * 0.33, s.height * 0.55);
        s.refreshBody();
        this.blocks.push(s);
      } else {
        const s = this.add.image(x, y, key);
        s.setScale((key === "tree" ? 130 : 90) / s.height);
        s.setDepth(y);
      }
    }
  }

  private dress(sprite: Phaser.Physics.Arcade.Sprite, key: string, height: number, hit: number) {
    sprite.setTexture(key);
    const frame = sprite.frame;
    sprite.setScale(height / frame.height);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const rw = frame.width * hit;
    const rh = frame.height * hit;
    body.setSize(rw, rh);
    body.setOffset((frame.width - rw) / 2, frame.height * (0.62 - hit * 0.3));
  }

  private dressImage(sprite: Phaser.GameObjects.Sprite, key: string, height: number) {
    sprite.setTexture(key);
    sprite.setScale(height / sprite.frame.height);
  }

  private readMove(dt: number) {
    const down = (code: string, key?: Phaser.Input.Keyboard.Key) =>
      this.held.has(code) || this.injected.has(code) || !!key?.isDown;
    let kx = 0;
    let ky = 0;
    if (down("KeyA", this.cursors.A) || down("ArrowLeft", this.cursors.LEFT)) kx -= 1;
    if (down("KeyD", this.cursors.D) || down("ArrowRight", this.cursors.RIGHT)) kx += 1;
    if (down("KeyW", this.cursors.W) || down("ArrowUp", this.cursors.UP)) ky -= 1;
    if (down("KeyS", this.cursors.S) || down("ArrowDown", this.cursors.DOWN)) ky += 1;
    const klen = Math.hypot(kx, ky);
    if (klen > 0) {
      kx /= klen;
      ky /= klen;
    }
    const jlen = Math.hypot(this.joy.x, this.joy.y);
    const usingJoy = jlen > 0.14;
    let mx = usingJoy ? this.joy.x : kx;
    let my = usingJoy ? this.joy.y : ky;
    const mlen = Math.hypot(mx, my);
    if (mlen > 1) {
      mx /= mlen;
      my /= mlen;
    }
    if (mlen > 0.05) {
      this.faceX = mx < 0 ? -1 : 1;
      this.dashX = mx;
      this.dashY = my;
    }

    const space = down("Space", this.cursors.SPACE);
    if (space && !this.spaceWas) this.toggleStealth();
    this.spaceWas = space;

    const speed = 168 * (this.stealth ? 1.4 : 1);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.dashTick -= dt;
      body.setVelocity(this.dashX * 520, this.dashY * 520);
      if (this.dashTick <= 0) {
        this.dashTick = 0.08;
        this.aoe(this.player.x, this.player.y, 46, 8 * this.dmgMul(), 40);
        this.puff(this.player.x, this.player.y + 20, "tire", 0.35, 28);
      }
      if (this.dashT <= 0) body.setVelocity(0, 0);
    } else {
      body.setVelocity(mx * speed, my * speed);
    }
    if (this.iFrame > 0) {
      this.iFrame -= dt;
      this.player.setAlpha(Math.sin(this.timeSurvived * 40) > 0 ? 1 : 0.45);
    } else this.player.setAlpha(1);
  }

  private tickPlayerLook() {
    const key = this.stealth ? "pavel-stealth" : "pavel-loud";
    if (this.player.texture.key !== key) this.dress(this.player, key, 78, 0.34);
    this.player.setFlipX(this.faceX < 0);
    const moving = Math.hypot(
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.x,
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.y,
    );
    this.player.setRotation(moving > 8 ? Math.sin(this.timeSurvived * 14) * 0.05 : 0);
    this.player.setDepth(this.player.y);
  }

  private toggleStealth() {
    if (this.stealth) this.exitStealth();
    else this.enterStealth();
  }

  private enterStealth() {
    if (this.battery < 0.15 || this.dashT > 0) return;
    this.stealth = true;
    this.stacks = 0;
    this.overAcc = 0;
    const golden = this.level >= 6 || this.weapons.some((w) => w.level >= 3);
    this.decoy.enableBody(true, this.player.x, this.player.y, true, true);
    this.dress(this.decoy, golden ? "toilet" : "washer", 74, 0.42);
    this.decoy.setActive(true).setVisible(true);
    const body = this.decoy.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setVelocity(0, 0);
    this.decoy.setDepth(this.decoy.y);
    this.beacon.setVisible(true).setPosition(this.decoy.x, this.decoy.y);
    synth.stealth();
    this.banner("FLANNEL MODE", "#7ad0ff");
  }

  private exitStealth() {
    if (!this.stealth) return;
    this.stealth = false;
    const stacks = this.stacks;
    this.ambushStacks = stacks;
    this.ambushT = 3;
    const x = this.decoy.active ? this.decoy.x : this.player.x;
    const y = this.decoy.active ? this.decoy.y : this.player.y;
    this.decoy.disableBody(true, true);
    this.beacon.setVisible(false);
    const mul = 1 + stacks * 0.25;
    const area = 1 + stacks * 0.2;
    this.explode(x, y, 1.3);
    this.aoe(x, y, 110 * area, 48 * mul, 220);
    if (this.ranks.lumberjack > 0) {
      this.aoe(this.player.x, this.player.y, 100 + this.ranks.lumberjack * 16, 12 * this.ranks.lumberjack * mul, 260);
    }
    for (const w of this.weapons) w.timer = 0;
    if (this.has("artillery")) this.barrage(x, y, area, mul);
    if (this.has("drone")) this.swarm(x, y, mul);
    if (this.has("mlrs")) this.blanket(x, y, area, mul);
    if (this.has("moto")) {
      this.dashT = 2.5;
      this.dashTick = 0;
      if (Math.hypot(this.dashX, this.dashY) < 0.1) {
        this.dashX = this.faceX;
        this.dashY = 0;
      }
      synth.moto();
    }
    if (this.shakeOn) this.cameras.main.shake(220, 0.012 + stacks * 0.002);
    synth.ambush();
    this.banner(`ARTICLE 5  x${mul.toFixed(1)}`, "#ffb703");
  }

  private tickStealth(dt: number) {
    if (this.stealth) {
      this.battery -= dt;
      this.overAcc += dt;
      while (this.overAcc >= 0.5) {
        this.overAcc -= 0.5;
        this.stacks += 1;
      }
      this.beacon.setPosition(this.decoy.x, this.decoy.y);
      this.beacon.setScale(1 + Math.sin(this.timeSurvived * 8) * 0.12);
      this.beacon.setAlpha(0.55 + Math.sin(this.timeSurvived * 10) * 0.25);
      if (this.battery <= 0) {
        this.battery = 0;
        this.exitStealth();
      }
    } else {
      this.battery = Math.min(this.maxBattery, this.battery + this.recharge * dt);
      if (this.ambushT > 0) this.ambushT -= dt;
    }
  }

  private dmgMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.25 : 1;
  }
  private rateMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.2 : 1;
  }
  private areaMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.2 : 1;
  }

  private has(id: WeaponId) {
    return this.weapons.some((w) => w.id === id);
  }
  private wlevel(id: WeaponId) {
    return this.weapons.find((w) => w.id === id)?.level ?? 0;
  }

  private tickWeapons(dt: number) {
    if (this.stealth || this.dashT > 0) return;
    const rate = this.rateMul();
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

  private fireBren(level: number) {
    const target = this.nearest(this.player.x, this.player.y, false);
    const ang = target
      ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
      : this.faceX < 0
        ? Math.PI
        : 0;
    const pierce = this.ambushT > 0 ? 12 : 1;
    const dmg = (8 + (level - 1) * 4) * this.dmgMul();
    this.shoot(this.player.x, this.player.y, ang, 560, dmg, pierce, false, "bullet", 0.7, 0);
    if (level >= 4) {
      this.shoot(this.player.x, this.player.y, ang + 0.12, 560, dmg * 0.8, pierce, false, "bullet", 0.7, 0);
    }
    synth.shoot();
  }

  private dropShellOnCluster(level: number) {
    const list = this.living();
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)]!;
    const dmg = (26 + (level - 1) * 8) * this.dmgMul();
    const r = (52 + level * 4) * this.areaMul();
    this.queueShell(pick.x, pick.y, r, dmg);
  }

  private barrage(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("artillery");
    const dmg = (30 + level * 6) * mul;
    const r = 48 * area;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.queueShell(x + Math.cos(a) * 78, y + Math.sin(a) * 78, r, dmg);
    }
  }

  private queueShell(x: number, y: number, r: number, dmg: number) {
    const sprite = this.fx.get(x, y - 80, "shell") as Phaser.GameObjects.Sprite | null;
    if (!sprite) {
      this.time.delayedCall(400, () => this.aoe(x, y, r, dmg, 80));
      return;
    }
    sprite.setActive(true).setVisible(true).setDepth(3500);
    sprite.setScale(0.9);
    this.shells.push({ sprite, life: 0.45, x, y, r, dmg });
  }

  private launchDrone(level: number, turbo: boolean) {
    const ang = Math.random() * Math.PI * 2;
    const dmg = (14 + (level - 1) * 5) * (turbo ? this.dmgMul() : 1) * (turbo ? 1.3 : 1);
    this.shoot(
      this.player.x,
      this.player.y,
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

  private swarm(x: number, y: number, mul: number) {
    const level = this.wlevel("drone");
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      this.shoot(x, y, ang, 300, (16 + level * 4) * mul, 1, true, "drone", 3.4, 40);
    }
  }

  private ghostBike(level: number) {
    const ang = Math.atan2(this.dashY, this.dashX || this.faceX);
    const dmg = (18 + level * 6) * this.dmgMul();
    this.shoot(this.player.x, this.player.y, ang, 380, dmg, 20, false, "moto", 1.6, 0);
    synth.moto();
  }

  private salvo(level: number) {
    const n = 3 + level;
    const dmg = (12 + level * 3) * this.dmgMul();
    for (let i = 0; i < n; i++) {
      const y = this.player.y + (i - (n - 1) / 2) * 28;
      const ang = this.faceX < 0 ? Math.PI : 0;
      this.shoot(this.player.x - this.faceX * 20, y, ang, 340, dmg, 3, false, "rocket", 1.5, 28);
    }
    synth.shoot();
  }

  private blanket(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("mlrs");
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dist = 30 + (i % 3) * 36;
      const fx = this.fx.get(x, y, "flame") as Phaser.GameObjects.Sprite | null;
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

  private shoot(
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
    friendly = true,
  ): Phaser.Physics.Arcade.Sprite | null {
    const group = friendly ? this.bullets : this.hostile;
    const s = group.get(x, y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return null;
    s.enableBody(true, x, y, true, true);
    s.setTexture(key);
    const h = key === "moto" ? 54 : key === "drone" ? 36 : key === "rocket" ? 28 : 18;
    this.dress(s, key, h, key === "moto" ? 0.7 : 0.55);
    s.setDepth(2500);
    s.setFlipX(false);
    const bd = this.bd(s);
    bd.dmg = dmg;
    bd.life = life;
    bd.pierce = pierce;
    bd.homing = homing;
    bd.speed = speed;
    bd.vx = Math.cos(ang) * speed;
    bd.vy = Math.sin(ang) * speed;
    bd.friendly = friendly;
    bd.hit = [];
    bd.aoe = aoe;
    bd.tick = 0;
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(bd.vx, bd.vy);
    body.setAllowGravity(false);
    s.rotation = ang;
    return s;
  }

  private bd(s: Phaser.Physics.Arcade.Sprite): BData {
    let d = s.getData("bd") as BData | undefined;
    if (!d) {
      d = {
        dmg: 0,
        life: 0,
        pierce: 1,
        homing: false,
        speed: 0,
        vx: 0,
        vy: 0,
        friendly: true,
        hit: [],
        aoe: 0,
        tick: 0,
      };
      s.setData("bd", d);
    }
    return d;
  }

  private ed(s: Phaser.Physics.Arcade.Sprite): EData {
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

  private tickBullets(dt: number, group: Phaser.Physics.Arcade.Group) {
    const kids = group.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      const b = this.bd(s);
      b.life -= dt;
      if (b.life <= 0) {
        if (b.aoe > 0 && b.friendly) this.aoe(s.x, s.y, b.aoe, b.dmg * 0.6, 40);
        this.recycle(s);
        continue;
      }
      if (b.homing) {
        const target = b.friendly ? this.toughest() : this.player;
        if (target) {
          const ang = Math.atan2(target.y - s.y, target.x - s.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = ang - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = b.friendly ? 4.2 : 1.4;
          const next = cur + clamp(diff, -turn * dt, turn * dt);
          b.vx = Math.cos(next) * b.speed;
          b.vy = Math.sin(next) * b.speed;
        }
      }
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(b.vx, b.vy);
      s.rotation = Math.atan2(b.vy, b.vx);
      if (s.x < -80 || s.y < -80 || s.x > WORLD + 80 || s.y > WORLD + 80) this.recycle(s);
    }
  }

  private onFriendlyHit(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !enemy.active) return;
    const b = this.bd(bullet);
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
        this.floater(enemy.x + Math.cos(e.aim) * 18, enemy.y + Math.sin(e.aim) * 18, "BLOCK", "#9ad7ff");
        this.recycle(bullet);
        return;
      }
      dmg *= 2.15;
    }
    this.damageEnemy(enemy, dmg, b.vx, b.vy);
    if (b.aoe > 0) this.aoe(enemy.x, enemy.y, b.aoe, b.dmg * 0.45, 30);
    if (b.hit.length >= b.pierce) this.recycle(bullet);
  }

  private tickEnemies(dt: number) {
    const lure = this.decoy.active;
    const kids = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const active: Phaser.Physics.Arcade.Sprite[] = [];
    for (const s of kids) {
      if (!s.active) continue;
      active.push(s);
      const e = this.ed(s);
      const tx = lure ? this.decoy.x : this.player.x;
      const ty = lure ? this.decoy.y : this.player.y;
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
          const shot = this.shoot(s.x, s.y, ang, 190, 13 * this.pressure(), 1, false, "bullet", 1.4, 0, false);
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
        const desired = Math.atan2(this.player.y - s.y, this.player.x - s.x);
        const turn = this.stealth ? 0.65 : 2.6;
        e.aim = this.turnToward(e.aim, desired, turn * dt);
        const spd = e.speed * (this.stealth ? 0.5 : 1);
        vx = Math.cos(e.aim) * spd;
        vy = Math.sin(e.aim) * spd;
        e.face = vx < 0 ? -1 : 1;
      } else if (e.kind === "kamikaze") {
        const wob = Math.sin(this.timeSurvived * 10 + e.id) * 0.22;
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
          const ang = Math.atan2(this.player.y - s.y, this.player.x - s.x);
          const shot = this.shoot(s.x, s.y, ang, 150, 22 * this.pressure(), 1, true, "rocket", 5, 0, false);
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
      const showSniff = e.kind === "dog" && this.stealth;
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
    // light separation so piles stay readable but still clump on the washer
    const limit = lure ? 13 : 20;
    for (let i = 0; i < active.length; i++) {
      const a = active[i]!;
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 4 && d2 < limit * limit) {
          const d = Math.sqrt(d2);
          const push = ((limit - d) / limit) * 14;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private touchEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active || !this.alive) return;
    const e = this.ed(enemy);
    if (e.kind === "boss" && this.stealth) {
      this.popBoss(enemy);
      return;
    }
    if (e.kind === "kamikaze") {
      const dmg = e.touch;
      const x = enemy.x;
      const y = enemy.y;
      this.killEnemy(enemy, false);
      if (Math.hypot(this.player.x - x, this.player.y - y) < 46) this.hurtPlayer(dmg, false, false);
      return;
    }
    if (e.hitCd > 0) return;
    if (e.kind === "dog") {
      if (this.dashT > 0) return;
      e.hitCd = 0.42;
      this.hurtPlayer(e.touch, true, false);
      return;
    }
    if (this.stealth || this.dashT > 0) return;
    e.hitCd = 0.4;
    this.hurtPlayer(e.touch, false, false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const ang = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    body.velocity.x += Math.cos(ang) * 90;
    body.velocity.y += Math.sin(ang) * 90;
  }

  private touchDecoy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.decoy.active || !enemy.active) return;
    const e = this.ed(enemy);
    if (e.kind !== "cart" && e.kind !== "kamikaze") return;
    const x = enemy.x;
    const y = enemy.y;
    const boom = e.kind === "kamikaze" ? 96 : 78;
    const dmg = e.kind === "kamikaze" ? 28 : 22;
    this.killEnemy(enemy, false);
    this.explode(x, y, 0.9);
    this.aoe(x, y, boom, dmg, 140);
  }

  private hurtPlayer(amount: number, throughStealth = false, honorIFrame = true) {
    if (!this.alive || this.dashT > 0) return;
    if (this.stealth && !throughStealth) return;
    if (honorIFrame && this.iFrame > 0) return;
    this.hp -= amount;
    this.iFrame = Math.max(this.iFrame, 0.16);
    synth.hurt();
    if (this.shakeOn) this.cameras.main.shake(90, 0.008);
    this.floater(this.player.x, this.player.y - 30, `-${Math.round(amount)}`, "#ff5d73");
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, amount: number, kx = 0, ky = 0) {
    if (!enemy.active) return;
    const e = this.ed(enemy);
    e.hp -= amount;
    enemy.setTint(0xfff1f1);
    this.time.delayedCall(40, () => {
      if (enemy.active) enemy.clearTint();
    });
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    const len = Math.hypot(kx, ky) || 1;
    body.velocity.x += (kx / len) * 40;
    body.velocity.y += (ky / len) * 40;
    if (amount >= 12) this.floater(enemy.x, enemy.y - 20, `${Math.round(amount)}`, "#ffe66d");
    if (e.hp <= 0) this.killEnemy(enemy, false);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite, popped: boolean) {
    if (!enemy.active) return;
    const e = this.ed(enemy);
    const x = enemy.x;
    const y = enemy.y;
    const kind = e.kind;
    const loot = enemy.getData("loot") as Phaser.GameObjects.Sprite | null;
    if (loot?.active) loot.setActive(false).setVisible(false);
    enemy.setData("loot", null);
    this.dropShield(enemy);
    enemy.disableBody(true, true);
    this.kills += 1;
    this.explode(x, y, kind === "boss" ? 1.4 : kind === "kamikaze" ? 0.85 : 0.55);
    if (kind === "cart") this.aoe(x, y, 64, 18, 80);
    if (kind === "kamikaze") this.aoe(x, y, 74, 16, 100);
    if (kind === "boss") {
      this.bossCount = Math.max(0, this.bossCount);
      for (let i = 0; i < 8; i++) this.spawnGem(x + (Math.random() - 0.5) * 40, y, 8);
      if (popped) synth.pop();
    } else {
      const gem =
        kind === "turtle" ? 10 : kind === "riot" ? 8 : kind === "dog" ? 6 : kind === "cart" ? 6 : kind === "kamikaze" ? 3 : 3;
      this.spawnGem(x, y, gem);
      if (Math.random() < (kind === "turtle" || kind === "riot" ? 0.16 : 0.05)) this.spawnGem(x, y, 0, true);
    }
  }

  private popBoss(enemy: Phaser.Physics.Arcade.Sprite) {
    this.floater(enemy.x, enemy.y - 40, "POP!", "#7af0ff");
    this.killEnemy(enemy, true);
    this.aoe(enemy.x, enemy.y, 130, 20, 160);
    if (this.shakeOn) this.cameras.main.shake(180, 0.01);
  }

  private aoe(x: number, y: number, radius: number, damage: number, knock: number) {
    const kids = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > radius) continue;
      const falloff = 1 - (d / radius) * 0.45;
      const ang = Math.atan2(s.y - y, s.x - x);
      this.damageEnemy(s, damage * falloff, Math.cos(ang) * knock, Math.sin(ang) * knock);
    }
  }

  private spawnEnemy(kind: Kind) {
    const cam = this.cameras.main;
    const dist = (Math.max(cam.width, cam.height) * 0.62) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    let x = clamp(this.player.x + Math.cos(ang) * dist, 80, WORLD - 80);
    let y = clamp(this.player.y + Math.sin(ang) * dist, 80, WORLD - 80);
    if (Math.hypot(x - this.player.x, y - this.player.y) < 140) {
      x = clamp(this.player.x + Math.cos(ang) * (dist + 120), 80, WORLD - 80);
      y = clamp(this.player.y + Math.sin(ang) * (dist + 120), 80, WORLD - 80);
    }
    this.birth(kind, x, y);
  }

  private spawnBoss() {
    this.banner("INFLATABLE S-400 — POP IT IN FLANNEL", "#ff5d73");
    synth.boom();
    const ang = Math.random() * Math.PI * 2;
    const x = clamp(this.player.x + Math.cos(ang) * 420, 120, WORLD - 120);
    const y = clamp(this.player.y + Math.sin(ang) * 420, 120, WORLD - 120);
    this.bossCount += 1;
    this.birth("boss", x, y);
  }

  private birth(kind: Kind, x: number, y: number) {
    const s = this.enemies.get(x, y, KIND_TEX[kind]) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return;
    s.enableBody(true, x, y, true, true);
    s.clearTint();
    const scale = 1 + this.timeSurvived / 70;
    const pressure = this.pressure();
    const base =
      kind === "boss"
        ? 680 * (1 + Math.max(0, this.bossCount - 1) * 0.5)
        : kind === "turtle"
          ? 110
          : kind === "riot"
            ? 72
            : kind === "cart"
              ? 32
              : kind === "dog"
                ? 28
                : kind === "tiktok"
                  ? 18
                  : kind === "kamikaze"
                    ? 10
                    : 22;
    const hp = base * (kind === "boss" ? 1 : scale);
    const height =
      kind === "boss"
        ? 150
        : kind === "turtle"
          ? 86
          : kind === "riot"
            ? 80
            : kind === "cart"
              ? 72
              : kind === "kamikaze"
                ? 54
                : kind === "dog"
                  ? 60
                  : 64;
    this.dress(s, KIND_TEX[kind], height, kind === "boss" ? 0.42 : kind === "kamikaze" ? 0.5 : 0.36);
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
    const dir = Math.atan2(this.player.y - y, this.player.x - x);
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

  private rollKind(): Kind {
    const t = this.timeSurvived;
    const bag: Kind[] = ["conscript", "conscript", "conscript", "conscript"];
    if (t > 12) bag.push("tiktok", "conscript");
    if (t > 24) bag.push("dog", "riot", "conscript");
    if (t > 45) bag.push("cart", "tiktok", "dog");
    if (t > 75) bag.push("turtle", "riot", "kamikaze", "conscript");
    if (t > 130) bag.push("turtle", "dog", "riot");
    if (t > 200) bag.push("kamikaze", "cart", "turtle");
    return bag[Math.floor(Math.random() * bag.length)]!;
  }

  private pressure() {
    return 1 + this.timeSurvived / 90;
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

  private spawnGem(x: number, y: number, value: number, keg = false) {
    const key = keg ? "keg" : "dogtag";
    const s = this.gems.get(x, y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) {
      if (!keg) this.addXp(value);
      return;
    }
    s.enableBody(true, x, y, true, true);
    this.dress(s, key, keg ? 36 : 26, 0.6);
    s.setData("v", value);
    s.setData("keg", keg);
    s.setData("idle", 0.35);
    s.setDepth(8);
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
  }

  private tickGems(dt: number) {
    const magnet = 78 + (this.stealth && this.ranks.nafo > 0 ? 130 + this.ranks.nafo * 30 : 0);
    const kids = this.gems.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      const idle = (s.getData("idle") as number) - dt;
      s.setData("idle", idle);
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (idle <= 0 && d < magnet) {
        const body = s.body as Phaser.Physics.Arcade.Body;
        const pull = 220 + (magnet - d);
        body.setVelocity((dx / d) * pull, (dy / d) * pull);
      }
      if (d < 28) {
        const keg = !!s.getData("keg");
        if (keg) {
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.22);
          this.battery = Math.min(this.maxBattery, this.battery + 1.6);
          this.floater(s.x, s.y, "PILSNER", "#ffd60a");
          synth.pickup();
        } else {
          this.addXp((s.getData("v") as number) || 4);
          synth.pickup();
        }
        s.disableBody(true, true);
      }
    }
  }

  private addXp(n: number) {
    if (!this.alive) return;
    this.xp += n;
    if (this.xp >= this.xpNeed && !this.choosing) this.openLevel();
  }

  private openLevel() {
    if (!this.alive || this.choosing) return;
    if (this.xp < this.xpNeed) return;
    this.xp -= this.xpNeed;
    this.level += 1;
    this.xpNeed = Math.round(30 + this.level * 14);
    this.hp = Math.min(this.maxHp, this.hp + 8);
    this.choosing = true;
    const offers = this.rollOffers();
    synth.level();
    bus.emit("trigger-level-up", offers);
    this.physics.pause();
    this.scene.pause();
  }

  private rollOffers(): UpgradeOffer[] {
    const pool: UpgradeOffer[] = [];
    for (const w of WEAPONS) {
      const owned = this.wlevel(w.id);
      if (owned < WEAPON_MAX_RANK) pool.push(offerFor(w.id, owned + 1));
    }
    for (const p of PASSIVES) {
      const owned = this.ranks[p.id];
      if (owned < PASSIVE_MAX_RANK) pool.push(offerFor(p.id, owned + 1));
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }
    if (pool.length >= 3) return pool.slice(0, 3);
    while (pool.length < 3 && pool.length > 0) pool.push(pool[pool.length % Math.max(1, pool.length)]!);
    if (!pool.length) pool.push(offerFor("bren", Math.min(WEAPON_MAX_RANK, this.wlevel("bren") + 1)));
    return pool.slice(0, 3);
  }

  private pickUpgrade(id: string) {
    if (!this.choosing) return;
    const weapon = WEAPONS.find((w) => w.id === id);
    if (weapon) {
      const existing = this.weapons.find((w) => w.id === weapon.id);
      if (existing) existing.level = Math.min(WEAPON_MAX_RANK, existing.level + 1);
      else this.weapons.push({ id: weapon.id, level: 1, timer: 0.2 });
    } else if (id === "lumberjack" || id === "pilsner" || id === "nafo") {
      const pid = id as PassiveId;
      if (this.ranks[pid] < PASSIVE_MAX_RANK) {
        this.ranks[pid] += 1;
        if (pid === "lumberjack") {
          const gain = this.maxHp * 0.25;
          this.maxHp += gain;
          this.hp += gain;
        }
        if (pid === "pilsner") {
          this.maxBattery += 1.5;
          this.recharge *= 1.25;
          this.battery = this.maxBattery;
        }
        if (pid === "nafo") this.dog.setVisible(true);
      }
    }
    this.banner(id.toUpperCase(), "#38b000");
    if (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level += 1;
      this.xpNeed = Math.round(30 + this.level * 14);
      this.pushStats();
      bus.emit("trigger-level-up", this.rollOffers());
      synth.level();
      return;
    }
    this.choosing = false;
    bus.emit("level-clear", null);
    this.scene.resume();
    this.physics.resume();
    this.pushStats();
  }

  private tickDog(dt: number) {
    if (this.ranks.nafo <= 0) return;
    this.dog.setVisible(true);
    const tx = this.player.x - this.faceX * 36;
    const ty = this.player.y + 18;
    this.dog.x += (tx - this.dog.x) * Math.min(1, dt * 6);
    this.dog.y += (ty - this.dog.y) * Math.min(1, dt * 6);
    this.dog.setDepth(this.dog.y);
    this.dog.setFlipX(this.faceX < 0);
    this.brickT -= dt;
    if (this.brickT <= 0) {
      this.brickT = Math.max(0.45, 1.3 - this.ranks.nafo * 0.2);
      const target = this.nearest(this.dog.x, this.dog.y, false);
      if (target) {
        const ang = Math.atan2(target.y - this.dog.y, target.x - this.dog.x);
        this.shoot(this.dog.x, this.dog.y, ang, 260, 8 + this.ranks.nafo * 4, 1, false, "brick", 1.2, 0);
      }
    }
  }

  private tickFx(dt: number) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i]!;
      sh.life -= dt;
      const p = 1 - Math.max(0, sh.life) / 0.45;
      sh.sprite.setPosition(sh.x, sh.y - (1 - p) * 90);
      if (sh.life <= 0) {
        this.explode(sh.x, sh.y, 0.9);
        this.aoe(sh.x, sh.y, sh.r, sh.dmg, 90);
        if (this.shakeOn) this.cameras.main.shake(90, 0.005);
        synth.boom();
        sh.sprite.setActive(false).setVisible(false);
        this.shells.splice(i, 1);
      }
    }
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      f.life -= dt;
      f.tick -= dt;
      f.sprite.setAlpha(clamp(f.life, 0, 1));
      if (f.tick <= 0) {
        f.tick = 0.25;
        this.aoe(f.x, f.y, f.r, f.dps * 0.25, 10);
      }
      if (f.life <= 0) {
        f.sprite.setActive(false).setVisible(false);
        this.flames.splice(i, 1);
      }
    }
    const kids = this.fx.getChildren() as Phaser.GameObjects.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      if (!s.texture.key.startsWith("boom") && s.texture.key !== "tire") continue;
      const life = ((s.getData("life") as number) ?? 0) - dt;
      s.setData("life", life);
      if (s.texture.key.startsWith("boom")) {
        const frame = clamp(Math.floor((1 - life / 0.36) * 4), 0, 3);
        const key = `boom${frame}`;
        if (s.texture.key !== key && this.textures.exists(key)) s.setTexture(key);
      }
      s.setAlpha(clamp(life / 0.2, 0, 1));
      if (life <= 0) s.setActive(false).setVisible(false);
    }
  }

  private explode(x: number, y: number, scale: number) {
    const s = this.fx.get(x, y, "boom0") as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3800);
    s.setScale(scale);
    s.setAlpha(1);
    s.setData("life", 0.36);
  }

  private puff(x: number, y: number, key: string, life: number, depth: number) {
    const s = this.fx.get(x, y, key) as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth);
    s.setAlpha(1);
    s.setData("life", life);
  }

  private floater(x: number, y: number, text: string, color: string) {
    const t = this.floaters.find((f) => !f.visible);
    if (!t) return;
    t.setText(text).setColor(color).setPosition(x, y).setVisible(true).setActive(true).setAlpha(1);
    t.setData("life", 0.55);
    t.setData("vy", -36);
  }

  private banner(text: string, color: string) {
    this.floater(this.player.x, this.player.y - 64, text, color);
  }

  private living() {
    return (this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]).filter((s) => s.active);
  }

  private nearest(x: number, y: number, bossOk: boolean) {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestD = Infinity;
    for (const s of this.living()) {
      if (!bossOk && this.ed(s).kind === "boss" && this.living().length > 1) {
        /* bosses are valid targets; no skip */
      }
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private toughest() {
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

  private activeCount(group: Phaser.Physics.Arcade.Group) {
    let n = 0;
    for (const s of group.getChildren()) if ((s as Phaser.GameObjects.Sprite).active) n++;
    return n;
  }

  private recycle(s: Phaser.Physics.Arcade.Sprite) {
    s.disableBody(true, true);
  }

  private tickFloaters(dt: number) {
    for (const t of this.floaters) {
      if (!t.visible) continue;
      const life = ((t.getData("life") as number) ?? 0) - dt;
      t.setData("life", life);
      t.y += ((t.getData("vy") as number) ?? -30) * dt;
      t.setAlpha(clamp(life / 0.35, 0, 1));
      if (life <= 0) t.setVisible(false).setActive(false);
    }
  }

  private die() {
    if (!this.alive) return;
    this.alive = false;
    this.explode(this.player.x, this.player.y, 1.4);
    synth.boom();
    const wave = 1 + Math.floor(this.timeSurvived / 30);
    bus.emit("game-over", {
      time: this.timeSurvived,
      kills: this.kills,
      level: this.level,
      wave,
    });
    this.physics.pause();
    this.scene.pause();
  }

  private pushStats() {
    const wave = 1 + Math.floor(this.timeSurvived / 30);
    const stats: Stats = {
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: Math.round(this.maxHp),
      xp: Math.max(0, this.xp),
      xpNeed: this.xpNeed,
      level: this.level,
      kills: this.kills,
      time: this.timeSurvived,
      battery: Math.max(0, this.battery),
      maxBattery: this.maxBattery,
      stealth: this.stealth,
      overcharge: this.stealth ? this.stacks : this.ambushT > 0 ? this.ambushStacks : 0,
      multiplier: this.stealth
        ? 1 + this.stacks * 0.25
        : this.ambushT > 0
          ? 1 + this.ambushStacks * 0.25
          : 1,
      wave,
      nextBoss: Math.max(0, this.nextBoss - this.timeSurvived),
      ambush: Math.max(0, this.ambushT),
      weapons: this.weapons.map((w) => w.id),
    };
    bus.emit("stats-update", stats);
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
    if (body && window.__controlsTest) {
      /* probe reads live sprite */
    }
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    __flannel?: {
      grantXp: (n: number) => void;
      dump: () => { x: number; y: number; hp: number; level: number; kills: number; stealth: boolean };
    };
  }
}
