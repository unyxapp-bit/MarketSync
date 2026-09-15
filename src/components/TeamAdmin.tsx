import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Mail, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { getStoreSectors, getStoreTeam, inviteStoreMember, updateStoreMember } from "../lib/marketSyncApi";

type TeamMember = { user_id: string; full_name: string; role: string; sector_ids: string[]; can_edit_sector: boolean };
type Sector = { id: string; name: string };
type InviteRole = "manager" | "supervisor" | "employee" | "rh" | "auditor";
type MemberRole = "owner" | InviteRole;

const roleLabel: Record<string, string> = {
  owner: "Administrador da organização",
  manager: "Gerente",
  rh: "RH / DP",
  supervisor: "Fiscal/encarregado (setorial)",
  auditor: "Auditor (somente leitura)",
  employee: "Colaborador",
};

const roleOptions: Array<{ value: InviteRole; label: string }> = [
  { value: "employee", label: "Colaborador · consulta própria" },
  { value: "supervisor", label: "Fiscal/encarregado · escopo setorial" },
  { value: "auditor", label: "Auditor · somente leitura" },
  { value: "rh", label: "RH/DP · regras, aprovação e colaboradores" },
  { value: "manager", label: "Gerente · loja inteira" },
];

export function TeamAdmin({ storeId }: { storeId: string }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("employee");
  const [editSectors, setEditSectors] = useState<string[]>([]);
  const [editCanEdit, setEditCanEdit] = useState(false);
  const [editState, setEditState] = useState<"idle" | "saving" | "error">("idle");

  const refresh = () => {
    getStoreTeam(storeId)
      .then(setTeam)
      .catch(() => setMessage("Você não possui permissão de gerente para administrar a equipe."));
    getStoreSectors(storeId).then(setSectors);
  };
  useEffect(refresh, [storeId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await inviteStoreMember({
        storeId,
        email: String(data.get("email")),
        role: String(data.get("role")) as InviteRole,
        sectorIds: data.getAll("sectors").map(String),
        canEditSector: data.get("canEdit") === "on",
      });
      setMessage("Convite enviado e acesso configurado.");
      event.currentTarget.reset();
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (member: TeamMember) => {
    setEditingId(member.user_id);
    setEditRole((member.role as MemberRole) ?? "employee");
    setEditSectors(member.sector_ids);
    setEditCanEdit(member.can_edit_sector);
    setEditState("idle");
  };

  const toggleEditSector = (sectorId: string) => {
    setEditSectors((current) =>
      current.includes(sectorId) ? current.filter((id) => id !== sectorId) : [...current, sectorId],
    );
  };

  const saveEdit = async (userId: string) => {
    setEditState("saving");
    try {
      await updateStoreMember({ storeId, userId, role: editRole, sectorIds: editSectors, canEdit: editCanEdit });
      setEditingId(null);
      refresh();
    } catch {
      setEditState("error");
    }
  };

  return (
    <section className="team-admin" id="team">
      <div className="audit-title">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h2>Equipe e permissões</h2>
          <p>Convide gestores, RH, fiscais, auditores e colaboradores e limite o acesso por setor.</p>
        </div>
        <span className="audit-rule">
          <ShieldCheck size={13} />
          Acesso por loja
        </span>
      </div>
      <div className="team-grid">
        <div className="team-list">
          <h3>Membros da loja</h3>
          {team.map((member) => (
            <div className="team-member" key={member.user_id}>
              {editingId === member.user_id ? (
                <div className="team-edit-form">
                  <strong>{member.full_name}</strong>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as MemberRole)}>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {roleLabel[option.value]}
                      </option>
                    ))}
                    <option value="owner">Administrador da organização</option>
                  </select>
                  <div className="team-edit-sectors">
                    {sectors.map((sector) => (
                      <label key={sector.id} className="check">
                        <input
                          type="checkbox"
                          checked={editSectors.includes(sector.id)}
                          onChange={() => toggleEditSector(sector.id)}
                        />
                        {sector.name}
                      </label>
                    ))}
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={editCanEdit} onChange={(e) => setEditCanEdit(e.target.checked)} />
                    Pode editar os setores selecionados
                  </label>
                  {editState === "error" && (
                    <p className="invite-message">Não foi possível salvar. Você precisa ser gerente da loja.</p>
                  )}
                  <div className="team-edit-actions">
                    <button className="outline" type="button" onClick={() => setEditingId(null)}>
                      <X size={13} />
                      Cancelar
                    </button>
                    <button
                      className="solid"
                      type="button"
                      disabled={editState === "saving"}
                      onClick={() => saveEdit(member.user_id)}
                    >
                      {editState === "saving" ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span>{member.full_name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{member.full_name}</strong>
                    <small>
                      {roleLabel[member.role] ?? member.role}
                      {member.can_edit_sector ? " · edita setores" : ""}
                    </small>
                  </div>
                  <button
                    className="edit-shift team-edit-trigger"
                    type="button"
                    onClick={() => startEdit(member)}
                    aria-label={`Editar papel de ${member.full_name}`}
                  >
                    <Pencil size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          {!team.length && <p className="empty">Nenhum membro encontrado.</p>}
        </div>
        <form className="invite-form" onSubmit={invite}>
          <h3>
            <Plus size={16} />
            Convidar pessoa
          </h3>
          <label>
            E-mail
            <input required name="email" type="email" placeholder="nome@empresa.com" />
          </label>
          <label>
            Papel
            <select name="role" defaultValue="employee">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Setores autorizados</legend>
            {sectors.map((sector) => (
              <label key={sector.id} className="check">
                <input name="sectors" value={sector.id} type="checkbox" />
                {sector.name}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input name="canEdit" type="checkbox" />
            Pode editar os setores selecionados
          </label>
          {message && <p className="invite-message">{message}</p>}
          <button className="solid" disabled={loading} type="submit">
            <Mail size={16} />
            {loading ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
      </div>
    </section>
  );
}
