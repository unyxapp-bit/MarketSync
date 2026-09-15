import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { formatMinutes } from "../../lib/compliance";
import { downloadCsv, toCsv } from "../../lib/csv";
import { addDays, addDaysToTimestamp, daysInMonth, mondayOf, monthDates, monthLabel } from "../../lib/dates";
import {
  loadCanonicalWeek,
  loadMonthSchedule,
  saveCanonicalEntry,
  type ComplianceEntryRow,
  type SectorRow,
} from "../../lib/marketSyncApi";

type RosterEntry = { id: string; name: string; sector: string };

const dayTypeLabel: Record<string, string> = {
  vacation: "Férias",
  leave: "Licença",
  absence: "Falta",
};

function shiftSummary(entry: ComplianceEntryRow): { text: string; tone: string } {
  if (entry.day_type === "work") {
    const segments = [...(entry.shift_segments ?? [])].sort((a, b) => a.sequence - b.sequence);
    if (segments.length === 0) return { text: "", tone: "" };
    const start = segments[0].starts_at.slice(11, 16);
    const end = segments[segments.length - 1].ends_at.slice(11, 16);
    return { text: `${start}–${end}`, tone: "work" };
  }
  if (entry.day_type === "off") return { text: "Folga", tone: "off" };
  return { text: dayTypeLabel[entry.day_type] ?? entry.day_type, tone: "other" };
}

export function MonthlyView({
  storeId,
  monthStart,
  onChangeMonth,
  employeeRoster,
  sectorList,
  onSelectDay,
}: {
  storeId: string;
  monthStart: string;
  onChangeMonth: (delta: number) => void;
  employeeRoster: RosterEntry[];
  sectorList: SectorRow[];
  onSelectDay: (iso: string) => void;
}) {
  const [entries, setEntries] = useState<ComplianceEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragSource, setDragSource] = useState<{ employeeId: string; date: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveMessage, setMoveMessage] = useState("");
  const days = useMemo(() => monthDates(monthStart), [monthStart]);

  const refresh = () => {
    setLoading(true);
    const monthEnd = addDays(monthStart, daysInMonth(monthStart) - 1);
    loadMonthSchedule(storeId, monthStart, monthEnd)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [storeId, monthStart]);

  const byEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, ComplianceEntryRow>>();
    for (const entry of entries) {
      const byDate = map.get(entry.employee_id) ?? new Map<string, ComplianceEntryRow>();
      byDate.set(entry.work_date, entry);
      map.set(entry.employee_id, byDate);
    }
    return map;
  }, [entries]);

  const minutesByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of entries) {
      if (entry.day_type !== "work") continue;
      const minutes = (entry.shift_segments ?? []).reduce(
        (sum, segment) => sum + (new Date(segment.ends_at).getTime() - new Date(segment.starts_at).getTime()) / 60000,
        0,
      );
      totals.set(entry.employee_id, (totals.get(entry.employee_id) ?? 0) + minutes);
    }
    return totals;
  }, [entries]);

  // Drag-and-drop is deliberately narrow: same employee, same calendar week only (so it always
  // maps to a single schedules row/revision — no cross-week revision juggling), and never
  // overwrites a day that already has a work shift. Anything wider always re-opens the week
  // editor's normal validated flow instead.
  const handleDrop = async (employeeId: string, targetDate: string) => {
    const source = dragSource;
    setDragSource(null);
    if (!source || source.employeeId !== employeeId || source.date === targetDate) return;
    setMoveMessage("");
    if (mondayOf(source.date) !== mondayOf(targetDate)) {
      setMoveMessage("Só é possível mover um turno dentro da mesma semana.");
      return;
    }
    const existingTarget = byEmployeeAndDate.get(employeeId)?.get(targetDate);
    if (existingTarget && existingTarget.day_type !== "off") {
      setMoveMessage(
        existingTarget.day_type === "work"
          ? "Esse dia já tem um turno — mova ou apague-o primeiro."
          : `Esse dia está marcado como ${dayTypeLabel[existingTarget.day_type] ?? existingTarget.day_type} — não é possível soltar um turno nele.`,
      );
      return;
    }
    setMoving(true);
    try {
      const week = await loadCanonicalWeek(storeId, mondayOf(source.date));
      const sourceEntry = week?.entries.find(
        (entry) => entry.employee_id === employeeId && entry.work_date === source.date,
      );
      if (!week || !sourceEntry || sourceEntry.day_type !== "work" || !sourceEntry.shift_segments?.length) {
        setMoveMessage("O turno de origem mudou nesse meio-tempo — atualize e tente de novo.");
        return;
      }
      const deltaDays = Math.round(
        (new Date(`${targetDate}T12:00:00Z`).getTime() - new Date(`${source.date}T12:00:00Z`).getTime()) / 86400000,
      );
      const segments = [...sourceEntry.shift_segments]
        .sort((a, b) => a.sequence - b.sequence)
        .map((segment) => ({
          startsAt: addDaysToTimestamp(segment.starts_at, deltaDays),
          endsAt: addDaysToTimestamp(segment.ends_at, deltaDays),
        }));
      const revisionAfterMove = await saveCanonicalEntry({
        scheduleId: week.schedule.id,
        employeeId,
        workDate: targetDate,
        dayType: "work",
        segments,
        expectedRevision: week.schedule.revision,
      });
      await saveCanonicalEntry({
        scheduleId: week.schedule.id,
        employeeId,
        workDate: source.date,
        dayType: "off",
        segments: [],
        expectedRevision: revisionAfterMove,
      });
      setMoveMessage("Turno movido.");
      refresh();
    } catch {
      setMoveMessage("Não foi possível mover o turno. Abra a semana para editar manualmente.");
    } finally {
      setMoving(false);
    }
  };

  const exportHoursCsv = () => {
    const rows = employeeRoster
      .filter((employee) => (minutesByEmployee.get(employee.id) ?? 0) > 0)
      .map((employee) => [
        employee.name,
        employee.sector,
        formatMinutes(Math.round(minutesByEmployee.get(employee.id) ?? 0)),
      ]);
    const csv = toCsv(["colaborador", "setor", "horas_no_mes"], rows);
    downloadCsv(`horas_${monthStart.slice(0, 7)}.csv`, csv);
  };

  const colorBySector = useMemo(
    () => new Map(sectorList.map((sector) => [sector.name, sector.color])),
    [sectorList],
  );
  const sectionNames = useMemo(() => {
    const known = sectorList.map((sector) => sector.name);
    const present = new Set(employeeRoster.map((employee) => employee.sector));
    const extra = [...present].filter((name) => !known.includes(name)).sort();
    return [...known, ...extra].filter((name) => employeeRoster.some((e) => e.sector === name));
  }, [sectorList, employeeRoster]);

  return (
    <section className="monthly-view">
      <div className="monthly-view-head">
        <button className="arrow" type="button" aria-label="Mês anterior" onClick={() => onChangeMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel(monthStart)}</strong>
        <button className="arrow" type="button" aria-label="Próximo mês" onClick={() => onChangeMonth(1)}>
          <ChevronRight size={18} />
        </button>
        <button className="outline monthly-export" type="button" onClick={exportHoursCsv} disabled={loading}>
          <FileDown size={15} />
          Exportar horas do mês (CSV)
        </button>
      </div>
      {loading ? (
        <p className="empty">Carregando escala do mês...</p>
      ) : (
        <div className="monthly-grid-wrap">
          <table className="monthly-grid">
            <thead>
              <tr>
                <th className="monthly-name-col">Colaborador</th>
                {days.map((day) => (
                  <th key={day.iso} className={day.weekday === "Dom" ? "monthly-sunday" : ""}>
                    <span>{day.weekday}</span>
                    <strong>{day.date}</strong>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionNames.map((sector) => (
                <Fragment key={sector}>
                  <tr className="monthly-sector-row">
                    <td colSpan={days.length + 1}>
                      <span
                        className="sector-marker"
                        style={{ background: colorBySector.get(sector) ?? "#8590a0" }}
                      />
                      {sector}
                    </td>
                  </tr>
                  {employeeRoster
                    .filter((employee) => employee.sector === sector)
                    .map((employee) => (
                      <tr key={employee.id}>
                        <td className="monthly-name-col">{employee.name}</td>
                        {days.map((day) => {
                          const entry = byEmployeeAndDate.get(employee.id)?.get(day.iso);
                          const summary = entry ? shiftSummary(entry) : null;
                          const draggableCell = summary?.tone === "work" && !moving;
                          return (
                            <td
                              key={day.iso}
                              className={`monthly-cell ${summary?.tone ?? ""} ${day.weekday === "Dom" ? "monthly-sunday" : ""} ${draggableCell ? "draggable" : ""}`}
                              onClick={() => onSelectDay(day.iso)}
                              draggable={draggableCell}
                              onDragStart={() => setDragSource({ employeeId: employee.id, date: day.iso })}
                              onDragOver={(event) => {
                                if (dragSource?.employeeId === employee.id) event.preventDefault();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleDrop(employee.id, day.iso);
                              }}
                            >
                              {summary?.text ?? ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
              {employeeRoster.length === 0 && (
                <tr>
                  <td colSpan={days.length + 1} className="empty">
                    Nenhum colaborador cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="monthly-hint">
        Clique num dia para abrir a semana correspondente e editar · arraste um turno para outro
        dia da mesma semana para movê-lo.
        {moving ? " Movendo..." : ""}
      </p>
      {moveMessage && <p className="monthly-move-message">{moveMessage}</p>}
      {!loading && minutesByEmployee.size > 0 && (
        <div className="monthly-hours-report">
          <h3>Total de horas no mês</h3>
          <div className="monthly-hours-list">
            {employeeRoster
              .filter((employee) => (minutesByEmployee.get(employee.id) ?? 0) > 0)
              .sort((a, b) => (minutesByEmployee.get(b.id) ?? 0) - (minutesByEmployee.get(a.id) ?? 0))
              .map((employee) => (
                <div className="monthly-hours-row" key={employee.id}>
                  <span>{employee.name}</span>
                  <strong>{formatMinutes(Math.round(minutesByEmployee.get(employee.id) ?? 0))}</strong>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
