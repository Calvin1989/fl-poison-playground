import type { App, Frame, View } from "../app";
import { Surface } from "../surface";
import { t } from "../i18n";
import { palette } from "../theme";
import { hideTooltip, showTooltip } from "../tooltip";

/** Share of the height used by the class-mix bars; the rest (below the marks) shows influence. */
const MIX_SHARE = 0.42;
const MARK_GAP = 5;
const MARK_HEIGHT = 4;

/**
 * One column per client. Top: the client's class mix, which is where Non-IID shows.
 * A red tick marks malicious clients. Bottom: the client's share of this round's update.
 */
export class ClientStrip implements View {
  private readonly surface: Surface;
  private frame: Frame | null = null;

  constructor(container: HTMLElement, private readonly app: App) {
    this.surface = new Surface(container, 0.46, () => this.frame && this.render(this.frame), () => t().clientStripLabel);
    const canvas = this.surface.canvas;
    canvas.addEventListener("pointermove", (e) => this.onPointer(e));
    canvas.addEventListener("pointerleave", () => {
      hideTooltip();
      this.app.hover(null);
    });
  }

  /** Vertical layout, scaled to the canvas height. */
  private rows() {
    const mix = Math.round(this.surface.height * MIX_SHARE);
    const influenceTop = mix + MARK_GAP + MARK_HEIGHT + 10;
    return { mix, influenceTop, influenceHeight: this.surface.height - influenceTop };
  }

  private columns(n: number) {
    const gap = n > 36 ? 1 : 2;
    const width = (this.surface.width - gap * (n - 1)) / n;
    const step = width + gap;
    return { width, step, x: (i: number) => i * step };
  }

  render(frame: Frame): void {
    this.frame = frame;
    const { ctx, height } = this.surface;
    const colors = palette();
    const { clients, last } = frame.sim;
    const n = clients.length;
    const col = this.columns(n);
    const { mix: mixHeight, influenceTop, influenceHeight } = this.rows();
    const scaleMax = last ? Math.max(...last.influence, 2 / n) : 1;

    this.surface.clear();
    clients.forEach((client, i) => {
      const x = col.x(i);
      if (frame.hovered === i) {
        ctx.fillStyle = colors.rule;
        ctx.fillRect(x - 1, 0, col.width + 2, height);
      }

      // Class mix, class A at the bottom.
      let y = mixHeight;
      client.classMix.forEach((share, k) => {
        const h = share * mixHeight;
        ctx.fillStyle = colors.classes[k];
        ctx.fillRect(x, y - h, col.width, h);
        y -= h;
      });

      if (client.malicious) {
        ctx.fillStyle = colors.malicious;
        ctx.fillRect(x, mixHeight + MARK_GAP, col.width, MARK_HEIGHT);
      }

      // Influence, anchored to the bottom baseline.
      if (last) {
        const h = (last.influence[i] / scaleMax) * influenceHeight;
        if (h > 0.5) {
          ctx.fillStyle = client.malicious ? colors.malicious : colors.ink2;
          ctx.beginPath();
          ctx.roundRect(x, height - h, col.width, h, [Math.min(2, col.width / 2), Math.min(2, col.width / 2), 0, 0]);
          ctx.fill();
        }
      }
    });

    ctx.fillStyle = colors.rule;
    ctx.fillRect(0, height - 1, this.surface.width, 1);
    if (!last) {
      ctx.fillStyle = colors.ink3;
      ctx.font = `13px ${colors.font}`;
      ctx.textBaseline = "middle";
      ctx.fillText(t().influenceEmpty, 0, influenceTop + influenceHeight / 2);
    }
  }

  private onPointer(event: PointerEvent): void {
    if (!this.frame) return;
    const { clients, last } = this.frame.sim;
    const col = this.columns(clients.length);
    const { x } = this.surface.pointer(event);
    const i = Math.min(clients.length - 1, Math.max(0, Math.floor(x / col.step)));
    const client = clients[i];
    this.app.hover(i);

    const mix = client.classMix
      .map((share, k) => ({ share, k }))
      .filter((m) => m.share > 0)
      .map((m) => `${t().className(m.k)} ${Math.round(m.share * 100)}%`)
      .join(", ");
    const lines = [t().client(i + 1, client.malicious), t().classMix(mix)];
    if (last) lines.push(t().influence(last.influence[i], 1 / clients.length));
    showTooltip(event, lines);
  }
}
