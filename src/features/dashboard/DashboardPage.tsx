import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Radio,
  Users,
} from "lucide-react";
import {
  getStoreEmployees,
  loadCanonicalWeek,
  loadValidationSummary,
} from "../../lib/marketSyncApi";
import { mondayOf, todayIso, weekRangeLabel } from "../../lib/dates";
import { useStore } from "../../shared/StoreContext";

type SectorCoverage = { sector: string; filled: number; total: number };
type PendingAction = {
  text: string;
  detail: string;
  to: string;
  tone: "bad" | "warn" | "neutral";
};
type TodayStatus = {
  employeeId: string;
  name: string;
  sector: string;
  status: "working" | "break" | "upcoming" | "done";
  detail: string;
};

function firstOfSector(value: unknown): string {
  const sectors = (value as { sectors?: { name?: string } | { name?: string }[] } | null)?.sectors;
  const name = Array.isArray(sectors) ? sectors[0]?.name : sectors?.name;
  return name ?? "Sem setor";
}

function statusNow(
  segments: Array<{ sequence: number; starts_at: string; ends_at: string }>,
  now: number,
): { status: TodayStatus["status"]; detail: string } {
  const ordered = [...segments].sort((a, b) => a.sequence - b.sequence);
  if (ordered.length === 0) return { status: "upcoming", detail: "Sem horário definido" };
  for (const segment of ordered) {
    const start = new Date(segment.starts_at).getTime();
    const end = new Date(segment.ends_at).getTime();
    if (now >= start && now < end) return { status: "working", detail: `Até ${segment.ends_at.slice(11, 16)}` };
  }
  const first = ordered[0], last = ordered[ordered.length - 1];
  const firstStart = new Date(first.starts_at).getTime();
  const lastEnd = new Date(last.ends_at).getTime();
  if (now < firstStart) return { status: "upcoming", detail: `Turno às ${first.starts_at.slice(11, 16)}` };
  if (now >= lastEnd) return { status: "done", detail: `Encerrou às ${last.ends_at.slice(11, 16)}` };
  return { status: "break", detail: "Em intervalo" };
}

export function DashboardPage() {
  const store = useStore();
  const weekStart = useMemo(() => mondayOf(todayIso()), []);
  const [loading, setLoading] = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [filledSlots, setFilledSlots] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);
  const [coverage, setCoverage] = useState<SectorCoverage[]>([]);
  const [critical, setCritical] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [validated, setValidated] = useState(false);
  const [todayRows, setTodayRows] = useState<
    Array<{
      employeeId: string;
      name: string;
      sector: string;
      dayType: string;
      segments: Array<{ sequence: number; starts_at: string; ends_at: string }>;
    }>
  >([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!store) return;
    setLoading(true);
    Promise.all([
      getStoreEmployees(store.id),
      loadCanonicalWeek(store.id, weekStart),
      loadValidationSummary(store.id, weekStart),
    ])
      .then(([roster, week, summary]) => {
        setEmployeeCount(roster.length);
        const totalsBySector = new Map<string, number>();
        const filledBySector = new Map<string, number>();
        for (const row of roster) {
          const sectorValue = row.sectors as unknown as
            | { name?: string }
            | { name?: string }[]
            | null;
          const sectorName =
            (Array.isArray(sectorValue) ? sectorValue[0]?.name : sectorValue?.name) ??
            "Sem setor";
          totalsBySector.set(sectorName, (totalsBySector.get(sectorName) ?? 0) + 7);
        }
        setHasSchedule(Boolean(week));
        let filled = 0;
        const today = todayIso();
        const todayList: typeof todayRows = [];
        if (week) {
          for (const entry of week.entries) {
            const segments = entry.shift_segments ?? [];
            if (entry.day_type === "work" && segments.length >= 2) {
              filled += 1;
              const sectorName = firstOfSector(entry.employees);
              filledBySector.set(sectorName, (filledBySector.get(sectorName) ?? 0) + 1);
            }
            if (entry.work_date === today) {
              const employeeValue = entry.employees as unknown as
                | { full_name?: string }
                | { full_name?: string }[]
                | null;
              const employee = Array.isArray(employeeValue) ? employeeValue[0] : employeeValue;
              todayList.push({
                employeeId: entry.employee_id,
                name: employee?.full_name ?? "Colaborador",
                sector: firstOfSector(entry.employees),
                dayType: entry.day_type,
                segments,
              });
            }
          }
        }
        setTodayRows(todayList);
        setFilledSlots(filled);
        setTotalSlots(roster.length * 7);
        setCoverage(
          [...totalsBySector.entries()].map(([sector, total]) => ({
            sector,
            total,
            filled: filledBySector.get(sector) ?? 0,
          })),
        );
        setCritical(summary?.critical ?? 0);
        setWarnings(summary?.warnings ?? 0);
        setValidated(Boolean(summary?.run));
      })
      .finally(() => setLoading(false));
  }, [store, weekStart]);

  const todayStatuses = useMemo<TodayStatus[]>(() => {
    const working: TodayStatus[] = [];
    for (const row of todayRows) {
      if (row.dayType !== "work") continue;
      const { status, detail } = statusNow(row.segments, now);
      working.push({ employeeId: row.employeeId, name: row.name, sector: row.sector, status, detail });
    }
    const order: Record<TodayStatus["status"], number> = { working: 0, break: 1, upcoming: 2, done: 3 };
    return working.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  }, [todayRows, now]);

  if (!store) return null;

  const fillPercent = totalSlots ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const pendingActions: PendingAction[] = [];
  if (!hasSchedule) {
    pendingActions.push({
      text: "Nenhuma escala criada",
      detail: "para a semana atual",
      to: "/app/schedules",
      tone: "neutral",
    });
  } else if (!validated) {
    pendingActions.push({
      text: "Validação pendente",
      detail: "para a revisão atual",
      to: "/app/schedules",
      tone: "warn",
    });
  }
  if (critical > 0)
    pendingActions.push({
      text: "Conflitos críticos abertos",
      detail: `${critical} ocorrência${critical === 1 ? "" : "s"}`,
      to: "/app/conflicts?filter=critical",
      tone: "bad",
    });
  if (warnings > 0)
    pendingActions.push({
      text: "Alertas para revisar",
      detail: `${warnings} ocorrência${warnings === 1 ? "" : "s"}`,
      to: "/app/conflicts?filter=warning",
      tone: "warn",
    });
  if (!pendingActions.length)
    pendingActions.push({
      text: "Nenhuma pendência",
      detail: "escala validada sem bloqueios",
      to: "/app/schedules",
      tone: "neutral",
    });

  return (
    <>
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">PAINEL OPERACIONAL</p>
          <h1>Visão geral</h1>
          <p className="subtitle">Semana de {weekRangeLabel(weekStart)}</p>
        </div>
      </section>
      <section className="stat-grid">
        <div className="stat-card">
          <Users size={18} />
          <strong>{loading ? "—" : employeeCount}</strong>
          <span>colaboradores ativos</span>
        </div>
        <div className="stat-card critical">
          <CircleAlert size={18} />
          <strong>{loading ? "—" : critical}</strong>
          <span>conflitos críticos</span>
        </div>
        <div className="stat-card warn">
          <AlertTriangle size={18} />
          <strong>{loading ? "—" : warnings}</strong>
          <span>alertas para revisar</span>
        </div>
        <div className="stat-card">
          <ClipboardList size={18} />
          <strong>{loading ? "—" : `${fillPercent}%`}</strong>
          <span>escala preenchida</span>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="coverage-card">
          <h2>Cobertura por setor</h2>
          {coverage.length === 0 && !loading && (
            <p className="empty">Nenhum colaborador cadastrado ainda.</p>
          )}
          {coverage.map(({ sector, filled, total }) => {
            const percent = total ? Math.round((filled / total) * 100) : 0;
            return (
              <div className="coverage-row" key={sector}>
                <span>{sector}</span>
                <div className="coverage-bar">
                  <div className="coverage-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <small>{percent}%</small>
              </div>
            );
          })}
        </div>
        <div className="pending-card">
          <h2>Ações pendentes</h2>
          <ul className="pending-list">
            {pendingActions.map((action) => (
              <li key={action.text} className={`pending-item ${action.tone}`}>
                <Link to={action.to}>
                  <strong>{action.text}</strong>
                  <small>{action.detail}</small>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="pending-cta" to="/app/schedules">
            <CalendarClock size={14} />
            Abrir escala da semana
          </Link>
        </div>
      </section>
      <section className="working-now-card">
        <h2>
          <Radio size={15} /> Quem está trabalhando agora
        </h2>
        {todayStatuses.length === 0 ? (
          <p className="empty">Ninguém escalado para trabalhar hoje.</p>
        ) : (
          <div className="working-now-list">
            {todayStatuses.map((person) => (
              <div className={`working-now-row ${person.status}`} key={person.employeeId}>
                <span className="working-now-dot" />
                <div>
                  <strong>{person.name}</strong>
                  <small>{person.sector}</small>
                </div>
                <span className="working-now-detail">{person.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
