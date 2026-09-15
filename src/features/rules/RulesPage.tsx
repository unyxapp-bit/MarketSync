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
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">ADMINISTRADOR E RH</p>
          <h1>Regras de conformidade</h1>
          <p className="subtitle">
            {active
              ? `${active.name} · versão ${active.version} · vigente desde ${active.effective_from}`
              : "Nenhum perfil de regras cadastrado para esta organização."}
          </p>
        </div>
      </section>

      {!loading && active && (
        <>
          <section className="conflict-card rules-card">
            {rules.map((rule) => (
              <article key={rule.id} className="rule-row">
                <div className="rule-head">
                  <span className={`status ${severityTone[rule.severity]}`}>{severityLabel[rule.severity]}</span>
                  <div className="rule-title">
                    <span className="rule-title-name">{ruleLabel[rule.code] ?? rule.code}</span>
                    <code className="rule-title-code">{rule.code}</code>
                  </div>
                  {rule.blocking && <span className="rule-blocking">BLOQUEIA</span>}
                  {rule.legal_basis && <span className="rule-basis">{rule.legal_basis}</span>}
                </div>
                <div className="rule-params">
                  {Object.entries(rule.paramsDraft).length === 0 && (
                    <span className="rule-no-params">Sem parâmetros configuráveis</span>
                  )}
                  {Object.entries(rule.paramsDraft).map(([key, value]) => (
                    <label key={key} className="rule-param">
                      {paramLabel[key] ?? key}
                      <input
                        type="number"
                        value={value}
                        onChange={(event) => updateParam(rule.id, key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className="publication-card rules-revision">
            <h2>Nova versão</h2>
            <p className="publication-hint">
              Editar os parâmetros acima e salvar cria uma nova versão vigente a partir da data
              escolhida; a versão atual continua no histórico e a validação sempre registra qual
              versão exata foi usada.
            </p>
            <div className="rules-revision-form">
              <label>
                Vigente a partir de
                <input
                  type="date"
                  value={effectiveFrom}
                  min={active.effective_from}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </label>
              <button className="solid" disabled={saving} onClick={submitRevision}>
                <ShieldCheck size={16} />
                {saving ? "Salvando..." : "Criar nova versão"}
              </button>
            </div>
            {message && <p className={`editor-message ${messageTone}`}>{message}</p>}
          </section>
        </>
      )}

      <section className="publication-card rules-revision">
        <h2>Calendário de feriados</h2>
        <p className="publication-hint">
          Datas cadastradas aqui alimentam a regra HOLIDAY_AUTHORIZATION: um turno agendado num
          feriado sem autorização marcada na escala gera um alerta de conformidade.
        </p>
        <form className="rules-revision-form" onSubmit={submitHoliday}>
          <label>
            Data
            <input required name="date" type="date" />
          </label>
          <label>
            Nome do feriado
            <input required name="name" type="text" placeholder="Ex.: Dia do Comerciário" />
          </label>
          <button className="solid" disabled={savingHoliday} type="submit">
            <CalendarPlus size={16} />
            {savingHoliday ? "Salvando..." : "Adicionar feriado"}
          </button>
        </form>
        {holidayMessage && <p className="editor-message error">{holidayMessage}</p>}
        {holidays.length > 0 && (
          <div className="audit-card">
            <div className="audit-head rules-history-head">
              <span>Data</span>
              <span>Feriado</span>
              <span></span>
            </div>
            {holidays.map((holiday) => (
              <div className="audit-row rules-history-row" key={holiday.id}>
                <strong>{holiday.date}</strong>
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
        <section className="publication-card rules-history">
          <h2>Histórico de versões</h2>
          <div className="audit-card">
            <div className="audit-head rules-history-head">
              <span>Versão</span>
              <span>Vigência</span>
              <span>Estado</span>
            </div>
            {ruleSets.map((ruleSet) => (
              <div className="audit-row rules-history-row" key={ruleSet.id}>
                <strong>v{ruleSet.version}</strong>
                <span>
                  {ruleSet.effective_from} {ruleSet.effective_to ? `– ${ruleSet.effective_to}` : "em diante"}
                </span>
                <span className={`decision ${ruleSet.id === active?.id ? "good" : "neutral"}`}>
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
