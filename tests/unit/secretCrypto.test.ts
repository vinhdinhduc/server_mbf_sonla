import { env } from '../../src/config/env';
import { decryptSecret, encryptSecret, maskSecret } from '../../src/utils/secretCrypto';

describe('secret rotation', () => {
  const current = env.APP_SECRET_KEY;
  const previous = env.APP_SECRET_KEY_PREVIOUS;
  afterEach(() => {
    env.APP_SECRET_KEY = current;
    env.APP_SECRET_KEY_PREVIOUS = previous;
  });
  test('reads old ciphertext using a rotation key and encrypts new values with the current key', () => {
    env.APP_SECRET_KEY = 'previous-test-secret-at-least-32-characters';
    const oldKey = env.APP_SECRET_KEY;
    const encrypted = encryptSecret('credential-1234');
    env.APP_SECRET_KEY = 'current-test-secret-at-least-32-characters';
    env.APP_SECRET_KEY_PREVIOUS = [oldKey];
    expect(decryptSecret(encrypted)).toBe('credential-1234');
    expect(maskSecret(encrypted)).toBe('****1234');
    const replacement = encryptSecret('replacement');
    env.APP_SECRET_KEY_PREVIOUS = [];
    expect(decryptSecret(replacement)).toBe('replacement');
    expect(() => decryptSecret(encrypted)).toThrow('cannot be decrypted');
  });
  test.each(['enc:v1:invalid', 'enc:v2:anything', 'enc:v1:a.b.c.d'])(
    'rejects malformed or unknown ciphertext %s',
    (value) => {
      expect(() => decryptSecret(value)).toThrow();
      expect(() => maskSecret(value)).toThrow();
    },
  );
});
