import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Mail, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { getStoreSectors, getStoreTeam, inviteStoreMember, updateStoreMember } from "../lib/marketSyncApi";

const boxClass = "bg-white border border-[#e1e6eb] rounded-[10px] p-[17px]";
const boxHeadingClass = "text-[14px] mb-[13px] m-0 text-[#2b394e]";
const editShiftClass =
  "border border-[#dce5e1] bg-white rounded-[5px] text-[#397763] p-1 grid place-items-center hover:bg-[#eef8f3]";
const emptyClass = "text-[11px] text-[#68778a] m-0";
const outlineActionBtn = "h-8 px-[10px] rounded-[6px] text-[11px] font-bold inline-flex items-center gap-[5px] bg-surface border border-line text-ink-soft hover:border-[#c7cfda] hover:bg-[#fafbfc] disabled:opacity-50";
const solidActionBtn = "h-8 px-[10px] rounded-[6px] text-[11px] font-bold inline-flex items-center gap-[5px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50";
const checkLabelClass = "text-[11px] font-medium flex items-center gap-[5px]";

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
    <section className="mt-[42px] p-[26px] bg-surface border border-line rounded-md shadow-xs" id="team">
      <div className="flex items-end justify-between mb-[13px]">
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-[7px]">ADMINISTRAÇÃO</p>
          <h2 className="text-[20px] tracking-[-0.5px] m-0 text-ink font-[650]">Equipe e permissões</h2>
          <p className="text-[12px] text-[#748196] mt-[5px] mb-0">
            Convide gestores, RH, fiscais, auditores e colaboradores e limite o acesso por setor.
          </p>
        </div>
        <span className="bg-[#f2f4f7] rounded-full py-[6px] px-[9px] text-[10px] text-[#5e6b7c] font-bold flex gap-1 items-center">
          <ShieldCheck size={13} />
          Acesso por loja
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1.15fr] max-[700px]:grid-cols-1 gap-4">
        <div className={boxClass}>
          <h3 className={boxHeadingClass}>Membros da loja</h3>
          {team.map((member) => (
            <div className="flex gap-[9px] items-center py-[10px] border-t border-[#edf0f2]" key={member.user_id}>
              {editingId === member.user_id ? (
                <div className="grid gap-[9px] w-full">
                  <strong className="text-[12px]">{member.full_name}</strong>
                  <select
                    className="h-[34px] border border-[#dce3e8] rounded-[6px] px-2 text-[12px]"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as MemberRole)}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {roleLabel[option.value]}
                      </option>
                    ))}
                    <option value="owner">Administrador da organização</option>
                  </select>
                  <div className="flex flex-wrap gap-[10px]">
                    {sectors.map((sector) => (
                      <label key={sector.id} className={checkLabelClass}>
                        <input
                          type="checkbox"
                          checked={editSectors.includes(sector.id)}
                          onChange={() => toggleEditSector(sector.id)}
                        />
                        {sector.name}
                      </label>
                    ))}
                  </div>
                  <label className={checkLabelClass}>
                    <input type="checkbox" checked={editCanEdit} onChange={(e) => setEditCanEdit(e.target.checked)} />
                    Pode editar os setores selecionados
                  </label>
                  {editState === "error" && (
                    <p className={emptyClass}>Não foi possível salvar. Você precisa ser gerente da loja.</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button className={outlineActionBtn} type="button" onClick={() => setEditingId(null)}>
                      <X size={13} />
                      Cancelar
                    </button>
                    <button
                      className={solidActionBtn}
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
                  <span className="h-7 w-7 grid place-items-center rounded-full bg-[#e9f3ee] text-[#1d715b] text-[9px] font-extrabold">
                    {member.full_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong className="block text-[12px]">{member.full_name}</strong>
                    <small className="block text-[10px] text-[#748196] mt-[2px]">
                      {roleLabel[member.role] ?? member.role}
                      {member.can_edit_sector ? " · edita setores" : ""}
                    </small>
                  </div>
                  <button
                    className={`ml-auto ${editShiftClass}`}
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
          {!team.length && <p className={emptyClass}>Nenhum membro encontrado.</p>}
        </div>
        <form className={`grid gap-[10px] ${boxClass}`} onSubmit={invite}>
          <h3 className={`flex items-center gap-[6px] ${boxHeadingClass}`}>
            <Plus size={16} />
            Convidar pessoa
          </h3>
          <label className="grid gap-[5px] text-[10px] text-[#4e5d71] font-bold">
            E-mail
            <input
              required
              name="email"
              type="email"
              placeholder="nome@empresa.com"
              className="h-9 border border-[#dce3e8] rounded-[6px] px-[9px] bg-white text-[12px] font-normal"
            />
          </label>
          <label className="grid gap-[5px] text-[10px] text-[#4e5d71] font-bold">
            Papel
            <select
              name="role"
              defaultValue="employee"
              className="h-9 border border-[#dce3e8] rounded-[6px] px-[9px] bg-white text-[12px] font-normal"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-[5px] border-0 p-0 m-0 text-[10px] text-[#4e5d71] font-bold">
            <legend className="col-span-full mb-[3px]">Setores autorizados</legend>
            {sectors.map((sector) => (
              <label key={sector.id} className={checkLabelClass}>
                <input name="sectors" value={sector.id} type="checkbox" />
                {sector.name}
              </label>
            ))}
          </fieldset>
          <label className={checkLabelClass}>
            <input name="canEdit" type="checkbox" />
            Pode editar os setores selecionados
          </label>
          {message && <p className={emptyClass}>{message}</p>}
          <button
            className="h-[37px] flex gap-[6px] justify-center items-center rounded-[6px] border-0 bg-brand text-white font-bold hover:bg-brand-dark disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            <Mail size={16} />
            {loading ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
      </div>
    </section>
  );
}
