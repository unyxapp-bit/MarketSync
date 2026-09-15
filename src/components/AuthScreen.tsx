import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { requestPasswordReset, signIn, signUp, translateAuthError } from "../lib/marketSyncApi";

type Mode = "signin" | "signup" | "reset";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("error");

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    try {
      if (mode === "reset") {
        await requestPasswordReset(String(form.get("email")));
        setMessageTone("info");
        setMessage("Enviamos um link para redefinir sua senha. Confira seu e-mail.");
        return;
      }
      const result =
        mode === "signin"
          ? await signIn(String(form.get("email")), String(form.get("password")))
          : await signUp(
              String(form.get("fullName")),
              String(form.get("email")),
              String(form.get("password")),
            );
      if (result.error) {
        setMessageTone("error");
        setMessage(translateAuthError(result.error.message));
      } else if (mode === "signup") {
        setMessageTone("info");
        setMessage("Cadastro criado. Confira seu e-mail para confirmar o acesso.");
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? translateAuthError(error.message) : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "signin" ? "Acesse sua operação" : mode === "signup" ? "Crie sua operação" : "Recuperar senha";
  const subtitle =
    mode === "signin"
      ? "Entre para administrar as escalas da sua loja."
      : mode === "signup"
        ? "O primeiro acesso cria sua conta de gestor."
        : "Informe seu e-mail e enviaremos um link para você definir uma nova senha.";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">M</div>
        <p className="eyebrow">MARKETSYNC</p>
        <h1>{heading}</h1>
        <p>{subtitle}</p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nome completo
              <input required name="fullName" placeholder="Seu nome" />
            </label>
          )}
          <label>
            E-mail
            <input required name="email" type="email" placeholder="voce@empresa.com" />
          </label>
          {mode !== "reset" && (
            <label>
              Senha
              <input required name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" />
            </label>
          )}
          {message && <div className={`auth-message ${messageTone}`}>{message}</div>}
          <button disabled={loading} className="solid" type="submit">
            {loading
              ? "Aguarde..."
              : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar acesso"
                  : "Enviar link de redefinição"}
            <ArrowRight size={16} />
          </button>
        </form>
        {mode === "signin" && (
          <button className="auth-forgot" type="button" onClick={() => switchMode("reset")}>
            Esqueci minha senha
          </button>
        )}
        <button className="auth-switch" type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Ainda não tenho acesso" : "Já tenho acesso"}
        </button>
        <small>
          <ShieldCheck size={13} />
          Dados protegidos por autenticação e permissões por loja.
        </small>
      </section>
    </main>
  );
}
