import type { User } from '@react-native-google-signin/google-signin';
import type { AuthProfile } from './types';

// Kept as a pure function (only imports a type, no native call) so it's unit-testable
// the same way as the rest of the app's decoupled logic modules.
export function toAuthProfile(user: User): AuthProfile {
  return {
    id: user.user.id,
    name: user.user.name,
    email: user.user.email,
    photoUrl: user.user.photo,
  };
}
