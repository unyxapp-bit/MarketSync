import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Plus, Settings, X } from "lucide-react";
import { createBranchStore } from "../lib/marketSyncApi";
import { useStore } from "./StoreContext";
import { useStoreList } from "./StoreListContext";

export function StoreSwitcher() {
  const store = useStore();
  const list = useStoreList();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!store || !list) {
    return (
      <div className="store-picker">
        <span>Sua loja</span>
        <small>Operação conectada ao Supabase</small>
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    setCreating(false);
    setMessage("");
  };

  const submitBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const created = await createBranchStore({
        organizationId: store.organizationId,
        sourceStoreId: store.id,
        name,
        city,
        state,
      });
      list.refreshStores();
      list.selectStore(created.id);
      setName("");
      setCity("");
      setState("");
      close();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.includes("owner")
          ? "Só o administrador da organização pode criar uma nova filial."
          : "Não foi possível criar a filial.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="store-switcher">
      <button type="button" className="store-picker" onClick={() => setOpen((value) => !value)}>
        <span>{store.name}</span>
        <small>{list.stores.length > 1 ? `${list.stores.length} lojas · trocar` : "Operação conectada ao Supabase"}</small>
        <ChevronDown size={15} />
      </button>
      {open && (
        <>
          <button type="button" className="dropdown-backdrop" aria-label="Fechar" onClick={close} />
          <div className="store-switcher-menu" role="menu">
            {list.stores.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`store-switcher-option ${item.id === store.id ? "active" : ""}`}
                onClick={() => {
                  list.selectStore(item.id);
                  close();
                }}
              >
                <Building2 size={14} />
                {item.name}
              </button>
            ))}
            <div className="store-switcher-divider" />
            {!creating ? (
              <button type="button" className="store-switcher-option" onClick={() => setCreating(true)}>
                <Plus size={14} />
                Nova filial
              </button>
            ) : (
              <form className="store-switcher-form" onSubmit={submitBranch}>
                <div className="store-switcher-form-head">
                  <span>Nova filial</span>
                  <button type="button" onClick={() => setCreating(false)} aria-label="Cancelar">
                    <X size={13} />
                  </button>
                </div>
                <input required placeholder="Nome da filial" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="store-switcher-form-row">
                  <input placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
                  <input
                    placeholder="UF"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
                {message && <p className="store-switcher-message">{message}</p>}
                <button className="solid" type="submit" disabled={saving}>
                  {saving ? "Criando..." : "Criar filial"}
                </button>
              </form>
            )}
            <button
              type="button"
              className="store-switcher-option"
              onClick={() => {
                close();
                navigate("/app/settings");
              }}
            >
              <Settings size={14} />
              Configurações da loja
            </button>
          </div>
        </>
      )}
    </div>
  );
}
