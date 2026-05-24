import { createContext, useContext, type ReactNode } from 'react';
import type { Module } from '../types';

const ModuleNavigationContext = createContext<((m: Module) => void) | undefined>(undefined);

export function ModuleNavigationProvider({
  children,
  navigate,
}: {
  children: ReactNode;
  navigate: (m: Module) => void;
}) {
  return <ModuleNavigationContext.Provider value={navigate}>{children}</ModuleNavigationContext.Provider>;
}

/** Resolves module switches from breadcrumb / in-module navigation. Falls back to no-op outside a provider. */
export function useModuleNavigation(): (m: Module) => void {
  return useContext(ModuleNavigationContext) ?? (() => {});
}
