import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Search, ShieldCheck } from "lucide-react";
import {
  loadViolationsForWeek,
  resolveViolation,
  type ViolationRow,
} from "../../lib/marketSyncApi";
import { mondayOf, todayIso, weekRangeLabel } from "../../lib/dates";
import { useStore } from "../../shared/StoreContext";

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
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">GESTÃO E AUDITOR</p>
          <h1>Central de conflitos</h1>
          <p className="subtitle">
            Pendências da escala de {weekRangeLabel(weekStart)}
          </p>
        </div>
      </section>
      {!hasSchedule && !loading && (
        <section className="import-callout">
          <div>
            <p className="eyebrow">SEM ESCALA</p>
            <h2>Nenhuma escala criada para esta semana</h2>
            <p>Crie ou importe a escala da semana atual para ver conflitos aqui.</p>
          </div>
          <Link className="pending-cta" to="/app/schedules">
            Abrir escalas
          </Link>
        </section>
      )}
      {hasSchedule && !hasRun && !loading && (
        <section className="import-callout">
          <div>
            <p className="eyebrow">VALIDAÇÃO PENDENTE</p>
            <h2>Esta revisão ainda não foi validada</h2>
            <p>Rode a validação na tela de Escalas para ver os conflitos aqui.</p>
          </div>
          <Link className="pending-cta" to="/app/schedules">
            Validar escala
          </Link>
        </section>
      )}
      {hasRun && (
        <>
          <section className="conflict-toolbar">
            <div className="conflict-filters">
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
                  className={`filter-pill ${filter === value ? "active" : ""}`}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar colaborador"
              />
            </label>
          </section>
          <section className="conflict-card">
            {filtered.length === 0 && (
              <p className="empty conflict-empty">
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
                  className={`conflict-row ${violation.resolved_at ? "resolved" : ""}`}
                >
                  <span className={`status ${severityTone[violation.severity]}`}>
                    {severityLabel[violation.severity]}
                  </span>
                  <div className="conflict-main">
                    <strong>{employee?.full_name ?? "Colaborador não identificado"}</strong>
                    <span className="conflict-rule">{violation.rule_code}</span>
                    <p>{violation.message}</p>
                    {violation.resolved_at && (
                      <small className="conflict-resolution">
                        Aceito: {violation.resolution_note}
                      </small>
                    )}
                    {isAccepting && (
                      <div className="conflict-accept-form">
                        <input
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Motivo para aceitar este alerta"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="solid"
                          disabled={submitting}
                          onClick={() => confirmAccept(violation.id)}
                        >
                          <Check size={14} />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => setAcceptingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="conflict-period">{entry?.work_date ?? "—"}</span>
                  <div className="conflict-action">
                    {violation.resolved_at ? (
                      <span className="status good">
                        <ShieldCheck size={13} /> Resolvido
                      </span>
                    ) : violation.blocking ? (
                      <Link
                        className="outline conflict-fix"
                        to={`/app/schedules?employee=${violation.employee_id ?? ""}&day=${entry?.work_date ?? ""}`}
                      >
                        Corrigir
                      </Link>
                    ) : isAccepting ? null : (
                      <button
                        type="button"
                        className="outline conflict-fix"
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
          {error && <p className="editor-message error conflict-error">{error}</p>}
        </>
      )}
    </>
  );
}
