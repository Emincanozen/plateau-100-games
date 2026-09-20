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
    // `play()` ne rend rien — sa signature est `play(): void`. Une tentative
    // précédente enveloppait sa valeur de retour dans un `.catch` : c'était
    // du code mort, et elle n'a jamais rien corrigé. Les rejets venaient de
    // `libererLesSons`, pas d'ici. Voir le commentaire ci-dessous.
    lecteur.play();
  } catch {
    /* lecture impossible : le jeu continue sans */
  }
}

/**
 * Libère les six lecteurs.
 *
 * **À n'appeler qu'à l'extinction de l'application, jamais en quittant un
 * écran de jeu.** C'était le cas, et cela produisait un rejet de promesse
 * non géré à presque chaque partie : détruire un lecteur dont la lecture est
 * en cours coupe l'élément audio sous-jacent, et le navigateur rejette la
 * promesse interne de `HTMLAudioElement.play()` — que l'application ne peut
 * pas attraper, puisque `expo-audio` ne la lui rend pas. Les messages
 * observés : « AbortError: The play() request was interrupted by a call to
 * pause() » et « NotSupportedError: The element has no supported sources ».
 *
 * Les six lecteurs pèsent quelques dizaines de kilo-octets : les garder en
 * vie pour toute la durée de l'application est à la fois plus simple et plus
 * juste, et c'est d'ailleurs la raison d'être du cache.
 */
export function libererLesSons() {
  for (const lecteur of lecteurs.values()) {
    try {
      lecteur.pause();
      lecteur.remove();
    } catch {
      /* déjà libéré */
    }
  }
  lecteurs.clear();
}
