import * as Phaser from "phaser";

export class FxSystem {
  private scene: Phaser.Scene;
  private fxGroup: Phaser.GameObjects.Group;
  private floaters: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, fxGroup: Phaser.GameObjects.Group) {
    this.scene = scene;
    this.fxGroup = fxGroup;
  }

  init() {
    this.paintFx();
    this.floaters = [];
    for (let i = 0; i < 40; i++) {
      const t = this.scene.add
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
  }

  private paintFx() {
    const textures = this.scene.textures;
    const paint = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (textures.exists(key)) return;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      draw(ctx);
      textures.addCanvas(key, c);
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

  explode(x: number, y: number, scale: number) {
    const s = this.fxGroup.get(x, y, "boom0") as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3800);
    s.setScale(scale);
    s.setAlpha(1);
    s.setData("life", 0.36);
  }

  puff(x: number, y: number, key: string, life: number, depth: number) {
    const s = this.fxGroup.get(x, y, key) as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth);
    s.setAlpha(1);
    s.setData("life", life);
  }

  floater(x: number, y: number, text: string, color: string) {
    const t = this.floaters.find((f) => !f.visible);
    if (!t) return;
    t.setText(text).setColor(color).setPosition(x, y).setVisible(true).setActive(true).setAlpha(1);
    t.setData("life", 0.55);
    t.setData("vy", -36);
  }

  banner(playerX: number, playerY: number, text: string, color: string) {
    this.floater(playerX, playerY - 64, text, color);
  }

  tickFx(dt: number) {
    const kids = this.fxGroup.getChildren() as Phaser.GameObjects.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      if (!s.texture.key.startsWith("boom") && s.texture.key !== "tire") continue;
      const life = ((s.getData("life") as number) ?? 0) - dt;
      s.setData("life", life);
      if (s.texture.key.startsWith("boom")) {
        const frame = Math.max(0, Math.min(3, Math.floor((1 - life / 0.36) * 4)));
        const key = `boom${frame}`;
        if (s.texture.key !== key && this.scene.textures.exists(key)) s.setTexture(key);
      }
      s.setAlpha(Math.max(0, Math.min(1, life / 0.2)));
      if (life <= 0) s.setActive(false).setVisible(false);
    }
  }

  tickFloaters(dt: number) {
    for (const t of this.floaters) {
      if (!t.visible) continue;
      const life = ((t.getData("life") as number) ?? 0) - dt;
      t.setData("life", life);
      t.y += ((t.getData("vy") as number) ?? -30) * dt;
      t.setAlpha(Math.max(0, Math.min(1, life / 0.35)));
      if (life <= 0) t.setVisible(false).setActive(false);
    }
  }
}
