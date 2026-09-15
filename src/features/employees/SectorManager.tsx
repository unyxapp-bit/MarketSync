import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { addSector, deleteSector, getStoreSectors, updateSector, type SectorRow } from "../../lib/marketSyncApi";

const boxClass = "bg-white border border-[#e1e6eb] rounded-[10px] p-[17px]";
const boxHeadingClass = "text-[14px] mb-[13px] m-0 text-[#2b394e]";
const editShiftClass =
  "border border-[#dce5e1] bg-white rounded-[5px] text-[#397763] p-1 grid place-items-center hover:bg-[#eef8f3]";
const emptyClass = "text-[11px] text-[#68778a] m-0";
const outlineActionBtn = "h-8 px-[10px] rounded-[6px] text-[11px] font-bold inline-flex items-center gap-[5px] bg-surface border border-line text-ink-soft hover:border-[#c7cfda] hover:bg-[#fafbfc] disabled:opacity-50";
const solidActionBtn = "h-8 px-[10px] rounded-[6px] text-[11px] font-bold inline-flex items-center gap-[5px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50";

export function SectorManager({ storeId }: { storeId: string }) {
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#167b62");
  const [editState, setEditState] = useState<"idle" | "saving" | "error">("idle");
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    getStoreSectors(storeId)
      .then(setSectors)
      .catch(() => setMessage("Não foi possível carregar os setores."));
  };
  useEffect(refresh, [storeId]);

  const startEdit = (sector: SectorRow) => {
    setEditingId(sector.id);
    setEditName(sector.name);
    setEditColor(sector.color);
    setEditState("idle");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setEditState("saving");
    try {
      await updateSector(editingId, editName, editColor);
      setEditingId(null);
      refresh();
    } catch (error) {
      setEditState("error");
      setMessage(
        error instanceof Error && error.message.includes("duplicate")
          ? "Já existe um setor com esse nome nesta loja."
          : `Não foi possível salvar${error instanceof Error ? `: ${error.message}` : "."}`,
      );
    }
  };

  const remove = async (sector: SectorRow) => {
    if (!window.confirm(`Remover o setor "${sector.name}"? Colaboradores ligados a ele ficam sem setor.`)) return;
    try {
      await deleteSector(sector.id);
      refresh();
    } catch (error) {
      setMessage(`Não foi possível remover o setor${error instanceof Error ? `: ${error.message}` : "."}`);
    }
  };

  const submitNew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdding(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await addSector(storeId, String(data.get("name")));
      event.currentTarget.reset();
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.includes("duplicate")
          ? "Já existe um setor com esse nome nesta loja."
          : `Não foi possível criar o setor${error instanceof Error ? `: ${error.message}` : "."}`,
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="mt-[42px] p-[26px] bg-surface border border-line rounded-md shadow-xs" id="sectors">
      <div className="flex items-end justify-between mb-[13px]">
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-[7px]">CADASTRO</p>
          <h2 className="text-[20px] tracking-[-0.5px] m-0 text-ink font-[650]">Setores</h2>
          <p className="text-[12px] text-[#748196] mt-[5px] mb-0">
            Usados para escalar colaboradores, organizar a grade de Escalas e a cobertura mínima em Regras.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1.15fr] max-[700px]:grid-cols-1 gap-4">
        <div className={boxClass}>
          <h3 className={`flex items-center gap-[6px] ${boxHeadingClass}`}>
            <Layers size={14} /> Setores da loja
          </h3>
          {sectors.map((sector) => (
            <div className="flex gap-[9px] items-center py-[10px] border-t border-[#edf0f2]" key={sector.id}>
              {editingId === sector.id ? (
                <div className="grid gap-[9px] w-full">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-[34px] w-[34px] p-0.5 border border-[#dce3e8] rounded-[6px] bg-transparent cursor-pointer"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      aria-label="Cor do setor"
                    />
                    <input
                      className="flex-1 h-[34px] border border-[#dce3e8] rounded-[6px] px-[9px] text-[12px]"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  {editState === "error" && <p className={emptyClass}>{message}</p>}
                  <div className="flex justify-end gap-2">
                    <button className={outlineActionBtn} type="button" onClick={() => setEditingId(null)}>
                      <X size={13} />
                      Cancelar
                    </button>
                    <button className={solidActionBtn} type="button" disabled={editState === "saving"} onClick={saveEdit}>
                      {editState === "saving" ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span
                    className="h-[18px] w-[18px] rounded-full shrink-0 shadow-[inset_0_0_0_2px_#fff,0_0_0_1px_#e1e6eb]"
                    style={{ background: sector.color }}
                  />
                  <div>
                    <strong className="block text-[12px]">{sector.name}</strong>
                  </div>
                  <button
                    className={`ml-auto ${editShiftClass}`}
                    type="button"
                    onClick={() => startEdit(sector)}
                    aria-label={`Editar setor ${sector.name}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className={editShiftClass}
                    type="button"
                    onClick={() => remove(sector)}
                    aria-label={`Remover setor ${sector.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          {!sectors.length && <p className={emptyClass}>Nenhum setor cadastrado.</p>}
        </div>
        <form className={`grid gap-[10px] ${boxClass}`} onSubmit={submitNew}>
          <h3 className={`flex items-center gap-[6px] ${boxHeadingClass}`}>
            <Plus size={16} />
            Novo setor
          </h3>
          <label className="grid gap-[5px] text-[10px] text-[#4e5d71] font-bold">
            Nome
            <input
              required
              name="name"
              placeholder="Ex.: Padaria"
              className="h-9 border border-[#dce3e8] rounded-[6px] px-[9px] bg-white text-[12px] font-normal"
            />
          </label>
          {message && editingId === null && <p className={emptyClass}>{message}</p>}
          <button
            className="h-[37px] flex gap-[6px] justify-center items-center rounded-[6px] border-0 bg-brand text-white font-bold hover:bg-brand-dark disabled:opacity-50"
            disabled={adding}
            type="submit"
          >
            <Plus size={16} />
            {adding ? "Criando..." : "Criar setor"}
          </button>
        </form>
      </div>
    </section>
  );
}
