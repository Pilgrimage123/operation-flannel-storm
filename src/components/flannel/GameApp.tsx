import { useEffect, useRef, useState } from "react";
import { BookOpen, Crosshair, Maximize, Pause, Play, Settings, Volume2, VolumeX } from "lucide-react";
import { PASSIVES, WEAPONS } from "@/game/catalog";
import { bus } from "@/game/eventBus";
import { formatTime, loadSave, patchSettings, recordRun } from "@/game/save";
import { synth } from "@/game/audio";
import type { RunResult, SaveData, Stats, UpgradeId, UpgradeOffer } from "@/game/types";

const blankSave = (): SaveData => ({
  version: 1,
  bestTime: 0,
  totalKills: 0,
  bestLevel: 0,
  bestWave: 0,
  runs: 0,
  muted: false,
  shake: true,
});

type Panel = "none" | "arsenal" | "manual" | "settings";

export function GameApp() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"menu" | "play">("menu");
  const [panel, setPanel] = useState<Panel>("none");
  const [save, setSave] = useState<SaveData>(blankSave);
  const [stats, setStats] = useState<Stats | null>(null);
  const [offers, setOffers] = useState<UpgradeOffer[] | null>(null);
  const [over, setOver] = useState<RunResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const [quitJoke, setQuitJoke] = useState(false);

  useEffect(() => {
    const stored = loadSave();
    setSave(stored);
    synth.muted = stored.muted;
    const offReady = bus.on("engine-ready", () => setReady(true));
    const offStats = bus.on("stats-update", (next) => setStats(next));
    const offLevel = bus.on("trigger-level-up", (next) => setOffers(next));
    const offClear = bus.on("level-clear", () => setOffers(null));
    const offOver = bus.on("game-over", (result) => {
      setOver(result);
      setOffers(null);
      setPaused(false);
      setSave(recordRun(result));
    });
    let dead = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    void import("@/game/createGame").then(({ createGame }) => {
      const created = createGame("phaser-host");
      if (dead) {
        created.destroy(true);
        return;
      }
      game = created;
    });
    const unlock = () => synth.ensure();
    window.addEventListener("pointerdown", unlock);
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => {
      dead = true;
      offReady();
      offStats();
      offLevel();
      offClear();
      offOver();
      game?.destroy(true);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("resize", check);
    };
  }, []);

  function deploy() {
    synth.ensure();
    setOver(null);
    setOffers(null);
    setPaused(false);
    setPanel("none");
    setMode("play");
    bus.emit("deploy", null);
  }

  function toggleMute() {
    const muted = !save.muted;
    synth.muted = muted;
    const next = patchSettings({ muted });
    setSave(next);
    bus.emit("set-muted", muted);
  }

  function toggleShake() {
    const next = patchSettings({ shake: !save.shake });
    setSave(next);
    bus.emit("set-shake", next.shake);
  }

  function slava() {
    synth.ensure();
    synth.fanfare();
    setToast("Слава Україні! Героям слава.");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setToast("Fullscreen is blocked in this view.");
      window.setTimeout(() => setToast(null), 1600);
    }
  }

  return (
    <div className="stage">
      <div id="phaser-host" className="phaser-host" />
      {mode === "menu" ? (
        <Menu
          save={save}
          ready={ready}
          panel={panel}
          quitJoke={quitJoke}
          onDeploy={deploy}
          onPanel={setPanel}
          onQuitJoke={setQuitJoke}
          onMute={toggleMute}
          onSlava={slava}
          onFull={fullscreen}
          onShake={toggleShake}
        />
      ) : (
        <PlayChrome
          stats={stats}
          save={save}
          offers={offers}
          over={over}
          paused={paused}
          onMute={toggleMute}
          onPause={() => {
            setPaused(true);
            bus.emit("pause-game", null);
          }}
          onResume={() => {
            setPaused(false);
            bus.emit("resume-game", null);
          }}
          onChoose={(id) => bus.emit("select-upgrade", id)}
          onAgain={deploy}
          onMenu={() => {
            setMode("menu");
            setOver(null);
            setPaused(false);
            bus.emit("quit", null);
          }}
        />
      )}
      {toast ? <div className="toast">{toast}</div> : null}
      {portrait ? (
        <div className="rotate-gate">
          <div className="phone" />
          <p>ROTATE PHONE TO HORIZONTAL MODE TO DEPLOY GENERAL PAVEL</p>
        </div>
      ) : null}
    </div>
  );
}

function Menu({
  save,
  ready,
  panel,
  quitJoke,
  onDeploy,
  onPanel,
  onQuitJoke,
  onMute,
  onSlava,
  onFull,
  onShake,
}: {
  save: SaveData;
  ready: boolean;
  panel: Panel;
  quitJoke: boolean;
  onDeploy: () => void;
  onPanel: (panel: Panel) => void;
  onQuitJoke: (open: boolean) => void;
  onMute: () => void;
  onSlava: () => void;
  onFull: () => void;
  onShake: () => void;
}) {
  return (
    <div className="menu">
      <div className="hero">
        <img src="/menu-hero.jpg" alt="General Pavel beside a washing machine on the front" />
        <div className="hero-copy">
          <div className="kicker">
            <span className="compass" />
            <span>OPERATION:</span>
          </div>
          <h1>
            <span>FLANNEL</span> STORM
          </h1>
          <div className="ribbon">GENERAL PAVEL VS. THE INVADERS</div>
        </div>
      </div>
      <div className="menu-side">
        <button className="deploy" disabled={!ready} onClick={onDeploy}>
          <Play />
          DEPLOY TO FRONT
        </button>
        <button className="menu-btn" onClick={() => onPanel("arsenal")}>
          <Crosshair />
          <span>
            ARSENAL
            <small>WEAPONS AND PASSIVES</small>
          </span>
        </button>
        <button className="menu-btn" onClick={() => onPanel("manual")}>
          <BookOpen />
          <span>
            FIELD MANUAL
            <small>HOW TO PLAY</small>
          </span>
        </button>
        <button className="menu-btn" onClick={() => onPanel("settings")}>
          <Settings />
          <span>
            SETTINGS
            <small>AUDIO AND FEEL</small>
          </span>
        </button>
        <button className="menu-btn" onClick={() => onQuitJoke(true)}>
          <span>
            QUIT GAME
            <small>THE FRONT DISAGREES</small>
          </span>
        </button>
      </div>
      <div className="stat-row">
        <div className="stat">
          <span>BEST RUN</span>
          <b>{formatTime(save.bestTime)}</b>
        </div>
        <div className="stat">
          <span>TOTAL KILLS</span>
          <b>{save.totalKills.toLocaleString()}</b>
        </div>
        <div className="stat">
          <span>HIGHEST LEVEL</span>
          <b>LV. {save.bestLevel}</b>
        </div>
        <div className="stat">
          <span>LONGEST WAVE</span>
          <b>WAVE {save.bestWave}</b>
        </div>
        <div className="icon-row">
          <button className="icon-btn" onClick={onMute}>
            {save.muted ? <VolumeX /> : <Volume2 />}
            {save.muted ? "AUDIO OFF" : "AUDIO ON"}
          </button>
          <button className="icon-btn" onClick={onSlava}>
            <span className="flag" />
            SLAVA UKRAINI
          </button>
          <button className="icon-btn" onClick={onFull}>
            <Maximize />
            FULLSCREEN
          </button>
        </div>
      </div>
      {panel === "arsenal" ? <Arsenal onClose={() => onPanel("none")} /> : null}
      {panel === "manual" ? <Manual onClose={() => onPanel("none")} /> : null}
      {panel === "settings" ? (
        <SettingsSheet save={save} onMute={onMute} onShake={onShake} onClose={() => onPanel("none")} />
      ) : null}
      {quitJoke ? (
        <div className="sheet">
          <div className="sheet-card">
            <h2>RETIREMENT DENIED</h2>
            <p className="note">The washing machine is already spinning. Generals do not quit. They go flannel.</p>
            <button className="back" onClick={() => onQuitJoke(false)}>
              BACK TO BRIEFING
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Arsenal({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h2>ARSENAL</h2>
        <div className="codex">
          {WEAPONS.map((weapon) => (
            <article key={weapon.id}>
              <h3>{weapon.name}</h3>
              <p>
                Loud: {weapon.loud} Ambush: {weapon.ambush}
              </p>
            </article>
          ))}
          {PASSIVES.map((passive) => (
            <article key={passive.id}>
              <h3>{passive.name}</h3>
              <p>{passive.detail}</p>
            </article>
          ))}
        </div>
        <button className="back" onClick={onClose}>
          CLOSE MANUAL
        </button>
      </div>
    </div>
  );
}

function Manual({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h2>FIELD MANUAL</h2>
        <div className="codex">
          <div className="manual-step">
            <strong>1. MOVE</strong>
            <p>WASD or arrows on a keyboard. On a phone, drag the left stick. Weapons fire on their own.</p>
          </div>
          <div className="manual-step">
            <strong>2. GOING FLANNEL</strong>
            <p>Space, or the red button. Pavel drops a washing machine, sprints, and takes no contact damage.</p>
          </div>
          <div className="manual-step">
            <strong>3. THEY WANT THE LOOT</strong>
            <p>Every invader sprints to the machine. Hold stealth to stack Article 5 overcharge. Battery is the limit.</p>
          </div>
          <div className="manual-step">
            <strong>4. THE AMBUSH</strong>
            <p>Press again. The machine explodes and every weapon dumps its bonus attack. Longer stealth, bigger boom.</p>
          </div>
          <div className="manual-step">
            <strong>5. DOG TAGS</strong>
            <p>Walk over blue-yellow tags to level up. Pilsner kegs heal and refill the battery. Pick one of three upgrades.</p>
          </div>
          <div className="manual-step">
            <strong>6. THE BALLOON</strong>
            <p>Every three minutes an inflatable S-400 rolls in. In flannel, walk into it and it pops.</p>
          </div>
          <div className="manual-step">
            <strong>7. WHAT IS SHOOTING BACK</strong>
            <p>
              Grunts clump and walk straight at you. Riot shields block shots from the front — flannel around and
              hit the back. Suicide drones sprint and explode. Recon dogs sniff your real spot in flannel and bite
              even while you are invisible, so keep moving.
            </p>
          </div>
        </div>
        <button className="back" onClick={onClose}>
          CLOSE MANUAL
        </button>
      </div>
    </div>
  );
}

function SettingsSheet({
  save,
  onMute,
  onShake,
  onClose,
}: {
  save: SaveData;
  onMute: () => void;
  onShake: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h2>SETTINGS</h2>
        <div className="row-actions">
          <button onClick={onMute}>{save.muted ? "UNMUTE" : "MUTE"}</button>
          <button className="ghost" onClick={onShake}>
            {save.shake ? "SHAKE ON" : "SHAKE OFF"}
          </button>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          Desktop: WASD to move, Space to go flannel. The A key moves left and D moves right. Phone: landscape only, left stick plus the flannel button.
        </p>
        <button className="back" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

function PlayChrome({
  stats,
  save,
  offers,
  over,
  paused,
  onMute,
  onPause,
  onResume,
  onChoose,
  onAgain,
  onMenu,
}: {
  stats: Stats | null;
  save: SaveData;
  offers: UpgradeOffer[] | null;
  over: RunResult | null;
  paused: boolean;
  onMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onChoose: (id: UpgradeId) => void;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const hpPct = stats ? Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100)) : 100;
  const xpPct = stats ? Math.max(0, Math.min(100, (stats.xp / stats.xpNeed) * 100)) : 0;
  const batPct = stats ? Math.max(0, Math.min(100, (stats.battery / stats.maxBattery) * 100)) : 100;
  const maxStacks = stats ? Math.max(1, Math.floor(stats.maxBattery / 0.5)) : 10;
  const overPct = stats ? Math.max(0, Math.min(100, (stats.overcharge / maxStacks) * 100)) : 0;
  const charge = `${batPct}%`;
  const portrait = stats?.stealth ? "/sprites/portrait-stealth.png" : "/sprites/portrait-loud.png";

  return (
    <>
      <header className="hud">
        <div className="hud-card who">
          <img src={portrait} alt="" />
          <div>
            <strong>FLANNEL STORM</strong>
            <em>{stats?.stealth ? "FLANNEL MODE" : "GENERAL PAVEL"}</em>
          </div>
        </div>
        <div className="hud-card bars">
          <div className="bar-line">
            <span>HP</span>
            <div className="track">
              <i className="fill-hp" style={{ width: `${hpPct}%` }} />
            </div>
            <b>
              {stats?.hp ?? 110}/{stats?.maxHp ?? 110}
            </b>
          </div>
          <div className="bar-line">
            <span>XP</span>
            <div className="track">
              <i className="fill-xp" style={{ width: `${xpPct}%` }} />
            </div>
            <b>LV {stats?.level ?? 1}</b>
          </div>
        </div>
        <div className="hud-card meter">
          <span>WAVE {stats?.wave ?? 1}</span>
          <b>{formatTime(stats?.time ?? 0)}</b>
          <span>BOSS {formatTime(stats?.nextBoss ?? 180)}</span>
        </div>
        <div className="hud-card meter">
          <span>KILLS</span>
          <b>{stats?.kills ?? 0}</b>
        </div>
        <div className="hud-card meter">
          <span>STEALTH BATTERY</span>
          <div className="track">
            <i className="fill-bat" style={{ width: `${batPct}%` }} />
          </div>
          <b>
            {(stats?.battery ?? 5).toFixed(1)} / {(stats?.maxBattery ?? 5).toFixed(1)}s
          </b>
        </div>
        <div className="hud-card meter">
          <span>ARTICLE 5</span>
          <div className="track">
            <i className="fill-ov" style={{ width: `${overPct}%` }} />
          </div>
          <b>x{(stats?.multiplier ?? 1).toFixed(2)}</b>
        </div>
        <div className="hud-actions">
          <button className="tiny" onClick={onMute} aria-label={save.muted ? "Unmute" : "Mute"}>
            {save.muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button className="tiny" onClick={paused ? onResume : onPause} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? <Play /> : <Pause />}
          </button>
        </div>
      </header>
      <Stick />
      <button
        type="button"
        className={stats?.stealth ? "flannel on" : "flannel"}
        style={{ ["--charge" as string]: charge }}
        onPointerDown={(event) => {
          event.preventDefault();
          synth.ensure();
          bus.emit("toggle-stealth", null);
        }}
      >
        <img src={stats?.stealth ? "/sprites/portrait-stealth.png" : "/sprites/pavel-loud.png"} alt="" />
        GOING FLANNEL
      </button>
      {offers ? (
        <div className="modal">
          <h2>LEVEL UP — CHOOSE AN UPGRADE</h2>
          <div className="choices">
            {offers.map((offer, index) => (
              <button key={`${offer.id}-${offer.rank}-${index}`} className="choice" onClick={() => onChoose(offer.id)}>
                <b>
                  {index + 1}. {offer.name}
                </b>
                <p>
                  {offer.blurb}. {offer.detail}
                </p>
                <span className="pips">
                  {Array.from({ length: offer.maxRank }, (_, pip) => (
                    <i key={pip} className={pip < offer.rank ? "pip on" : "pip"} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {paused && !over && !offers ? (
        <div className="overlay-center">
          <div className="over-card">
            <h2>HOLDING FIRE</h2>
            <p className="note">The front waits. WASD moves. Space is flannel.</p>
            <div className="row-actions">
              <button onClick={onResume}>RESUME</button>
              <button className="ghost" onClick={onMenu}>
                ABORT TO BRIEFING
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {over ? (
        <div className="overlay-center">
          <div className="over-card">
            <h2>PAVEL IS DOWN</h2>
            <p className="note">The washing machine outlasted the general. Barely.</p>
            <div className="over-grid">
              <div className="stat">
                <span>TIME</span>
                <b>{formatTime(over.time)}</b>
              </div>
              <div className="stat">
                <span>KILLS</span>
                <b>{over.kills}</b>
              </div>
              <div className="stat">
                <span>LEVEL</span>
                <b>{over.level}</b>
              </div>
              <div className="stat">
                <span>WAVE</span>
                <b>{over.wave}</b>
              </div>
            </div>
            <div className="row-actions">
              <button onClick={onAgain}>DEPLOY AGAIN</button>
              <button className="ghost" onClick={onMenu}>
                BRIEFING
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stick() {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  function place(clientX: number, clientY: number) {
    const el = root.current;
    const cap = knob.current;
    if (!el || !cap) return;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const max = 40;
    const clamped = Math.min(max, len);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    cap.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = Math.min(1, len / max);
    bus.emit("joystick-move", { x: (dx / clamped || 0) * mag, y: (dy / clamped || 0) * mag });
  }

  function end() {
    drag.current = null;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    bus.emit("joystick-move", { x: 0, y: 0 });
  }

  return (
    <div
      className="stick-zone"
      onPointerDown={(event) => {
        const zone = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - zone.left;
        const localY = event.clientY - zone.top;
        if (root.current) {
          root.current.style.left = `${Math.max(8, localX - 64)}px`;
          root.current.style.top = `${Math.max(8, localY - 64)}px`;
          root.current.style.bottom = "auto";
        }
        drag.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        place(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (drag.current !== event.pointerId) return;
        place(event.clientX, event.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="stick" ref={root}>
        <div className="knob" ref={knob} />
      </div>
    </div>
  );
}
