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
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">CONFIGURAÇÕES</p>
          <h1>Conta e loja</h1>
          <p className="subtitle">Seu perfil, sua senha e os dados básicos desta loja.</p>
        </div>
      </section>

      <section className="conflict-card settings-card">
        <div className="audit-title">
          <div>
            <h2>
              <User size={16} /> Meu perfil
            </h2>
          </div>
        </div>
        <form className="directory-form" onSubmit={submitProfile}>
          <label>
            Nome completo
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            E-mail
            <input value={email} disabled />
          </label>
          {profileMessage && <p className={`editor-message ${profileTone}`}>{profileMessage}</p>}
          <div className="editor-actions">
            <button className="solid" type="submit" disabled={savingProfile}>
              <Save size={15} />
              {savingProfile ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </form>

        <form className="directory-form settings-password-form" onSubmit={submitPassword}>
          <div className="directory-form-row">
            <label>
              Nova senha
              <input
                required
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                required
                type="password"
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>
          {passwordMessage && <p className={`editor-message ${passwordTone}`}>{passwordMessage}</p>}
          <div className="editor-actions">
            <button className="solid" type="submit" disabled={savingPassword}>
              <KeyRound size={15} />
              {savingPassword ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </form>

        <div className="editor-actions settings-signout">
          <button className="outline" type="button" onClick={() => signOut()}>
            <LogOut size={15} />
            Sair da conta
          </button>
        </div>
      </section>

      {store && (
        <section className="conflict-card settings-card">
          <div className="audit-title">
            <div>
              <h2>
                <Building2 size={16} /> Empresa
              </h2>
              <p>O nome da organização, compartilhado por todas as lojas/filiais. Só o administrador edita.</p>
            </div>
          </div>
          <form className="directory-form" onSubmit={submitOrg}>
            <label>
              Nome da empresa
              <input required value={orgName} onChange={(event) => setOrgName(event.target.value)} />
            </label>
            {orgMessage && <p className={`editor-message ${orgTone}`}>{orgMessage}</p>}
            <div className="editor-actions">
              <button className="solid" type="submit" disabled={savingOrg}>
                <Save size={15} />
                {savingOrg ? "Salvando..." : "Salvar nome da empresa"}
              </button>
            </div>
          </form>
        </section>
      )}

      {store && (
        <section className="conflict-card settings-card">
          <div className="audit-title">
            <div>
              <h2>
                <StoreIcon size={16} /> Dados da loja
              </h2>
              <p>Visível para toda a equipe; só gerente, administrador ou RH/DP podem salvar.</p>
            </div>
          </div>
          <form className="directory-form" onSubmit={submitStore}>
            <label>
              Nome da loja
              <input required value={storeName} onChange={(event) => setStoreName(event.target.value)} />
            </label>
            <div className="directory-form-row">
              <label>
                Cidade
                <input value={storeCity} onChange={(event) => setStoreCity(event.target.value)} />
              </label>
              <label>
                Estado
                <select value={storeState} onChange={(event) => setStoreState(event.target.value)}>
                  <option value="">—</option>
                  {BRAZILIAN_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {storeMessage && <p className={`editor-message ${storeTone}`}>{storeMessage}</p>}
            <div className="editor-actions">
              <button className="solid" type="submit" disabled={savingStore}>
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
