import { AGGREGATORS, type Aggregator } from "../../core/aggregators";
import type { App } from "../app";
import { bindText, tr } from "../i18n";
import { Surface } from "../surface";
import { palette } from "../theme";

/** One small chart per rule, shared by the round-by-round comparison and the sweep. */
export interface RuleCell {
  rule: Aggregator;
  button: HTMLButtonElement;
  value: HTMLElement;
  surface: Surface;
}

export function buildRuleCells(
  container: HTMLElement,
  app: App,
  label: (ruleName: string) => string,
  onResize: () => void,
): RuleCell[] {
  return AGGREGATORS.map((rule) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rule-cell";
    button.addEventListener("click", () => app.setConfig({ aggregator: rule.id }));

    const name = document.createElement("span");
    name.className = "rule-name";
    bindText(name, () => tr(rule.name));
    const value = document.createElement("span");
    value.className = "rule-value";
    const chart = document.createElement("span");
    chart.className = "spark";
    button.append(name, value, chart);
    container.append(button);

    const surface = new Surface(chart, 0.24, onResize, () => label(tr(rule.name)));
    return { rule, button, value, surface };
  });
}

export interface Line {
  /** One value per slot; null leaves a gap (not computed yet). */
  values: readonly (number | null)[];
  color: string;
  dots?: boolean;
}

/** Accuracy lines on a 0–100% scale with a dashed chance level. Slots spread evenly across the width. */
export function drawLines(surface: Surface, slots: number, chance: number, lines: readonly Line[]): void {
  const { ctx, width, height } = surface;
  const colors = palette();
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, slots - 1)) * (width - 2 * pad);
  const y = (acc: number) => pad + (1 - acc) * (height - 2 * pad);
  surface.clear();

  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = colors.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y(chance));
  ctx.lineTo(width, y(chance));
  ctx.stroke();
  ctx.setLineDash([]);

  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.fillStyle = line.color;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let drawing = false;
    line.values.forEach((v, i) => {
      if (v === null) {
        drawing = false;
        return;
      }
      if (drawing) ctx.lineTo(x(i), y(v));
      else ctx.moveTo(x(i), y(v));
      drawing = true;
    });
    ctx.stroke();
    if (line.dots) {
      line.values.forEach((v, i) => {
        if (v === null) return;
        ctx.beginPath();
        ctx.arc(x(i), y(v), 2.6, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }
}

/** Which slot the pointer is over. */
export function slotAt(surface: Surface, slots: number, event: PointerEvent): number {
  const pad = 4;
  const { x } = surface.pointer(event);
  const i = Math.round(((x - pad) / (surface.width - 2 * pad)) * (slots - 1));
  return Math.max(0, Math.min(slots - 1, i));
}
