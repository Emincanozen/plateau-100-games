import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { usePauseJeu } from '@/engine/frame';

/**
 * setInterval piloté par React. delay = null met en pause.
 * Le hook se fige aussi tout seul quand le jeu est en pause — pendant la
 * lecture des règles, par exemple : ni chrono ni boucle ne doivent tourner.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  const pause = usePauseJeu();
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || pause) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay, pause]);
}

/**
 * Boucle de jeu à base de requestAnimationFrame, avec delta en millisecondes.
 * Elle se fige aussi quand le jeu est en pause.
 */
export function useRafLoop(callback: (dtMs: number) => void, running: boolean) {
  const saved = useRef(callback);
  const pause = usePauseJeu();
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!running || pause) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      saved.current(Math.min(now - last, 64));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, pause]);
}

/** Chronomètre en secondes, qui démarre et s'arrête à la demande. */
export function useTimer(running: boolean, resetKey?: unknown) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => setSeconds(0), [resetKey]);
  useInterval(() => setSeconds((s) => s + 1), running ? 1000 : null);
  return seconds;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Taille d'un plateau carré qui tient dans l'écran.
 * `margin` : marge horizontale totale ; `maxRatio` : part max de la hauteur.
 */
export function useBoardSize(margin = 32, maxRatio = 0.62): number {
  const { width, height } = useWindowDimensions();
  return Math.floor(Math.min(width - margin, height * maxRatio, 520));
}

/** Valeur d'état accompagnée d'une pile d'annulation. */
export function useUndoable<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);

  const push = useCallback((next: T) => {
    setPresent((cur) => {
      past.current.push(cur);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev !== undefined) setPresent(prev);
    return prev !== undefined;
  }, []);

  const reset = useCallback((value: T) => {
    past.current = [];
    setPresent(value);
  }, []);

  return { present, push, undo, reset, canUndo: () => past.current.length > 0 };
}
