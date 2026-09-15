import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  requestPasswordReset,
  resendConfirmationEmail,
  signIn,
  signUp,
  translateAuthError,
} from "../lib/marketSyncApi";

type Mode = "signin" | "signup" | "reset";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("error");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resending, setResending] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage("");
    setUnconfirmedEmail("");
  };

  const resendConfirmation = async () => {
    setResending(true);
    try {
      await resendConfirmationEmail(unconfirmedEmail);
      setMessageTone("info");
      setMessage("Reenviamos o e-mail de confirmação. Confira sua caixa de entrada.");
      setUnconfirmedEmail("");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? translateAuthError(error.message) : "Não foi possível reenviar.");
    } finally {
      setResending(false);
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    setMessage("");
    setUnconfirmedEmail("");
    if (mode === "signup" && form.get("password") !== form.get("confirmPassword")) {
      setMessageTone("error");
      setMessage("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "reset") {
        await requestPasswordReset(String(form.get("email")));
        setMessageTone("info");
        setMessage("Enviamos um link para redefinir sua senha. Confira seu e-mail.");
        return;
      }
      const result =
        mode === "signin"
          ? await signIn(email, String(form.get("password")))
          : await signUp(String(form.get("fullName")), email, String(form.get("password")));
      if (result.error) {
        setMessageTone("error");
        setMessage(translateAuthError(result.error.message));
        if (result.error.message === "Email not confirmed") setUnconfirmedEmail(email);
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

  const inputClass =
    "h-[42px] border border-[#dce3e8] rounded-[7px] px-[11px] outline-none text-[13px] focus:border-[#48a887] focus:shadow-[0_0_0_3px_#e2f5ed]";
  const labelClass = "grid gap-1.5 text-[11px] font-[750] text-[#435167]";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-[linear-gradient(135deg,#edf8f2,#f9fafb)]">
      <section className="w-full max-w-[410px] p-9 bg-surface border border-line rounded-md shadow-xs">
        <div className="h-[42px] w-[42px] grid place-items-center rounded-xl bg-[#177d62] text-white font-bold text-2xl mb-6 font-[Georgia]">
          M
        </div>
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-2">MARKETSYNC</p>
        <h1 className="text-[27px] tracking-[-1px] mb-[9px] text-ink font-[650]">{heading}</h1>
        <p className="text-[13px] text-[#69778a] leading-[1.5] mb-[22px]">{subtitle}</p>
        <form onSubmit={submit} className="grid gap-[14px]">
          {mode === "signup" && (
            <label className={labelClass}>
              Nome completo
              <input required name="fullName" placeholder="Seu nome" className={inputClass} />
            </label>
          )}
          <label className={labelClass}>
            E-mail
            <input required name="email" type="email" placeholder="voce@empresa.com" className={inputClass} />
          </label>
          {mode !== "reset" && (
            <label className={labelClass}>
              Senha
              <input
                required
                name="password"
                type="password"
                minLength={8}
                placeholder="Mínimo de 8 caracteres"
                className={inputClass}
              />
            </label>
          )}
          {mode === "signup" && (
            <label className={labelClass}>
              Confirmar senha
              <input
                required
                name="confirmPassword"
                type="password"
                minLength={8}
                placeholder="Repita a senha"
                className={inputClass}
              />
            </label>
          )}
          {message && (
            <div
              className={`text-[11px] leading-[1.4] rounded-[6px] p-[9px] ${
                messageTone === "info" ? "bg-[#fff7e2] text-[#8b6515]" : "bg-[#fff1ef] text-[#b23d34]"
              }`}
            >
              {message}
            </div>
          )}
          {unconfirmedEmail && (
            <button
              className="block border-0 bg-transparent text-[#7b8798] text-[11px] mt-3 p-0 underline text-left"
              type="button"
              disabled={resending}
              onClick={resendConfirmation}
            >
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </button>
          )}
          <button
            disabled={loading}
            className="inline-flex items-center justify-center gap-[7px] h-[42px] rounded-[7px] bg-brand border border-brand text-white text-[13px] font-[750] tracking-[-0.01em] transition-colors duration-[120ms] hover:bg-brand-dark hover:border-brand-dark disabled:opacity-[.65] disabled:cursor-wait"
            type="submit"
          >
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
          <button
            className="block border-0 bg-transparent text-[#7b8798] text-[11px] mt-3 p-0 underline text-left"
            type="button"
            onClick={() => switchMode("reset")}
          >
            Esqueci minha senha
          </button>
        )}
        <button
          className="block border-0 bg-transparent text-[#167a62] text-[12px] font-[750] mt-[17px] p-0"
          type="button"
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Ainda não tenho acesso" : "Já tenho acesso"}
        </button>
        <small className="mt-[23px] pt-[14px] border-t border-[#edf0f2] text-[#7b8798] text-[10px] flex items-center gap-[5px]">
          <ShieldCheck size={13} />
          Dados protegidos por autenticação e permissões por loja.
        </small>
      </section>
    </main>
  );
}
