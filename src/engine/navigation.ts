import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * Retour au catalogue depuis n'importe quel écran.
 *
 * On n'utilise pas `back()` : ouvrir un jeu directement par son URL (lien
 * partagé, rechargement du navigateur, raccourci) laisse une pile d'un seul
 * écran, et `back()` échoue alors avec « The action GO_BACK was not handled
 * by any navigator ». `canGoBack()` ne suffit pas non plus sur le web, où il
 * consulte l'historique du navigateur et pas la pile de l'application.
 *
 * `dismissTo` dépile jusqu'au catalogue s'il est dans la pile, et le remplace
 * sinon : le comportement est correct dans les deux cas, sans avertissement.
 */
export function useRetour(): () => void {
  const router = useRouter();
  return useCallback(() => {
    router.dismissTo('/');
  }, [router]);
}
