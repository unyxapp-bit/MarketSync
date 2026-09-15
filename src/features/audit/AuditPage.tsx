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
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">ADMINISTRADOR, RH E AUDITOR</p>
          <h1>Histórico e auditoria</h1>
          <p className="subtitle">
            Escala de {weekRangeLabel(weekStart)}
            {versions.length > 0 ? ` · versão atual ${versions[0].number}` : ""}
          </p>
        </div>
      </section>

      {!loading && versions.length === 0 && approvals.length === 0 && events.length === 0 && (
        <p className="empty">Nenhum evento registrado ainda para esta loja.</p>
      )}

      {versions.length > 0 && (
        <section className="publication-card audit-versions">
          <h2>Versões publicadas</h2>
          <div className="audit-card">
            <div className="audit-head rules-history-head">
              <span>Versão</span>
              <span>Publicada por</span>
              <span>Checksum</span>
            </div>
            {versions.map((version, index) => (
              <div className="audit-row rules-history-row" key={version.id}>
                <strong>
                  v{version.number}
                  {index === 0 && <span className="decision good version-current"> Atual</span>}
                </strong>
                <span>
                  {firstOf(version.profiles)?.full_name ?? "—"} ·{" "}
                  {firstOf(version.publications)?.published_at?.slice(0, 16).replace("T", " ") ??
                    version.created_at.slice(0, 16).replace("T", " ")}
                </span>
                <span className="audit-checksum">{version.checksum.slice(0, 12)}…</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {versions.length >= 2 && (
        <section className="publication-card audit-diff">
          <h2>
            Comparação v{versions[1].number} → v{versions[0].number}
          </h2>
          {diff.length === 0 ? (
            <p className="empty">Nenhuma diferença de turnos entre as duas versões mais recentes.</p>
          ) : (
            <div className="audit-card">
              <div className="audit-head diff-head">
                <span>Colaborador</span>
                <span>Data</span>
                <span>Antes</span>
                <span>Depois</span>
              </div>
              {diff.map((change) => (
                <div className="audit-row diff-row" key={change.key}>
                  <strong>{employeeNames[change.employeeId] ?? change.employeeId}</strong>
                  <span>{change.workDate}</span>
                  <span className="diff-before">{segmentsLabel(change.before)}</span>
                  <span className="diff-after">{segmentsLabel(change.after)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section className="publication-card audit-timeline">
          <h2>Linha do tempo de eventos</h2>
          <ul className="pending-list">
            {timeline.map((item) => (
              <li key={item.key} className={`pending-item ${item.tone}`}>
                <div className="timeline-row">
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {item.actor} · {item.occurred_at.slice(0, 16).replace("T", " ")}
                    </small>
                  </div>
                  {item.detail && <p>{item.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="editor-message error">{error}</p>}
      {!loading && versions.length === 0 && (
        <p className="publication-hint audit-empty-note">
          <History size={13} /> Nada foi publicado ainda para a semana atual, então ainda não há
          versão para comparar. O histórico aparece aqui assim que a primeira publicação
          acontecer.
        </p>
      )}
    </>
  );
}
