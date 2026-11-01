import { AGGREGATORS } from "../../core/aggregators";
import { getDataset } from "../../core/datasets";
import { toHash, updateConfig, type Config } from "../../core/config";
import { SWEEPS, SWEEP_ROUNDS, type Sweep, type SweepPoint } from "../../core/sweep";
import type { SweepMessage, SweepRequest } from "../../workers/sweep-worker";
import type { App } from "../app";
import { csvNumber, downloadCsv } from "../download";
import { bindText, onLanguageChange, t, tr } from "../i18n";
import { palette } from "../theme";
import { hideTooltip, showTooltip } from "../tooltip";
import { buildRuleCells, drawLines, slotAt, type RuleCell } from "./rule-cells";

type Status = "idle" | "running" | "done" | "stopped";

/**
 * Varies one setting across a list of values and plots every rule's final
 * accuracy at each value. The work runs in a Web Worker.
 */
export class SweepPanel {
  private sweep: Sweep = SWEEPS[0];
  private points: (SweepPoint | null)[] = [];
  private status: Status = "idle";
  /** The setup the current results belong to, to notice when they go stale. */
  private resultsFor = "";
  private worker: Worker | null = null;

  private readonly cells: RuleCell[];
  private readonly runButton: HTMLButtonElement;
  private readonly csvButton: HTMLButtonElement;
  private readonly statusLine: HTMLElement;
  private readonly sweepButtons: { sweep: Sweep; button: HTMLButtonElement }[];
  private readonly axis: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly app: App,
  ) {
    const toolbar = document.createElement("div");
    toolbar.className = "sweep-toolbar";

    const vary = document.createElement("div");
    vary.className = "segmented";
    vary.setAttribute("role", "group");
    bindText(vary, () => t().sweepVary, "aria-label");
    const varyLabel = document.createElement("span");
    varyLabel.className = "segmented-label";
    bindText(varyLabel, () => t().sweepVary);
    this.sweepButtons = SWEEPS.map((sweep) => {
      const button = document.createElement("button");
      button.type = "button";
      bindText(button, () => tr(sweep.name));
      button.addEventListener("click", () => this.choose(sweep));
      vary.append(button);
      return { sweep, button };
    });

    this.runButton = document.createElement("button");
    this.runButton.type = "button";
    this.runButton.className = "primary";
    this.runButton.addEventListener("click", () => (this.status === "running" ? this.stop() : this.start()));

    this.statusLine = document.createElement("p");
    this.statusLine.className = "note sweep-status";
    this.statusLine.setAttribute("role", "status");

    this.csvButton = document.createElement("button");
    this.csvButton.type = "button";
    this.csvButton.className = "quiet";
    bindText(this.csvButton, () => t().downloadCsv);
    this.csvButton.addEventListener("click", () => this.download());

    toolbar.append(varyLabel, vary, this.runButton, this.statusLine, this.csvButton);

    const grid = document.createElement("div");
    grid.className = "rule-grid";
    this.cells = buildRuleCells(grid, app, (rule) => t().sweepLabel(rule), () => this.render());
    this.cells.forEach((cell) => {
      const canvas = cell.surface.canvas;
      canvas.addEventListener("pointermove", (e) => this.onPointer(cell, e));
      canvas.addEventListener("pointerleave", hideTooltip);
    });

    this.axis = document.createElement("p");
    this.axis.className = "note sweep-axis";

    root.append(toolbar, grid, this.axis);
    app.onConfig(() => this.render());
    onLanguageChange(() => this.render());
    this.render();
  }

  /** The config a sweep runs on: the current one, with each rule at its default knob. */
  private base(): Config {
    return updateConfig(this.app.config, { aggregator: "fedavg" });
  }

  private key(): string {
    return `${this.sweep.id}|${toHash(updateConfig(this.base(), this.sweep.apply(this.sweep.values[0])))}`;
  }

  private choose(sweep: Sweep): void {
    if (sweep === this.sweep) return;
    this.stop();
    this.sweep = sweep;
    this.points = [];
    this.status = "idle";
    this.render();
  }

  private start(): void {
    this.stop();
    this.points = this.sweep.values.map(() => null);
    this.resultsFor = this.key();
    this.status = "running";
    this.worker = new Worker(new URL("../../workers/sweep-worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<SweepMessage>) => {
      if (event.data.type === "point") this.points[event.data.point.index] = event.data.point;
      else {
        this.status = "done";
        this.worker?.terminate();
        this.worker = null;
      }
      this.render();
    };
    this.worker.postMessage({ config: this.base(), sweepId: this.sweep.id } satisfies SweepRequest);
    this.render();
  }

  private stop(): void {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
    this.status = "stopped";
    this.render();
  }

  private render(): void {
    const m = t();
    const colors = palette();
    const done = this.points.filter(Boolean).length;
    const stale = this.status !== "idle" && this.status !== "running" && this.resultsFor !== this.key();

    this.sweepButtons.forEach(({ sweep, button }) => button.setAttribute("aria-pressed", String(sweep === this.sweep)));
    this.runButton.textContent = this.status === "running" ? m.sweepStop : m.sweepRun;
    this.csvButton.hidden = done === 0;
    this.statusLine.textContent = stale
      ? m.sweepStale
      : this.status === "running"
        ? m.sweepProgress(done, this.sweep.values.length)
        : this.status === "done"
          ? m.sweepDone
          : this.status === "stopped"
            ? m.sweepStopped
            : m.sweepIdle;
    const values = this.sweep.values;
    this.axis.textContent = m.sweepAxis(tr(this.sweep.name), values.map((v) => this.sweep.format(v)));

    const chance = 1 / getDataset(this.app.config.dataset).classes;
    for (const cell of this.cells) {
      cell.button.setAttribute("aria-pressed", String(cell.rule.id === this.app.config.aggregator));
      cell.button.classList.toggle("stale", stale);
      const scores = this.points.map((p) => (p ? p.scores[cell.rule.id] : null));
      const last = [...scores].reverse().find((s) => s !== null);
      cell.value.textContent = last == null ? "–" : `${(last * 100).toFixed(1)}%`;
      drawLines(cell.surface, values.length, chance, [
        { values: this.points.map((p) => (p ? p.reference : null)), color: colors.ink3 },
        { values: scores, color: colors.ink, dots: true },
      ]);
    }
  }

  private onPointer(cell: RuleCell, event: PointerEvent): void {
    const i = slotAt(cell.surface, this.sweep.values.length, event);
    const point = this.points[i];
    if (!point) return hideTooltip();
    const m = t();
    showTooltip(event, [
      tr(cell.rule.name),
      m.sweepPoint(tr(this.sweep.name), this.sweep.format(this.sweep.values[i])),
      m.seriesValue(tr(cell.rule.name), point.scores[cell.rule.id]),
      m.seriesValue(m.cleanFedAvg, point.reference),
    ]);
  }

  private download(): void {
    const ids = AGGREGATORS.map((a) => a.id);
    const rows = this.points.flatMap((p) =>
      p ? [[this.sweep.values[p.index], ...ids.map((id) => csvNumber(p.scores[id])), csvNumber(p.reference)]] : [],
    );
    downloadCsv(`sweep-${this.sweep.id}-${SWEEP_ROUNDS}-rounds.csv`, [[this.sweep.id, ...ids, "clean_fedavg"], ...rows]);
  }
}
