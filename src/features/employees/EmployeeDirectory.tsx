import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Search, User, X } from "lucide-react";
import {
  addEmployeeConstraint,
  addEmploymentContract,
  deleteEmployeeConstraint,
  getStoreSectors,
  loadEmployeeConstraints,
  loadEmployeeContracts,
  loadEmployeeDirectory,
  saveEmployee,
  type ConstraintRow,
  type ContractRow,
  type EmployeeDirectoryRow,
} from "../../lib/marketSyncApi";
import { todayIso } from "../../lib/dates";

type Sector = { id: string; name: string };
type StatusFilter = "all" | "active" | "leave" | "terminated";

const statusLabel: Record<EmployeeDirectoryRow["status"], string> = {
  active: "Ativo",
  leave: "Afastado",
  terminated: "Desligado",
};
const statusTone: Record<EmployeeDirectoryRow["status"], string> = {
  active: "good",
  leave: "warn",
  terminated: "neutral",
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type DraftState = {
  employeeId: string | null;
  fullName: string;
  jobTitle: string;
  sectorId: string;
  registration: string;
  weeklyHours: string;
  status: EmployeeDirectoryRow["status"];
};

const emptyDraft: DraftState = {
  employeeId: null,
  fullName: "",
  jobTitle: "",
  sectorId: "",
  registration: "",
  weeklyHours: "44",
  status: "active",
};

export function EmployeeDirectory({ storeId }: { storeId: string }) {
  const [employees, setEmployees] = useState<EmployeeDirectoryRow[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [constraints, setConstraints] = useState<ConstraintRow[]>([]);
  const [newContractStart, setNewContractStart] = useState(todayIso());
  const [newContractHours, setNewContractHours] = useState("44");
  const [newConstraintType, setNewConstraintType] = useState("unavailable");
  const [newConstraintStart, setNewConstraintStart] = useState("");
  const [newConstraintEnd, setNewConstraintEnd] = useState("");
  const [newConstraintNote, setNewConstraintNote] = useState("");

  const refresh = () => {
    loadEmployeeDirectory(storeId).then(setEmployees).catch(() => undefined);
    getStoreSectors(storeId).then(setSectors).catch(() => undefined);
  };

  useEffect(refresh, [storeId]);

  useEffect(() => {
    if (!draft?.employeeId) {
      setContracts([]);
      setConstraints([]);
      return;
    }
    loadEmployeeContracts(draft.employeeId).then(setContracts).catch(() => undefined);
    loadEmployeeConstraints(draft.employeeId).then(setConstraints).catch(() => undefined);
  }, [draft?.employeeId]);

  const visible = employees.filter((employee) => {
    if (statusFilter !== "all" && employee.status !== statusFilter) return false;
    if (search && !employee.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setSaveState("idle");
    setSaveMessage("");
    setDraft({ ...emptyDraft });
  };

  const openEdit = (employee: EmployeeDirectoryRow) => {
    setSaveState("idle");
    setSaveMessage("");
    setDraft({
      employeeId: employee.id,
      fullName: employee.full_name,
      jobTitle: employee.job_title,
      sectorId: employee.sector_id ?? "",
      registration: employee.registration ?? "",
      weeklyHours: String(employee.weekly_hours),
      status: employee.status,
    });
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaveState("saving");
    setSaveMessage("");
    try {
      await saveEmployee({
        employeeId: draft.employeeId,
        storeId,
        sectorId: draft.sectorId || null,
        fullName: draft.fullName,
        jobTitle: draft.jobTitle,
        registration: draft.registration,
        weeklyHours: Number(draft.weeklyHours) || 0,
        status: draft.status,
      });
      setSaveMessage(draft.employeeId ? "Colaborador atualizado." : "Colaborador cadastrado.");
      refresh();
      if (!draft.employeeId) setDraft(null);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error && error.message.includes("registration")
          ? "Já existe um colaborador com essa matrícula nesta loja."
          : "Não foi possível salvar. Confira os campos e tente novamente.",
      );
      return;
    }
    setSaveState("idle");
  };

  const submitNewContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.employeeId) return;
    try {
      await addEmploymentContract(draft.employeeId, newContractStart, Math.round(Number(newContractHours) * 60));
      setContracts(await loadEmployeeContracts(draft.employeeId));
    } catch {
      setSaveMessage("Não foi possível registrar o novo contrato.");
    }
  };

  const submitNewConstraint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.employeeId || !newConstraintStart) return;
    try {
      await addEmployeeConstraint(
        draft.employeeId,
        newConstraintType,
        new Date(newConstraintStart).toISOString(),
        newConstraintEnd ? new Date(newConstraintEnd).toISOString() : null,
        newConstraintNote,
      );
      setConstraints(await loadEmployeeConstraints(draft.employeeId));
      setNewConstraintStart("");
      setNewConstraintEnd("");
      setNewConstraintNote("");
    } catch {
      setSaveMessage("Não foi possível registrar a restrição.");
    }
  };

  const removeConstraint = async (constraintId: string) => {
    if (!draft?.employeeId) return;
    await deleteEmployeeConstraint(constraintId).catch(() => undefined);
    setConstraints(await loadEmployeeConstraints(draft.employeeId));
  };

  return (
    <section className="team-admin" id="directory">
      <div className="audit-title">
        <div>
          <p className="eyebrow">CADASTRO</p>
          <h2>Colaboradores</h2>
          <p>Dados básicos, contrato, carga semanal e restrições de disponibilidade.</p>
        </div>
        <button className="solid directory-add" type="button" onClick={openCreate}>
          <Plus size={15} />
          Novo colaborador
        </button>
      </div>

      <div className="directory-toolbar">
        <label className="search">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" />
        </label>
        <div className="conflict-filters">
          {(
            [
              ["all", "Todos"],
              ["active", "Ativos"],
              ["leave", "Afastados"],
              ["terminated", "Desligados"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-pill ${statusFilter === value ? "active" : ""}`}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="audit-card directory-card">
        <div className="audit-head directory-head">
          <span>Colaborador</span>
          <span>Setor</span>
          <span>Matrícula</span>
          <span>Carga</span>
          <span>Status</span>
        </div>
        {visible.length === 0 && <p className="empty">Nenhum colaborador encontrado.</p>}
        {visible.map((employee) => (
          <button
            type="button"
            className="audit-row directory-row"
            key={employee.id}
            onClick={() => openEdit(employee)}
          >
            <div className="person">
              <span className="person-avatar">
                <User size={13} />
              </span>
              <div>
                <strong>{employee.full_name}</strong>
                <small>{employee.job_title}</small>
              </div>
            </div>
            <span>{firstOf(employee.sectors)?.name ?? "—"}</span>
            <span>{employee.registration ?? "—"}</span>
            <span>{employee.weekly_hours}h</span>
            <span className={`decision ${statusTone[employee.status]}`}>{statusLabel[employee.status]}</span>
          </button>
        ))}
      </div>

      {draft && (
        <div className="editor-backdrop" role="presentation">
          <section className="shift-editor directory-drawer" role="dialog" aria-modal="true">
            <div className="editor-head">
              <div>
                <p className="eyebrow">{draft.employeeId ? "EDITAR" : "NOVO"}</p>
                <h2>{draft.employeeId ? draft.fullName : "Novo colaborador"}</h2>
              </div>
              <button className="editor-close" type="button" onClick={() => setDraft(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitDraft} className="directory-form">
              <label>
                Nome completo
                <input
                  required
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                />
              </label>
              <label>
                Cargo
                <input
                  required
                  value={draft.jobTitle}
                  onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
                />
              </label>
              <div className="directory-form-row">
                <label>
                  Setor
                  <select
                    value={draft.sectorId}
                    onChange={(e) => setDraft({ ...draft, sectorId: e.target.value })}
                  >
                    <option value="">Sem setor</option>
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Matrícula
                  <input
                    value={draft.registration}
                    onChange={(e) => setDraft({ ...draft, registration: e.target.value })}
                  />
                </label>
              </div>
              <div className="directory-form-row">
                <label>
                  Carga semanal (h)
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.weeklyHours}
                    onChange={(e) => setDraft({ ...draft, weeklyHours: e.target.value })}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as EmployeeDirectoryRow["status"] })
                    }
                  >
                    <option value="active">Ativo</option>
                    <option value="leave">Afastado</option>
                    <option value="terminated">Desligado</option>
                  </select>
                </label>
              </div>
              {saveMessage && <p className={`editor-message ${saveState}`}>{saveMessage}</p>}
              <div className="editor-actions">
                <button className="outline" type="button" onClick={() => setDraft(null)}>
                  Fechar
                </button>
                <button className="solid" type="submit" disabled={saveState === "saving"}>
                  {saveState === "saving" ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>

            {draft.employeeId && (
              <>
                <div className="directory-section">
                  <h3>Contratos</h3>
                  {contracts.length === 0 && <p className="empty">Nenhum contrato registrado.</p>}
                  {contracts.map((contract) => (
                    <div className="directory-history-row" key={contract.id}>
                      <span>{contract.start_date}{contract.end_date ? ` – ${contract.end_date}` : " em diante"}</span>
                      <span>{Math.round(contract.weekly_minutes / 60)}h/semana</span>
                    </div>
                  ))}
                  <form className="directory-inline-form" onSubmit={submitNewContract}>
                    <label>
                      Vigência a partir de
                      <input
                        type="date"
                        value={newContractStart}
                        onChange={(e) => setNewContractStart(e.target.value)}
                      />
                    </label>
                    <label>
                      Carga (h/semana)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={newContractHours}
                        onChange={(e) => setNewContractHours(e.target.value)}
                      />
                    </label>
                    <button className="outline" type="submit">
                      Novo contrato
                    </button>
                  </form>
                </div>

                <div className="directory-section">
                  <h3>Restrições de disponibilidade</h3>
                  {constraints.length === 0 && <p className="empty">Nenhuma restrição registrada.</p>}
                  {constraints.map((constraint) => (
                    <div className="directory-history-row" key={constraint.id}>
                      <span>
                        {constraint.type} · {new Date(constraint.start_at).toLocaleString("pt-BR")}
                        {constraint.end_at ? ` – ${new Date(constraint.end_at).toLocaleString("pt-BR")}` : ""}
                        {typeof constraint.payload?.note === "string" && constraint.payload.note
                          ? ` · ${constraint.payload.note}`
                          : ""}
                      </span>
                      <button className="editor-close" type="button" onClick={() => removeConstraint(constraint.id)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <form className="directory-inline-form" onSubmit={submitNewConstraint}>
                    <label>
                      Tipo
                      <select value={newConstraintType} onChange={(e) => setNewConstraintType(e.target.value)}>
                        <option value="unavailable">Indisponibilidade</option>
                        <option value="medical">Restrição médica</option>
                        <option value="study">Compromisso de estudo</option>
                        <option value="other">Outro</option>
                      </select>
                    </label>
                    <label>
                      Início
                      <input
                        required
                        type="datetime-local"
                        value={newConstraintStart}
                        onChange={(e) => setNewConstraintStart(e.target.value)}
                      />
                    </label>
                    <label>
                      Fim (opcional)
                      <input
                        type="datetime-local"
                        value={newConstraintEnd}
                        onChange={(e) => setNewConstraintEnd(e.target.value)}
                      />
                    </label>
                    <label>
                      Observação
                      <input value={newConstraintNote} onChange={(e) => setNewConstraintNote(e.target.value)} />
                    </label>
                    <button className="outline" type="submit">
                      Adicionar restrição
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
