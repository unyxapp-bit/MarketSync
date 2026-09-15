import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { History, ShieldCheck } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { supabase } from "./lib/supabase";
import { getMyStores } from "./lib/marketSyncApi";
import { AppShell } from "./shared/AppShell";
import { PlaceholderPage } from "./shared/PlaceholderPage";
import { StoreProvider } from "./shared/StoreContext";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ScheduleWorkspace } from "./features/schedules/ScheduleWorkspace";
import { EmployeesPage } from "./features/employees/EmployeesPage";
import { ConflictsPage } from "./features/conflicts/ConflictsPage";
import { PublicationsPage } from "./features/publications/PublicationsPage";
import "./App.css";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [store, setStore] = useState<
    { id: string; name: string } | undefined
  >();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHasStore(null);
      setStore(undefined);
      return;
    }
    getMyStores()
      .then((stores) => {
        setHasStore(stores.length > 0);
        setStore(
          stores[0] ? { id: stores[0].id, name: stores[0].name } : undefined,
        );
      })
      .catch(() => setHasStore(false));
  }, [session]);

  if (loadingSession)
    return <main className="auth-page">Carregando acesso seguro…</main>;
  if (supabase && !session) return <AuthScreen />;
  if (supabase && hasStore === null)
    return <main className="auth-page">Carregando sua operação…</main>;
  if (supabase && !hasStore)
    return <OnboardingScreen onComplete={() => setHasStore(true)} />;

  return (
    <BrowserRouter>
      <StoreProvider value={store}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/schedules" element={<ScheduleWorkspace />} />
            <Route path="/app/conflicts" element={<ConflictsPage />} />
            <Route path="/app/employees" element={<EmployeesPage />} />
            <Route
              path="/app/rules"
              element={
                <PlaceholderPage
                  eyebrow="ADMINISTRADOR E RH"
                  title="Regras de conformidade"
                  description="Perfis de regras versionados por organização, com severidade, bloqueio, escopo e vigência configuráveis."
                  icon={ShieldCheck}
                />
              }
            />
            <Route path="/app/publications" element={<PublicationsPage />} />
            <Route
              path="/app/audit"
              element={
                <PlaceholderPage
                  eyebrow="ADMINISTRADOR, RH E AUDITOR"
                  title="Histórico e auditoria"
                  description="Linha do tempo de versões, comparação de mudanças e trilha completa de quem alterou o quê e por quê."
                  icon={History}
                />
              }
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}

export default App;
