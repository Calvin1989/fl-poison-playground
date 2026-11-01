import { DATASETS, balancedSet } from "../../core/datasets";
import { createRng } from "../../core/random";
import type { Control } from "../controls";
import { bindText, t, tr } from "../i18n";
import { palette } from "../theme";

const THUMB = 52;

/** Dataset choice as small pictures of the data itself. */
export function datasetPicker(onChange: (id: string) => void): Control<string> {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "datasets";
  const legend = document.createElement("legend");
  bindText(legend, () => t().dataset);
  const row = document.createElement("div");
  row.className = "dataset-row";
  const colors = palette();
  const dpr = window.devicePixelRatio || 1;

  const inputs = DATASETS.map((dataset) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dataset";
    input.value = dataset.id;
    input.addEventListener("change", () => input.checked && onChange(dataset.id));

    const canvas = document.createElement("canvas");
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    canvas.style.width = `${THUMB}px`;
    canvas.style.height = `${THUMB}px`;
    canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    for (const s of balancedSet(createRng(4), dataset, 45)) {
      ctx.fillStyle = colors.classes[s.label];
      ctx.beginPath();
      ctx.arc(((s.x + 1.1) / 2.2) * THUMB, ((1.1 - s.y) / 2.2) * THUMB, 1.6, 0, 2 * Math.PI);
      ctx.fill();
    }

    const name = document.createElement("span");
    bindText(name, () => tr(dataset.name));
    label.append(input, canvas, name);
    row.append(label);
    return input;
  });

  fieldset.append(legend, row);
  return {
    element: fieldset,
    set(id) {
      inputs.forEach((input) => (input.checked = input.value === id));
    },
  };
}
