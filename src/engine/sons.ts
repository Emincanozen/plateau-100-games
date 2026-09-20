import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { HapticKind } from './haptics';

/**
 * Effets sonores de l'interface.
 *
 * Les sons suivent exactement les mêmes événements que le retour haptique :
 * les jeux appellent `haptic(kind)`, l'hôte déclenche vibration et son
 * ensemble. Aucun des cent jeux n'a besoin de connaître ce module.
 *
 * Les fichiers sont synthétisés par `node outils/sons.mjs` — quelques dizaines
 * de kilo-octets embarqués dans l'application, rien à télécharger.
 */

const SOURCES: Record<HapticKind, number> = {
  light: require('../../assets/sons/leger.wav'),
  medium: require('../../assets/sons/moyen.wav'),
  heavy: require('../../assets/sons/lourd.wav'),
  success: require('../../assets/sons/succes.wav'),
  warning: require('../../assets/sons/avertissement.wav'),
  error: require('../../assets/sons/erreur.wav'),
};

/** Un son bref ne doit pas couper la musique que l'utilisateur écoute. */
let modeRegle = false;
function reglerLeMode() {
  if (modeRegle) return;
  modeRegle = true;
  void setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch(() => {
    /* appareil sans audio : on continue sans son */
  });
}

const lecteurs = new Map<HapticKind, AudioPlayer>();

function lecteurPour(kind: HapticKind): AudioPlayer | null {
  const existant = lecteurs.get(kind);
  if (existant) return existant;
  try {
    const lecteur = createAudioPlayer(SOURCES[kind]);
    lecteur.volume = kind === 'light' ? 0.35 : 0.6;
    lecteurs.set(kind, lecteur);
    return lecteur;
  } catch {
    return null;
  }
}

/**
 * Joue l'effet correspondant. Les lecteurs sont créés une seule fois puis
 * réutilisés : en rejouer un revient à le rembobiner, ce qui évite d'allouer
 * une ressource audio à chaque coup joué.
 */
export function jouerSon(kind: HapticKind = 'light') {
  reglerLeMode();
  const lecteur = lecteurPour(kind);
  if (!lecteur) return;
  try {
    lecteur.seekTo(0);
    // Sur le web, `play()` rend une promesse que le navigateur rejette si une
    // nouvelle lecture démarre avant la fin de la précédente — cas courant
    // quand deux coups s'enchaînent vite. Le try/catch ne l'attrape pas :
    // il faut la traiter explicitement, sinon la console se remplit de
    // rejets non gérés.
    const lecture: unknown = lecteur.play();
    if (lecture && typeof (lecture as Promise<void>).catch === 'function') {
      void (lecture as Promise<void>).catch(() => {
        /* lecture interrompue par la suivante : sans conséquence */
      });
    }
  } catch {
    /* lecture impossible : le jeu continue sans */
  }
}

/** Libère les ressources audio. Appelé à la fermeture d'un écran de jeu. */
export function libererLesSons() {
  for (const lecteur of lecteurs.values()) {
    try {
      lecteur.remove();
    } catch {
      /* déjà libéré */
    }
  }
  lecteurs.clear();
}
