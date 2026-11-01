import { bindText } from "./i18n";

/** A canvas that stays sharp on high-density screens and follows its container's width. */
export class Surface {
  readonly canvas = document.createElement("canvas");
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  constructor(
    container: HTMLElement,
    private readonly aspect: number,
    onResize: () => void,
    label: () => string,
  ) {
    this.ctx = this.canvas.getContext("2d")!;
    this.canvas.setAttribute("role", "img");
    bindText(this.canvas, label, "aria-label");
    container.append(this.canvas);
    new ResizeObserver(() => {
      this.fit(container.clientWidth);
      onResize();
    }).observe(container);
    this.fit(container.clientWidth);
  }

  private fit(width: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.round(this.width * this.aspect);
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /** Pointer position in CSS pixels relative to the canvas. */
  pointer(event: PointerEvent): { x: number; y: number } {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
}
