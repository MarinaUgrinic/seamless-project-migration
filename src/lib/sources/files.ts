import * as XLSX from "xlsx";
import type { Cell, Workbook } from "./bundle";

const csvCell = (v: Cell) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Serialises a generated workbook to its demonstrated format: CSV, legacy XLS (BIFF8) or XLSX. */
export function workbookToFile(wb: Workbook): { data: Uint8Array | string; mime: string } {
  if (wb.format === "csv") return { data: wb.sheets[0]!.rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", mime: "text/csv" };
  const book = XLSX.utils.book_new();
  for (const s of wb.sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
  const data = XLSX.write(book, { bookType: wb.format === "xls" ? "biff8" : "xlsx", type: "array" }) as ArrayBuffer;
  return { data: new Uint8Array(data), mime: wb.format === "xls" ? "application/vnd.ms-excel" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

/** Reads CSV/XLS/XLSX back into sheet grids anchored at A1 so header row/column offsets stay exact. */
export function fileToWorkbook(data: Uint8Array | string, format: Workbook["format"]): Workbook {
  const book = typeof data === "string" ? XLSX.read(data, { type: "string", raw: true }) : XLSX.read(data, { type: "array" });
  return {
    format,
    sheets: book.SheetNames.map((name) => {
      const ws = book.Sheets[name]!;
      if (ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.r = 0; r.s.c = 0; ws["!ref"] = XLSX.utils.encode_range(r); }
      const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
      return { name, rows };
    }),
  };
}
