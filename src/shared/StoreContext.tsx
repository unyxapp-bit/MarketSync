import { createContext, useContext } from 'react'

export type CurrentStore = { id: string; name: string }

const StoreContext = createContext<CurrentStore | undefined>(undefined)

export const StoreProvider = StoreContext.Provider

export const useStore = () => useContext(StoreContext)
