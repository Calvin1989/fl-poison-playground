import type { Knob } from "../core/knob";
import type { Localized } from "../core/text";
import { bindText, onLanguageChange, tr } from "./i18n";

/** A control that can be told its current value from outside (after a reset or a scenario). */
export interface Control<T> {
  element: HTMLElement;
  set(value: T): void;
}

let uid = 0;

const LOG_STEPS = 1000;

/** A labelled range input for one Knob. */
export function slider(knob: Knob, onInput: (value: number) => void): Control<number> {
  const id = `knob-${uid++}`;
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.htmlFor = id;
  bindText(label, () => tr(knob.label));
  const output = document.createElement("output");
  output.htmlFor = id;
  const input = document.createElement("input");
  input.type = "range";
  input.id = id;

  const [lo, hi] = knob.log ? [Math.log10(knob.min), Math.log10(knob.max)] : [knob.min, knob.max];
  const toInput = (v: number) => (knob.log ? ((Math.log10(v) - lo) / (hi - lo)) * LOG_STEPS : v);
  const fromInput = (raw: number) => (knob.log ? roundNicely(10 ** (lo + (raw / LOG_STEPS) * (hi - lo))) : raw);
  input.min = String(knob.log ? 0 : knob.min);
  input.max = String(knob.log ? LOG_STEPS : knob.max);
  input.step = String(knob.log ? 1 : knob.step);

  const show = (v: number) => {
    const text = knob.format ? knob.format(v) : String(v);
    output.textContent = text;
    input.setAttribute("aria-valuetext", text);
  };

  input.addEventListener("input", () => {
    const value = fromInput(Number(input.value));
    show(value);
    onInput(value);
  });

  field.append(label, output, input);
  return {
    element: field,
    set(value) {
      input.value = String(toInput(value));
      show(value);
    },
  };
}

/** Two significant digits, so log sliders land on readable values. */
function roundNicely(v: number): number {
  const digits = Math.max(0, 1 - Math.floor(Math.log10(v)));
  return Number(v.toFixed(digits));
}

/** A slot that shows a slider for whichever knob is current, or nothing. */
export function knobSlot(onInput: (value: number) => void): {
  element: HTMLElement;
  set(knob: Knob | undefined, value: number): void;
} {
  const element = document.createElement("div");
  let current: Knob | undefined;
  let control: Control<number> | null = null;
  return {
    element,
    set(knob, value) {
      if (knob !== current) {
        current = knob;
        control = knob ? slider(knob, onInput) : null;
        element.replaceChildren(...(control ? [control.element] : []));
      }
      control?.set(value);
    },
  };
}

export interface Choice {
  id: string;
  name: Localized;
  description: Localized;
}

/** A drop-down of options, labelled by an existing heading, with the selected option's description underneath. */
export function choiceSelect(labelledBy: string, options: readonly Choice[], onChange: (id: string) => void): Control<string> {
  const wrapper = document.createElement("div");
  wrapper.className = "choice";
  const select = document.createElement("select");
  select.setAttribute("aria-labelledby", labelledBy);
  const note = document.createElement("p");
  note.className = "note";

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.id;
    bindText(element, () => tr(option.name));
    select.append(element);
  }
  select.addEventListener("change", () => onChange(select.value));

  const describe = () => {
    const option = options.find((o) => o.id === select.value);
    note.textContent = option ? tr(option.description) : "";
  };
  onLanguageChange(describe);

  wrapper.append(select, note);
  return {
    element: wrapper,
    set(id) {
      select.value = id;
      describe();
    },
  };
}
