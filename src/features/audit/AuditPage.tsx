import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import {
  getStoreEmployees,
  loadAuditTrail,
  type ApprovalRow,
  type AuditEventRow,
  type ScheduleVersionRow,
  type SnapshotEntry,
} from "../../lib/marketSyncApi";
import { mondayOf, todayIso, weekRangeLabel } from "../../lib/dates";
import { useStore } from "../../shared/StoreContext";
import { PageHero } from "../../shared/ui/PageHero";

const cardClass = "mt-5 max-w-[860px] p-[22px] bg-surface border border-line rounded-md shadow-xs";
const cardHeadingClass = "text-[14px] mb-4 m-0 text-[#2b394e]";
const tableWrapClass = "border border-[#e1e6eb] rounded-[9px] bg-white overflow-auto";
const headRowBase = "min-w-0 grid items-center h-[38px] bg-[#f8fafb] text-[#8490a0] text-[10px] font-extrabold uppercase tracking-[0.35px]";
const dataRowBase = "min-w-0 grid items-center min-h-[53px] border-t border-[#edf0f2]";

const actionLabels: Record<string, string> = {
  entry_updated: "Turno editado",
  published: "Escala publicada",
  submitted_for_approval: "Enviada para aprovação",
  approval_decided: "Decisão de aprovação",
  rule_set_revised: "Nova versão de regras",
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function entryKey(entry: SnapshotEntry) {
  return `${entry.employeeId}|${entry.workDate}`;
}

function segmentsLabel(entry: SnapshotEntry | undefined) {
  if (!entry) return "sem registro";
  if (entry.dayType !== "work") return entry.dayType;
  return entry.segments
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => `${s.startsAt.slice(11, 16)}–${s.endsAt.slice(11, 16)}`)
    .join(", ");
}

function diffVersions(older: ScheduleVersionRow, newer: ScheduleVersionRow) {
  const before = new Map(older.snapshot.entries.map((e) => [entryKey(e), e]));
  const after = new Map(newer.snapshot.entries.map((e) => [entryKey(e), e]));
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changes: Array<{ key: string; employeeId: string; workDate: string; before?: SnapshotEntry; after?: SnapshotEntry }> = [];
  for (const key of keys) {
    const b = before.get(key);
    const a = after.get(key);
    if (segmentsLabel(b) !== segmentsLabel(a)) {
      const [employeeId, workDate] = key.split("|");
      changes.push({ key, employeeId, workDate, before: b, after: a });
    }
  }
  return changes.sort((a, b) => a.workDate.localeCompare(b.workDate));
}

export function AuditPage() {
  const store = useStore();
  const weekStart = useMemo(() => mondayOf(todayIso()), []);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ScheduleVersionRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!store) return;
    setLoading(true);
    Promise.all([loadAuditTrail(store.id, weekStart), getStoreEmployees(store.id)])
      .then(([trail, roster]) => {
        setVersions(trail.versions);
        setApprovals(trail.approvals);
        setEvents(trail.events);
        setEmployeeNames(Object.fromEntries(roster.map((r) => [r.id, r.full_name])));
      })
      .catch(() => setError("Não foi possível carregar o histórico e a auditoria."))
      .finally(() => setLoading(false));
  }, [store, weekStart]);

  useEffect(refresh, [refresh]);

  if (!store) return null;

  const diff = versions.length >= 2 ? diffVersions(versions[1], versions[0]) : [];

  const timeline = [
    ...approvals.map((a) => ({
      key: `approval-${a.id}`,
      occurred_at: a.created_at,
      label: a.decision === "approved" ? "Aprovação concedida" : "Aprovação recusada",
      actor: firstOf(a.profiles)?.full_name ?? "—",
      detail: a.reason ?? undefined,
      tone: a.decision === "approved" ? "good" : "bad",
    })),
    ...events.map((e) => ({
      key: `event-${e.id}`,
      occurred_at: e.occurred_at,
      label: actionLabels[e.action] ?? e.action,
      actor: firstOf(e.profiles)?.full_name ?? "—",
      detail: undefined,
      tone: "neutral" as const,
    })),
  ].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return (
    <>
      <PageHero
        eyebrow="ADMINISTRADOR, RH E AUDITOR"
        title="Histórico e auditoria"
        subtitle={
          <>
            Escala de {weekRangeLabel(weekStart)}
            {versions.length > 0 ? ` · versão atual ${versions[0].number}` : ""}
          </>
        }
      />

      {!loading && versions.length === 0 && approvals.length === 0 && events.length === 0 && (
        <p className="text-[11px] text-[#68778a] m-0 mt-5">Nenhum evento registrado ainda para esta loja.</p>
      )}

      {versions.length > 0 && (
        <section className={cardClass}>
          <h2 className={cardHeadingClass}>Versões publicadas</h2>
          <div className={tableWrapClass}>
            <div className={`${headRowBase} grid-cols-[90px_1fr_100px]`}>
              <span className="pl-4">Versão</span>
              <span>Publicada por</span>
              <span>Checksum</span>
            </div>
            {versions.map((version, index) => (
              <div className={`${dataRowBase} grid-cols-[90px_1fr_100px]`} key={version.id}>
                <strong className="pl-4 text-[12px] text-[#314056]">
                  v{version.number}
                  {index === 0 && (
                    <span className="ml-2 py-[2px] px-[7px] text-[9px] rounded-[6px] font-bold tracking-[-0.01em] bg-brand-soft text-brand-dark justify-self-start">
                      {" "}
                      Atual
                    </span>
                  )}
                </strong>
                <span>
                  {firstOf(version.profiles)?.full_name ?? "—"} ·{" "}
                  {firstOf(version.publications)?.published_at?.slice(0, 16).replace("T", " ") ??
                    version.created_at.slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-bold text-[11px] font-mono text-[#8590a0]">
                  {version.checksum.slice(0, 12)}…
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {versions.length >= 2 && (
        <section className={cardClass}>
          <h2 className={cardHeadingClass}>
            Comparação v{versions[1].number} → v{versions[0].number}
          </h2>
          {diff.length === 0 ? (
            <p className="text-[11px] text-[#68778a] m-0">Nenhuma diferença de turnos entre as duas versões mais recentes.</p>
          ) : (
            <div className={tableWrapClass}>
              <div className={`${headRowBase} grid-cols-[160px_90px_1fr_1fr]`}>
                <span className="pl-4">Colaborador</span>
                <span>Data</span>
                <span>Antes</span>
                <span>Depois</span>
              </div>
              {diff.map((change) => (
                <div className={`${dataRowBase} grid-cols-[160px_90px_1fr_1fr]`} key={change.key}>
                  <strong className="pl-4 text-[12px] text-[#314056]">
                    {employeeNames[change.employeeId] ?? change.employeeId}
                  </strong>
                  <span>{change.workDate}</span>
                  <span className="text-[#b23d34]">{segmentsLabel(change.before)}</span>
                  <span className="text-[#11765a]">{segmentsLabel(change.after)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section className={cardClass}>
          <h2 className={cardHeadingClass}>Linha do tempo de eventos</h2>
          <ul className="list-none m-0 p-0 grid gap-[6px]">
            {timeline.map((item) => (
              <li key={item.key}>
                <div className="w-full grid gap-[3px]">
                  <div className="flex justify-between gap-[10px]">
                    <strong className="text-[12px] text-[#2b394e]">{item.label}</strong>
                    <small className="text-[10px] text-[#7d8999] whitespace-nowrap">
                      {item.actor} · {item.occurred_at.slice(0, 16).replace("T", " ")}
                    </small>
                  </div>
                  {item.detail && <p className="m-0 text-[11px] text-[#536174]">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] bg-[#fff1ef] text-[#b23d34]">
          {error}
        </p>
      )}
      {!loading && versions.length === 0 && (
        <p className="flex items-center gap-[6px] max-w-[620px] text-[12px] text-[#667085] leading-[1.5] mb-3 mt-5">
          <History size={13} /> Nada foi publicado ainda para a semana atual, então ainda não há
          versão para comparar. O histórico aparece aqui assim que a primeira publicação
          acontecer.
        </p>
      )}
    </>
  );
}
