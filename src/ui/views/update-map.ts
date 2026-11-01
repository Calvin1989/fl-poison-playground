import { argmax } from "../../core/model";
import { Projector, type Point2 } from "../../core/projection";
import type { Simulation } from "../../core/simulation";
import { dot, norm } from "../../core/vector";
import type { App, Frame, View } from "../app";
import { drawMarker } from "../marks";
import { Surface } from "../surface";
import { t } from "../i18n";
import { palette } from "../theme";
import { hideTooltip, showTooltip } from "../tooltip";

const PAD = 14;
/** Below this share of an equal vote, a client counts as ignored and is drawn hollow. */
const IGNORED = 0.25;

/**
 * Every client's update this round, projected to 2D and centred on the honest mean.
 * The cross is what the server actually applied; its distance from the ring is the damage.
 */
export class UpdateMap implements View {
  private readonly surface: Surface;
  private projector = new Projector();
  private projectedFor: { sim: Simulation; round: number } | null = null;
  private points: Point2[] = [];
  /** Half-width of the visible range on each axis, eased between rounds. */
  private extent = { x: 0, y: 0 };
  private frame: Frame | null = null;

  constructor(
    container: HTMLElement,
    private readonly app: App,
    private readonly readout: HTMLElement,
  ) {
    this.surface = new Surface(container, 1, () => this.frame && this.render(this.frame), () => t().updateMapLabel);
    const canvas = this.surface.canvas;
    canvas.addEventListener("pointermove", (e) => this.onPointer(e));
    canvas.addEventListener("pointerleave", () => {
      hideTooltip();
      this.app.hover(null);
    });
  }

  render(frame: Frame): void {
    this.frame = frame;
    const { sim } = frame;
    const last = sim.last;
    const colors = palette();
    const { ctx, width, height } = this.surface;
    this.surface.clear();

    ctx.strokeStyle = colors.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    if (!last) {
      this.projector = new Projector();
      this.projectedFor = null;
      this.extent = { x: 0, y: 0 };
      this.readout.textContent = "";
      ctx.fillStyle = colors.ink3;
      ctx.font = `13px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText(t().updatesEmpty, width / 2, height / 2);
      ctx.textAlign = "start";
      return;
    }

    this.project(sim);
    const n = sim.clients.length;
    const toCanvas = (p: Point2) => this.toCanvas(p);

    // Axes through the honest mean.
    ctx.beginPath();
    ctx.moveTo(width / 2, PAD / 2);
    ctx.lineTo(width / 2, height - PAD / 2);
    ctx.moveTo(PAD / 2, height / 2);
    ctx.lineTo(width - PAD / 2, height / 2);
    ctx.stroke();

    const server = toCanvas(this.points[n]);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.lineTo(server.x, server.y);
    ctx.stroke();

    // Honest first, so malicious triangles sit on top.
    const order = sim.clients.map((_, i) => i).sort((a, b) => Number(sim.clients[a].malicious) - Number(sim.clients[b].malicious));
    for (const i of order) {
      const client = sim.clients[i];
      const p = toCanvas(this.points[i]);
      const kept = last.influence[i] >= IGNORED / n;
      if (client.malicious) drawMarker(ctx, "triangle", p.x, p.y, 5.5, colors.malicious, kept);
      else drawMarker(ctx, "circle", p.x, p.y, 4.5, colors.classes[argmax(client.classMix)], kept);
      if (frame.hovered === i) drawMarker(ctx, "ring", p.x, p.y, 10, colors.ink);
    }

    drawMarker(ctx, "ring", width / 2, height / 2, 7, colors.ink);
    drawMarker(ctx, "cross", server.x, server.y, 6, colors.ink);

    const cosine = dot(last.aggregate, last.benignMean) / (norm(last.aggregate) * norm(last.benignMean) || 1);
    this.readout.textContent = t().cosine(cosine);
  }

  /** Map projected coordinates to canvas pixels; points past the edge stay on the edge. */
  private toCanvas(p: Point2): Point2 {
    const { width, height } = this.surface;
    const clamp = (v: number, extent: number) => Math.max(-1, Math.min(1, v / extent));
    return {
      x: width / 2 + clamp(p.x, this.extent.x) * (width / 2 - PAD),
      y: height / 2 - clamp(p.y, this.extent.y) * (height / 2 - PAD),
    };
  }

  /** Project once per round; hovering only redraws. */
  private project(sim: Simulation): void {
    const last = sim.last!;
    if (this.projectedFor?.sim !== sim) this.projector = new Projector();
    if (this.projectedFor?.sim === sim && this.projectedFor.round === last.round) return;
    this.projectedFor = { sim, round: last.round };

    const honestIds = sim.clients.filter((c) => !c.malicious).map((c) => c.id);
    this.points = this.projector.project([...last.updates, last.aggregate], last.benignMean, last.aggregate, honestIds);

    // Always fit the honest cloud and the server's update; far-off attackers are pinned to the edge.
    const fit = (axis: "x" | "y") => {
      const reach = (i: number) => Math.abs(this.points[i][axis]);
      const honest = Math.max(1e-12, ...honestIds.map(reach));
      const server = reach(sim.clients.length);
      const attackers = Math.max(0, ...sim.clients.filter((c) => c.malicious).map((c) => reach(c.id)));
      return 1.12 * Math.max(honest, server, Math.min(attackers, 3 * honest));
    };
    const ease = (from: number, to: number) => (from > 0 ? from + (to - from) * 0.35 : to);
    const x = ease(this.extent.x, fit("x"));
    // The vertical spread is often much smaller; stretch it, at most 4x, so points do not pile up.
    const y = ease(this.extent.y, Math.max(fit("y"), x / 4));
    this.extent = { x, y: Math.min(x, y) };
  }

  private onPointer(event: PointerEvent): void {
    const sim = this.frame?.sim;
    if (!sim?.last || !this.points.length) return;
    const { x, y } = this.surface.pointer(event);
    let best = -1;
    let bestDist = 12 * 12;
    sim.clients.forEach((_, i) => {
      const p = this.toCanvas(this.points[i]);
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < bestDist) {
        bestDist = dx * dx + dy * dy;
        best = i;
      }
    });
    if (best < 0) {
      hideTooltip();
      this.app.hover(null);
      return;
    }
    const client = sim.clients[best];
    const main = argmax(client.classMix);
    this.app.hover(best);
    showTooltip(event, [
      t().client(best + 1, client.malicious),
      t().mostlyClass(main, client.classMix[main]),
      t().influence(sim.last.influence[best], 1 / sim.clients.length),
    ]);
  }
}
