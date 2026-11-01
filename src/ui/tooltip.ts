/** One shared tooltip for every chart. */
const element = document.createElement("div");
element.className = "tooltip";
element.setAttribute("role", "status");
element.hidden = true;
document.body.append(element);

export function showTooltip(event: PointerEvent, lines: string[]): void {
  element.replaceChildren(
    ...lines.map((line, i) => {
      const row = document.createElement(i === 0 ? "strong" : "span");
      row.textContent = line;
      return row;
    }),
  );
  element.hidden = false;
  const pad = 14;
  const { width, height } = element.getBoundingClientRect();
  const x = Math.min(event.clientX + pad, window.innerWidth - width - 8);
  const y = event.clientY + pad + height > window.innerHeight ? event.clientY - height - pad : event.clientY + pad;
  element.style.transform = `translate(${x}px, ${y}px)`;
}

export function hideTooltip(): void {
  element.hidden = true;
}
