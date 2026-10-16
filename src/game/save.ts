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

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return empty();
    return { ...empty(), ...parsed, version: 1 };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function recordRun(result: RunResult): SaveData {
  const data = loadSave();
  data.runs += 1;
  data.totalKills += result.kills;
  data.bestTime = Math.max(data.bestTime, result.time);
  data.bestLevel = Math.max(data.bestLevel, result.level);
  data.bestWave = Math.max(data.bestWave, result.wave);
  writeSave(data);
  return data;
}

export function patchSettings(partial: Partial<Pick<SaveData, "muted" | "shake">>) {
  const data = loadSave();
  Object.assign(data, partial);
  writeSave(data);
  return data;
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
