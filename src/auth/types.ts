/** Minimal local profile shown in the UI - never sent anywhere, since the app has no backend yet. */
export interface AuthProfile {
  id: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
}
