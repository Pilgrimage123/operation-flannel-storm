import type * as Phaser from "phaser";

export type WeaponId = "bren" | "artillery" | "drone" | "moto" | "mlrs";
export type PassiveId = "lumberjack" | "pilsner" | "nafo";
export type UpgradeId = WeaponId | PassiveId;

export type UpgradeOffer = {
  id: UpgradeId;
  kind: "weapon" | "passive";
  name: string;
  blurb: string;
  detail: string;
  rank: number;
  maxRank: number;
};

export type Stats = {
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  level: number;
  kills: number;
  time: number;
  battery: number;
  maxBattery: number;
  stealth: boolean;
  overcharge: number;
  multiplier: number;
  wave: number;
  nextBoss: number;
  ambush: number;
  weapons: WeaponId[];
};

export type RunResult = {
  time: number;
  kills: number;
  level: number;
  wave: number;
};

export type SaveData = {
  version: 1;
  bestTime: number;
  totalKills: number;
  bestLevel: number;
  bestWave: number;
  runs: number;
  muted: boolean;
  shake: boolean;
};

export type Kind = "conscript" | "tiktok" | "cart" | "turtle" | "boss" | "riot" | "kamikaze" | "dog";

export type EData = {
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

export type BData = {
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

export type WState = { id: WeaponId; level: number; timer: number };

export type Shell = {
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  x: number;
  y: number;
  r: number;
  dmg: number;
};

export type Flame = {
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  x: number;
  y: number;
  r: number;
  dps: number;
  tick: number;
};
