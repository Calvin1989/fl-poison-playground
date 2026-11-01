/** Save rows as a CSV file. The first row is the header. */
export function downloadCsv(filename: string, rows: readonly (readonly (string | number)[])[]): void {
  const quote = (cell: string | number) => {
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv + "\n"], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Accuracy as a fraction with four decimals, the format most plotting tools expect. */
export const csvNumber = (v: number) => v.toFixed(4);
