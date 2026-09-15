import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileDown,
  Pencil,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { employees as initialEmployees, type Employee, type Shift } from "../../data/realSchedule";
import {
  dailyMinutes,
  formatMinutes,
  periodDuration,
  priorWorkStreak,
  restMinutes,
} from "../../lib/compliance";
import { addDays, mondayOf, todayIso, weekDates, weekRangeLabel, weekdayShort } from "../../lib/dates";
import { downloadCsv, toCsv } from "../../lib/csv";
import {
  getStoreEmployees,
  importReceivedWeek,
  loadCanonicalWeek,
  loadComplianceContext,
  loadHolidays,
  loadRuleParametersForWeek,
  saveCanonicalEntry,
  validateSchedule,
  type ComplianceEntryRow,
  type HolidayRow,
} from "../../lib/marketSyncApi";
import { useStore } from "../../shared/StoreContext";

// The only week importReceivedWeek knows how to seed (it transcribes one specific physical
// schedule). Every other week is navigated to and edited purely through Supabase.
const PILOT_IMPORT_WEEK_START = "2026-09-14";

function buildHistoryMap(rows: ComplianceEntryRow[]) {
  const map = new Map<string, Map<string, Shift | null>>();
  for (const row of rows) {
    const byDate = map.get(row.employee_id) ?? new Map<string, Shift | null>();
    if (row.day_type === "work" && (row.shift_segments?.length ?? 0) >= 2) {
      const segments = [...row.shift_segments].sort((a, b) => a.sequence - b.sequence);
      byDate.set(row.work_date, {
        start: segments[0].starts_at.slice(11, 16),
        breakStart: segments[0].ends_at.slice(11, 16),
        breakEnd: segments[1].starts_at.slice(11, 16),
        end: segments[1].ends_at.slice(11, 16),
      });
    } else {
      byDate.set(row.work_date, null);
    }
    map.set(row.employee_id, byDate);
  }
  return map;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
const workPeriod = (start: string, end: string) => `${start} — ${end}`;
type Review = {
  employee: Employee;
  shift: Shift | null;
  rest?: number;
  streak: number;
  unknownHistory: boolean;
  hasPreSundayRest: boolean;
  hasPostSundayRest: boolean;
  blocked: boolean;
};
type EditDraft = {
  employee: Employee;
  employeeId: string;
  day: number;
  isOff: boolean;
  start: string;
  breakStart: string;
  breakEnd: string;
  end: string;
  holidayAuthorized: boolean;
};
type ValidationIssue = {
  employee_id?: string;
  entry_id?: string | null;
  rule_code: string;
  blocking: boolean;
  message: string;
  evidence?: Record<string, unknown>;
};

export function ScheduleWorkspace() {
  const store = useStore();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const [importState, setImportState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [validationState, setValidationState] = useState<
    "idle" | "running" | "passed" | "failed" | "error"
  >("idle");
  const [validationMessage, setValidationMessage] = useState("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [scheduleEmployees, setScheduleEmployees] =
    useState<Employee[]>(initialEmployees);
  const [employeeIds, setEmployeeIds] = useState<Record<string, string>>({});
  const [employeeRoster, setEmployeeRoster] = useState<
    Array<{ id: string; name: string; sector: Employee["sector"] }>
  >([]);
  const [historyByEmployee, setHistoryByEmployee] = useState<
    Map<string, Map<string, Shift | null>>
  >(new Map());
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editState, setEditState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [editMessage, setEditMessage] = useState("");
  const [weekId, setWeekId] = useState<string | null>(null);
  const [weekRevision, setWeekRevision] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ruleParameters, setRuleParameters] = useState<Record<string, Record<string, number>>>({});
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [holidayAuthorizedByEmployeeDay, setHolidayAuthorizedByEmployeeDay] = useState<
    Map<string, Set<string>>
  >(new Map());
  const holidayByIso = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday.name])),
    [holidays],
  );
  const isHoliday = (iso: string) => holidayByIso.has(iso);
  const goToWeek = (nextWeekStart: string) => {
    setWeekStart(nextWeekStart);
    setSelectedDay(0);
    setEditDraft(null);
    setValidationState("idle");
    setValidationIssues([]);
    setValidationMessage("");
  };
  useEffect(() => {
    if (!store) return;
    getStoreEmployees(store.id)
      .then((rows) => {
        setEmployeeRoster(
          rows.map((row) => {
            const sectorValue = row.sectors as unknown as
              | { name?: string }
              | { name?: string }[]
              | null;
            const sectorName = Array.isArray(sectorValue)
              ? sectorValue[0]?.name
              : sectorValue?.name;
            return {
              id: row.id,
              name: row.full_name,
              sector: (sectorName === "Fiscal"
                ? "Fiscal"
                : "Caixa") as Employee["sector"],
            };
          }),
        );
      })
      .catch(() => setImportState("error"));
  }, [store]);
  useEffect(() => {
    if (!store) return;
    loadHolidays(store.organizationId)
      .then(setHolidays)
      .catch(() => setHolidays([]));
  }, [store]);
  useEffect(() => {
    if (!store || employeeRoster.length === 0) return;
    setImportState((current) => (current === "idle" ? "loading" : current));
    Promise.all([
      loadCanonicalWeek(store.id, weekStart),
      loadComplianceContext(store.id, weekStart),
      loadRuleParametersForWeek(store.id, weekStart),
    ])
      .then(([record, historyRows, parameters]) => {
        setHistoryByEmployee(buildHistoryMap(historyRows));
        setRuleParameters(parameters);
        const isoToDay = new Map(dates.map((day, index) => [day.iso, index]));
        const byEmployee = new Map<string, Employee>();
        const ids: Record<string, string> = {};
        for (const person of employeeRoster) {
          ids[person.name] = person.id;
          byEmployee.set(person.id, {
            name: person.name,
            sector: person.sector,
            schedule: Array(7).fill(null),
          });
        }
        const authorizedByEmployee = new Map<string, Set<string>>();
        record?.entries.forEach((entry) => {
          const dayIndex = isoToDay.get(entry.work_date);
          const existing = byEmployee.get(entry.employee_id);
          if (dayIndex === undefined || !existing) return;
          const segments = [...(entry.shift_segments ?? [])].sort(
            (left, right) => left.sequence - right.sequence,
          );
          if (entry.day_type === "work" && segments.length >= 2)
            existing.schedule[dayIndex] = {
              start: segments[0].starts_at.slice(11, 16),
              breakStart: segments[0].ends_at.slice(11, 16),
              breakEnd: segments[1].starts_at.slice(11, 16),
              end: segments[1].ends_at.slice(11, 16),
            };
          if (entry.holiday_authorized) {
            const set = authorizedByEmployee.get(entry.employee_id) ?? new Set<string>();
            set.add(entry.work_date);
            authorizedByEmployee.set(entry.employee_id, set);
          }
        });
        setScheduleEmployees([...byEmployee.values()]);
        setEmployeeIds(ids);
        setHolidayAuthorizedByEmployeeDay(authorizedByEmployee);
        setWeekId(record?.schedule.id ?? null);
        setWeekRevision(record?.schedule.revision ?? null);
        setImportState(record ? "done" : "idle");
      })
      .catch(() => setImportState("error"));
  }, [store, weekStart, refreshKey, employeeRoster, dates]);
  // Lands on the exact cell when arriving from a link in the Central de conflitos
  // (?employee=<id>&day=<iso>). Waits for the roster to load before resolving the employee id.
  useEffect(() => {
    if (deepLinkApplied) return;
    const day = searchParams.get("day");
    const employeeId = searchParams.get("employee");
    if (!day && !employeeId) {
      setDeepLinkApplied(true);
      return;
    }
    if (employeeId && Object.keys(employeeIds).length === 0) return;
    const dayIndex = day ? dates.findIndex((d) => d.iso === day) : -1;
    if (dayIndex >= 0) setSelectedDay(dayIndex);
    if (employeeId) {
      const name = Object.entries(employeeIds).find(([, id]) => id === employeeId)?.[0];
      if (name) setSearch(name);
    }
    setDeepLinkApplied(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, dates, employeeIds, deepLinkApplied, setSearchParams]);
  const visible = useMemo(
    () =>
      scheduleEmployees.filter((employee) =>
        employee.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, scheduleEmployees],
  );
  const timelineByEmployee = useMemo(() => {
    const map = new Map<string, Map<string, Shift | null>>();
    for (const employee of scheduleEmployees) {
      const employeeId = employeeIds[employee.name];
      if (!employeeId) continue;
      const combined = new Map(historyByEmployee.get(employeeId) ?? []);
      dates.forEach((day, index) => combined.set(day.iso, employee.schedule[index]));
      map.set(employee.name, combined);
    }
    return map;
  }, [scheduleEmployees, employeeIds, historyByEmployee, dates]);
  // Fall back to the same defaults the validate-schedule Edge Function uses when a rule isn't
  // configured, so the advisory coloring here never contradicts the authoritative validation.
  const interjourneyMinMinutes = Number(
    ruleParameters.INTERJOURNEY_MIN?.minimum_minutes ?? 660,
  );
  const maxConsecutiveDays = Number(
    ruleParameters.WEEKLY_REST_WINDOW?.maximum_consecutive_days ?? 7,
  );
  const reviews = useMemo<Review[]>(
    () =>
      visible.map((employee) => {
        const shift = employee.schedule[selectedDay];
        const timeline = timelineByEmployee.get(employee.name);
        const currentIso = dates[selectedDay].iso;
        const previous = timeline?.get(addDays(currentIso, -1));
        const rest =
          shift && previous ? restMinutes(previous, shift) : undefined;
        const streak = priorWorkStreak(timeline, currentIso);
        const hasPreSundayRest = employee.schedule
          .slice(0, 6)
          .some((dayShift) => !dayShift);
        const sundayIso = dates[6].iso;
        const hasPostSundayRest = Array.from({ length: 6 }, (_, i) =>
          addDays(sundayIso, i + 1),
        ).some((iso) => timeline?.has(iso) && !timeline.get(iso));
        const sundayRestViolation =
          selectedDay === 6 &&
          Boolean(shift) &&
          (!hasPreSundayRest || !hasPostSundayRest);
        return {
          employee,
          shift,
          rest,
          streak: streak.count,
          unknownHistory: streak.historyStartsBeforeImport,
          hasPreSundayRest,
          hasPostSundayRest,
          blocked: Boolean(
            shift &&
            ((rest !== undefined && rest < interjourneyMinMinutes) ||
              streak.count >= maxConsecutiveDays ||
              sundayRestViolation),
          ),
        };
      }),
    [
      selectedDay,
      visible,
      timelineByEmployee,
      dates,
      interjourneyMinMinutes,
      maxConsecutiveDays,
    ],
  );
  const working = reviews.filter((review) => review.shift);
  const off = reviews.length - working.length;
  const blocked = reviews.filter((review) => review.blocked).length;
  const sunday = selectedDay === 6;
  const nextWeekImported = useMemo(() => {
    const nextMonday = addDays(dates[6].iso, 1);
    return [...timelineByEmployee.values()].some((timeline) => timeline.has(nextMonday));
  }, [timelineByEmployee, dates]);
  const sundayDecision = (review: Review) => {
    if (!review.shift) return { text: "Folga programada", kind: "neutral" };
    if (!review.hasPreSundayRest)
      return { text: "Não apto · pré-folga", kind: "bad" };
    if (!review.hasPostSundayRest)
      return { text: "Pós-folga pendente", kind: "bad" };
    if (review.blocked) return { text: "Não apto", kind: "bad" };
    const timeline = timelineByEmployee.get(review.employee.name);
    const sundayIso = dates[6].iso;
    const workedOnBothRecentSundays = [1, 2].every((weeksAgo) =>
      Boolean(timeline?.get(addDays(sundayIso, -7 * weeksAgo))),
    );
    if (workedOnBothRecentSundays)
      return { text: "Não apto · 3º domingo", kind: "bad" };
    if (review.employee.schedule.slice(0, 6).some((shift) => !shift))
      return { text: "Apto · rodízio OK", kind: "good" };
    return { text: "Rever descanso", kind: "bad" };
  };
  const openEditor = (employee: Employee, shift: Shift | null) => {
    const employeeId = employeeIds[employee.name];
    if (!employeeId) {
      setValidationMessage(
        "Importe a escala inicial antes de editar turnos. Os dados mostrados ainda são apenas a referência visual.",
      );
      return;
    }
    setEditMessage("");
    setEditState("idle");
    const currentIso = dates[selectedDay].iso;
    setEditDraft({
      employee,
      employeeId,
      day: selectedDay,
      isOff: !shift,
      start: shift?.start ?? "07:40",
      breakStart: shift?.breakStart ?? "12:20",
      breakEnd: shift?.breakEnd ?? "14:20",
      end: shift?.end ?? "17:40",
      holidayAuthorized: holidayAuthorizedByEmployeeDay.get(employeeId)?.has(currentIso) ?? false,
    });
  };
  const saveEdit = async () => {
    if (!editDraft || !weekId || weekRevision === null) return;
    if (
      !editDraft.isOff &&
      !(
        editDraft.start < editDraft.breakStart &&
        editDraft.breakStart <= editDraft.breakEnd &&
        editDraft.breakEnd < editDraft.end
      )
    ) {
      setEditState("error");
      setEditMessage(
        "Os horários precisam seguir a ordem: entrada, início do intervalo, fim do intervalo e saída.",
      );
      return;
    }
    setEditState("saving");
    setEditMessage("");
    try {
      const workDate = dates[editDraft.day].iso;
      const iso = (time: string) => `${workDate}T${time}:00-03:00`;
      const segments = editDraft.isOff
        ? []
        : [
            {
              startsAt: iso(editDraft.start),
              endsAt: iso(editDraft.breakStart),
            },
            { startsAt: iso(editDraft.breakEnd), endsAt: iso(editDraft.end) },
          ];
      const revision = await saveCanonicalEntry({
        scheduleId: weekId,
        employeeId: editDraft.employeeId,
        workDate,
        dayType: editDraft.isOff ? "off" : "work",
        segments,
        expectedRevision: weekRevision,
        holidayAuthorized: editDraft.isOff ? false : editDraft.holidayAuthorized,
      });
      setHolidayAuthorizedByEmployeeDay((current) => {
        const next = new Map(current);
        const set = new Set(next.get(editDraft.employeeId));
        if (!editDraft.isOff && editDraft.holidayAuthorized) set.add(workDate);
        else set.delete(workDate);
        next.set(editDraft.employeeId, set);
        return next;
      });
      setScheduleEmployees((current) =>
        current.map((employee) =>
          employee.name === editDraft.employee.name
            ? {
                ...employee,
                schedule: employee.schedule.map((shift, index) =>
                  index === editDraft.day
                    ? editDraft.isOff
                      ? null
                      : {
                          start: editDraft.start,
                          breakStart: editDraft.breakStart,
                          breakEnd: editDraft.breakEnd,
                          end: editDraft.end,
                        }
                    : shift,
                ),
              }
            : employee,
        ),
      );
      setWeekRevision(revision);
      setValidationState("idle");
      setValidationIssues([]);
      setValidationMessage("Turno salvo. Valide novamente antes de publicar.");
      setEditDraft(null);
      setEditState("idle");
    } catch (error) {
      setEditState("error");
      setEditMessage(
        error instanceof Error && error.message.includes("CONFLICT")
          ? "Outra pessoa alterou esta escala. Atualize a página antes de salvar."
          : "Não foi possível salvar este turno. Confira os horários e tente novamente.",
      );
    }
  };
  const exportCsv = () => {
    const rows = scheduleEmployees.flatMap((employee) =>
      dates.map((day, index) => {
        const shift = employee.schedule[index];
        return [
          employee.name,
          employee.sector,
          day.iso,
          shift ? "work" : "off",
          shift?.start ?? "",
          shift?.breakStart ?? "",
          shift?.breakEnd ?? "",
          shift?.end ?? "",
          shift ? formatMinutes(dailyMinutes(shift)) : "0h00",
        ];
      }),
    );
    const csv = toCsv(
      ["colaborador", "setor", "data", "status", "entrada", "intervalo_inicio", "intervalo_fim", "saida", "carga"],
      rows,
    );
    downloadCsv(`escala_${weekStart}.csv`, csv);
  };
  const shiftLabel = (shift: Shift | null) =>
    shift ? `${shift.start}–${shift.breakStart} / ${shift.breakEnd}–${shift.end}` : "Folga";
  const exportPdf = async () => {
    const { buildSchedulePdf } = await import("../../lib/pdf");
    const sectors = (["Caixa", "Fiscal"] as const)
      .map((sector) => ({
        name: sector,
        rows: scheduleEmployees
          .filter((employee) => employee.sector === sector)
          .map((employee) => ({
            name: employee.name,
            cells: dates.map((_, index) => shiftLabel(employee.schedule[index])),
          })),
      }))
      .filter((sector) => sector.rows.length > 0);
    buildSchedulePdf({
      storeName: store?.name ?? "Loja",
      periodLabel: weekRangeLabel(weekStart),
      revision: weekRevision,
      dayLabels: dates.map((day) => `${day.weekday} ${day.date}`),
      sectors,
      fileName: `mural_${weekStart}.pdf`,
    });
  };
  const exportIndividualPdf = async (employee: Employee) => {
    const { buildIndividualSchedulePdf } = await import("../../lib/pdf");
    buildIndividualSchedulePdf({
      storeName: store?.name ?? "Loja",
      employeeName: employee.name,
      periodLabel: weekRangeLabel(weekStart),
      days: dates.map((day, index) => ({ label: day.label, shift: shiftLabel(employee.schedule[index]) })),
      fileName: `escala_${employee.name.replace(/\s+/g, "_")}_${weekStart}.pdf`,
    });
  };
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">PLANEJAMENTO OPERACIONAL</p>
          <h1>Escala da semana</h1>
          <p className="subtitle">
            {weekRangeLabel(weekStart)} ·{" "}
            {weekId
              ? `Dados carregados do Supabase · revisão ${weekRevision}`
              : "Nenhuma escala importada para esta semana"}
          </p>
          {validationMessage && (
            <p className={`validation-message ${validationState}`}>
              {validationMessage}
            </p>
          )}
        </div>
        <div className="hero-actions">
          {store && weekStart === PILOT_IMPORT_WEEK_START && (
            <button
              className="outline"
              disabled={importState === "loading" || importState === "done"}
              onClick={async () => {
                setImportState("loading");
                try {
                  await importReceivedWeek(store.id);
                  setImportState("done");
                  setRefreshKey((value) => value + 1);
                } catch {
                  setImportState("error");
                }
              }}
            >
              <FileDown size={16} />
              {importState === "loading"
                ? "Importando..."
                : weekId
                  ? "Escala sincronizada"
                  : importState === "error"
                    ? "Tentar importar"
                    : "Importar escala inicial"}
            </button>
          )}
          <button
            className="outline"
            disabled={
              !weekId ||
              weekRevision === null ||
              validationState === "running"
            }
            onClick={async () => {
              if (!weekId || weekRevision === null) return;
              setValidationState("running");
              setValidationMessage("");
              setValidationIssues([]);
              try {
                const result = await validateSchedule(weekId, weekRevision);
                setValidationIssues(result.violations as ValidationIssue[]);
                setValidationState(result.blocking ? "failed" : "passed");
                setValidationMessage(
                  result.blocking
                    ? `${result.blocking} conflito(s) bloqueante(s) encontrado(s).`
                    : "Validação autoritativa concluída sem bloqueios.",
                );
              } catch {
                setValidationState("error");
                setValidationMessage(
                  "Não foi possível validar esta revisão. Atualize a semana e tente novamente.",
                );
              }
            }}
          >
            <ShieldCheck size={16} />
            {validationState === "running"
              ? "Validando..."
              : "Validar escala"}
          </button>
          <button className="outline" onClick={() => window.print()}>
            <FileDown size={16} />
            Imprimir mural
          </button>
          <button className="outline" onClick={exportCsv} disabled={!weekId}>
            <FileDown size={16} />
            Exportar CSV
          </button>
          <button className="outline" onClick={exportPdf} disabled={!weekId}>
            <FileDown size={16} />
            Exportar PDF
          </button>
          <Link
            className={`solid button-link ${validationState !== "passed" || blocked > 0 ? "disabled" : ""}`}
            to={
              validationState !== "passed" || blocked > 0
                ? "#"
                : "/app/publications"
            }
            aria-disabled={validationState !== "passed" || blocked > 0}
            onClick={(event) => {
              if (validationState !== "passed" || blocked > 0) event.preventDefault();
            }}
          >
            <ShieldCheck size={16} />
            Ir para publicação
          </Link>
        </div>
      </section>
      <section className="week-strip">
        <button
          className="arrow"
          aria-label="Semana anterior"
          onClick={() => goToWeek(addDays(weekStart, -7))}
        >
          <ChevronLeft size={18} />
        </button>
        {dates.map((day, index) => (
          <button
            key={day.iso}
            className={`day ${selectedDay === index ? "active" : ""} ${isHoliday(day.iso) ? "is-holiday" : ""}`}
            onClick={() => setSelectedDay(index)}
          >
            <span>{day.weekday}</span>
            <strong>{day.date}</strong>
          </button>
        ))}
        <button
          className="arrow"
          aria-label="Próxima semana"
          onClick={() => goToWeek(addDays(weekStart, 7))}
        >
          <ChevronRight size={18} />
        </button>
      </section>
      <section className="day-heading">
        <div>
          <div className="date-pill">
            <CalendarDays size={15} />
            {dates[selectedDay].label}
          </div>
          {isHoliday(dates[selectedDay].iso) && (
            <span className="holiday-badge">Feriado · {holidayByIso.get(dates[selectedDay].iso)}</span>
          )}
          <h2>Turnos e conformidade</h2>
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
      <section className={`summary ${blocked ? "has-problem" : ""}`}>
        <div>
          <span className="summary-dot green" />
          <strong>{working.length}</strong>
          <span>em turno</span>
        </div>
        <div>
          <span className="summary-dot yellow" />
          <strong>{off}</strong>
          <span>em folga</span>
        </div>
        <div>
          <span className="summary-dot purple" />
          <strong>
            {working.reduce(
              (total, review) => total + dailyMinutes(review.shift!),
              0,
            )
              ? formatMinutes(
                  working.reduce(
                    (total, review) => total + dailyMinutes(review.shift!),
                    0,
                  ),
                )
              : "0h00"}
          </strong>
          <span>programadas</span>
        </div>
        <p>
          <CircleAlert size={15} />
          {blocked
            ? `${blocked} bloqueio(s) encontrado(s).`
            : "Sem bloqueios de interjornada neste dia."}
        </p>
      </section>
      {!weekId && store && (
        <section className="import-callout">
          <div>
            <p className="eyebrow">PRIMEIRO PASSO</p>
            <h2>Importe a escala recebida para liberar a edição</h2>
            <p>
              A grade exibida é a referência visual. Ao importar, os turnos
              reais passam a ter revisão, auditoria, validação e publicação
              segura.
            </p>
          </div>
          <span>Dados ainda não sincronizados</span>
        </section>
      )}
      {validationIssues.length > 0 && (
        <section className="validation-panel" aria-live="polite">
          <div className="validation-panel-head">
            <div>
              <p className="eyebrow">REVISÃO AUTORITATIVA</p>
              <h2>Bloqueios e alertas encontrados</h2>
            </div>
            <span>{validationIssues.length} ocorrência(s)</span>
          </div>
          <div className="validation-list">
            {validationIssues.map((issue, index) => (
              <article
                className={
                  issue.blocking
                    ? "validation-issue critical"
                    : "validation-issue"
                }
                key={`${issue.rule_code}-${issue.entry_id ?? index}`}
              >
                <div>
                  <strong>
                    {issue.blocking ? "Bloqueia publicação" : "Alerta"}
                  </strong>
                  <span>{issue.rule_code}</span>
                </div>
                <p>{issue.message}</p>
                <small>
                  {scheduleEmployees.find(
                    (employee) =>
                      employeeIds[employee.name] === issue.employee_id,
                  )?.name ?? "Colaborador não identificado"}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      {(["Caixa", "Fiscal"] as const).map((sector) => {
        const team = reviews.filter(
          (review) => review.employee.sector === sector,
        );
        return (
          <section className="sector" key={sector}>
            <div className="sector-title">
              <div>
                <span className={`sector-marker ${sector.toLowerCase()}`} />
                <div>
                  <h3>{sector}</h3>
                  <p>
                    {team.length} colaborador{team.length === 1 ? "" : "es"}
                  </p>
                </div>
              </div>
            </div>
            <div className="schedule-card">
              <div className="schedule-header schedule-seven">
                <span>Colaborador</span>
                <span>1º período</span>
                <span>Intervalo</span>
                <span>2º período</span>
                <span>Carga do dia</span>
                <span>Interjornada</span>
                <span>Domingo</span>
              </div>
              {team.map((review) => {
                const { employee, shift } = review;
                const sundayStatus = sundayDecision(review);
                return (
                  <div
                    className={`schedule-row schedule-seven ${!shift ? "day-off" : ""} ${review.blocked ? "blocked-row" : ""}`}
                    key={employee.name}
                  >
                    <div className="person">
                      <span className="person-avatar">
                        {initials(employee.name)}
                      </span>
                      <strong>{employee.name}</strong>
                      <button
                        className="edit-shift"
                        type="button"
                        onClick={() => openEditor(employee, shift)}
                        aria-label={`Editar turno de ${employee.name}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="edit-shift"
                        type="button"
                        onClick={() => exportIndividualPdf(employee)}
                        aria-label={`Exportar PDF individual de ${employee.name}`}
                        title="Exportar PDF individual"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                    {shift ? (
                      <>
                        <div className="period">
                          <b>{workPeriod(shift.start, shift.breakStart)}</b>
                          <small>
                            {periodDuration(shift.start, shift.breakStart)}
                          </small>
                        </div>
                        <div className="interval">
                          <b>
                            {workPeriod(shift.breakStart, shift.breakEnd)}
                          </b>
                          <small>
                            {periodDuration(
                              shift.breakStart,
                              shift.breakEnd,
                            )}
                          </small>
                        </div>
                        <div className="period">
                          <b>{workPeriod(shift.breakEnd, shift.end)}</b>
                          <small>
                            {periodDuration(shift.breakEnd, shift.end)}
                          </small>
                        </div>
                        <div className="load">
                          <Clock3 size={14} />
                          {formatMinutes(dailyMinutes(shift))}
                        </div>
                        <div
                          className={
                            review.rest !== undefined &&
                            review.rest < interjourneyMinMinutes
                              ? "status bad"
                              : "status good"
                          }
                        >
                          {review.rest === undefined
                            ? "Sem histórico"
                            : review.rest < interjourneyMinMinutes
                              ? `${formatMinutes(review.rest)} · Bloquear`
                              : `${formatMinutes(review.rest)} · OK`}
                        </div>
                        <div
                          className={`status ${sunday ? sundayStatus.kind : "neutral"}`}
                        >
                          {sunday ? sundayStatus.text : "—"}
                        </div>
                      </>
                    ) : (
                      <div className="off-label">Folga</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <section className="audit">
        <div className="audit-title">
          <div>
            <p className="eyebrow">COMPLIANCE GUARD</p>
            <h2>Histórico e decisão de escala</h2>
            <p>
              Entrada, intervalo, retorno e saída dos três dias anteriores.
            </p>
          </div>
          <span className="audit-rule">
            Mínimo de {formatMinutes(interjourneyMinMinutes)} entre jornadas
          </span>
        </div>
        <div className="audit-card">
          <div className="audit-head">
            <span>Colaborador</span>
            <span>Últimos 3 dias</span>
            <span>Dias seguidos antes de hoje</span>
            <span>Decisão</span>
          </div>
          {reviews.map((review) => {
            const timeline = timelineByEmployee.get(review.employee.name);
            const historyIsos = [3, 2, 1].map((daysAgo) =>
              addDays(dates[selectedDay].iso, -daysAgo),
            );
            const history = historyIsos.map((iso) => timeline?.get(iso) ?? null);
            const decision = !review.shift
              ? ["Folga", "neutral"]
              : sunday
                ? [sundayDecision(review).text, sundayDecision(review).kind]
                : review.blocked
                  ? ["Bloquear escala", "bad"]
                  : ["Pode trabalhar", "good"];
            return (
              <div className="audit-row" key={review.employee.name}>
                <strong>{review.employee.name}</strong>
                <div className="history">
                  {history.map((shift, index) => (
                    <span
                      key={historyIsos[index]}
                      className={!shift ? "history-off" : ""}
                    >
                      <b>{weekdayShort(historyIsos[index])}</b>
                      {shift ? (
                        <>
                          <em>
                            {shift.start}–{shift.breakStart}
                          </em>
                          <em>
                            {shift.breakEnd}–{shift.end}
                          </em>
                        </>
                      ) : (
                        "Folga"
                      )}
                    </span>
                  ))}
                </div>
                <div className="streak">
                  {review.unknownHistory
                    ? "Histórico anterior não importado"
                    : `${review.streak} dia${review.streak === 1 ? "" : "s"} seguido${review.streak === 1 ? "" : "s"}`}
                </div>
                <span className={`decision ${decision[1]}`}>
                  {decision[0]}
                </span>
              </div>
            );
          })}
        </div>
        {sunday && (
          <p className="legal-note">
            Regra operacional ativa: cada pessoa escalada no domingo precisa
            ter uma folga entre segunda e sábado antes do domingo e outra
            entre segunda e sábado depois dele. O rodízio é calculado com os
            dois domingos anteriores a {dates[6].label}.
            {!nextWeekImported &&
              " A semana seguinte ainda não foi importada, então a pós-folga aparece como pendente até lá."}
          </p>
        )}
      </section>
      {editDraft && (
        <div className="editor-backdrop" role="presentation">
          <section
            className="shift-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-editor-title"
          >
            <div className="editor-head">
              <div>
                <p className="eyebrow">EDIÇÃO CONTROLADA</p>
                <h2 id="shift-editor-title">{editDraft.employee.name}</h2>
                <p>{dates[editDraft.day].label}</p>
              </div>
              <button
                className="editor-close"
                type="button"
                onClick={() => setEditDraft(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <label className="editor-off">
              <input
                type="checkbox"
                checked={editDraft.isOff}
                onChange={(event) =>
                  setEditDraft({
                    ...editDraft,
                    isOff: event.target.checked,
                  })
                }
              />{" "}
              Folga neste dia
            </label>
            {!editDraft.isOff && isHoliday(dates[editDraft.day].iso) && (
              <label className="editor-off">
                <input
                  type="checkbox"
                  checked={editDraft.holidayAuthorized}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      holidayAuthorized: event.target.checked,
                    })
                  }
                />{" "}
                Turno autorizado no feriado ({holidayByIso.get(dates[editDraft.day].iso)})
              </label>
            )}
            {!editDraft.isOff && (
              <div className="editor-times">
                <label>
                  Entrada
                  <input
                    type="time"
                    value={editDraft.start}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        start: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Início do intervalo
                  <input
                    type="time"
                    value={editDraft.breakStart}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        breakStart: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Fim do intervalo
                  <input
                    type="time"
                    value={editDraft.breakEnd}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        breakEnd: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Saída
                  <input
                    type="time"
                    value={editDraft.end}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        end: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            )}
            {editMessage && (
              <p className={`editor-message ${editState}`}>{editMessage}</p>
            )}
            <div className="editor-actions">
              <button
                className="outline"
                type="button"
                onClick={() => setEditDraft(null)}
              >
                Cancelar
              </button>
              <button
                className="solid"
                type="button"
                disabled={editState === "saving"}
                onClick={saveEdit}
              >
                {editState === "saving" ? "Salvando…" : "Salvar alteração"}
              </button>
            </div>
          </section>
        </div>
      )}
      <footer>
        <span>
          <i className="dot work" />
          Turno programado
        </span>
        <span>
          <i className="dot rest" />
          Folga
        </span>
        <span>Fonte: escala física enviada · transcrição inicial</span>
      </footer>
    </>
  );
}
