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

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          <KeyRound size={20} />
        </div>
        <p className="eyebrow">MARKETSYNC</p>
        <h1>Defina uma nova senha</h1>
        <p>Escolha uma nova senha para voltar a acessar sua operação.</p>
        <form onSubmit={submit}>
          <label>
            Nova senha
            <input required name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" />
          </label>
          <label>
            Confirmar nova senha
            <input required name="confirm" type="password" minLength={8} placeholder="Repita a senha" />
          </label>
          {message && <div className="auth-message error">{message}</div>}
          <button disabled={loading} className="solid" type="submit">
            {loading ? "Salvando..." : "Salvar nova senha"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
