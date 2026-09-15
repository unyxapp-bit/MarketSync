import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, X, XCircle } from "lucide-react";
import { downloadCsv, parseCsv, toCsv } from "../../lib/csv";
import { saveEmployee } from "../../lib/marketSyncApi";

type Sector = { id: string; name: string };

type FieldKey = "fullName" | "jobTitle" | "sectorName" | "registration" | "weeklyHours" | "sex";

const fields: Array<{ key: FieldKey; label: string; required: boolean; guesses: string[] }> = [
  { key: "fullName", label: "Nome completo", required: true, guesses: ["nome", "nome completo", "colaborador", "full_name", "name"] },
  { key: "jobTitle", label: "Cargo", required: false, guesses: ["cargo", "função", "funcao", "job_title", "title"] },
  { key: "sectorName", label: "Setor", required: false, guesses: ["setor", "sector", "departamento"] },
  { key: "registration", label: "Matrícula", required: false, guesses: ["matrícula", "matricula", "registro", "registration", "matricula_num"] },
  { key: "weeklyHours", label: "Carga semanal (h)", required: false, guesses: ["carga", "carga semanal", "horas", "weekly_hours", "carga_horaria"] },
  { key: "sex", label: "Sexo", required: false, guesses: ["sexo", "genero", "gênero", "sex"] },
];

const sexAliases: Record<string, "male" | "female"> = {
  m: "male", masculino: "male", male: "male", homem: "male",
  f: "female", feminino: "female", female: "female", mulher: "female",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

type RowOutcome = { line: number; name: string; kind: "ok" | "warning" | "error"; message: string };

export function EmployeeCsvImport({
  storeId,
  sectors,
  onImported,
  onClose,
}: {
  storeId: string;
  sectors: Sector[];
  onImported: () => void;
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    fullName: "",
    jobTitle: "",
    sectorName: "",
    registration: "",
    weeklyHours: "",
    sex: "",
  });
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<RowOutcome[] | null>(null);

  const sectorByName = useMemo(
    () => new Map(sectors.map((sector) => [normalize(sector.name), sector.id])),
    [sectors],
  );

  const onFile = async (file: File) => {
    setFileName(file.name);
    setResults(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const nextMapping: Record<FieldKey, string> = {
      fullName: "",
      jobTitle: "",
      sectorName: "",
      registration: "",
      weeklyHours: "",
      sex: "",
    };
    for (const field of fields) {
      const match = parsed.headers.find((header) => field.guesses.includes(normalize(header)));
      if (match) nextMapping[field.key] = match;
    }
    setMapping(nextMapping);
  };

  const downloadTemplate = () => {
    const exampleSector = sectors[0]?.name ?? "Caixa";
    const csv = toCsv(
      ["Nome completo", "Cargo", "Setor", "Matrícula", "Carga semanal (h)", "Sexo"],
      [["Maria da Silva", "Operador(a) de caixa", exampleSector, "0001", "44", "F"]],
    );
    downloadCsv("modelo_colaboradores.csv", csv);
  };

  const columnIndex = (header: string) => headers.indexOf(header);
  const cell = (row: string[], field: FieldKey) => {
    const header = mapping[field];
    if (!header) return "";
    const index = columnIndex(header);
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };

  const ready = Boolean(mapping.fullName) && rows.length > 0;
  const previewRows = rows.slice(0, 5);

  const runImport = async () => {
    setImporting(true);
    const outcomes: RowOutcome[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const line = i + 2; // +1 for 0-index, +1 for the header row
      const fullName = cell(row, "fullName");
      if (!fullName) {
        outcomes.push({ line, name: "(sem nome)", kind: "error", message: "Nome em branco; linha ignorada." });
        continue;
      }
      const sectorNameRaw = cell(row, "sectorName");
      const sectorId = sectorNameRaw ? (sectorByName.get(normalize(sectorNameRaw)) ?? null) : null;
      const weeklyHoursRaw = cell(row, "weeklyHours").replace(",", ".");
      const weeklyHours = weeklyHoursRaw ? Number(weeklyHoursRaw) : 44;
      const sexRaw = cell(row, "sex");
      const sex = sexRaw ? (sexAliases[normalize(sexRaw)] ?? null) : null;
      try {
        await saveEmployee({
          employeeId: null,
          storeId,
          sectorId,
          fullName,
          jobTitle: cell(row, "jobTitle"),
          registration: cell(row, "registration"),
          weeklyHours: Number.isFinite(weeklyHours) ? weeklyHours : 44,
          status: "active",
          sex,
        });
        if (sectorNameRaw && !sectorId) {
          outcomes.push({
            line,
            name: fullName,
            kind: "warning",
            message: `Importado sem setor: "${sectorNameRaw}" não corresponde a nenhum setor cadastrado.`,
          });
        } else {
          outcomes.push({ line, name: fullName, kind: "ok", message: "Importado." });
        }
      } catch (error) {
        outcomes.push({
          line,
          name: fullName,
          kind: "error",
          message:
            error instanceof Error && error.message.includes("registration")
              ? "Já existe um colaborador com essa matrícula nesta loja."
              : error instanceof Error
                ? error.message
                : "Não foi possível importar esta linha.",
        });
      }
    }
    setResults(outcomes);
    setImporting(false);
    onImported();
  };

  const okCount = results?.filter((r) => r.kind === "ok").length ?? 0;
  const warnCount = results?.filter((r) => r.kind === "warning").length ?? 0;
  const errorCount = results?.filter((r) => r.kind === "error").length ?? 0;

  return (
    <div className="editor-backdrop" role="presentation">
      <section className="shift-editor directory-drawer" role="dialog" aria-modal="true">
        <div className="editor-head">
          <div>
            <p className="eyebrow">IMPORTAÇÃO EM LOTE</p>
            <h2>Importar colaboradores via CSV</h2>
            <p>Envie uma planilha exportada do seu sistema atual (Excel ou Google Sheets em .csv).</p>
          </div>
          <button className="editor-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <button className="outline" type="button" onClick={downloadTemplate}>
          <Download size={16} />
          Baixar modelo CSV em branco
        </button>

        <label className="csv-file-drop">
          <FileUp size={16} />
          {fileName || "Escolher arquivo .csv"}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>

        {headers.length > 0 && (
          <>
            <div className="directory-section">
              <h3>Mapeamento de colunas</h3>
              <div className="csv-mapping">
                {fields.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    {field.required && " *"}
                    <select
                      value={mapping[field.key]}
                      onChange={(event) =>
                        setMapping({ ...mapping, [field.key]: event.target.value })
                      }
                    >
                      <option value="">Não importar</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="directory-section">
              <h3>
                Pré-visualização ({rows.length} linha{rows.length === 1 ? "" : "s"} no arquivo)
              </h3>
              <div className="csv-preview-table">
                <div className="csv-preview-row csv-preview-head">
                  {fields.map((field) => (
                    <span key={field.key}>{field.label}</span>
                  ))}
                </div>
                {previewRows.map((row, index) => (
                  <div className="csv-preview-row" key={index}>
                    {fields.map((field) => (
                      <span key={field.key}>{cell(row, field.key) || "—"}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {!mapping.fullName && (
              <p className="editor-message error">
                Selecione qual coluna traz o nome completo para poder importar.
              </p>
            )}

            <div className="editor-actions">
              <button className="outline" type="button" onClick={onClose}>
                Fechar
              </button>
              <button className="solid" type="button" disabled={!ready || importing} onClick={runImport}>
                {importing ? "Importando..." : `Importar ${rows.length} colaborador${rows.length === 1 ? "" : "es"}`}
              </button>
            </div>
          </>
        )}

        {results && (
          <div className="directory-section">
            <h3>
              Resultado: {okCount} importado{okCount === 1 ? "" : "s"}
              {warnCount ? `, ${warnCount} com aviso` : ""}
              {errorCount ? `, ${errorCount} rejeitado${errorCount === 1 ? "" : "s"}` : ""}
            </h3>
            <div className="csv-report">
              {results
                .filter((r) => r.kind !== "ok")
                .map((outcome, index) => (
                  <div className={`csv-report-row ${outcome.kind}`} key={index}>
                    {outcome.kind === "error" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    <span>
                      Linha {outcome.line} · {outcome.name}
                    </span>
                    <small>{outcome.message}</small>
                  </div>
                ))}
              {errorCount === 0 && warnCount === 0 && (
                <p className="empty">Todas as linhas foram importadas sem ressalvas.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
