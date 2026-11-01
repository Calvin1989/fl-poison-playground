import type { Localized } from "./text";

/** A single tunable number on an attack or a defense, rendered as a slider. */
export interface Knob {
  label: Localized;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Move the slider on a log scale; `step` is then ignored. */
  log?: boolean;
  /** How the value reads next to the slider. */
  format?: (value: number) => string;
}

export function clampToKnob(knob: Knob, value: number): number {
  if (!Number.isFinite(value)) return knob.default;
  return Math.min(knob.max, Math.max(knob.min, value));
}
