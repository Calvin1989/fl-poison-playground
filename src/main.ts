import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/800.css";
import "./styles.css";

import { AGGREGATORS, getAggregator } from "./core/aggregators";
import { ATTACKS, getAttack } from "./core/attacks";
import { IID_ALPHA, KNOBS, fromHash, toHash, type Config } from "./core/config";
import { SCENARIOS } from "./core/scenarios";
import { SWEEP_ROUNDS } from "./core/sweep";
import { App } from "./ui/app";
import { choiceSelect, knobSlot, slider } from "./ui/controls";
import { csvNumber, downloadCsv } from "./ui/download";
import { LANGS, bindText, lang, onLanguageChange, setLang, t, tr, type Messages } from "./ui/i18n";
import { legendItem, swatch } from "./ui/marks";
import { palette } from "./ui/theme";
import { BoundaryView } from "./ui/views/boundary";
import { ClientStrip } from "./ui/views/client-strip";
import { datasetPicker } from "./ui/views/dataset-picker";
import { RuleComparison } from "./ui/views/rule-comparison";
import { SweepPanel } from "./ui/views/sweep-panel";
import { UpdateMap } from "./ui/views/update-map";

const $ = (id: string) => document.getElementById(id)!;

document.fonts.ready.then(start);

/** The page opens at round 0. Training starts only when someone presses Run or picks a scenario. */
function start(): void {
  buildLanguage();

  const app = new App(fromHash(location.hash));
  buildControls(app);
  buildLegends();

  app.addView(new ClientStrip($("client-strip"), app));
  app.addView(new UpdateMap($("update-map"), app, $("update-readout")));
  app.addView(new BoundaryView($("boundary"), $("boundary-caption")));
  app.addView(new RuleComparison($("rule-comparison"), app));
  $("compare-csv").addEventListener("click", () => {
    const [header, ...rows] = app.experiment.table();
    const formatted = rows.map(([round, ...values]) => [round, ...values.map(csvNumber)]);
    downloadCsv(`accuracy-by-round-${app.experiment.round}.csv`, [header, ...formatted]);
  });

  bindText($("sweep-note"), () => t().sweepNote(SWEEP_ROUNDS));
  new SweepPanel($("sweep-panel"), app);

  buildTransport(app);
  buildScenarios(app);
}

/** The language switch, plus every static text on the page. */
function buildLanguage(): void {
  const group = $("lang-switch");
  bindText(group, () => t().language, "aria-label");
  const buttons = LANGS.map(({ id, name }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.lang = id;
    button.textContent = name;
    button.addEventListener("click", () => setLang(id));
    group.append(button);
    return { id, button };
  });

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as keyof Messages;
    bindText(el, () => t()[key] as string, el.dataset.i18nAttr);
  });

  const sync = () => {
    document.documentElement.lang = lang() === "zh" ? "zh-CN" : "en";
    buttons.forEach(({ id, button }) => button.setAttribute("aria-pressed", String(id === lang())));
    // Our own markup with links, not user input.
    $("credits").innerHTML = t().credits;
  };
  sync();
  onLanguageChange(sync);
}

function buildControls(app: App): void {
  const set = (change: Partial<Config>) => app.setConfig(change);

  const dataset = datasetPicker((id) => set({ dataset: id }));
  const alpha = slider(KNOBS.alpha, (v) => set({ alpha: v }));
  const alphaNote = document.createElement("p");
  alphaNote.className = "note";
  bindText(alphaNote, () => describeSplit(app.config.alpha));
  const clients = slider(KNOBS.clients, (v) => set({ clients: v }));
  $("data-controls").append(dataset.element, alpha.element, alphaNote, clients.element);

  const attackTitle = document.createElement("h3");
  attackTitle.id = "attack-title";
  bindText(attackTitle, () => t().attack);
  const attack = choiceSelect("attack-title", ATTACKS, (id) => set({ attack: id }));
  const share = slider(KNOBS.maliciousShare, (v) => set({ maliciousShare: v }));
  const strength = knobSlot((v) => set({ strength: v }));
  $("attack-controls").append(attackTitle, attack.element, share.element, strength.element);

  const ruleTitle = document.createElement("h3");
  ruleTitle.id = "rule-title";
  bindText(ruleTitle, () => t().rule);
  const rule = choiceSelect("rule-title", AGGREGATORS, (id) => set({ aggregator: id }));
  const ruleParam = knobSlot((v) => set({ aggregatorParam: v }));
  $("rule-controls").append(ruleTitle, rule.element, ruleParam.element);

  const epochs = slider(KNOBS.epochs, (v) => set({ epochs: v }));
  const learningRate = slider(KNOBS.learningRate, (v) => set({ learningRate: v }));
  const training = document.createElement("h3");
  training.id = "training-title";
  bindText(training, () => t().localTraining);
  $("data-controls").append(training, epochs.element, learningRate.element);

  app.onConfig((c) => {
    dataset.set(c.dataset);
    alpha.set(c.alpha);
    alphaNote.textContent = describeSplit(c.alpha);
    clients.set(c.clients);
    attack.set(c.attack);
    share.set(c.maliciousShare);
    strength.set(getAttack(c.attack).strength, c.strength);
    rule.set(c.aggregator);
    ruleParam.set(getAggregator(c.aggregator).param, c.aggregatorParam);
    epochs.set(c.epochs);
    learningRate.set(c.learningRate);
  });
}

function describeSplit(alpha: number): string {
  const m = t();
  if (alpha >= IID_ALPHA) return m.splitIid;
  if (alpha >= 1) return m.splitMild;
  if (alpha >= 0.3) return m.splitLean;
  return m.splitExtreme;
}

function buildLegends(): void {
  const colors = palette();

  const note = document.createElement("p");
  note.className = "note";
  bindText(note, () => t().clientStripNote);
  $("client-legend").append(
    ...colors.classes.map((c, k) => legendItem(swatch("bar", c, true, 5), () => t().className(k))),
    legendItem(swatch("bar", colors.malicious, true, 5), () => t().malicious),
    note,
  );

  $("update-legend").append(
    legendItem(swatch("circle", colors.classes[0]), () => t().legendHonest),
    legendItem(swatch("triangle", colors.malicious), () => t().legendMalicious),
    legendItem(swatch("circle", colors.ink2, false), () => t().legendHollow),
    legendItem(swatch("ring", colors.ink, true, 5), () => t().legendHonestMean),
    legendItem(swatch("cross", colors.ink, true, 4), () => t().legendServer),
  );
}

function buildTransport(app: App): void {
  const play = $("play") as HTMLButtonElement;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  play.addEventListener("click", () => (app.running ? app.pause() : app.play()));
  $("step").addEventListener("click", () => app.step());
  $("reset").addEventListener("click", () => app.reset());

  const share = $("share") as HTMLButtonElement;
  let shareState: "copyLink" | "linkCopied" | "copyFailed" = "copyLink";
  bindText(share, () => t()[shareState]);
  share.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#${toHash(app.config)}`;
    try {
      await navigator.clipboard.writeText(url);
      shareState = "linkCopied";
    } catch {
      shareState = "copyFailed";
    }
    share.textContent = t()[shareState];
    setTimeout(() => {
      shareState = "copyLink";
      share.textContent = t()[shareState];
    }, 1600);
  });

  bindText($("reset"), () => t().reset, "aria-label");
  bindText($("step"), () => t().step, "aria-label");
  bindText($("reset"), () => t().reset, "title");
  bindText($("step"), () => t().step, "title");

  app.onStatus(() => {
    const { sim, reference } = app;
    const m = t();
    const label = app.running ? m.pause : app.experiment.finished ? m.runAgain : m.run;
    play.setAttribute("aria-label", label);
    play.title = label;
    play.classList.toggle("playing", app.running);
    $("round").textContent = String(sim.round);
    $("accuracy").textContent = sim.round ? pct(sim.accuracy[sim.round]) : "–";
    $("reference").textContent = sim.round ? pct(reference.accuracy[reference.round]) : "–";
  });
}

function buildScenarios(app: App): void {
  const list = $("scenario-list");
  const buttons = SCENARIOS.map((scenario) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario";
    const title = document.createElement("strong");
    bindText(title, () => tr(scenario.title));
    const text = document.createElement("span");
    bindText(text, () => tr(scenario.text));
    button.append(title, text);
    const item = document.createElement("li");
    item.append(button);
    // Picking a scenario is an explicit request, so it starts right away.
    button.addEventListener("click", () => {
      app.setConfig(scenario.config);
      app.reset();
      app.play();
      window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    list.append(item);
    return { button, scenario };
  });

  app.onConfig((config) => {
    const current = toHash(config);
    buttons.forEach(({ button, scenario }) => button.setAttribute("aria-current", String(toHash(scenario.config) === current)));
  });
}
