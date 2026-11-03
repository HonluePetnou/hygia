'use client';

import { useEffect, useState } from 'react';

/**
 * Crée une vue-modèle une seule fois par composant et la charge au montage.
 * `dispose` (facultatif) est appelé au démontage.
 */
export function useViewModel<T>(
  create: () => T,
  load: (viewModel: T) => void,
  dispose?: (viewModel: T) => void,
): T {
  const [viewModel] = useState(create);
  useEffect(() => {
    load(viewModel);
    return () => dispose?.(viewModel);
  }, [viewModel]); // la vue-modèle est stable : `load` et `dispose` ne changent pas de sens
  return viewModel;
}
