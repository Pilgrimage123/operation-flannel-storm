import * as Phaser from "phaser";
import { synth } from "./audio";
import { WEAPON_MAX_RANK, WEAPONS } from "./catalog";
import { bus } from "./eventBus";
import { EnemySystem } from "./systems/EnemySystem";
import { FxSystem } from "./systems/FxSystem";
import { LootSystem } from "./systems/LootSystem";
import { WeaponSystem } from "./systems/WeaponSystem";
import type { BData, Stats, UpgradeId, WeaponId } from "./types";

const WORLD = 3600;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  enemies!: Phaser.Physics.Arcade.Group;
  bullets!: Phaser.Physics.Arcade.Group;
  hostile!: Phaser.Physics.Arcade.Group;
  gems!: Phaser.Physics.Arcade.Group;
  fx!: Phaser.GameObjects.Group;
  loots!: Phaser.GameObjects.Group;
  shields!: Phaser.GameObjects.Group;
  decoy!: Phaser.Physics.Arcade.Sprite;
  beacon!: Phaser.GameObjects.Sprite;
  dog!: Phaser.GameObjects.Sprite;
  bg!: Phaser.GameObjects.TileSprite;
  blocks: Phaser.Physics.Arcade.Image[] = [];

  cursors!: {
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

  alive = true;
  timeSurvived = 0;
  kills = 0;
  hp = 110;
  maxHp = 110;
  battery = 5;
  maxBattery = 5;
  recharge = 0.8;
  stealth = false;
  private stacks = 0;
  private overAcc = 0;
  private ambushT = 0;
  private ambushStacks = 0;
  dashT = 0;
  private dashTick = 0;
  dashX = 1;
  dashY = 0;
  faceX = 1;
  private iFrame = 0;
  private statsAcc = 0;
  shakeOn = true;

  fxSystem!: FxSystem;
  weaponSystem!: WeaponSystem;
  lootSystem!: LootSystem;
  enemySystem!: EnemySystem;

  private unsubs: Array<() => void> = [];

  constructor() {
    super("game");
  }

  init() {
    this.alive = true;
    this.timeSurvived = 0;
    this.kills = 0;
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
    this.statsAcc = 0;
    this.blocks = [];
    this.joy = { x: 0, y: 0 };
    this.spaceWas = false;
    this.injected = new Set();
    this.held.clear();

    this.weaponSystem?.reset();
    this.lootSystem?.reset();
    this.enemySystem?.reset();
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
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD, WORLD);
    cam.setZoom(this.scale.height < 460 ? 0.92 : 1.08);
    this.scale.on("resize", this.onResize, this);

    this.bg = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, "ground")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-50);

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

    // Initialize modular subsystems
    this.fxSystem = new FxSystem(this, this.fx);
    this.fxSystem.init();

    this.enemySystem = new EnemySystem(
      {
        player: this.player,
        decoy: this.decoy,
        stealth: this.stealth,
        dashT: this.dashT,
        alive: this.alive,
        timeSurvived: this.timeSurvived,
        cam,
        shakeCam: (dur, int) => this.shakeCam(dur, int),
        hurtPlayer: (amt, ts, hif) => this.hurtPlayer(amt, ts, hif),
        aoe: (x, y, r, dmg, knk) => this.aoe(x, y, r, dmg, knk),
        shoot: (...args) => this.shoot(...args),
        dress: (s, k, h, hit) => this.dress(s, k, h, hit),
        floater: (x, y, txt, col) => this.fxSystem.floater(x, y, txt, col),
        explode: (x, y, sc) => this.fxSystem.explode(x, y, sc),
        recycle: (s) => this.recycle(s),
        spawnGem: (x, y, val, keg) => this.lootSystem.spawnGem(x, y, val, keg),
        onKilled: () => {
          this.kills += 1;
        },
        delayedCall: (delay, cb) => {
          this.time.delayedCall(delay, cb);
        },
      },
      this.enemies,
      this.shields,
      this.loots,
    );

    this.weaponSystem = new WeaponSystem({
      player: this.player,
      get faceX() {
        return this.player.scene ? (this.player.scene as GameScene).faceX : 1;
      },
      get dashX() {
        return this.player.scene ? (this.player.scene as GameScene).dashX : 1;
      },
      get dashY() {
        return this.player.scene ? (this.player.scene as GameScene).dashY : 0;
      },
      get stealth() {
        return this.player.scene ? (this.player.scene as GameScene).stealth : false;
      },
      get dashT() {
        return this.player.scene ? (this.player.scene as GameScene).dashT : 0;
      },
      fxGroup: this.fx,
      dmgMul: () => this.dmgMul(),
      rateMul: () => this.rateMul(),
      areaMul: () => this.areaMul(),
      shoot: (...args) => this.shoot(...args),
      aoe: (x, y, r, dmg, knk) => this.aoe(x, y, r, dmg, knk),
      explode: (x, y, sc) => this.fxSystem.explode(x, y, sc),
      shakeCam: (dur, int) => this.shakeCam(dur, int),
      findNearestEnemy: (x, y, bossOk) => this.enemySystem.nearest(x, y, bossOk),
      getRandomLivingEnemy: () => {
        const list = this.enemySystem.living();
        return list.length ? list[Math.floor(Math.random() * list.length)]! : null;
      },
      delayedCall: (delay, cb) => {
        this.time.delayedCall(delay, cb);
      },
    });

    this.lootSystem = new LootSystem(
      {
        player: this.player,
        get faceX() {
          return this.player.scene ? (this.player.scene as GameScene).faceX : 1;
        },
        get stealth() {
          return this.player.scene ? (this.player.scene as GameScene).stealth : false;
        },
        get hp() {
          return this.player.scene ? (this.player.scene as GameScene).hp : 110;
        },
        get maxHp() {
          return this.player.scene ? (this.player.scene as GameScene).maxHp : 110;
        },
        get battery() {
          return this.player.scene ? (this.player.scene as GameScene).battery : 5;
        },
        get maxBattery() {
          return this.player.scene ? (this.player.scene as GameScene).maxBattery : 5;
        },
        get recharge() {
          return this.player.scene ? (this.player.scene as GameScene).recharge : 0.8;
        },
        get alive() {
          return this.player.scene ? (this.player.scene as GameScene).alive : true;
        },
        setHp: (v) => {
          this.hp = v;
        },
        setMaxHp: (v) => {
          this.maxHp = v;
        },
        setBattery: (v) => {
          this.battery = v;
        },
        setMaxBattery: (v) => {
          this.maxBattery = v;
        },
        setRecharge: (v) => {
          this.recharge = v;
        },
        banner: (text, color) => this.fxSystem.banner(this.player.x, this.player.y, text, color),
        floater: (x, y, text, color) => this.fxSystem.floater(x, y, text, color),
        dress: (s, k, h, hit) => this.dress(s, k, h, hit),
        pauseGame: () => {
          this.physics.pause();
          this.scene.pause();
        },
        resumeGame: () => {
          this.scene.resume();
          this.physics.resume();
        },
        pushStats: () => this.pushStats(),
        wlevel: (id) => this.weaponSystem.wlevel(id),
        upgradeWeapon: (id) => {
          const existing = this.weaponSystem.weapons.find((w) => w.id === id);
          if (existing) existing.level = Math.min(WEAPON_MAX_RANK, existing.level + 1);
          else this.weaponSystem.weapons.push({ id, level: 1, timer: 0.2 });
        },
        findNearestEnemy: (x, y, bossOk) => this.enemySystem.nearest(x, y, bossOk),
        shoot: (...args) => this.shoot(...args),
      },
      this.gems,
      this.dog,
    );

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
      this.enemySystem.onFriendlyHit(a as Phaser.Physics.Arcade.Sprite, b as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.hostile, this.player, (a) => {
      const shot = a as Phaser.Physics.Arcade.Sprite;
      const bd = shot.getData("bd") as BData;
      this.hurtPlayer(bd?.dmg ?? 8);
      this.recycle(shot);
    });
    this.physics.add.overlap(this.enemies, this.player, (enemy) => {
      this.enemySystem.touchEnemy(enemy as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.enemies, this.decoy, (enemy) => {
      this.enemySystem.touchDecoy(enemy as Phaser.Physics.Arcade.Sprite);
    });
    for (const block of this.blocks) this.physics.add.collider(this.player, block);

    this.bindBus();
    this.exposeProbe();
    this.events.once("shutdown", () => this.teardown());
    this.pushStats();
    this.fxSystem.banner(this.player.x, this.player.y, "DEPLOYED — HOLD THE FIELD", "#ffd60a");
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
    this.weaponSystem.tickWeapons(dt);
    this.enemySystem.tickSpawns(dt);
    this.enemySystem.tickEnemies(dt);
    this.tickBullets(dt, this.bullets);
    this.tickBullets(dt, this.hostile);
    this.weaponSystem.tickProjectiles(dt);
    this.lootSystem.tickGems(dt);
    this.fxSystem.tickFx(dt);
    this.fxSystem.tickFloaters(dt);
    this.lootSystem.tickDog(dt);
    this.tickPlayerLook();

    this.statsAcc += dt;
    if (this.statsAcc >= 0.25) {
      this.statsAcc = 0;
      this.pushStats();
    }
  }

  private bindBus() {
    const onToggle = () => {
      if (!this.lootSystem.choosing && this.alive) this.toggleStealth();
    };
    const onJoy = (v: { x: number; y: number }) => {
      this.joy.x = v.x;
      this.joy.y = v.y;
    };
    const onUp = (id: UpgradeId) => this.lootSystem.pickUpgrade(id);
    const onMute = (m: boolean) => {
      synth.setMuted(m);
    };
    const onShake = (s: boolean) => {
      this.shakeOn = s;
    };
    const onPause = () => {
      if (this.lootSystem.choosing || !this.alive) return;
      this.scene.pause();
      this.physics.pause();
    };
    const onResume = () => {
      if (this.lootSystem.choosing || !this.alive) return;
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
    window.__controlsTest = {
      getYaw: () => Math.atan2(this.dashY, this.dashX),
      getSpeed: () => {
        const b = this.player.body as Phaser.Physics.Arcade.Body;
        return Math.hypot(b.velocity.x, b.velocity.y);
      },
      getX: () => this.player.x,
      getY: () => this.player.y,
      setKeys: (codes: string[]) => {
        this.injected = new Set(codes);
      },
      setSteer: () => {},
    };
    window.__flannel = {
      grantXp: (n: number) => this.lootSystem.addXp(n),
      dump: () => ({
        x: this.player.x,
        y: this.player.y,
        hp: this.hp,
        level: this.lootSystem.level,
        kills: this.kills,
        stealth: this.stealth,
      }),
    };
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

  dress(sprite: Phaser.Physics.Arcade.Sprite, key: string, height: number, hit: number) {
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
        this.fxSystem.puff(this.player.x, this.player.y + 20, "tire", 0.35, 28);
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

  toggleStealth() {
    if (this.stealth) this.exitStealth();
    else this.enterStealth();
  }

  private enterStealth() {
    if (this.battery < 0.15 || this.dashT > 0) return;
    this.stealth = true;
    this.stacks = 0;
    this.overAcc = 0;
    const golden = this.lootSystem.level >= 6 || this.weaponSystem.weapons.some((w) => w.level >= 3);
    this.decoy.enableBody(true, this.player.x, this.player.y, true, true);
    this.dress(this.decoy, golden ? "toilet" : "washer", 74, 0.42);
    this.decoy.setActive(true).setVisible(true);
    const body = this.decoy.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setVelocity(0, 0);
    this.decoy.setDepth(this.decoy.y);
    this.beacon.setVisible(true).setPosition(this.decoy.x, this.decoy.y);
    synth.stealth();
    this.fxSystem.banner(this.player.x, this.player.y, "FLANNEL MODE", "#7ad0ff");
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
    this.fxSystem.explode(x, y, 1.3);
    this.aoe(x, y, 110 * area, 48 * mul, 220);
    if (this.lootSystem.ranks.lumberjack > 0) {
      this.aoe(
        this.player.x,
        this.player.y,
        100 + this.lootSystem.ranks.lumberjack * 16,
        12 * this.lootSystem.ranks.lumberjack * mul,
        260,
      );
    }
    this.weaponSystem.resetTimers();
    if (this.weaponSystem.has("artillery")) this.weaponSystem.barrage(x, y, area, mul);
    if (this.weaponSystem.has("drone")) this.weaponSystem.swarm(x, y, mul);
    if (this.weaponSystem.has("mlrs")) this.weaponSystem.blanket(x, y, area, mul);
    if (this.weaponSystem.has("moto")) {
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
    this.fxSystem.banner(this.player.x, this.player.y, `ARTICLE 5  x${mul.toFixed(1)}`, "#ffb703");
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

  dmgMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.25 : 1;
  }
  rateMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.2 : 1;
  }
  areaMul() {
    return this.ambushT > 0 ? 1 + this.ambushStacks * 0.2 : 1;
  }

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
        const target = b.friendly ? this.enemySystem.toughest() : this.player;
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

  aoe(x: number, y: number, radius: number, damage: number, knock: number) {
    const kids = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > radius) continue;
      const nx = (s.x - x) / (d || 1);
      const ny = (s.y - y) / (d || 1);
      this.enemySystem.damageEnemy(s, damage, nx * knock, ny * knock);
    }
  }

  hurtPlayer(amount: number, throughStealth = false, honorIFrame = true) {
    if (!this.alive || this.dashT > 0) return;
    if (this.stealth && !throughStealth) return;
    if (honorIFrame && this.iFrame > 0) return;
    this.hp -= amount;
    this.iFrame = 0.45;
    this.fxSystem.floater(this.player.x, this.player.y - 24, `-${Math.round(amount)}`, "#ff4d4d");
    synth.hurt();
    if (this.shakeOn) this.cameras.main.shake(90, 0.008);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  shakeCam(duration: number, intensity: number) {
    if (this.shakeOn) this.cameras.main.shake(duration, intensity);
  }

  recycle(s: Phaser.Physics.Arcade.Sprite) {
    s.disableBody(true, true);
  }

  private die() {
    if (!this.alive) return;
    this.alive = false;
    this.fxSystem.explode(this.player.x, this.player.y, 1.4);
    synth.boom();
    const wave = 1 + Math.floor(this.timeSurvived / 30);
    bus.emit("game-over", {
      time: this.timeSurvived,
      kills: this.kills,
      level: this.lootSystem.level,
      wave,
    });
    this.physics.pause();
    this.scene.pause();
  }

  pushStats() {
    const wave = 1 + Math.floor(this.timeSurvived / 30);
    const stats: Stats = {
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: Math.round(this.maxHp),
      xp: Math.max(0, this.lootSystem.xp),
      xpNeed: this.lootSystem.xpNeed,
      level: this.lootSystem.level,
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
      nextBoss: Math.max(0, this.enemySystem.nextBoss - this.timeSurvived),
      ambush: Math.max(0, this.ambushT),
      weapons: this.weaponSystem.weapons.map((w) => w.id),
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
