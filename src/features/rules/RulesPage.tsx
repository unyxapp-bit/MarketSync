import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CalendarPlus, ShieldCheck, Trash2 } from "lucide-react";
import {
  addHoliday,
  createRuleSetRevision,
  deleteHoliday,
  loadHolidays,
  loadRuleSets,
  type HolidayRow,
  type RuleRow,
  type RuleSetRow,
} from "../../lib/marketSyncApi";
import { useStore } from "../../shared/StoreContext";
import { PageHero } from "../../shared/ui/PageHero";

const statusToneClass: Record<string, string> = {
  good: "bg-brand-soft text-brand-dark",
  bad: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-line-soft text-muted",
};
const decisionClass = "justify-self-start rounded-[6px] py-[5px] px-2 text-[10px] font-bold tracking-[-0.01em]";
const cardClass = "mt-5 max-w-[780px] p-[22px] bg-surface border border-line rounded-md shadow-xs";
const cardHeadingClass = "text-[14px] mb-4 m-0 text-[#2b394e]";
const hintClass = "text-[12px] text-[#667085] leading-[1.5] mb-3";
const revisionFormClass = "flex items-end gap-3";
const revisionLabelClass = "grid gap-[5px] text-[10px] font-bold text-[#667085] uppercase tracking-[0.3px]";
const revisionInputClass = "h-[38px] border border-[#dce3e8] rounded-[6px] px-[10px] text-[13px]";
const revisionButtonClass =
  "h-[38px] px-[14px] rounded-[7px] text-[12px] font-bold inline-flex items-center gap-[7px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50";
const tableWrapClass = "border border-[#e1e6eb] rounded-[9px] bg-white overflow-auto";
const headRowBase =
  "min-w-0 grid items-center h-[38px] bg-[#f8fafb] text-[#8490a0] text-[10px] font-extrabold uppercase tracking-[0.35px]";
const dataRowBase = "min-w-0 grid items-center min-h-[53px] border-t border-[#edf0f2] first:border-t-0";

const severityLabel: Record<RuleRow["severity"], string> = {
  critical: "Crítico",
  warning: "Alerta",
  info: "Info",
};
const severityTone: Record<RuleRow["severity"], string> = {
  critical: "bad",
  warning: "warn",
  info: "neutral",
};

// The API stores rule codes and parameter keys as technical identifiers (they're also what the
// validate-schedule Edge Function matches on), so this maps them to the plain-language labels RH
// actually reads on this screen. Any code/key without an entry here just falls back to itself.
const ruleLabel: Record<string, string> = {
  INTERJOURNEY_MIN: "Interjornada mínima",
  SEGMENT_OVERLAP: "Sobreposição de turnos",
  WEEKLY_REST_WINDOW: "Folga obrigatória",
  SUNDAY_REST_AROUND: "Folga em torno do domingo",
  SUNDAY_REST_ROTATION: "Rodízio de domingos trabalhados",
  INTRADAY_BREAK: "Intervalo intrajornada",
  DAILY_MINUTES: "Carga diária máxima",
  WEEKLY_MINUTES: "Carga semanal máxima",
  EMPLOYEE_UNAVAILABLE: "Restrição de disponibilidade",
  SECTOR_COVERAGE: "Cobertura mínima por setor",
  HOLIDAY_AUTHORIZATION: "Autorização em feriado",
  SUNDAY_REST_ROTATION_WOMEN: "Rodízio de domingos (colaboradoras)",
};

const paramLabel: Record<string, string> = {
  minimum_minutes: "Mínimo (min)",
  maximum_consecutive_days: "Máx. dias seguidos",
  pre_days: "Folga antes (dias)",
  post_days: "Folga depois (dias)",
  window_weeks: "Janela (semanas)",
  maximum_worked_sundays: "Máx. domingos trabalhados",
  threshold_over_hours: "Acima de (h) → intervalo maior",
  threshold_partial_hours: "Acima de (h) → intervalo parcial",
  minimum_break_over_minutes: "Intervalo maior (min)",
  minimum_break_partial_minutes: "Intervalo parcial (min)",
  maximum_minutes: "Máximo (min)",
  tolerance_minutes: "Tolerância (min)",
  default_weekly_minutes: "Padrão sem contrato (min)",
};

type EditableRule = RuleRow & { paramsDraft: Record<string, string> };

const draftFromRule = (rule: RuleRow): EditableRule => ({
  ...rule,
  paramsDraft: Object.fromEntries(
    Object.entries(rule.parameters ?? {}).map(([key, value]) => [key, String(value)]),
  ),
});

export function RulesPage() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [ruleSets, setRuleSets] = useState<RuleSetRow[]>([]);
  const [active, setActive] = useState<RuleSetRow | null>(null);
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "saving">("saving");
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [holidayMessage, setHolidayMessage] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  const refresh = useCallback(() => {
    if (!store) return;
    setLoading(true);
    loadRuleSets(store.id)
      .then(({ ruleSets, active, rules }) => {
        setRuleSets(ruleSets);
        setActive(active);
        setRules(rules.map(draftFromRule));
      })
      .catch(() => {
        setMessageTone("error");
        setMessage("Não foi possível carregar as regras de conformidade.");
      })
      .finally(() => setLoading(false));
  }, [store]);

  const refreshHolidays = useCallback(() => {
    if (!store) return;
    loadHolidays(store.organizationId).then(setHolidays).catch(() => setHolidays([]));
  }, [store]);

  useEffect(refresh, [refresh]);
  useEffect(refreshHolidays, [refreshHolidays]);

  const submitHoliday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store) return;
    const data = new FormData(event.currentTarget);
    setSavingHoliday(true);
    setHolidayMessage("");
    try {
      await addHoliday(store.organizationId, String(data.get("date")), String(data.get("name")));
      event.currentTarget.reset();
      refreshHolidays();
    } catch (error) {
      setHolidayMessage(
        error instanceof Error && error.message.includes("owner")
          ? "Apenas o administrador ou RH/DP pode gerenciar o calendário de feriados."
          : "Não foi possível salvar o feriado.",
      );
    } finally {
      setSavingHoliday(false);
    }
  };

  const removeHoliday = async (holidayId: string) => {
    try {
      await deleteHoliday(holidayId);
      refreshHolidays();
    } catch {
      setHolidayMessage("Não foi possível remover o feriado.");
    }
  };

  if (!store) return null;

  const updateParam = (ruleId: string, key: string, value: string) => {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId ? { ...rule, paramsDraft: { ...rule.paramsDraft, [key]: value } } : rule,
      ),
    );
  };

  const submitRevision = async () => {
    if (!active) return;
    if (!effectiveFrom) {
      setMessageTone("error");
      setMessage("Escolha a partir de quando a nova versão passa a valer.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = rules.map((rule) => ({
        code: rule.code,
        severity: rule.severity,
        blocking: rule.blocking,
        legal_basis: rule.legal_basis,
        parameters: Object.fromEntries(
          Object.entries(rule.paramsDraft).map(([key, value]) => [key, Number(value)]),
        ),
      }));
      await createRuleSetRevision(active.id, effectiveFrom, payload);
      setMessageTone("saving");
      setMessage("Nova versão criada. A versão anterior fica preservada no histórico.");
      setEffectiveFrom("");
      refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error && error.message.includes("owner")
          ? "Apenas o administrador (owner) da organização pode criar uma nova versão de regras."
          : error instanceof Error && error.message.includes("effect after")
            ? "A nova versão precisa valer a partir de uma data depois da vigência atual."
            : "Não foi possível criar a nova versão.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="ADMINISTRADOR E RH"
        title="Regras de conformidade"
        subtitle={
          active
            ? `${active.name} · versão ${active.version} · vigente desde ${active.effective_from}`
            : "Nenhum perfil de regras cadastrado para esta organização."
        }
      />

      {!loading && active && (
        <>
          <section className={cardClass}>
            {rules.map((rule) => (
              <article key={rule.id} className="p-[16px_18px] border-t border-[#edf0f2] first:border-t-0 first:pt-0">
                <div className="flex items-center gap-[10px] mb-[10px]">
                  <span className={`${decisionClass} ${statusToneClass[severityTone[rule.severity]]}`}>
                    {severityLabel[rule.severity]}
                  </span>
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[13px] font-bold text-[#2b394e]">{ruleLabel[rule.code] ?? rule.code}</span>
                    <code className="text-[10px] font-semibold font-mono text-[#9aa6b5] tracking-[0.2px]">
                      {rule.code}
                    </code>
                  </div>
                  {rule.blocking && (
                    <span className="rounded-[6px] py-[3px] px-2 bg-[#fce9e6] text-[#a63e35] text-[9px] font-bold tracking-[-0.01em]">
                      BLOQUEIA
                    </span>
                  )}
                  {rule.legal_basis && <span className="ml-auto text-[11px] text-[#8590a0]">{rule.legal_basis}</span>}
                </div>
                <div className="flex flex-wrap gap-[14px]">
                  {Object.entries(rule.paramsDraft).length === 0 && (
                    <span className="text-[11px] text-[#9aa6b5]">Sem parâmetros configuráveis</span>
                  )}
                  {Object.entries(rule.paramsDraft).map(([key, value]) => (
                    <label
                      key={key}
                      className="grid gap-1 text-[10px] font-bold text-[#667085] uppercase tracking-[0.3px]"
                    >
                      {paramLabel[key] ?? key}
                      <input
                        type="number"
                        value={value}
                        onChange={(event) => updateParam(rule.id, key, event.target.value)}
                        className="h-[34px] w-[120px] border border-[#dce3e8] rounded-[6px] px-[9px] text-[13px] text-[#253247] normal-case tracking-normal font-normal"
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className={cardClass}>
            <h2 className={cardHeadingClass}>Nova versão</h2>
            <p className={hintClass}>
              Editar os parâmetros acima e salvar cria uma nova versão vigente a partir da data
              escolhida; a versão atual continua no histórico e a validação sempre registra qual
              versão exata foi usada.
            </p>
            <div className={revisionFormClass}>
              <label className={revisionLabelClass}>
                Vigente a partir de
                <input
                  type="date"
                  value={effectiveFrom}
                  min={active.effective_from}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className={revisionInputClass}
                />
              </label>
              <button className={revisionButtonClass} disabled={saving} onClick={submitRevision}>
                <ShieldCheck size={16} />
                {saving ? "Salvando..." : "Criar nova versão"}
              </button>
            </div>
            {message && (
              <p
                className={`text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] ${
                  messageTone === "error" ? "bg-[#fff1ef] text-[#b23d34]" : "bg-[#eff8f3] text-[#196d58]"
                }`}
              >
                {message}
              </p>
            )}
          </section>
        </>
      )}

      <section className={cardClass}>
        <h2 className={cardHeadingClass}>Calendário de feriados</h2>
        <p className={hintClass}>
          Datas cadastradas aqui alimentam a regra HOLIDAY_AUTHORIZATION: um turno agendado num
          feriado sem autorização marcada na escala gera um alerta de conformidade.
        </p>
        <form className={revisionFormClass} onSubmit={submitHoliday}>
          <label className={revisionLabelClass}>
            Data
            <input required name="date" type="date" className={revisionInputClass} />
          </label>
          <label className={revisionLabelClass}>
            Nome do feriado
            <input
              required
              name="name"
              type="text"
              placeholder="Ex.: Dia do Comerciário"
              className={revisionInputClass}
            />
          </label>
          <button className={revisionButtonClass} disabled={savingHoliday} type="submit">
            <CalendarPlus size={16} />
            {savingHoliday ? "Salvando..." : "Adicionar feriado"}
          </button>
        </form>
        {holidayMessage && (
          <p className="text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] bg-[#fff1ef] text-[#b23d34]">
            {holidayMessage}
          </p>
        )}
        {holidays.length > 0 && (
          <div className={`${tableWrapClass} mt-4`}>
            <div className={`${headRowBase} grid-cols-[90px_1fr_100px]`}>
              <span className="pl-4">Data</span>
              <span>Feriado</span>
              <span></span>
            </div>
            {holidays.map((holiday) => (
              <div className={`${dataRowBase} grid-cols-[90px_1fr_100px]`} key={holiday.id}>
                <strong className="pl-4 text-[12px] text-[#314056]">{holiday.date}</strong>
                <span>{holiday.name}</span>
                <button
                  className="outline"
                  type="button"
                  aria-label={`Remover ${holiday.name}`}
                  onClick={() => removeHoliday(holiday.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!loading && ruleSets.length > 1 && (
        <section className={cardClass}>
          <h2 className={cardHeadingClass}>Histórico de versões</h2>
          <div className={tableWrapClass}>
            <div className={`${headRowBase} grid-cols-[90px_1fr_100px]`}>
              <span className="pl-4">Versão</span>
              <span>Vigência</span>
              <span>Estado</span>
            </div>
            {ruleSets.map((ruleSet) => (
              <div className={`${dataRowBase} grid-cols-[90px_1fr_100px]`} key={ruleSet.id}>
                <strong className="pl-4 text-[12px] text-[#314056]">v{ruleSet.version}</strong>
                <span>
                  {ruleSet.effective_from} {ruleSet.effective_to ? `– ${ruleSet.effective_to}` : "em diante"}
                </span>
                <span
                  className={`${decisionClass} ${
                    ruleSet.id === active?.id ? statusToneClass.good : statusToneClass.neutral
                  }`}
                >
                  {ruleSet.id === active?.id ? "Ativa" : "Expirada"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
