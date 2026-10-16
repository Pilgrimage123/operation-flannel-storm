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
