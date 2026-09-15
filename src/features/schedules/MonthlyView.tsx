import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, daysInMonth, monthDates, monthLabel } from "../../lib/dates";
import { loadMonthSchedule, type ComplianceEntryRow, type SectorRow } from "../../lib/marketSyncApi";

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
  const days = useMemo(() => monthDates(monthStart), [monthStart]);

  useEffect(() => {
    setLoading(true);
    const monthEnd = addDays(monthStart, daysInMonth(monthStart) - 1);
    loadMonthSchedule(storeId, monthStart, monthEnd)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [storeId, monthStart]);

  const byEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, ComplianceEntryRow>>();
    for (const entry of entries) {
      const byDate = map.get(entry.employee_id) ?? new Map<string, ComplianceEntryRow>();
      byDate.set(entry.work_date, entry);
      map.set(entry.employee_id, byDate);
    }
    return map;
  }, [entries]);

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
                          return (
                            <td
                              key={day.iso}
                              className={`monthly-cell ${summary?.tone ?? ""} ${day.weekday === "Dom" ? "monthly-sunday" : ""}`}
                              onClick={() => onSelectDay(day.iso)}
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
      <p className="monthly-hint">Clique num dia para abrir a semana correspondente e editar.</p>
    </section>
  );
}
