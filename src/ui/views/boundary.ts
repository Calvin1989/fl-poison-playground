import type { Sample } from "../../core/datasets";
import type { Simulation } from "../../core/simulation";
import type { Frame, View } from "../app";
import { drawMarker } from "../marks";
import { Surface } from "../surface";
import { t } from "../i18n";
import { palette, rgb } from "../theme";

const GRID = 72;
const DOMAIN = 1.08;

/**
 * The global model's prediction over the whole plane, with the test set on top.
 * Hovering a client swaps the test set for that client's own training data.
 */
export class BoundaryView implements View {
  private readonly surface: Surface;
  private readonly grid = document.createElement("canvas");
  private drawnFor: { sim: Simulation; round: number } | null = null;
  private frame: Frame | null = null;

  constructor(
    container: HTMLElement,
    private readonly caption: HTMLElement,
  ) {
    this.surface = new Surface(container, 1, () => this.frame && this.render(this.frame), () => t().boundaryLabel);
    this.grid.width = GRID;
    this.grid.height = GRID;
  }

  render(frame: Frame): void {
    this.frame = frame;
    const { sim, hovered } = frame;
    const { ctx, width, height } = this.surface;
    const colors = palette();

    if (this.drawnFor?.sim !== sim || this.drawnFor.round !== sim.round) {
      this.paintRegions(sim);
      this.drawnFor = { sim, round: sim.round };
    }

    this.surface.clear();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.grid, 0, 0, width, height);

    const toCanvas = (s: Sample) => ({
      x: ((s.x + DOMAIN) / (2 * DOMAIN)) * width,
      y: ((DOMAIN - s.y) / (2 * DOMAIN)) * height,
    });

    const client = hovered === null ? null : sim.clients[hovered];
    ctx.globalAlpha = client ? 0.18 : 1;
    for (const s of sim.testSet) {
      const p = toCanvas(s);
      drawMarker(ctx, "circle", p.x, p.y, 2.6, colors.classes[s.label]);
    }
    ctx.globalAlpha = 1;

    if (client) {
      for (const s of client.data) {
        const p = toCanvas(s);
        drawMarker(ctx, client.malicious ? "triangle" : "circle", p.x, p.y, 4.2, colors.classes[s.label]);
      }
    }

    ctx.strokeStyle = colors.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    this.caption.textContent = client ? t().trainingData(client.id + 1, client.malicious) : t().testDataCaption;
  }

  /** One prediction per grid cell; tint grows with the model's confidence. */
  private paintRegions(sim: Simulation): void {
    const colors = palette();
    const sheet = rgb(colors.sheet);
    const classes = colors.classes.map(rgb);
    const k = sim.model.classes;
    const probs = new Float64Array(k);
    const ctx = this.grid.getContext("2d")!;
    const image = ctx.createImageData(GRID, GRID);

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const x = -DOMAIN + ((col + 0.5) / GRID) * 2 * DOMAIN;
        const y = DOMAIN - ((row + 0.5) / GRID) * 2 * DOMAIN;
        sim.model.predict(sim.params, x, y, probs);
        let best = 0;
        for (let c = 1; c < k; c++) if (probs[c] > probs[best]) best = c;
        const confidence = (probs[best] - 1 / k) / (1 - 1 / k);
        const tint = 0.1 + 0.42 * confidence;
        const color = classes[best];
        const at = (row * GRID + col) * 4;
        for (let ch = 0; ch < 3; ch++) image.data[at + ch] = Math.round(sheet[ch] + (color[ch] - sheet[ch]) * tint);
        image.data[at + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
}
