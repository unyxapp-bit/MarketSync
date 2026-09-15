import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, FileDown, Search, ShieldCheck } from "lucide-react";
import {
  loadViolationsForWeek,
  resolveViolation,
  type ViolationRow,
} from "../../lib/marketSyncApi";
import { mondayOf, todayIso, weekRangeLabel } from "../../lib/dates";
import { downloadCsv, toCsv } from "../../lib/csv";
import { useStore } from "../../shared/StoreContext";
import { PageHero } from "../../shared/ui/PageHero";

const calloutClass =
  "flex items-center justify-between gap-[22px] mb-7 p-[18px_20px] border border-[#cfe7dd] rounded-[10px] bg-[linear-gradient(105deg,#f2fbf6,#fff)] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-3";
const calloutEyebrowClass = "text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-[6px]";
const calloutHeadingClass = "m-0 text-[#294137] text-[17px]";
const calloutTextClass = "max-w-[690px] mt-[6px] text-[#61756c] text-[12px] leading-[1.5]";
const ctaClass = "inline-flex items-center gap-[6px] mt-[14px] text-[#087b61] text-[12px] font-bold no-underline";
const outlineBtn =
  "bg-surface border border-line text-ink-soft hover:border-[#c7cfda] hover:bg-[#fafbfc] disabled:opacity-50";

const statusToneClass: Record<string, string> = {
  good: "bg-brand-soft text-brand-dark",
  bad: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-line-soft text-muted",
};
const statusBase = "justify-self-center rounded-[6px] py-[5px] px-2 text-[10px] font-bold tracking-[-0.01em] whitespace-nowrap";

type Filter = "all" | "critical" | "warning" | "resolved";

const severityLabel: Record<ViolationRow["severity"], string> = {
  critical: "Crítico",
  warning: "Alerta",
  info: "Info",
};
const severityTone: Record<ViolationRow["severity"], string> = {
  critical: "bad",
  warning: "warn",
  info: "neutral",
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const validFilters: Filter[] = ["all", "critical", "warning", "resolved"];

export function ConflictsPage() {
  const store = useStore();
  const weekStart = useMemo(() => mondayOf(todayIso()), []);
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const initialFilter = searchParams.get("filter");
  const [filter, setFilter] = useState<Filter>(
    validFilters.includes(initialFilter as Filter) ? (initialFilter as Filter) : "all",
  );
  const [search, setSearch] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!store) return;
    setLoading(true);
    loadViolationsForWeek(store.id, weekStart)
      .then(({ schedule, run, violations }) => {
        setHasSchedule(Boolean(schedule));
        setHasRun(Boolean(run));
        setViolations(violations);
      })
      .catch(() => setError("Não foi possível carregar os conflitos desta semana."))
      .finally(() => setLoading(false));
  }, [store, weekStart, refreshKey]);

  if (!store) return null;

  const counts = {
    all: violations.length,
    critical: violations.filter((v) => v.severity === "critical" && !v.resolved_at).length,
    warning: violations.filter((v) => v.severity !== "critical" && !v.resolved_at).length,
    resolved: violations.filter((v) => v.resolved_at).length,
  };

  const filtered = violations.filter((violation) => {
    if (filter === "critical" && !(violation.severity === "critical" && !violation.resolved_at)) return false;
    if (filter === "warning" && !(violation.severity !== "critical" && !violation.resolved_at)) return false;
    if (filter === "resolved" && !violation.resolved_at) return false;
    if (search) {
      const name = firstOf(violation.employees)?.full_name?.toLowerCase() ?? "";
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const rows = filtered.map((violation) => {
      const employee = firstOf(violation.employees);
      const entry = firstOf(violation.schedule_entries);
      return [
        employee?.full_name ?? "",
        entry?.work_date ?? "",
        violation.rule_code,
        severityLabel[violation.severity],
        violation.blocking ? "sim" : "não",
        violation.message,
        violation.resolved_at ? "resolvido" : "em aberto",
        violation.resolution_note ?? "",
      ];
    });
    const csv = toCsv(
      ["colaborador", "data", "regra", "gravidade", "bloqueia", "detalhe", "estado", "justificativa"],
      rows,
    );
    downloadCsv(`conflitos_${weekStart}.csv`, csv);
  };

  const startAccept = (violationId: string) => {
    setAcceptingId(violationId);
    setNote("");
    setError("");
  };

  const confirmAccept = async (violationId: string) => {
    if (!note.trim()) {
      setError("Descreva o motivo para aceitar este alerta.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await resolveViolation(violationId, note.trim());
      setAcceptingId(null);
      setNote("");
      setRefreshKey((value) => value + 1);
    } catch {
      setError("Não foi possível aceitar este alerta. Você precisa ser gerente da loja.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="GESTÃO E AUDITOR"
        title="Central de conflitos"
        subtitle={<>Pendências da escala de {weekRangeLabel(weekStart)}</>}
      />
      {!hasSchedule && !loading && (
        <section className={calloutClass}>
          <div>
            <p className={calloutEyebrowClass}>SEM ESCALA</p>
            <h2 className={calloutHeadingClass}>Nenhuma escala criada para esta semana</h2>
            <p className={calloutTextClass}>Crie ou importe a escala da semana atual para ver conflitos aqui.</p>
          </div>
          <Link className={ctaClass} to="/app/schedules">
            Abrir escalas
          </Link>
        </section>
      )}
      {hasSchedule && !hasRun && !loading && (
        <section className={calloutClass}>
          <div>
            <p className={calloutEyebrowClass}>VALIDAÇÃO PENDENTE</p>
            <h2 className={calloutHeadingClass}>Esta revisão ainda não foi validada</h2>
            <p className={calloutTextClass}>Rode a validação na tela de Escalas para ver os conflitos aqui.</p>
          </div>
          <Link className={ctaClass} to="/app/schedules">
            Validar escala
          </Link>
        </section>
      )}
      {hasRun && (
        <>
          <section className="flex items-center justify-between gap-4 mt-6 mb-4 flex-wrap">
            <div className="flex gap-[6px]">
              {(
                [
                  ["all", `Todos ${counts.all}`],
                  ["critical", `Críticos ${counts.critical}`],
                  ["warning", `Alertas ${counts.warning}`],
                  ["resolved", `Resolvidos ${counts.resolved}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={`rounded-full py-[7px] px-[13px] text-[11px] font-bold border ${
                    filter === value
                      ? "border-[#102a43] bg-brand-soft text-brand-dark"
                      : "border-[#dce3e8] bg-white text-[#536174]"
                  }`}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-[10px]">
              <label className="w-[210px] h-[37px] border border-[#dce2e8] bg-white rounded-[7px] flex items-center gap-[7px] text-[#8290a1] px-[10px]">
                <Search size={16} />
                <input
                  className="border-0 outline-none w-full text-[12px] text-[#334155]"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar colaborador"
                />
              </label>
              <button
                className={`h-[37px] px-3 rounded-[7px] text-[12px] font-bold inline-flex items-center gap-[6px] whitespace-nowrap ${outlineBtn}`}
                type="button"
                onClick={exportCsv}
              >
                <FileDown size={16} />
                Exportar CSV
              </button>
            </div>
          </section>
          <section className="bg-surface border border-line rounded-md shadow-xs overflow-hidden">
            {filtered.length === 0 && (
              <p className="p-5 text-[11px] text-[#68778a] m-0">
                {violations.length === 0
                  ? "Sem conflitos nesta revisão."
                  : "Nenhum item corresponde ao filtro selecionado."}
              </p>
            )}
            {filtered.map((violation) => {
              const employee = firstOf(violation.employees);
              const entry = firstOf(violation.schedule_entries);
              const isAccepting = acceptingId === violation.id;
              return (
                <article
                  key={violation.id}
                  className={`grid grid-cols-[90px_1fr_110px_120px] gap-[14px] items-start px-[18px] py-4 border-t border-[#edf0f2] first:border-t-0 ${
                    violation.resolved_at ? "opacity-[.65]" : ""
                  }`}
                >
                  <span className={`${statusBase} ${statusToneClass[severityTone[violation.severity]]}`}>
                    {severityLabel[violation.severity]}
                  </span>
                  <div>
                    <strong className="block text-[12px] text-[#2b394e]">
                      {employee?.full_name ?? "Colaborador não identificado"}
                    </strong>
                    <span className="inline-block mt-[3px] mb-1 text-[10px] font-bold font-mono text-[#7b8798]">
                      {violation.rule_code}
                    </span>
                    <p className="m-0 text-[12px] text-[#4d596b] leading-[1.4]">{violation.message}</p>
                    {violation.resolved_at && (
                      <small className="block mt-[6px] text-[11px] text-[#11765a]">
                        Aceito: {violation.resolution_note}
                      </small>
                    )}
                    {isAccepting && (
                      <div className="flex gap-2 mt-[10px]">
                        <input
                          className="flex-1 h-[34px] border border-[#dce3e8] rounded-[6px] px-[10px] text-[12px]"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Motivo para aceitar este alerta"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="h-[34px] px-[11px] rounded-[6px] text-[11px] inline-flex items-center gap-[5px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50"
                          disabled={submitting}
                          onClick={() => confirmAccept(violation.id)}
                        >
                          <Check size={14} />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="h-[34px] px-[11px] rounded-[6px] text-[11px] inline-flex items-center gap-[5px] bg-surface border border-line text-ink-soft hover:bg-[#fafbfc]"
                          onClick={() => setAcceptingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] text-[#536174] pt-[2px]">{entry?.work_date ?? "—"}</span>
                  <div className="flex justify-end">
                    {violation.resolved_at ? (
                      <span className={`${statusBase} ${statusToneClass.good} inline-flex items-center gap-1`}>
                        <ShieldCheck size={13} /> Resolvido
                      </span>
                    ) : violation.blocking ? (
                      <Link
                        className={`h-8 px-3 text-[11px] inline-flex items-center no-underline rounded-[7px] ${outlineBtn}`}
                        to={`/app/schedules?employee=${violation.employee_id ?? ""}&day=${entry?.work_date ?? ""}`}
                      >
                        Corrigir
                      </Link>
                    ) : isAccepting ? null : (
                      <button
                        type="button"
                        className={`h-8 px-3 text-[11px] inline-flex items-center rounded-[7px] ${outlineBtn}`}
                        onClick={() => startAccept(violation.id)}
                      >
                        Aceitar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
          {error && (
            <p className="text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] bg-[#fff1ef] text-[#b23d34]">{error}</p>
          )}
        </>
      )}
    </>
  );
}
