import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { changeMyPassword, translateAuthError } from "../lib/marketSyncApi";

export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password !== confirm) {
      setMessage("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await changeMyPassword(password);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? translateAuthError(error.message) : "Não foi possível trocar a senha.");
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
          <KeyRound size={20} />
        </div>
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-2">MARKETSYNC</p>
        <h1 className="text-[27px] tracking-[-1px] mb-[9px] text-ink font-[650]">Defina uma nova senha</h1>
        <p className="text-[13px] text-[#69778a] leading-[1.5] mb-[22px]">
          Escolha uma nova senha para voltar a acessar sua operação.
        </p>
        <form onSubmit={submit} className="grid gap-[14px]">
          <label className={labelClass}>
            Nova senha
            <input
              required
              name="password"
              type="password"
              minLength={8}
              placeholder="Mínimo de 8 caracteres"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Confirmar nova senha
            <input
              required
              name="confirm"
              type="password"
              minLength={8}
              placeholder="Repita a senha"
              className={inputClass}
            />
          </label>
          {message && <div className="text-[11px] leading-[1.4] rounded-[6px] p-[9px] bg-[#fff1ef] text-[#b23d34]">{message}</div>}
          <button
            disabled={loading}
            className="inline-flex items-center justify-center gap-[7px] h-[42px] rounded-[7px] bg-brand border border-brand text-white text-[13px] font-[750] tracking-[-0.01em] transition-colors duration-[120ms] hover:bg-brand-dark hover:border-brand-dark disabled:opacity-[.65] disabled:cursor-wait"
            type="submit"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
