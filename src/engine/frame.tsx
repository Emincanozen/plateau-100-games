import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

interface FrameState {
  /**
   * Publie la ligne d'etat de l'en-tete.
   * Elle vit hors de l'arbre React : seul l'en-tete se réabonne, ce qui evite
   * qu'un jeu se re-rende parce qu'il vient de publier son propre statut.
   */
  setStatus: (node: React.ReactNode) => void;
  subscribeStatus: (listener: () => void) => () => void;
  getStatus: () => React.ReactNode;
  registerRestart: (fn: () => void) => void;
  restart: () => void;
  /** Incremente a chaque remontage force : sert de cle de remontage du jeu. */
  runId: number;
  bumpRun: () => void;
}

const Ctx = createContext<FrameState | null>(null);

export function GameFrameProvider({ children }: { children: React.ReactNode }) {
  const [runId, setRunId] = useState(0);
  const statusRef = useRef<React.ReactNode>(null);
  const listenersRef = useRef(new Set<() => void>());
  const restartRef = useRef<(() => void) | null>(null);

  const value = useMemo<FrameState>(
    () => ({
      setStatus: (node) => {
        statusRef.current = node;
        listenersRef.current.forEach((listener) => listener());
      },
      subscribeStatus: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getStatus: () => statusRef.current,
      registerRestart: (fn) => {
        restartRef.current = fn;
      },
      restart: () => {
        if (restartRef.current) restartRef.current();
        else setRunId((n) => n + 1);
      },
      runId,
      bumpRun: () => setRunId((n) => n + 1),
    }),
    [runId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGameFrame(): FrameState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGameFrame doit être utilisé dans un GameFrameProvider');
  return ctx;
}

/**
 * Cote en-tete : composant feuille qui affiche la ligne d'etat.
 * Il doit rester une feuille — s'il englobait le jeu, chaque publication de
 * statut re-rendrait le jeu, qui republierait aussitot : boucle infinie.
 */
export function StatusSlot({ fallback }: { fallback?: React.ReactNode }) {
  const { subscribeStatus, getStatus } = useGameFrame();
  const status = useSyncExternalStore(subscribeStatus, getStatus, getStatus);
  return <>{status ?? fallback ?? null}</>;
}

/** Cote jeu : affiche une ligne d'etat dans l'en-tete (tour, score, chrono…). */
export function useFrameStatus(node: React.ReactNode) {
  const { setStatus } = useGameFrame();
  useEffect(() => {
    setStatus(node);
  });
  useEffect(() => () => setStatus(null), [setStatus]);
}

/** Cote jeu : branche le bouton « Recommencer » de l'en-tete. */
export function useFrameRestart(fn: () => void) {
  const { registerRestart } = useGameFrame();
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    registerRestart(() => saved.current());
  }, [registerRestart]);
}

/** Petit utilitaire : memoise un callback qui reste stable entre les rendus. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: never[]) => ref.current(...args)) as T, []);
}
