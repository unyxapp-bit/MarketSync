import { createContext, useContext } from "react";
import type { CurrentStore } from "./StoreContext";

export type StoreListContextValue = {
  stores: CurrentStore[];
  selectStore: (id: string) => void;
  refreshStores: () => void;
};

const StoreListContext = createContext<StoreListContextValue | undefined>(undefined);

export const StoreListProvider = StoreListContext.Provider;

export const useStoreList = () => useContext(StoreListContext);
