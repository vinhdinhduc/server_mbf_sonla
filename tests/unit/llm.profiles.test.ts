import { sequelize } from '../../src/config/database';
import { env } from '../../src/config/env';
import { encryptSecret, decryptSecret } from '../../src/utils/secretCrypto';
import {
  LEGACY_PROFILE_ID,
  profileKey,
  publicProfiles,
  resolveProfiles,
  saveProfiles,
  ProfileInput,
} from '../../src/services/llm/profiles';
import { Transaction } from 'sequelize';

const profile: ProfileInput = {
  id: LEGACY_PROFILE_ID,
  name: 'Main',
  provider: 'openai',
  model: 'test',
  enabled: true,
  temperature: 0.2,
  max_tokens: 1024,
  top_p: 1,
};
describe('Profile credentials and persistence', () => {
  beforeAll(() => {
    env.APP_SECRET_KEY ||= 'test-only-application-secret-32-chars';
  });
  afterEach(() => jest.restoreAllMocks());
  const values = { ai_profiles_enabled: 'true' };
  function database(config = profile) {
    return jest
      .spyOn(sequelize, 'query')
      .mockResolvedValue([
        { id: config.id, config, api_key_encrypted: encryptSecret('saved-secret') },
      ] as never);
  }
  test('legacy configuration needs no migration to remain readable', async () => {
    const query = jest.spyOn(sequelize, 'query');
    const rows = await publicProfiles({
      ai_provider: 'openai',
      ai_model: 'old-model',
      ai_api_key_encrypted: encryptSecret('old-secret'),
    });
    expect(rows[0]).toMatchObject({ id: LEGACY_PROFILE_ID, model: 'old-model', has_api_key: true });
    expect(JSON.stringify(rows)).not.toContain('old-secret');
    expect(query).not.toHaveBeenCalled();
  });
  test('returns masked data only, and reads the matching stored key', async () => {
    database();
    expect(JSON.stringify(await publicProfiles(values))).not.toContain('saved-secret');
    expect(await profileKey({ profile_id: profile.id, provider: 'openai' }, values)).toBe(
      'saved-secret',
    );
  });
  test.each([
    { provider: 'gemini' },
    { provider: 'openai', endpoint_id: 'different-region' },
    { provider: 'openai', base_url: 'https://attacker.example' },
  ])('never forwards saved keys after target changes: %j', async (input) => {
    database();
    expect(await profileKey({ profile_id: profile.id, ...input }, values)).toBe('');
  });
  test('explicit draft key requires no database access', async () => {
    const query = jest.spyOn(sequelize, 'query');
    expect(await profileKey({ provider: 'openai', api_key: 'new-secret' }, values)).toBe(
      'new-secret',
    );
    expect(query).not.toHaveBeenCalled();
  });
  test('replacement encrypts key and strips it from profile JSON in the same transaction', async () => {
    const query = database();
    const transaction = {} as Transaction;
    await saveProfiles([{ ...profile, api_key: 'new-secret' }], values, 1, transaction);
    const write = query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO ai_profiles'),
    )!;
    const options = write[1] as { replacements: Record<string, any>; transaction: Transaction };
    expect(options.transaction).toBe(transaction);
    expect(options.replacements.config).not.toContain('new-secret');
    expect(options.replacements.key).not.toContain('new-secret');
    expect(decryptSecret(options.replacements.key)).toBe('new-secret');
    expect(query.mock.calls.every(([, opt]) => (opt as any).logging === false)).toBe(true);
  });
  test('disabled profiles are not used for fallback', async () => {
    database({ ...profile, enabled: false });
    expect(await resolveProfiles(values)).toEqual([]);
  });
});
