import { useAudioPlayer } from 'expo-audio';

const GOOD_REP_SOUND = require('../../assets/sounds/rep-good.wav');
const IMPERFECT_REP_SOUND = require('../../assets/sounds/rep-warn.wav');

/**
 * Two short confirmation sounds so a user doesn't have to watch the screen mid-set to
 * know whether a rep counted, and whether it was clean: a bright ascending chime for a
 * rep with no form issues, a single softer tone for a rep that counted but had one.
 * Deliberately sound-only, no vibration - see WorkoutScreen for why.
 */
export function useRepSounds() {
  const goodPlayer = useAudioPlayer(GOOD_REP_SOUND);
  const imperfectPlayer = useAudioPlayer(IMPERFECT_REP_SOUND);

  return function playRepSound(clean: boolean) {
    const player = clean ? goodPlayer : imperfectPlayer;
    player.seekTo(0).finally(() => player.play());
  };
}
