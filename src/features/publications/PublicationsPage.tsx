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
import { PageHero } from "../../shared/ui/PageHero";

const calloutClass =
  "flex items-center justify-between gap-[22px] mb-7 p-[18px_20px] border border-[#cfe7dd] rounded-[10px] bg-[linear-gradient(105deg,#f2fbf6,#fff)] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-3";
const calloutEyebrowClass = "text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-[6px]";
const calloutHeadingClass = "m-0 text-[#294137] text-[17px]";
const calloutTextClass = "max-w-[690px] mt-[6px] text-[#61756c] text-[12px] leading-[1.5]";
const ctaClass = "inline-flex items-center gap-[6px] mt-[14px] text-[#087b61] text-[12px] font-bold no-underline";
const solidBtn =
  "bg-brand border border-brand text-white hover:bg-brand-dark hover:border-brand-dark disabled:opacity-50";
const outlineBtn =
  "bg-surface border border-line text-ink-soft hover:border-[#c7cfda] hover:bg-[#fafbfc] disabled:opacity-50";
const actionBtnBase = "h-[38px] px-[14px] rounded-[7px] text-[12px] font-bold inline-flex items-center gap-[7px]";

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
      <PageHero
        eyebrow="GESTÃO E AUDITOR"
        title="Publicar escala"
        subtitle={<>Validação, revisão, aprovação e publicação · {weekRangeLabel(weekStart)}</>}
      />

      {!loading && !schedule && (
        <section className={calloutClass}>
          <div>
            <p className={calloutEyebrowClass}>SEM ESCALA</p>
            <h2 className={calloutHeadingClass}>Nenhuma escala criada para esta semana</h2>
            <p className={calloutTextClass}>Crie ou importe a escala e rode a validação antes de publicar.</p>
          </div>
          <Link className={ctaClass} to="/app/schedules">
            Abrir escalas
          </Link>
        </section>
      )}

      {schedule && (
        <>
          <section className="flex items-center gap-[10px] my-[26px] bg-surface border border-line rounded-md shadow-xs">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`flex items-center gap-2 text-[12px] font-bold ${
                  index === currentStep ? "text-[#102a43]" : "text-[#9aa6b5]"
                } ${
                  index < steps.length - 1
                    ? "after:content-[''] after:w-[40px] after:h-px after:bg-[#dbe1e6] after:ml-2.5"
                    : ""
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full grid place-items-center text-[11px] ${
                    index === currentStep
                      ? "bg-brand text-white"
                      : index < currentStep
                        ? "bg-[#d9f0e6] text-[#11765a]"
                        : "bg-[#eef1f3] text-[#7d8999]"
                  }`}
                >
                  {index < currentStep ? <Check size={13} /> : index + 1}
                </span>
                {label}
              </div>
            ))}
          </section>

          {currentStep === 0 && (
            <section className={calloutClass}>
              <div>
                <p className={calloutEyebrowClass}>VALIDAÇÃO PENDENTE</p>
                <h2 className={calloutHeadingClass}>Esta revisão ainda não passou pela validação autoritativa</h2>
                <p className={calloutTextClass}>Rode "Validar escala" na tela de Escalas antes de enviar para aprovação.</p>
              </div>
              <Link className={ctaClass} to="/app/schedules">
                Validar escala
              </Link>
            </section>
          )}

          {currentStep > 0 && schedule.status !== "published" && (
            <section className="bg-surface border border-line rounded-md shadow-xs p-[22px] max-w-[620px]">
              <h2 className="text-[14px] mb-4 m-0 text-[#2b394e]">Resumo da publicação</h2>
              <dl className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Período</dt>
                  <dd className="text-[16px] font-bold text-[#253247] m-0">{weekRangeLabel(weekStart)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Setores</dt>
                  <dd className="text-[16px] font-bold text-[#253247] m-0">{sectors.length || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Colaboradores</dt>
                  <dd className="text-[16px] font-bold text-[#253247] m-0">{people}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Conflitos críticos</dt>
                  <dd className={`text-[16px] font-bold m-0 ${critical ? "text-[#b23d34]" : "text-[#253247]"}`}>{critical}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Alertas em aberto</dt>
                  <dd className="text-[16px] font-bold text-[#253247] m-0">{warnings}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.4px] text-[#8590a0] mb-[3px]">Revisão</dt>
                  <dd className="text-[16px] font-bold text-[#253247] m-0">{schedule.revision}</dd>
                </div>
              </dl>

              {currentStep === 1 && (
                <div className="border-t border-[#edf0f2] pt-4">
                  <p className="text-[12px] text-[#667085] leading-[1.5] mb-3">
                    A escala passou na validação autoritativa. Envie para aprovação do gerente ou administrador antes de publicar.
                  </p>
                  <button className={`${actionBtnBase} ${solidBtn}`} disabled={actionState === "working"} onClick={submit}>
                    <ShieldCheck size={16} />
                    {actionState === "working" ? "Enviando..." : "Enviar para aprovação"}
                  </button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="border-t border-[#edf0f2] pt-4">
                  <p className="text-[12px] text-[#667085] leading-[1.5] mb-3">Aguardando decisão de um gerente ou administrador da loja.</p>
                  {!showReject ? (
                    <div className="flex gap-[10px]">
                      <button className={`${actionBtnBase} ${solidBtn}`} disabled={actionState === "working"} onClick={() => decide("approved")}>
                        <Check size={16} />
                        Aprovar
                      </button>
                      <button className={`${actionBtnBase} ${outlineBtn}`} disabled={actionState === "working"} onClick={() => setShowReject(true)}>
                        <X size={16} />
                        Reprovar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-[10px]">
                      <input
                        className="flex-1 h-[34px] border border-[#dce3e8] rounded-[6px] px-[10px] text-[12px]"
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Motivo da reprovação"
                        autoFocus
                      />
                      <button
                        className="h-[34px] px-[11px] rounded-[6px] text-[11px] inline-flex items-center gap-[5px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50"
                        disabled={actionState === "working"}
                        onClick={() => decide("rejected")}
                      >
                        Confirmar
                      </button>
                      <button
                        className="h-[34px] px-[11px] rounded-[6px] text-[11px] inline-flex items-center gap-[5px] bg-surface border border-line text-ink-soft hover:bg-[#fafbfc]"
                        onClick={() => setShowReject(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="border-t border-[#edf0f2] pt-4">
                  <p className="text-[12px] text-[#667085] leading-[1.5] mb-3">
                    Escala aprovada. Publicar congela esta versão e a torna a referência vigente para consulta.
                  </p>
                  <button className={`${actionBtnBase} ${solidBtn}`} disabled={actionState === "working"} onClick={publish}>
                    <ShieldCheck size={16} />
                    {actionState === "working" ? "Publicando..." : `Publicar versão (revisão ${schedule.revision})`}
                  </button>
                </div>
              )}

              {message && (
                <p className="text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] bg-[#fff1ef] text-[#b23d34]">{message}</p>
              )}
            </section>
          )}

          {schedule.status === "published" && (
            <section className="bg-surface border border-line rounded-md shadow-xs p-[22px] max-w-[620px] text-left text-[#11765a] grid gap-[6px] justify-items-start">
              <ShieldCheck size={28} />
              <h2 className="text-[#102a43] text-[20px] mt-[6px] mb-0">Escala publicada</h2>
              <p className="text-[#536174] text-[13px] m-0">
                {publishedRevision
                  ? `Nova revisão de trabalho: ${publishedRevision}.`
                  : "Esta escala já está publicada e vigente."}
              </p>
              <p className="text-[12px] text-[#667085] leading-[1.5] mb-3">
                A versão publicada fica registrada e disponível para consulta. O portal do colaborador ainda está em construção.
              </p>
              <Link className={ctaClass} to="/app/schedules">
                Voltar para escalas
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
