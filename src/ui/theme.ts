/**
 * Colors come from CSS custom properties in styles.css, so the stylesheet stays
 * the single source of truth. Each color means one thing everywhere on the page.
 */
export interface Palette {
  sheet: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  classes: string[];
  malicious: string;
  /** Font family for text drawn on canvases. */
  font: string;
}

let cached: Palette | null = null;

export function palette(): Palette {
  if (cached) return cached;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim();
  cached = {
    sheet: read("--sheet"),
    ink: read("--ink"),
    ink2: read("--ink-2"),
    ink3: read("--ink-3"),
    rule: read("--rule"),
    classes: [read("--class-0"), read("--class-1"), read("--class-2")],
    malicious: read("--malicious"),
    font: read("--font"),
  };
  return cached;
}

/** "#rrggbb" to [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
