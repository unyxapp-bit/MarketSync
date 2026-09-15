import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Store } from "lucide-react";
import { createFirstStore, translateAuthError, updateStore } from "../lib/marketSyncApi";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const values = new FormData(event.currentTarget);
    const city = String(values.get("city") ?? "");
    const state = String(values.get("state") ?? "");
    try {
      const store = await createFirstStore(String(values.get("organization")), String(values.get("store")));
      if (city || state) {
        await updateStore({ storeId: store.id, name: store.name, city, state }).catch(() => undefined);
      }
      onComplete();
    } catch (error) {
      setMessage(
        error instanceof Error ? translateAuthError(error.message) : "Não foi possível criar a loja.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-[42px] border border-[#dce3e8] rounded-[7px] px-[11px] outline-none text-[13px] focus:border-[#48a887] focus:shadow-[0_0_0_3px_#e2f5ed]";
  const labelClass = "grid gap-1.5 text-[11px] font-[750] text-[#435167]";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-[linear-gradient(135deg,#edf8f2,#f9fafb)]">
      <section className="w-full max-w-[410px] p-9 bg-surface border border-line rounded-md shadow-xs">
        <div className="h-[42px] w-[42px] grid place-items-center rounded-xl bg-[#177d62] text-white mb-6">
          <Store size={20} />
        </div>
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-2">CONFIGURAÇÃO INICIAL</p>
        <h1 className="text-[27px] tracking-[-1px] mb-[9px] text-ink font-[650]">Cadastre sua primeira loja</h1>
        <p className="text-[13px] text-[#69778a] leading-[1.5] mb-[22px]">
          Ela será o espaço seguro da sua equipe, setores, escalas e histórico de validações.
        </p>
        <form onSubmit={submit} className="grid gap-[14px]">
          <label className={labelClass}>
            Empresa
            <input required name="organization" placeholder="Ex.: Mercado Central Ltda." className={inputClass} />
          </label>
          <label className={labelClass}>
            Nome da loja
            <input required name="store" placeholder="Ex.: Loja Centro" className={inputClass} />
          </label>
          <div className="grid grid-cols-[1fr_90px] gap-[10px]">
            <label className={labelClass}>
              Cidade (opcional)
              <input name="city" placeholder="Ex.: São Paulo" className={inputClass} />
            </label>
            <label className={labelClass}>
              UF (opcional)
              <select name="state" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {BRAZILIAN_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {message && <div className="text-[11px] leading-[1.4] rounded-[6px] p-[9px] bg-[#fff1ef] text-[#b23d34]">{message}</div>}
          <button
            disabled={loading}
            className="inline-flex items-center justify-center gap-[7px] h-[42px] rounded-[7px] bg-brand border border-brand text-white text-[13px] font-[750] tracking-[-0.01em] transition-colors duration-[120ms] hover:bg-brand-dark hover:border-brand-dark disabled:opacity-[.65] disabled:cursor-wait"
            type="submit"
          >
            {loading ? "Criando..." : "Criar loja"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
