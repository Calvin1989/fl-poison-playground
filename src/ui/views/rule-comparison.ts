import { FIXED } from "../../core/config";
import type { App, Frame, View } from "../app";
import { t, tr } from "../i18n";
import { palette } from "../theme";
import { hideTooltip, showTooltip } from "../tooltip";
import { buildRuleCells, drawLines, slotAt, type RuleCell } from "./rule-cells";

/**
 * Small multiples: one accuracy curve per rule, all on the same clients and
 * attackers, each over the clean FedAvg reference. Clicking a rule selects it.
 */
export class RuleComparison implements View {
  private readonly cells: RuleCell[];
  private frame: Frame | null = null;

  constructor(container: HTMLElement, app: App) {
    this.cells = buildRuleCells(container, app, (rule) => t().compareLabel(rule), () => this.frame && this.render(this.frame));
    for (const cell of this.cells) {
      const canvas = cell.surface.canvas;
      canvas.addEventListener("pointermove", (e) => this.onPointer(cell, e));
      canvas.addEventListener("pointerleave", hideTooltip);
    }
  }

  render(frame: Frame): void {
    this.frame = frame;
    const colors = palette();
    for (const cell of this.cells) {
      const run = frame.runs.get(cell.rule.id);
      if (!run) continue;
      cell.button.setAttribute("aria-pressed", String(run === frame.sim));
      cell.value.textContent = run.round ? `${(run.accuracy[run.round] * 100).toFixed(1)}%` : "–";
      drawLines(cell.surface, FIXED.maxRounds + 1, 1 / run.model.classes, [
        { values: frame.reference.accuracy, color: colors.ink3 },
        { values: run.accuracy, color: colors.ink },
      ]);
    }
  }

  private onPointer(cell: RuleCell, event: PointerEvent): void {
    const run = this.frame?.runs.get(cell.rule.id);
    if (!run || !this.frame) return;
    const round = slotAt(cell.surface, FIXED.maxRounds + 1, event);
    if (round > run.round) return hideTooltip();
    const m = t();
    showTooltip(event, [
      m.roundN(round),
      m.seriesValue(tr(cell.rule.name), run.accuracy[round]),
      m.seriesValue(m.cleanFedAvg, this.frame.reference.accuracy[round]),
    ]);
  }
}
