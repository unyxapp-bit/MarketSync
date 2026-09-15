import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Building2, KeyRound, LogOut, Save, Store as StoreIcon, User } from "lucide-react";
import {
  changeMyPassword,
  getMyProfile,
  loadOrganizationName,
  loadStoreDetails,
  signOut,
  updateMyProfile,
  updateOrganization,
  updateStore,
} from "../../lib/marketSyncApi";
import { useStore } from "../../shared/StoreContext";
import { PageHero } from "../../shared/ui/PageHero";

const cardClass = "p-[20px_22px] mb-[18px] bg-surface border border-line rounded-md shadow-xs overflow-hidden";
const formClass = "grid gap-3 py-4 border-b border-[#edf0f2]";
const labelClass = "grid gap-[5px] text-[10px] font-bold text-[#4e5d71] uppercase tracking-[0.3px]";
const inputClass =
  "h-[38px] border border-[#dce3e8] rounded-[6px] px-[10px] text-[13px] text-[#253247] normal-case tracking-normal font-normal";
const actionsClass = "flex justify-end gap-[9px] mt-[22px]";
const outlineBtn =
  "h-[38px] px-[13px] rounded-[7px] font-[750] inline-flex items-center gap-[6px] bg-surface border border-line text-ink-soft hover:border-[#c7cfda] hover:bg-[#fafbfc] disabled:opacity-50";
const solidBtn =
  "h-[38px] px-[13px] rounded-[7px] font-[750] inline-flex items-center gap-[6px] bg-brand border border-brand text-white hover:bg-brand-dark disabled:opacity-50";
const messageClass = (tone: "saving" | "error") =>
  `text-[11px] leading-[1.4] mt-[14px] p-[9px] rounded-[6px] ${
    tone === "saving" ? "bg-[#eff8f3] text-[#196d58]" : "bg-[#fff1ef] text-[#b23d34]"
  }`;

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function SettingsPage() {
  const store = useStore();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileTone, setProfileTone] = useState<"saving" | "error">("saving");
  const [profileMessage, setProfileMessage] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordTone, setPasswordTone] = useState<"saving" | "error">("saving");
  const [passwordMessage, setPasswordMessage] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [storeTone, setStoreTone] = useState<"saving" | "error">("saving");
  const [storeMessage, setStoreMessage] = useState("");

  const [orgName, setOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgTone, setOrgTone] = useState<"saving" | "error">("saving");
  const [orgMessage, setOrgMessage] = useState("");

  useEffect(() => {
    getMyProfile()
      .then((profile) => {
        setFullName(profile.full_name);
        setEmail(profile.email);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!store) return;
    loadStoreDetails(store.id)
      .then((details) => {
        setStoreName(details.name);
        setStoreCity(details.city ?? "");
        setStoreState(details.state ?? "");
      })
      .catch(() => undefined);
    loadOrganizationName(store.organizationId)
      .then(setOrgName)
      .catch(() => undefined);
  }, [store]);

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      await updateMyProfile(fullName);
      setProfileTone("saving");
      setProfileMessage("Perfil atualizado.");
    } catch {
      setProfileTone("error");
      setProfileMessage("Não foi possível salvar o perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setPasswordTone("error");
      setPasswordMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordTone("error");
      setPasswordMessage("As senhas não coincidem.");
      return;
    }
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      await changeMyPassword(newPassword);
      setPasswordTone("saving");
      setPasswordMessage("Senha alterada.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordTone("error");
      setPasswordMessage("Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  const submitOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store) return;
    setSavingOrg(true);
    setOrgMessage("");
    try {
      await updateOrganization(store.organizationId, orgName);
      setOrgTone("saving");
      setOrgMessage("Nome da empresa atualizado.");
    } catch (error) {
      setOrgTone("error");
      setOrgMessage(
        error instanceof Error && error.message.includes("owner")
          ? "Apenas o administrador (owner) da organização pode renomear a empresa."
          : "Não foi possível salvar.",
      );
    } finally {
      setSavingOrg(false);
    }
  };

  const submitStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store) return;
    setSavingStore(true);
    setStoreMessage("");
    try {
      await updateStore({ storeId: store.id, name: storeName, city: storeCity, state: storeState });
      setStoreTone("saving");
      setStoreMessage("Dados da loja atualizados.");
      // A store rename needs to reach the sidebar/topbar, which read the name from App.tsx's
      // top-level state; a full reload is the simplest way to refresh that without threading a
      // second context just for this rarely-used save.
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setStoreTone("error");
      setStoreMessage(
        error instanceof Error && error.message.includes("manager")
          ? "Apenas gerente, administrador ou RH/DP podem editar os dados da loja."
          : error instanceof Error && error.message.includes("UF")
            ? "Estado precisa ser a sigla de 2 letras (ex.: SP)."
            : "Não foi possível salvar os dados da loja.",
      );
    } finally {
      setSavingStore(false);
    }
  };

  return (
    <>
      <PageHero eyebrow="CONFIGURAÇÕES" title="Conta e loja" subtitle="Seu perfil, sua senha e os dados básicos desta loja." />

      <section className={cardClass}>
        <div className="flex items-end justify-between mb-[13px]">
          <h2 className="flex items-center gap-2 text-[20px] tracking-[-0.5px] m-0 text-ink font-[650]">
            <User size={16} /> Meu perfil
          </h2>
        </div>
        <form className={formClass} onSubmit={submitProfile}>
          <label className={labelClass}>
            Nome completo
            <input
              required
              className={inputClass}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            E-mail
            <input className={inputClass} value={email} disabled />
          </label>
          {profileMessage && <p className={messageClass(profileTone)}>{profileMessage}</p>}
          <div className={actionsClass}>
            <button className={solidBtn} type="submit" disabled={savingProfile}>
              <Save size={15} />
              {savingProfile ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </form>

        <form className={`${formClass} mt-[6px]`} onSubmit={submitPassword}>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Nova senha
              <input
                required
                type="password"
                minLength={6}
                className={inputClass}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Confirmar nova senha
              <input
                required
                type="password"
                minLength={6}
                className={inputClass}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>
          {passwordMessage && <p className={messageClass(passwordTone)}>{passwordMessage}</p>}
          <div className={actionsClass}>
            <button className={solidBtn} type="submit" disabled={savingPassword}>
              <KeyRound size={15} />
              {savingPassword ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </form>

        <div className={`${actionsClass} justify-start pt-1`}>
          <button className={outlineBtn} type="button" onClick={() => signOut()}>
            <LogOut size={15} />
            Sair da conta
          </button>
        </div>
      </section>

      {store && (
        <section className={cardClass}>
          <div className="flex items-end justify-between mb-[13px]">
            <div>
              <h2 className="flex items-center gap-2 text-[20px] tracking-[-0.5px] m-0 text-ink font-[650]">
                <Building2 size={16} /> Empresa
              </h2>
              <p className="text-[12px] text-[#748196] mt-[5px] mb-0">
                O nome da organização, compartilhado por todas as lojas/filiais. Só o administrador edita.
              </p>
            </div>
          </div>
          <form className={formClass} onSubmit={submitOrg}>
            <label className={labelClass}>
              Nome da empresa
              <input required className={inputClass} value={orgName} onChange={(event) => setOrgName(event.target.value)} />
            </label>
            {orgMessage && <p className={messageClass(orgTone)}>{orgMessage}</p>}
            <div className={actionsClass}>
              <button className={solidBtn} type="submit" disabled={savingOrg}>
                <Save size={15} />
                {savingOrg ? "Salvando..." : "Salvar nome da empresa"}
              </button>
            </div>
          </form>
        </section>
      )}

      {store && (
        <section className={cardClass}>
          <div className="flex items-end justify-between mb-[13px]">
            <div>
              <h2 className="flex items-center gap-2 text-[20px] tracking-[-0.5px] m-0 text-ink font-[650]">
                <StoreIcon size={16} /> Dados da loja
              </h2>
              <p className="text-[12px] text-[#748196] mt-[5px] mb-0">
                Visível para toda a equipe; só gerente, administrador ou RH/DP podem salvar.
              </p>
            </div>
          </div>
          <form className={formClass} onSubmit={submitStore}>
            <label className={labelClass}>
              Nome da loja
              <input required className={inputClass} value={storeName} onChange={(event) => setStoreName(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Cidade
                <input className={inputClass} value={storeCity} onChange={(event) => setStoreCity(event.target.value)} />
              </label>
              <label className={labelClass}>
                Estado
                <select className={inputClass} value={storeState} onChange={(event) => setStoreState(event.target.value)}>
                  <option value="">—</option>
                  {BRAZILIAN_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {storeMessage && <p className={messageClass(storeTone)}>{storeMessage}</p>}
            <div className={actionsClass}>
              <button className={solidBtn} type="submit" disabled={savingStore}>
                <Save size={15} />
                {savingStore ? "Salvando..." : "Salvar dados da loja"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
