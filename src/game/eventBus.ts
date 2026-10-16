import type { RunResult, Stats, UpgradeId, UpgradeOffer } from "./types";

export type BusMap = {
  "engine-ready": null;
  deploy: null;
  quit: null;
  "stats-update": Stats;
  "trigger-level-up": UpgradeOffer[];
  "game-over": RunResult;
  "select-upgrade": UpgradeId;
  "level-clear": null;
  "toggle-stealth": null;
  "joystick-move": { x: number; y: number };
  "set-muted": boolean;
  "set-shake": boolean;
  "pause-game": null;
  "resume-game": null;
};

type Handler<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler<never>>>();

  on<K extends keyof BusMap>(event: K, fn: Handler<BusMap[K]>) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(event, fn);
  }

  off<K extends keyof BusMap>(event: K, fn: Handler<BusMap[K]>) {
    this.listeners.get(event)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof BusMap>(event: K, payload: BusMap[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Handler<BusMap[K]>)(payload);
  }
}

export const bus = new EventBus();
