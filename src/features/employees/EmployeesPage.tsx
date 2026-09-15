import { TeamAdmin } from "../../components/TeamAdmin";
import { useStore } from "../../shared/StoreContext";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { SectorManager } from "./SectorManager";

export function EmployeesPage() {
  const store = useStore();
  if (!store) return null;
  return (
    <>
      <section className="hero hero-simple">
        <div>
          <p className="eyebrow">GESTÃO DE PESSOAS</p>
          <h1>Colaboradores</h1>
          <p className="subtitle">
            Cadastro, contrato, setores e permissões da equipe da loja.
          </p>
        </div>
      </section>
      <SectorManager storeId={store.id} />
      <EmployeeDirectory storeId={store.id} />
      <TeamAdmin storeId={store.id} />
    </>
  );
}
