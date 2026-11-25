import { createContext, useContext } from 'react'

// Lets any component switch the main view, e.g. inspector → component reference
export const NavCtx = createContext({ go: () => {} })
export const useNav = () => useContext(NavCtx)
