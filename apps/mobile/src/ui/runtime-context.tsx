import { createContext, useContext } from 'react';
import type { Runtime } from '../runtime/runtime.js';

const RuntimeContext = createContext<Runtime | null>(null);

/** Fournit les vues-modèles à tous les écrans. */
export const RuntimeProvider = RuntimeContext.Provider;

/** Vues-modèles de l'application (le fournisseur est monté dans la mise en page racine). */
export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error('RuntimeProvider manquant');
  return runtime;
}
