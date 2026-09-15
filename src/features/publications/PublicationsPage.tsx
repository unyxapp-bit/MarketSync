import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import {
  decideScheduleApproval,
  loadPublicationSummary,
  publishWeek,
  submitScheduleForApproval,
} from "../../lib/marketSyncApi";
import { mondayOf, todayIso, weekRangeLabel } from "../../lib/dates";
import { useStore } from "../../shared/StoreContext";

type ScheduleStatus =
  | "draft"
  | "validating"
  | "has_conflicts"
  | "ready"
  | "pending_approval"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

const steps = ["Validar", "Revisar", "Aprovar", "Publicar"] as const;

function stepIndexFor(status: ScheduleStatus | undefined, hasPassedRun: boolean) {
  if (!status || status === "draft" || status === "has_conflicts" || !hasPassedRun) return 0;
  if (status === "ready") return 1;
  if (status === "pending_approval") return 2;
  if (status === "approved" || status === "published") return 3;
  return 0;
}

export function PublicationsPage() {
  const store = useStore();
  const weekStart = mondayOf(todayIso());
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<{ id: string; status: ScheduleStatus; revision: number } | null>(null);
  const [people, setPeople] = useState(0);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasPassedRun, setHasPassedRun] = useState(false);
  const [critical, setCritical] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [actionState, setActionState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!store) return;
    setLoading(true);
    loadPublicationSummary(store.id, weekStart)
      .then((summary) => {
        if (!summary) {
          setSchedule(null);
          return;
        }
        setSchedule(summary.schedule as { id: string; status: ScheduleStatus; revision: number });
        setPeople(summary.people);
        setSectors(summary.sectors);
        setHasPassedRun(summary.run?.status === "passed");
        setCritical(summary.critical);
        setWarnings(summary.warnings);
      })
      .catch(() => setMessage("Não foi possível carregar o estado da publicação."))
      .finally(() => setLoading(false));
  }, [store, weekStart]);

  useEffect(refresh, [refresh]);

  if (!store) return null;

  const currentStep = stepIndexFor(schedule?.status, hasPassedRun);

  const submit = async () => {
    if (!schedule) return;
    setActionState("working");
    setMessage("");
    try {
      await submitScheduleForApproval(schedule.id, schedule.revision);
      refresh();
    } catch {
      setActionState("error");
      setMessage("Não foi possível enviar para aprovação. Confira se a validação ainda está atual.");
    } finally {
      setActionState("idle");
    }
  };

  const decide = async (decision: "approved" | "rejected") => {
    if (!schedule) return;
    if (decision === "rejected" && !rejectReason.trim()) {
      setMessage("Descreva o motivo da reprovação.");
      return;
    }
    setActionState("working");
    setMessage("");
    try {
      await decideScheduleApproval(schedule.id, schedule.revision, decision, rejectReason.trim() || undefined);
      setShowReject(false);
      setRejectReason("");
      refresh();
    } catch {
      setActionState("error");
      setMessage("Não foi possível registrar a decisão. Você precisa ser gerente da loja.");
    } finally {
      setActionState("idle");
    }
  };

  const publish = async () => {
    if (!schedule) return;
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    setActionState("working");
    setMessage("");
    try {
      const revision = await publishWeek(schedule.id, schedule.revision, key);
      setPublishedRevision(revision);
      refresh();
    } catch {
      setActionState("error");
      setMessage("Não foi possível publicar. Atualize a página e tente novamente.");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <>
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">GESTÃO E AUDITOR</p>
          <h1>Publicar escala</h1>
          <p className="subtitle">Validação, revisão, aprovação e publicação · {weekRangeLabel(weekStart)}</p>
        </div>
      </section>

      {!loading && !schedule && (
        <section className="import-callout">
          <div>
            <p className="eyebrow">SEM ESCALA</p>
            <h2>Nenhuma escala criada para esta semana</h2>
            <p>Crie ou importe a escala e rode a validação antes de publicar.</p>
          </div>
          <Link className="pending-cta" to="/app/schedules">
            Abrir escalas
          </Link>
        </section>
      )}

      {schedule && (
        <>
          <section className="step-tracker">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`step ${index === currentStep ? "current" : ""} ${index < currentStep ? "done" : ""}`}
              >
                <span className="step-index">{index < currentStep ? <Check size={13} /> : index + 1}</span>
                {label}
              </div>
            ))}
          </section>

          {currentStep === 0 && (
            <section className="import-callout">
              <div>
                <p className="eyebrow">VALIDAÇÃO PENDENTE</p>
                <h2>Esta revisão ainda não passou pela validação autoritativa</h2>
                <p>Rode "Validar escala" na tela de Escalas antes de enviar para aprovação.</p>
              </div>
              <Link className="pending-cta" to="/app/schedules">
                Validar escala
              </Link>
            </section>
          )}

          {currentStep > 0 && schedule.status !== "published" && (
            <section className="publication-card">
              <h2>Resumo da publicação</h2>
              <dl className="publication-summary">
                <div>
                  <dt>Período</dt>
                  <dd>{weekRangeLabel(weekStart)}</dd>
                </div>
                <div>
                  <dt>Setores</dt>
                  <dd>{sectors.length || "—"}</dd>
                </div>
                <div>
                  <dt>Colaboradores</dt>
                  <dd>{people}</dd>
                </div>
                <div>
                  <dt>Conflitos críticos</dt>
                  <dd className={critical ? "danger" : ""}>{critical}</dd>
                </div>
                <div>
                  <dt>Alertas em aberto</dt>
                  <dd>{warnings}</dd>
                </div>
                <div>
                  <dt>Revisão</dt>
                  <dd>{schedule.revision}</dd>
                </div>
              </dl>

              {currentStep === 1 && (
                <div className="publication-actions">
                  <p className="publication-hint">
                    A escala passou na validação autoritativa. Envie para aprovação do gerente ou administrador antes de publicar.
                  </p>
                  <button className="solid" disabled={actionState === "working"} onClick={submit}>
                    <ShieldCheck size={16} />
                    {actionState === "working" ? "Enviando..." : "Enviar para aprovação"}
                  </button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="publication-actions">
                  <p className="publication-hint">Aguardando decisão de um gerente ou administrador da loja.</p>
                  {!showReject ? (
                    <div className="publication-decision">
                      <button className="solid" disabled={actionState === "working"} onClick={() => decide("approved")}>
                        <Check size={16} />
                        Aprovar
                      </button>
                      <button className="outline" disabled={actionState === "working"} onClick={() => setShowReject(true)}>
                        <X size={16} />
                        Reprovar
                      </button>
                    </div>
                  ) : (
                    <div className="conflict-accept-form">
                      <input
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Motivo da reprovação"
                        autoFocus
                      />
                      <button className="solid" disabled={actionState === "working"} onClick={() => decide("rejected")}>
                        Confirmar
                      </button>
                      <button className="outline" onClick={() => setShowReject(false)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="publication-actions">
                  <p className="publication-hint">
                    Escala aprovada. Publicar congela esta versão e a torna a referência vigente para consulta.
                  </p>
                  <button className="solid" disabled={actionState === "working"} onClick={publish}>
                    <ShieldCheck size={16} />
                    {actionState === "working" ? "Publicando..." : `Publicar versão (revisão ${schedule.revision})`}
                  </button>
                </div>
              )}

              {message && <p className="editor-message error">{message}</p>}
            </section>
          )}

          {schedule.status === "published" && (
            <section className="publication-card published">
              <ShieldCheck size={28} />
              <h2>Escala publicada</h2>
              <p>
                {publishedRevision
                  ? `Nova revisão de trabalho: ${publishedRevision}.`
                  : "Esta escala já está publicada e vigente."}
              </p>
              <p className="publication-hint">
                A versão publicada fica registrada e disponível para consulta. O portal do colaborador ainda está em construção.
              </p>
              <Link className="pending-cta" to="/app/schedules">
                Voltar para escalas
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
