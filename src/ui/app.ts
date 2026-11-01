import { toHash, updateConfig, type Config } from "../core/config";
import { Experiment } from "../core/experiment";
import type { Simulation } from "../core/simulation";
import { onLanguageChange } from "./i18n";

/** What every view draws from. */
export interface Frame {
  /** The run of the selected rule. */
  sim: Simulation;
  /** Same clients and data, nobody attacks, plain FedAvg. The yardstick for damage. */
  reference: Simulation;
  /** Every rule's run, keyed by rule id. */
  runs: ReadonlyMap<string, Simulation>;
  /** Client under the pointer, highlighted in every view. */
  hovered: number | null;
}

export interface View {
  render(frame: Frame): void;
}

const ROUND_MS = 110;

/** Owns the experiment and the play loop. Views and controls only talk to the App. */
export class App {
  readonly experiment: Experiment;
  running = false;
  hovered: number | null = null;

  private readonly views: View[] = [];
  private readonly configListeners: ((config: Config) => void)[] = [];
  private readonly statusListeners: (() => void)[] = [];
  private lastStep = 0;

  constructor(config: Config) {
    this.experiment = new Experiment(config);
    onLanguageChange(() => {
      this.render();
      this.notify();
    });
    requestAnimationFrame(this.tick);
  }

  get config(): Config {
    return this.experiment.config;
  }

  get sim(): Simulation {
    return this.experiment.selected;
  }

  get reference(): Simulation {
    return this.experiment.reference;
  }

  addView(view: View): void {
    this.views.push(view);
    view.render(this.frame());
  }

  /** Called with the full config whenever it changes, so controls can show it. */
  onConfig(listener: (config: Config) => void): void {
    this.configListeners.push(listener);
    listener(this.config);
  }

  /** Called when the round, the play state or the language changes. */
  onStatus(listener: () => void): void {
    this.statusListeners.push(listener);
    listener();
  }

  /** Changing the rule keeps the run going; any other change starts over from round 0. */
  setConfig(change: Partial<Config>): void {
    this.experiment.configure(updateConfig(this.config, change));
    history.replaceState(null, "", `${location.search}#${toHash(this.config)}`);
    this.configListeners.forEach((l) => l(this.config));
    this.render();
    this.notify();
  }

  play(): void {
    if (this.experiment.finished) this.experiment.restart();
    this.running = true;
    this.render();
    this.notify();
  }

  pause(): void {
    this.running = false;
    this.notify();
  }

  step(): void {
    this.pause();
    if (!this.experiment.finished) this.advance();
  }

  reset(): void {
    this.experiment.restart();
    this.render();
    this.notify();
  }

  hover(clientId: number | null): void {
    if (clientId === this.hovered) return;
    this.hovered = clientId;
    this.render();
  }

  private advance(): void {
    this.experiment.step();
    if (this.experiment.finished) this.running = false;
    this.render();
    this.notify();
  }

  private readonly tick = (now: number) => {
    if (this.running && now - this.lastStep >= ROUND_MS) {
      this.lastStep = now;
      this.advance();
    }
    requestAnimationFrame(this.tick);
  };

  private frame(): Frame {
    return { sim: this.sim, reference: this.reference, runs: this.experiment.runs, hovered: this.hovered };
  }

  private render(): void {
    const frame = this.frame();
    this.views.forEach((v) => v.render(frame));
  }

  private notify(): void {
    this.statusListeners.forEach((l) => l());
  }
}
