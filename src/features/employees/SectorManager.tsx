import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { addSector, deleteSector, getStoreSectors, updateSector, type SectorRow } from "../../lib/marketSyncApi";

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
    <section className="team-admin" id="sectors">
      <div className="audit-title">
        <div>
          <p className="eyebrow">CADASTRO</p>
          <h2>Setores</h2>
          <p>Usados para escalar colaboradores, organizar a grade de Escalas e a cobertura mínima em Regras.</p>
        </div>
      </div>
      <div className="team-grid">
        <div className="team-list">
          <h3>
            <Layers size={14} /> Setores da loja
          </h3>
          {sectors.map((sector) => (
            <div className="team-member" key={sector.id}>
              {editingId === sector.id ? (
                <div className="team-edit-form">
                  <div className="sector-edit-row">
                    <input
                      type="color"
                      className="sector-color-input"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      aria-label="Cor do setor"
                    />
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  {editState === "error" && <p className="invite-message">{message}</p>}
                  <div className="team-edit-actions">
                    <button className="outline" type="button" onClick={() => setEditingId(null)}>
                      <X size={13} />
                      Cancelar
                    </button>
                    <button className="solid" type="button" disabled={editState === "saving"} onClick={saveEdit}>
                      {editState === "saving" ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="sector-swatch" style={{ background: sector.color }} />
                  <div>
                    <strong>{sector.name}</strong>
                  </div>
                  <button
                    className="edit-shift team-edit-trigger"
                    type="button"
                    onClick={() => startEdit(sector)}
                    aria-label={`Editar setor ${sector.name}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="edit-shift"
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
          {!sectors.length && <p className="empty">Nenhum setor cadastrado.</p>}
        </div>
        <form className="invite-form" onSubmit={submitNew}>
          <h3>
            <Plus size={16} />
            Novo setor
          </h3>
          <label>
            Nome
            <input required name="name" placeholder="Ex.: Padaria" />
          </label>
          {message && editingId === null && <p className="invite-message">{message}</p>}
          <button className="solid" disabled={adding} type="submit">
            <Plus size={16} />
            {adding ? "Criando..." : "Criar setor"}
          </button>
        </form>
      </div>
    </section>
  );
}
