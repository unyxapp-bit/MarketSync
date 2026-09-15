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
import { PageHero } from "../../shared/ui/PageHero";

const statCardTone: Record<"default" | "critical" | "warn", string> = {
  default: "text-brand",
  critical: "border-t-2 border-t-danger text-[#b23d34]",
  warn: "border-t-2 border-t-warn text-[#b17c2f]",
};
const statStrongTone: Record<"default" | "critical" | "warn", string> = {
  default: "text-ink",
  critical: "text-danger",
  warn: "text-warn",
};
const cardClass = "bg-surface border border-line rounded-md shadow-xs p-[18px]";
const cardHeadingClass = "text-[14px] mb-[14px] m-0 text-[#2b394e]";
const pendingToneClass: Record<PendingAction["tone"], { bg: string; strong: string }> = {
  bad: { bg: "bg-[#fff1ef]", strong: "text-[#b23d34]" },
  warn: { bg: "bg-[#fff8ea]", strong: "text-[#97671a]" },
  neutral: { bg: "bg-[#f7f8fa]", strong: "text-[#2b394e]" },
};

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
      <PageHero eyebrow="PAINEL OPERACIONAL" title="Visão geral" subtitle={`Semana de ${weekRangeLabel(weekStart)}`} />
      <section className="grid grid-cols-4 max-[900px]:grid-cols-2 gap-[14px] my-7">
        <div className={`p-4 grid gap-[6px] ${cardClass} ${statCardTone.default}`}>
          <Users size={18} />
          <strong className={`text-[26px] tracking-[-0.6px] ${statStrongTone.default}`}>
            {loading ? "—" : employeeCount}
          </strong>
          <span className="text-[11px] text-muted">colaboradores ativos</span>
        </div>
        <div className={`p-4 grid gap-[6px] ${cardClass} ${statCardTone.critical}`}>
          <CircleAlert size={18} />
          <strong className={`text-[26px] tracking-[-0.6px] ${statStrongTone.critical}`}>
            {loading ? "—" : critical}
          </strong>
          <span className="text-[11px] text-muted">conflitos críticos</span>
        </div>
        <div className={`p-4 grid gap-[6px] ${cardClass} ${statCardTone.warn}`}>
          <AlertTriangle size={18} />
          <strong className={`text-[26px] tracking-[-0.6px] ${statStrongTone.warn}`}>
            {loading ? "—" : warnings}
          </strong>
          <span className="text-[11px] text-muted">alertas para revisar</span>
        </div>
        <div className={`p-4 grid gap-[6px] ${cardClass} ${statCardTone.default}`}>
          <ClipboardList size={18} />
          <strong className={`text-[26px] tracking-[-0.6px] ${statStrongTone.default}`}>
            {loading ? "—" : `${fillPercent}%`}
          </strong>
          <span className="text-[11px] text-muted">escala preenchida</span>
        </div>
      </section>
      <section className="grid grid-cols-[1.4fr_1fr] max-[900px]:grid-cols-1 gap-4 items-start">
        <div className={cardClass}>
          <h2 className={cardHeadingClass}>Cobertura por setor</h2>
          {coverage.length === 0 && !loading && (
            <p className="text-[11px] text-[#68778a] m-0">Nenhum colaborador cadastrado ainda.</p>
          )}
          {coverage.map(({ sector, filled, total }) => {
            const percent = total ? Math.round((filled / total) * 100) : 0;
            return (
              <div className="grid grid-cols-[110px_1fr_36px] items-center gap-[10px] py-[7px] text-[12px] text-[#536174]" key={sector}>
                <span>{sector}</span>
                <div className="h-[7px] rounded-full bg-[#eef1f3] overflow-hidden">
                  <div className="h-full bg-[#30a47c] rounded-full" style={{ width: `${percent}%` }} />
                </div>
                <small className="text-right text-[#7d8999]">{percent}%</small>
              </div>
            );
          })}
        </div>
        <div className={cardClass}>
          <h2 className={cardHeadingClass}>Ações pendentes</h2>
          <ul className="list-none m-0 p-0 grid gap-[6px]">
            {pendingActions.map((action) => {
              const tone = pendingToneClass[action.tone];
              return (
                <li key={action.text}>
                  <Link
                    className={`flex justify-between items-center gap-[10px] px-[10px] py-[9px] rounded-[8px] no-underline ${tone.bg}`}
                    to={action.to}
                  >
                    <strong className={`text-[12px] ${tone.strong}`}>{action.text}</strong>
                    <small className="text-[10px] text-[#7d8999]">{action.detail}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            className="inline-flex items-center gap-[6px] mt-[14px] text-[#087b61] text-[12px] font-bold no-underline"
            to="/app/schedules"
          >
            <CalendarClock size={14} />
            Abrir escala da semana
          </Link>
        </div>
      </section>
      <section className={`${cardClass} mt-4`}>
        <h2 className={`flex items-center gap-[7px] ${cardHeadingClass}`}>
          <Radio size={15} /> Quem está trabalhando agora
        </h2>
        {todayStatuses.length === 0 ? (
          <p className="text-[11px] text-[#68778a] m-0">Ninguém escalado para trabalhar hoje.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
            {todayStatuses.map((person) => (
              <div
                className={`flex items-center gap-[9px] px-[10px] py-[9px] rounded-[8px] ${
                  person.status === "working"
                    ? "bg-[#eaf6f0]"
                    : person.status === "done"
                      ? "bg-[#f7f8fa] opacity-[.55]"
                      : "bg-[#f7f8fa]"
                }`}
                key={person.employeeId}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    person.status === "working"
                      ? "bg-[#167a62]"
                      : person.status === "break"
                        ? "bg-[#d9822b]"
                        : person.status === "upcoming"
                          ? "bg-[#7b8798]"
                          : "bg-[#b6bfca]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <strong className="block text-[12px] text-[#2b394e]">{person.name}</strong>
                  <small className="block text-[10px] text-[#7d8999] mt-px">{person.sector}</small>
                </div>
                <span className="text-[10px] text-[#7d8999] whitespace-nowrap">{person.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
