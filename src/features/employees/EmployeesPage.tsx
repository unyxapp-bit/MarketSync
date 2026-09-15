import { TeamAdmin } from "../../components/TeamAdmin";
import { useStore } from "../../shared/StoreContext";
import { PageHero } from "../../shared/ui/PageHero";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { SectorManager } from "./SectorManager";

export function EmployeesPage() {
  const store = useStore();
  if (!store) return null;
  return (
    <>
      <PageHero
        eyebrow="GESTÃO DE PESSOAS"
        title="Colaboradores"
        subtitle="Cadastro, contrato, setores e permissões da equipe da loja."
      />
      <SectorManager storeId={store.id} />
      <EmployeeDirectory storeId={store.id} />
      <TeamAdmin storeId={store.id} />
    </>
  );
}
