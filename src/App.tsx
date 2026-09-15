import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";
import { supabase } from "./lib/supabase";
import { getMyStores } from "./lib/marketSyncApi";
import { AppShell } from "./shared/AppShell";
import { StoreProvider } from "./shared/StoreContext";
import { StoreListProvider } from "./shared/StoreListContext";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ScheduleWorkspace } from "./features/schedules/ScheduleWorkspace";
import { EmployeesPage } from "./features/employees/EmployeesPage";
import { ConflictsPage } from "./features/conflicts/ConflictsPage";
import { PublicationsPage } from "./features/publications/PublicationsPage";
import { RulesPage } from "./features/rules/RulesPage";
import { AuditPage } from "./features/audit/AuditPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import "./App.css";

const SELECTED_STORE_KEY = "marketsync:selectedStoreId";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [allStores, setAllStores] = useState<
    Array<{ id: string; name: string; organizationId: string }>
  >([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(SELECTED_STORE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshStores = () => {
    getMyStores()
      .then((stores) => {
        setHasStore(stores.length > 0);
        setAllStores(
          stores.map((s) => ({ id: s.id, name: s.name, organizationId: s.organization_id })),
        );
      })
      .catch(() => setHasStore(false));
  };

  useEffect(() => {
    if (!session) {
      setHasStore(null);
      setAllStores([]);
      return;
    }
    refreshStores();
  }, [session]);

  const store = allStores.find((s) => s.id === selectedStoreId) ?? allStores[0];

  const selectStore = (id: string) => {
    setSelectedStoreId(id);
    try {
      localStorage.setItem(SELECTED_STORE_KEY, id);
    } catch {
      // Private browsing or storage disabled — selection just won't survive a reload.
    }
  };

  if (loadingSession)
    return <main className="auth-page">Carregando acesso seguro…</main>;
  if (supabase && passwordRecovery)
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />;
  if (supabase && !session) return <AuthScreen />;
  if (supabase && hasStore === null)
    return <main className="auth-page">Carregando sua operação…</main>;
  if (supabase && !hasStore)
    return <OnboardingScreen onComplete={refreshStores} />;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <StoreProvider value={store}>
        <StoreListProvider value={{ stores: allStores, selectStore, refreshStores }}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/app" replace />} />
              <Route path="/app" element={<DashboardPage />} />
              <Route path="/app/schedules" element={<ScheduleWorkspace />} />
              <Route path="/app/conflicts" element={<ConflictsPage />} />
              <Route path="/app/employees" element={<EmployeesPage />} />
              <Route path="/app/rules" element={<RulesPage />} />
              <Route path="/app/publications" element={<PublicationsPage />} />
              <Route path="/app/audit" element={<AuditPage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>
          </Routes>
        </StoreListProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}

export default App;
