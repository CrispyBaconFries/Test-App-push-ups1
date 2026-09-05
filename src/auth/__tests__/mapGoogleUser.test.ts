import { toAuthProfile } from '../mapGoogleUser';
import type { User } from '@react-native-google-signin/google-signin';

function buildUser(overrides: Partial<User['user']> = {}): User {
  return {
    user: {
      id: 'abc123',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      photo: 'https://example.com/ada.jpg',
      familyName: 'Lovelace',
      givenName: 'Ada',
      ...overrides,
    },
    scopes: ['email', 'profile'],
    idToken: 'some.jwt.token',
    serverAuthCode: null,
  };
}

describe('toAuthProfile', () => {
  it('maps the fields the app actually shows', () => {
    const profile = toAuthProfile(buildUser());
    expect(profile).toEqual({
      id: 'abc123',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      photoUrl: 'https://example.com/ada.jpg',
    });
  });

  it('passes through a missing name/photo as null instead of guessing a fallback', () => {
    const profile = toAuthProfile(buildUser({ name: null, photo: null }));
    expect(profile.name).toBeNull();
    expect(profile.photoUrl).toBeNull();
  });
});
