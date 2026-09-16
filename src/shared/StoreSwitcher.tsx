import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Plus, Settings, X } from "lucide-react";
import { createBranchStore } from "../lib/marketSyncApi";
import { useStore } from "./StoreContext";
import { useStoreList } from "./StoreListContext";

const pickerClass =
  "max-[700px]:hidden grid grid-cols-[1fr_auto] gap-x-3 items-start rounded-[9px] min-w-[164px] border-0 border-l border-l-[#e5e7eb] pt-2 pr-5 pb-2 pl-[25px] leading-[1.15] text-xs text-[#263346] bg-transparent cursor-pointer text-left font-inherit";
const optionClass =
  "flex items-center gap-[9px] w-full border-0 bg-transparent rounded-[7px] px-[10px] py-[9px] text-xs text-[#2b394e] text-left cursor-pointer hover:bg-[#f4f7f6]";
const formInputClass = "h-[34px] border border-[#dce3e8] rounded-[6px] px-[9px] text-xs";

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
      <div className={pickerClass}>
        <span className="font-bold">Sua loja</span>
        <small className="col-start-1 text-[#8390a0] text-[10px] mt-1">Operação conectada ao Supabase</small>
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
    <div className="relative">
      <button type="button" className={pickerClass} onClick={() => setOpen((value) => !value)}>
        <span className="font-bold">{store.name}</span>
        <small className="col-start-1 text-[#8390a0] text-[10px] mt-1">
          {list.stores.length > 1 ? `${list.stores.length} lojas · trocar` : "Operação conectada ao Supabase"}
        </small>
        <ChevronDown size={15} className="col-start-2 row-[1/3] self-center text-[#8793a2]" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-0 cursor-default"
            aria-label="Fechar"
            onClick={close}
          />
          <div
            className="absolute top-[calc(100%+8px)] left-[25px] z-[41] w-[260px] bg-white border border-[#e1e6eb] rounded-[10px] shadow-[0_12px_28px_#10182814] p-2 grid gap-0.5"
            role="menu"
          >
            {list.stores.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${optionClass} ${item.id === store.id ? "bg-[#eaf6f0] text-[#167a62] font-bold" : ""}`}
                onClick={() => {
                  list.selectStore(item.id);
                  close();
                }}
              >
                <Building2 size={14} />
                {item.name}
              </button>
            ))}
            <div className="h-px bg-[#edf0f2] my-1.5 mx-0.5" />
            {!creating ? (
              <button type="button" className={optionClass} onClick={() => setCreating(true)}>
                <Plus size={14} />
                Nova filial
              </button>
            ) : (
              <form className="grid gap-2 px-[10px] pt-2 pb-[10px]" onSubmit={submitBranch}>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#4e5d71]">
                  <span>Nova filial</span>
                  <button
                    type="button"
                    className="border-0 bg-transparent text-[#8590a0] cursor-pointer"
                    onClick={() => setCreating(false)}
                    aria-label="Cancelar"
                  >
                    <X size={13} />
                  </button>
                </div>
                <input
                  required
                  placeholder="Nome da filial"
                  className={formInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="grid grid-cols-[1fr_60px] gap-2">
                  <input
                    placeholder="Cidade"
                    className={formInputClass}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <input
                    placeholder="UF"
                    maxLength={2}
                    className={formInputClass}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
                {message && <p className="text-[11px] text-[#b23d34] m-0">{message}</p>}
                <button
                  className="solid h-[34px] rounded-[6px] text-xs font-bold"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Criando..." : "Criar filial"}
                </button>
              </form>
            )}
            <button
              type="button"
              className={optionClass}
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
