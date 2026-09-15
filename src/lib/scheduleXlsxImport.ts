export type ParsedShiftRow = {
  employeeName: string;
  workDate: string;
  isOff: boolean;
  hasData: boolean;
  start?: string;
  breakStart?: string;
  breakEnd?: string;
  end?: string;
};

export type ParseResult = {
  rows: ParsedShiftRow[];
  sheetName: string;
};

// Matches the "Períodos e Carga Horária" tab of the Controle_Jornada spreadsheets — the one sheet
// with raw entrada/intervalo/retorno/saída per employee per day. The other tabs in that workbook
// (Painel Geral, Interjornadas, Regras Domingo, Legenda) are derived compliance views, not source
// data, so they're intentionally not read here.
const SHEET_NAME_HINT = /per[ií]odos.*carga/i;

function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function excelFractionToTime(fraction: number): string {
  const totalMinutes = Math.round(fraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export async function parseScheduleWorkbook(file: File): Promise<ParseResult> {
  // Loaded on demand — xlsx is a large dependency and most sessions never import a spreadsheet.
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.find((name) => SHEET_NAME_HINT.test(name)) ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não tem nenhuma aba.");
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });

  const headerIndex = grid.findIndex(
    (row) =>
      row.some((cell) => typeof cell === "string" && cell.trim().toLowerCase() === "colaborador") &&
      row.some((cell) => typeof cell === "string" && cell.trim().toLowerCase() === "data"),
  );
  if (headerIndex === -1) {
    throw new Error(
      `Não encontrei as colunas "Colaborador" e "Data" na aba "${sheetName}". Confira se essa é a planilha certa.`,
    );
  }
  const header = grid[headerIndex].map((cell) => String(cell).trim().toLowerCase());
  const col = (label: string) => header.indexOf(label);
  const idxName = col("colaborador");
  const idxDate = col("data");
  const idxStart = col("entrada");
  const idxBreakStart = col("intervalo");
  const idxBreakEnd = col("retorno");
  const idxEnd = col("saída") !== -1 ? col("saída") : col("saida");
  if ([idxName, idxDate, idxStart, idxBreakStart, idxBreakEnd, idxEnd].some((index) => index === -1)) {
    throw new Error(
      `A aba "${sheetName}" não tem todas as colunas esperadas (Colaborador, Data, Entrada, Intervalo, Retorno, Saída).`,
    );
  }

  const rows: ParsedShiftRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    const nameRaw = row[idxName];
    const dateRaw = row[idxDate];
    if (!nameRaw || typeof dateRaw !== "number") continue; // blank separator row between employee blocks
    const employeeName = String(nameRaw).trim();
    const workDate = excelSerialToIso(dateRaw);
    const cells = [row[idxStart], row[idxBreakStart], row[idxBreakEnd], row[idxEnd]];
    const isOff = cells.some((cell) => typeof cell === "string" && cell.trim().toUpperCase().startsWith("FOLGA"));
    if (isOff) {
      rows.push({ employeeName, workDate, isOff: true, hasData: true });
      continue;
    }
    const asTime = (cell: unknown) => (typeof cell === "number" ? excelFractionToTime(cell) : undefined);
    const start = asTime(row[idxStart]);
    const breakStart = asTime(row[idxBreakStart]);
    const breakEnd = asTime(row[idxBreakEnd]);
    const end = asTime(row[idxEnd]);
    if (!start || !breakStart || !breakEnd || !end) {
      // Not yet filled in the spreadsheet (or only partially) — leave whatever is already in the
      // app for this employee/day untouched rather than guess at a broken shift.
      rows.push({ employeeName, workDate, isOff: false, hasData: false });
      continue;
    }
    rows.push({ employeeName, workDate, isOff: false, hasData: true, start, breakStart, breakEnd, end });
  }
  return { rows, sheetName };
}
