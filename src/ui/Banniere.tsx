/**
 * Bannière du web — rien du tout.
 *
 * Metro prend `Banniere.native.tsx` sur iOS et Android. Ce fichier existe
 * pour que le paquet web n'embarque jamais la vue native de Google : sans
 * lui, Metro échoue à la construction (voir `src/pub/adaptateur.ts`).
 *
 * Le composant accepte la même prop que la vraie bannière, pour que les
 * écrans s'écrivent une seule fois.
 */
export function Banniere(_props: { marge?: number }) {
  return null;
}
