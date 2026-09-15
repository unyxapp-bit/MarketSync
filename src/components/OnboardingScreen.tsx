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

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          <Store size={20} />
        </div>
        <p className="eyebrow">CONFIGURAÇÃO INICIAL</p>
        <h1>Cadastre sua primeira loja</h1>
        <p>Ela será o espaço seguro da sua equipe, setores, escalas e histórico de validações.</p>
        <form onSubmit={submit}>
          <label>
            Empresa
            <input required name="organization" placeholder="Ex.: Mercado Central Ltda." />
          </label>
          <label>
            Nome da loja
            <input required name="store" placeholder="Ex.: Loja Centro" />
          </label>
          <div className="auth-form-row">
            <label>
              Cidade (opcional)
              <input name="city" placeholder="Ex.: São Paulo" />
            </label>
            <label>
              UF (opcional)
              <select name="state" defaultValue="">
                <option value="">—</option>
                {BRAZILIAN_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {message && <div className="auth-message error">{message}</div>}
          <button disabled={loading} className="solid" type="submit">
            {loading ? "Criando..." : "Criar loja"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
