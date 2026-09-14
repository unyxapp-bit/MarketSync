import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileDown,
  LayoutGrid,
  Menu,
  Pencil,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  dates,
  employees as initialEmployees,
  nextWeekRestDay,
  priorSundayWork,
  priorWeekDates,
  priorWeekSchedule,
  type Employee,
  type Shift,
} from "./data/realSchedule";
import {
  dailyMinutes,
  formatMinutes,
  periodDuration,
  priorWorkStreak,
  restMinutes,
} from "./lib/compliance";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { TeamAdmin } from "./components/TeamAdmin";
import { supabase } from "./lib/supabase";
import {
  getMyStores,
  importReceivedWeek,
  loadCanonicalWeek,
  publishWeek,
  saveCanonicalEntry,
  validateSchedule,
} from "./lib/marketSyncApi";
import "./App.css";

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
};
type ValidationIssue = {
  employee_id?: string;
  entry_id?: string | null;
  rule_code: string;
  blocking: boolean;
  message: string;
  evidence?: Record<string, unknown>;
};

function ScheduleWorkspace({
  store,
}: {
  store?: { id: string; name: string };
}) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [search, setSearch] = useState("");
  const [importState, setImportState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [publishState, setPublishState] = useState<
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
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editState, setEditState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [editMessage, setEditMessage] = useState("");
  const [weekId, setWeekId] = useState<string | null>(null);
  const [weekRevision, setWeekRevision] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!store) return;
    loadCanonicalWeek(store.id, "2026-09-14")
      .then((record) => {
        if (!record) return;
        const byEmployee = new Map<string, Employee>();
        const ids: Record<string, string> = {};
        record.entries.forEach((entry) => {
          const employeeValue = entry.employees as unknown as
            | {
                full_name?: string;
                sectors?: { name?: string } | { name?: string }[];
              }
            | {
                full_name?: string;
                sectors?: { name?: string } | { name?: string }[];
              }[]
            | null;
          const employee = Array.isArray(employeeValue)
            ? employeeValue[0]
            : employeeValue;
          if (!employee?.full_name) return;
          ids[employee.full_name] = entry.employee_id;
          const sectorValue = employee.sectors ?? null;
          const sectorName = Array.isArray(sectorValue)
            ? sectorValue[0]?.name
            : sectorValue?.name;
          const existing = byEmployee.get(entry.employee_id) ?? {
            name: employee.full_name,
            sector: (sectorName === "Fiscal"
              ? "Fiscal"
              : "Caixa") as Employee["sector"],
            schedule: Array(7).fill(null),
          };
          const day = Number(entry.work_date.slice(-2)) - 14;
          const segments = [...(entry.shift_segments ?? [])].sort(
            (left, right) => left.sequence - right.sequence,
          );
          if (
            day >= 0 &&
            day < 7 &&
            entry.day_type === "work" &&
            segments.length >= 2
          )
            existing.schedule[day] = {
              start: segments[0].starts_at.slice(11, 16),
              breakStart: segments[0].ends_at.slice(11, 16),
              breakEnd: segments[1].starts_at.slice(11, 16),
              end: segments[1].ends_at.slice(11, 16),
            };
          byEmployee.set(entry.employee_id, existing);
        });
        setScheduleEmployees([...byEmployee.values()]);
        setEmployeeIds(ids);
        setWeekId(record.schedule.id);
        setWeekRevision(record.schedule.revision);
        setImportState("done");
      })
      .catch(() => setImportState("error"));
  }, [store, refreshKey]);
  const visible = useMemo(
    () =>
      scheduleEmployees.filter((employee) =>
        employee.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, scheduleEmployees],
  );
  const reviews = useMemo<Review[]>(
    () =>
      visible.map((employee) => {
        const shift = employee.schedule[selectedDay];
        const timeline = [
          ...(priorWeekSchedule[employee.name] ?? [null, null, null]),
          ...employee.schedule,
        ];
        const timelineDay = selectedDay + 3;
        const previous = timeline[timelineDay - 1];
        const rest =
          shift && previous ? restMinutes(previous, shift) : undefined;
        const streak = priorWorkStreak(timeline, timelineDay);
        const hasPreSundayRest = employee.schedule
          .slice(0, 6)
          .some((dayShift) => !dayShift);
        const hasPostSundayRest = Boolean(nextWeekRestDay[employee.name]);
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
            ((rest !== undefined && rest < 660) ||
              streak.count >= 7 ||
              sundayRestViolation),
          ),
        };
      }),
    [selectedDay, visible],
  );
  const working = reviews.filter((review) => review.shift);
  const off = reviews.length - working.length;
  const blocked = reviews.filter((review) => review.blocked).length;
  const sunday = selectedDay === 6;
  const sundayDecision = (review: Review) => {
    if (!review.shift) return { text: "Folga programada", kind: "neutral" };
    if (!review.hasPreSundayRest)
      return { text: "Não apto · pré-folga", kind: "bad" };
    if (!review.hasPostSundayRest)
      return { text: "Pós-folga pendente", kind: "bad" };
    if (review.blocked) return { text: "Não apto", kind: "bad" };
    const workedOnBothRecentSundays = ["2026-09-06", "2026-09-13"].every(
      (date) => priorSundayWork[date]?.includes(review.employee.name),
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
    setEditDraft({
      employee,
      employeeId,
      day: selectedDay,
      isOff: !shift,
      start: shift?.start ?? "07:40",
      breakStart: shift?.breakStart ?? "12:20",
      breakEnd: shift?.breakEnd ?? "14:20",
      end: shift?.end ?? "17:40",
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
      const workDate = `2026-09-${String(14 + editDraft.day).padStart(2, "0")}`;
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
  return (
    <div className="workspace">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <div className="sidebar-brand">
          <span className="logo-dot" />
          <strong>
            Market<span>Sync</span>
          </strong>
        </div>
        <p>OPERAÇÃO</p>
        <a className="active" href="#schedule">
          <CalendarDays size={17} />
          Escalas
        </a>
        <a href="#reports">
          <LayoutGrid size={17} />
          Conflitos
        </a>
        <a href="#team">
          <Users size={17} />
          Equipe
        </a>
        <p>GESTÃO</p>
        <a href="#reports">
          <ShieldCheck size={17} />
          Regras
        </a>
        <a href="#reports">
          <Clock3 size={17} />
          Publicações
        </a>
        <small>
          Planejamento seguro
          <br />e rastreável
        </small>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="logo">
            <span className="logo-dot" />
            <strong>
              Market<span>Sync</span>
            </strong>
          </div>
          <div className="store-picker">
            <span>{store?.name ?? "Sua loja"}</span>
            <small>Operação conectada ao Supabase</small>
            <ChevronDown size={15} />
          </div>
          <nav>
            <a className="selected" href="#schedule">
              <CalendarDays size={17} />
              Escala
            </a>
            <a href="#team">
              <Users size={17} />
              Equipe
            </a>
            <a href="#reports">
              <LayoutGrid size={17} />
              Relatórios
            </a>
          </nav>
          <button className="menu">
            <Menu size={19} />
          </button>
        </header>
        <main>
          <section className="hero">
            <div>
              <p className="eyebrow">PLANEJAMENTO OPERACIONAL</p>
              <h1>Escala da semana</h1>
              <p className="subtitle">
                14 a 20 de setembro de 2026 ·{" "}
                {weekId
                  ? `Dados carregados do Supabase · revisão ${weekRevision}`
                  : "Dados da escala da loja"}
              </p>
              {validationMessage && (
                <p className={`validation-message ${validationState}`}>
                  {validationMessage}
                </p>
              )}
            </div>
            <div className="hero-actions">
              {store && (
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
              <button
                className="solid"
                disabled={
                  !weekId ||
                  weekRevision === null ||
                  blocked > 0 ||
                  validationState !== "passed" ||
                  publishState === "loading" ||
                  publishState === "done"
                }
                onClick={async () => {
                  if (!weekId || weekRevision === null) return;
                  setPublishState("loading");
                  try {
                    const revision = await publishWeek(weekId, weekRevision);
                    setWeekRevision(revision);
                    setPublishState("done");
                  } catch {
                    setPublishState("error");
                  }
                }}
              >
                <ShieldCheck size={16} />
                {publishState === "loading"
                  ? "Publicando..."
                  : publishState === "done"
                    ? "Escala publicada"
                    : publishState === "error"
                      ? "Atualização concorrente"
                      : "Revisar e publicar"}
              </button>
            </div>
          </section>
          <section className="week-strip">
            <button className="arrow" aria-label="Semana anterior">
              <ChevronLeft size={18} />
            </button>
            {dates.map((day, index) => (
              <button
                key={day.date}
                className={`day ${selectedDay === index ? "active" : ""}`}
                onClick={() => setSelectedDay(index)}
              >
                <span>{day.weekday}</span>
                <strong>{day.date}</strong>
              </button>
            ))}
            <button className="arrow" aria-label="Próxima semana">
              <ChevronRight size={18} />
            </button>
          </section>
          <section className="day-heading">
            <div>
              <div className="date-pill">
                <CalendarDays size={15} />
                {dates[selectedDay].label} de 2026
              </div>
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
                  <button>
                    Ver setor <ChevronRight size={15} />
                  </button>
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
                                review.rest !== undefined && review.rest < 660
                                  ? "status bad"
                                  : "status good"
                              }
                            >
                              {review.rest === undefined
                                ? "Sem histórico"
                                : review.rest < 660
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
              <span className="audit-rule">Mínimo de 11h entre jornadas</span>
            </div>
            <div className="audit-card">
              <div className="audit-head">
                <span>Colaborador</span>
                <span>Últimos 3 dias</span>
                <span>Dias seguidos antes de hoje</span>
                <span>Decisão</span>
              </div>
              {reviews.map((review) => {
                const history = [
                  ...(priorWeekSchedule[review.employee.name] ?? [
                    null,
                    null,
                    null,
                  ]),
                  ...review.employee.schedule,
                ].slice(selectedDay, selectedDay + 3);
                const historyDates = [...priorWeekDates, ...dates].slice(
                  selectedDay,
                  selectedDay + 3,
                );
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
                          key={index}
                          className={!shift ? "history-off" : ""}
                        >
                          <b>{historyDates[index].weekday}</b>
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
                entre segunda e sábado depois dele. Como a semana de 21/09 ainda
                não foi criada, a pós-folga está pendente e a publicação fica
                bloqueada. O rodízio foi calculado com os domingos de 06/09 e
                13/09.
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
                    <p>{dates[editDraft.day].label} de 2026</p>
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
          {store && <TeamAdmin storeId={store.id} />}
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
        </main>
      </div>
    </div>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [store, setStore] = useState<
    { id: string; name: string } | undefined
  >();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHasStore(null);
      setStore(undefined);
      return;
    }
    getMyStores()
      .then((stores) => {
        setHasStore(stores.length > 0);
        setStore(
          stores[0] ? { id: stores[0].id, name: stores[0].name } : undefined,
        );
      })
      .catch(() => setHasStore(false));
  }, [session]);

  if (loadingSession)
    return <main className="auth-page">Carregando acesso seguro…</main>;
  if (supabase && !session) return <AuthScreen />;
  if (supabase && hasStore === null)
    return <main className="auth-page">Carregando sua operação…</main>;
  if (supabase && !hasStore)
    return <OnboardingScreen onComplete={() => setHasStore(true)} />;
  return <ScheduleWorkspace store={store} />;
}

export default App;
