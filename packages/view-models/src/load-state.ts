/** État de chargement commun aux vues-modèles (`forbidden` : accès refusé, HTTP 403). */
export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden';
