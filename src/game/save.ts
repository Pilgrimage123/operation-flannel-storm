import type { RunResult, SaveData } from "./types";

const KEY = "flannel-storm-v1";

const empty = (): SaveData => ({
  version: 1,
  bestTime: 0,
  totalKills: 0,
  bestLevel: 0,
  bestWave: 0,
  runs: 0,
  muted: false,
  shake: true,
});

function sanitizeNum(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return empty();
    return {
      version: 1,
      bestTime: sanitizeNum(parsed.bestTime, 0),
      totalKills: sanitizeNum(parsed.totalKills, 0),
      bestLevel: sanitizeNum(parsed.bestLevel, 0),
      bestWave: sanitizeNum(parsed.bestWave, 0),
      runs: sanitizeNum(parsed.runs, 0),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
      shake: typeof parsed.shake === "boolean" ? parsed.shake : true,
    };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private browsing restriction
  }
}

export function recordRun(result: RunResult): SaveData {
  const data = loadSave();
  data.runs += 1;
  data.totalKills += Math.max(0, result.kills || 0);
  data.bestTime = Math.max(data.bestTime, Math.max(0, result.time || 0));
  data.bestLevel = Math.max(data.bestLevel, Math.max(0, result.level || 0));
  data.bestWave = Math.max(data.bestWave, Math.max(0, result.wave || 0));
  writeSave(data);
  return data;
}

export function patchSettings(partial: Partial<Pick<SaveData, "muted" | "shake">>) {
  const data = loadSave();
  if (typeof partial.muted === "boolean") data.muted = partial.muted;
  if (typeof partial.shake === "boolean") data.shake = partial.shake;
  writeSave(data);
  return data;
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
