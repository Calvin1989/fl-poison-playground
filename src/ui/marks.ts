import { bindText } from "./i18n";
import { palette } from "./theme";

export type Shape = "circle" | "triangle" | "ring" | "cross" | "bar";

/**
 * Every point marker on the page is drawn here, so a symbol in a legend
 * is pixel-for-pixel the symbol in the chart.
 */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  size: number,
  color: string,
  filled = true,
): void {
  const { sheet } = palette();
  ctx.save();
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      break;
    case "triangle":
      ctx.moveTo(x, y - size * 1.15);
      ctx.lineTo(x + size, y + size * 0.65);
      ctx.lineTo(x - size, y + size * 0.65);
      ctx.closePath();
      break;
    case "ring":
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
      return;
    case "cross":
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.moveTo(x + size, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineCap = "round";
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = sheet;
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
      return;
    case "bar":
      ctx.roundRect(x - size * 0.45, y - size, size * 0.9, size * 2, 1.5);
      break;
  }
  if (filled) {
    // A thin ring in the surface color keeps overlapping marks apart.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = sheet;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = sheet;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.restore();
}

/** A legend symbol: a tiny canvas drawn with the same code as the chart. */
export function swatch(shape: Shape, color: string, filled = true, size = 4.5): HTMLCanvasElement {
  const px = 16;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = px * dpr;
  canvas.height = px * dpr;
  canvas.style.width = `${px}px`;
  canvas.style.height = `${px}px`;
  canvas.className = "swatch";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  drawMarker(ctx, shape, px / 2, px / 2 + (shape === "triangle" ? 1 : 0), size, color, filled);
  return canvas;
}

/** A legend entry: symbol plus text in the current language. */
export function legendItem(symbol: HTMLElement, text: () => string): HTMLElement {
  const item = document.createElement("span");
  item.className = "legend-item";
  const label = document.createElement("span");
  bindText(label, text);
  item.append(symbol, label);
  return item;
}
